/* ============================================================
   The latency budget's arithmetic, as a pure module.

   Companion to calcModel.ts, and deliberately a different kind of
   model. Capacity is division: load ÷ ceiling, monotone, safe to
   extrapolate. Latency is not — it is a hockey stick that goes
   vertical well before the ceiling capacity is measuring against,
   which is exactly why the two live on separate pages.

   THE FRAME: you state a budget and the page SPENDS it.
     physics floors · hops add · utilization multiplies ·
     fan-out amplifies the tail
   Whatever is left is your headroom; whichever term is largest is
   where the time actually went.

   WHAT THIS DELIBERATELY DOES NOT DO: predict your p99. A queueing
   network with assumed arrival and service distributions produces a
   confident number that is frequently wrong, and that would forfeit
   the one property that makes the capacity page trustworthy — every
   number being a division you can check. So every term here is
   closed form, and the single distributional assumption (the tail
   shape used to price fan-out in milliseconds) is marked ASSUMED and
   stated in the open.
   ============================================================ */

import { L, HW, type Inp, type Opt, type Vals } from './calcModel'

/** Light in a vacuum, measured: 299,792 km/s. */
export const C_KM_PER_S = 299792
/** Silica single-mode fibre has a refractive index around 1.47, and light in a
 *  medium travels at c/n — so ~204,000 km/s, or ~204 km per millisecond. */
export const FIBRE_INDEX = 1.47
/** Rounded DOWN to 200 km/ms: a clean number, and ~2% conservative against the
 *  derived 203.9. This is the one constant on the page no engineering moves. */
export const FIBRE_KM_PER_MS = 200
/** what the derivation actually gives, before the rounding */
export const FIBRE_EXACT_KM_PER_MS = C_KM_PER_S / FIBRE_INDEX / 1000

/** Below a few kilometres the wire stops being the cost and switching,
 *  serialization and the kernel take over. napkin-math measures a round
 *  trip inside one datacenter at ~500 µs. */
export const DC_FLOOR_MS = 0.5

/** which path through the system you are budgeting */
export const PATH: Opt[] = [
  {
    id: 'read',
    label: 'A read',
    info: 'The common case, and the one users feel on every page load. It can be answered from a cache or a replica, which is what makes reads the cheap side of the system.',
  },
  {
    id: 'write',
    label: 'A write',
    info: 'Rarer, but it pays for durability: the commit does not return until the write is on stable media, and that fsync is a hard cost no cache removes. If the write must also be visible to others, replication is on the path too.',
  },
]

/** where the user is, relative to where the data is */
export interface Geo extends Opt {
  km: number
  /** the actual pair the distance was taken from, so the number is checkable */
  pair: string
}
export const GEO: Geo[] = [
  {
    id: 'dc', label: 'Same datacenter', km: 1, pair: 'one building',
    info: 'Client and server in the same building. The wire is irrelevant at this distance; what you pay is switching and serialization, which napkin-math measures at about 500 µs round trip.',
  },
  {
    id: 'metro', label: 'Same metro', km: 50, pair: 'a city and its suburbs',
    info: 'A city and its suburbs. Still under a millisecond of pure propagation, so the floor is barely above the datacenter case — this is what a well-placed edge POP buys you.',
  },
  {
    id: 'region', label: 'Same region', km: 500, pair: 'across one cloud region',
    info: 'Roughly one cloud region: a few hundred kilometres, several milliseconds round trip. Cross-availability-zone traffic lives here, which is why synchronous cross-AZ replication costs real time on every write.',
  },
  {
    id: 'country', label: 'Across a country', km: 4130, pair: 'New York → San Francisco',
    info: 'New York to San Francisco is about 4,130 km. Great-circle propagation alone is ~41 ms round trip; real routes measure 60–70 ms. No amount of engineering removes it — only moving the data closer does.',
  },
  {
    id: 'ocean', label: 'Across an ocean', km: 5585, pair: 'New York → London',
    info: 'New York to London is about 5,585 km — ~56 ms of pure round-trip propagation, ~70–80 ms in practice. If your users are here and your primary is there, you have already spent a third of a 200 ms budget before any code runs.',
  },
  {
    id: 'world', label: 'Halfway around the world', km: 17000, pair: 'London → Sydney',
    info: 'London to Sydney, about 17,000 km. ~170 ms round trip at the speed of light in fibre, ~250–290 ms in practice. A single synchronous round trip at this distance costs more than most latency budgets contain.',
  },
]

