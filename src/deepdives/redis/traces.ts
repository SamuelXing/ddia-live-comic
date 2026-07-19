import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* Colors: client blue, event-loop machinery amber, data-in-RAM green,
   persistence & replication violet, danger (COW spike, blocked loop) red. */
const C = {
  client: VIZ.blue,
  machine: VIZ.amber,
  ram: VIZ.green,
  persist: VIZ.violet,
  danger: VIZ.red,
}

export const eventLoopTrace: TraceSpec = {
  title: 'Trace a command through the event loop',
  aspect: 0.5,
  zones: [
    { label: 'Clients', x: 2, y: 4, w: 21, h: 42 },
    { label: 'One process, one thread', x: 27, y: 4, w: 45, h: 42 },
    { label: 'Data in RAM', x: 76, y: 4, w: 22, h: 42 },
  ],
  nodes: [
    { id: 'app', x: 4.5, y: 9, w: 16, h: 7, label: 'Your app', sub: 'ZADD leaderboard …', color: C.client },
    { id: 'others', x: 4.5, y: 21, w: 16, h: 8, label: '10,000 others', sub: 'one socket each', color: C.client },
    { id: 'loop', x: 29.5, y: 8, w: 17, h: 8, label: 'Event loop', sub: 'epoll, one thread', color: C.machine },
    { id: 'io', x: 51, y: 8, w: 18, h: 8, label: 'I/O threads', sub: 'read + parse (6.0+)', color: C.machine },
    { id: 'cmd', x: 29.5, y: 21, w: 17, h: 8, label: 'Command dispatch', sub: 'table, ACL, arity', color: C.machine },
    { id: 'aofbuf', x: 29.5, y: 35, w: 17, h: 7.5, label: 'AOF + replica buffers', sub: 'fed asynchronously', color: C.persist },
    { id: 'outbuf', x: 51, y: 35, w: 18, h: 7.5, label: 'Output buffers', sub: 'per-client replies', color: C.machine },
    { id: 'ds', x: 78, y: 8, w: 18, h: 8.5, label: 'Value: sorted set', sub: 'skiplist + listpack', color: C.ram },
    { id: 'dict', x: 78, y: 21, w: 18, h: 8.5, label: 'Keyspace dict', sub: 'hash table, O(1)', color: C.ram },
    { id: 'exp', x: 78, y: 34, w: 18, h: 7.5, label: 'Expires dict', sub: 'lazy + active cycle', color: C.ram },
  ],
  steps: [
    {
      title: 'Ten thousand sockets, one thread',
      prose:
        'There is no thread pool and no thread-per-connection. A single thread sits in an <b>epoll loop</b> over every client socket — ten connections or ten thousand cost roughly the same. This is the first half of Redis&apos;s bet: if every operation is a few microseconds of memory work, <em>one thread is enough</em>, and everything a thread pool exists to solve (locks, contention, context switches) simply never happens.',
      focus: ['app', 'others', 'loop'],
      particles: [
        { from: 'app', to: 'loop', color: C.client },
        { from: 'others', to: 'loop', color: C.client, count: 3 },
      ],
    },
    {
      title: 'Read and parse — the only parallel part',
      prose:
        'Since Redis 6, optional <b>I/O threads</b> take over the mechanical work: reading bytes off sockets, parsing the RESP protocol, and later writing replies back. It&apos;s a real win at high connection counts — but note the boundary: I/O threads move <em>bytes</em>. <b>Command execution never leaves the main thread.</b> The one-core ceiling in Chapter 3 survives this feature intact.',
      focus: ['loop', 'io'],
      particles: [{ from: 'loop', to: 'io', color: C.machine }],
    },
    {
      title: 'Dispatch — atomic by construction',
      prose:
        'The parsed command is looked up in the command table (arity check, ACLs) and <b>runs to completion</b> before the loop touches anything else. That single sentence is Redis&apos;s whole concurrency story: every <code>INCR</code>, every <code>ZADD</code>, every Lua script is atomic — not because of locks, but because <em>nothing else is running</em>.',
      focus: ['io', 'cmd'],
      particles: [{ from: 'io', to: 'cmd', color: C.machine }],
    },
    {
      title: 'O(1) into the keyspace',
      prose:
        'The key hashes into the <b>global dict</b> — a plain hash table mapping key → value object. When it needs to grow, Redis doesn&apos;t stop to rehash: it keeps <em>two</em> tables and migrates one bucket per operation (<b>incremental rehashing</b>), amortizing the pause the same way everything here avoids doing big work on the one thread.',
      focus: ['cmd', 'dict'],
      particles: [{ from: 'cmd', to: 'dict', color: C.ram }],
    },
    {
      title: 'The data structure does the work',
      prose:
        'The value isn&apos;t a blob — it&apos;s a live structure: our sorted set is a <b>skiplist + hash</b> (O(log N) ranked ops), unless it&apos;s small enough to be a <b>listpack</b> — a flat byte array that trades big-O for cache locality and ~10× less memory. Every type has such a dual encoding, and the silent flip between them is a famous memory cliff (Chapter 8). Expiry, incidentally, is an illusion: expired keys die <em>lazily on access</em> plus by background sampling.',
      focus: ['dict', 'ds', 'exp'],
      particles: [{ from: 'dict', to: 'ds', color: C.ram }],
    },
    {
      title: 'Everyone waits',
      prose:
        'Here is the constraint that defines Redis operations: while a command runs, <b>all ten thousand clients wait</b>. For a 5 µs GET, irrelevant. For <code>SMEMBERS</code> on an 8-million-member set — or <code>KEYS *</code> — the instance is frozen for seconds, timeouts fire, and Chapter 6&apos;s cascade begins. O(N) isn&apos;t a performance detail here; it&apos;s an availability decision.',
      focus: ['others', 'cmd'],
      particles: [{ from: 'others', to: 'loop', color: C.danger, count: 3 }],
    },
    {
      title: "The write's side-car",
      prose:
        'For a write, the reply does <b>not</b> wait for disk or replicas. The command is appended to the <b>AOF buffer</b> and each <b>replica&apos;s output buffer</b>, both drained asynchronously by the same loop. Durability is a background aspiration — the full story (and its fine print) is the next trace.',
      focus: ['cmd', 'aofbuf'],
      particles: [{ from: 'cmd', to: 'aofbuf', color: C.persist }],
    },
    {
      title: 'Reply in microseconds',
      prose:
        'The reply lands in the client&apos;s output buffer and the loop (or an I/O thread) writes it back. Total cost: hash lookup, structure op, two socket calls — <b>no disk, no locks, no other cores consulted</b>. Kafka&apos;s hot path was a page-cache append; Postgres&apos;s was a WAL fsync; Redis&apos;s is <em>nothing but RAM</em>. That is the entire speed story — and everything in Chapter 3 is its bill.',
      focus: ['outbuf', 'app'],
      particles: [
        { from: 'cmd', to: 'outbuf', color: C.machine },
        { from: 'outbuf', to: 'app', color: C.client, via: [{ x: 60.5, y: 46.5 }, { x: 25, y: 46.5 }, { x: 25, y: 12.5 }] },
      ],
    },
  ],
}

