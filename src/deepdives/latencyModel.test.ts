import { describe, it, expect } from 'vitest'
import {
  latency, floorMs, queueMultiplier, anySlow, percentileNeeded, fanoutP99, cacheEffect,
  FIBRE_KM_PER_MS, DC_FLOOR_MS, GEO, LINIT, LPRESETS, LWORKLOAD, LHW,
  type LReq,
} from './latencyModel'
import type { Vals } from './calcModel'

/* Every expected value here is computed BY HAND in the comment above it, from
   the stated formula — never copied from the implementation's output. Latency
   arithmetic is where confident-looking numbers do the most damage, so if a
   test fails, re-do the hand arithmetic first; if the hand arithmetic is
   right, the model is wrong. */

const vals = (over: Vals = {}): Vals => ({ ...LINIT, ...over })
const req = (over: Partial<LReq> = {}): LReq => ({ path: 'read', geo: 'country', ...over })
const close = (actual: number, expected: number, tol = 1e-3) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.abs(expected) * tol + 1e-9)
}

describe('the floor: light in fibre, which no engineering moves', () => {
  it('is 200 km per millisecond, one way', () => {
    // ~2/3 of c (299,792 km/s) is ~200,000 km/s = 200 km/ms
    expect(FIBRE_KM_PER_MS).toBe(200)
  })

  it('New York to London: ~56 ms of pure round trip', () => {
    // 2 × 5,585 km ÷ 200 km/ms = 55.85 ms; published real-world RTT is 70–80 ms
    const ny = GEO.find((g) => g.id === 'ocean')!
    expect(ny.km).toBe(5585)
    close(floorMs(ny.km, 1), 55.85)
    // at the ×1.4 default that is 78.19 ms — inside the published 70–80 band
    close(floorMs(ny.km, 1.4), 78.19)
  })

  it('halfway around the world costs more than most whole budgets', () => {
    // 2 × 17,000 ÷ 200 = 170 ms before any routing inefficiency at all
    close(floorMs(17000, 1), 170)
    close(floorMs(17000, 1.4), 238)
  })

  it('inside one datacenter the wire is not the cost', () => {
    // 2 × 1 km ÷ 200 = 0.01 ms, but switching and serialization floor it at
    // napkin-math's measured ~500 µs round trip
    expect(floorMs(1, 1.4)).toBe(DC_FLOOR_MS)
    expect(DC_FLOOR_MS).toBe(0.5)
  })
})

describe('queueing: the hockey stick, not a straight line', () => {
  it('response time is service ÷ (1 − utilization)', () => {
    close(queueMultiplier(50), 2)
    close(queueMultiplier(70), 10 / 3)
    close(queueMultiplier(90), 10)
    close(queueMultiplier(95), 20)
    close(queueMultiplier(99), 100)
  })

  it('THE point: doubling utilization does not double the wait', () => {
    // 45% → 90% is a 2x increase in load and a 5.5x increase in latency.
    // This is what "we are only at 80% CPU" misses, and why a capacity page
    // reporting 43% of a ceiling must not be read as "latency is fine".
    const a = queueMultiplier(45) // 1 ÷ 0.55 = 1.8182
    const b = queueMultiplier(90) // 1 ÷ 0.10 = 10
    close(a, 1.81818)
    close(b, 10)
    expect(b / a).toBeGreaterThan(5)
  })

  it('at 50% utilization you already wait as long as you are served', () => {
    // multiplier 2 means response = 2 x service, i.e. wait == service
    close(queueMultiplier(50) - 1, 1)
  })
})

