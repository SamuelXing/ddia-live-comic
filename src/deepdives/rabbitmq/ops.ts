import type { TraceSpec } from '../../components/TracePlayer'
import type { MetricCard } from '../../components/MetricRunbook'
import { VIZ } from '../../styles/viz'

/* ============================================================
   RabbitMQ in production — the metrics you actually watch, what
   a spike means, what breaks, and what you do about it.
   The "3am pager" view, not the happy path.
   ============================================================ */

export const METRICS: MetricCard[] = [
  {
    metric: 'Queue depth',
    jmx: 'rabbitmq_queue_messages_ready',
    severity: 'page',
    healthy: 'Near zero, always. Sawtooth under bursts is fine — as long as every tooth returns to the floor.',
    means: 'Messages are arriving faster than consumers ack them. In a system designed around flow-through, standing depth is the single most information-dense number: it is consumer health, capacity margin, and memory forecast in one.',
    breaks:
      'Depth <b>is</b> the fuse of the Chapter 6 cascade: heap growth → paging → memory alarm → <b>every publisher on every node blocked</b>. Long before that, latency through the queue grows from ms to minutes — your "async" system is now a delay line.',
    causes: [
      'Consumer fleet slowed or broken (a deploy, a hung dependency, a crash loop)',
      'Publish burst beyond planned capacity (a batch job, a retry storm upstream)',
      'One queue saturated at its one-core ceiling while consumers idle (see per-queue load)',
      'A consumer stuck on a poison message, redelivering forever',
    ],
    respond: [
      'Check consumer count and ack rate first — depth with zero acks is a consumer incident, not a Rabbit incident',
      'Scale consumers if they’re healthy but slow; fix or roll back if they’re broken',
      'If depth threatens the watermark: purge (if data is re-derivable) or shovel to a spillover queue — deliberately, before the alarm decides for you',
      'Alert on depth *trend*, not a fixed number — growth that outruns drain is the real signal',
    ],
    tie: 'The "backlog is poison" step of the BEAM trace, as a number on a dashboard.',
  },
  {
    metric: 'Consumer utilisation & ack rate',
    jmx: 'consumer_utilisation · message ack rate',
    severity: 'watch',
    healthy: 'Utilisation near 1.0 (consumers always have work available when they want it); ack rate ≈ publish rate.',
    means: 'Utilisation below 1.0 says consumers are being starved by delivery mechanics (usually prefetch too low for the round-trip time). Ack rate falling below publish rate says the fleet can’t keep up — depth is about to grow.',
    breaks:
      'Low utilisation wastes the consumers you already pay for — the fleet looks busy while the queue backs up. Ack rate < publish rate is depth growth stated as a rate: the cascade’s fuse, lit.',
    causes: [
      'Prefetch too low for network RTT (consumer idles between deliveries)',
      'Handler latency regression (a slow downstream call inside the consumer)',
      'Prefetch unlimited on one consumer — it hoards, peers starve, utilisation lies',
      'Connection-level flow control throttling the channel',
    ],
    respond: [
      'Tune prefetch ≈ handler-rate × RTT, with headroom — measure, don’t guess',
      'Profile the handler; the queue is usually innocent',
      'Set a per-consumer prefetch everywhere — unlimited is never the right answer',
    ],
    tie: 'Prefetch mechanics are step 7 of the publish trace.',
  },
  {
    metric: 'Memory vs watermark',
    jmx: 'rabbitmq_process_resident_memory vs watermark',
    severity: 'page',
    healthy: 'Well under the 40%-of-RAM default watermark, stable across the daily cycle.',
    means: 'How close the node is to the alarm that blocks every publisher cluster-wide. Memory here is mostly queue backlog plus per-connection/channel state — so this meter is the sum of everyone’s behavior on the node.',
    breaks:
      'At the watermark: cluster-wide publish freeze (the BEAM trace, final act). Publishers don’t error — they <b>hang</b>, which walks the outage upstream into every service that publishes inline.',
    causes: [
      'A deep backlog on any queue (see queue depth — it’s usually one)',
      'Connection/channel bloat: tens of thousands of channels each holding buffers',
      'Large messages amplifying everything (payloads belong in S3, references in messages)',
      'Undersized nodes for the tenant count sharing them',
    ],
    respond: [
      'Find the fat queue (management UI sorts by memory) — it’s almost always one queue',
      'Drain, purge, or shovel it; then bulkhead it with max-length so it can’t recur',
      'Audit channel counts per connection; cap with per-vhost limits',
      'Raising the watermark is a stay of execution, not a fix — spend it on the real cause',
    ],
    tie: 'The cliff edge of the BEAM trace, measured as distance-to-alarm.',
  },
  {
    metric: 'Disk free vs limit',
    jmx: 'rabbitmq_disk_space_available vs disk_free_limit',
    severity: 'page',
    healthy: 'Comfortably above the limit (default is a token 50 MB — set it to cover minutes of peak paging).',
    means: 'The disk alarm is the memory alarm’s sibling: below the free-space limit, publishers block cluster-wide, same mechanism. Paging, quorum Raft logs, and the message store all draw from this budget.',
    breaks:
      'Same freeze as the memory alarm — and often triggered *by* the memory story: a big backlog pages to disk, fills it, and now both alarms hold the cluster hostage at once.',
    causes: [
      'Paged backlog from a depth incident consuming the volume',
      'Quorum queue segment files retained by a slow follower',
      'The default 50 MB limit giving effectively zero warning',
      'Shared volume with logs or another service',
    ],
    respond: [
      'Set disk_free_limit to a real number (multiple GB) so the alarm fires with runway',
      'Give RabbitMQ a dedicated volume; its failure mode should be its own',
      'Drain the depth incident behind it — the disk is a symptom here',
    ],
  },
  {
    metric: 'Unacked messages',
    jmx: 'rabbitmq_queue_messages_unacked',
    severity: 'watch',
    healthy: 'Roughly consumers × prefetch — the in-flight window, stable and small.',
    means: 'Deliveries the broker is holding open per delivery tag. Growth without matching throughput means consumers are taking work and not finishing it — hung handlers, or a hoarder with unlimited prefetch.',
    breaks:
      'Unacked messages hold their memory AND redeliver in bulk when the consumer’s channel dies — a thundering rewind that can double-process hours of work (idempotency is not optional here).',
    causes: [
      'A hung consumer holding its prefetch window forever',
      'Unlimited prefetch letting one consumer own the backlog',
      'Handlers that ack late (after side effects) crashing mid-batch',
    ],
    respond: [
      'CLIENT-side: ack promptly after the idempotent commit point; keep handlers short',
      'Set delivery-acknowledgement-timeout so hung consumers are cut loose deterministically',
      'Find the hoarder in the management UI (unacked per channel) and fix its prefetch',
    ],
  },
  {
    metric: 'Publisher confirm latency',
    jmx: 'confirm RTT (client-side histogram)',
    severity: 'watch',
    healthy: 'Single-digit ms for quorum queues on local NVMe; stable p99.',
    means: 'How long the broker takes to make a publish safe (majority Raft fsync for quorum queues). This is the write path’s health in one number — and the first thing to move when disks, followers, or the network degrade.',
    breaks:
      'Rising confirm latency backpressures every producer (bounded confirm windows fill), so upstream services slow down in sympathy — a gentle, invisible brownout that predates any alarm.',
    causes: [
      'Slow or contended disk under the Raft log / message store',
      'A quorum follower behind (majority waits for the second-fastest fsync)',
      'Inter-node network latency or loss',
      'fsync amplification from many tiny persistent messages (batching helps)',
    ],
    respond: [
      'Correlate with node disk latency — the usual suspect',
      'Check quorum queue member health; replace a chronically slow follower',
      'Batch publishes / raise the confirm window client-side to amortize round-trips',
    ],
    tie: 'The majority-fsync price from step 2 of the estate trace.',
  },
  {
    metric: 'Quorum queue Raft health',
    jmx: 'raft log delta · leader elections',
    severity: 'page',
    healthy: 'Commit-to-applied delta near zero; leader elections only when you cause them.',
    means: 'Whether each queue’s Raft group is intact and current. A growing log delta is a follower falling behind; spontaneous elections mean members are timing out — the queue’s durability story degrading in real time.',
    breaks:
      'Lose the majority and the queue goes <b>unavailable for writes</b> (correctly — that’s the deal). Chronically lagging followers mean confirms slow down now and recovery is long when a node dies.',
    causes: [
      'A node down or partitioned (elections) — or GC/CPU-starved (timeouts)',
      'Slow disk on one member (log delta grows)',
      'Memory alarm on a member pausing its Raft participation',
    ],
    respond: [
      'Treat spontaneous elections as a node-health page, not a queue problem',
      'Check the lagging member’s disk and CPU; rebalance queue leaders after recovery',
      'Never run quorum queues with even membership; three or five, spread across AZs',
    ],
  },
  {
    metric: 'Connection & channel churn',
    jmx: 'connections_opened_total rate',
    severity: 'watch',
    healthy: 'Near zero in steady state — connections are long-lived infrastructure, opened at app boot.',
    means: 'How often clients are opening (and implicitly closing) connections and channels. Each open is a multi-round-trip handshake plus broker-side process setup — cheap once, corrosive at thousands per second.',
    breaks:
      'A churn storm (an app opening a connection per message, or a crash-looping fleet reconnecting) can consume a node’s CPU entirely in handshakes — throughput collapses with every queue healthy and empty.',
    causes: [
      'Connection-per-request application code (the classic integration bug)',
      'A crash-looping consumer fleet in a reconnect stampede',
      'An LB health check that opens real AMQP connections aggressively',
    ],
    respond: [
      'Find the churner (management UI lists connection age) and fix the client pattern',
      'Add reconnect backoff + jitter to every client config as policy',
      'Use TCP-level LB health checks, not full AMQP handshakes',
    ],
  },
  {
    metric: 'File descriptors',
    jmx: 'fd_used vs fd_limit',
    severity: 'watch',
    healthy: 'Well under the limit, sized for connections + message-store segment files with margin.',
    means: 'Every connection and every open segment file consumes a descriptor. The default OS limit (often 1024) is laughably low for a broker; hitting it makes the node refuse new connections and, worse, fail file operations mid-flight.',
    breaks:
      'At the limit: new connections rejected (visible), message-store file opens failing (subtle, and much scarier). Nodes have crashed on this; it’s the most preventable page in the book.',
    causes: [
      'Default ulimit never raised at install time',
      'Connection growth from fleet scaling or churn',
      'Many queues → many store segment files',
    ],
    respond: [
      'Raise the limit at deploy time (65k+) — configuration, not firefighting',
      'Alert at 70% so it never becomes interesting again',
    ],
  },
]