export const LWORKLOAD: Inp[] = [
  {
    id: 'budget', label: 'Your p99 target', steps: [10, 20, 50, 100, 200, 500, 1000, 2000], val: 200,
    fmt: (v) => v + ' ms', hint: 'The number the whole page is spent against.',
    info: 'State the promise before you cost it. This is the number a product decision makes — "the page feels instant", "the checkout must not time out" — and everything below is subtracted from it. When it goes negative, the page tells you which term ate it.',
  },
  {
    id: 'route', label: 'Route vs great circle', steps: [1, 1.2, 1.4, 1.7, 2, 3], val: 1.4,
    fmt: (v) => '×' + v, hint: 'Real fibre does not go straight.',
    info: 'The speed of light gives you the floor; real packets do worse. Fibre follows roads and seabeds rather than great circles, and every router adds a little. ×1.4 is a reasonable default for well-provisioned routes — New York to London measures ~70–80 ms against a ~56 ms theoretical minimum.',
  },
  {
    id: 'appMs', label: 'App service time', steps: [0.5, 1, 2, 5, 10, 20, 50, 100], val: 20,
    fmt: (v) => v + ' ms', hint: 'Your own code, with nothing queued behind it.',
    info: 'What your handler costs when it is the only request in the system: parsing, serialization, business logic, template rendering. This is the part profiling actually moves, and the only term on this page you own outright.',
  },
  {
    id: 'util', label: 'How busy each tier runs', steps: [10, 30, 50, 70, 80, 90, 95, 99], val: 70,
    fmt: (v) => v + '%', hint: 'The single most under-appreciated number here.',
    info: 'How busy a tier is when the request arrives, applied to every tier in the chain — a simplification, and a deliberately pessimistic one. Queueing does not wait politely for 100% — at 50% you already wait as long as you are served, at 90% ten times, at 99% a hundred times. This is why "we are only at 80% CPU" is a statement about latency, not comfort.',
  },
  {
    id: 'hops', label: 'Services in the chain', steps: [1, 2, 3, 5, 8, 12], val: 3,
    fmt: (v) => int(v) + (v === 1 ? ' service' : ' services'), hint: 'Each one is a network round trip you pay for.',
    info: 'How many services a request passes through in sequence before an answer comes back. Each adds its own service time, its own queueing, and a datacenter round trip. This is the term microservice architectures spend without noticing — the work did not get slower, the chain got longer.',
  },
  {
    id: 'fanout', label: 'Shards or replicas queried at once', steps: [1, 2, 5, 10, 50, 100, 500, 1000], val: 1,
    fmt: (v) => (v === 1 ? 'none' : '×' + int(v)), hint: 'Scatter-gather: you wait for the slowest.',
    info: 'When one request fans out across shards or replicas and needs all of them to answer, your latency is the SLOWEST of them, not the average. This is the single most counter-intuitive term on the page: a fleet where 99% of requests are fast produces a service where most requests are slow, as soon as you query enough of it at once.',
  },
  {
    id: 'p50', label: 'One service: median', steps: [0.5, 1, 2, 5, 10, 20, 50], val: 5,
    fmt: (v) => v + ' ms', hint: 'For the fan-out tail arithmetic.',
    info: 'The typical response time of one backend when nothing is wrong. Together with its p99 below, it describes how heavy the tail is — which is the only thing that decides what a fan-out costs you.',
  },
  {
    id: 'p99', label: 'One service: p99', steps: [1, 2, 5, 10, 20, 50, 100, 200, 500], val: 50,
    fmt: (v) => v + ' ms', hint: 'The 1-in-100 slow response.',
    info: 'What the slowest 1% of that backend costs. The GAP between this and the median is the tail, and a fan-out multiplies the gap rather than the median — which is why a service with a fat tail becomes unusable at fan-out long before a slow-but-consistent one does.',
  },
  {
    id: 'cacheHit', label: 'Cache hit rate', steps: L.hit, val: 90,
    fmt: (v) => v + '%', hint: 'Moves the mean. Watch what it does to p99.',
    info: 'The share of reads answered from memory. It transforms the AVERAGE beautifully — and does nothing whatsoever for the 99th percentile until it passes 99%, because below that a p99 request is by definition a miss. Averages lie about caches specifically, which is the whole reason this page exists alongside the capacity one.',
  },
]

