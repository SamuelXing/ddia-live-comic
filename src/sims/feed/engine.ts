/* ============================================================
   Feed at Scale — discrete-event simulation engine.
   Every node is a queue with N concurrent service slots.
   Requests are particles; when arrivals outrun slots, queues
   back up and latency climbs — the animation IS the math.

   Framework-agnostic: owns the canvas + rAF loop; React reads
   snapshots and calls setters.
   ============================================================ */
import { FANOUT_COLOR, REQ, STAGES, TEMPLATES } from './model'
import type { NodeTpl, ReqType, Role, StageDef } from './model'

export const RPS_PER_UNIT = 60 // 1 simulated "unit" of load ≈ 60 req/s for display
const MAX_PARTICLES = 900
const SUB_MS = 25 // fixed sim resolution; every serviceMs >= this

export interface Particle {
  type: ReqType
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
  fanout: boolean
  done: boolean
}

/** Fixed per-hop network cost added to reported latency (ms). */
const HOP_NET_MS = 5

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

interface Region {
  name: string
  x: number
  y: number
  load: number
  dead: boolean
  util: number
}

interface Pulse {
  from: Region
  to: Region
  t: number
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

function mix(a: string, b: string, t: number): string {
  const pa = hx(a)
  const pb = hx(b)
  return `rgb(${Math.round(pa[0] + (pb[0] - pa[0]) * t)},${Math.round(pa[1] + (pb[1] - pa[1]) * t)},${Math.round(pa[2] + (pb[2] - pa[2]) * t)})`
}

export class FeedEngine {
  private cvs: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private W = 0
  private H = 0

  // model state
  stageIdx = 0
  stage: StageDef = STAGES[0]
  private nodes: Record<string, SimNode> = {}
  private order: string[] = []
  private particles: Particle[] = []

  // knobs
  traffic = 48
  cacheHit = 0.85
  writeShare = 0.18
  running = true
  speed = 6
  celeb = false

  // internals
  private now = 0
  private spawnAcc = 0
  private overloadT = -10000
  private compl: number[] = []
  private servedWin: number[] = []
  private dropWin: number[] = []

  // global map
  regions = 3
  replLag = 0.12
  private REG: Region[] = []
  private pulses: Pulse[] = []

  private raf = 0
  private lastReal = 0
  private colors: Record<string, string> = {}
  private edgeCache: Array<[string, string]> = []

