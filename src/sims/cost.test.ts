import { describe, it, expect } from 'vitest'
import { COST, STAGES, defaultsFor, estCostUSD, fmtUSD } from './observability/model'

/* The sim printed "$664k / month" for a bill of $664.

   estCostUSD multiplies GB by dollars-per-GB and returns DOLLARS; the page
   formatted the result as though it were thousands, so every figure on screen
   was 1000x too big — and it looked entirely plausible, because a six-figure
   observability bill is a real thing. Nothing catches a units error that
   produces a believable number except pinning the arithmetic to a case worked
   out by hand, which is what this file is. */

describe('the monthly bill', () => {
  it('matches a hand-worked example', () => {
    /* 2,880 events/s — the sim's opening ingest, 48 units x 60.
       2,880 x 86,400 s = 248,832,000 events/day
       x 500 B          = 124.416 GB/day
       ingest:  124.416 x 30 x $0.10        = $373.25
       stored:  124.416 x 90 days           = 11,197.44 GB
       hot 85%: 9,517.82 x $0.03            = $285.53
       cold 15%: 1,679.62 x $0.003          =   $5.04
                                              --------
                                              $663.82  */
    expect(estCostUSD(2880, 90, 85)).toBeCloseTo(663.82, 1)
  })

  it('is dollars, not thousands — the units the page prints', () => {
    /* The assertion the bug could not have survived. One GB/day, ingest only,
       no retention: 1 GB/day x 30 days x $0.10 = $3. Three dollars. */
    const oneGBPerSec = 1e9 / (86400 * COST.bytesPerEvent)
    expect(estCostUSD(oneGBPerSec, 0, 0)).toBeCloseTo(3, 6)
    expect(fmtUSD(estCostUSD(oneGBPerSec, 0, 0))).toBe('$3')
  })

  it('costs nothing when nothing is flowing', () => {
    expect(estCostUSD(0, 90, 85)).toBe(0)
  })

  it('scales linearly with ingest, and never goes backwards', () => {
    expect(estCostUSD(5760, 90, 85)).toBeCloseTo(estCostUSD(2880, 90, 85) * 2, 6)
    let prev = -1
    for (const days of [1, 7, 30, 90, 180, 365]) {
      const c = estCostUSD(2880, days, 85)
      expect(c).toBeGreaterThan(prev)
      prev = c
    }
  })

  it('makes hot storage the expensive choice — the lesson the slider teaches', () => {
    const allCold = estCostUSD(2880, 90, 0)
    const allHot = estCostUSD(2880, 90, 100)
    expect(allHot).toBeGreaterThan(allCold)
    // the durable claim is the ratio, not the dollars: hot is ~10x cold
    expect(COST.hotPerGBMo / COST.coldPerGBMo).toBeCloseTo(10, 6)
  })
})

describe('the figure on screen', () => {
  it('never claims a magnitude it does not have', () => {
    expect(fmtUSD(0)).toBe('$0')
    expect(fmtUSD(3)).toBe('$3')
    expect(fmtUSD(663.82)).toBe('$664')
    expect(fmtUSD(1200)).toBe('$1.2k')
    expect(fmtUSD(12_400)).toBe('$12k')
    expect(fmtUSD(1_240_000)).toBe('$1.2M')
  })

  it('stays inside one order of magnitude of the number it formats', () => {
    /* The general form of the bug: a formatter that multiplies. Whatever the
       value, what is printed must round-trip to within its own rounding. */
    for (const n of [1, 9, 99, 664, 999, 1000, 9999, 10_000, 999_999, 1e6, 8.8e6]) {
      const s = fmtUSD(n)
      const mult = s.endsWith('M') ? 1e6 : s.endsWith('k') ? 1e3 : 1
      const parsed = parseFloat(s.replace(/[$kM]/g, '')) * mult
      expect(Math.abs(parsed - n) / Math.max(n, 1)).toBeLessThan(0.06)
    }
  })
})

describe('what the player is shown at each stage', () => {
  it('opens every stage at a bill a reader would call plausible', () => {
    /* Not a style check. A stage that opens at $600M reads as a broken page,
       and a stage that opens at $4 makes the retention slider pointless — both
       are ways the units bug would have shown itself. */
    const odd: string[] = []
    STAGES.forEach((s, i) => {
      const d = defaultsFor(i)
      const c = estCostUSD(d.ingest * 60, d.retention, d.hotShare)
      if (c < 50 || c > 5e6) odd.push(`stage ${s.n}: ${fmtUSD(c)}`)
    })
    expect(odd).toEqual([])
  })

  it('dates its prices, so nobody reads them as a quote', () => {
    expect(COST.asOf).toMatch(/^\d{4}-\d{2}$/)
  })
})
