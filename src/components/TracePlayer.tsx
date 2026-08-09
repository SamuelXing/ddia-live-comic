import { useCallback, useEffect, useRef, useState } from 'react'
import { nodeGradient, VIZ } from '../styles/viz'
import { lintAndReport } from './traceLint'

/* ============================================================
   TracePlayer — animated request-trace diagrams.
   A spec describes zones, nodes, and a sequence of steps; the
   player animates one request moving through the internals,
   with prose synced to each hop. Reused by every flagship
   deep-dive (Kafka produce/consume, Postgres query, …).
   Coordinates are normalized: x/y/w/h in 0..100 (y uses the
   same scale; the canvas maps via aspect ratio).
   ============================================================ */

export interface TraceZone {
  label: string
  x: number
  y: number
  w: number
  h: number
  color?: string
}

export interface TraceNode {
  id: string
  x: number
  y: number
  w: number
  h: number
  label: string
  sub?: string
  color?: string
}

export interface TraceParticle {
  from: string
  to: string
  color?: string
  count?: number
  /** Optional world-coord waypoints to route the line/particle around nodes. */
  via?: { x: number; y: number }[]
}

export interface TraceStep {
  title: string
  /** HTML prose — our own authored content. */
  prose: string
  focus: string[]
  particles?: TraceParticle[]
}

export interface TraceSpec {
  title: string
  aspect?: number // height / width, default 0.52
  zones: TraceZone[]
  nodes: TraceNode[]
  steps: TraceStep[]
}

const STEP_MS = 2400

