import { useEffect, useRef, useState } from 'react'
import { VIZ, mixHex } from '../../styles/viz'

/* ============================================================
   ClusterZoom — a stepped, animated top-down zoom into a Kafka
   deployment: regions → availability zones → rack-aware cluster
   → blast radius → inside one broker. Camera scale/pans between
   levels; the AZ level is interactive (fail a zone and watch
   rack-aware placement survive). All drawing is done in SCREEN
   space (world coords converted per frame) so line widths and
   fonts stay crisp at any zoom.
   ============================================================ */

const ASPECT = 0.52
const AZ_OF: Record<string, string> = { bA1: 'az-a', bA2: 'az-a', bB1: 'az-b', bB2: 'az-b', bC1: 'az-c', bC2: 'az-c' }

interface Box {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
}
interface Replica {
  role: 'L' | 'F'
  broker: string
}

const REGIONS: Box[] = [
  { id: 'us-east', name: 'us-east', x: 60, y: 230, w: 320, h: 300 },
  { id: 'eu-west', name: 'eu-west', x: 460, y: 150, w: 300, h: 280 },
  { id: 'ap-south', name: 'ap-south', x: 830, y: 290, w: 320, h: 300 },
]
const AZS: Box[] = [
  { id: 'az-a', name: 'Zone A', x: 80, y: 250, w: 280, h: 82 },
  { id: 'az-b', name: 'Zone B', x: 80, y: 348, w: 280, h: 82 },
  { id: 'az-c', name: 'Zone C', x: 80, y: 446, w: 280, h: 82 },
]
const BROKERS: Box[] = [
  { id: 'bA1', name: 'broker 1', x: 100, y: 270, w: 92, h: 44 },
  { id: 'bA2', name: 'broker 2', x: 214, y: 270, w: 92, h: 44 },
  { id: 'bB1', name: 'broker 3', x: 100, y: 368, w: 92, h: 44 },
  { id: 'bB2', name: 'broker 4', x: 214, y: 368, w: 92, h: 44 },
  { id: 'bC1', name: 'broker 5', x: 100, y: 466, w: 92, h: 44 },
  { id: 'bC2', name: 'broker 6', x: 214, y: 466, w: 92, h: 44 },
]
const PLACEMENTS: Record<'rack' | 'naive', Replica[]> = {
  rack: [
    { role: 'L', broker: 'bA1' },
    { role: 'F', broker: 'bB1' },
    { role: 'F', broker: 'bC1' },
  ],
  naive: [
    { role: 'L', broker: 'bA1' },
    { role: 'F', broker: 'bA2' },
    { role: 'F', broker: 'bB1' },
  ],
}
// internal partition slots drawn inside broker 1 at the deepest zoom
const SLOTS = [
  { name: 'P3 · leader', x: 108, y: 277, w: 76, h: 9 },
  { name: 'P7 · follower', x: 108, y: 289, w: 76, h: 9 },
  { name: 'P12 · follower', x: 108, y: 301, w: 76, h: 9 },
]

interface Step {
  title: string
  prose: string
  frame: Box
  interactive?: 'az' | 'broker'
}
const STEPS: Step[] = [
  {
    title: 'Regions',
    prose:
      'Kafka does not span regions automatically. Each region is an <b>independent deployment</b>; you mirror topics between them (MirrorMaker 2 / Cluster Linking) for geo-distribution and disaster recovery.',
    frame: { id: 'world', name: '', x: 0, y: 0, w: 1200, h: 760 },
  },
  {
    title: 'Inside a region: availability zones',
    prose:
      'A region is several <b>availability zones</b> — separate power, network, and cooling. A whole zone can fail at once, so the zone is the failure domain that placement has to respect.',
    frame: { id: 'r', name: '', x: 50, y: 220, w: 340, h: 320 },
  },
  {
    title: 'Rack-aware placement',
    prose:
      'A cluster’s brokers span the zones. Kafka places a partition’s replicas in <b>different zones</b> (rack awareness) so no single zone loss can take it offline. <b>Fail a zone below</b> — rack-aware keeps 2 of 3 replicas alive and the partition stays available. Flip to naive placement (two replicas in one zone) and the same failure takes it offline.',
    frame: { id: 'az', name: '', x: 68, y: 244, w: 300, h: 292 },
    interactive: 'az',
  },
  {
    title: 'Blast radius',
    prose:
      'Even with good placement, cluster <b>size</b> matters. When a broker dies its partitions re-replicate onto the survivors — the bigger the cluster, the more correlated damage and the longer the rebuild. That’s why the giants run <b>many bounded clusters</b> (federation), not one huge one.',
    frame: { id: 'grid', name: '', x: 86, y: 256, w: 236, h: 272 },
    interactive: 'broker',
  },
  {
    title: 'Into the broker',
    prose:
      'Zoom all the way in and a broker is just holding <b>partition replicas</b> — some leaders, some followers, each an append-only log. Inside this box is the machinery from <b>Chapter 2</b>: the network threads, the page cache, the sequential append. The zoom bottoms out exactly where the anatomy began.',
    frame: { id: 'broker', name: '', x: 96, y: 262, w: 112, h: 62 },
  },
]

