/* ============================================================
   The simulation engine both app sims run on.

   Every node is a queue with N concurrent service slots.
   Requests are particles; when arrivals outrun slots, queues
   back up and latency climbs — the animation IS the math.

   Framework-agnostic: owns the canvas + rAF loop; React reads
   snapshots and calls setters.

   A sim subclasses this and overrides only where its lesson
   differs — capacity (`slots`), what a request costs
   (`serviceTimeFor`), what happens when one finishes
   (`onServiceFinish`), and what the node caption says
   (`subLabel`). Everything else — queueing, travel, the
   latency window, layout, drawing — is here once. Both sims
   were copies of this file until they weren't: the same
   canvas-fit fix had to be written twice, and the second copy
   is where a divergence would have hidden.
   ============================================================ */

export const RPS_PER_UNIT = 60 // 1 simulated "unit" of load ≈ 60 req/s for display
const MAX_PARTICLES = 900
const SUB_MS = 25 // fixed sim resolution; every serviceMs >= this
/** Fixed per-hop network cost added to reported latency (ms). */
const HOP_NET_MS = 5

export type Role =
  | 'src'
  | 'edge'
  | 'net'
  | 'web'
  | 'svc'
  | 'cache'
  | 'queue'
  | 'db'
  | 'store'
  | 'mono'

export interface NodeTpl {
  id: string
  label: string
  kind?: string
  role: Role
  col: number
  instances?: number
  slotsPer?: number
  serviceMs?: number
  scalable?: 'web' | 'replica'
}

/** What the engine needs from a stage. Each sim's own StageDef adds to it. */
export interface BaseStage {
  nodes: string[]
  /** Geo-map mode: regions instead of a topology. Only the feed sim uses it. */
  map?: boolean
  routes: (s: { cacheHit: number }) => Partial<Record<string, string[]>>
}

export interface Particle {
  type: string
  color: string
  route: string[]
  hop: number
  born: number
  /** Simulated latency actually accrued: queue wait + service, per hop.
      Travel animation is presentation only and never counted. */
  workMs: number
  /** When this particle entered its current node's queue. */
  qAt: number
  x: number
  y: number
  traveling: boolean
  tprog: number
  fromX: number
  fromY: number
  toX: number
  toY: number
  atNode: string | null
  /** Internal work (a fan-out write), not a user request: never timed. */
  fanout: boolean
  done: boolean
}

interface Busy {
  p: Particle
  doneAt: number
}

export interface SimNode {
  id: string
  label: string
  kind?: string
  role: Role
  col: number
  scalable?: string
  serviceMs: number
  slotsPer: number
  instances: number
  shards: number
  partitions: number
  queue: Particle[]
  busy: Busy[]
  x: number
  y: number
  r: number
  dead: boolean
  util: number
  qdepth: number
}

export interface BarSnapshot {
  id: string
  label: string
  util: number
  dead: boolean
  qdepth: number
  kind?: string
}

export interface Snapshot {
  stageIdx: number
  map: boolean
  offeredRps: number
  servedRps: number
  dropRps: number
  dropPct: number
  inflight: number
  p50: number
  p95: number
  overloaded: boolean
  bars: BarSnapshot[]
  regions: number
  regionsAlive: number
  replLagMs: number
}

export function fmtRps(units: number): string {
  const r = units * RPS_PER_UNIT
  return r >= 1000 ? (r / 1000).toFixed(r >= 10000 ? 0 : 1) + 'k' : String(Math.round(r))
}