/** the hardware costs a hop can be made of — the SAME definitions the capacity
 *  page uses, imported rather than restated so the two can never disagree */
const shared = (id: string) => HW.find((h) => h.id === id)!
export const LHW = [shared('cacheOp'), shared('randRead'), shared('fsync')]

const int = (n: number) => Math.round(n).toLocaleString('en-US')

export const LINIT: Vals = {}
;[...LWORKLOAD, ...LHW].forEach((i) => (LINIT[i.id] = i.val))

export interface LReq {
  path: string
  geo: string
}

/** one line of the budget: what it costs, and whether you can do anything */
export interface Term {
  id: string
  label: string
  ms: number
  /** the arithmetic that produced it */
  how: string
  /** can engineering move this at all? */
  kind: 'physics' | 'work' | 'queue' | 'tail'
  why: string
}

/* ---------- the closed-form pieces ---------- */

/** Round trip at the speed of light in fibre, floored by the fact that inside
 *  one building the wire is not what you are paying for. */
export function floorMs(km: number, route: number): number {
  return Math.max(DC_FLOOR_MS, ((2 * km) / FIBRE_KM_PER_MS) * route)
}

/** M/M/1 response time is service ÷ (1 − ρ). We use only the MULTIPLIER, and
 *  we present it as the shape rather than a prediction: the exact factor
 *  depends on your arrival and service distributions, the shape does not.
 *  ρ = 0.5 doubles it, 0.9 is ten times, 0.99 is a hundred. */
export function queueMultiplier(util: number): number {
  const rho = Math.min(0.999, Math.max(0, util / 100))
  return 1 / (1 - rho)
}

/** Dean & Barroso, "The Tail at Scale": if one server is slow for a fraction p
 *  of requests and you need N of them, the chance at least one is slow is
 *  1 − (1 − p)^N. At p = 1% and N = 100 that is 63% — exact arithmetic, and the
 *  most counter-intuitive number in distributed systems. */
export function anySlow(p: number, n: number): number {
  return 1 - Math.pow(1 - p, n)
}

/** Which single-server percentile you now need, for the MAX of n to hit p99.
 *  P(max ≤ t) = F(t)^n, so F(t) = 0.99^(1/n). At n = 100 that is 0.9999 —
 *  the p99 of a 100-way fan-out is the p99.99 of one server. */
export function percentileNeeded(n: number, target = 0.99): number {
  return Math.pow(target, 1 / n)
}

/** Turning that percentile into MILLISECONDS needs a tail shape, and this is
 *  the one place on either calculator where a distribution is assumed rather
 *  than measured. Fitting an exponential tail through (p50, p99):
 *      t(q) = p50 + (p99 − p50) × ln(1 − q) / ln(0.01)
 *  At n = 100 the ratio is exactly 2, so a 100-way fan-out doubles your tail
 *  EXCESS over the median while leaving the median alone. Marked ASSUMED on
 *  the page; the probability above needs no such assumption. */
export function fanoutP99(p50: number, p99: number, n: number): number {
  if (n <= 1) return p99
  const q = percentileNeeded(n)
  return p50 + (p99 - p50) * (Math.log(1 - q) / Math.log(0.01))
}

/** What a cache does to the two statistics, which is not the same thing.
 *  The mean moves with the hit rate. The 99th percentile does not move at all
 *  until the miss rate drops below 1%, because below that a p99 request IS a
 *  miss — so a 90% cache leaves your tail exactly where it was. */
