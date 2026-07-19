import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* Colors: client blue, query machinery amber, buffer pool / heap green,
   WAL & replication violet, vacuum & danger red. */
const C = {
  client: VIZ.blue,
  machine: VIZ.amber,
  buf: VIZ.green,
  wal: VIZ.violet,
  vac: VIZ.red,
}

export const queryTrace: TraceSpec = {
  title: 'Trace one UPDATE — from SQL text to fsync',
  aspect: 0.5,
  zones: [
    { label: 'Client', x: 2, y: 4, w: 21, h: 42 },
    { label: 'Backend process & shared memory', x: 27, y: 4, w: 45, h: 42 },
    { label: 'Disk', x: 76, y: 4, w: 22, h: 42 },
  ],
  nodes: [
    { id: 'app', x: 4.5, y: 9, w: 16, h: 7, label: 'Your app', sub: 'BEGIN … COMMIT', color: C.client },
    { id: 'pool', x: 4.5, y: 33, w: 16, h: 8, label: 'PgBouncer', sub: 'transaction pooling', color: C.client },
    { id: 'parser', x: 29.5, y: 8, w: 17, h: 8, label: 'Parser + rewriter', sub: 'SQL → query tree', color: C.machine },
    { id: 'planner', x: 51, y: 8, w: 18, h: 8, label: 'Planner', sub: 'cost model × statistics', color: C.machine },
    { id: 'exec', x: 29.5, y: 21, w: 17, h: 8, label: 'Executor', sub: 'pull-based plan tree', color: C.machine },
    { id: 'shbuf', x: 51, y: 21, w: 18, h: 9, label: 'Shared buffers', sub: 'heap + index pages', color: C.buf },
    { id: 'walbuf', x: 37, y: 35, w: 18, h: 7.5, label: 'WAL buffers', sub: 'redo records', color: C.wal },
    { id: 'repl', x: 78, y: 8, w: 18, h: 8, label: 'walsender → replicas', sub: 'streaming WAL', color: C.wal },
    { id: 'heap', x: 78, y: 21, w: 18, h: 9, label: 'Heap & index files', sub: 'written lazily, later', color: C.buf },
    { id: 'waldisk', x: 78, y: 35, w: 18, h: 7.5, label: 'pg_wal', sub: 'fsync = the commit', color: C.wal },
  ],
  steps: [
    {
      title: 'One connection = one process',
      prose:
        'The postmaster <b>forks a dedicated OS process</b> for every connection — no thread pool, no event loop. Each backend costs megabytes (plus <code>work_mem</code> per sort or hash) and its own scheduler slot, which is why raw connections are precious and <b>PgBouncer</b> in transaction mode — multiplexing thousands of app connections onto a few dozen real backends — is standard kit, not an optimization.',
      focus: ['app', 'pool'],
      particles: [
        { from: 'app', to: 'pool', color: C.client },
        { from: 'pool', to: 'parser', color: C.client, via: [{ x: 25, y: 37 }, { x: 25, y: 12 }] },
      ],
    },
    {
      title: 'Parse and rewrite',
      prose:
        'The parser turns SQL text into a parse tree; the analyzer resolves every name against the <b>system catalogs</b> (your schema is itself stored in tables); the rewriter expands views and rules. Nothing here touches your data — but it does touch the catalogs, which is why even trivial queries benefit from the catalog caches each backend keeps warm (and why brand-new connections are slower than pooled ones).',
      focus: ['parser'],
      particles: [{ from: 'parser', to: 'planner', color: C.machine }],
    },
    {
      title: 'Plan — the cost-based gamble',
      prose:
        'The planner enumerates ways to run the query — sequential scan vs index scan, join orders, join algorithms — and prices each using <b>statistics gathered by ANALYZE</b>: row counts, value histograms, correlation. It picks the cheapest <em>estimate</em>. This is the system’s biggest bet: stale or unrepresentative stats mean a confidently wrong plan, which is how a query that ran in 2 ms all year suddenly takes 40 seconds at 3am (the “plan flip” in Chapter 8).',
      focus: ['planner'],
      particles: [{ from: 'planner', to: 'exec', color: C.machine }],
    },
    {
      title: 'Execute — walk the index to the heap',
      prose:
        'The executor runs the plan as a tree of iterators, each node pulling rows from its children. For our UPDATE it descends the <b>B-tree index</b> to a heap page address, then asks the <b>buffer manager</b> for that 8 KB page. Hit in <code>shared_buffers</code> → nanoseconds. Miss → read from the OS page cache or disk and evict a victim via clock-sweep. Postgres deliberately caches <em>twice</em> — shared buffers + OS cache — which is why <code>shared_buffers</code> is set to ~25% of RAM, not all of it.',
      focus: ['exec', 'shbuf'],
      particles: [{ from: 'exec', to: 'shbuf', color: C.buf }],
    },
    {
      title: 'MVCC: an UPDATE never updates',
      prose:
        'Here is Postgres’s deepest design decision: the old row is <b>not overwritten</b>. A brand-new row version is inserted (stamped <code>xmin</code> = our transaction ID) and the old version is stamped <code>xmax</code> — “superseded by 205.” Both versions now coexist on disk. Readers holding older snapshots keep seeing the old version, <b>without taking any lock</b>. The price: every UPDATE is physically an INSERT plus a deferred delete someone must clean up later — vacuum debt, the subject of the next trace.',
      focus: ['exec', 'shbuf'],
      particles: [{ from: 'exec', to: 'shbuf', color: C.vac, count: 2 }],
    },
    {
      title: 'WAL first — always',
      prose:
        'Before the dirtied page can ever reach disk, the change is described as a <b>redo record</b> in the WAL buffers: “page X, offset Y, these bytes.” This is the <em>write-ahead</em> rule — the log is the truth, the data files are a lagging cache of it. Sound familiar? It is Kafka’s append-only log turned inward: same idea, pointed at pages instead of messages.',
      focus: ['exec', 'walbuf'],
      particles: [{ from: 'exec', to: 'walbuf', color: C.wal }],
    },
    {
      title: 'COMMIT = one sequential fsync',
      prose:
        'At COMMIT, the WAL buffers are flushed and <b>fsync’d to <code>pg_wal</code></b> — the only synchronous disk write in the entire path. Commit latency <em>is</em> WAL-flush latency: ~0.1–0.3 ms on NVMe, ~10 ms on spinning rust. Concurrent commits piggyback on one flush (<b>group commit</b>), so throughput scales even though each commit waits. The transaction is now durable — even though the heap page it changed exists only in memory.',
      focus: ['walbuf', 'waldisk'],
      particles: [{ from: 'walbuf', to: 'waldisk', color: C.wal }],
    },
    {
      title: 'The WAL fans out',
      prose:
        'The same bytes just fsync’d are streamed by <b>walsender</b> processes to every replica, which replay them against their own copies — replicas are not “kept in sync,” they simply <em>re-run the log</em>. Asynchronous by default (milliseconds behind); list a standby in <code>synchronous_standby_names</code> and COMMIT also waits for its ack — zero data loss on failover, one network RTT added to every write.',
      focus: ['waldisk', 'repl'],
      particles: [{ from: 'waldisk', to: 'repl', color: C.wal, via: [{ x: 74.5, y: 38.75 }, { x: 74.5, y: 12 }] }],
    },
    {
      title: 'Ack — and the debt left behind',
      prose:
        'The client gets its COMMIT ack: total synchronous cost, <b>one sequential fsync</b>. The dirty heap and index pages stay in shared buffers until the <b>checkpointer</b> writes them out (spread over minutes, by design). Crash before then? Recovery replays the WAL from the last checkpoint and reconstructs every page. Corollary: the first change to each page after a checkpoint logs the <em>entire 8 KB page</em> into the WAL (torn-page protection) — which is why write volume spikes right after every checkpoint.',
      focus: ['shbuf', 'heap', 'app'],
      particles: [
        { from: 'shbuf', to: 'heap', color: C.buf },
        { from: 'exec', to: 'app', color: C.client, via: [{ x: 25, y: 25 }, { x: 25, y: 12.5 }] },
      ],
    },
  ],
}

