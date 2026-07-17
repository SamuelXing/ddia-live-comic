import type { ModuleDef, Values, ComputeResult } from '../types'
import { fmt } from '../format'

function compute(v: Values): ComputeResult {
  const latS = v.lat / 1000
  const inflight = v.rps * latS // Little's law
  const capPerInst = v.workers / latS // req/s one instance can serve
  const instances = Math.max(1, Math.ceil(v.rps / capPerInst))
  const totalConns = instances * v.pool
  const utilPerInst = (v.rps / instances / capPerInst) * 100

  // DB connection fan-out is the classic hidden wall (~a few hundred backends max on PG)
  const connPct = (totalConns / 400) * 100

  const meters = [
    {
      label: "Requests in flight (Little's Law)",
      valTxt: fmt.compact(inflight),
      pct: (inflight / (instances * v.workers)) * 100,
      detail: `L = ${fmt.compact(v.rps)} req/s × ${v.lat} ms = ${fmt.compact(inflight)} concurrent. Fleet supplies ${fmt.compact(instances * v.workers)} worker slots.`,
    },
    {
      label: 'Per-instance utilization',
      valTxt: Math.round(utilPerInst) + '%',
      pct: utilPerInst,
      detail: `Each instance serves ~${fmt.compact(v.rps / instances)} req/s of its ${fmt.compact(capPerInst)} req/s ceiling. Keep peak under ~75% for headroom.`,
    },
    {
      label: 'DB connection fan-out',
      valTxt: fmt.int(totalConns) + ' conns',
      pct: connPct,
      detail: `${instances} instances × ${v.pool} pool = ${fmt.int(totalConns)} connections hitting the database. Postgres struggles past a few hundred — see the Postgres tab.`,
    },
  ]

  let verdict: ComputeResult['verdict']
  if (connPct >= 100)
    verdict = {
      s: 'crit',
      t: `<b>The web tier is fine — the database isn't.</b> Cloning ${instances} instances opens <b>${fmt.int(totalConns)} DB connections</b>. This is the #1 way a "scalable" web tier takes down its database. Put a connection pooler (PgBouncer) in front and cap the fan-out.`,
    }
  else if (instances >= 1 && utilPerInst > 90)
    verdict = {
      s: 'warn',
      t: `<b>Running hot.</b> Instances are above 90% utilization — a traffic spike or one slow dependency will tip you into a queue-and-timeout cascade. Add instances or raise worker count for headroom.`,
    }
  else
    verdict = {
      s: 'good',
      t: `<b>Healthy.</b> ${instances} instance${instances > 1 ? 's' : ''} carry the load with headroom, and connection fan-out is safe. This tier scales out linearly from here — until the shared tier behind it becomes the limit.`,
    }

  return {
    tiles: [
      { k: 'Instances needed', v: fmt.int(instances), u: 'stateless clones' },
      { k: 'Capacity / instance', v: fmt.compact(capPerInst), u: 'req/s' },
      { k: 'In-flight requests', v: fmt.compact(inflight), u: 'concurrent' },
      { k: 'DB connections', v: fmt.int(totalConns), u: 'to the database' },
    ],
    meters,
    verdict,
  }
}

