import type { MetricCard } from '../../components/MetricRunbook'
import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

const BLUE = VIZ.blue
const AMBER = VIZ.amber
const RED = VIZ.red

/* ------------------------------------------------------------------
   The canonical web-tier incident: a retry storm. It is the textbook
   metastable failure — the trigger stops mattering, because the
   retries alone are now more load than the tier can serve.
   ------------------------------------------------------------------ */
export const cascadeTrace: TraceSpec = {
  title: 'Metric cascade — a cache blip becomes a self-sustaining outage',
  aspect: 0.5,
  zones: [
    { label: 'Trigger', x: 2, y: 4, w: 21, h: 42 },
    { label: 'The tier', x: 27, y: 4, w: 45, h: 42 },
    { label: 'On the pager', x: 76, y: 4, w: 22, h: 42 },
  ],
  nodes: [
    { id: 'trigger', x: 4.5, y: 8, w: 16, h: 7.5, label: 'Cache node dies', sub: 'hit rate 95% → 60%', color: RED },
    { id: 'wup', x: 4.5, y: 21, w: 16, h: 8, label: 'W climbs', sub: '20 ms → 200 ms', color: RED },
    { id: 'clients', x: 4.5, y: 34, w: 16, h: 7.5, label: 'Clients', sub: 'time out, retry', color: BLUE },
    { id: 'inflight', x: 29.5, y: 8, w: 17, h: 8, label: 'In-flight × 10', sub: 'L = λ × W', color: AMBER },
    { id: 'slots', x: 51, y: 8, w: 18, h: 8, label: 'Slots exhausted', sub: 'all of them waiting', color: RED },
    { id: 'queue', x: 29.5, y: 21, w: 17, h: 8, label: 'Accept queue fills', sub: 'then drops SYNs', color: AMBER },
    { id: 'timeouts', x: 51, y: 21, w: 18, h: 8, label: 'Requests abandoned', sub: 'work done, thrown away', color: RED },
    { id: 'retries', x: 37, y: 34, w: 18, h: 7.5, label: 'Offered load × 3', sub: 'the amplifier', color: RED },
    { id: 'p99', x: 78, y: 8, w: 18, h: 8, label: 'p99 alert', sub: 'fires first, says least', color: AMBER },
    { id: 'err', x: 78, y: 21, w: 18, h: 8, label: '503s at the LB', sub: 'no healthy targets', color: RED },
    { id: 'meta', x: 78, y: 34, w: 18, h: 7.5, label: 'Still down', sub: 'trigger long gone', color: RED },
  ],
  steps: [
    {
      title: 'Something small goes wrong',
      prose:
        'A cache node is replaced, or a deploy empties every local cache at once. Hit rate falls from 95% to 60%. <b>Nothing is down.</b> No alert fires, and if one did it would be on a dashboard nobody watches — the cache is, after all, still working.',
      focus: ['trigger'],
    },
    {
      title: 'Time per request quadruples',
      prose:
        'Every miss now costs a database round trip that a hit used to skip. The handler&apos;s wall-clock goes from ~20 ms to ~200 ms. Note carefully what has <em>not</em> changed: the number of requests arriving. <b>Traffic is flat.</b>',
      focus: ['trigger', 'wup'],
      particles: [{ from: 'trigger', to: 'wup', color: RED }],
    },
    {
      title: 'Little’s Law does the rest, and it is not optional',
      prose:
        '<code>L = λ × W</code>. λ is unchanged; W is 10× — so <b>in-flight requests are 10×</b>. This is not a load problem, a code problem, or a capacity-planning mistake. It is arithmetic: the same traffic, held ten times longer, needs ten times the slots. <em>Every latency regression is secretly a capacity event.</em>',
      focus: ['wup', 'inflight'],
      particles: [{ from: 'wup', to: 'inflight', color: AMBER, via: [{ x: 25, y: 25 }, { x: 25, y: 12 }] }],
    },
    {
      title: 'Slots run out, and the queue behind them fills',
      prose:
        'Every worker is now parked on a database call. New connections pile into the accept queue, the queue reaches its limit, and the kernel starts <b>silently dropping SYNs</b>. Instances still answer health checks — the health endpoint does not touch the database — so the load balancer keeps every one of them in rotation.',
      focus: ['inflight', 'slots', 'queue'],
      particles: [
        { from: 'inflight', to: 'slots', color: RED },
        { from: 'slots', to: 'queue', color: RED },
      ],
    },
    {
      title: 'The amplifier switches on',
      prose:
        'Clients hit their timeouts and retry — and every abandoned request was <b>work the tier already performed and then discarded</b>. Offered load is now two to three times real demand, all of it competing for the same exhausted slots. Retries stacked on retries: a client that retries three times against a tier at 3× load is asking for nine times the work.',
      focus: ['queue', 'timeouts', 'clients', 'retries'],
      particles: [
        { from: 'queue', to: 'timeouts', color: RED },
        { from: 'timeouts', to: 'clients', color: RED, via: [{ x: 60, y: 45 }, { x: 25, y: 45 }] },
        { from: 'clients', to: 'retries', color: RED },
      ],
    },
    {
      title: 'And now the alerts arrive',
      prose:
        'p99 latency fires first and tells you almost nothing you can act on. Then the balancer starts returning <b>503s</b> because no target is accepting. Both symptoms are three and four hops from the cause — this is the chapter&apos;s whole argument for <em>paging on causes</em>: hit rate, slot utilization, and retry rate all moved long before either of these did.',
      focus: ['slots', 'p99', 'timeouts', 'err'],
      particles: [
        { from: 'slots', to: 'p99', color: AMBER },
        { from: 'timeouts', to: 'err', color: RED },
      ],
    },
    {
      title: 'Fix the trigger. Nothing gets better.',
      prose:
        'The cache node comes back. Hit rate recovers. <b>The outage continues</b> — because the retry load alone now exceeds what the tier can serve, and every request it fails to finish generates more. This is a <em>metastable failure</em>: the system has settled into a second stable state that sustains itself without its cause. There are only three exits, and adding capacity is the slowest of them — Chapter 2 measured why. <b>Shed load fast (429 in microseconds), cut the retry budget, then scale.</b> Read the trace backwards: the cause is five boxes to the left of the alert.',
      focus: ['meta', 'retries', 'trigger'],
      particles: [
        { from: 'retries', to: 'inflight', color: RED, via: [{ x: 25, y: 37.75 }, { x: 25, y: 12 }] },
        { from: 'retries', to: 'meta', color: RED },
        { from: 'p99', to: 'trigger', color: BLUE, via: [{ x: 74, y: 2 }, { x: 25, y: 2 }] },
      ],
    },
  ],
}