export function cacheEffect(hitPct: number, hitMs: number, missMs: number) {
  const h = hitPct / 100
  /* At exactly a 1% miss rate the 99th-percentile request is the LAST hit, so
     the boundary belongs to the hit side. The epsilon is not cosmetic: 1 −
     0.99 evaluates to 0.010000000000000009 in binary floating point, which
     would put the exact boundary on the wrong side. */
  const missRate = 1 - h
  const tailIsMiss = missRate > 0.01 + 1e-9
  return {
    mean: h * hitMs + missRate * missMs,
    /** does a p99 request still reach the slow path? */
    tailIsMiss,
    p99: tailIsMiss ? missMs : hitMs,
  }
}

export function latency(v: Vals, req: LReq) {
  const geo = GEO.find((g) => g.id === req.geo)!
  const isWrite = req.path === 'write'

  // ---------- physics: the part no engineering removes ----------
  const floor = floorMs(geo.km, v.route)
  const theoretical = Math.max(DC_FLOOR_MS, (2 * geo.km) / FIBRE_KM_PER_MS)

  // ---------- work: service times, once each ----------
  /** every service in the chain is also a datacenter round trip to reach */
  const chainHops = Math.max(0, v.hops - 1)
  const internalNet = chainHops * DC_FLOOR_MS
  const appWork = v.appMs * v.hops
  /** the storage hop: a cache hit, a disk read, or a durable commit */
  const cacheMs = v.cacheOp / 1000
  const diskMs = v.randRead / 1000
  const commitMs = v.fsync / 1000
  const cache = cacheEffect(v.cacheHit, cacheMs, diskMs)
  const storeMean = isWrite ? commitMs : cache.mean
  const storeP99 = isWrite ? commitMs : cache.p99

  // ---------- queueing: the multiplier on work already counted ----------
  const qm = queueMultiplier(v.util)
  const queued = (appWork + storeP99) * (qm - 1)

  // ---------- the tail: fan-out amplifies what one backend does rarely ----------
  const fanned = v.fanout > 1
  const slowChance = anySlow(0.01, v.fanout)
  const needed = percentileNeeded(v.fanout)
  const fanP99 = fanoutP99(v.p50, v.p99, v.fanout)
  /** what the fan-out ADDS over querying a single backend */
  const tailCost = fanned ? fanP99 - v.p99 : 0

  const terms: Term[] = [
    {
      id: 'floor', label: 'Speed of light', ms: floor, kind: 'physics',
      how: `${geo.pair} · 2 × ${int(geo.km)} km ÷ ${FIBRE_KM_PER_MS} km/ms × ${v.route} routing`,
      why: `The distance is ${geo.pair} — ${int(geo.km)} km great-circle — doubled because the request goes there and comes back. The 200 km/ms is derived, not remembered: light in a vacuum is 299,792 km/s, silica fibre has a refractive index near 1.47, and light in a medium travels at c/n — so 299,792 ÷ 1.47 ÷ 1,000 = ${Math.round(FIBRE_EXACT_KM_PER_MS * 10) / 10} km/ms, rounded down to 200. Nothing in your control changes this; only moving the data closer does.`,
    },
    {
      id: 'net', label: 'Hops between services', ms: internalNet, kind: 'work',
      how: chainHops === 0 ? 'one service — nothing to hop between' : `${int(chainHops)} internal hops × ${DC_FLOOR_MS} ms`,
      why: 'Every service you add to the chain is another datacenter round trip. The work did not get slower; the chain got longer.',
    },
    {
      id: 'app', label: 'Your code', ms: appWork, kind: 'work',
      how: `${v.appMs} ms × ${int(v.hops)} service${v.hops === 1 ? '' : 's'}`,
      why: 'Service time with nothing queued behind it. This is the only term you own outright, and the only one profiling moves.',
    },
    {
      id: 'store', label: isWrite ? 'Making it durable' : 'Reaching the data', ms: storeP99, kind: 'work',
      how: isWrite
        ? `${v.fsync} µs fsync — every commit pays it`
        : cache.tailIsMiss
          ? `${v.randRead} µs disk read — at ${v.cacheHit}% hits a p99 request is still a miss`
          : `${v.cacheOp} µs from memory — above 99% hits, even the tail is a hit`,
      why: isWrite
        ? 'A write is not durable until the drive confirms it. That confirmation is the floor under every commit, and no cache removes it.'
        : 'A cache moves the MEAN, not the tail: until the miss rate is under 1%, the 99th-percentile request is by definition a miss, so your p99 is the disk.',
    },
    {
      id: 'queue', label: 'Waiting in line', ms: queued, kind: 'queue',
      how: `(${fmtMs(appWork + storeP99)} of work) × (1 ÷ (1 − ${v.util}%) − 1) = ×${round2(qm)} response`,
      why: 'Queueing does not politely wait for 100%. At 50% utilization you wait as long as you are served; at 90%, ten times; at 99%, a hundred. This is the term that turns a capacity page saying "you are fine" into an incident.',
    },
    {
      id: 'tail', label: 'Waiting for the slowest', ms: tailCost, kind: 'tail',
      how: fanned
        ? `p99 of the max of ${int(v.fanout)} needs one server's p${round2(needed * 100)} — ${fmtMs(fanP99)} against ${fmtMs(v.p99)}`
        : 'nothing fans out — one backend answers',
      why: 'Scatter-gather means your latency is the slowest backend, not the average one. A fleet where 99% of requests are fast serves mostly slow requests once you query enough of it at once.',
    },
  ]

  const spent = terms.reduce((a, t) => a + t.ms, 0)
  const left = v.budget - spent
  const worst = terms.reduce((a, t) => (t.ms > a.ms ? t : a), terms[0])
  /** what is left after removing everything engineering could theoretically fix */
  const irreducible = terms.filter((t) => t.kind === 'physics').reduce((a, t) => a + t.ms, 0)

  return {
    geo, isWrite, floor, theoretical, terms, spent, left, worst, irreducible,
    qm, cache, slowChance, needed, fanP99, tailCost, storeMean, storeP99, cacheMs, diskMs, commitMs,
  }
}