export default function TracePlayer({ spec }: { spec: TraceSpec }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activeStepRef = useRef<HTMLLIElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  /** did this step change because the reader asked, or because we mounted? */
  const stepDrivenRef = useRef(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const progRef = useRef(0) // 0..1 within current step
  const stepRef = useRef(0)
  const playRef = useRef(false)

  stepRef.current = stepIdx
  playRef.current = playing

  const jump = useCallback((i: number, autoplay?: boolean) => {
    stepDrivenRef.current = true
    setStepIdx(Math.max(0, Math.min(i, Infinity)))
    progRef.current = 0
    if (autoplay !== undefined) setPlaying(autoplay)
  }, [])

  useEffect(() => {
    if (import.meta.env.DEV) lintAndReport(spec)
  }, [spec])

  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')
    if (!ctx) return
    let raf = 0
    let W = 0
    let H = 0
    const aspect = spec.aspect ?? 0.52

    function size() {
      if (!cvs || !ctx) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const r = cvs.getBoundingClientRect()
      W = r.width
      H = r.width * aspect
      cvs.style.height = H + 'px'
      cvs.width = W * dpr
      cvs.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    size()
    const ro = new ResizeObserver(size)
    ro.observe(cvs)

    const X = (v: number) => (v / 100) * W
    const Y = (v: number) => (v / 100) * W // same scale so shapes stay square-ish

    const nodeById: Record<string, TraceNode> = {}
    spec.nodes.forEach((n) => (nodeById[n.id] = n))

    function roundRect(x: number, y: number, w: number, h: number, r: number) {
      if (!ctx) return
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.arcTo(x + w, y, x + w, y + h, r)
      ctx.arcTo(x + w, y + h, x, y + h, r)
      ctx.arcTo(x, y + h, x, y, r)
      ctx.arcTo(x, y, x + w, y, r)
      ctx.closePath()
    }

    function center(n: TraceNode): [number, number] {
      return [X(n.x + n.w / 2), Y(n.y + n.h / 2)]
    }

    let last = performance.now()

    function frame(t: number) {
      if (!ctx || !cvs) return
      const dt = t - last
      last = t
      const step = spec.steps[stepRef.current]

      if (playRef.current) {
        progRef.current += dt / STEP_MS
        if (progRef.current >= 1) {
          if (stepRef.current < spec.steps.length - 1) {
            stepDrivenRef.current = true
            setStepIdx(stepRef.current + 1)
            progRef.current = 0
          } else {
            progRef.current = 1
            setPlaying(false)
          }
        }
      }

      ctx.clearRect(0, 0, W, H)

      // zones
      spec.zones.forEach((z) => {
        ctx.strokeStyle = z.color ?? 'rgba(255,255,255,.14)'
        ctx.setLineDash([5, 5])
        ctx.lineWidth = 1
        roundRect(X(z.x), Y(z.y), X(z.w), Y(z.h), 10)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = 'rgba(170,178,197,.75)'
        ctx.font = '700 10.5px system-ui,sans-serif'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(z.label.toUpperCase(), X(z.x) + 9, Y(z.y) + 11)
      })

      // helper: the point on a node's border facing a target (an edge "port")
      const edgePt = (n: TraceNode, tx: number, ty: number): [number, number] => {
        const cx = X(n.x + n.w / 2)
        const cy = Y(n.y + n.h / 2)
        const hw = X(n.w) / 2
        const hh = Y(n.h) / 2
        const dx = tx - cx
        const dy = ty - cy
        if (dx === 0 && dy === 0) return [cx, cy]
        const t = Math.min(dx !== 0 ? hw / Math.abs(dx) : Infinity, dy !== 0 ? hh / Math.abs(dy) : Infinity)
        return [cx + dx * t, cy + dy * t]
      }
      // helper: shrink a label's font until it fits the box width (never clip)
      const fitFont = (text: string, maxW: number, weight: string, base: number, min: number) => {
        ctx.font = weight + ' ' + base + 'px system-ui,sans-serif'
        const w = ctx.measureText(text).width
        const size = w <= maxW ? base : Math.max(min, base * (maxW / w))
        ctx.font = weight + ' ' + size + 'px system-ui,sans-serif'
      }

      // Build each connection's routed path: node edge → optional waypoints →
      // node edge. Waypoints let long hops travel clear channels instead of
      // cutting across other nodes.
      const parts = step.particles ?? []
      const buildRoute = (p: TraceParticle): [number, number][] | null => {
        const a = nodeById[p.from]
        const b = nodeById[p.to]
        if (!a || !b) return null
        const viaS: [number, number][] = (p.via ?? []).map((v) => [X(v.x), Y(v.y)])
        const aC = center(a)
        const bC = center(b)
        const firstT = viaS.length ? viaS[0] : bC
        const lastT = viaS.length ? viaS[viaS.length - 1] : aC
        const aPort = edgePt(a, firstT[0], firstT[1])
        const bPort = edgePt(b, lastT[0], lastT[1])
        return [aPort, ...viaS, bPort]
      }
      const ptAlong = (route: [number, number][], f: number) => {
        let total = 0
        const segs: { x: number; y: number; dx: number; dy: number; l: number }[] = []
        for (let i = 0; i < route.length - 1; i++) {
          const dx = route[i + 1][0] - route[i][0]
          const dy = route[i + 1][1] - route[i][1]
          const l = Math.hypot(dx, dy)
          segs.push({ x: route[i][0], y: route[i][1], dx, dy, l })
          total += l
        }
        let d = f * total
        for (let i = 0; i < segs.length; i++) {
          const s = segs[i]
          if (d <= s.l || i === segs.length - 1) {
            const t = s.l ? d / s.l : 0
            return { x: s.x + s.dx * t, y: s.y + s.dy * t, ux: s.dx / (s.l || 1), uy: s.dy / (s.l || 1) }
          }
          d -= s.l
        }
        const last = route[route.length - 1]
        return { x: last[0], y: last[1], ux: 1, uy: 0 }
      }
      const routes = parts.map(buildRoute)

      // connection lines (rounded polylines)
      routes.forEach((route) => {
        if (!route) return
        ctx.strokeStyle = 'rgba(90,162,240,.4)'
        ctx.lineWidth = 1.5
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(route[0][0], route[0][1])
        for (let i = 1; i < route.length - 1; i++) {
          ctx.arcTo(route[i][0], route[i][1], route[i + 1][0], route[i + 1][1], 9)
        }
        ctx.lineTo(route[route.length - 1][0], route[route.length - 1][1])
        ctx.stroke()
      })

      // nodes
      spec.nodes.forEach((n) => {
        const focused = step.focus.includes(n.id)
        const col = n.color ?? '#3987e5'
        const nx = X(n.x)
        const ny = Y(n.y)
        const nw = X(n.w)
        const nh = Y(n.h)
        ctx.save()
        if (focused) {
          ctx.shadowColor = col
          ctx.shadowBlur = 18
        }
        ctx.fillStyle = nodeGradient(ctx, nx, ny, nh, col, focused ? 0.22 : 0.07)
        roundRect(nx, ny, nw, nh, 8)
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.strokeStyle = focused ? col : 'rgba(255,255,255,.12)'
        ctx.lineWidth = focused ? 1.8 : 1
        roundRect(nx, ny, nw, nh, 8)
        ctx.stroke()
        // focused: a 3px accent tab along the top edge
        if (focused) {
          ctx.fillStyle = col
          roundRect(nx + 4, ny - 1.5, nw - 8, 3, 1.5)
          ctx.fill()
        }
        ctx.restore()
        const [cx, cy] = center(n)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = focused ? '#f2f4f8' : '#9aa3b6'
        fitFont(n.label, nw - 16, '650', 11, 8.5)
        ctx.fillText(n.label, cx, n.sub ? cy - 6 : cy)
        if (n.sub) {
          ctx.fillStyle = focused ? '#8fa3c4' : '#6b7488'
          fitFont(n.sub, nw - 16, '500', 9, 7.5)
          ctx.fillText(n.sub, cx, cy + 7)
        }
      })

      // particles — travel the routed path and fade out over the last stretch so a
      // dot is gone by the time it reaches the node (never rests on a label)
      const prog = Math.min(1, progRef.current)
      const eased = prog < 0.5 ? 2 * prog * prog : 1 - Math.pow(-2 * prog + 2, 2) / 2
      const fade = eased < 0.78 ? 1 : Math.max(0, 1 - (eased - 0.78) / 0.22)
      parts.forEach((p, idx) => {
        const route = routes[idx]
        if (!route) return
        const base = ptAlong(route, eased)
        const perpx = -base.uy
        const perpy = base.ux
        const count = p.count ?? 1
        const pc = p.color ?? '#5aa2f0'
        for (let k = 0; k < count; k++) {
          const off = count > 1 ? (k - (count - 1) / 2) * 6 : 0
          const px = base.x + perpx * off
          const py = base.y + perpy * off
          ctx.globalAlpha = fade
          ctx.beginPath()
          ctx.arc(px, py, 4, 0, 7)
          ctx.fillStyle = pc
          ctx.shadowColor = pc
          ctx.shadowBlur = 9
          ctx.fill()
          ctx.shadowBlur = 0
          // 2px surface ring keeps the dot legible where it crosses a line
          ctx.lineWidth = 2
          ctx.strokeStyle = VIZ.surface
          ctx.stroke()
          ctx.globalAlpha = 1
        }
      })

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [spec])

  // Keep the active step in view as the trace advances — but only when the
  // reader is actually looking at this player. Traces autoplay on mount, so
  // without the visibility gate every player on a deep-dive scrolled itself
  // into view as its step advanced, and the last one won: opening Postgres
  // dumped you at chapter 7's fleet trace instead of the top of the page.
  useEffect(() => {
    // Only follow a step the reader actually asked for — a click, or playback
    // they started. Mounting is not a reason to move the page, and "skip the
    // first run" does not work here: StrictMode invokes mount effects twice,
    // so the second pass would scroll. Without this, every trace player on a
    // deep-dive scrolled itself into view as the page loaded and the last one
    // won, dropping you at chapter 7's fleet trace instead of the top.
    if (!stepDrivenRef.current) return
    stepDrivenRef.current = false
    // and if they have since scrolled away, don't drag them back
    const r = rootRef.current?.getBoundingClientRect()
    if (!r || r.top >= window.innerHeight || r.bottom <= 0) return
    activeStepRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [stepIdx])

  return (
    <div className="trace" ref={rootRef}>
      <div className="trace-head">
        <span className="trace-title">{spec.title}</span>
        <div className="trace-ctrl">
          <button onClick={() => jump(stepIdx - 1)} disabled={stepIdx === 0} aria-label="Previous step">
            ⏮
          </button>
          <button
            className="play"
            onClick={() => {
              if (!playing && stepIdx === spec.steps.length - 1 && progRef.current >= 1) jump(0, true)
              else setPlaying(!playing)
            }}
          >
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
          <button
            onClick={() => jump(Math.min(stepIdx + 1, spec.steps.length - 1))}
            disabled={stepIdx === spec.steps.length - 1}
            aria-label="Next step"
          >
            ⏭
          </button>
        </div>
      </div>
      <div className="trace-body">
        <canvas ref={canvasRef} />
        <ol className="trace-steps">
          {spec.steps.map((s, i) => (
            <li
              key={i}
              ref={i === stepIdx ? activeStepRef : null}
              className={i === stepIdx ? 'active' : i < stepIdx ? 'done' : ''}
              onClick={() => jump(i)}
            >
              <span className="tn">{i + 1}</span>
              <div>
                <div className="tt">{s.title}</div>
                {i === stepIdx && (
                  <div className="tp" key={i} dangerouslySetInnerHTML={{ __html: s.prose }} />
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