  constructor(canvas: HTMLCanvasElement) {
    this.cvs = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    this.ctx = ctx
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
    this.stage = STAGES[i]
    this.nodes = {}
    this.order = []
    this.particles = []
    this.pulses = []
    this.compl = []
    this.servedWin = []
    this.dropWin = []
    this.spawnAcc = 0

    if (!this.stage.map) {
      this.stage.nodes.forEach((id) => {
        const tpl = TEMPLATES[id]
        this.nodes[id] = this.makeNode(tpl)
        this.order.push(id)
      })
    }
    // Later stages assume the web tier was already scaled out,
    // so the data tier is the star of the lesson.
    const web = this.stage.web ?? 2
    ;['gw', 'svcTL', 'svcPost', 'svcInt', 'svcMedia'].forEach((id) => {
      if (this.nodes[id]) this.nodes[id].instances = web
    })
    if (this.nodes.pgR) this.nodes.pgR.instances = 2
    if (this.nodes.redis) this.nodes.redis.shards = 1
    if (this.nodes.pgP) this.nodes.pgP.shards = 1
    if (this.nodes.kafka) this.nodes.kafka.partitions = 8
    if (this.nodes.svcFan) this.nodes.svcFan.instances = 1
    this.celeb = false
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

  /* ---------- capacity model ---------- */
  private slots(nd: SimNode): number {
    let s = nd.instances * nd.slotsPer
    if (nd.kind === 'redis') s = nd.slotsPer * nd.shards
    if (nd.kind === 'pgP') s = nd.slotsPer * nd.shards
    if (nd.kind === 'pgR') s = nd.slotsPer * nd.instances
    if (nd.kind === 'fanout') {
      // fan-out consumer parallelism is HARD-CAPPED by Kafka partition count
      const parts = this.nodes.kafka ? this.nodes.kafka.partitions : 8
      s = Math.max(2, Math.round(parts * 1.4))
    }
    return Math.max(1, s)
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
    // Content is capped, centered, and sized by how many columns this stage
    // actually uses — two nodes sit near each other, not at opposite walls.
    const padX = 70
    const span = colKeys.length - 1
    const cap = Math.min(1180, Math.max(260, span * 250))
    const usableW = Math.min(Math.max(260, this.W - padX * 2), cap)
    const x0 = (this.W - usableW) / 2
    colKeys.forEach((c, ci) => {
      const ids = cols[c]
      const x = x0 + (span < 1 ? usableW / 2 : (ci / span) * usableW)
      const n = ids.length
      ids.forEach((id, k) => {
        const y = this.H * 0.14 + (n === 1 ? this.H * 0.36 : (k / (n - 1)) * this.H * 0.66)
        this.nodes[id].x = x
        this.nodes[id].y = y
        this.nodes[id].r = id === 'mono' ? 48 : this.nodes[id].role === 'src' ? 23 : 31
      })
    })
  }

  private layoutMap() {
    const spots = [
      { x: 0.22, y: 0.42, name: 'us-east' },
      { x: 0.5, y: 0.32, name: 'eu-west' },
      { x: 0.78, y: 0.5, name: 'ap-south' },
      { x: 0.36, y: 0.68, name: 'sa-east' },
      { x: 0.64, y: 0.75, name: 'ap-se' },
    ]
    this.REG = spots.slice(0, this.regions).map((s) => ({
      name: s.name,
      x: s.x * this.W,
      y: s.y * this.H,
      load: 0,
      dead: false,
      util: 0,
    }))
    this.pulses = []
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
    if (this.nodes.kafka && this.nodes.svcFan) edges.push(['kafka', 'svcFan'])
    if (this.nodes.svcFan && this.nodes.redis) edges.push(['svcFan', 'redis'])
    this.edgeCache = edges
  }

  /* ---------- knob setters ---------- */
  setWebInstances(n: number) {
    ;['gw', 'svcTL', 'svcPost', 'svcInt', 'svcMedia'].forEach((id) => {
      if (this.nodes[id]) this.nodes[id].instances = n
    })
  }
  setReplicas(n: number) {
    if (this.nodes.pgR) this.nodes.pgR.instances = n
  }
  setPartitions(n: number) {
    if (this.nodes.kafka) this.nodes.kafka.partitions = n
  }
  setPgShards(n: number) {
    if (this.nodes.pgP) this.nodes.pgP.shards = n
  }
  setRedisShards(n: number) {
    if (this.nodes.redis) this.nodes.redis.shards = n
  }
  setRegions(n: number) {
    this.regions = n
    if (this.stage.map) this.layoutMap()
  }

  spike() {
    if (this.stage.map) {
      this.REG.forEach((r) => (r.load = Math.min(1, r.load + 0.6)))
    }
  }

  killNode() {
    if (this.stage.map) {
      const alive = this.REG.filter((r) => !r.dead)
      if (alive.length > 1) {
        const victim = alive[0]
        victim.dead = true
        setTimeout(() => {
          victim.dead = false
        }, 6000)
      }
      return
    }
    const cand = ['pgP', 'redis', 'kafka', 'svcFan', 'gw'].find(
      (id) => this.nodes[id] && !this.nodes[id].dead,
    )
    if (cand) {
      const nd = this.nodes[cand]
      nd.dead = true
      setTimeout(() => {
        nd.dead = false
      }, 6000)
    }
  }

  /* ---------- particle plumbing ---------- */
  private pickType(): ReqType {
    const ws = this.writeShare
    const w: Record<ReqType, number> = {
      read: 1 - ws,
      post: ws * 0.34,
      like: ws * 0.6,
      media: (1 - ws) * 0.025,
    }
    const tot = w.read + w.post + w.like + w.media
    let r = Math.random() * tot
    for (const k of ['read', 'post', 'like', 'media'] as ReqType[]) {
      r -= w[k]
      if (r <= 0) return k
    }
    return 'read'
  }

  private spawn(type: ReqType) {
    if (this.particles.length >= MAX_PARTICLES) {
      this.dropWin.push(this.now)
      return
    }
    const routeMap = this.stage.routes({ cacheHit: this.cacheHit })
    const route = routeMap[type]
    if (!route) return
    const src = this.nodes[route[0]]
    const p: Particle = {
      type,
      color: REQ[type].color,
      route,
      hop: 0,
      born: this.now,
      workMs: 0,
      qAt: 0,
      x: src ? src.x : 60,
      y: src ? src.y + (Math.random() * 40 - 20) : this.H / 2,
      traveling: true,
      tprog: 0,
      fromX: src ? src.x : 60,
      fromY: src ? src.y : this.H / 2,
      toX: 0,
      toY: 0,
      atNode: null,
      fanout: false,
      done: false,
    }
    this.advanceTravel(p, route[0], route[1])
    this.particles.push(p)
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
          // kafka: spawn fan-out burst
          if (nd.kind === 'kafka' && p.type === 'post') {
            const celebHit = this.celeb && Math.random() < 0.14
            const fcount = celebHit ? 46 : 5
            for (let k = 0; k < fcount; k++) {
              if (this.particles.length >= MAX_PARTICLES) break
              const fp: Particle = {
                type: 'post',
                color: FANOUT_COLOR,
                route: ['svcFan', 'redis'],
                hop: 0,
                born: this.now,
                workMs: 0,
                qAt: 0,
                x: nd.x,
                y: nd.y,
                traveling: true,
                tprog: 0,
                fromX: nd.x,
                fromY: nd.y,
                toX: 0,
                toY: 0,
                atNode: null,
                fanout: true,
                done: false,
              }
              this.advanceTravel(fp, 'kafka', 'svcFan')
              this.particles.push(fp)
            }
          }
          p.hop++
          if (p.hop >= p.route.length - 1) this.complete(p)
          else this.advanceTravel(p, p.route[p.hop], p.route[p.hop + 1])
        }
      }
      // start service
      while (nd.busy.length < S && nd.queue.length > 0) {
        const p = nd.queue.shift()!
        let sm = nd.serviceMs * (0.65 + Math.random() * 0.7) // service-time jitter → honest p95 > p50
        // hot key: viral like/post traffic concentrates on one shard
        if (nd.kind === 'redis' && this.celeb && Math.random() < 0.14) sm *= 6
        if (nd.kind === 'pgP' && this.celeb && p.type === 'post' && Math.random() < 0.1) sm *= 4
        nd.busy.push({ p, doneAt: this.now + sm })
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

  private stepMap(dt: number) {
    this.spawnAcc += (90 * dt) / 1000
    const alive = this.REG.filter((r) => !r.dead)
    while (this.spawnAcc >= 1 && alive.length) {
      this.spawnAcc--
      const r = alive[Math.floor(Math.random() * alive.length)]
      r.load = Math.min(1, r.load + 0.03)
      if (Math.random() < 0.22) {
        alive.forEach((o) => {
          if (o !== r) this.pulses.push({ from: r, to: o, t: 0 })
        })
      }
    }
    this.REG.forEach((r) => {
      r.load *= Math.pow(0.5, dt / 900)
      r.util = r.load
    })
    const spd = dt / (900 + this.replLag * 3400)
    this.pulses.forEach((pu) => (pu.t += spd))
    this.pulses = this.pulses.filter((pu) => pu.t < 1)
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
      ? this.REG.map((r) => ({ id: r.name, label: r.name, util: r.util, dead: r.dead, qdepth: 0 }))
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
      regions: this.regions,
      regionsAlive: this.REG.filter((r) => !r.dead).length,
      replLagMs: Math.round(40 + this.replLag * 360),
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

  private utilColor(u: number): string {
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
      this.txt(nd.label, nd.x, nd.y + nd.r + 13, '#8b93a6', 11, 'center')
      this.txt(fmtRps(this.traffic), nd.x, nd.y + 3, '#c9cfdc', 12, 'center', true)
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
        nd.y - 4 + i * 13 - (lines.length - 1) * 6.5,
        nd.dead ? '#6b7488' : '#eef1f7',
        12.5,
        'center',
        true,
      ),
    )
    this.txt(this.subLabel(nd), nd.x, nd.y + nd.r * 0.72 + 14, nd.dead ? '#5a6072' : '#9aa3b6', 11, 'center')
    if (nd.dead) this.txt('✕ FAILED', nd.x, nd.y + 2, this.colors.hot, 11, 'center', true)
  }