export type LatencyModel = ReturnType<typeof latency>

const round2 = (n: number) => Math.round(n * 100) / 100
export function fmtMs(n: number): string {
  if (n >= 100) return Math.round(n) + ' ms'
  if (n >= 10) return (Math.round(n * 10) / 10).toString() + ' ms'
  if (n >= 1) return (Math.round(n * 100) / 100).toString() + ' ms'
  return Math.round(n * 1000) + ' µs'
}

/** one-click situations, the same honest hand the capacity page uses */
export interface LPreset {
  id: string
  label: string
  info: string
  req: LReq
  sets: Vals
}
export const LPRESETS: LPreset[] = [
  {
    id: 'page', label: 'A web page load',
    info: 'A user across the country, three services deep, most reads cached. The classic shape — and the floor is already a third of the budget.',
    req: { path: 'read', geo: 'country' },
    sets: { budget: 200, route: 1.4, appMs: 20, util: 70, hops: 3, fanout: 1, p50: 5, p99: 50, cacheHit: 90 },
  },
  {
    id: 'search', label: 'A scatter-gather search',
    info: '100 shards queried at once, all of them needed. The tail term is the whole story here.',
    req: { path: 'read', geo: 'region' },
    sets: { budget: 200, route: 1.4, appMs: 5, util: 50, hops: 2, fanout: 100, p50: 5, p99: 50, cacheHit: 50 },
  },
  {
    id: 'checkout', label: 'A checkout write',
    info: 'A durable commit that must not be lost, at a tier running hot on a sale day.',
    req: { path: 'write', geo: 'region' },
    sets: { budget: 500, route: 1.4, appMs: 20, util: 90, hops: 5, fanout: 1, p50: 5, p99: 50, cacheHit: 90 },
  },
  {
    id: 'global', label: 'A global user, one primary',
    info: 'The data is in one region and the user is on the other side of the planet. Physics eats the budget before any code runs.',
    req: { path: 'read', geo: 'world' },
    sets: { budget: 200, route: 1.4, appMs: 10, util: 50, hops: 2, fanout: 1, p50: 5, p99: 50, cacheHit: 90 },
  },
]
