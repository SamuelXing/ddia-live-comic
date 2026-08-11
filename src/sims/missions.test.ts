import { describe, it, expect } from 'vitest'
import { STAGES as FEED_STAGES, defaultsFor as feedDefaults } from './feed/model'
import { STAGES as OBS_STAGES, defaultsFor as obsDefaults, estCostUSD } from './observability/model'
import { TEMPLATES as FEED_TPL } from './feed/model'
import { TEMPLATES as OBS_TPL } from './observability/model'

/* Both sims are mission labs: each stage hands you a checklist and some knobs,
   and the checklist is the whole contract. A goal that reads a knob the stage
   never shows, or watches a node that is not on the canvas at that stage, is a
   box the player cannot tick no matter what they do — and nothing in the app
   says so. The engine is a canvas animation and hard to unit test; the mission
   definition is plain data and easy, and it is where this class of bug lives.

   Until now `src/sims/` had no test of any kind, while every other surface has
   one (sandboxes, inputs, calcModel, latencyModel, reach, glossary, and the
   diagram geometry lint). This is that harness. */

/** Which StageControls flag gates each knob — mirrors the `{c.x && <Ctl …/>}`
 *  gating in each page. A knob with no gate is always on screen. */
const FEED_GATE: Record<string, string | null> = {
  traffic: null, writeShare: null,
  web: 'web', cacheHit: 'cache', replicas: 'replica', partitions: 'partitions',
  pgShards: 'shards', redisShards: 'shards', celeb: 'celeb', regions: 'regions', repl: 'repl',
}
const OBS_GATE: Record<string, string | null> = {
  ingest: 'ingest', queryShare: 'queryShare', indexers: 'indexers',
  cardinality: 'cardinality', hotShare: 'tiering', retention: 'tiering',
  clusters: 'clusters', quota: 'quota',
}

/** Read a goal predicate's source rather than calling it. `&&` short-circuits,
 *  so calling it once only reveals the knobs it happened to reach. */
function readsOf(fn: (...a: never[]) => unknown) {
  const src = fn.toString()
  return {
    controls: [...new Set([...src.matchAll(/\.c\.(\w+)/g)].map((m) => m[1]))],
    nodes: [...new Set([...src.matchAll(/(?:util|qdepth)\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]))],
  }
}

/** Engine state for a stage nobody has touched yet: nothing busy, nothing
 *  queued, nothing dropped, every region up. */
function freshCtx(c: Record<string, unknown>, regions = 3) {
  return {
    util: () => 0,
    qdepth: () => 0,
    dropPct: 0,
    p95: 0,
    p50: 0,
    regions,
    regionsAlive: regions,
    c,
  } as never
}

const SIMS = [
  { name: 'feed', stages: FEED_STAGES, defaults: feedDefaults, gate: FEED_GATE, tpl: FEED_TPL },
  { name: 'observability', stages: OBS_STAGES, defaults: obsDefaults, gate: OBS_GATE, tpl: OBS_TPL },
]

SIMS.forEach(({ name, stages, defaults, gate, tpl }) => {
  describe(`${name} sim — every goal is actually achievable`, () => {
    it('no goal depends on a control its stage never shows', () => {
      const broken: string[] = []
      stages.forEach((st, i) => {
        st.goals.forEach((g) => {
          readsOf(g.done).controls.forEach((k) => {
            const flag = gate[k]
            if (flag === undefined) {
              broken.push(`${name} stage ${i + 1} goal "${g.id}" reads unknown control "${k}"`)
            } else if (flag !== null && !(st.controls as Record<string, boolean | undefined>)[flag]) {
              broken.push(
                `${name} stage ${i + 1} goal "${g.id}" needs "${k}", but the stage does not enable controls.${flag} — the box can never be ticked`,
              )
            }
          })
        })
      })
      expect(broken).toEqual([])
    })

    it('no goal watches a node that is not on the canvas at that stage', () => {
      const broken: string[] = []
      stages.forEach((st, i) => {
        const present = new Set(st.nodes)
        st.goals.forEach((g) => {
          readsOf(g.done).nodes.forEach((id) => {
            if (!present.has(id))
              broken.push(`${name} stage ${i + 1} goal "${g.id}" watches node "${id}", which this stage does not place`)
          })
        })
      })
      expect(broken).toEqual([])
    })

    it('no goal is already ticked the moment its stage opens', () => {
      /* A checklist item that is true before you touch anything teaches nothing
         and reads as a bug. Judged on a fresh arrival — defaultsFor() with no
         carried-over state — because that is the only starting point the
         mission definition itself controls. */
      const preTicked: string[] = []
      stages.forEach((st, i) => {
        const c = defaults(i) as unknown as Record<string, unknown>
        st.goals.forEach((g) => {
          if (g.done(freshCtx(c, (c.regions as number) ?? 3))) preTicked.push(`${name} stage ${i + 1}: "${g.id}"`)
        })
      })
      expect(preTicked).toEqual([])
    })
  })

  describe(`${name} sim — the stage definitions resolve`, () => {
    it('every node a stage places exists in TEMPLATES', () => {
      const bad: string[] = []
      stages.forEach((st, i) =>
        st.nodes.forEach((n) => {
          if (!(n in tpl)) bad.push(`${name} stage ${i + 1} places unknown node "${n}"`)
        }),
      )
      expect(bad).toEqual([])
    })

    it('every route hops only through nodes the stage placed', () => {
      const bad: string[] = []
      stages.forEach((st, i) => {
        const present = new Set(st.nodes)
        // routes() takes the live cache-hit rate; both ends matter because a
        // route set can branch on it (hit vs miss paths).
        ;[0, 100].forEach((cacheHit) => {
          const routes = st.routes({ cacheHit })
          Object.entries(routes).forEach(([req, hops]) => {
            ;(hops as string[] | undefined)?.forEach((h) => {
              if (!present.has(h))
                bad.push(`${name} stage ${i + 1} route "${req}" (cacheHit ${cacheHit}) hops through "${h}", not placed`)
            })
          })
        })
      })
      expect([...new Set(bad)]).toEqual([])
    })
  })
})

describe('observability — the cost readout never prints nonsense', () => {
  /* The same rule sandboxes.test.ts enforces for the deep-dive sandboxes: walk
     each control to both ends and assert nothing renders NaN or Infinity. This
     number is shown as a KPI, so a bad value is visible to the reader. */
  it('is finite and non-negative across every control extreme', () => {
    const RETENTION = [7, 30, 90, 365]
    const HOT = [10, 40, 85, 100]
    const EVENTS = [0, 8 * 60, 420 * 60, 1e9]
    const bad: string[] = []
    EVENTS.forEach((e) =>
      RETENTION.forEach((r) =>
        HOT.forEach((h) => {
          const v = estCostUSD(e, r, h)
          if (!Number.isFinite(v) || v < 0) bad.push(`estCostUSD(${e}, ${r}, ${h}) = ${v}`)
        }),
      ),
    )
    expect(bad).toEqual([])
  })
})