describe('the tail at scale: fan-out amplifies what one server does rarely', () => {
  it("reproduces Dean & Barroso's 63%", () => {
    // 1 − 0.99^100. 0.99^100 = e^(100 × ln 0.99) = e^-1.00503 = 0.36603
    // so 1 − 0.36603 = 0.63397 — the paper states 63%.
    close(anySlow(0.01, 100), 0.63397)
    // and the trivial case: one server, one chance
    close(anySlow(0.01, 1), 0.01)
  })

  it('the p99 of a 100-way fan-out is one server’s p99.99', () => {
    // P(max <= t) = F(t)^n, so F(t) = 0.99^(1/n).
    // 0.99^(1/100) = e^(ln 0.99 / 100) = e^-0.000100503 = 0.9998995
    close(percentileNeeded(100), 0.9998995, 1e-6)
    close(percentileNeeded(1), 0.99)
  })

  it('a 100-way fan-out doubles the tail EXCESS, leaving the median alone', () => {
    // exponential tail through (p50, p99):
    //   t(q) = p50 + (p99 − p50) × ln(1 − q) / ln(0.01)
    // at n = 100: 1 − q = 1.00503e-4, ln = −9.20532, ÷ −4.60517 = 1.99891
    // so 5 + 45 × 1.99891 = 94.95 ms, against a single server's 50 ms
    close(fanoutP99(5, 50, 100), 94.95, 1e-3)
    // one backend is just its own p99 — no amplification to price
    expect(fanoutP99(5, 50, 1)).toBe(50)
  })

  it('a fat tail is what makes fan-out expensive, not a slow median', () => {
    // same median, different tails: the fan-out cost tracks the GAP.
    // tight:  5 → 10  ⇒ 5 + 5 × 1.99891  = 14.99  (+4.99 over its own p99)
    // fat:    5 → 100 ⇒ 5 + 95 × 1.99891 = 194.90 (+94.90)
    const tight = fanoutP99(5, 10, 100)
    const fat = fanoutP99(5, 100, 100)
    close(tight, 14.9946)
    close(fat, 194.896)
    expect(fat - 100).toBeGreaterThan((tight - 10) * 15)
  })
})

describe('a cache moves the mean and does nothing for the tail', () => {
  it('90% hits: the average collapses, the 99th percentile does not move', () => {
    // hit 10 µs = 0.01 ms, miss 100 µs = 0.1 ms
    // mean = 0.9 × 0.01 + 0.1 × 0.1 = 0.009 + 0.01 = 0.019 ms
    const c = cacheEffect(90, 0.01, 0.1)
    close(c.mean, 0.019)
    // 10% of requests miss, so the 99th percentile is a miss by definition
    expect(c.tailIsMiss).toBe(true)
    close(c.p99, 0.1)
  })

  it('raising 50% → 90% halves the mean and changes p99 by nothing', () => {
    const lo = cacheEffect(50, 0.01, 0.1) // 0.5 × 0.01 + 0.5 × 0.1 = 0.055
    const hi = cacheEffect(90, 0.01, 0.1) // 0.019
    close(lo.mean, 0.055)
    close(hi.mean, 0.019)
    expect(lo.p99).toBe(hi.p99)
  })

  it('only past 99% does the tail become a hit', () => {
    // below a 1% miss rate there is no miss left inside the first 99%
    expect(cacheEffect(95, 0.01, 0.1).tailIsMiss).toBe(true)
    expect(cacheEffect(99, 0.01, 0.1).tailIsMiss).toBe(false)
  })
})