export const persistTrace: TraceSpec = {
  title: 'Persistence — fork, copy-on-write, and the spike',
  aspect: 0.5,
  zones: [
    { label: 'Write traffic', x: 2, y: 4, w: 21, h: 42 },
    { label: 'Parent — the live master', x: 27, y: 4, w: 45, h: 42 },
    { label: 'Child + disk', x: 76, y: 4, w: 22, h: 42 },
  ],
  nodes: [
    { id: 'wr', x: 4.5, y: 9, w: 16, h: 8, label: 'Writers', sub: 'SET, ZADD, EXPIRE …', color: C.client },
    { id: 'mem', x: 29.5, y: 8, w: 17, h: 9, label: 'Dataset in RAM', sub: 'pages shared after fork', color: C.ram },
    { id: 'aofb', x: 51, y: 8, w: 18, h: 8, label: 'AOF buffer', sub: 'appendfsync everysec', color: C.persist },
    { id: 'cow', x: 29.5, y: 22, w: 17, h: 9, label: 'COW page copies', sub: 'touched pages duplicate', color: C.danger },
    { id: 'spike', x: 51, y: 22, w: 18, h: 9, label: 'Memory spike', sub: 'worst case ≈ 2×', color: C.danger },
    { id: 'child', x: 78, y: 8, w: 18, h: 9, label: 'BGSAVE child', sub: 'frozen point-in-time view', color: C.persist },
    { id: 'rdb', x: 78, y: 22, w: 18, h: 8, label: 'dump.rdb', sub: 'compact snapshot', color: C.ram },
    { id: 'aof', x: 78, y: 35, w: 18, h: 7.5, label: 'appendonly.aof', sub: 'command log on disk', color: C.persist },
  ],
  steps: [
    {
      title: 'The write is “done” in RAM',
      prose:
        'A write mutates the in-memory structure and the client gets its reply — <b>before anything touches disk</b>. Compare the neighbors: Postgres won&apos;t ack until the WAL is fsync&apos;d; Kafka won&apos;t ack (acks=all) until replicas have the bytes. Redis acks on a memory write. Everything else in this trace is an <em>after-the-fact</em> attempt to make that less scary.',
      focus: ['wr', 'mem'],
      particles: [{ from: 'wr', to: 'mem', color: C.client }],
    },
    {
      title: 'AOF — a WAL, but softer',
      prose:
        'Every write is also appended, as literal protocol text, to the <b>AOF buffer</b>, flushed to the append-only file with <code>appendfsync everysec</code> by default: an fsync per <em>second</em>, not per commit. Crash at the wrong moment and <b>up to a second of acked writes evaporate</b>. (<code>always</code> exists — and turns Redis into a slow database; <code>no</code> leaves it to the OS.) The dial goes from fast to safe; it does not reach both.',
      focus: ['wr', 'aofb', 'aof'],
      particles: [
        { from: 'wr', to: 'aofb', color: C.persist, via: [{ x: 12.5, y: 2 }, { x: 60, y: 2 }] },
        { from: 'aofb', to: 'aof', color: C.persist, via: [{ x: 74.5, y: 12 }, { x: 74.5, y: 38.75 }] },
      ],
    },
    {
      title: 'Snapshot = fork()',
      prose:
        'For an RDB snapshot, Redis calls <b>fork()</b>. The child inherits the entire dataset via shared, read-only pages — a <em>free</em> point-in-time view, courtesy of the kernel. Almost free: fork must copy the page tables, which stalls the loop for <b>roughly 10–20 ms per GB</b> of resident memory on virtualized hosts. A 100 GB instance visibly hiccups every time it snapshots — one reason Chapter 4 argues against giant instances.',
      focus: ['mem', 'child'],
      particles: [{ from: 'mem', to: 'child', color: C.persist, via: [{ x: 38, y: 2 }, { x: 87, y: 2 }] }],
    },
    {
      title: 'Copy-on-write',
      prose:
        'The parent keeps serving writes. Each page it touches while the child reads triggers the kernel to <b>duplicate that page</b> — the child keeps the frozen version, the parent gets a private copy. Elegant, invisible, and <em>metered in RAM</em>: the memory cost of a snapshot is proportional to how much you write while it runs.',
      focus: ['wr', 'cow'],
      particles: [{ from: 'wr', to: 'cow', color: C.danger }],
    },
    {
      title: 'The spike',
      prose:
        'Write-heavy workload + long snapshot = many copied pages: resident memory can approach <b>2× the dataset</b>. If <code>maxmemory</code> was set at 80% of the box, the OOM killer arrives — and it kills the <em>master</em>, mid-snapshot. This is why the Chapter 3 envelope charges copy-on-write headroom against RAM, and why “the fork OOM” has its own card in Chapter 8.',
      focus: ['cow', 'spike'],
      particles: [{ from: 'cow', to: 'spike', color: C.danger }],
    },
    {
      title: 'The child streams the snapshot',
      prose:
        'The child serializes its frozen view into a compact <b>dump.rdb</b>, atomically replaces the old file, and exits — the parent never blocked (except for the fork itself). RDB is also the transport for <b>replica full syncs</b>: a new replica triggers exactly this dance, which is why a herd of resyncing replicas is a Chapter 8 failure mode.',
      focus: ['child', 'rdb'],
      particles: [{ from: 'child', to: 'rdb', color: C.ram }],
    },
    {
      title: 'AOF rewrite — the same trick',
      prose:
        'The AOF grows forever, so Redis periodically <b>rewrites</b> it compactly — by forking again and having the child emit the current dataset while the parent accumulates the delta (since 7.0, as a <em>multi-part</em> AOF: an RDB-format base plus incremental files). One mechanism — fork + COW — underlies every durability feature Redis has.',
      focus: ['aofb', 'child'],
      particles: [{ from: 'mem', to: 'child', color: C.persist, via: [{ x: 38, y: 2 }, { x: 87, y: 2 }] }],
    },
    {
      title: 'What durability really is here',
      prose:
        'Add it up: <b>everysec</b> AOF, async replication, snapshot points. Acked writes <em>can</em> be lost — on a crash (≤1 s), on a failover (replica behind), on both at once. Redis durability is a <b>probability dial, not a guarantee</b>, and that is a legitimate design point: it&apos;s what you traded for microseconds. The operational rule: data you cannot re-derive belongs in Postgres, with Redis in front — not the other way around.',
      focus: ['mem', 'rdb', 'aof'],
    },
  ],
}

