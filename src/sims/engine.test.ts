import { describe, it, expect } from 'vitest'
import { FeedEngine } from './feed/engine'
import { ObservabilityEngine } from './observability/engine'
import { TEMPLATES as FEED_TEMPLATES, STAGES as FEED_STAGES } from './feed/model'
import { TEMPLATES as OBS_TEMPLATES, STAGES as OBS_STAGES } from './observability/model'

/* The two sims ran on copies of one engine for months. The copies drifted in a
   way nothing caught: the observability engine inherited the feed's node
   captions, so it branched on `pgP`, `redis`, `kafka` and `pgR` — kinds that do
   not exist anywhere in an observability pipeline — and had no branch for the
   indexer or buffer it actually draws. Dead branches are invisible: they never
   throw, they just never fire, and the caption quietly falls through to a bare
   percentage.

   Both sims share one engine now (../engine.ts), and each overrides only its
   own hooks. These tests check the hooks against the model they belong to, so a
   branch for a node that does not exist fails instead of hiding.

   Nothing here constructs an engine — that needs a canvas. The methods are read
   off the prototype: the pure ones are called, the branching ones are read as
   source, because a hook cannot be exercised without a running simulation but
   its `kind === '…'` tests can still be checked against the model. */

type Sim = {
  name: string
  proto: object
  templates: Record<string, { id: string }>
  stages: { nodes: string[] }[]
}

const SIMS: Sim[] = [
  { name: 'feed', proto: FeedEngine.prototype, templates: FEED_TEMPLATES, stages: FEED_STAGES },
  {
    name: 'observability',
    proto: ObservabilityEngine.prototype,
    templates: OBS_TEMPLATES,
    stages: OBS_STAGES,
  },
]

/** Node kinds a method branches on: `nd.kind === 'x'`.
 *  Both quote styles: this reads the *transformed* source, and the bundler
 *  rewrites string literals — matching only `'…'` silently found nothing. */
function kindsIn(proto: object, method: string): string[] {
  const fn = (proto as Record<string, unknown>)[method]
  if (typeof fn !== 'function') return []
  return [
    ...new Set([...fn.toString().matchAll(/kind\s*[!=]==\s*['"]([^'"]+)['"]/g)].map((m) => m[1])),
  ]
}

/** Call a hook that returns a literal and touches no instance state. */
function pureCall<T>(proto: object, method: string, fallback: T): T {
  const fn = (proto as Record<string, unknown>)[method]
  return typeof fn === 'function' ? (fn as () => T).call({}) : fallback
}

describe.each(SIMS)('$name engine hooks match its own model', (sim) => {
  const kinds = new Set(Object.values(sim.templates).map((t) => (t as { kind?: string }).kind).filter(Boolean))
  const ids = new Set(Object.keys(sim.templates))

  it.each(['subLabel', 'slots', 'serviceTimeFor'])(
    '%s branches only on node kinds this sim has',
    (method) => {
      const unknown = kindsIn(sim.proto, method).filter((k) => !kinds.has(k))
      expect(unknown).toEqual([])
    },
  )

  it('killNode can only take down a node that exists', () => {
    const cand = pureCall<string[]>(sim.proto, 'killCandidates', [])
    expect(cand.filter((id) => !ids.has(id))).toEqual([])
    expect(cand.length).toBeGreaterThan(0)
  })

  it('every hand-drawn edge connects two real nodes', () => {
    const edges = pureCall<Array<[string, string]>>(sim.proto, 'extraEdges', [])
    expect(edges.flat().filter((id) => !ids.has(id))).toEqual([])
  })

  it('every stage is built from nodes that exist', () => {
    const missing = sim.stages.flatMap((s) => s.nodes.filter((id) => !ids.has(id)))
    expect(missing).toEqual([])
  })
})

describe('the sims stay two sims', () => {
  it('each overrides the hooks its lesson needs, and no more', () => {
    /* If one of these drops to zero the sim has stopped being itself — the
       likely cause is a hook renamed in the base and silently un-overridden
       here, which reverts that sim to generic behaviour with nothing failing. */
    const own = (proto: object) =>
      Object.getOwnPropertyNames(proto).filter((k) => k !== 'constructor')
    expect(own(FeedEngine.prototype)).toEqual(
      expect.arrayContaining(['slots', 'serviceTimeFor', 'onServiceFinish', 'subLabel', 'pickType']),
    )
    expect(own(ObservabilityEngine.prototype)).toEqual(
      expect.arrayContaining(['slots', 'serviceTimeFor', 'countOverflowAsDrop', 'subLabel', 'pickType']),
    )
    // the map stage is the feed's alone; observability must not have grown one
    expect(own(ObservabilityEngine.prototype)).not.toContain('drawMap')
    expect(OBS_STAGES.some((s) => (s as { map?: boolean }).map)).toBe(false)
  })
})