function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function hx(h: string): [number, number, number] {
  h = h.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export function mix(a: string, b: string, t: number): string {
  const pa = hx(a)
  const pb = hx(b)
  return `rgb(${Math.round(pa[0] + (pb[0] - pa[0]) * t)},${Math.round(pa[1] + (pb[1] - pa[1]) * t)},${Math.round(pa[2] + (pb[2] - pa[2]) * t)})`
}

export interface EngineSpec<S extends BaseStage> {
  stages: readonly S[]
  templates: Record<string, NodeTpl>
  /** Particle colour for a request type. */
  colorOf: (type: string) => string
}

export abstract class SimEngine<S extends BaseStage = BaseStage> {
  protected cvs: HTMLCanvasElement
  protected ctx: CanvasRenderingContext2D
  protected W = 0
  protected H = 0

  // model state
  stageIdx = 0
  stage: S
  protected stages: readonly S[]
  protected templates: Record<string, NodeTpl>
  protected colorOf: (type: string) => string
  protected nodes: Record<string, SimNode> = {}
  protected order: string[] = []
  protected particles: Particle[] = []

  // knobs every sim has
  traffic = 48
  cacheHit = 0.85
  writeShare = 0.18
  running = true
  speed = 6

  // internals
  protected now = 0
  private spawnAcc = 0
  private overloadT = -10000
  private compl: number[] = []
  private servedWin: number[] = []
  protected dropWin: number[] = []

  private raf = 0
  private lastReal = 0
  /** how much bigger than the natural size this stage draws — see layout() */
  protected zoom = 1
  protected colors: Record<string, string> = {}
  private edgeCache: Array<[string, string]> = []

  constructor(canvas: HTMLCanvasElement, spec: EngineSpec<S>) {
    this.cvs = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    this.ctx = ctx
    this.stages = spec.stages
    this.stage = spec.stages[0]
    this.templates = spec.templates
    this.colorOf = spec.colorOf
    const css = getComputedStyle(document.documentElement)
    const read = (v: string, fallback: string) => (css.getPropertyValue(v) || fallback).trim()
    this.colors = {
      stateless: read('--stateless', '#3987e5'),
      data: read('--data', '#9085e9'),
      cache: read('--cache', '#e5533b'),
      queue: read('--queue', '#e6a72a'),
      store: read('--store', '#25b866'),
      edge: read('--edge', '#37b6c4'),
      good: read('--good', '#25b866'),
      warn: read('--warn', '#e6a72a'),
      hot: read('--hot', '#e5533b'),
    }
    this.resize()
  }

  /* ============================================================
     HOOKS — the only places the two sims actually differ.
     ============================================================ */

  /** Which request type the next arrival is. */
  protected abstract pickType(): string

  /** Concurrent service slots. Default: instances × slotsPer. */
  protected slots(nd: SimNode): number {
    return Math.max(1, nd.instances * nd.slotsPer)
  }

  /** Service time for one request at one node, jitter included. */
  protected serviceTimeFor(nd: SimNode, _p: Particle): number {
    // jitter → honest p95 > p50
    return nd.serviceMs * (0.65 + Math.random() * 0.7)
  }

  /** Called when a node finishes a request, before it moves on. */
  protected onServiceFinish(_nd: SimNode, _p: Particle): void {}

  /** Per-stage setup after the nodes exist. */
  protected onStageSet(): void {}

  /** The caption under a node. */
  protected subLabel(nd: SimNode): string {
    return Math.round(nd.util * 100) + '%'
  }

  /** Which node `killNode()` takes down, in preference order. */
  protected killCandidates(): string[] {
    return this.order
  }

  /** Whether an arrival turned away by the particle cap counts as dropped data. */
  protected countOverflowAsDrop(): boolean {
    return true
  }

  /** Edges the route sampler cannot see (a consumer reading from a log). */
  protected extraEdges(): Array<[string, string]> {
    return []
  }

  /* Geo-map mode. Only the feed sim has map stages, so these stay empty
     here rather than shipping a region subsystem into a sim that has no
     regions — `stage.map` is false in that sim and none of this runs. */
  protected layoutMap(): void {}
  protected stepMap(_dt: number): void {}
  protected drawMap(): void {}
  protected mapBars(): BarSnapshot[] {
    return []
  }
  protected mapStats(): { regions: number; regionsAlive: number; replLagMs: number } {
    return { regions: 0, regionsAlive: 0, replLagMs: 0 }
  }
  /** Returns true if the map handled the kill and the topology path should not run. */
  protected killInMap(): boolean {
    return false
  }

  /* ---------- lifecycle ---------- */
  start() {
    this.lastReal = performance.now()
    const loop = (t: number) => {
      const realMs = t - this.lastReal
      this.lastReal = t
      if (this.running) this.step(realMs)
      this.draw()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    cancelAnimationFrame(this.raf)
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const r = this.cvs.getBoundingClientRect()
    this.W = r.width
    this.H = r.height
    this.cvs.width = r.width * dpr
    this.cvs.height = r.height * dpr
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.layout()
  }

  /* ---------- stage setup ---------- */
  setStage(i: number) {
    this.stageIdx = i
    this.stage = this.stages[i]
    this.nodes = {}
    this.order = []
    this.particles = []
    this.compl = []
    this.servedWin = []
    this.dropWin = []
    this.spawnAcc = 0

    if (!this.stage.map) {
      this.stage.nodes.forEach((id) => {
        this.nodes[id] = this.makeNode(this.templates[id])
        this.order.push(id)
      })
    }
    this.onStageSet()
    this.layout()
    this.buildEdgeCache()
  }

  private makeNode(tpl: NodeTpl): SimNode {
    return {
      id: tpl.id,
      label: tpl.label,
      kind: tpl.kind,
      role: tpl.role,
      col: tpl.col,
      scalable: tpl.scalable,
      serviceMs: tpl.serviceMs ?? 50,
      slotsPer: tpl.slotsPer ?? 1,
      instances: tpl.instances ?? 1,
      shards: 1,
      partitions: 8,
      queue: [],
      busy: [],
      x: 0,
      y: 0,
      r: 26,
      dead: false,
      util: 0,
      qdepth: 0,
    }
  }

  /** Node by id, for a subclass's knob setters. */
  protected node(id: string): SimNode | undefined {
    return this.nodes[id]
  }

  /* ---------- layout ---------- */
  private layout() {
    if (this.stage.map) {
      this.layoutMap()
      return
    }
    const cols: Record<number, string[]> = {}
    this.order.forEach((id) => {
      const c = this.nodes[id].col
      ;(cols[c] = cols[c] || []).push(id)
    })
    const colKeys = Object.keys(cols).map(Number).sort((a, b) => a - b)
    if (!colKeys.length) return
    /* Content is capped, centered, and sized by how many columns this stage
       actually uses — two nodes sit near each other, not at opposite walls.

       Capping alone was not enough. A stage-1 topology is two fixed-size nodes
       inside a canvas that is sized for stage 6, so it drew roughly 250px of
       content into ~1450px of frame and read as unfinished rather than simple.
       The nodes now grow with the space instead: `zoom` scales radii and node
       type together, so a sparse stage looks deliberate and a dense one is
       untouched (it computes to ~1). */
    const padX = 70
    const span = colKeys.length - 1
    const NATURAL_GAP = 250
    const cap = Math.min(1180, Math.max(420, span * 320))
    const usableW = Math.min(Math.max(260, this.W - padX * 2), cap)
    const x0 = (this.W - usableW) / 2
    const tallest = Math.max(...colKeys.map((c) => cols[c].length))
    this.zoom = Math.max(
      1,
      Math.min(
        1.9,
        usableW / Math.max(NATURAL_GAP, span * NATURAL_GAP),
        // do not outgrow the vertical room a column of nodes has to share
        tallest <= 1 ? 1.9 : (this.H * 0.66) / (tallest * 92),
      ),
    )
    colKeys.forEach((c, ci) => {
      const ids = cols[c]
      const x = x0 + (span < 1 ? usableW / 2 : (ci / span) * usableW)
      const n = ids.length
      ids.forEach((id, k) => {
        const y = this.H * 0.14 + (n === 1 ? this.H * 0.36 : (k / (n - 1)) * this.H * 0.66)
        this.nodes[id].x = x
        this.nodes[id].y = y
        const baseR = id === 'mono' ? 48 : this.nodes[id].role === 'src' ? 23 : 31
        this.nodes[id].r = baseR * this.zoom
      })
    })
  }

  /** Sample routes several times so random branches (cache miss) still register edges. */
  private buildEdgeCache() {
    const seen = new Set<string>()
    const edges: Array<[string, string]> = []
    for (let s = 0; s < 16; s++) {
      const rmap = this.stage.routes({ cacheHit: 0.5 })
      Object.values(rmap).forEach((route) => {
        if (!route) return
        for (let i = 0; i < route.length - 1; i++) {
          const key = route[i] + '>' + route[i + 1]
          if (seen.has(key)) continue
          seen.add(key)
          edges.push([route[i], route[i + 1]])
        }
      })
    }
    this.extraEdges().forEach(([a, b]) => {
      if (this.nodes[a] && this.nodes[b]) edges.push([a, b])
    })
    this.edgeCache = edges
  }

  killNode() {
    if (this.killInMap()) return
    const cand = this.killCandidates().find((id) => this.nodes[id] && !this.nodes[id].dead)
    if (cand) {
      const nd = this.nodes[cand]
      nd.dead = true
      setTimeout(() => {
        nd.dead = false
      }, 6000)
    }
  }

  /* ---------- particle plumbing ---------- */
  /** Inject a particle onto a route.
   *
   *  An arrival starts at `route[0]` — a source node, which is drawn but never
   *  queues — and its first leg is `route[0] → route[1]`. A particle injected
   *  mid-topology (a fan-out burst leaving a log) passes `from`, and its first
   *  leg is `from → route[0]`, so `route[0]` is a real station that queues. */
  protected emit(
    type: string,
    color: string,
    route: string[],
    opts: { fanout?: boolean; from?: string } = {},
  ): boolean {
    if (this.particles.length >= MAX_PARTICLES) return false
    const injected = opts.from !== undefined
    const src = this.nodes[opts.from ?? route[0]]
    const p: Particle = {
      type,
      color,
      route,
      hop: 0,
      born: this.now,
      workMs: 0,
      qAt: 0,
      x: src ? src.x : 60,
      y: src ? src.y + (injected ? 0 : Math.random() * 40 - 20) : this.H / 2,
      traveling: true,
      tprog: 0,
      fromX: src ? src.x : 60,
      fromY: src ? src.y : this.H / 2,
      toX: 0,
      toY: 0,
      atNode: null,
      fanout: !!opts.fanout,
      done: false,
    }
    if (injected) this.advanceTravel(p, opts.from!, route[0])
    else this.advanceTravel(p, route[0], route[1])
    this.particles.push(p)
    return true
  }

  private spawn(type: string) {
    if (this.particles.length >= MAX_PARTICLES) {
      if (this.countOverflowAsDrop()) this.dropWin.push(this.now)
      return
    }
    const route = this.stage.routes({ cacheHit: this.cacheHit })[type]
    if (!route) return
    this.emit(type, this.colorOf(type), route)
  }

  private advanceTravel(p: Particle, fromId: string, toId: string | undefined) {
    const a = this.nodes[fromId]
    const b = toId ? this.nodes[toId] : undefined
    if (!b || !toId) {
      this.complete(p)
      return
    }
    p.traveling = true
    p.tprog = 0
    p.fromX = a ? a.x : p.x
    p.fromY = a ? a.y : p.y
    p.toX = b.x
    p.toY = b.y
    p.atNode = toId
  }

  private complete(p: Particle) {
    p.done = true
    if (p.fanout) return // fan-out writes are internal, not user requests
    // Reported latency = queue wait + service + a small per-hop network cost.
    // The travel animation is deliberately excluded: it is pacing for the eye,
    // and counting it drowned the queueing signal this sim exists to show.
    const lat = p.workMs + (p.route.length - 1) * HOP_NET_MS
    this.compl.push(lat)
    if (this.compl.length > 240) this.compl.shift()
    this.servedWin.push(this.now)
  }

  private dropP(p: Particle) {
    p.done = true
    if (!p.fanout) this.dropWin.push(this.now)
  }

  /* ---------- stepping ---------- */
  private step(realMs: number) {
    let dtTotal = Math.min(60, realMs) * this.speed
    dtTotal = Math.min(dtTotal, SUB_MS * 20) // clamp if the tab was backgrounded
    while (dtTotal > 0.001) {
      const dt = Math.min(SUB_MS, dtTotal)
      dtTotal -= dt
      this.microStep(dt)
    }
  }

  private microStep(dt: number) {
    this.now += dt

    // arrivals
    if (!this.stage.map) {
      this.spawnAcc += (this.traffic * dt) / 1000
      while (this.spawnAcc >= 1) {
        this.spawnAcc--
        this.spawn(this.pickType())
      }
    } else {
      this.stepMap(dt)
    }

    // travel
    const travMs = 260
    for (const p of this.particles) {
      if (p.done) continue
      if (p.traveling) {
        p.tprog += dt / travMs
        if (p.tprog >= 1) {
          p.tprog = 1
          p.traveling = false
          const nd = p.atNode ? this.nodes[p.atNode] : undefined
          if (!nd || nd.dead) {
            this.dropP(p)
            continue
          }
          const qmax = this.slots(nd) * 14 + 30
          if (nd.queue.length > qmax) {
            this.dropP(p)
            continue
          }
          p.qAt = this.now
          nd.queue.push(p)
        } else {
          p.x = p.fromX + (p.toX - p.fromX) * ease(p.tprog)
          p.y = p.fromY + (p.toY - p.fromY) * ease(p.tprog)
        }
      }
    }

    // service at each node
    for (const id of this.order) {
      const nd = this.nodes[id]
      if (nd.dead) {
        nd.queue.length = 0
        nd.busy.length = 0
        nd.util = 0
        nd.qdepth = 0
        continue
      }
      const S = this.slots(nd)
      // finish
      for (let i = nd.busy.length - 1; i >= 0; i--) {
        const b = nd.busy[i]
        if (this.now >= b.doneAt) {
          nd.busy.splice(i, 1)
          const p = b.p
          p.workMs += b.doneAt - p.qAt // queue wait + service at this hop
          this.onServiceFinish(nd, p)
          p.hop++
          if (p.hop >= p.route.length - 1) this.complete(p)
          else this.advanceTravel(p, p.route[p.hop], p.route[p.hop + 1])
        }
      }
      // start service
      while (nd.busy.length < S && nd.queue.length > 0) {
        const p = nd.queue.shift()!
        nd.busy.push({ p, doneAt: this.now + this.serviceTimeFor(nd, p) })
      }
      nd.util = nd.busy.length / S
      nd.qdepth = nd.queue.length
    }

    // cleanup done particles EVERY sub-step so the MAX_PARTICLES cap reflects
    // live in-flight load, not an accumulating graveyard of finished requests.
    this.particles = this.particles.filter((p) => !p.done)

    // rolling windows
    this.servedWin = this.servedWin.filter((t) => t > this.now - 1000)
    this.dropWin = this.dropWin.filter((t) => t > this.now - 1000)
    if (this.dropWin.length > 3) this.overloadT = this.now
  }

  /* ---------- snapshot for the HUD ---------- */
  getSnapshot(): Snapshot {
    const servedRps = this.servedWin.length
    const dropRps = this.dropWin.length
    const dropPct = servedRps + dropRps > 0 ? (dropRps / (servedRps + dropRps)) * 100 : 0
    const s = [...this.compl].sort((a, b) => a - b)
    const p50 = s.length ? s[Math.floor(s.length * 0.5)] : 0
    const p95 = s.length ? s[Math.floor(s.length * 0.95)] : 0
    const bars: BarSnapshot[] = this.stage.map
      ? this.mapBars()
      : this.order
          .filter((id) => this.nodes[id].role !== 'src' && this.nodes[id].role !== 'net')
          .map((id) => {
            const nd = this.nodes[id]
            return {
              id,
              label: nd.label.replace('\n', ' '),
              util: nd.util,
              dead: nd.dead,
              qdepth: nd.qdepth,
              kind: nd.kind,
            }
          })
    return {
      stageIdx: this.stageIdx,
      map: !!this.stage.map,
      offeredRps: this.traffic,
      servedRps,
      dropRps,
      dropPct,
      inflight: this.particles.length,
      p50,
      p95,
      overloaded: this.now - this.overloadT < 400 && this.dropWin.length > 3,
      bars,
      ...this.mapStats(),
    }
  }

  /* ============================================================
     RENDER
     ============================================================ */
  private draw() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.W, this.H)
    if (this.stage.map) {
      this.drawMap()
      return
    }
    this.drawEdges()
    for (const p of this.particles) {
      if (p.done) continue
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.fanout ? 3.2 : 4.4, 0, 7)
      ctx.fillStyle = p.color
      ctx.globalAlpha = p.traveling ? 0.95 : 0.55
      ctx.fill()
      ctx.globalAlpha = 1
    }
    for (const id of this.order) this.drawNode(this.nodes[id])
    this.drawBottleneckTag()
  }

  /** Auto-label the hottest node so the eye lands on the lesson. */
  private drawBottleneckTag() {
    let hot: SimNode | null = null
    for (const id of this.order) {
      const nd = this.nodes[id]
      if (nd.role === 'src' || nd.role === 'net' || nd.dead) continue
      if (nd.util >= 0.85 && (!hot || nd.util > hot.util)) hot = nd
    }
    if (!hot) return
    const ctx = this.ctx
    const label = 'BOTTLENECK'
    ctx.font = '800 10px system-ui,sans-serif'
    const w = ctx.measureText(label).width + 16
    const x = hot.x - w / 2
    const y = hot.y - hot.r * 0.72 - 26
    ctx.fillStyle = 'rgba(229,83,59,.16)'
    ctx.strokeStyle = this.colors.hot
    ctx.lineWidth = 1
    this.roundRect(x, y, w, 16, 8, true, true)
    this.txt(label, hot.x, y + 8.5, '#f08a76', 10, 'center', true)
  }

  private roleColor(role: Role): string {
    const c = this.colors
    const map: Record<Role, string> = {
      src: '#6b7488',
      edge: c.edge,
      net: '#6b7488',
      web: c.stateless,
      svc: c.stateless,
      cache: c.cache,
      queue: c.queue,
      db: c.data,
      store: c.store,
      mono: '#c07fe0',
    }
    return map[role]
  }

  protected utilColor(u: number): string {
    return u >= 0.95 ? this.colors.hot : u >= 0.7 ? this.colors.warn : this.colors.good
  }

  private drawEdges() {
    const ctx = this.ctx
    ctx.strokeStyle = 'rgba(255,255,255,.1)'
    ctx.lineWidth = 1.6
    for (const [aId, bId] of this.edgeCache) {
      const a = this.nodes[aId]
      const b = this.nodes[bId]
      if (!a || !b) continue
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
  }

  private drawNode(nd: SimNode) {
    const ctx = this.ctx
    if (nd.role === 'src') {
      ctx.fillStyle = 'rgba(255,255,255,.06)'
      ctx.strokeStyle = 'rgba(255,255,255,.18)'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(nd.x, nd.y, nd.r, 0, 7)
      ctx.fill()
      ctx.stroke()
      this.txt(nd.label, nd.x, nd.y + nd.r + 13 * this.zoom, '#8b93a6', 11 * this.zoom, 'center')
      this.txt(fmtRps(this.traffic), nd.x, nd.y + 3, '#c9cfdc', 12 * this.zoom, 'center', true)
      return
    }
    const col = this.roleColor(nd.role)
    const u = nd.dead ? 0 : nd.util
    const glow = nd.dead ? '#3a3f4d' : this.utilColor(u)
    this.drawQueue(nd)
    ctx.save()
    ctx.shadowColor = nd.dead ? 'transparent' : glow
    ctx.shadowBlur = nd.dead ? 0 : 6 + u * 22
    ctx.fillStyle = nd.dead ? '#1a1d26' : mix('#1a1e28', col, 0.14 + u * 0.1)
    ctx.strokeStyle = nd.dead ? '#3a3f4d' : glow
    ctx.lineWidth = nd.dead ? 1.3 : 1.6 + u * 2.2
    this.roundRect(nd.x - nd.r, nd.y - nd.r * 0.72, nd.r * 2, nd.r * 1.44, 9, true, true)
    ctx.restore()
    if (!nd.dead) {
      ctx.fillStyle = glow
      const bw = (nd.r * 2 - 8) * Math.min(1, u)
      this.roundRect(nd.x - nd.r + 4, nd.y - nd.r * 0.72 - 3, bw, 3.2, 2, true, false)
    }
    const lines = nd.label.split('\n')
    lines.forEach((ln, i) =>
      this.txt(
        ln,
        nd.x,
        nd.y - 4 + (i * 13 - (lines.length - 1) * 6.5) * this.zoom,
        nd.dead ? '#6b7488' : '#eef1f7',
        12.5 * this.zoom,
        'center',
        true,
      ),
    )
    this.txt(
      nd.dead ? 'down' : this.subLabel(nd),
      nd.x,
      nd.y + nd.r * 0.72 + 14 * this.zoom,
      nd.dead ? '#5a6072' : '#9aa3b6',
      11 * this.zoom,
      'center',
    )
    if (nd.dead) this.txt('✕ FAILED', nd.x, nd.y + 2, this.colors.hot, 11 * this.zoom, 'center', true)
  }

  /** Queue depth as a growing bar beside the node — legible at any zoom. */
  private drawQueue(nd: SimNode) {
    const ctx = this.ctx
    if (nd.qdepth <= 0) return
    const maxH = nd.r * 1.9
    const h = Math.max(5, Math.min(1, nd.qdepth / 60) * maxH)
    const hot = nd.qdepth > this.slots(nd) * 4
    const x = nd.x - nd.r - 15
    const y = nd.y + nd.r * 0.72 - h
    ctx.fillStyle = hot ? this.colors.hot : this.colors.warn
    ctx.globalAlpha = 0.85
    this.roundRect(x, y, 8, h, 3, true, false)
    ctx.globalAlpha = 1
    if (nd.qdepth >= 5)
      this.txt(String(Math.min(nd.qdepth, 999)), x + 4, y - 9, hot ? '#f08a76' : '#f0be5a', 10.5, 'center', true)
  }

  /* ---------- canvas helpers ---------- */
  protected roundRect(x: number, y: number, w: number, h: number, r: number, f: boolean, s: boolean) {
    const ctx = this.ctx
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
    if (f) ctx.fill()
    if (s) ctx.stroke()
  }

  protected txt(
    t: string,
    x: number,
    y: number,
    c: string,
    size: number,
    align: CanvasTextAlign = 'left',
    bold = false,
  ) {
    const ctx = this.ctx
    ctx.fillStyle = c
    ctx.font = (bold ? '700 ' : '') + size + 'px system-ui,sans-serif'
    ctx.textAlign = align
    ctx.textBaseline = 'middle'
    ctx.fillText(t, x, y)
  }
}
