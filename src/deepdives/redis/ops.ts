import type { TraceSpec } from '../../components/TracePlayer'
import type { MetricCard } from '../../components/MetricRunbook'
import { VIZ } from '../../styles/viz'

/* ============================================================
   Redis in production — the metrics you actually watch, what a
   spike means, what breaks, and what you do about it.
   The "3am pager" view, not the happy path.
   ============================================================ */

export const METRICS: MetricCard[] = [
  {
    metric: 'Command latency / slow log',
    jmx: 'SLOWLOG GET · LATENCY HISTORY',
    severity: 'page',
    healthy: 'Intrinsic latency in microseconds; SLOWLOG empty except deliberate admin commands.',
    means: 'Something ran long on the one thread — and while it ran, every other client on the instance waited. Latency spikes on Redis are never "one slow request"; they are brief total outages.',
    breaks:
      'Client timeouts fire in bulk, retries pile onto the frozen loop, and if the stall outlasts <code>cluster-node-timeout</code>, gossip declares the node dead and triggers a <b>failover of a healthy master</b> — the cascade animated above.',
    causes: [
      'An O(N) command on a whale key (SMEMBERS, LRANGE 0 -1, HGETALL) or KEYS in production',
      'A long Lua script or MULTI/EXEC batch — atomic means exclusive',
      'fork() for BGSAVE/AOF-rewrite on a large instance (see latest_fork_usec)',
      'Transparent huge pages or swapping — the OS making memory ops slow',
      'A DEL of a huge collection (use UNLINK — it frees in a background thread)',
    ],
    respond: [
      'SLOWLOG GET 25 — the culprit is usually right there, with its microsecond bill',
      'redis-cli --bigkeys / --hotkeys to find the whales before they surface again',
      'Replace KEYS with SCAN, DEL with UNLINK, unbounded reads with paginated ranges',
      'LATENCY DOCTOR — it diagnoses fork, THP, and AOF-fsync stalls by name',
    ],
    tie: 'The "everyone waits" step of the Chapter 2 trace, observed as an incident.',
  },
  {
    metric: 'Memory vs maxmemory',
    jmx: 'INFO memory → used_memory / maxmemory',
    severity: 'page',
    healthy: 'Comfortably under maxmemory, with maxmemory itself leaving fork headroom on the host.',
    means: 'How close the dataset is to the ceiling. What happens at the ceiling depends entirely on the eviction policy — which is why this one number means two different emergencies.',
    breaks:
      'As a <b>cache</b> (allkeys-lru): evictions begin, hit ratio sags, the database behind takes the difference. As a <b>store</b> (noeviction): writes start failing with OOM errors — a hard outage. And if <code>maxmemory</code> ignores fork headroom, the next BGSAVE invites the OOM killer.',
    causes: [
      'Organic growth or a new feature writing more than modeled',
      'An encoding cliff — a listpack silently became a skiplist/hashtable at 5–10× the bytes',
      'Missing TTLs — keys that were "temporary" in the design but not in the config',
      'Fragmentation (see the next card) inflating RSS above used_memory',
    ],
    respond: [
      'MEMORY DOCTOR and MEMORY USAGE on suspects; redis-cli --bigkeys for the census',
      'Confirm the policy matches the role: cache → allkeys-lru, store → noeviction + capacity plan',
      'Audit TTL coverage (DBSIZE vs keys with expiry in INFO keyspace)',
      'Scale up RAM or shard — but only after the encoding/TTL audit; it is usually cheaper',
    ],
    tie: 'The RAM meter from Chapter 3, including the copy-on-write headroom it charges.',
  },
  {
    metric: 'Fragmentation ratio',
    jmx: 'INFO memory → mem_fragmentation_ratio',
    severity: 'watch',
    healthy: '~1.0–1.5. Below 1.0 means swapping — treat that as a page, not a curiosity.',
    means: 'RSS ÷ used_memory: how much more RAM the OS has granted than Redis is logically using. Churn-heavy workloads (many sizes, many deletes) fragment the allocator arenas.',
    breaks:
      'At ratio 2.0, a "20 GB" instance occupies 40 GB of real RAM — capacity you paid for and cannot use, and headroom the fork spike will not find when it needs it.',
    causes: [
      'High key churn with mixed value sizes (the allocator can’t reuse holes)',
      'Mass deletions after a migration or TTL sweep',
      'A ratio < 1.0: the OS has swapped Redis pages — every touch is a disk read',
    ],
    respond: [
      'activedefrag yes — jemalloc defrag runs incrementally on the loop’s idle time',
      'If swapping: fix host memory pressure immediately; Redis on swap is Redis down',
      'Chronic high ratio: restart during a maintenance window rebuilds arenas compactly',
    ],
  },
  {
    metric: 'Evictions & expirations',
    jmx: 'INFO stats → evicted_keys, expired_keys',
    severity: 'watch',
    healthy: 'Cache: a steady, boring eviction rate. Store: exactly zero, forever.',
    means: 'Keys leaving without being asked. Expired = TTLs doing their job. Evicted = maxmemory pressure choosing victims by policy — which is either the cache working as designed or silent data loss, depending on what you put in it.',
    breaks:
      'A rising eviction rate on a cache quietly transfers load to the database behind it (watch the hit ratio fall in tandem). On a store, a single evicted key is corruption — sessions vanish, queues drop jobs, counters reset.',
    causes: [
      'Memory pressure (see memory card) with an eviction policy armed',
      'A cache and a store sharing one instance — one policy cannot serve both',
      'TTL stampedes: a deploy that set thousands of keys with the same expiry second',
    ],
    respond: [
      'Split roles: caches and stores in separate instances with separate policies',
      'Jitter TTLs (base ± random) so cohorts don’t expire in lockstep',
      'If a store is evicting: stop, restore from the source of truth, fix the policy first',
    ],
    tie: 'Eviction is the failure mode the Chapter 5 verdicts warn about when memory meters go red.',
  },
  {
    metric: 'Hit ratio',
    jmx: 'INFO stats → keyspace_hits / (hits + misses)',
    severity: 'watch',
    healthy: 'Stable and high — 90%+ for most caches; the trend matters more than the number.',
    means: 'The fraction of reads Redis answered. Every miss is a promise the system behind Redis must keep instead — the hit ratio is really a load-routing dial between Redis and your database.',
    breaks:
      'A 95% → 85% drop <b>quadruples</b> the miss traffic hitting the database (5% → 15%). Falling hit ratio is how Redis problems become Postgres incidents — the two runbooks meet here.',
    causes: [
      'Evictions from memory pressure trimming the working set',
      'A new query pattern the cache keys don’t cover',
      'TTLs shorter than the reuse interval',
      'Cold cache after a restart or failover (the stampede window)',
    ],
    respond: [
      'Correlate with evicted_keys first — pressure-driven misses have a memory fix',
      'Warm caches after failover (replay top keys) before taking full traffic',
      'For hot keys, add request coalescing so one miss = one DB query, not thousands',
    ],
  },
  {
    metric: 'Replication health & full syncs',
    jmx: 'INFO replication → master_link_status, sync_full',
    severity: 'page',
    healthy: 'link_status:up, replica offsets within a few KB of the master, sync_full not incrementing.',
    means: 'Whether replicas are connected and how far behind they are — and, critically, whether they’ve been resorting to <b>full resynchronization</b> (fork + RDB + transfer) instead of catching up from the replication backlog.',
    breaks:
      'A lagging replica promoted in failover <b>loses the gap</b> — acked writes gone. And each full sync is a fork and a dataset transfer: several replicas full-syncing at once can flatten a healthy master (the resync storm of Chapter 8).',
    causes: [
      'repl-backlog-size too small for a network blip — a 30 s hiccup forces a full resync',
      'Replica output buffer overrun on a write burst (client-output-buffer-limit replica)',
      'Master restart — all replicas full-sync simultaneously',
      'Slow replica disk (diskless sync off) or saturated network',
    ],
    respond: [
      'Size repl-backlog-size to cover minutes of writes, not seconds — RAM well spent',
      'Raise the replica client-output-buffer-limit so bursts don’t sever the link',
      'Stagger replica restarts; use repl-diskless-sync for fast networks',
      'min-replicas-to-write / min-replicas-max-lag to stop acking writes nobody has',
    ],
    tie: 'Async replication from the persistence trace — the dial that decides what failover loses.',
  },
  {
    metric: 'Connections & output buffers',
    jmx: 'INFO clients → connected_clients, output buffers',
    severity: 'page',
    healthy: 'A stable client count far below maxclients (default 10,000); output buffers near zero.',
    means: 'How many sockets the loop is juggling and whether replies are backing up. Connections are cheap here (no per-connection process — contrast Postgres) but not free: a reconnect storm still drowns the loop in accept() and auth work.',
    breaks:
      'At maxclients, new connections are refused — instant errors fleet-wide. A slow consumer (or a huge reply, like MONITOR left running) grows an output buffer until Redis kills the client or eats the RAM.',
    causes: [
      'Retry/reconnect storm downstream of a latency spike (the cascade’s middle act)',
      'Apps without connection pooling, opening per-request sockets',
      'A subscriber that stopped reading its pub/sub stream',
      'MONITOR or DEBUG left running against production',
    ],
    respond: [
      'CLIENT LIST sorted by omem — the buffer hog is immediately visible',
      'Pool connections in the app; cap retries with backoff + jitter',
      'client-output-buffer-limit pubsub/normal so slow readers are disconnected, not fatal',
    ],
  },
  {
    metric: 'Fork cost',
    jmx: 'INFO stats → latest_fork_usec',
    severity: 'watch',
    healthy: 'Milliseconds. Tens of milliseconds is the budget ceiling; growth tracks dataset size.',
    means: 'How long the last fork() stalled the loop — the page-table tax from the persistence trace, paid on every BGSAVE, AOF rewrite, and replica full sync.',
    breaks:
      'On big instances this becomes a metronome of latency spikes (hundreds of ms), each one risking the timeout → retry → false-failover chain. Fork cost is the quiet argument for many small instances over one big one.',
    causes: [
      'Instance simply too large (fork ∝ resident memory)',
      'Virtualization overhead (worst on some hypervisors)',
      'Frequent snapshots + rewrites + resyncs multiplying the occasions',
    ],
    respond: [
      'Track it after every growth spurt — it degrades silently as data grows',
      'Split instances that exceed your latency budget’s fork tolerance (often ~25 GB)',
      'Schedule BGSAVE off-peak; let AOF carry durability during the day',
    ],
    tie: 'Chapter 4’s core claim — vertical scaling makes Redis operations worse — quantified.',
  },
  {
    metric: 'Main-thread CPU',
    jmx: 'INFO cpu → used_cpu_sys + used_cpu_user (one core!)',
    severity: 'watch',
    healthy: 'Under ~60% of a single core, leaving headroom for bursts, gossip, and background cycles.',
    means: 'The one meter that is the whole machine: command execution shares a single core with expiry cycles, defrag, and cluster gossip. Host-level CPU graphs lie — 4% on a 16-core box may be 64% of the core that matters.',
    breaks:
      'Approaching 100%, latency rises smoothly then cliffs; gossip PINGs queue behind commands and the node starts flapping PFAIL in peers’ eyes — instability without a single "error" anywhere.',
    causes: [
      'Ops volume beyond one core (the Chapter 3 envelope, exceeded)',
      'Command mix drift toward expensive ops (ZRANGEBYSCORE over big ranges, Lua)',
      'Active-expire or defrag cycles competing during churn-heavy periods',
    ],
    respond: [
      'Measure per-instance core usage, never host average',
      'Pipeline: batching 10 commands per round-trip can cut per-op overhead ~5×',
      'Shard (Chapter 5) — the only real fix; more cores on the same box do nothing',
    ],
    tie: 'The "one core" meter from Chapter 3, observed live.',
  },
]