export const mvccTrace: TraceSpec = {
  title: 'The life of a row — MVCC, HOT, and vacuum',
  aspect: 0.5,
  zones: [
    { label: 'Transactions', x: 2, y: 4, w: 21, h: 42 },
    { label: 'One heap page (8 KB)', x: 27, y: 4, w: 45, h: 42 },
    { label: 'Around the table', x: 76, y: 4, w: 22, h: 42 },
  ],
  nodes: [
    { id: 'wtx', x: 4.5, y: 9, w: 16, h: 8.5, label: 'Writer (xid 205)', sub: 'UPDATE users SET …', color: C.client },
    { id: 'rtx', x: 4.5, y: 27, w: 16, h: 8.5, label: 'Reader', sub: 'snapshot @ xid 190', color: C.client },
    { id: 'v1', x: 29.5, y: 8, w: 17, h: 9, label: 'Version 1', sub: 'xmin 100 · xmax 205', color: C.wal },
    { id: 'v2', x: 51, y: 8, w: 18, h: 9, label: 'Version 2', sub: 'xmin 205 · xmax ∅', color: C.wal },
    { id: 'lp', x: 29.5, y: 21, w: 17, h: 7.5, label: 'Line pointers', sub: 'what indexes point at', color: C.machine },
    { id: 'free', x: 51, y: 21, w: 18, h: 7.5, label: 'Free space', sub: 'fillfactor headroom', color: C.buf },
    { id: 'idx', x: 78, y: 8, w: 18, h: 8, label: 'B-tree index', sub: 'key → (page, slot)', color: C.machine },
    { id: 'av', x: 78, y: 21, w: 18, h: 8, label: 'Autovacuum', sub: 'workers, cost-limited', color: C.vac },
    { id: 'vm', x: 78, y: 34, w: 18, h: 8, label: 'VM + FSM', sub: 'all-visible map · free space', color: C.buf },
  ],
  steps: [
    {
      title: 'A row is born',
      prose:
        'Transaction 100 INSERTs the row: a tuple lands on a heap page stamped <code>xmin&nbsp;100</code> — “created by 100.” Whether any given transaction can <em>see</em> it is decided later, at read time, by comparing these stamps against the reader’s snapshot and the commit log (<code>pg_xact</code>). Visibility is not stored anywhere; it is <b>computed on every read</b>.',
      focus: ['wtx', 'v1'],
      particles: [{ from: 'wtx', to: 'v1', color: C.client }],
    },
    {
      title: 'A reader takes a snapshot',
      prose:
        'A reader starts and receives a <b>snapshot</b>: which transaction IDs were committed at that instant. From now on it sees the database exactly as of that moment — no read locks, no blocking, regardless of what writers do. This is the MVCC bargain: readers never block writers, writers never block readers; the currency it is paid in is old row versions.',
      focus: ['rtx', 'v1'],
      particles: [{ from: 'rtx', to: 'v1', color: C.client, via: [{ x: 25, y: 31.25 }, { x: 25, y: 12.5 }] }],
    },
    {
      title: 'UPDATE = insert a rival version',
      prose:
        'Transaction 205 updates the row. <b>Version 2</b> is inserted elsewhere on the page (<code>xmin 205</code>), Version 1 is stamped <code>xmax 205</code>, and — if an <em>indexed</em> column changed — every index on the table gets a new entry pointing at the new version. One logical UPDATE: a heap insert plus N index inserts. This is the write amplification Uber’s famous critique centered on.',
      focus: ['wtx', 'v2', 'idx'],
      particles: [
        { from: 'wtx', to: 'v2', color: C.vac, via: [{ x: 12.5, y: 2 }, { x: 60, y: 2 }] },
        { from: 'v2', to: 'idx', color: C.machine },
      ],
    },
    {
      title: 'Two truths at once',
      prose:
        'Both versions now live on the page. Our reader’s snapshot predates 205, so it still resolves to <b>Version 1</b>; any transaction starting now resolves to <b>Version 2</b>. Both are simply <em>correct answers to different questions</em> (“as of when?”). This is why a long <code>pg_dump</code> or analytics query runs happily against a busy OLTP database — and, as the next step shows, why it isn’t free.',
      focus: ['v1', 'v2', 'rtx'],
      particles: [{ from: 'rtx', to: 'v1', color: C.client, via: [{ x: 25, y: 31.25 }, { x: 25, y: 12.5 }] }],
    },
    {
      title: 'The dead pile up',
      prose:
        'Once no live snapshot can see Version 1, it is <b>dead</b> — pure waste, still occupying page space and index entries. Nothing reclaims it inline; deletes and updates only ever <em>add</em>. And the reclaim horizon is set by the <b>oldest snapshot in the system</b> (the “xmin horizon”): one forgotten <code>BEGIN</code> sitting idle pins dead versions <em>across the entire cluster</em>. Remember that — it is the root cause of the Chapter 6 cascade.',
      focus: ['v1', 'rtx'],
    },
    {
      title: 'HOT — the mercy optimization',
      prose:
        'If <b>no indexed column changed</b> and the page has room, Postgres performs a <b>Heap-Only Tuple</b> update: Version 2 goes on the <em>same page</em>, chained from Version 1, and the indexes are untouched — they still point at the original line pointer, and readers walk the chain. This is why tables are created with <code>fillfactor</code> headroom, and why “don’t index columns you update constantly” is a real design rule, not folklore.',
      focus: ['lp', 'v1', 'v2'],
      particles: [
        { from: 'lp', to: 'v1', color: C.machine },
        { from: 'v1', to: 'v2', color: C.wal },
      ],
    },
    {
      title: 'Autovacuum sweeps',
      prose:
        'Autovacuum workers wake when a table’s dead-tuple count crosses a threshold. A worker scans (cost-limited, so it doesn’t flatten your I/O), removes dead versions and their index entries, records the reclaimed room in the <b>free space map</b>, and marks fully-clean pages <em>all-visible</em> in the <b>visibility map</b> — which is what makes index-only scans possible. Note what it does not do: the file rarely shrinks. Space is recycled, not returned.',
      focus: ['av', 'v1', 'vm', 'free'],
      particles: [
        { from: 'av', to: 'v1', color: C.vac, via: [{ x: 74, y: 19 }, { x: 48.75, y: 19 }] },
        { from: 'av', to: 'vm', color: C.buf },
      ],
    },
    {
      title: 'The doomsday counter',
      prose:
        'Transaction IDs are <b>32-bit</b>, compared in a circle: to xid 3 billion, xid 100 looks like the <em>future</em>, so unfrozen old rows would suddenly vanish. Vacuum prevents this by <b>freezing</b> old tuples (marking them “visible to everyone, forever”). If freezing falls ~2 billion transactions behind, Postgres first warns, then <b>refuses new writes ~3 million short of wraparound</b> to protect your data. Every serious Postgres shop monitors <code>age(datfrozenxid)</code>. Chapter 6 shows the alert.',
      focus: ['av'],
      particles: [{ from: 'av', to: 'v2', color: C.vac }],
    },
  ],
}

