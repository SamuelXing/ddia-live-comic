import type { MetricCard } from '../../components/MetricRunbook'
import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

const BLUE = VIZ.blue
const AMBER = VIZ.amber
const RED = VIZ.red
const GREEN = VIZ.green

/* ------------------------------------------------------------------
   The canonical S3 incident. It has the same metastable shape as the
   web tier's retry storm, with one extra twist that makes it worse
   and stranger: S3 fixes this by itself — but only if you slow down
   enough to let it.
   ------------------------------------------------------------------ */
export const cascadeTrace: TraceSpec = {
  title: 'Metric cascade — a date-prefixed key becomes a stalled pipeline',
  aspect: 0.5,
  zones: [
    { label: 'The key design', x: 2, y: 4, w: 21, h: 42 },
    { label: 'The bucket', x: 27, y: 4, w: 45, h: 42 },
    { label: 'On the pager', x: 76, y: 4, w: 22, h: 42 },
  ],
  nodes: [
    { id: 'keys', x: 4.5, y: 8, w: 16, h: 7.5, label: 'Keys start with a date', sub: '2026-08-08/…', color: AMBER },
    { id: 'today', x: 4.5, y: 21, w: 16, h: 8, label: 'One partition', sub: 'all of today, in it', color: RED },
    { id: 'clients', x: 4.5, y: 34, w: 16, h: 7.5, label: 'Writers', sub: 'retry immediately', color: BLUE },
    { id: 'slow', x: 29.5, y: 8, w: 17, h: 8, label: '503 SlowDown', sub: 'the polite refusal', color: RED },
    { id: 'noback', x: 51, y: 8, w: 18, h: 8, label: 'No backoff', sub: 'the default in old code', color: RED },
    { id: 'amplify', x: 29.5, y: 21, w: 17, h: 8, label: 'Offered load × 4', sub: 'same prefix, harder', color: RED },
    { id: 'ramp', x: 51, y: 21, w: 18, h: 8, label: 'S3 repartitions', sub: 'gradually — if allowed', color: GREEN },
    { id: 'wall', x: 37, y: 34, w: 18, h: 7.5, label: 'Job wall clock × 3', sub: 'the thing you notice', color: RED },
    { id: 'err', x: 78, y: 8, w: 18, h: 8, label: '5xx rate alert', sub: 'fires late', color: AMBER },
    { id: 'lag', x: 78, y: 21, w: 18, h: 8, label: 'Pipeline behind', sub: 'downstream starves', color: RED },
    { id: 'stuck', x: 78, y: 34, w: 18, h: 7.5, label: 'Still throttled', sub: 'you are the load now', color: RED },
  ],
  steps: [
    {
      title: 'A perfectly reasonable key naming scheme',
      prose:
        'Keys are named <code>2026-08-08/region/event-00417.json</code>. It sorts nicely, it is easy to browse, it makes lifecycle rules trivial to write. Every code review would approve it. <b>It is also the single most common way to throttle a bucket</b>, and it looks correct right up until the day the volume arrives.',
      focus: ['keys'],
    },
    {
      title: 'Every write today lands in one place',
      prose:
        'S3 partitions the index <b>by key range</b>, so keys sharing a leading string share a partition — and a date prefix means today&apos;s entire write volume targets exactly one. Yesterday&apos;s partition sits idle. <em>The bucket has enormous unused capacity and none of it is reachable</em>, which is the hot-key problem from the Partitioning comic, wearing a filename.',
      focus: ['keys', 'today'],
      particles: [{ from: 'keys', to: 'today', color: RED }],
    },
    {
      title: 'S3 asks you, politely, to slow down',
      prose:
        'Past ~3,500 writes per second on that prefix, S3 starts returning <code>503 SlowDown</code>. This is not a failure — it is a <b>backpressure signal</b>, and it is the service telling you precisely what is wrong while it begins splitting the partition. Everything from here depends on whether the client listens.',
      focus: ['today', 'slow'],
      particles: [{ from: 'today', to: 'slow', color: RED, via: [{ x: 25, y: 25 }, { x: 25, y: 12 }] }],
    },
    {
      title: 'The client does not listen',
      prose:
        'A 503 is a retryable status, so the SDK retries — and older configurations retry <b>immediately, in parallel, from every worker at once</b>. Four workers retrying a throttled request three times is twelve requests where there was one, all aimed at the same partition that just said it was full.',
      focus: ['slow', 'noback', 'clients'],
      particles: [
        { from: 'slow', to: 'noback', color: RED },
        { from: 'noback', to: 'clients', color: RED, via: [{ x: 74, y: 12 }, { x: 74, y: 45 }, { x: 25, y: 45 }] },
      ],
    },
    {
      title: 'And now the amplifier is holding the door shut',
      prose:
        'Offered load is several times real demand, all concentrated on the prefix least able to serve it. Here is the cruel part: <b>S3 was already repartitioning</b>, and repartitioning needs the load to subside enough to complete. The retries are actively preventing the fix. <em>The client is now the outage.</em>',
      focus: ['amplify', 'ramp'],
      particles: [
        { from: 'clients', to: 'amplify', color: RED },
        { from: 'amplify', to: 'ramp', color: AMBER },
      ],
    },
    {
      title: 'What you actually see is none of that',
      prose:
        'The 5xx graph moves, eventually. What gets noticed first is that <b>the job takes three times as long</b> and the pipeline behind it starves. Nobody is paged for “a prefix is hot”, because nobody graphs request rate per prefix — which is exactly the metric that moved first and the only one that names the cause.',
      focus: ['wall', 'err', 'lag'],
      particles: [
        { from: 'amplify', to: 'wall', color: RED },
        { from: 'slow', to: 'err', color: AMBER, via: [{ x: 48, y: 18.3 }, { x: 74, y: 18.3 }] },
        { from: 'ramp', to: 'lag', color: RED },
      ],
    },
    {
      title: 'The fix is to do less, and it is genuinely counter-intuitive',
      prose:
        'Exponential backoff with jitter and a lower concurrency cap will make the job finish <b>sooner</b>, because it lets the repartition complete. Then fix the cause: put a hash or a tenant id at the <em>front</em> of the key so load spreads across prefixes by construction. Read the trace backwards — the alert is four boxes right of a decision someone made in a schema review months ago, and the design that avoids all of it costs nothing extra.',
      focus: ['stuck', 'keys', 'ramp'],
      particles: [
        { from: 'wall', to: 'stuck', color: RED },
        { from: 'err', to: 'keys', color: BLUE, via: [{ x: 74, y: 2 }, { x: 25, y: 2 }] },
      ],
    },
  ],
}

