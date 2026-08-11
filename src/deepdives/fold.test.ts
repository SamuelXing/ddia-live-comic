import { describe, it, expect } from 'vitest'
import {
  ALL_INPUTS,
  DECIDED,
  INIT,
  PRESETS,
  WORKLOAD,
  DERIVED_INP,
  HW,
  fold,
  outcome,
  sensitivity,
} from './calcModel'
import type { Req, Vals } from './calcModel'

/* The basic view hides inputs. That is only defensible if the page can show
   the hidden ones do not matter — otherwise it is a number the answer rests on,
   removed from the page that claims you can check its arithmetic.
   `fold()` makes the claim; these tests are the claim being checked. */

const SCENARIOS: Array<{ name: string; v: Vals; req: Req }> = PRESETS.map((p) => ({
  name: p.id,
  v: { ...INIT, ...p.sets },
  req: p.req,
}))

describe.each(SCENARIOS)('folding the $name scenario', ({ v, req }) => {
  it('every folded input really is inert — one rung either way changes nothing', () => {
    /* The promise, tested directly rather than by trusting the function that
       makes it: take each input fold() offered to hide, move it, and demand the
       whole page still says the same thing. */
    const f = fold(v, req)
    const base = outcome(v, req)
    const broken: string[] = []
    for (const id of f.inert) {
      const inp = ALL_INPUTS.find((i) => i.id === id)!
      const at = inp.steps.indexOf(v[id])
      for (const j of [at - 1, at + 1]) {
        if (j < 0 || j >= inp.steps.length) continue
        const after = outcome({ ...v, [id]: inp.steps[j] }, req)
        if (
          after.store !== base.store ||
          after.shards !== base.shards ||
          Object.keys(base.needs).some(
            (k) =>
              base.needs[k as keyof typeof base.needs] !== after.needs[k as keyof typeof after.needs],
          )
        )
          broken.push(`${id} → ${inp.fmt(inp.steps[j])}`)
      }
    }
    expect(broken).toEqual([])
  })

  it('folds nothing it has not accounted for', () => {
    const f = fold(v, req)
    const seen = [...f.bearing, ...f.inert, ...f.decided].sort()
    expect(seen).toEqual(ALL_INPUTS.map((i) => i.id).sort())
    // and never counts one input twice
    expect(new Set(seen).size).toBe(seen.length)
  })

  it('claims nothing about the constants the page writes itself', () => {
    // overhead/readAmp/writeAmp are outputs wearing an input's clothes: they
    // are folded because a reader does not set them, NOT because a sweep
    // cleared them. Landing in `inert` would be the page vouching for a test
    // it never ran.
    const f = fold(v, req)
    expect(f.decided.sort()).toEqual([...DECIDED].sort())
    expect(f.inert.filter((id) => DECIDED.has(id))).toEqual([])
  })

  it('never hides a constant the sensitivity panel is calling out', () => {
    /* Two features, one question, and they must not contradict each other on
       screen: the table says "this assumption is load-bearing" while the layout
       has folded the slider away.

       Containment, not equality — the fold is deliberately the stricter of the
       two. The table forgives a shard count that drifts without doubling; the
       fold does not, so it keeps some sliders the table stays quiet about. That
       direction is safe. The reverse never is. */
    const f = fold(v, req)
    const hidden = sensitivity(v, req)
      .map((s) => s.id)
      .filter((id) => !f.bearing.has(id))
    expect(hidden).toEqual([])
  })
})

describe('the fold earns its keep', () => {
  it('hides a real share of the wall on a typical scenario', () => {
    /* Not a style preference: if the fold saves two sliders out of thirty it is
       complexity for nothing, and this test says so. */
    const { v, req } = SCENARIOS[0]
    const f = fold(v, req)
    expect(f.inert.length + f.decided.length).toBeGreaterThanOrEqual(ALL_INPUTS.length / 3)
  })

  it('keeps the requirement-shaped inputs visible where they drive the answer', () => {
    // `derived` is a requirement rendered as a slider; on every preset here it
    // moves the answer, so no scenario should be folding it away.
    const folded = SCENARIOS.filter(({ v, req }) => !fold(v, req).bearing.has('derived'))
    expect(folded.map((s) => s.name)).toEqual([])
  })

  it('surfaces an input in the scenario that needs it and hides it in one that does not', () => {
    /* The whole reason the fold is computed rather than hand-picked, in one
       assertion. `fsync` is the durable-write ceiling: a social feed sits close
       enough to that wall that one rung moves the answer, while metrics ingest
       is nowhere near it and the slider is noise. A frozen "basic" list has to
       be wrong for one of these two. */
    const at = (id: string) => {
      const p = PRESETS.find((x) => x.id === id)!
      return fold({ ...INIT, ...p.sets }, p.req).bearing
    }
    expect(at('feed').has('fsync')).toBe(true)
    expect(at('ingest').has('fsync')).toBe(false)
    // and the reverse pair, so this is not one lucky constant
    expect(at('ingest').has('randRead')).toBe(true)
    expect(at('feed').has('randRead')).toBe(false)
  })

  it('grows the visible set as the load grows', () => {
    const req: Req = { fresh: 'pull', txn: 'single', loss: 'keep', analytics: 'no', access: 'point', recency: 'stale' }
    const quiet: Vals = { ...INIT, dau: 1e4, actions: 1, fanout: 0 }
    const busy: Vals = { ...INIT, dau: 5e8, actions: 200, fanout: 100 }
    expect(fold(busy, req).bearing.size).toBeGreaterThan(fold(quiet, req).bearing.size)
  })

  it('shows an input it cannot sweep rather than hiding it on a shrug', () => {
    // a value pinned off its own ladder has no neighbours, so nothing has been
    // demonstrated about it — that must resolve to "visible", not "inert"
    const { v, req } = SCENARIOS[0]
    const offLadder = { ...v, ram: 999 }
    expect(fold(offLadder, req).bearing.has('ram')).toBe(true)
    expect(fold(offLadder, req).inert).not.toContain('ram')
  })
})

describe('the input list the fold walks is the one the page renders', () => {
  it('covers every workload slider, the derived count and every constant', () => {
    expect(ALL_INPUTS.map((i) => i.id)).toEqual([
      ...WORKLOAD.map((i) => i.id),
      DERIVED_INP.id,
      ...HW.map((i) => i.id),
    ])
  })
})
