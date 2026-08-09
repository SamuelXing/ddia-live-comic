import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* Colors: client & fleet blue, tier machinery amber, cache green,
   database violet, object storage cyan, danger red. */
const C = {
  client: VIZ.blue,
  tier: VIZ.amber,
  cache: VIZ.green,
  db: VIZ.violet,
  blob: VIZ.cyan,
  hot: VIZ.red,
}

/* ------------------------------------------------------------------
   Trace 1 — one request, end to end. The point of this walk is that
   almost none of it is your code: it is four queues and a wait.
   ------------------------------------------------------------------ */
export const requestTrace: TraceSpec = {
  title: 'Trace one request — from TLS handshake to the byte on the wire',
  aspect: 0.5,
  zones: [
    { label: 'Client & edge', x: 2, y: 4, w: 21, h: 42 },
    { label: 'One app instance', x: 27, y: 4, w: 45, h: 42 },
    { label: 'Shared tier', x: 76, y: 4, w: 22, h: 42 },
  ],
  nodes: [
    { id: 'client', x: 4.5, y: 11, w: 16, h: 8, label: 'Browser / mobile', sub: 'one HTTP request', color: C.client },
    { id: 'lb', x: 4.5, y: 28, w: 16, h: 8, label: 'Load balancer', sub: 'TLS · least-loaded', color: C.client },
    { id: 'accept', x: 29.5, y: 8, w: 17, h: 8, label: 'Accept queue', sub: 'the kernel backlog', color: C.tier },
    { id: 'worker', x: 51, y: 8, w: 18, h: 8, label: 'Worker slot', sub: 'one of N', color: C.tier },
    { id: 'handler', x: 29.5, y: 21, w: 17, h: 8, label: 'Your handler', sub: 'mostly waiting', color: C.tier },
    { id: 'pool', x: 51, y: 21, w: 18, h: 8, label: 'Connection pool', sub: 'checkout · then wait', color: C.tier },
    { id: 'render', x: 37, y: 34, w: 18, h: 7.5, label: 'Serialize', sub: 'JSON · template', color: C.tier },
    { id: 'cache', x: 78, y: 8, w: 18, h: 8, label: 'Cache', sub: 'a hit ends the story', color: C.cache },
    { id: 'db', x: 78, y: 21, w: 18, h: 9, label: 'Database', sub: 'one writable primary', color: C.db },
    { id: 'blob', x: 78, y: 34, w: 18, h: 7.5, label: 'Object storage', sub: 'sessions, uploads', color: C.blob },
  ],
  steps: [
    {
      title: 'None of this is your application yet',
      prose:
        'DNS resolves to an anycast address, a TCP connection opens, TLS negotiates — and only then does a <b>load balancer</b> choose which instance gets the request. The choice matters more than it looks: round-robin sends the same share to a sick instance as a healthy one, while <b>least-outstanding-requests</b> notices that one target is holding more work than the others and stops feeding it. It is the cheapest failure detector in the stack, and it is free.',
      focus: ['client', 'lb'],
      particles: [{ from: 'client', to: 'lb', color: C.client }],
    },
    {
      title: 'The queue you did not know you had',
      prose:
        'The kernel completes handshakes on your behalf and parks finished connections in the <b>accept queue</b> until your process calls <code>accept()</code>. That queue is finite — <code>min(backlog, somaxconn)</code>. When it fills, the kernel does not return an error; it <b>silently drops the SYN</b>. The client waits out a TCP retransmit timer and tries again a second later. Your application logs nothing at all, because from its point of view the request never existed.',
      focus: ['lb', 'accept'],
      particles: [{ from: 'lb', to: 'accept', color: C.client, via: [{ x: 25, y: 32 }, { x: 25, y: 12 }] }],
    },
    {
      title: 'A server is not fast — it has N slots',
      prose:
        'The request now occupies a <b>worker slot</b>: a thread, a goroutine, an event-loop continuation. Whatever the runtime calls it, the arithmetic is identical — a box with <code>N</code> slots serving requests that each take <code>W</code> seconds tops out at <code>N ÷ W</code> requests per second. 64 slots and 200 ms gives 320 req/s, on any hardware. <em>The runtime choice changes what a slot costs in memory, not how many you need.</em>',
      focus: ['accept', 'worker'],
      particles: [{ from: 'accept', to: 'worker', color: C.tier }],
    },
    {
      title: 'Your code runs — briefly',
      prose:
        'Route match, deserialize, validate, and then the handler does what handlers overwhelmingly do: <b>it waits</b>. A typical request burns single-digit milliseconds of CPU and spends the rest blocked on something else. This is why <code>CPU utilization</code> is such a poor fullness gauge for this tier — a box can be 100% full of requests and 20% busy, and the two numbers move independently.',
      focus: ['worker', 'handler'],
      particles: [{ from: 'worker', to: 'handler', color: C.tier }],
    },
    {
      title: 'The cache is a transfer function',
      prose:
        'A cache lookup is the fork in the road: on a hit, <b>the shared tier never hears about this request at all</b>. That makes hit rate the conversion factor between your traffic and your database&apos;s traffic — at 95% it takes 20 requests to produce one query; at 60% it takes 2.5. A cache is not a speed-up you bolt on, it is <em>the term that decides how big everything behind it has to be</em> — which is exactly why losing one is Chapter 6&apos;s root cause.',
      focus: ['handler', 'cache'],
      particles: [{ from: 'handler', to: 'cache', color: C.cache, via: [{ x: 48, y: 18.3 }, { x: 74, y: 18.3 }] }],
    },
    {
      title: 'Checkout wait — the most under-instrumented number here',
      prose:
        'On a miss the handler borrows a connection from the <b>pool</b>. Pools are small on purpose, because the database spends real resources per connection — so when every slot wants one at once, requests queue <em>before</em> the query starts. Nearly every team graphs query time and almost none graph <b>time spent waiting for a connection</b>, which is why the usual incident report says “the database got slow” when the database was idle.',
      focus: ['handler', 'pool'],
      particles: [
        { from: 'handler', to: 'pool', color: C.tier },
        { from: 'pool', to: 'db', color: C.db },
      ],
    },
    {
      title: 'Statelessness is a purchase, not a property',
      prose:
        'The response is assembled and anything that must outlive the request is pushed elsewhere: <b>session to Redis or a signed token, uploads to object storage, local caches strictly disposable</b>. That is the whole discipline. Keep one thing on local disk or in process memory that a user needs again and you have bought sticky sessions — which pins users to instances, unbalances the fleet, and makes both autoscaling and rolling deploys lossy.',
      focus: ['render', 'blob'],
      particles: [{ from: 'render', to: 'blob', color: C.blob }],
    },
    {
      title: 'And back — in about 23 milliseconds',
      prose:
        'Bytes stream back through the balancer, and the connection is <b>kept alive</b> so the next request skips the first two steps entirely. Now count what actually happened: a handshake, two queues, a cache lookup, one query, and a few milliseconds of CPU. Stack Overflow&apos;s published average for rendering a question page is <b>22.71 ms</b> — and Chapter 7 shows what that one number does to the size of their fleet.',
      focus: ['render', 'lb', 'client'],
      particles: [
        { from: 'render', to: 'lb', color: C.client, via: [{ x: 25, y: 44 }] },
        { from: 'lb', to: 'client', color: C.client },
      ],
    },
  ],
}