type Cam = { scale: number; tx: number; ty: number }
function frameToCam(f: Box, W: number, H: number): Cam {
  const scale = Math.min(W / f.w, H / f.h) * 0.9
  return { scale, tx: W / 2 - (f.x + f.w / 2) * scale, ty: H / 2 - (f.y + f.h / 2) * scale }
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export default function ClusterZoom() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [step, setStep] = useState(0)
  const [placement, setPlacement] = useState<'rack' | 'naive'>('rack')
  const [deadAz, setDeadAz] = useState<string | null>(null)
  const [deadBroker, setDeadBroker] = useState<string | null>(null)

  // refs mirrored for the rAF closure
  const stepRef = useRef(0)
  const placeRef = useRef<'rack' | 'naive'>('rack')
  const deadAzRef = useRef<string | null>(null)
  const deadBrokerRef = useRef<string | null>(null)
  stepRef.current = step
  placeRef.current = placement
  deadAzRef.current = deadAz
  deadBrokerRef.current = deadBroker

  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')
    if (!ctx) return
    let W = 0
    let H = 0
    let dpr = 1
    let raf = 0
    const cam: Cam = { scale: 0, tx: 0, ty: 0 }
    let camInit = false
    const op: Record<string, number> = { az: 0, broker: 0, replica: 0, internal: 0, mirror: 1 }

    function size() {
      if (!cvs || !ctx) return
      dpr = Math.min(2, window.devicePixelRatio || 1)
      const r = cvs.getBoundingClientRect()
      W = r.width
      H = r.width * ASPECT
      cvs.style.height = H + 'px'
      cvs.width = W * dpr
      cvs.height = H * dpr
      camInit = false // recenter on resize
    }
    size()
    const ro = new ResizeObserver(size)
    ro.observe(cvs)

    const brokerDead = (id: string) => deadBrokerRef.current === id || deadAzRef.current === AZ_OF[id]

    function draw() {
      if (!ctx) return
      const s = stepRef.current
      const target = frameToCam(STEPS[s].frame, W, H)
      if (!camInit) {
        cam.scale = target.scale
        cam.tx = target.tx
        cam.ty = target.ty
        camInit = true
      } else {
        cam.scale = lerp(cam.scale, target.scale, 0.14)
        cam.tx = lerp(cam.tx, target.tx, 0.14)
        cam.ty = lerp(cam.ty, target.ty, 0.14)
      }
      // target opacities by step
      const tOp: Record<string, number> = {
        az: s >= 1 ? 1 : 0,
        broker: s >= 2 ? 1 : 0,
        replica: s >= 2 ? 1 : 0,
        internal: s >= 4 ? 1 : 0,
        mirror: s === 0 ? 1 : s === 1 ? 0.22 : 0,
      }
      for (const k in op) op[k] = lerp(op[k], tOp[k], 0.16)

      const SX = (wx: number) => wx * cam.scale + cam.tx
      const SY = (wy: number) => wy * cam.scale + cam.ty
      const SW = (ww: number) => ww * cam.scale

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const rr = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.arcTo(x + w, y, x + w, y + h, r)
        ctx.arcTo(x + w, y + h, x, y + h, r)
        ctx.arcTo(x, y + h, x, y, r)
        ctx.arcTo(x, y, x + w, y, r)
        ctx.closePath()
      }
      const label = (t: string, cx: number, cy: number, col: string, fs = 12, bold = true) => {
        ctx.fillStyle = col
        ctx.font = (bold ? '700 ' : '') + fs + 'px system-ui,sans-serif'
        ctx.fillText(t, cx, cy)
      }

      // mirror links between regions (global view)
      if (op.mirror > 0.02) {
        ctx.globalAlpha = op.mirror
        ctx.strokeStyle = 'rgba(144,133,233,.5)'
        ctx.lineWidth = 1.4
        ctx.setLineDash([5, 5])
        for (let i = 0; i < REGIONS.length - 1; i++) {
          const a = REGIONS[i]
          const b = REGIONS[i + 1]
          ctx.beginPath()
          ctx.moveTo(SX(a.x + a.w), SY(a.y + a.h / 2))
          ctx.lineTo(SX(b.x), SY(b.y + b.h / 2))
          ctx.stroke()
        }
        ctx.setLineDash([])
        ctx.globalAlpha = 1
      }

      // regions
      REGIONS.forEach((rg) => {
        const x = SX(rg.x)
        const y = SY(rg.y)
        const w = SW(rg.w)
        const h = SW(rg.h)
        if (x + w < -20 || x > W + 20) return
        ctx.fillStyle = 'rgba(57,135,229,.06)'
        ctx.strokeStyle = 'rgba(90,162,240,.4)'
        ctx.lineWidth = 1.4
        rr(x, y, w, h, 12)
        ctx.fill()
        ctx.stroke()
        if (w > 46) label(rg.name, x + w / 2, y + (op.az > 0.4 ? 14 : h / 2), op.az > 0.4 ? '#7f8aa3' : '#cdd4e2', 12)
      })

      // AZs
      if (op.az > 0.02) {
        ctx.globalAlpha = op.az
        AZS.forEach((az) => {
          const dead = deadAzRef.current === az.id
          const x = SX(az.x)
          const y = SY(az.y)
          const w = SW(az.w)
          const h = SW(az.h)
          ctx.fillStyle = dead ? 'rgba(229,83,59,.1)' : 'rgba(255,255,255,.03)'
          ctx.strokeStyle = dead ? 'rgba(229,83,59,.6)' : 'rgba(255,255,255,.16)'
          ctx.lineWidth = 1.3
          ctx.setLineDash([4, 4])
          rr(x, y, w, h, 9)
          ctx.fill()
          ctx.stroke()
          ctx.setLineDash([])
          if (w > 60) label(dead ? az.name + ' — DOWN' : az.name, x + 30, y + 11, dead ? '#f08a76' : '#8b93a6', 10.5)
        })
        ctx.globalAlpha = 1
      }

      // brokers
      if (op.broker > 0.02) {
        ctx.globalAlpha = op.broker
        BROKERS.forEach((b) => {
          const dead = brokerDead(b.id)
          const x = SX(b.x)
          const y = SY(b.y)
          const w = SW(b.w)
          const h = SW(b.h)
          ctx.save()
          if (!dead && op.internal < 0.4) {
            ctx.shadowColor = 'rgba(57,135,229,.35)'
            ctx.shadowBlur = 7
          }
          const bg = ctx.createLinearGradient(0, y, 0, y + h)
          bg.addColorStop(0, dead ? '#2a1620' : mixHex(VIZ.nodeFillTop, VIZ.blue, 0.1))
          bg.addColorStop(1, dead ? '#20121a' : VIZ.nodeFillBottom)
          ctx.fillStyle = bg
          rr(x, y, w, h, 7)
          ctx.fill()
          ctx.shadowBlur = 0
          ctx.strokeStyle = dead ? 'rgba(229,83,59,.6)' : 'rgba(90,162,240,.5)'
          ctx.lineWidth = 1.3
          ctx.stroke()
          ctx.restore()
          if (w > 50 && op.internal < 0.4) label(b.name, x + w / 2, y + h / 2, dead ? '#6b7488' : '#cdd4e2', 11)
          if (dead && w > 50) label('✕', x + w - 12, y + 12, '#f08a76', 13)
        })
        ctx.globalAlpha = 1
      }

      // replica placement (ISR lines + badges)
      if (op.replica > 0.02 && op.internal < 0.5) {
        const reps = PLACEMENTS[placeRef.current]
        // badge straddles the broker's top-right edge — above the centered label
        const pos = (brokerId: string) => {
          const b = BROKERS.find((x) => x.id === brokerId)!
          return { x: SX(b.x + b.w) - 15, y: SY(b.y) }
        }
        ctx.globalAlpha = op.replica
        // lines from leader to followers
        const leader = reps.find((r) => r.role === 'L')!
        const lp = pos(leader.broker)
        ctx.strokeStyle = 'rgba(26,164,110,.55)'
        ctx.lineWidth = 1.6
        reps
          .filter((r) => r.role === 'F')
          .forEach((r) => {
            const fp = pos(r.broker)
            ctx.beginPath()
            ctx.moveTo(lp.x, lp.y)
            ctx.lineTo(fp.x, fp.y)
            ctx.stroke()
          })
        reps.forEach((r) => {
          const p = pos(r.broker)
          const dead = brokerDead(r.broker)
          ctx.beginPath()
          ctx.arc(p.x, p.y, 9, 0, 7)
          ctx.fillStyle = dead ? '#3a2020' : r.role === 'L' ? VIZ.green : mixHex(VIZ.green, '#000000', 0.4)
          ctx.strokeStyle = dead ? VIZ.red : VIZ.surface
          ctx.lineWidth = 2
          ctx.fill()
          ctx.stroke()
          label(dead ? '✕' : r.role, p.x, p.y + 0.5, dead ? '#f08a76' : '#fff', 10)
        })
        ctx.globalAlpha = 1
      }

      // broker internals (deepest zoom)
      if (op.internal > 0.02) {
        ctx.globalAlpha = op.internal
        SLOTS.forEach((sl, i) => {
          const x = SX(sl.x)
          const y = SY(sl.y)
          const w = SW(sl.w)
          const h = SW(sl.h)
          ctx.fillStyle = i === 0 ? 'rgba(26,164,110,.2)' : 'rgba(57,135,229,.14)'
          ctx.strokeStyle = i === 0 ? 'rgba(26,164,110,.6)' : 'rgba(90,162,240,.5)'
          ctx.lineWidth = 1.2
          rr(x, y, w, h, 3)
          ctx.fill()
          ctx.stroke()
          if (w > 90) label(sl.name, x + w / 2, y + h / 2, '#dbe2ef', 9.5, false)
        })
        if (op.internal > 0.5) label('↳ inside: page cache · sequential append (Ch. 2)', SX(146), SY(320), '#8b93a6', 9.5, false)
        ctx.globalAlpha = 1
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  // reset failures when leaving an interactive step
  useEffect(() => {
    if (STEPS[step].interactive !== 'az') setDeadAz(null)
    if (STEPS[step].interactive !== 'broker') setDeadBroker(null)
  }, [step])

  const reps = PLACEMENTS[placement]
  const survivors = reps.filter((r) => !(deadBroker === r.broker || deadAz === AZ_OF[r.broker])).length
  const available = survivors >= 2

  return (
    <div className="trace">
      <div className="trace-head">
        <span className="trace-title">Zoom in: region → zone → cluster → broker</span>
        <div className="trace-ctrl">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} aria-label="Zoom out">
            − Out
          </button>
          <button
            className="play"
            onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))}
            disabled={step === STEPS.length - 1}
          >
            + Zoom in
          </button>
        </div>
      </div>
      <div className="trace-body">
        <div>
          <canvas ref={canvasRef} />
          {STEPS[step].interactive === 'az' && (
            <div className="zoom-controls">
              <div className="zoom-seg">
                <button aria-pressed={placement === 'rack'} onClick={() => setPlacement('rack')}>
                  Rack-aware
                </button>
                <button aria-pressed={placement === 'naive'} onClick={() => setPlacement('naive')}>
                  Naive
                </button>
              </div>
              {AZS.map((az) => (
                <button
                  key={az.id}
                  className={'zoom-chip' + (deadAz === az.id ? ' on' : '')}
                  onClick={() => setDeadAz(deadAz === az.id ? null : az.id)}
                >
                  {deadAz === az.id ? 'Restore ' : 'Fail '} {az.name}
                </button>
              ))}
              <span className={'zoom-verdict ' + (deadAz ? (available ? 'ok' : 'bad') : '')}>
                {deadAz
                  ? `${survivors}/3 replicas alive — partition ${available ? 'AVAILABLE ✓' : 'OFFLINE ✕'}`
                  : `${placement === 'rack' ? 'One replica per zone' : 'Two replicas share Zone A'} — fail a zone to test it`}
              </span>
            </div>
          )}
          {STEPS[step].interactive === 'broker' && (
            <div className="zoom-controls">
              {['bA1', 'bB1', 'bC1'].map((b, i) => (
                <button
                  key={b}
                  className={'zoom-chip' + (deadBroker === b ? ' on' : '')}
                  onClick={() => setDeadBroker(deadBroker === b ? null : b)}
                >
                  {deadBroker === b ? 'Restore' : 'Fail'} broker {i * 2 + 1}
                </button>
              ))}
              <span className={'zoom-verdict ' + (deadBroker ? 'ok' : '')}>
                {deadBroker
                  ? 'Its partitions re-replicate onto survivors · ~−17% capacity (6-broker cluster)'
                  : 'A 6-broker cluster loses ~17% when one dies; a 3-broker cluster loses 33%'}
              </span>
            </div>
          )}
        </div>
        <ol className="trace-steps">
          {STEPS.map((s, i) => (
            <li key={i} className={i === step ? 'active' : i < step ? 'done' : ''} onClick={() => setStep(i)}>
              <span className="tn">{i + 1}</span>
              <div>
                <div className="tt">{s.title}</div>
                {i === step && <div className="tp" dangerouslySetInnerHTML={{ __html: s.prose }} />}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
