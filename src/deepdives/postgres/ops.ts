import type { TraceSpec } from '../../components/TracePlayer'
import type { MetricCard } from '../../components/MetricRunbook'
import { VIZ } from '../../styles/viz'

/* ============================================================
   Postgres in production — the metrics you actually watch, what
   a spike means, what breaks, and what you do about it.
   The "3am pager" view, not the happy path.
   ============================================================ */

export const METRICS: MetricCard[] = [
  {
    metric: 'Replication lag',
    jmx: 'pg_stat_replication → replay_lag',
    severity: 'page',
    healthy: 'Milliseconds on a healthy LAN; a flat line with occasional bumps that drain immediately.',
    means: 'Replicas are replaying WAL slower than the primary is producing it. Every read routed to a replica is serving an increasingly old version of reality.',
    breaks:
      'Read-your-writes bugs surface (users “lose” their own updates). If the primary dies while an <b>async</b> replica lags, failover <b>loses the lagging transactions</b>. And if a lagging replica holds a slot or feedback, it drags the primary down with it (see WAL disk).',
    causes: [
      'A big transaction or bulk load — one huge WAL burst the replica chews through',
      'Replica I/O or CPU saturated (often: analytics queries competing with replay)',
      'Query conflicts — replay waits behind long replica queries, or cancels them',
      'Network throughput between primary and replica',
      'Vacuum or index build on the primary generating a WAL flood',
    ],
    respond: [
      'Check which lag it is: sent vs write vs replay (network problem vs replica-side problem)',
      'Look for long queries on the replica fighting replay (hot_standby_feedback and max_standby_streaming_delay are the tuning levers — both are trade-offs, not fixes)',
      'Correlate with WAL volume on the primary — a batch job may be the real culprit',
      'If lag is chronic, the replica is under-provisioned for the read + replay load: bigger box or more replicas',
    ],
    tie: 'Replicas replay the WAL from the Chapter 2 trace — lag is that replay falling behind.',
  },
  {
    metric: 'Connection saturation',
    jmx: 'pg_stat_activity vs max_connections',
    severity: 'page',
    healthy: 'Well under max_connections, mostly active or idle — near zero “idle in transaction”.',
    means: 'The connection budget is being eaten. Each connection is an OS process; hundreds of active ones saturate CPU and memory long before max_connections is hit.',
    breaks:
      'At the wall, new connections are refused — <b>every service that needs the database starts erroring at once</b>. Approaching it, the primary wastes itself on context switching and per-backend memory, so everything slows first.',
    causes: [
      'No pooler, or pool sizes multiplied by a scaled-out app fleet',
      'Slow queries holding connections longer, so the fleet opens more (the Chapter 6 cascade)',
      'Restart stampede — every pod reconnecting simultaneously',
      '“Idle in transaction” backends leaking from an ORM or crashed worker',
    ],
    respond: [
      'PgBouncer in transaction mode if you don’t have it — this is the fix, everything else is triage',
      'Set idle_in_transaction_session_timeout and statement_timeout — leaks then self-heal',
      'pg_terminate_backend the worst offenders to relieve pressure now',
      'Cap total app-side pool size to what the primary actually handles (~2–4× cores active)',
    ],
    tie: 'One process per connection — step 1 of the Chapter 2 trace — is why this number is so unforgiving.',
  },
  {
    metric: 'Transaction ID age',
    jmx: 'age(datfrozenxid)',
    severity: 'page',
    healthy: 'Cycling well below 200M (the default autovacuum_freeze_max_age). Steady sawtooth, never trending up.',
    means: 'How far the oldest unfrozen data is from the 32-bit transaction-ID wraparound. This is the doomsday counter from the MVCC trace, and it only moves one direction until vacuum freezes.',
    breaks:
      'Ignore it long enough and Postgres <b>stops accepting writes ~3M transactions before wraparound</b> to protect your data — a full outage that can take <em>hours</em> of forced vacuuming to exit. Nothing else on this page fails harder.',
    causes: [
      'Autovacuum starved on one huge table (cost limits, too few workers)',
      'A long-lived transaction, prepared transaction, or stale replication slot pinning the horizon',
      'Aggressive manual-vacuum cancellations (each cancel resets progress)',
      'A table so hot that vacuum never finishes a pass',
    ],
    respond: [
      'Find the pin first: oldest xact in pg_stat_activity, pg_prepared_xacts, pg_replication_slots',
      'VACUUM FREEZE the tables with the oldest relfrozenxid — target the worst, not everything',
      'Raise autovacuum_vacuum_cost_limit / workers so this stops recurring',
      'Alert at 500M–1B age — you want weeks of runway, not hours',
    ],
    tie: 'The 32-bit wheel from the last step of the MVCC trace, observed live.',
  },
  {
    metric: 'WAL disk & replication slots',
    jmx: 'pg_replication_slots → restart_lsn / pg_wal size',
    severity: 'page',
    healthy: 'pg_wal cycling around max_wal_size; every slot’s restart_lsn advancing.',
    means: 'WAL segments are being retained instead of recycled — almost always because a replication slot’s consumer (dead replica, abandoned CDC pipeline) stopped reading.',
    breaks:
      'The WAL volume fills. A full pg_wal takes the primary down <b>hard</b> — PANIC, not graceful degradation. A forgotten Debezium connector can outage a database it hasn’t talked to in weeks. This is one of the most common self-inflicted Postgres outages.',
    causes: [
      'Orphaned replication slot after a replica or CDC consumer was decommissioned',
      'A lagging consumer that reads slower than WAL is produced',
      'archive_command failing — segments can’t be recycled until archived',
      'max_wal_size simply undersized for a bursty write workload',
    ],
    respond: [
      'List slots, drop any whose consumer no longer exists (pg_drop_replication_slot)',
      'Check the archiver (pg_stat_archiver failures) — fix the destination, don’t disable archiving',
      'Set max_slot_wal_keep_size so one bad slot can never fill the disk again',
      'Add space before it’s an emergency — this metric gives you days of warning if you watch it',
    ],
  },
  {
    metric: 'Longest transaction / xmin horizon',
    jmx: 'pg_stat_activity → xact_start, state',
    severity: 'page',
    healthy: 'Oldest open transaction measured in seconds; zero long-lived “idle in transaction”.',
    means: 'Someone is holding a transaction open. The whole cluster’s garbage collection horizon — what vacuum may clean — is pinned at that transaction’s snapshot.',
    breaks:
      'One forgotten <code>BEGIN</code> silently disables vacuuming <b>everywhere</b>: bloat grows, cache efficiency falls, XID age climbs. It also blocks DDL (a pending ALTER waits behind it, and everything queues behind the ALTER). The full cascade is animated above.',
    causes: [
      'An ORM or worker that opened a transaction and crashed / went idle',
      'A human in psql who typed BEGIN and went to lunch',
      'Legitimate long analytics or pg_dump against the primary instead of a replica',
      'Two-phase commit leftovers (prepared transactions nobody resolved)',
    ],
    respond: [
      'Watch: SELECT max(now() - xact_start) FROM pg_stat_activity — alert at minutes, not hours',
      'idle_in_transaction_session_timeout ends the “went to lunch” class permanently',
      'Move long analytics to a replica (with hot_standby_feedback consciously chosen)',
      'pg_terminate_backend the offender — vacuum resumes instantly',
    ],
    tie: 'This is the root cause of the cascade animation above — the cheapest page on this list to act on.',
  },
  {
    metric: 'Dead tuples & autovacuum recency',
    jmx: 'pg_stat_user_tables → n_dead_tup, last_autovacuum',
    severity: 'watch',
    healthy: 'Dead tuples sawtoothing down after each vacuum; last_autovacuum recent on every hot table.',
    means: 'The MVCC debt ledger: how many superseded row versions await collection, and whether the collector is actually visiting.',
    breaks:
      'Tables and indexes bloat — the same logical data spread over ever more pages, so scans read more, the cache holds less, and p99 quietly degrades over weeks. Recovering severely bloated tables needs VACUUM FULL or pg_repack: an exclusive-lock rewrite, i.e. planned downtime.',
    causes: [
      'Autovacuum thresholds too coarse for huge tables (0.2 × 500M rows = a lot of debt)',
      'Cost limiting making vacuum crawl on exactly the tables that need it most',
      'The xmin horizon pinned (see longest transaction) — vacuum runs but frees nothing',
      'Update-heavy workloads without fillfactor headroom for HOT',
    ],
    respond: [
      'Per-table autovacuum settings on the hot tables (scale_factor → 0.01, higher cost limit)',
      'Check HOT ratio (n_tup_hot_upd / n_tup_upd) — low HOT on an update-heavy table means an index you should drop or a fillfactor to lower',
      'Track bloat trend with pgstattuple; schedule pg_repack before it’s an emergency',
    ],
    tie: 'The “dead pile up” step of the MVCC trace, as a queryable number.',
  },
  {
    metric: 'Cache hit ratio',
    jmx: 'pg_stat_database → blks_hit / (blks_hit + blks_read)',
    severity: 'watch',
    healthy: '99%+ for OLTP. The interesting signal is a downward trend, not the absolute number.',
    means: 'The share of page requests served from shared buffers. (A “miss” may still hit the OS page cache — this is an upper bound on real disk reads, so read it as a trend.)',
    breaks:
      'When the working set outgrows memory, every miss is a random disk read and throughput falls off a cliff rather than degrading gracefully — the knee in the Chapter 3 envelope. Falling hit ratio is your earliest warning that data growth is outrunning RAM.',
    causes: [
      'Working set growth — the product got popular, the hot data no longer fits',
      'Bloat inflating the working set (same rows, more pages)',
      'A seq-scanning query or logical backup churning the cache',
      'shared_buffers mis-sized (far from ~25% of RAM in either direction)',
    ],
    respond: [
      'Distinguish growth from bloat first (pgstattuple) — bloat is fixable without hardware',
      'Find the churner: pg_stat_statements ordered by shared_blks_read',
      'Add RAM or archive cold data — cheaper than the sharding conversation',
    ],
    tie: 'The working-set-vs-RAM meter from Chapter 3, observed live.',
  },
  {
    metric: 'Checkpoint cadence',
    jmx: 'pg_stat_checkpointer → requested vs timed',
    severity: 'watch',
    healthy: 'Nearly all checkpoints “timed” (the scheduled kind), arriving at checkpoint_timeout intervals.',
    means: '“Requested” checkpoints fire because WAL filled max_wal_size early — the database is checkpointing as fast as it can, not on schedule.',
    breaks:
      'Each checkpoint re-enables full-page writes, so checkpoint-storming multiplies WAL volume (every touched page logged whole again), which fills WAL faster, which forces the next checkpoint sooner — a positive feedback loop that shows up as a <b>sawtooth in write latency</b>.',
    causes: [
      'max_wal_size undersized for the write rate',
      'Bulk loads / migrations generating WAL far above steady state',
      'checkpoint_completion_target too low, bunching the flush into bursts',
    ],
    respond: [
      'Raise max_wal_size until checkpoints are timed again (disk space is the only cost)',
      'checkpoint_completion_target ≈ 0.9 to spread the flush across the interval',
      'Correlate p99 spikes with checkpoint timestamps to prove or clear this cause in minutes',
    ],
    tie: 'Full-page writes are the checkpoint tax explained in the last step of the query trace.',
  },
  {
    metric: 'Query latency p99',
    jmx: 'pg_stat_statements → mean/max_exec_time',
    severity: 'watch',
    healthy: 'Stable per query shape. Watch p99 per statement, not a global average — the average hides everything.',
    means: 'The user-facing symptom every other metric on this list eventually becomes. Its value is in the decomposition: which statement, and what is it waiting on?',
    breaks:
      'Slow queries hold connections and locks longer, which pushes connection counts and lock queues up — latency is the metric that <em>recruits</em> the others. A single plan flip on a hot query can take the whole application down.',
    causes: [
      'Plan flip — stale statistics tipped a hot query from index scan to seq scan',
      'Lock waits behind DDL or a long transaction',
      'Checkpoint or vacuum I/O competing with foreground reads',
      'Cache misses from working-set growth or bloat',
    ],
    respond: [
      'pg_stat_statements: rank by total_exec_time, diff against last week',
      'auto_explain on the slow ones — see the actual plan that ran, not the one you assume',
      'ANALYZE the table on a suspected plan flip — often a one-command fix',
      'Check pg_locks / wait events before blaming hardware',
    ],
    tie: 'Every failure mode in Chapter 8 eventually surfaces here — which is why paging on p99 alone tells you something hurts, not what.',
  },
]