/* ------------------------------------------------------------------
   The runbook. Ordered roughly by how early the metric moves in the
   cascade above — which is the opposite of how loudly it alerts.
   ------------------------------------------------------------------ */
export const METRICS: MetricCard[] = [
  {
    metric: 'Slot utilization',
    jmx: 'in_flight ÷ workers',
    severity: 'page',
    healthy: 'Under ~70% at peak. Past 80% the queue, not the work, owns your latency.',
    means:
      'The tier is filling up — either traffic rose or <b>W rose</b>, and the metric cannot tell you which. Pair it with per-dependency latency and the answer is immediate.',
    breaks:
      'Queueing multiplies service time by <code>1 ÷ (1 − ρ)</code>. At 90% utilization a 20 ms request takes 200 ms <em>before</em> anything downstream has slowed down, which then raises W, which raises utilization.',
    causes: [
      'A downstream dependency got slower (the common case, by a wide margin)',
      'Genuine traffic growth or a spike',
      'Cache hit rate dropped, so more requests reach the slow path',
      'A deploy took instances out of rotation while traffic stayed flat',
      'Worker count was tuned down to save memory and nobody re-checked it',
    ],
    respond: [
      'Compare against per-dependency latency first — if W moved, adding instances treats a symptom',
      'Confirm cache hit rate before anything else; it is the cheapest thing to restore',
      'Add instances if traffic is genuinely up, remembering Chapter 2&apos;s 3–5 minutes of dead time',
      'Raise worker count only if memory allows — it converts a queue into concurrency, not into capacity',
      'If the spike outruns the loop, shed load deliberately rather than degrade everyone',
    ],
    tie: 'This is the fullness metric CPU pretends to be. Chapter 3 models the multiplier.',
  },
  {
    metric: 'Connection-pool checkout wait',
    jmx: 'pool.pending · pool.wait_time',
    severity: 'page',
    healthy: 'Effectively zero. Any sustained wait means the pool is the bottleneck, not the database.',
    means:
      'More slots want a connection than the pool holds. Requests are now queueing <b>before the query starts</b> — so query-time dashboards stay green while users wait.',
    breaks:
      'Checkout wait adds straight onto W for every request, which raises in-flight, which puts more slots into the same queue. It is the tightest feedback loop on this page.',
    causes: [
      'Downstream queries got slower, so each connection is held longer',
      'The fleet scaled out and every new instance opened its own pool',
      'A slow endpoint holds connections across external calls it should not',
      'Pool size copied from a template and never sized against worker count',
      'A leak — connections checked out and never returned on an error path',
    ],
    respond: [
      'Graph checkout wait next to query time; the gap between them is the whole diagnosis',
      'Cap total connections at the infrastructure level (PgBouncer) so fleet size stops multiplying them',
      'Never hold a pooled connection across an external HTTP call — release, call, re-acquire',
      'Size the pool against worker count and the downstream ceiling, not against traffic',
      'Add a checkout timeout so exhaustion fails fast instead of consuming every slot',
    ],
    tie: 'Chapter 5’s sandbox: fleet size × pool size is the number the database actually sees.',
  },
  {
    metric: 'Cache hit rate',
    jmx: 'hits ÷ (hits + misses)',
    severity: 'page',
    healthy: 'Stable. The absolute value matters far less than the fact that it does not move.',
    means:
      'A drop is a <b>multiplier on your database&apos;s traffic</b>: 95% → 60% turns 1 query per 20 requests into 1 per 2.5, an eight-fold increase with no change in user traffic at all.',
    breaks:
      'Downstream load jumps, W rises, in-flight rises, and you are at step 3 of the cascade — usually within a minute of a cache node being replaced.',
    causes: [
      'A cache node was replaced, restarted, or failed over',
      'A deploy invalidated keys or changed a serialization format',
      'TTLs expire in lockstep because nothing jitters them',
      'The working set grew past the cache and evictions started',
      'A new endpoint shipped with no caching at all',
    ],
    respond: [
      'Check evictions and node health before touching the application',
      'Add jitter to TTLs so expiry stops synchronizing across the fleet',
      'Coalesce duplicate in-flight misses for the same key (single-flight) — this alone stops most herds',
      'Warm caches before an instance enters rotation, not after',
      'Alert on the derivative, not the level: a 10-point drop in five minutes is the signal',
    ],
  },
  {
    metric: 'Accept-queue overflows',
    jmx: 'netstat -s · ListenOverflows',
    severity: 'page',
    healthy: 'Zero. This counter should never move, ever.',
    means:
      'The kernel had finished connections your process never accepted, and <b>dropped them silently</b>. Clients see a one-second stall from a TCP retransmit; your application logs nothing.',
    breaks:
      'It is invisible latency. Users experience seconds; every application-side percentile you own says the tier is healthy, because the requests it dropped were never requests as far as your code is concerned.',
    causes: [
      'Every worker is blocked, so nothing is calling accept()',
      'A stop-the-world GC pause or event-loop stall froze the process',
      'Backlog left at a small default while connection rate grew',
      'A thundering herd of reconnects after a deploy or LB failover',
    ],
    respond: [
      'Treat it as slot exhaustion until proven otherwise and look at in-flight, not at the network',
      'Raise <code>somaxconn</code> and the listen backlog — this buys time, it does not fix cause',
      'Graph it permanently; almost nobody does, and it is the only honest witness to dropped work',
      'Stagger reconnects with jitter so deploys stop producing herds',
    ],
  },
  {
    metric: 'Retry rate / request amplification',
    jmx: 'offered ÷ useful requests',
    severity: 'page',
    healthy: 'Near 1.0. Anything sustained above ~1.2 means the tier is doing work twice.',
    means:
      'Clients are abandoning and re-sending. Every retry is <b>work already performed and discarded</b>, and it arrives exactly when the tier can least afford it.',
    breaks:
      'This is the term that makes the failure metastable. Past the point where retries alone exceed capacity, removing the original trigger changes nothing.',
    causes: [
      'Timeouts set tighter than the current p99, so healthy-but-slow requests get abandoned',
      'Retries without exponential backoff or jitter',
      'Retries at several layers at once — client, SDK, gateway, service mesh — multiplying',
      'A dependency degraded and every caller reacted identically at the same instant',
    ],
    respond: [
      'Budget retries globally (a token bucket), not per-call — a per-call policy has no idea what the fleet is doing',
      'Backoff with jitter, always; synchronized retries are a self-inflicted DDoS',
      'Shed load fast: a 429 returned in microseconds costs nothing and protects everyone still queued',
      'Make retries safe to drop — idempotency keys let you fail fast without correctness risk',
      'Pick exactly one layer to retry in and turn it off everywhere else',
    ],
    tie: 'The amplifier in Chapter 6’s cascade, and the reason the cache coming back does not help.',
  },
  {
    metric: 'CPU utilization',
    jmx: 'node_cpu · container_cpu',
    severity: 'watch',
    healthy: 'Whatever it normally is. The number matters far less than its relationship to slot utilization.',
    means:
      'On an I/O-bound tier, almost nothing on its own. <b>CPU can fall while the tier saturates</b>, because blocked threads burn no cycles — the classic trap, and the reason autoscaling on CPU alone is a known-bad default.',
    breaks:
      'An autoscaler steering on CPU sees the drop and <em>removes</em> instances during an incident. Slack&apos;s January 2021 postmortem records exactly this: falling CPU “initially triggered some automated downscaling.”',
    causes: [
      'Threads waiting on a slow dependency instead of computing',
      'A genuinely CPU-bound endpoint (serialization, compression, crypto) — the rarer, easier case',
      'Garbage collection, which shows as CPU but behaves like an outage',
      'Noisy neighbours or CPU-quota throttling on a shared host',
    ],
    respond: [
      'Autoscale on in-flight requests or queue depth; use CPU only as a secondary signal',
      'Graph CPU and slot utilization on the same axes so the divergence is visible at a glance',
      'Check throttling counters before believing a low CPU number on a container',
      'If CPU really is the binding resource, say so out loud — it means scale-out is honest and linear',
    ],
  },
  {
    metric: 'GC pause / event-loop lag',
    jmx: 'gc.pause.p99 · loop_lag',
    severity: 'watch',
    healthy: 'Pauses well under your latency budget; loop lag in single-digit milliseconds.',
    means:
      'The process stopped serving. Every slot is frozen for the duration, and the accept queue keeps filling the entire time.',
    breaks:
      'A 500 ms pause on an instance taking 300 req/s strands 150 requests. On an event-loop runtime, <b>one synchronous call blocks every concurrent request in the process</b>, not just its own.',
    causes: [
      'Heap growth from a slow leak or an unbounded cache',
      'Large allocations per request (whole result sets materialized in memory)',
      'A synchronous file, crypto, or compression call inside an async handler',
      'Heap sized close to the container memory limit',
    ],
    respond: [
      'Cap in-memory caches and any per-request buffers with real bounds',
      'Move CPU-heavy work off the loop — a worker pool, or a different service',
      'Size the heap with room under the container limit so the OOM killer never participates',
      'Track pause time as a share of wall clock; above ~1% it belongs in your latency budget',
    ],
  },
  {
    metric: 'Instances: desired vs in-service',
    jmx: 'asg.desired · asg.healthy',
    severity: 'watch',
    healthy: 'The two track each other, and neither is near the group maximum.',
    means:
      'A persistent gap means instances are being launched but not becoming useful — the boot, warm-up, or health-check stage is failing or slow.',
    breaks:
      '<b>Broken instances still count against the group maximum.</b> Slack launched 1,200 instances in fourteen minutes, most of which never provisioned, and then hit its configured ceiling with no capacity to show for it.',
    causes: [
      'The provisioning path depends on the same infrastructure that is currently degraded',
      'Resource limits in the provisioning service itself — file descriptors, quotas, API rate limits',
      'Health checks that pass before the instance is genuinely ready, or fail because a dependency is down',
      'Account or group quotas nobody has re-checked since the fleet was half this size',
    ],
    respond: [
      'Alert on the gap, not on either number by itself',
      'Keep the launch path independent of the serving path wherever you can afford to',
      'Review group maxima and account quotas against your worst realistic scale-out, in advance',
      'Pre-scale for known events — dead time makes reactive scaling the wrong tool for a predictable spike',
    ],
    tie: 'The dead time measured in Chapter 2 is what this metric is really reporting.',
  },
  {
    metric: 'Upstream 5xx at the balancer',
    jmx: 'lb.5xx by code',
    severity: 'page',
    healthy: 'Zero sustained. Distinguish the codes — they name different failures.',
    means:
      '<b>502</b>: the instance answered with garbage or closed early. <b>503</b>: the balancer had no healthy target to send to. <b>504</b>: the instance took longer than the balancer&apos;s timeout. Three very different stories.',
    breaks:
      'By the time this alert fires the tier has been degraded for minutes. It is the last symptom in the cascade and the first one most teams page on.',
    causes: [
      'All targets failing health checks at once — usually a shared dependency, not the instances',
      'Deploy removing capacity faster than replacements pass health checks',
      'Balancer timeout set below the application&apos;s p99 under load',
      'The process crashing and restarting under memory pressure',
    ],
    respond: [
      'Read the code breakdown first; 502, 503 and 504 send you to three different places',
      'Check whether health checks actually exercise dependencies — a shallow check hides exactly this',
      'Verify the balancer timeout exceeds your real p99, not your intended p99',
      'During deploys, confirm surge capacity is in rotation before old instances are drained',
    ],
  },
]