/* ------------------------------------------------------------------
   Trace 2 — the autoscaler as a control loop with dead time. This is
   the tier's strangest mechanism: the correction always arrives late,
   and the correcting instance is the slowest one in the fleet.
   ------------------------------------------------------------------ */
export const autoscaleTrace: TraceSpec = {
  title: 'Trace a scale-out — every step is dead time',
  aspect: 0.5,
  zones: [
    { label: 'Demand', x: 2, y: 4, w: 21, h: 42 },
    { label: 'The control loop', x: 27, y: 4, w: 45, h: 42 },
    { label: 'New capacity', x: 76, y: 4, w: 22, h: 42 },
  ],
  nodes: [
    { id: 'spike', x: 4.5, y: 11, w: 16, h: 8, label: 'Traffic doubles', sub: 'in 60 seconds', color: C.hot },
    { id: 'fleet', x: 4.5, y: 28, w: 16, h: 8, label: 'Running fleet', sub: 'slots already full', color: C.client },
    { id: 'metric', x: 29.5, y: 8, w: 17, h: 8, label: 'Metric scrape', sub: '15–60 s stale', color: C.tier },
    { id: 'alarm', x: 51, y: 8, w: 18, h: 8, label: 'Alarm evaluation', sub: 'n periods to breach', color: C.tier },
    { id: 'api', x: 51, y: 21, w: 18, h: 8, label: 'Scaling API', sub: 'returns instantly', color: C.tier },
    { id: 'boot', x: 29.5, y: 21, w: 17, h: 8, label: 'Boot & init', sub: 'image, then config', color: C.tier },
    { id: 'warm', x: 37, y: 34, w: 18, h: 7.5, label: 'Warm-up', sub: 'cold JIT, empty pools', color: C.hot },
    { id: 'hc', x: 78, y: 11, w: 18, h: 8, label: 'Health check', sub: '2 passes × 15 s', color: C.cache },
    { id: 'serving', x: 78, y: 28, w: 18, h: 8, label: 'In rotation', sub: '3–5 min after the spike', color: C.cache },
  ],
  steps: [
    {
      title: 'The spike arrives before anything knows',
      prose:
        'Load doubles. Nothing has failed, no threshold has been crossed, and the fleet is already at its slot ceiling — so <code>W</code> starts climbing from queueing alone. <b>The system is degrading during the entire interval in which it is still deciding whether to react.</b>',
      focus: ['spike', 'fleet'],
      particles: [{ from: 'spike', to: 'fleet', color: C.hot }],
    },
    {
      title: 'The signal is stale — and may point the wrong way',
      prose:
        'Metrics are scraped every 15–60 s, so the autoscaler is steering by a photograph of a fleet that no longer exists. Worse, the usual signal lies: on an I/O-bound tier, saturation makes threads <em>wait</em> more, so <b>CPU utilization falls as the tier gets worse</b>. This is not hypothetical — in Slack&apos;s January 2021 outage, exactly that drop “initially triggered some automated downscaling.”',
      focus: ['fleet', 'metric'],
      particles: [{ from: 'fleet', to: 'metric', color: C.tier, via: [{ x: 25, y: 32 }, { x: 25, y: 12 }] }],
    },
    {
      title: 'Alarms are slow on purpose',
      prose:
        'A scaling alarm waits for <code>n</code> consecutive periods before it fires, so a one-minute alarm needs two to three minutes to believe what it is seeing. That hysteresis is correct — without it, every noisy minute would resize the fleet — but it is <b>dead time you cannot tune away</b>, only budget for.',
      focus: ['metric', 'alarm'],
      particles: [{ from: 'metric', to: 'alarm', color: C.tier }],
    },
    {
      title: 'A launch is not capacity',
      prose:
        'The API call returns in milliseconds and has bought you <em>nothing</em> yet. It has also just entered the region where the two real ceilings live: the group&apos;s <b>maximum size</b>, and the account quotas underneath it. Both count instances that exist, not instances that work — Slack hit its group limit while most of the 1,200 instances it had launched were still unusable.',
      focus: ['alarm', 'api'],
      particles: [{ from: 'alarm', to: 'api', color: C.tier }],
    },
    {
      title: 'Boot, and the cold-start tax',
      prose:
        'Image pull, runtime start, configuration fetch, service discovery, dependency connections. Thirty to ninety seconds when someone has worked on it; several minutes when nobody has. Note what this step depends on: <b>the provisioning path runs over the same infrastructure that is currently in trouble</b>, which is precisely how Slack&apos;s provisioning service ran out of file descriptors mid-incident.',
      focus: ['api', 'boot'],
      particles: [{ from: 'api', to: 'boot', color: C.tier }],
    },
    {
      title: 'The new instance is the slowest in the fleet',
      prose:
        'It boots with a cold JIT, empty local caches, and an unfilled connection pool — so its first requests are the worst requests anyone is serving. And a least-outstanding-requests balancer, seeing an instance holding no work, <b>sends it a disproportionate share immediately</b>. The algorithm that protects you from a sick instance actively favours a cold one.',
      focus: ['boot', 'warm'],
      particles: [{ from: 'boot', to: 'warm', color: C.hot }],
    },
    {
      title: 'Three to five minutes later, the correction lands',
      prose:
        'Add it up: stale scrape, alarm hysteresis, boot, warm-up, two passing health checks. <b>Every term is dead time, and dead time is what makes a control loop oscillate</b> — a late correction, applied at full gain, based on a stale reading, overshoots and then reverses. Which gives the three rules of this chapter: scale on a <em>leading</em> signal, hold headroom equal to dead time × growth rate, and when the spike is faster than the loop, <b>shed load instead of chasing it</b>.',
      focus: ['warm', 'hc', 'serving'],
      particles: [
        { from: 'warm', to: 'hc', color: C.cache, via: [{ x: 74, y: 38 }] },
        { from: 'hc', to: 'serving', color: C.cache },
        { from: 'serving', to: 'fleet', color: C.client, via: [{ x: 74, y: 46 }, { x: 25, y: 46 }] },
      ],
    },
  ],
}

