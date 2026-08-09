import type { ComputeResult, InputDef, Values } from '../types'
import { fmt } from '../format'
import { LAD } from '../ladder'
import { queueMultiplier } from '../latencyModel'

/* The scale-out sandbox. The web tier scales linearly — that part is
   uninteresting and always works. What the sliders are really for is the
   two things that scale with it and should not: the connection count the
   shared tier sees, and the capacity a rolling deploy removes. */

const DEPLOY_SURGE = 0.25 // fraction of the fleet out of rotation mid-deploy
/* Target utilization gets its own ladder rather than LAD.pct, because LAD.pct
   starts at 0 and "plan to use 0% of the box" divides the fleet size by zero.
   compute() clamps too — it is exported, so it has to survive being called
   with values no slider can produce. */
const UTIL_LADDER = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
const MIN_UTIL = 5

export const scaleOutInputs: InputDef[] = [
  { id: 'rps', label: 'Peak requests / sec', steps: LAD.rate, val: 2e4, hint: 'Traffic at the busiest minute — always size for peak, never for average.', fmt: (v) => fmt.compact(v) + '/s' },
  { id: 'lat', label: 'Time per request (W)', steps: LAD.ms, val: 200, hint: 'Wall clock per request including every downstream wait. The highest-leverage number on this page.', fmt: (v) => v + ' ms' },
  { id: 'workers', label: 'Workers per instance', steps: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024], val: 64, hint: 'Concurrent slots one instance can hold: threads, goroutines, async continuations.', fmt: (v) => fmt.int(v) },
  { id: 'target', label: 'Target slot utilization', steps: UTIL_LADDER, val: 70, hint: 'How full you plan to run. Above ~80% the queue, not the work, decides your latency.', fmt: (v) => v + '%' },
  { id: 'pool', label: 'Pool size per instance', steps: [1, 2, 5, 10, 20, 50, 100], val: 20, hint: 'Outbound connections each instance opens to the shared tier — the number that multiplies.', fmt: (v) => fmt.int(v) },
  { id: 'dbceil', label: 'What the shared tier can hold', steps: LAD.conns, val: 500, hint: 'Connections the database tolerates before it spends more time context-switching than querying.', fmt: (v) => fmt.int(v) + ' conns' },
]