  private subLabel(nd: SimNode): string {
    const uP = Math.round(nd.util * 100) + '%'
    if (nd.dead) return 'down'
    if (nd.kind === 'pgP') return (nd.shards > 1 ? nd.shards + ' shards · ' : '1 primary · ') + uP
    if (nd.kind === 'redis') return (nd.shards > 1 ? nd.shards + ' shards · ' : '1 node · ') + uP
    if (nd.kind === 'pgR') return nd.instances + ' replica' + (nd.instances > 1 ? 's' : '') + ' · ' + uP
    if (nd.kind === 'kafka') return nd.partitions + ' partitions'
    if (nd.scalable === 'web') return nd.instances + '× · ' + uP
    if (nd.kind === 'fanout') return 'lag ' + nd.qdepth + ' · ' + uP
    return uP
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

  private drawMap() {
    const ctx = this.ctx
    ctx.strokeStyle = 'rgba(255,255,255,.05)'
    ctx.lineWidth = 1
    for (let gx = 0; gx < this.W; gx += 70) {
      ctx.beginPath()
      ctx.moveTo(gx, 0)
      ctx.lineTo(gx, this.H)
      ctx.stroke()
    }
    for (let gy = 0; gy < this.H; gy += 70) {
      ctx.beginPath()
      ctx.moveTo(0, gy)
      ctx.lineTo(this.W, gy)
      ctx.stroke()
    }
    this.pulses.forEach((pu) => {
      const x = pu.from.x + (pu.to.x - pu.from.x) * pu.t
      const y = pu.from.y + (pu.to.y - pu.from.y) * pu.t
      ctx.strokeStyle = 'rgba(144,133,233,.25)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(pu.from.x, pu.from.y)
      ctx.lineTo(pu.to.x, pu.to.y)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, y, 3.2, 0, 7)
      ctx.fillStyle = '#9085e9'
      ctx.fill()
    })
    this.REG.forEach((r) => {
      const glow = r.dead ? '#3a3f4d' : this.utilColor(r.util)
      ctx.save()
      ctx.shadowColor = r.dead ? 'transparent' : glow
      ctx.shadowBlur = r.dead ? 0 : 14 + r.util * 26
      ctx.fillStyle = r.dead ? '#1a1d26' : mix('#1a1e28', glow, 0.16)
      ctx.strokeStyle = glow
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(r.x, r.y, 40, 0, 7)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
      this.txt(r.name, r.x, r.y - 2, r.dead ? '#6b7488' : '#eef1f7', 13, 'center', true)
      this.txt(r.dead ? '✕ down' : 'region', r.x, r.y + 14, r.dead ? this.colors.hot : '#8b93a6', 10.5, 'center')
      if (!r.dead) {
        for (let i = 0; i < 3; i++) {
          const a = this.now / 600 + i * 2.1
          ctx.fillStyle = 'rgba(57,135,229,.6)'
          ctx.beginPath()
          ctx.arc(r.x + Math.cos(a) * 58, r.y + Math.sin(a) * 58, 2.4, 0, 7)
          ctx.fill()
        }
      }
    })
    this.txt(
      'Cross-region replication lag ≈ ' + Math.round(40 + this.replLag * 360) + ' ms',
      this.W / 2,
      this.H - 24,
      '#aab2c5',
      12.5,
      'center',
      true,
    )
  }

  /* ---------- canvas helpers ---------- */
  private roundRect(x: number, y: number, w: number, h: number, r: number, f: boolean, s: boolean) {
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

  private txt(
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