/* ------------------------------------------------------------------
   Trace 3 (ch.7) — Stack Overflow's published fleet, walked as a
   topology. Every number here is from the 2016 architecture post's
   day-of counters; the ratios are arithmetic on those counters.
   ------------------------------------------------------------------ */
export const fleetTrace: TraceSpec = {
  title: 'A whole Q&A site on nine web servers — the numbers, walked',
  aspect: 0.5,
  zones: [
    { label: 'The internet', x: 2, y: 4, w: 21, h: 42 },
    { label: 'Web tier — 9 servers', x: 27, y: 4, w: 45, h: 42 },
    { label: 'Behind it', x: 76, y: 4, w: 22, h: 42 },
  ],
  nodes: [
    { id: 'users', x: 4.5, y: 11, w: 16, h: 8, label: '66M page loads', sub: 'in one day', color: C.client },
    { id: 'ha', x: 4.5, y: 28, w: 16, h: 8, label: '4 × HAProxy', sub: '209M requests/day', color: C.client },
    { id: 'web', x: 29.5, y: 8, w: 17, h: 8, label: '9 web servers', sub: 'IIS · ASP.NET MVC', color: C.tier },
    { id: 'render', x: 51, y: 8, w: 18, h: 8, label: '22.7 ms', sub: 'avg question render', color: C.tier },
    { id: 'inflight', x: 29.5, y: 21, w: 17, h: 8, label: '≈ 6 in flight', sub: 'per server', color: C.tier },
    { id: 'egress', x: 51, y: 21, w: 18, h: 8, label: '1.24 TB/day', sub: '≈ 115 Mbps average', color: C.tier },
    { id: 'rate', x: 37, y: 34, w: 18, h: 7.5, label: '2,400 req/s', sub: 'averaged over the day', color: C.tier },
    { id: 'sql', x: 78, y: 8, w: 18, h: 8, label: '4 × SQL Server', sub: '2.4 queries / request', color: C.db },
    { id: 'redis', x: 78, y: 21, w: 18, h: 9, label: '2 × Redis', sub: '28 hits / request', color: C.cache },
    { id: 'law', x: 78, y: 34, w: 18, h: 7.5, label: 'Fleet = λ × W', sub: 'not λ alone', color: C.hot },
  ],
  steps: [
    {
      title: 'The traffic is real',
      prose:
        '209,420,973 HTTP requests and 66,294,789 page loads in a single day — about <b>2,400 requests per second averaged</b>, with peaks several times that. Four HAProxy load balancers terminate it. This is a top-50 site by traffic, not a demo.',
      focus: ['users', 'ha'],
      particles: [{ from: 'users', to: 'ha', color: C.client }],
    },
    {
      title: 'Nine servers',
      prose:
        'Eleven IIS web servers, of which <b>nine serve production</b> and two run dev and Meta. That is the entire application tier for the whole network. Nothing exotic is happening here — the interesting question is what makes nine enough, and the answer is on the next node.',
      focus: ['ha', 'web'],
      particles: [{ from: 'ha', to: 'web', color: C.client, via: [{ x: 25, y: 32 }, { x: 25, y: 12 }] }],
    },
    {
      title: 'W = 22.7 milliseconds',
      prose:
        'The published average for rendering a question page is <b>22.71 ms</b> — 19.12 ms of it inside ASP.NET — across 49 million renders that day. Home page: 11.80 ms. These are not caching tricks in front of a slow app; the application itself is genuinely that quick, which is the design decision the whole fleet size rests on.',
      focus: ['web', 'render'],
      particles: [{ from: 'web', to: 'render', color: C.tier }],
    },
    {
      title: 'So the fleet holds about six requests at a time. Each.',
      prose:
        'Little&apos;s Law, applied to the published numbers: <code>L = 2,400/s × 0.023 s ≈ 55</code> requests in flight <em>across the whole tier</em> — roughly <b>six per server</b>. Nine boxes are not nine boxes&apos; worth of capacity being consumed; they are mostly there for redundancy, deploys, and peak. <em>Fleet size is set by W, and Stack Overflow bought theirs by making W tiny.</em>',
      focus: ['web', 'inflight', 'rate'],
      particles: [
        { from: 'web', to: 'inflight', color: C.tier },
        { from: 'inflight', to: 'rate', color: C.tier },
      ],
    },
    {
      title: 'The bandwidth is almost embarrassing',
      prose:
        '1.24 TB of HTTP traffic sent that day is about <b>115 Mbps on average</b> — a fraction of one server&apos;s NIC. For an HTML-and-JSON workload the network is nowhere near the binding resource, which is exactly the envelope shape Chapter 3 predicts: slots and CPU bind long before bytes do.',
      focus: ['inflight', 'egress'],
      particles: [{ from: 'inflight', to: 'egress', color: C.tier }],
    },
    {
      title: 'The work went somewhere — it went behind the tier',
      prose:
        '504,816,843 SQL queries and 5,831,683,114 Redis hits in the same day: <b>2.4 queries and 28 cache operations per HTTP request</b>. The stateless tier stayed small precisely because the stateful tiers absorbed the work — four SQL Servers and two Redis boxes doing 67,000 operations a second. <em>Read it as the through-line of this whole site: cloning the easy tier is never the interesting part.</em>',
      focus: ['render', 'sql', 'redis', 'law'],
      particles: [
        { from: 'render', to: 'sql', color: C.db },
        { from: 'egress', to: 'redis', color: C.cache },
        { from: 'rate', to: 'law', color: C.hot },
      ],
    },
  ],
}