/* ---- Chapter 7: Redis Cluster, walked end to end ---- */
export const clusterTrace: TraceSpec = {
  title: 'Redis Cluster — slots, gossip, and live resharding',
  aspect: 0.5,
  zones: [
    { label: 'Client side', x: 2, y: 4, w: 21, h: 42 },
    { label: 'Shards A & B', x: 27, y: 4, w: 45, h: 42 },
    { label: 'Rest of cluster', x: 76, y: 4, w: 22, h: 42 },
  ],
  nodes: [
    { id: 'cl', x: 4.5, y: 8, w: 16, h: 8, label: 'Cluster-aware client', sub: 'CRC16(key) mod 16384', color: C.client },
    { id: 'smap', x: 4.5, y: 23, w: 16, h: 8, label: 'Cached slot map', sub: 'refreshed on MOVED', color: C.client },
    { id: 'pa', x: 29.5, y: 8, w: 17, h: 9, label: 'Shard A primary', sub: 'slots 0–5460', color: C.ram },
    { id: 'ra', x: 29.5, y: 22, w: 17, h: 8, label: 'Replica of A', sub: 'async, promotable', color: C.persist },
    { id: 'pb', x: 51, y: 8, w: 18, h: 9, label: 'Shard B primary', sub: 'slots 5461–10922', color: C.ram },
    { id: 'mig', x: 51, y: 22, w: 18, h: 8, label: 'Slot 7311: B → C', sub: 'MIGRATE + ASK', color: C.machine },
    { id: 'pc', x: 78, y: 22, w: 18, h: 8, label: 'Shard C primary', sub: 'slots 10923–16383', color: C.ram },
    { id: 'bus', x: 78, y: 8, w: 18, h: 9, label: 'Cluster bus', sub: 'gossip, PFAIL → FAIL', color: C.machine },
    { id: 'ep', x: 78, y: 35, w: 18, h: 7.5, label: 'Config epochs', sub: 'versioned slot ownership', color: C.machine },
  ],
  steps: [
    {
      title: 'No router — the client does the math',
      prose:
        'Redis Cluster has no proxy and no coordinator on the data path. The client itself computes <code>CRC16(key) mod 16384</code> to find the key&apos;s <b>hash slot</b>. Need two keys in one command or transaction? They must share a slot — which you arrange with <b>hash tags</b>: <code>{user:42}:profile</code> and <code>{user:42}:sessions</code> hash only the braced part. Data modeling <em>is</em> the routing layer.',
      focus: ['cl'],
    },
    {
      title: 'The slot map',
      prose:
        'The client caches a <b>slot → node map</b> (from <code>CLUSTER SHARDS</code>). If the map is stale, the wrong node answers <code>MOVED 7311 10.0.0.9:6379</code> — the client refreshes and retries. Worst case is one extra network hop; steady state is <b>zero</b> added latency versus a single instance. This is how Cluster keeps the microseconds.',
      focus: ['cl', 'smap'],
      particles: [{ from: 'cl', to: 'smap', color: C.client }],
    },
    {
      title: 'Straight to the owner',
      prose:
        'The command goes directly to the primary that owns the slot and runs on <em>that instance&apos;s</em> one thread, exactly as in Chapter 2. The cluster is not a big Redis — it is <b>many small, completely independent Redises</b> plus an agreement about who owns which slots.',
      focus: ['cl', 'pa'],
      particles: [{ from: 'cl', to: 'pa', color: C.client }],
    },
    {
      title: 'A shard is a little replica set',
      prose:
        'Each primary streams its writes to one or more <b>replicas</b> — asynchronously, the Chapter 2 durability note now at shard scale. Replicas serve reads if you ask (<code>READONLY</code> mode, stale by design) and exist mainly as <b>warm spares</b> for failover.',
      focus: ['pa', 'ra'],
      particles: [{ from: 'pa', to: 'ra', color: C.persist }],
    },
    {
      title: 'Gossip and the verdict',
      prose:
        'Every node pings random peers over the <b>cluster bus</b>, piggybacking what it knows about everyone else. Miss your pings and a peer marks you <b>PFAIL</b> — a private suspicion, promoted to <b>FAIL</b> only when a majority of primaries agree. No ZooKeeper, no KRaft, no Patroni: the cluster is its own control plane. (The cost of that self-reliance shows up in Chapter 6.)',
      focus: ['pa', 'bus'],
      particles: [{ from: 'pa', to: 'bus', color: C.machine, via: [{ x: 38, y: 2 }, { x: 87, y: 2 }] }],
    },
    {
      title: 'Failover',
      prose:
        'On FAIL, shard A&apos;s replicas hold an election (ranked by replication offset — the least-stale wins majority approval from the primaries), and the winner promotes itself with a bumped <b>config epoch</b>. Writes that hadn&apos;t replicated are gone — async replication keeps its promises. Failover in seconds, minus a few of the newest writes: the Redis trade, again.',
      focus: ['bus', 'ra'],
      particles: [{ from: 'bus', to: 'ra', color: C.danger, via: [{ x: 74.5, y: 18.5 }, { x: 48.75, y: 18.5 }] }],
    },
    {
      title: 'Resharding is routine',
      prose:
        'Slots move while the cluster serves traffic: slot 7311&apos;s keys are <code>MIGRATE</code>d one by one from B to C; mid-move, B answers with <code>ASK</code> redirects for keys already gone. When the slot empties, ownership flips (epoch++), clients update their maps, and nobody noticed. Compare Kafka&apos;s partition rebalancing or Postgres&apos;s schema-moving re-shard — this is the smoothest live rebalancing of the three.',
      focus: ['pb', 'mig', 'pc'],
      particles: [
        { from: 'pb', to: 'mig', color: C.machine },
        { from: 'mig', to: 'pc', color: C.machine },
      ],
    },
    {
      title: 'The ceiling, and the shape of big',
      prose:
        'Epochs resolve ownership disputes; gossip volume grows with node count; the documented practical ceiling is <b>~1,000 nodes</b>. No cross-slot transactions, ever. So large fleets look like Kafka&apos;s: <b>many bounded clusters</b>, one per use-case (cache, sessions, queues, counters) — because a cache and a store shouldn&apos;t share a failure domain, or an eviction policy.',
      focus: ['ep', 'bus'],
      particles: [{ from: 'bus', to: 'ep', color: C.machine, via: [{ x: 74.5, y: 12.5 }, { x: 74.5, y: 38.75 }] }],
    },
  ],
}