/* ---- Chapter 7: a production fleet, walked end to end ---- */
export const fleetTrace: TraceSpec = {
  title: 'A production Postgres fleet — follow the WAL',
  aspect: 0.5,
  zones: [
    { label: 'App tier', x: 2, y: 4, w: 21, h: 42 },
    { label: 'One cluster — the write path', x: 27, y: 4, w: 45, h: 42 },
    { label: 'Beyond one cluster', x: 76, y: 4, w: 22, h: 42 },
  ],
  nodes: [
    { id: 'fleet', x: 4.5, y: 8, w: 16, h: 8, label: 'App fleet', sub: 'hundreds of pods', color: C.client },
    { id: 'pgb', x: 4.5, y: 23, w: 16, h: 8, label: 'PgBouncer tier', sub: 'transaction pooling', color: C.client },
    { id: 'primary', x: 29.5, y: 8, w: 17, h: 9, label: 'Primary', sub: 'all writes', color: C.wal },
    { id: 'sync', x: 51, y: 8, w: 18, h: 9, label: 'Sync standby', sub: 'acks every commit', color: C.wal },
    { id: 'async', x: 29.5, y: 23, w: 17, h: 9, label: 'Async replicas', sub: 'reads · ms behind', color: C.wal },
    { id: 'arch', x: 51, y: 23, w: 18, h: 9, label: 'WAL archive (S3)', sub: 'pgBackRest / WAL-G', color: C.buf },
    { id: 'pitr', x: 51, y: 36, w: 18, h: 7, label: 'PITR restore', sub: 'replay to any second', color: C.buf },
    { id: 'router', x: 78, y: 8, w: 18, h: 8, label: 'Shard router', sub: 'hash(team_id)', color: C.machine },
    { id: 's1', x: 78, y: 21, w: 18, h: 7, label: 'Shard 1', sub: 'full primary + replicas', color: C.wal },
    { id: 's2', x: 78, y: 31.5, w: 18, h: 7, label: 'Shard N', sub: 'independent blast radius', color: C.wal },
  ],
  steps: [
    {
      title: 'Fan-in through the pooler',
      prose:
        'Hundreds of app instances × per-pod pools = thousands of client connections — pointed not at Postgres but at a <b>PgBouncer tier</b>, which multiplexes them onto a few dozen real backends per database. This is the first thing every production Postgres story has in common: nobody at scale connects apps straight to the primary.',
      focus: ['fleet', 'pgb'],
      particles: [{ from: 'fleet', to: 'pgb', color: C.client, count: 3 }],
    },
    {
      title: 'Every write funnels to one box',
      prose:
        'All writes from the entire fleet land on <b>one primary</b>. That sounds fragile, and it is the point: one machine assigning one WAL order is what makes transactions cheap. The whole fleet design exists to protect this box — pooling in front of it, replicas beside it, archives behind it.',
      focus: ['pgb', 'primary'],
      particles: [{ from: 'pgb', to: 'primary', color: C.wal, via: [{ x: 25, y: 27 }, { x: 25, y: 12.5 }] }],
    },
    {
      title: 'The sync standby',
      prose:
        'A synchronous standby (typically in another availability zone) must ack the WAL before COMMIT returns. Cost: one network RTT on every write. Purchase: <b>failover loses zero committed transactions</b>. Most shops run exactly one sync standby plus async replicas — paying the RTT once, not N times.',
      focus: ['primary', 'sync'],
      particles: [{ from: 'primary', to: 'sync', color: C.wal }],
    },
    {
      title: 'Async replicas absorb the reads',
      prose:
        'Read-only traffic — dashboards, feeds, search indexing — routes to <b>async replicas</b> replaying the WAL milliseconds behind. The app must be lag-literate: a user who just wrote must read the primary (or a caught-up replica) or they’ll watch their own comment vanish. Replica count scales reads nearly linearly; it does nothing for writes.',
      focus: ['pgb', 'async'],
      particles: [{ from: 'pgb', to: 'async', color: C.client, count: 2 }],
    },
    {
      title: 'The WAL goes to object storage too',
      prose:
        'Every WAL segment is continuously shipped to <b>object storage</b> alongside periodic base backups (pgBackRest, WAL-G). Backups here aren’t nightly dumps — they are <em>the log itself</em>, which is what makes the next step possible. Archive lag is a paged metric: a backup you can’t restore from is a rumor.',
      focus: ['primary', 'arch'],
      particles: [{ from: 'primary', to: 'arch', color: C.buf }],
    },
    {
      title: 'Point-in-time recovery',
      prose:
        '“Restore to 14:03:59, right before the bad migration” — take the last base backup, replay archived WAL up to any chosen second. PITR is the difference between an incident and a catastrophe when the failure is <em>logical</em> (bad deploy, fat-fingered DELETE) and replicas have faithfully replicated the damage everywhere.',
      focus: ['arch', 'pitr'],
      particles: [{ from: 'arch', to: 'pitr', color: C.buf }],
    },
    {
      title: 'Failover — the drill you rehearse',
      prose:
        'Primary dies: orchestration (Patroni et al.) promotes the sync standby — guaranteed to have every committed byte — and repoints the PgBouncer tier. Writes pause for seconds. The dangerous parts are human: split-brain (two primaries taking writes) is why fencing and consensus-backed leader election exist. You drill this quarterly, or you discover it doesn’t work during the real one.',
      focus: ['sync', 'pgb'],
      particles: [{ from: 'pgb', to: 'sync', color: C.vac, via: [{ x: 25, y: 20 }, { x: 25, y: 2 }, { x: 60, y: 2 }] }],
    },
    {
      title: 'When the ladder ends: shard',
      prose:
        'When one primary’s write throughput is truly exhausted, the fleet multiplies: data is split by a <b>shard key</b> (Notion: <code>team_id</code> — everything for one workspace lives together) across many full clusters, each with its own primary, replicas, and failover. Cross-shard joins and transactions are gone; the app-level router is the new source of truth. It works — and it is the least reversible decision on this page.',
      focus: ['fleet', 'router', 's1', 's2'],
      particles: [
        { from: 'fleet', to: 'router', color: C.client, via: [{ x: 12.5, y: 2 }, { x: 87, y: 2 }] },
        { from: 'router', to: 's1', color: C.machine },
        { from: 'router', to: 's2', color: C.machine, via: [{ x: 74.5, y: 16 }, { x: 74.5, y: 35 }] },
      ],
    },
  ],
}