export function computeScaleOut(v: Values): ComputeResult {
  const target = Math.min(100, Math.max(MIN_UTIL, v.target))
  const latS = v.lat / 1000
  const fullCap = v.workers / latS // req/s at 100% slots
  const capPerInst = fullCap * (target / 100) // req/s at the utilization you planned for
  const instances = Math.max(1, Math.ceil(v.rps / capPerInst))

  const inflight = v.rps * latS
  const slotUtil = (inflight / (instances * v.workers)) * 100
  const mult = queueMultiplier(slotUtil)
  const effLat = v.lat * mult

  const totalConns = instances * v.pool
  const connPct = (totalConns / v.dbceil) * 100
  const poolRatio = Math.max(1, Math.round(totalConns / Math.max(1, v.dbceil)))

  const deployUtil = (v.rps / (instances * (1 - DEPLOY_SURGE) * fullCap)) * 100
  const halfInstances = Math.max(1, Math.ceil(v.rps / (capPerInst * 2)))

  const meters = [
    {
      label: 'Fleet slot utilization',
      valTxt: Math.round(slotUtil) + '%',
      pct: slotUtil,
      detail: `${fmt.compact(v.rps)}/s × ${v.lat} ms = ${fmt.sig(inflight)} requests in flight, spread over ${fmt.int(instances)} × ${fmt.int(v.workers)} = ${fmt.int(instances * v.workers)} slots. This — not CPU — is how full the tier is.`,
    },
    {
      label: 'Connections at the shared tier',
      valTxt: fmt.int(totalConns) + ' / ' + fmt.int(v.dbceil),
      pct: connPct,
      detail: `${fmt.int(instances)} instances × ${fmt.int(v.pool)} pool. Every instance you add opens its own pool, so this number grows with the fleet whether or not the traffic behind it does.`,
    },
    {
      label: 'Queueing multiplier',
      valTxt: fmt.n1(mult) + '× → ' + fmt.sig(effLat) + ' ms',
      pct: Math.min(100, (mult / 5) * 100),
      detail: `At ${Math.round(slotUtil)}% slot utilization the M/M/1 term 1 ÷ (1 − ρ) multiplies service time by ${fmt.n1(mult)}×, so a ${v.lat} ms request is served in about ${fmt.sig(effLat)} ms. Utilization does not add latency, it multiplies it.`,
    },
    {
      label: 'Rolling-deploy headroom',
      valTxt: Math.round(deployUtil) + '% while deploying',
      pct: deployUtil,
      detail: `With ${Math.round(DEPLOY_SURGE * 100)}% of the fleet out of rotation, ${fmt.int(Math.ceil(instances * (1 - DEPLOY_SURGE)))} instances carry peak. A deploy is a capacity event, and it is the one you schedule yourself.`,
    },
  ]

  let verdict: ComputeResult['verdict']
  if (connPct >= 100)
    verdict = {
      s: 'crit',
      t: `<b>The web tier is fine. The database is not.</b> ${fmt.int(instances)} instances × ${fmt.int(v.pool)} = <b>${fmt.int(totalConns)} connections</b> against a tier that holds ~${fmt.int(v.dbceil)} — roughly ${poolRatio}× over. This is the signature failure of horizontal scaling: the tier that scales cleanly takes down the tier that does not. Put a pooler (PgBouncer, ProxySQL) in the middle so fleet size and connection count stop being the same number — or scale <em>up</em> instead, which is the one case where a bigger box genuinely helps a stateless tier.`,
    }
  else if (deployUtil >= 100)
    verdict = {
      s: 'crit',
      t: `<b>Your deploy is an outage.</b> The fleet carries peak at ${Math.round(slotUtil)}% utilization, but with ${Math.round(DEPLOY_SURGE * 100)}% out of rotation it needs ${Math.round(deployUtil)}% of what remains. Deploying at peak will queue, time out, and hand you Chapter 6&apos;s cascade on a schedule you chose. Add surge capacity, deploy in smaller batches, or ship outside the peak window.`,
    }
  else if (slotUtil >= 90)
    verdict = {
      s: 'warn',
      t: `<b>Running at ${Math.round(slotUtil)}% of your slots — the queue owns the latency now.</b> The multiplier is ${fmt.n1(mult)}×, so users experience roughly ${fmt.sig(effLat)} ms for ${v.lat} ms of work. Worse, there is no headroom for W to move: one slow dependency and in-flight climbs with traffic completely flat. Add instances, or cut W.`,
    }
  else if (connPct >= 75)
    verdict = {
      s: 'warn',
      t: `<b>Connection fan-out is at ${Math.round(connPct)}% of what the shared tier holds.</b> It grows every time you scale out, so the next traffic milestone is also a database incident unless you decouple the two. Add the pooler before you need it — it is a one-afternoon change now and a war room later.`,
    }
  else
    verdict = {
      s: 'good',
      t: `<b>Healthy, and linear from here.</b> ${fmt.int(instances)} instances at ${Math.round(slotUtil)}% slots, ${fmt.int(totalConns)} connections against a ${fmt.int(v.dbceil)} ceiling, and enough headroom to survive your own deploy. Now try the cheapest move on this page: halve <em>time per request</em>. The fleet drops to <b>${fmt.int(halfInstances)}</b> and the connection count halves with it — no new hardware, no new architecture.`,
    }

  return {
    tiles: [
      { k: 'Instances needed', v: fmt.int(instances), u: 'stateless clones' },
      { k: 'Capacity / instance', v: fmt.compact(capPerInst), u: `req/s at ${target}%` },
      { k: 'Connections created', v: fmt.int(totalConns), u: 'to the shared tier' },
      { k: 'Fleet if W halves', v: fmt.int(halfInstances), u: `from ${fmt.int(instances)}` },
    ],
    meters,
    verdict,
  }
}
