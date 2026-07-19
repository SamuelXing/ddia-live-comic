import type { TraceSpec } from '../../components/TracePlayer'
import type { MetricCard } from '../../components/MetricRunbook'
import { VIZ } from '../../styles/viz'

/* ============================================================
   Kafka in production — the metrics you actually watch, what a
   spike means, what breaks, and what you do about it.
   This is the "3am pager" view, not the happy path.
   ============================================================ */

export const METRICS: MetricCard[] = [
  {
    metric: 'Consumer lag',
    jmx: 'records-lag-max (consumer-fetch-manager-metrics)',
    severity: 'page',
    healthy: 'Flat and near zero, or sawtoothing but always draining back down.',
    means: 'Consumers are falling behind producers — the gap between the latest offset and the committed offset is growing. Your data is getting stale in real time.',
    breaks:
      'If lag outruns the retention window, unread messages are <b>deleted before anyone reads them</b> — permanent data loss. Long before that, everything downstream (dashboards, alerts, derived tables, ML features) is silently serving old data.',
    causes: [
      'A slow message handler or a slow downstream call (DB, API) the consumer waits on',
      'Fewer consumer instances than partitions — extra parallelism is impossible past the partition count',
      'A rebalance loop repeatedly pausing the whole group',
      'One hot partition from key skew, while the rest sit idle',
      'GC pauses or an under-provisioned consumer host',
    ],
    respond: [
      'Check consumers-vs-partitions first — if consumers < partitions, add instances (cheapest fix)',
      'Check the rebalance rate; a flapping consumer starves everyone',
      'Profile the handler / downstream latency — often the real culprit',
      'In a genuine emergency, temporarily raise retention to stop data from aging out while you fix the root cause',
    ],
    tie: 'This is the consumer-parallelism ceiling from Chapter 5, now observed instead of predicted.',
  },
  {
    metric: 'Under-replicated partitions',
    jmx: 'ReplicaManager → UnderReplicatedPartitions',
    severity: 'page',
    healthy: 'Exactly 0. Any sustained non-zero value is a real problem.',
    means: 'Some partitions have replicas that have fallen out of sync with their leader — the in-sync replica set (ISR) has shrunk. Your durability guarantee is degraded right now.',
    breaks:
      'With <code>acks=all</code> and <code>min.insync.replicas=2</code>, one more failure means either <b>committed data is lost</b> or <b>writes stop entirely</b> (producers get NotEnoughReplicas). You are one bad moment from an incident.',
    causes: [
      'A broker is down — its replicas are all under-replicated',
      'A broker is slow (disk or NIC saturated) and its followers can’t keep up',
      'A transient network partition between brokers',
      'A long GC pause on one broker',
    ],
    respond: [
      'Find WHICH broker is behind — it’s almost always one; the metric is per-broker',
      'Check that broker’s disk latency, network, and GC — treat the sick broker, not the symptom',
      'Do NOT roll-restart the cluster blindly — that removes more replicas and makes it worse',
      'Once identified, relieve load (move leadership off it) or replace the broker',
    ],
    tie: 'Ties to the ISR replication model from the produce trace in Chapter 2.',
  },
  {
    metric: 'Offline partitions',
    jmx: 'KafkaController → OfflinePartitionsCount',
    severity: 'page',
    healthy: 'Exactly 0, always.',
    means: 'Partitions that have NO leader — no broker can serve reads or writes for them. This is a live, user-visible outage for the affected topics.',
    breaks:
      'Producers and consumers for those partitions get errors immediately. This is a SEV, not a warning: part of your topic is simply <b>unavailable</b>.',
    causes: [
      'Every broker hosting the replicas of a partition is down at once',
      'A failed controller failover left partitions leaderless',
      'Correlated failure — a rack/AZ outage took out all replicas of some partitions (rack awareness misconfigured)',
    ],
    respond: [
      'Get brokers back online — restoring any in-sync replica restores the leader',
      'Check rack/AZ placement: replicas of one partition should never share a failure domain',
      'Unclean leader election (electing an out-of-sync replica) is the LAST resort — it trades data loss for availability; only pull it deliberately',
    ],
  },
  {
    metric: 'Active controller count',
    jmx: 'KafkaController → ActiveControllerCount',
    severity: 'page',
    healthy: 'Sums to exactly 1 across the whole cluster.',
    means: 'The controller assigns partition leadership and propagates metadata. There must be exactly one. 0 means no brain; 2+ means split brain.',
    breaks:
      '<b>Zero:</b> leadership changes and metadata updates freeze — the cluster can’t heal from any other failure. <b>Two:</b> conflicting metadata decisions corrupt cluster state.',
    causes: [
      'Controller broker crashed and failover is stuck or slow',
      'KRaft metadata quorum lost majority (can’t elect) — check the controller quorum',
      'Network partition split the controllers (the classic split-brain trigger)',
    ],
    respond: [
      'Confirm the KRaft controller quorum has a majority alive — no majority, no controller',
      'Restore controller nodes; the quorum re-elects one leader automatically',
      'Never run an even number of controllers — you want a clear majority (3 or 5)',
    ],
    tie: 'This is the KRaft metadata quorum from Chapter 2 — itself a replicated log.',
  },
  {
    metric: 'Request handler idle ratio',
    jmx: 'RequestHandlerAvgIdlePercent',
    severity: 'watch',
    healthy: 'Well above 0.2 (20% idle). Trending toward 0 is your saturation early-warning.',
    means: 'The fraction of time the broker’s I/O threads have nothing to do. As it approaches 0, the broker has no spare capacity — every new request queues.',
    breaks:
      'Request latency climbs, then producers/consumers time out and <b>retry</b>, which adds load exactly when the broker is weakest — a feedback loop that ends in cascading timeouts.',
    causes: [
      'Traffic beyond the hardware envelope — bytes-in/out near the NIC ceiling',
      'Too few I/O threads for the load (num.io.threads)',
      'A hot broker holding too much partition leadership',
      'Slow disk making each append take longer, tying up threads',
    ],
    respond: [
      'Check bytes-in/out vs the NIC first — you may simply be at the envelope from Chapter 3',
      'Rebalance leadership to spread load off the hot broker',
      'Add brokers (real fix); raise num.io.threads as a stopgap',
    ],
    tie: 'This is the hardware envelope from Chapter 3, observed live.',
  },
  {
    metric: 'Request latency p99',
    jmx: 'RequestMetrics → TotalTimeMs (Produce / FetchConsumer)',
    severity: 'watch',
    healthy: 'Stable and low; watch p99, not the average, which hides the pain.',
    means: 'End-to-end broker-side time for a request. The user-facing symptom — but it decomposes, and the decomposition tells you where to look.',
    breaks:
      'High produce latency stalls the whole write path; high fetch latency starves consumers and grows lag. It’s the number everything else eventually shows up as.',
    causes: [
      'Queue time high → the broker is saturated (see handler idle)',
      'Local time high → disk/append is slow',
      'Remote time high → waiting on replica acks (acks=all + slow follower)',
      'A lagging consumer paging cold segments from disk, polluting the page cache',
    ],
    respond: [
      'Break TotalTimeMs into queue/local/remote — the biggest component names the cause',
      'Remote-time-bound → chase the slow follower (URP will confirm)',
      'Local-time-bound → chase the disk (log-flush latency)',
    ],
    tie: 'Remote time is the acks=all wait from the produce trace; local time is the page-cache append.',
  },
  {
    metric: 'ISR shrink / expand rate',
    jmx: 'ReplicaManager → IsrShrinksPerSec / IsrExpandsPerSec',
    severity: 'watch',
    healthy: 'Near zero. Occasional single events are fine; a steady rate is not.',
    means: 'How often replicas drop out of and rejoin the in-sync set. Frequent flapping means the cluster is on the edge of instability.',
    breaks:
      'Each shrink narrows your durability margin and can momentarily block writes; constant flapping makes latency and availability jittery and unpredictable.',
    causes: [
      'A broker intermittently slow (GC, disk contention, noisy neighbor)',
      'replica.lag.time.max.ms set too aggressively for the workload',
      'Network micro-outages between brokers',
    ],
    respond: [
      'Correlate flaps with GC logs and disk latency on the flapping broker',
      'Fix the underlying resource contention rather than widening the lag threshold',
    ],
  },
  {
    metric: 'Disk usage %',
    jmx: 'log directory free space (host metric)',
    severity: 'page',
    healthy: 'Comfortably below ~75%, with headroom for a replica catching up (which writes fast).',
    means: 'How full the log directories are. Kafka does not gracefully degrade here — it dies.',
    breaks:
      'A full disk takes the broker <b>down hard</b>, which under-replicates its partitions, which pushes load and re-replication onto the survivors — a classic cascading, correlated failure across the cluster.',
    causes: [
      'Retention too long for the ingest rate (bytes-in × retention × RF)',
      'A stuck/misconfigured retention or compaction task not deleting old segments',
      'A recovering replica rapidly writing to catch up',
      'One partition’s segments dwarfing others (key skew)',
    ],
    respond: [
      'Shorten retention on the biggest topics to reclaim space fast (segments delete immediately)',
      'Add brokers/disks, or enable tiered storage to offload cold segments to object storage',
      'Alert at 75%, not 95% — you need lead time before a broker dies',
    ],
    tie: 'This is the disk-capacity meter from the Chapter 3 envelope, hit for real.',
  },
]