/* ---- the cascade: one forgotten transaction becomes an outage ---- */
const RED = VIZ.red
const AMBER = VIZ.amber
const VIO = VIZ.violet

export const cascadeTrace: TraceSpec = {
  title: 'Metric cascade — one forgotten transaction becomes an outage',
  aspect: 0.5,
  zones: [
    { label: 'Root cause', x: 2, y: 14, w: 19, h: 20 },
    { label: 'This database', x: 23, y: 4, w: 41, h: 40 },
    { label: 'User-facing', x: 66, y: 4, w: 32, h: 40 },
  ],
  nodes: [
    { id: 'idle', x: 3.5, y: 19, w: 16, h: 10, label: 'Idle in transaction', sub: 'BEGIN; …gone to lunch', color: RED },
    { id: 'horizon', x: 25, y: 19, w: 17, h: 10, label: 'xmin horizon pinned', sub: 'vacuum frees nothing', color: AMBER },
    { id: 'bloat', x: 45, y: 7, w: 17, h: 9, label: 'Bloat ↑', sub: 'tables & indexes swell', color: AMBER },
    { id: 'cachehit', x: 45, y: 31, w: 17, h: 9, label: 'Cache hit ↓', sub: 'pages full of dead rows', color: AMBER },
    { id: 'p99', x: 68, y: 7, w: 17, h: 9, label: 'Query p99 ↑', sub: 'first real symptom', color: AMBER },
    { id: 'conns', x: 68, y: 19, w: 17, h: 9, label: 'Connections pile up', sub: 'each held longer', color: RED },
    { id: 'wall', x: 68, y: 31, w: 17, h: 9, label: 'max_connections', sub: 'errors for everyone', color: RED },
  ],
  steps: [
    {
      title: 'Someone forgets a transaction',
      prose:
        'A worker crashed mid-transaction, an ORM leaked a session, or a human typed <code>BEGIN</code> in psql and went to lunch. The backend sits “idle in transaction,” holding a snapshot from hours ago. Nothing is broken. <b>No alert fires.</b>',
      focus: ['idle'],
    },
    {
      title: 'The cluster’s garbage collection stops',
      prose:
        'Vacuum may only reclaim row versions older than the <b>oldest live snapshot</b> — and that snapshot is now frozen in time. Autovacuum keeps running, keeps reporting success, and <b>frees nothing</b>. One connection has quietly disabled cleanup for every table in the cluster.',
      focus: ['idle', 'horizon'],
      particles: [{ from: 'idle', to: 'horizon', color: AMBER }],
    },
    {
      title: 'The debt compounds',
      prose:
        'Every UPDATE and DELETE keeps adding dead versions that can’t be collected. Hot tables and their indexes <b>physically grow</b> — the same logical rows smeared over ever more 8 KB pages. Still no page: bloat dashboards are checked weekly, if at all.',
      focus: ['horizon', 'bloat'],
      particles: [{ from: 'horizon', to: 'bloat', color: AMBER }],
    },
    {
      title: 'The cache silently deflates',
      prose:
        'Shared buffers hold pages, not rows — and the pages are increasingly <b>corpses with a few live rows each</b>. The effective cache shrinks without a single byte of RAM changing. Cache hit ratio starts drifting down; disk reads creep up.',
      focus: ['horizon', 'cachehit'],
      particles: [{ from: 'horizon', to: 'cachehit', color: AMBER }],
    },
    {
      title: 'Latency spikes (first real symptom)',
      prose:
        'More pages per scan plus more disk reads per page: <b>p99 climbs</b> — and this is usually the first metric anyone is actually watching. Note that it is <em>three hops from the root cause</em>: nothing about a latency graph says “a transaction has been open since 9:14.”',
      focus: ['bloat', 'p99', 'cachehit'],
      particles: [
        { from: 'bloat', to: 'p99', color: AMBER },
        { from: 'cachehit', to: 'p99', color: AMBER, via: [{ x: 65, y: 35.5 }, { x: 65, y: 11.5 }] },
      ],
    },
    {
      title: 'Connections pile up',
      prose:
        'Every query holds its connection a little longer, so the app pools run dry and open more — against a database that spends a process on each one. The primary now burns CPU on <b>context switching instead of queries</b>, which slows queries further. The feedback loop has closed.',
      focus: ['p99', 'conns'],
      particles: [{ from: 'p99', to: 'conns', color: RED }],
    },
    {
      title: 'The wall',
      prose:
        '<code>FATAL: sorry, too many clients already.</code> New connections are refused, and every service that needs the database starts erroring <b>simultaneously</b>. The incident channel fills with symptoms from five different teams — none of them mentioning vacuum, transactions, or the intern’s psql session.',
      focus: ['conns', 'wall'],
      particles: [{ from: 'conns', to: 'wall', color: RED }],
    },
    {
      title: 'The lesson: read it backwards',
      prose:
        'The fix is one command — <code>pg_terminate_backend</code> on the idle transaction — <em>if you know to look</em>. That is the difference a runbook makes: page on the <b>leading</b> indicators (oldest transaction age, dead-tuple trend), set <code>idle_in_transaction_session_timeout</code> so this class of incident cannot exist, and when p99 pages you anyway, walk the cascade backwards before adding hardware.',
      focus: ['idle', 'horizon', 'bloat', 'cachehit', 'p99', 'conns', 'wall'],
      particles: [
        { from: 'wall', to: 'idle', color: VIO, via: [{ x: 76.5, y: 47 }, { x: 11.5, y: 47 }] },
        { from: 'p99', to: 'idle', color: VIO, via: [{ x: 76.5, y: 1.5 }, { x: 11.5, y: 1.5 }] },
      ],
    },
  ],
}