export const webModule: ModuleDef = {
  key: 'web',
  tab: 'Web tier',
  emoji: '🖥️',
  title: 'The web / application tier',
  kicker: 'Stateless compute',
  lede: `The easiest tier to scale — and the one that lulls you into a false sense of security. If your app servers hold <b>no local state</b>, you scale out by cloning them behind a load balancer, almost linearly, forever. The catch: they all lean on <b>shared things behind them</b> (a database, a cache), and that's where cloning the web tier quietly turns into a stampede.`,
  content: {
    intro: `<p>An app server is a box that turns requests into responses. The core scaling law is <b>Little's Law</b>: the average number of requests in flight equals arrival rate × time-in-system, or <code>L = λ × W</code>. If you serve 10,000 req/s and each takes 200 ms, you have <code>10000 × 0.2 = 2,000</code> requests in flight at any instant. Your fleet must have at least that many workers (threads, goroutines, event-loop slots) or requests queue and latency explodes.</p>
  <p>That gives the two ways to grow. <b>Scale up</b>: a bigger box runs more workers and more CPU, so one instance absorbs more concurrency. <b>Scale out</b>: add identical instances behind the load balancer. Because the work is stateless, scale-out is near-linear — double the instances, double the capacity — which is why the web tier is the textbook case for horizontal scaling.</p>
  <p>The <b>statelessness rule</b> is what makes it work: no request may depend on which instance served the last one. That means <em>no</em> in-memory sessions (push them to Redis/JWT), no local file uploads (push to S3), no sticky in-process caches you can't tolerate being cold. Break this rule and you need sticky sessions, which pins users to instances and destroys even load-balancing and clean autoscaling.</p>`,
    inputs: [
      { id: 'rps', label: 'Peak requests / sec', min: 100, max: 200000, step: 100, val: 12000, hint: 'Traffic at your busiest moment — always size for peak, not average.', fmt: (v) => fmt.compact(v) + ' req/s' },
      { id: 'lat', label: 'Avg time per request', min: 5, max: 2000, step: 5, val: 180, hint: 'Wall-clock per request, including waiting on the DB/downstream calls.', fmt: (v) => v + ' ms' },
      { id: 'workers', label: 'Workers per instance', min: 1, max: 1024, step: 1, val: 64, hint: 'Concurrent requests one instance handles (threads / async slots).', fmt: (v) => fmt.int(v) },
      { id: 'pool', label: 'DB connections / instance', min: 1, max: 100, step: 1, val: 20, hint: "Size of each instance's DB connection pool — this is the sneaky one.", fmt: (v) => fmt.int(v) },
    ],
    compute,
    limits: [
      ['Per-instance concurrency', '= workers ÷ per-request time', "A box with 64 workers and 200 ms requests tops out near 320 req/s regardless of CPU if it's I/O-bound."],
      ['Load balancer', '~100k–1M+ conns', 'Managed L7 balancers (ALB/Envoy/nginx) scale far past app tiers; rarely your bottleneck, but watch connection & TLS-handshake limits.'],
      ['Ephemeral ports', '~28k–64k per src IP', 'A single instance making many outbound calls to one destination can exhaust source ports — reuse connections / keep-alive.'],
      ['Autoscaling reaction', '~1–5 min', 'Instances take time to boot & warm. Spikes faster than this need pre-scaling, request queuing, or over-provisioning.'],
      ['Statelessness', 'Hard requirement', 'Any local session/cache/file breaks clean horizontal scaling and forces sticky sessions.'],
    ],
    fails: [
      ['Thundering herd on cold cache', 'A deploy or cache flush sends every instance to the database at once. Mitigate with request coalescing, staggered warmup, and jittered TTLs.'],
      ['Retry storms', 'A slow dependency makes clients retry, multiplying load exactly when the system is weakest. Use exponential backoff + jitter and circuit breakers.'],
      ['Connection pool exhaustion', 'Each cloned instance opens its own DB pool; scale out far enough and you DDoS your own database. Front it with a pooler.'],
      ['Sticky-session trap', 'In-memory sessions force the LB to pin users to instances, causing uneven load and breaking autoscaling. Externalize session state.'],
      ['Slow-dependency head-of-line blocking', 'One slow downstream call ties up workers, so unrelated requests queue behind it. Use timeouts, bulkheads, and separate pools.'],
    ],
    ladder: [
      '<b>Scale up first</b> for simplicity — a bigger instance buys headroom with zero architectural change.',
      '<b>Go stateless</b> — move sessions to Redis/JWT, uploads to S3 — so instances are interchangeable.',
      '<b>Scale out</b> behind a load balancer with health checks; this is near-linear and where you live long-term.',
      '<b>Autoscale</b> on a leading signal (RPS, queue depth, CPU) with headroom for boot time.',
      '<b>Protect the shared tier</b> — pool DB connections, cache reads, add backpressure — because that, not the web tier, is your real ceiling.',
    ],
  },
}
