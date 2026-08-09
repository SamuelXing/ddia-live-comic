import { describe, it, expect } from 'vitest'
import type { ComputeResult, InputDef, Values } from './types'
import { scaleOutInputs as kafkaIn, computeScaleOut as kafka } from './kafka/scaleout'
import { scaleOutInputs as redisIn, computeScaleOut as redis } from './redis/scaleout'
import { scaleOutInputs as pgIn, computeScaleOut as pg } from './postgres/scaleout'
import { scaleOutInputs as rmqIn, computeScaleOut as rmq } from './rabbitmq/scaleout'
import { scaleOutInputs as webIn, computeScaleOut as web } from './web/scaleout'
import { scaleOutInputs as s3In, computeScaleOut as s3 } from './s3/scaleout'

/* "Drag every slider to both extremes" — the manual check from the design
   skill, made permanent.

   A sandbox is a pure function behind sliders, so its failure mode is not a
   crash: it is a verdict that reads "Need Infinity replicas" or a tile that
   says "NaN MB/s". Those come from a division by a rung that happens to be
   zero, or a ratio taken before a guard. They are invisible until someone
   drags to the end of a ladder, which readers do immediately and authors
   almost never do.

   This sweeps each input to both ends with the others at their defaults, then
   both all-min and all-max corners, and asserts every rendered string and
   every meter percentage is a real number. */

const SANDBOXES: [string, InputDef[], (v: Values) => ComputeResult][] = [
  ['kafka', kafkaIn, kafka],
  ['redis', redisIn, redis],
  ['postgres', pgIn, pg],
  ['rabbitmq', rmqIn, rmq],
  ['web', webIn, web],
  ['s3', s3In, s3],
]

const defaults = (inputs: InputDef[]): Values =>
  Object.fromEntries(inputs.map((i) => [i.id, i.val]))

const BAD = /NaN|Infinity|undefined|null/

function assertSane(name: string, where: string, r: ComputeResult) {
  const tag = `${name} @ ${where}`
  r.tiles.forEach((t) => {
    expect(t.v, `${tag}: tile "${t.k}"`).not.toMatch(BAD)
    expect(t.u, `${tag}: tile unit "${t.k}"`).not.toMatch(BAD)
  })
  r.meters.forEach((m) => {
    expect(m.valTxt, `${tag}: meter "${m.label}"`).not.toMatch(BAD)
    expect(m.detail, `${tag}: meter detail "${m.label}"`).not.toMatch(BAD)
    expect(Number.isFinite(m.pct), `${tag}: meter "${m.label}" pct = ${m.pct}`).toBe(true)
    expect(m.pct, `${tag}: meter "${m.label}" pct is negative`).toBeGreaterThanOrEqual(0)
  })
  expect(r.verdict.t, `${tag}: verdict`).not.toMatch(BAD)
  expect(r.verdict.t.length, `${tag}: verdict is empty`).toBeGreaterThan(20)
}

describe('every sandbox survives both ends of every ladder', () => {
  it.each(SANDBOXES)('%s', (name, inputs, compute) => {
    const base = defaults(inputs)

    for (const i of inputs) {
      const lo = i.steps[0]
      const hi = i.steps[i.steps.length - 1]
      assertSane(name, `${i.id} = ${lo} (min)`, compute({ ...base, [i.id]: lo }))
      assertSane(name, `${i.id} = ${hi} (max)`, compute({ ...base, [i.id]: hi }))
    }

    const allMin = Object.fromEntries(inputs.map((i) => [i.id, i.steps[0]]))
    const allMax = Object.fromEntries(inputs.map((i) => [i.id, i.steps[i.steps.length - 1]]))
    assertSane(name, 'every slider at min', compute(allMin))
    assertSane(name, 'every slider at max', compute(allMax))
    assertSane(name, 'defaults', compute(base))
  })
})