/* ---- the cascade: one whale key becomes a false failover ---- */
const RED = VIZ.red
const AMBER = VIZ.amber
const VIO = VIZ.violet

export const cascadeTrace: TraceSpec = {
  title: 'Metric cascade — one whale key becomes a false failover',
  aspect: 0.5,
  zones: [
    { label: 'Root cause', x: 2, y: 14, w: 19, h: 20 },
    { label: 'This instance', x: 23, y: 4, w: 41, h: 40 },
    { label: 'Cluster-wide', x: 66, y: 4, w: 32, h: 40 },
  ],
  nodes: [
    { id: 'whale', x: 3.5, y: 19, w: 16, h: 10, label: 'A whale key', sub: 'SMEMBERS, 8M members', color: RED },
    { id: 'blocked', x: 25, y: 19, w: 17, h: 10, label: 'Event loop blocked', sub: 'the one thread, busy', color: AMBER },
    { id: 'queue', x: 45, y: 7, w: 17, h: 9, label: 'Commands queue', sub: 'every client waits', color: AMBER },
    { id: 'p99', x: 45, y: 31, w: 17, h: 9, label: 'Latency p99 ↑', sub: 'µs → seconds', color: AMBER },
    { id: 'retries', x: 68, y: 7, w: 17, h: 9, label: 'Timeouts + retries', sub: 'reconnect storm', color: RED },
    { id: 'pings', x: 68, y: 19, w: 17, h: 9, label: 'PINGs unanswered', sub: 'gossip suspicion', color: AMBER },
    { id: 'failover', x: 68, y: 31, w: 17, h: 9, label: 'False failover', sub: 'the master was alive', color: RED },
  ],
  steps: [
    {
      title: 'Someone grew a whale',
      prose:
        'A set that was "small" at design time has quietly reached 8 million members — or a debug script runs <code>KEYS *</code>, or an ORM serializes a 40 MB object into one value. Nothing is wrong yet. <b>No alert fires.</b> The whale just waits to be read.',
      focus: ['whale'],
    },
    {
      title: 'One command, one thread',
      prose:
        'Someone reads it. <code>SMEMBERS</code> walks 8 million entries and serializes them — <b>seconds of work, on the only thread there is</b>. Remember Chapter 2: commands run to completion. There is no preemption, no "slow query in the background." The instance is, for all purposes, off.',
      focus: ['whale', 'blocked'],
      particles: [{ from: 'whale', to: 'blocked', color: AMBER }],
    },
    {
      title: 'Everything queues',
      prose:
        'Every GET from every service parks behind the whale. The sockets are fine, the TCP accepts happen — but no command executes. From the outside it looks exactly like a network partition: <b>connected, silent</b>.',
      focus: ['blocked', 'queue'],
      particles: [{ from: 'blocked', to: 'queue', color: AMBER }],
    },
    {
      title: 'Latency explodes (first real symptom)',
      prose:
        'p99 goes from 200 µs to whole seconds in one scrape interval. This is the first metric anyone watches — and note it is <em>two hops</em> from the cause. A latency graph cannot tell you a set got too big in March.',
      focus: ['blocked', 'p99'],
      particles: [{ from: 'blocked', to: 'p99', color: AMBER }],
    },
    {
      title: 'The retry storm',
      prose:
        'Client timeouts (typically 1–2 s) fire across the fleet. Every timed-out client <b>retries — and often reconnects</b>, adding accept() and AUTH work to the very loop that is drowning. The whale finishes eventually; the storm it summoned is still arriving.',
      focus: ['p99', 'retries'],
      particles: [{ from: 'p99', to: 'retries', color: RED, via: [{ x: 65, y: 35.5 }, { x: 65, y: 11.5 }] }],
    },
    {
      title: 'Gossip turns on it',
      prose:
        'Cluster bus PINGs are answered by the <em>same thread</em>. Silent past <code>cluster-node-timeout</code>, peers mark the node <b>PFAIL</b>; enough peers agree and it is <b>FAIL</b>. The cluster has now formally concluded that a machine which is merely <em>busy</em> is dead.',
      focus: ['queue', 'pings'],
      particles: [{ from: 'queue', to: 'pings', color: AMBER }],
    },
    {
      title: 'A healthy master is failed over',
      prose:
        'A replica promotes itself, the epoch bumps, clients repoint. Writes from the last moments are lost (async replication). And here is the vicious part: <b>the whale replicated</b> — it lives on the new master too, waiting for the next SMEMBERS. The incident is now reproducible.',
      focus: ['pings', 'failover'],
      particles: [{ from: 'pings', to: 'failover', color: RED }],
    },
    {
      title: 'The lesson: read it backwards',
      prose:
        'The pager said "failover"; the cause was a data-model decision months earlier. Walk it backwards: SLOWLOG names the command, <code>redis-cli --bigkeys</code> names the key. Then make the class impossible: <b>bound every collection</b> in the data model, SCAN not KEYS, UNLINK not DEL, and alert on slowlog entries — the only metric here that fires <em>before</em> the storm.',
      focus: ['whale', 'blocked', 'queue', 'p99', 'retries', 'pings', 'failover'],
      particles: [
        { from: 'failover', to: 'whale', color: VIO, via: [{ x: 76.5, y: 47 }, { x: 11.5, y: 47 }] },
        { from: 'retries', to: 'whale', color: VIO, via: [{ x: 76.5, y: 1.5 }, { x: 11.5, y: 1.5 }] },
      ],
    },
  ],
}