describe('the budget, spent end to end', () => {
  it('a web page load across a country is over budget on queueing alone', () => {
    // floor    2 × 4,130 ÷ 200 × 1.4                  = 57.82 ms
    // hops     (3 − 1) × 0.5                          =  1.00
    // app      20 × 3                                 = 60.00
    // store    90% hits ⇒ p99 is a miss ⇒ 100 µs      =  0.10
    // queue    (60 + 0.1) × (1 ÷ 0.3 − 1) = 60.1×2.333= 140.23
    // total                                           = 259.15 against 200
    const p = LPRESETS.find((x) => x.id === 'page')!
    const m = latency(vals(p.sets), p.req)
    close(m.terms.find((t) => t.id === 'floor')!.ms, 57.82)
    close(m.terms.find((t) => t.id === 'net')!.ms, 1)
    close(m.terms.find((t) => t.id === 'app')!.ms, 60)
    close(m.terms.find((t) => t.id === 'store')!.ms, 0.1)
    close(m.terms.find((t) => t.id === 'queue')!.ms, 140.2333)
    close(m.spent, 259.1533)
    close(m.left, -59.1533)
    expect(m.worst.id).toBe('queue')
  })

  it('a scatter-gather search is eaten by the tail, not by the work', () => {
    // floor 2×500÷200×1.4 = 7 · hops 0.5 · app 5×2 = 10 · store 0.1
    // queue (10 + 0.1) × (2 − 1) = 10.1
    // tail  fanoutP99(5, 50, 100) − 50 = 94.95 − 50 = 44.95  ← largest
    const p = LPRESETS.find((x) => x.id === 'search')!
    const m = latency(vals(p.sets), p.req)
    close(m.terms.find((t) => t.id === 'floor')!.ms, 7)
    close(m.tailCost, 44.9509)
    close(m.spent, 72.6509)
    expect(m.worst.id).toBe('tail')
    // and it still fits: 200 − 72.65
    expect(m.left).toBeGreaterThan(0)
  })

  it('a global user against one primary loses to physics before any code runs', () => {
    // floor 2 × 17,000 ÷ 200 × 1.4 = 238 ms of a 200 ms budget
    const p = LPRESETS.find((x) => x.id === 'global')!
    const m = latency(vals(p.sets), p.req)
    close(m.terms.find((t) => t.id === 'floor')!.ms, 238)
    expect(m.worst.id).toBe('floor')
    expect(m.left).toBeLessThan(0)
    // and no engineering recovers it — that is what `irreducible` means
    close(m.irreducible, 238)
  })

  it('a durable write at 90% utilization is 900 ms of queueing', () => {
    // app 20 × 5 = 100 · store = fsync 300 µs = 0.3
    // queue (100 + 0.3) × (10 − 1) = 902.7
    const p = LPRESETS.find((x) => x.id === 'checkout')!
    const m = latency(vals(p.sets), p.req)
    expect(m.isWrite).toBe(true)
    close(m.terms.find((t) => t.id === 'store')!.ms, 0.3)
    close(m.terms.find((t) => t.id === 'queue')!.ms, 902.7)
    expect(m.worst.id).toBe('queue')
  })

  it('the terms always sum to what was spent', () => {
    for (const p of LPRESETS) {
      const m = latency(vals(p.sets), p.req)
      close(m.spent, m.terms.reduce((a, t) => a + t.ms, 0))
      close(m.left, p.sets.budget - m.spent)
    }
  })

  it('a same-datacenter read at low load fits a 10 ms budget', () => {
    // the sanity check in the other direction: the model must not claim
    // everything is impossible. floor 0.5 · app 2 · store 0.1 · queue small
    const m = latency(vals({ budget: 10, appMs: 2, util: 30, hops: 1, fanout: 1 }), req({ geo: 'dc' }))
    expect(m.left).toBeGreaterThan(0)
    close(m.terms.find((t) => t.id === 'floor')!.ms, 0.5)
    close(m.terms.find((t) => t.id === 'net')!.ms, 0)
  })
})

describe('inputs behave like the rest of the site', () => {
  it('every default sits on its own ladder', () => {
    // an off-ladder default renders the slider thumb on the nearest rung while
    // the label prints the stored value — the panel contradicts itself
    ;[...LWORKLOAD, ...LHW].forEach((i) => {
      expect(i.steps, i.id).toContain(i.val)
    })
  })

  it('every ladder climbs', () => {
    ;[...LWORKLOAD, ...LHW].forEach((i) => {
      i.steps.forEach((s, k) => k > 0 && expect(s, i.id).toBeGreaterThan(i.steps[k - 1]))
    })
  })

  it('every preset sets values that sit on the ladders', () => {
    LPRESETS.forEach((p) => {
      Object.entries(p.sets).forEach(([k, val]) => {
        const inp = LWORKLOAD.find((i) => i.id === k)
        if (inp) expect(inp.steps, `${p.id}.${k}`).toContain(val)
      })
      expect(GEO.some((g) => g.id === p.req.geo), p.id).toBe(true)
    })
  })

  it('the hardware constants are the SAME objects the capacity page uses', () => {
    // imported, not restated — so fsync can never mean 300 µs on one page
    // and something else on the other
    expect(LHW.map((h) => h.id)).toEqual(['cacheOp', 'randRead', 'fsync'])
    expect(LHW.find((h) => h.id === 'fsync')!.val).toBe(300)
    expect(LHW.find((h) => h.id === 'randRead')!.val).toBe(100)
  })
})