/* ------------------------------------------------------------------
   The runbook. Note how much of it is about cost and about your own
   client — on a managed tier, those ARE the operational surface.
   ------------------------------------------------------------------ */
export const METRICS: MetricCard[] = [
  {
    metric: '503 SlowDown rate',
    jmx: '5xxErrors · by prefix',
    severity: 'page',
    healthy: 'Zero in steady state. A burst during a genuine ramp-up is expected and self-resolving.',
    means:
      'A prefix is over its request ceiling. S3 is <b>already splitting the partition</b> — the 503 is backpressure, not a fault, and how your client answers decides whether this lasts thirty seconds or all afternoon.',
    breaks:
      'Retries land on the same throttled prefix and prevent the repartition from completing. The workload becomes its own outage, and adding client parallelism makes it strictly worse.',
    causes: [
      'A sequential key prefix — a date, a monotonic id, a zero-padded counter',
      'A new workload ramping faster than S3 can partition for it',
      'A backfill or migration hammering one prefix that normal traffic never touches',
      'Concurrency raised to "fix" a slow job, aimed at the prefix that was already the problem',
    ],
    respond: [
      'Turn concurrency <em>down</em> and confirm exponential backoff with jitter is actually on',
      'Identify the hot prefix — this needs per-prefix request metrics, which almost nobody has until the first incident',
      'Add a hashed or high-cardinality leading path segment so keys spread by construction',
      'Ramp new workloads gradually; S3 scales for you but not instantly, and the docs say so explicitly',
    ],
    tie: 'The hot-key problem from the Partitioning comic, appearing as a filename convention.',
  },
  {
    metric: 'Request rate per prefix',
    jmx: 'derived · requests ÷ prefix',
    severity: 'page',
    healthy: 'Well under 3,500 write / 5,500 read per second on every prefix, with the distribution roughly flat.',
    means:
      'The distribution matters far more than the total. A bucket at 1% of its aggregate capacity throttles happily if 90% of that traffic shares a prefix.',
    breaks:
      'You reach the ceiling with the bucket almost entirely idle, and every capacity graph you own says you are fine.',
    causes: [
      'Key design that sorts before it distributes',
      'A tenant, region, or campaign far larger than the rest sharing a prefix',
      'Everything under one prefix because "we will shard later"',
    ],
    respond: [
      'Derive this metric from access logs or S3 Storage Lens — nothing reports it to you by default',
      'Design keys so the leading segment has high cardinality; the rest of the key can stay human-readable',
      'Prefer many prefixes to few: they are free, unlimited, and the only horizontal knob on this tier',
    ],
  },
  {
    metric: 'Client concurrency vs SDK pool',
    jmx: 'in_flight · max_pool_connections',
    severity: 'page',
    healthy: 'In-flight requests comfortably below the pool size, with the pool sized from Little’s Law.',
    means:
      'If in-flight is pinned at the pool limit, <b>you are queueing inside your own process</b> and S3 has not been asked for anything yet.',
    breaks:
      'Throughput plateaus far below every published ceiling, and the report reads "S3 is slow" while the service is idle from its own point of view.',
    causes: [
      'SDK defaults left alone — 10 connections in boto3, 50 in the Java SDK',
      'Concurrency computed from CPU count rather than from rate × latency',
      'One shared client object serialising an entire worker pool',
      'A 100 Gb/s instance running a single-threaded transfer',
    ],
    respond: [
      'Size the pool from Little&apos;s Law: rate × first-byte latency, then add margin',
      'Raise pool size and concurrency together — one without the other changes nothing',
      'Use the transfer manager (or the CRT client) rather than hand-rolling parallelism',
      'Confirm your ceiling is the service and not your own pool before adding clients',
    ],
    tie: 'Chapter 3 models this row directly — it is the one that surprises people most.',
  },
  {
    metric: 'First-byte latency p99',
    jmx: 'TotalRequestLatency · FirstByteLatency',
    severity: 'watch',
    healthy: 'Roughly 100–200 ms for small objects, stable. The floor is structural — watch the shape, not the level.',
    means:
      'A rising p99 with a flat p50 usually means throttling or retries rather than a slower service. S3&apos;s own latency is remarkably stable; yours is what moves.',
    breaks:
      'Any per-object work in a loop inherits this floor. A job doing a million sequential GETs spends most of a day waiting, and no amount of instance size fixes it — only concurrency does.',
    causes: [
      'Retries hidden inside the SDK, invisible in application timing',
      'Cross-region access paying a round trip you did not budget for',
      'Cold DNS or new TLS sessions on short-lived clients',
      'KMS encryption adding a key-service call per request',
    ],
    respond: [
      'Separate first-byte from total time — they answer different questions',
      'Cache the hot fraction at the edge; the floor is the one thing you cannot tune away',
      'Reuse clients and connections across requests instead of constructing per call',
      'For latency-critical small objects, use a different tier — this is not what S3 is for',
    ],
  },
  {
    metric: 'Incomplete multipart uploads',
    jmx: 'lifecycle · AbortIncompleteMultipartUpload',
    severity: 'watch',
    healthy: 'Zero older than a day, enforced by a lifecycle rule rather than by discipline.',
    means:
      'Parts of abandoned uploads are <b>still stored and still billed</b>, and they are invisible: they do not appear in a LIST, so the bucket looks smaller than the invoice says.',
    breaks:
      'It accumulates silently for years. The usual discovery is a cost review finding a substantial fraction of a bucket that no object accounts for.',
    causes: [
      'A client crashing or being killed mid-upload',
      'Retry logic that restarts an upload instead of resuming it',
      'Large uploads over unreliable links, failing part-way, repeatedly',
    ],
    respond: [
      'Add the AbortIncompleteMultipartUpload lifecycle rule to every bucket, today, as a default',
      'Reconcile ListMultipartUploads against storage metrics occasionally',
      'Resume rather than restart — that is what multipart is for',
    ],
  },
  {
    metric: 'Egress bytes & CDN offload',
    jmx: 'BytesDownloaded · cache hit ratio',
    severity: 'watch',
    healthy: 'Origin egress small relative to bytes served; offload ratio stable and high.',
    means:
      'Egress is usually the largest line on an S3 invoice and it is a <b>direct readout of your caching architecture</b>. A rise with flat traffic means the cache stopped working.',
    breaks:
      'Bills grow superlinearly with popularity, and the failure is financial rather than technical — which means it surfaces weeks late, in a spreadsheet.',
    causes: [
      'No CDN, or a CDN bypassed by presigned URLs or cache-busting query strings',
      'Cache-Control headers missing, so everything revalidates',
      'Cross-region or internet paths where a VPC endpoint would have been free',
      'A client re-downloading objects it already has',
    ],
    respond: [
      'Put a CDN in front of the hot fraction — it cuts requests, egress, and latency together',
      'Set Cache-Control at write time; retrofitting it means rewriting objects',
      'Use VPC gateway endpoints for in-region access and stop paying to leave the network',
      'Alert on cost per GB served, not on total spend — the ratio moves first',
    ],
  },
  {
    metric: 'LIST latency & pagination depth',
    jmx: 'ListBucket · continuation tokens',
    severity: 'watch',
    healthy: 'LIST used for administration only. Any hot path that lists is a design bug, not a tuning problem.',
    means:
      'LIST returns <b>1,000 keys per call</b> and costs a request each time. Deep pagination means something is using the bucket as a database index.',
    breaks:
      'A prefix with ten million objects needs ten thousand sequential calls to enumerate. Jobs that start with a LIST degrade steadily as data grows, long before anything alerts.',
    causes: [
      'Finding work by listing rather than by reading a manifest',
      'Directory-style traversal carried over from filesystem code',
      'A UI paginating directly against the bucket',
    ],
    respond: [
      'Keep your own index — a table of keys and metadata, written when the object is written',
      'Use S3 Inventory for bulk enumeration instead of live LIST calls',
      'Treat any LIST in a request path as a bug with a deadline',
    ],
  },
  {
    metric: '4xx rate: 403 and 404',
    jmx: '4xxErrors · by operation',
    severity: 'watch',
    healthy: 'Near zero. Both are usually your own bug, and both still cost a request.',
    means:
      '<b>403</b> means the signature or policy is wrong — clock skew, an expired presigned URL, a changed bucket policy. <b>404</b> means the key is not what the caller thinks it is, and a hot 404 path is often a cache checking for something that never exists.',
    breaks:
      'A retried 404 in a loop is a paid non-answer at full request price, and it counts against the same per-prefix ceiling as real traffic.',
    causes: [
      'Presigned URLs expiring, or client clock drift breaking SigV4',
      'A policy or access-point change nobody correlated with the error rate',
      'Existence checks used as a cache miss test',
      'A key-naming change deployed to writers before readers',
    ],
    respond: [
      'Split 403 from 404 on the dashboard — they are unrelated failures that share a shape',
      'Track negative lookups; if they dominate, keep existence in a database instead',
      'Check clock sync before debugging signatures, always',
    ],
  },
  {
    metric: 'Replication lag (CRR/SRR)',
    jmx: 'ReplicationLatency · OperationsPendingReplication',
    severity: 'watch',
    healthy: 'Pending operations near zero; latency inside whatever your recovery objective actually is.',
    means:
      'Replication is <b>asynchronous</b>. A growing backlog means the destination is behind, and objects written now do not exist there yet.',
    breaks:
      'A failover to the replica region silently loses everything still pending. The gap is the difference between what you promised and what replicated.',
    causes: [
      'A write burst outrunning replication throughput',
      'Destination bucket policy or KMS key rejecting writes',
      'Replication rules that quietly do not match the prefixes being written',
      'Objects excluded by rule and nobody noticed the rule',
    ],
    respond: [
      'Alert on pending operations, not on average latency — the backlog is the risk',
      'Use Replication Time Control when the recovery objective is contractual',
      'Verify rules actually cover the prefixes in use, on a schedule',
      'State the recovery point objective out loud; asynchronous replication always has one',
    ],
  },
]
