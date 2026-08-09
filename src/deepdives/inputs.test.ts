import { describe, it, expect } from 'vitest'
import { scaleOutInputs as kafka } from './kafka/scaleout'
import { scaleOutInputs as redis } from './redis/scaleout'
import { scaleOutInputs as postgres } from './postgres/scaleout'
import { scaleOutInputs as rabbitmq } from './rabbitmq/scaleout'
import { webModule } from './modules/web'
import { s3Module } from './modules/s3'
import { LAD, snapIndex } from './ladder'
import { WORKLOAD, DERIVED_INP, HW } from './calcModel'
import type { InputDef } from './types'

/* Two failure modes this file exists to prevent.

   1. A default that is not on its own ladder. The readout prints the stored
      value while the thumb sits on the nearest rung, so the slider says one
      number and the label says another — and the sandbox is quietly lying
      before the reader has touched anything.
   2. A ladder that is not monotonic, which makes the thumb travel backwards.

   Every sandbox input on the site is covered; the same rule is enforced for
   the capacity calculator's presets in calcModel.test.ts. */

const SANDBOXES: [string, InputDef[]][] = [
  ['kafka', kafka],
  ['redis', redis],
  ['postgres', postgres],
  ['rabbitmq', rabbitmq],
  ['web', webModule.content!.inputs],
  ['s3', s3Module.content!.inputs],
]

describe('sandbox inputs are order-of-magnitude ladders', () => {
  it.each(SANDBOXES)('%s: every default sits on a rung', (name, inputs) => {
    for (const i of inputs) {
      expect(i.steps.length, `${name}.${i.id} has no ladder`).toBeGreaterThan(1)
      expect(i.steps, `${name}.${i.id} default ${i.val} is between rungs`).toContain(i.val)
    }
  })

  it.each(SANDBOXES)('%s: every ladder climbs', (name, inputs) => {
    for (const i of inputs) {
      const sorted = [...i.steps].sort((a, b) => a - b)
      expect(i.steps, `${name}.${i.id} ladder is out of order`).toEqual(sorted)
      expect(new Set(i.steps).size, `${name}.${i.id} ladder repeats a rung`).toBe(i.steps.length)
    }
  })
})

describe('the shared ladders', () => {
  it('all climb, with no repeats', () => {
    for (const [name, steps] of Object.entries(LAD)) {
      expect(steps, `LAD.${name} is out of order`).toEqual([...steps].sort((a, b) => a - b))
      expect(new Set(steps).size, `LAD.${name} repeats a rung`).toBe(steps.length)
    }
  })
  it('snapIndex finds the nearest rung, including past both ends', () => {
    const l = [10, 20, 50, 100]
    expect(snapIndex(l, 10)).toBe(0)
    expect(snapIndex(l, 21)).toBe(1) // nearest, not next
    expect(snapIndex(l, 49)).toBe(2)
    expect(snapIndex(l, 0)).toBe(0) // below the ladder
    expect(snapIndex(l, 1e9)).toBe(3) // above it
  })
})

/* The calculator's own inputs were never covered by the sweep above — it walks
   the six deep-dive sandboxes only. That gap shipped a real contradiction: the
   fsync constant defaults to its MEASURED 300 µs while its ladder went
   ...200, 500..., so the thumb rendered on 200 while the label read 300 µs.
   Found by the latency page's copy of this same invariant. */
describe('the calculator panels obey the same rules', () => {
  it('every requirement, workload and hardware default sits on its ladder', () => {
    ;[...WORKLOAD, DERIVED_INP, ...HW].forEach((i) => {
      expect(i.steps, `${i.id} default ${i.val} is off its own ladder`).toContain(i.val)
    })
  })
  it('every calculator ladder climbs', () => {
    ;[...WORKLOAD, DERIVED_INP, ...HW].forEach((i) => {
      i.steps.forEach((s, k) => k > 0 && expect(s, i.id).toBeGreaterThan(i.steps[k - 1]))
    })
  })
})
