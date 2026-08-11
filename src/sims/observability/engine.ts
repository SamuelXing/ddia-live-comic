/* ============================================================
   Observability at Scale — what this sim adds to the shared engine.

   The queueing simulation, layout and rendering live in
   ../engine.ts. Here: the two mechanics this pipeline is about.

   **Cardinality** inflates the cost of every indexed event and
   every query scan, quadratically — the wall no amount of
   horizontal indexer scaling climbs. **Federation** multiplies
   index-tier parallelism across clusters. Plus per-team ingest
   **quotas**, which shed at the edge instead of dropping data
   downstream.

   No fan-out, no hot key, no geo map: this sim's stages are all
   topologies, so it inherits the base's empty map hooks.
   ============================================================ */
import { REQ, STAGES, TEMPLATES, typeWeights } from './model'
import type { ReqType, StageDef } from './model'
import { SimEngine } from '../engine'
import type { Particle, SimNode } from '../engine'

export { RPS_PER_UNIT, fmtRps } from '../engine'
export type { Particle, SimNode, BarSnapshot, Snapshot } from '../engine'

export class ObservabilityEngine extends SimEngine<StageDef> {
  /* `cacheHit` is the hot-tier share and `writeShare` the query share —
     the base's names, this sim's meanings. Both are set by the page. */
  cardinality = 0 // 0..100 — high-cardinality labels inflate index + query cost
  clusters = 1 // federation: multiplies index-tier capacity
  quota = false // per-team ingest quotas throttle at the edge instead of dropping

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, { stages: STAGES, templates: TEMPLATES, colorOf: (t) => REQ[t as ReqType].color })
  }

  protected onStageSet() {
    const idx = this.node('idx')
    if (idx) idx.instances = this.stage.idx ?? 2
    this.cardinality = 0
    this.clusters = 1
    this.quota = false
  }

  /** Federation multiplies index-tier parallelism across clusters. */
  protected slots(nd: SimNode): number {
    if (nd.kind === 'idx') return Math.max(1, nd.instances * nd.slotsPer * this.clusters)
    return super.slots(nd)
  }

  /* High-cardinality labels inflate per-event index work AND query scans —
     the wall no amount of horizontal indexer scaling can climb. Quadratic:
     near-free at low cardinality, explosive as it climbs. */
  protected serviceTimeFor(nd: SimNode, p: Particle): number {
    let sm = super.serviceTimeFor(nd, p)
    const card2 = (this.cardinality / 100) * (this.cardinality / 100)
    if (nd.kind === 'idx') sm *= 1 + card2 * 12
    if (nd.kind === 'query') sm *= 1 + card2 * 6
    return sm
  }

  /* Per-team quotas throttle excess at the edge; without them the overflow
     is dropped data downstream. Either way it doesn't enter the pipeline. */
  protected countOverflowAsDrop(): boolean {
    return !this.quota
  }

  protected subLabel(nd: SimNode): string {
    const uP = Math.round(nd.util * 100) + '%'
    // The federation multiplier is real capacity, so it belongs on the caption:
    // an indexer running 3 clusters is not the same machine as one running 1.
    if (nd.kind === 'idx')
      return nd.instances + '×' + (this.clusters > 1 ? ' · ' + this.clusters + ' clusters' : '') + ' · ' + uP
    if (nd.scalable === 'web') return nd.instances + '× · ' + uP
    if (nd.kind === 'buffer') return 'lag ' + nd.qdepth + ' · ' + uP
    return uP
  }

  protected killCandidates(): string[] {
    return ['idx', 'hot', 'buffer', 'gw']
  }

  protected pickType(): ReqType {
    // writeShare is repurposed as the query share (queries vs ingest).
    const w = typeWeights(this.writeShare)
    const types: ReqType[] = ['log', 'metric', 'trace', 'query']
    const tot = types.reduce((s, k) => s + w[k], 0)
    let r = Math.random() * tot
    for (const k of types) {
      r -= w[k]
      if (r <= 0) return k
    }
    return 'log'
  }

  /* ---------- knob setters ---------- */
  setIndexers(n: number) {
    const nd = this.node('idx')
    if (nd) nd.instances = n
  }
  setQuota(b: boolean) {
    this.quota = b
  }
}
