import { describe, it, expect } from 'vitest'
import { model, consequences, INIT, L, type Req, type Vals } from './calcModel'

/* Reality checks: the model pinned against numbers PUBLISHED by the people
   who ran the real systems — engineering blogs, papers, conference talks.
   Unit tests (calcModel.test.ts) prove the implementation matches the
   intended formulas; these prove the formulas reproduce production reality
   at the anchor points we can check. Each block cites its source and does
   the arithmetic by hand in comments.

   Honest scope note: an anchor point validates the formula that runs
   through it, not the whole model. The gaps that remain are the assumed
   constants (group commit, hit rates) and everything the page itself says
   it will not tell you (hot keys, tail latency, multi-DC, cost). */

const REQ: Req = { fresh: 'pull', txn: 'single', loss: 'keep', analytics: 'no' }
const vals = (over: Vals = {}): Vals => ({ ...INIT, ...over })

const close = (actual: number, expected: number, tol = 1e-3) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.abs(expected) * tol + 1e-9)
}

describe('Twitter fan-out — the DDIA Chapter 1 numbers (Nov 2012, via Kleppmann)', () => {
  /* Published: 4.6k tweets/s on average (12k/s peak), 300k home-timeline
     reads/s, and an average tweet reaches ~75 followers — so 4.6k tweets/s
     becomes 345k writes/s into the home-timeline caches.
     Source: DDIA Ch 1; timilearning.com/posts/ddia/part-one/chapter-1 */
  it('4.6k writes/s × 75 followers = 345k deliveries/s — exactly the published figure', () => {
    // construct exact average rates: dau × actions = 19,872,000 × 20
    //   = 397,440,000 actions/day ÷ 86,400 = 4,600/s exactly; peak ×1;
    //   readPct 0 → all writes; fanout 75
    const m = model(vals({ dau: 19872000, actions: 20, peak: 1, readPct: 0, fanout: 75 }), REQ)
    close(m.peakWrites, 4600)
    // 4,600 × 75 = 345,000 — the number the book derives
    close(m.deliveries, 345000)
    close(m.readSide, 345000)
  })
  it('at the published peak, 12k tweets/s × 75 = 900k deliveries/s', () => {
    // same construction with the peak factor carrying 4.6k -> 12k: ×2.609
    const m = model(vals({ dau: 19872000, actions: 20, peak: 12000 / 4600, readPct: 0, fanout: 75 }), REQ)
    close(m.deliveries, 900000)
  })
  it('the tool recommends what Twitter built: fan-out workers and a timeline cache tier', () => {
    const v = vals({ dau: 19872000, actions: 20, peak: 1, readPct: 0, fanout: 75 })
    const m = model(v, REQ)
    const c = consequences(v, REQ, m, false)
    // 345k deliveries/s >> the 26.7k/s durable-write ceiling → fan-out card
    // (Twitter: async fan-out workers, fan-out-on-read for celebrity accounts)
    expect(c.needs.fanout).toBe(true)
    // 345k ops/s ÷ 100k per cache core = 4 nodes → a partitioned cache tier
    // (Twitter: the Redis home-timeline clusters)
    expect(c.cacheNodes).toBeGreaterThanOrEqual(2)
  })
})

describe('WhatsApp — 2M+ connections on one server (Rick Reed, Erlang Factory 2012; blog: “1 million is so 2011”)', () => {
  it('the published record sits on the ladder; our default stays 20× conservative', () => {
    // WhatsApp held >2M live TCP connections on a single tuned FreeBSD box.
    // The connections-per-host ladder must reach the measured record...
    expect(L.conns).toContain(2e6)
    // ...while the default assumption stays 2,000,000 ÷ 100,000 = 20× under it
    expect(2e6 / INIT.connsPerHost).toBe(20)
  })
  it('connection-tier sizing brackets reality between default and record tuning', () => {
    // 200M DAU with 25–30% concurrently online ≈ 50M held connections.
    // Model uses dau × online%: 2e8 × 25% not on the online ladder — use
    // 5e8 × 10% = 50M, the same held-connection count.
    const v = vals({ dau: 5e8, online: 10 })
    const m = model(v, REQ)
    close(m.heldConns, 5e7)
    // at our conservative 100k/host: 500 hosts; at WhatsApp's measured 2M:
    // 25 hosts — the real fleet for this concurrency sits inside that band
    expect(consequences(v, REQ, m, true).connHosts).toBe(500)
    expect(Math.ceil(5e7 / 2e6)).toBe(25)
  })
})

describe('Netflix — 1.1M client writes/s on 288 Cassandra nodes (Netflix Tech Blog, 2011)', () => {
  it('measured per-node write throughput lands inside our group-commit sensitivity band', () => {
    // 1,100,000 ÷ 288 = 3,819 client writes/s/node; at replication factor 3
    // each write is applied on 3 nodes → ~11,458 applied writes/s per node.
    const perNodeApplied = (1.1e6 / 288) * 3
    close(perNodeApplied, 11458.3)
    // our durable-write ceiling: ×1 group commit = 1 ÷ 300 µs = 3,333/s;
    // ×8 group commit = 26,667/s. The measurement sits between the two —
    // which is the page's own claim that group commit is the assumption
    // doing the work (Cassandra's periodic-fsync default is cheaper than
    // our strict per-commit model, consistent with landing under ×8).
    const floor = model(vals({ group: 1 }), REQ).writeCeiling
    const ceil = model(vals({ group: 8 }), REQ).writeCeiling
    close(floor, 3333.3)
    close(ceil, 26666.7)
    expect(perNodeApplied).toBeGreaterThan(floor)
    expect(perNodeApplied).toBeLessThan(ceil)
  })
})

describe('Facebook — “Scaling Memcache at Facebook” (NSDI 2013)', () => {
  it('the paper states our chain formula: ~99% hit rate, and a 1% drop DOUBLES database load', () => {
    // misses = reads × (1 − hit): at 99% → 1% of reads; at 98% → 2%.
    // 2% ÷ 1% = 2 — “a 1% decrease in hit rate doubles database load”
    // is exactly this arithmetic, stated by the operators of the largest
    // memcache fleet ever measured.
    const at99 = consequences(vals({ cacheHit: 99 }), REQ, model(vals({ cacheHit: 99 }), REQ), false)
    const at98 = consequences(vals({ cacheHit: 98 }), REQ, model(vals({ cacheHit: 98 }), REQ), false)
    expect(at99.cacheNeed).toBe(true)
    close(at98.missReads / at99.missReads, 2)
    // and the published operating point is reachable on the hit-rate ladder
    expect(L.hit).toContain(99)
  })
})

describe('Redis — the bandwidth example from redis.io benchmarks', () => {
  it('100k ops/s of 4 KB = 3.28 Gbps through our egress formula (redis.io states 3.2 Gbit/s)', () => {
    // construct 100k pure reads/s of 4 KB: dau × actions = 8.64e9/day
    //   ÷ 86,400 = 100,000/s; readPct 100; zero protocol overhead to match
    //   the docs' bare arithmetic: 100,000 × 4,096 × 8 = 3.2768e9 = 3.28 Gbps
    const m = model(vals({ dau: 8.64e8, actions: 10, peak: 1, readPct: 100, readSize: 4 }), REQ)
    close(m.egressFor(0), 3.2768)
  })
})
