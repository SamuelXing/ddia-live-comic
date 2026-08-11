/* ============================================================
   Feed at Scale — what this sim adds to the shared engine.

   The queueing simulation, layout and rendering live in
   ../engine.ts. Here: the capacity rules for a social feed's
   data tier (Redis shards, Postgres shards and replicas,
   Kafka partitions capping fan-out consumers), the celebrity
   hot-key mechanic, the fan-out burst a post triggers, and the
   multi-region map stage.
   ============================================================ */
import { FANOUT_COLOR, REQ, STAGES, TEMPLATES } from './model'
import type { ReqType, StageDef } from './model'
import { SimEngine, mix } from '../engine'
import type { BarSnapshot, Particle, SimNode } from '../engine'

export { RPS_PER_UNIT, fmtRps } from '../engine'
export type { Particle, SimNode, BarSnapshot, Snapshot } from '../engine'

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

export class FeedEngine extends SimEngine<StageDef> {
  celeb = false

  // global map
  regions = 3
  replLag = 0.12
  private REG: Region[] = []
  private pulses: Pulse[] = []
  private spawnAccMap = 0

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, { stages: STAGES, templates: TEMPLATES, colorOf: (t) => REQ[t as ReqType].color })
  }

  /* ---------- stage setup ---------- */
  protected onStageSet() {
    this.pulses = []
    this.spawnAccMap = 0
    // Later stages assume the web tier was already scaled out,
    // so the data tier is the star of the lesson.
    const web = this.stage.web ?? 2
    this.setWebInstances(web)
    if (this.node('pgR')) this.node('pgR')!.instances = 2
    if (this.node('redis')) this.node('redis')!.shards = 1
    if (this.node('pgP')) this.node('pgP')!.shards = 1
    if (this.node('kafka')) this.node('kafka')!.partitions = 8
    if (this.node('svcFan')) this.node('svcFan')!.instances = 1
    this.celeb = false
  }

  /* ---------- capacity model ---------- */
  protected slots(nd: SimNode): number {
    let s = nd.instances * nd.slotsPer
    if (nd.kind === 'redis') s = nd.slotsPer * nd.shards
    if (nd.kind === 'pgP') s = nd.slotsPer * nd.shards
    if (nd.kind === 'pgR') s = nd.slotsPer * nd.instances
    if (nd.kind === 'fanout') {
      // fan-out consumer parallelism is HARD-CAPPED by Kafka partition count
      const parts = this.node('kafka')?.partitions ?? 8
      s = Math.max(2, Math.round(parts * 1.4))
    }
    return Math.max(1, s)
  }

  /** Celebrity traffic concentrates on one shard — the hot key, as service time. */
  protected serviceTimeFor(nd: SimNode, p: Particle): number {
    let sm = super.serviceTimeFor(nd, p)
    if (nd.kind === 'redis' && this.celeb && Math.random() < 0.14) sm *= 6
    if (nd.kind === 'pgP' && this.celeb && p.type === 'post' && Math.random() < 0.1) sm *= 4
    return sm
  }

  /** A post committed to the log fans out to every follower's timeline cache. */
  protected onServiceFinish(nd: SimNode, p: Particle) {
    if (nd.kind !== 'kafka' || p.type !== 'post') return
    const celebHit = this.celeb && Math.random() < 0.14
    const fcount = celebHit ? 46 : 5
    for (let k = 0; k < fcount; k++) {
      if (!this.emit('post', FANOUT_COLOR, ['svcFan', 'redis'], { fanout: true, from: 'kafka' })) break
    }
  }

  protected subLabel(nd: SimNode): string {
    const uP = Math.round(nd.util * 100) + '%'
    if (nd.kind === 'pgP') return (nd.shards > 1 ? nd.shards + ' shards · ' : '1 primary · ') + uP
    if (nd.kind === 'redis') return (nd.shards > 1 ? nd.shards + ' shards · ' : '1 node · ') + uP
    if (nd.kind === 'pgR') return nd.instances + ' replica' + (nd.instances > 1 ? 's' : '') + ' · ' + uP
    if (nd.kind === 'kafka') return nd.partitions + ' partitions'
    if (nd.scalable === 'web') return nd.instances + '× · ' + uP
    if (nd.kind === 'fanout') return 'lag ' + nd.qdepth + ' · ' + uP
    return uP
  }

  protected killCandidates(): string[] {
    return ['pgP', 'redis', 'kafka', 'svcFan', 'gw']
  }

  /** The fan-out consumer reads from the log; no request route walks that edge. */
  protected extraEdges(): Array<[string, string]> {
    return [
      ['kafka', 'svcFan'],
      ['svcFan', 'redis'],
    ]
  }

  protected pickType(): ReqType {
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

  /* ---------- knob setters ---------- */
  setWebInstances(n: number) {
    ;['gw', 'svcTL', 'svcPost', 'svcInt', 'svcMedia'].forEach((id) => {
      const nd = this.node(id)
      if (nd) nd.instances = n
    })
  }
  setReplicas(n: number) {
    const nd = this.node('pgR')
    if (nd) nd.instances = n
  }
  setPartitions(n: number) {
    const nd = this.node('kafka')
    if (nd) nd.partitions = n
  }
  setPgShards(n: number) {
    const nd = this.node('pgP')
    if (nd) nd.shards = n
  }
  setRedisShards(n: number) {
    const nd = this.node('redis')
    if (nd) nd.shards = n
  }
  setRegions(n: number) {
    this.regions = n
    if (this.stage.map) this.layoutMap()
  }

  spike() {
    if (this.stage.map) this.REG.forEach((r) => (r.load = Math.min(1, r.load + 0.6)))
  }

  /* ============================================================
     THE MAP STAGE — regions instead of a topology.
     ============================================================ */
  protected layoutMap() {
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

  protected killInMap(): boolean {
    if (!this.stage.map) return false
    const alive = this.REG.filter((r) => !r.dead)
    if (alive.length > 1) {
      const victim = alive[0]
      victim.dead = true
      setTimeout(() => {
        victim.dead = false
      }, 6000)
    }
    return true
  }

  protected mapBars(): BarSnapshot[] {
    return this.REG.map((r) => ({ id: r.name, label: r.name, util: r.util, dead: r.dead, qdepth: 0 }))
  }

  protected mapStats() {
    return {
      regions: this.regions,
      regionsAlive: this.REG.filter((r) => !r.dead).length,
      replLagMs: Math.round(40 + this.replLag * 360),
    }
  }

  protected stepMap(dt: number) {
    this.spawnAccMap += (90 * dt) / 1000
    const alive = this.REG.filter((r) => !r.dead)
    while (this.spawnAccMap >= 1 && alive.length) {
      this.spawnAccMap--
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

  protected drawMap() {
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
}