/* ---- the metric cascade: one slow disk → a cluster incident ---- */
const RED = VIZ.red
const AMBER = VIZ.amber
const VIO = VIZ.violet

export const cascadeTrace: TraceSpec = {
  title: 'Metric cascade — a single slow disk becomes a cluster incident',
  aspect: 0.5,
  zones: [
    { label: 'Root cause', x: 2, y: 14, w: 19, h: 20 },
    { label: 'This broker', x: 23, y: 4, w: 41, h: 40 },
    { label: 'Cluster-wide', x: 66, y: 4, w: 32, h: 40 },
  ],
  nodes: [
    { id: 'disk', x: 3.5, y: 19, w: 16, h: 10, label: 'Disk I/O latency ↑', sub: 'the root cause', color: RED },
    { id: 'flush', x: 25, y: 19, w: 17, h: 10, label: 'Log-flush time ↑', color: AMBER },
    { id: 'idle', x: 45, y: 7, w: 17, h: 9, label: 'Handler idle → 0', sub: 'broker saturating', color: AMBER },
    { id: 'p99', x: 45, y: 31, w: 17, h: 9, label: 'Produce p99 ↑', sub: 'user-facing', color: AMBER },
    { id: 'urp', x: 68, y: 7, w: 17, h: 9, label: 'Under-replicated ↑', sub: 'durability at risk', color: RED },
    { id: 'retries', x: 68, y: 19, w: 17, h: 9, label: 'Producer retries ↑', sub: 'feedback loop', color: RED },
    { id: 'lag', x: 68, y: 31, w: 17, h: 9, label: 'Consumer lag ↑', sub: 'data stale', color: RED },
  ],
  steps: [
    {
      title: 'A disk gets slow',
      prose:
        'Nothing crashed. One broker’s NVMe is aging, or a rebuild is hammering it, or a noisy neighbor stole the IOPS. <b>Disk write latency creeps up</b> — the single root cause everything below descends from. Notice: no alert has fired yet.',
      focus: ['disk'],
    },
    {
      title: 'Appends take longer',
      prose:
        'Every produce append lands in the page cache, but the periodic flush of dirty pages to that slow disk now takes longer. <b>Log-flush latency rises.</b> Still no page — this is an internal metric most teams don’t even alert on.',
      focus: ['disk', 'flush'],
      particles: [{ from: 'disk', to: 'flush', color: AMBER }],
    },
    {
      title: 'I/O threads back up',
      prose:
        'Threads spend longer per request, so the pool has less idle time. <b>RequestHandlerAvgIdlePercent falls toward 0</b> — the broker is saturating, but only on this one node.',
      focus: ['flush', 'idle'],
      particles: [{ from: 'flush', to: 'idle', color: AMBER }],
    },
    {
      title: 'Latency spikes (first real symptom)',
      prose:
        'Requests queue behind busy threads. <b>Produce p99 jumps</b> — and this is usually the FIRST metric anyone actually watches. But notice it’s <em>three hops</em> from the root cause: paging on p99 alone tells you something hurts, not what.',
      focus: ['idle', 'p99'],
      particles: [{ from: 'idle', to: 'p99', color: AMBER }],
    },
    {
      title: 'Durability degrades',
      prose:
        'With <code>acks=all</code>, followers fetch from this slow leader and fall behind, so replicas drop out of the ISR. <b>Under-replicated partitions rises.</b> Now two independent alerts (p99 and URP) are firing from one slow disk.',
      focus: ['p99', 'urp'],
      // route up the channel between the two zones, not across Producer retries
      particles: [{ from: 'p99', to: 'urp', color: RED, via: [{ x: 65, y: 35.5 }, { x: 65, y: 11.5 }] }],
    },
    {
      title: 'The feedback loop',
      prose:
        'Slow acks make producers time out and <b>retry</b> — re-sending load onto the broker that’s already drowning. This positive feedback is what turns a slow disk into a <em>cliff</em>: the system accelerates its own collapse.',
      focus: ['urp', 'retries', 'idle'],
      particles: [
        { from: 'urp', to: 'retries', color: RED },
        { from: 'retries', to: 'idle', color: RED, via: [{ x: 65, y: 23.5 }, { x: 65, y: 11.5 }] },
      ],
    },
    {
      title: 'Consumers starve',
      prose:
        'Fetches from this broker’s partitions slow too, so <b>consumer lag climbs</b> and downstream data goes stale. One aging disk has now produced four separate alerts across latency, durability, and freshness.',
      focus: ['p99', 'lag'],
      particles: [{ from: 'p99', to: 'lag', color: RED }],
    },
    {
      title: 'The lesson: correlate, don’t react',
      prose:
        'The metric you paged on (URP or p99) is several hops from the cause (disk). Reacting to it directly — rolling the cluster, adding brokers — can make things worse. <b>Reading the cascade backwards to the root</b> is the skill. That’s what a runbook is for.',
      focus: ['disk', 'flush', 'idle', 'p99', 'urp', 'retries', 'lag'],
      // the two "trace it back" arrows sweep around via the top & bottom
      // channels instead of cutting across the middle nodes
      particles: [
        { from: 'lag', to: 'disk', color: VIO, via: [{ x: 76.5, y: 47 }, { x: 11.5, y: 47 }] },
        { from: 'urp', to: 'disk', color: VIO, via: [{ x: 76.5, y: 1.5 }, { x: 11.5, y: 1.5 }] },
      ],
    },
  ],
}