/* ---- the cascade: one slow consumer becomes a cluster-wide freeze ---- */
const RED = VIZ.red
const AMBER = VIZ.amber
const VIO = VIZ.violet

export const cascadeTrace: TraceSpec = {
  title: 'Metric cascade — one slow consumer freezes every publisher',
  aspect: 0.5,
  zones: [
    { label: 'Root cause', x: 2, y: 14, w: 19, h: 20 },
    { label: 'This broker', x: 23, y: 4, w: 41, h: 40 },
    { label: 'Company-wide', x: 66, y: 4, w: 32, h: 40 },
  ],
  nodes: [
    { id: 'deploy', x: 3.5, y: 19, w: 16, h: 10, label: 'Bad consumer deploy', sub: 'handler hangs, acks stop', color: RED },
    { id: 'depth', x: 25, y: 19, w: 17, h: 10, label: 'Queue depth ↑', sub: 'publishes keep landing', color: AMBER },
    { id: 'ram', x: 45, y: 7, w: 17, h: 9, label: 'Broker RAM ↑', sub: 'backlog in heaps', color: AMBER },
    { id: 'paging', x: 45, y: 31, w: 17, h: 9, label: 'Paging + slowdown', sub: 'disk in the hot path', color: AMBER },
    { id: 'alarm', x: 68, y: 7, w: 17, h: 9, label: 'Memory alarm', sub: 'watermark crossed', color: RED },
    { id: 'frozen', x: 68, y: 19, w: 17, h: 9, label: 'Publishers blocked', sub: 'every app, every node', color: RED },
    { id: 'upstream', x: 68, y: 31, w: 17, h: 9, label: 'Upstream stalls', sub: 'threads hang on publish', color: RED },
  ],
  steps: [
    {
      title: 'A consumer deploy goes bad',
      prose:
        'The orders-processing fleet ships a version whose handler hangs on a new downstream call. The processes are up, connections healthy, sockets open — they take deliveries and simply <b>never ack</b>. Every health check passes. <b>No alert fires.</b>',
      focus: ['deploy'],
    },
    {
      title: 'Depth starts climbing',
      prose:
        'Producers neither know nor care — <code>basic.publish</code> is fire-and-forget from their side. The orders queue starts accumulating: a thousand, a hundred thousand, a million. This is the moment a depth-<em>trend</em> alert earns its keep. Without one, nobody is watching a number that only ever meant &ldquo;fine&rdquo; before.',
      focus: ['deploy', 'depth'],
      particles: [{ from: 'deploy', to: 'depth', color: AMBER }],
    },
    {
      title: 'The backlog eats the broker',
      prose:
        'A million messages × payload + per-message bookkeeping, all in the queue process&apos;s heap. <b>Node RAM climbs</b> — and Erlang GC on a giant heap makes the queue slower as it grows. The broker is now degrading from the inside.',
      focus: ['depth', 'ram'],
      particles: [{ from: 'depth', to: 'ram', color: AMBER }],
    },
    {
      title: 'Paging joins the hot path',
      prose:
        'The broker pages the backlog to disk to protect memory — correct, and costly: the queue process now does disk I/O inside its one sequential loop. Publish and delivery latency on <em>this</em> queue jump; other queues on the node feel the disk contention. Still no page, in most shops.',
      focus: ['depth', 'paging'],
      particles: [{ from: 'depth', to: 'paging', color: AMBER }],
    },
    {
      title: 'The watermark',
      prose:
        'Paging can&apos;t keep pace with a firehose of new publishes. Resident memory crosses <code>vm_memory_high_watermark</code>. The node raises the <b>memory alarm</b> — and broadcasts it to the whole cluster.',
      focus: ['ram', 'alarm'],
      particles: [{ from: 'ram', to: 'alarm', color: RED }],
    },
    {
      title: 'Every publisher freezes',
      prose:
        'The alarm blocks <b>all publishing connections on all nodes</b>. Payments, emails, analytics — teams that have never heard of the orders queue — every one of their publishes now <b>hangs silently</b>. One slow consumer fleet has stopped message ingress for the entire company.',
      focus: ['alarm', 'frozen'],
      particles: [{ from: 'alarm', to: 'frozen', color: RED }],
    },
    {
      title: 'The freeze walks upstream',
      prose:
        'Services publish inline — inside request handlers, inside transactions. Those calls hang, thread pools drain, health checks start failing <em>upstream</em>. The incident channel says &ldquo;the API is down&rdquo; and &ldquo;RabbitMQ is down.&rdquo; Neither is true: one queue is full, and the broker is protecting itself exactly as documented.',
      focus: ['frozen', 'upstream'],
      particles: [{ from: 'frozen', to: 'upstream', color: RED }],
    },
    {
      title: 'The lesson: read it backwards',
      prose:
        'Walk it back: hung API → blocked publishers → memory alarm → one queue&apos;s depth → yesterday&apos;s consumer deploy. The fixes are all <em>upstream of the alarm</em>: <b>alert on depth trend and consumer utilisation</b> (the two leading indicators), put <code>max-length</code> + TTL bulkheads on every queue so depth is bounded by design, give tenants per-vhost limits — and publish asynchronously, so a frozen broker degrades your features instead of hanging your threads.',
      focus: ['deploy', 'depth', 'ram', 'paging', 'alarm', 'frozen', 'upstream'],
      particles: [
        { from: 'upstream', to: 'deploy', color: VIO, via: [{ x: 76.5, y: 47 }, { x: 11.5, y: 47 }] },
        { from: 'alarm', to: 'deploy', color: VIO, via: [{ x: 76.5, y: 1.5 }, { x: 11.5, y: 1.5 }] },
      ],
    },
  ],
}
