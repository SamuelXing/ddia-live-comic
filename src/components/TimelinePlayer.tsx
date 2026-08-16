import { useCallback, useEffect, useRef, useState } from 'react'
import { VIZ } from '../styles/viz'
import { lintAndReportTimeline } from './timelineLint'

/* ============================================================
   TimelinePlayer — the second instrument, for the second season.

   Every TracePlayer figure animates a request moving between
   boxes, because season 1's subject was topology: who talks to
   whom, and what is a copy of what. Season 2's subject is time,
   and boxes and arrows say nothing about it. A record that
   happened at 09:14 and reached you at 13:40 is not a hop.

   So this draws the only picture that makes that legible: two
   axes, EVENT TIME across and PROCESSING TIME down. One dot per
   record, at (when it happened, when you heard). The diagonal is
   the fiction every system in Act I was built on — that those two
   are the same number — and the vertical distance from the
   diagonal down to a dot is exactly how wrong that was for that
   record.

   Processing time runs DOWNWARD on purpose. It is the direction a
   page is read, so "further down" reads as "later" without being
   explained, and the sweep line that marks `now` moves the way a
   reader's eye already moves. The published figures of this idea
   mostly run it upward; being consistent with the reader beats
   being consistent with the literature.

   Reuses the .trace CSS shell (head, body, canvas, step list)
   rather than growing a parallel one — the chrome is identical
   and only the drawing differs.
   ============================================================ */

export interface TimelineRecord {
  id: string
  /** when it happened, on the event-time axis */
  event: number
  /** when it reached you, on the processing-time axis */
  arrived: number
  /** shown beside the dot when the step highlights it */
  label?: string
  color?: string
}

/** A window of event time. Bands, so they may not overlap — see the lint. */
export interface TimelineWindow {
  from: number
  to: number
  label: string
}

export interface TimelineStep {
  title: string
  /** HTML prose — our own authored content. */
  prose: string
  /** how far processing time has advanced by the end of this step */
  now: number
  /** where the watermark stands on the event-time axis. Never goes back. */
  watermark?: number
  /** windows that have produced a result by now, by label */
  fired?: string[]
  /**
   * The badge for a window's MOST RECENT emission, keyed by window label —
   * "early", "on time", "late". A window may emit many times, and the whole
   * argument of chapter 22 is that those emissions are different in kind, so a
   * count would say less than a word does. A window with a pane badge must
   * also be listed in `fired`; the lint checks it.
   */
  panes?: Record<string, string>
  /** records to call out — drawn larger, labelled, and with their lateness */
  highlight?: string[]
  /** one short annotation pinned in the plot */
  note?: { text: string; event: number; proc: number }
}

export interface TimelineSpec {
  title: string
  aspect?: number
  eventAxis: { label: string; max: number; ticks?: { at: number; label: string }[] }
  procAxis: { label: string; max: number; ticks?: { at: number; label: string }[] }
  windows: TimelineWindow[]
  records: TimelineRecord[]
  steps: TimelineStep[]
}

const STEP_MS = 2600
const PAD = { l: 54, r: 16, t: 40, b: 46 }

export default function TimelinePlayer({ spec }: { spec: TimelineSpec }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activeStepRef = useRef<HTMLLIElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const stepDrivenRef = useRef(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const progRef = useRef(1)
  const stepRef = useRef(0)
  const playRef = useRef(false)

  stepRef.current = stepIdx
  playRef.current = playing

  const jump = useCallback((i: number, autoplay?: boolean) => {
    stepDrivenRef.current = true
    setStepIdx(i)
    progRef.current = 0
    if (autoplay !== undefined) setPlaying(autoplay)
  }, [])

  useEffect(() => {
    if (import.meta.env.DEV) lintAndReportTimeline(spec)
  }, [spec])

  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')
    if (!ctx) return
    let raf = 0
    let W = 0
    let H = 0
    const aspect = spec.aspect ?? 0.62

    function size() {
      if (!cvs || !ctx) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      W = cvs.getBoundingClientRect().width
      H = W * aspect
      cvs.style.height = H + 'px'
      cvs.width = W * dpr
      cvs.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    size()
    const ro = new ResizeObserver(size)
    ro.observe(cvs)

    /** which window, if any, a record's event time falls in */
    const windowOf = (r: TimelineRecord) => spec.windows.find((w) => r.event >= w.from && r.event < w.to)

    /* When each window first emitted a result, in processing time — read off
       the steps rather than declared, so the two can never disagree.
       "Late" then has its real meaning: the record turned up after the answer
       covering it had already gone out. Testing instead against the watermark
       would paint every ordinary record red the moment its window fired, which
       is the opposite of the point. */
    const firedAt: Record<string, number> = {}
    spec.steps.forEach((s) =>
      (s.fired ?? []).forEach((l) => {
        if (firedAt[l] === undefined) firedAt[l] = s.now
      }),
    )

    let last = performance.now()

    function frame(t: number) {
      if (!ctx || !cvs) return
      const dt = t - last
      last = t
      const i = stepRef.current
      const step = spec.steps[i]
      const prev = i > 0 ? spec.steps[i - 1] : undefined

      /* Progress advances whether or not playback is running, and only the
         hop to the NEXT step is gated on playing. TracePlayer can freeze
         progress while paused because pausing there just stops the particles
         — the nodes and the focus are already correct. Here `now` and the
         watermark are interpolated FROM the previous step, so freezing at
         zero would leave a reader who clicked step 6 looking at step 5's
         picture with step 6's prose beside it. */
      progRef.current = Math.min(1, progRef.current + dt / STEP_MS)
      if (progRef.current >= 1 && playRef.current) {
        if (i < spec.steps.length - 1) {
          stepDrivenRef.current = true
          setStepIdx(i + 1)
          progRef.current = 0
        } else setPlaying(false)
      }
      const p = Math.min(1, progRef.current)
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2

      // Interpolate the two moving quantities from the previous step, so the
      // sweep and the watermark advance rather than jumping. Everything else
      // (which windows have fired, what is highlighted) switches at once —
      // a window firing is an event, not a motion.
      const lerp = (a: number, b: number) => a + (b - a) * eased
      const now = lerp(prev?.now ?? 0, step.now)
      const markTo = step.watermark
      const markFrom = prev?.watermark ?? step.watermark ?? 0
      const mark = markTo === undefined ? undefined : lerp(markFrom, markTo)

      const PW = W - PAD.l - PAD.r
      const PH = H - PAD.t - PAD.b
      const X = (e: number) => PAD.l + (e / spec.eventAxis.max) * PW
      const Y = (q: number) => PAD.t + (q / spec.procAxis.max) * PH

      ctx.clearRect(0, 0, W, H)
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      /* The .trace canvas is transparent over a radial CSS wash, which suits a
         diagram floating in space and washes out a dense scatter. Paint the
         plot its own flat ground so every dot sits on the same value. */
      ctx.fillStyle = 'rgba(9,11,16,.93)'
      ctx.fillRect(PAD.l, PAD.t, PW, PH)

      // ---- window bands, drawn first so everything sits on top of them
      const fired = new Set(step.fired ?? [])
      spec.windows.forEach((win, wi) => {
        const x0 = X(win.from)
        const x1 = X(win.to)
        const on = fired.has(win.label)
        ctx.fillStyle = on ? 'rgba(26,164,110,.10)' : wi % 2 ? 'rgba(255,255,255,.030)' : 'rgba(255,255,255,.055)'
        ctx.fillRect(x0, PAD.t, x1 - x0, PH)
        ctx.strokeStyle = 'rgba(255,255,255,.09)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x0, PAD.t)
        ctx.lineTo(x0, PAD.t + PH)
        ctx.stroke()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = '650 9.5px system-ui,sans-serif'
        ctx.fillStyle = on ? VIZ.green : 'rgba(170,178,197,.6)'
        ctx.fillText(on ? win.label + ' ✓' : win.label, (x0 + x1) / 2, PAD.t - 11)
        const pane = step.panes?.[win.label]
        if (pane) {
          ctx.font = '650 8.5px system-ui,sans-serif'
          ctx.fillStyle = VIZ.amber
          ctx.fillText(pane, (x0 + x1) / 2, PAD.t - 25)
        }
      })

      // ---- the fiction: arrived exactly when it happened
      ctx.strokeStyle = 'rgba(255,255,255,.20)'
      ctx.setLineDash([4, 4])
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(X(0), Y(0))
      const diagE = Math.min(spec.eventAxis.max, spec.procAxis.max)
      ctx.lineTo(X(diagE), Y(diagE))
      ctx.stroke()
      ctx.setLineDash([])

      // ---- the watermark: everything left of it is claimed to be complete
      if (mark !== undefined) {
        ctx.fillStyle = 'rgba(144,133,233,.09)'
        ctx.fillRect(PAD.l, PAD.t, X(mark) - PAD.l, PH)
        ctx.strokeStyle = VIZ.violet
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(X(mark), PAD.t)
        ctx.lineTo(X(mark), PAD.t + PH)
        ctx.stroke()
        /* At the TOP of the line, not the foot: `now` sweeps to the bottom of
           the plot, and a watermark label parked down there collides with it
           on the last step of every timeline. Flips left near the right edge. */
        ctx.font = '650 9.5px system-ui,sans-serif'
        ctx.textBaseline = 'top'
        const room = X(mark) + 5 + ctx.measureText('watermark').width <= PAD.l + PW
        ctx.textAlign = room ? 'left' : 'right'
        ctx.fillStyle = VIZ.violet
        ctx.fillText('watermark', X(mark) + (room ? 5 : -5), PAD.t + 4)
      }

      // ---- now: the sweep. Nothing below this line has reached you yet.
      const ny = Y(now)
      ctx.fillStyle = 'rgba(13,15,20,.72)'
      ctx.fillRect(PAD.l, ny, PW, PAD.t + PH - ny)
      ctx.strokeStyle = VIZ.blue
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(PAD.l, ny)
      ctx.lineTo(PAD.l + PW, ny)
      ctx.stroke()
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'
      ctx.font = '650 9.5px system-ui,sans-serif'
      ctx.fillStyle = VIZ.blue
      ctx.fillText('now', PAD.l + PW - 4, ny - 3)

      // ---- records that have actually reached you
      const hi = new Set(step.highlight ?? [])
      spec.records.forEach((r) => {
        if (r.arrived > now + 0.001) return
        const x = X(r.event)
        const y = Y(r.arrived)
        const win = windowOf(r)
        // late = it landed after the window covering it had already reported
        const isLate = !!win && firedAt[win.label] !== undefined && r.arrived > firedAt[win.label]
        const on = hi.has(r.id)
        const col = r.color ?? (isLate ? VIZ.red : on ? VIZ.blue : VIZ.inkDim)

        // the drop from the diagonal: how much later you heard than it happened
        if (on || isLate) {
          ctx.strokeStyle = isLate ? 'rgba(229,83,59,.45)' : 'rgba(255,255,255,.22)'
          ctx.setLineDash([3, 3])
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(x, Y(Math.min(r.event, spec.procAxis.max)))
          ctx.lineTo(x, y)
          ctx.stroke()
          ctx.setLineDash([])
        }

        ctx.beginPath()
        ctx.arc(x, y, on || isLate ? 5 : 3.4, 0, 7)
        ctx.fillStyle = col
        if (on || isLate) {
          ctx.shadowColor = col
          ctx.shadowBlur = 12
        }
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.lineWidth = 1.5
        ctx.strokeStyle = VIZ.surface
        ctx.stroke()

        if ((on || isLate) && r.label) {
          ctx.font = '600 9.5px system-ui,sans-serif'
          const tw = ctx.measureText(r.label).width
          // flip the label to the left when it would run off the right edge
          const right = x + 9 + tw <= PAD.l + PW
          ctx.textAlign = right ? 'left' : 'right'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = col
          ctx.fillText(r.label, x + (right ? 9 : -9), y)
        }
      })

      // ---- a pinned note, on its own so it is never mistaken for a record
      if (step.note) {
        const x = X(step.note.event)
        const y = Y(step.note.proc)
        ctx.font = '600 10px system-ui,sans-serif'
        const tw = ctx.measureText(step.note.text).width
        const right = x + tw + 16 <= PAD.l + PW
        const bx = right ? x + 4 : x - tw - 16
        ctx.fillStyle = 'rgba(13,15,20,.86)'
        ctx.strokeStyle = 'rgba(255,255,255,.16)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.rect(bx, y - 9, tw + 12, 18)
        ctx.fill()
        ctx.stroke()
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = VIZ.ink
        ctx.fillText(step.note.text, bx + 6, y)
      }

      // ---- axes last, so no dot ever sits on top of a number
      ctx.strokeStyle = 'rgba(255,255,255,.28)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(PAD.l, PAD.t)
      ctx.lineTo(PAD.l, PAD.t + PH)
      ctx.lineTo(PAD.l + PW, PAD.t + PH)
      ctx.stroke()

      ctx.font = '500 9px system-ui,sans-serif'
      ctx.fillStyle = VIZ.inkMuted
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ;(spec.eventAxis.ticks ?? []).forEach((tk) => ctx.fillText(tk.label, X(tk.at), PAD.t + PH + 5))
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ;(spec.procAxis.ticks ?? []).forEach((tk) => ctx.fillText(tk.label, PAD.l - 6, Y(tk.at)))

      ctx.font = '650 9.5px system-ui,sans-serif'
      ctx.fillStyle = 'rgba(170,178,197,.8)'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'
      ctx.fillText(spec.eventAxis.label.toUpperCase() + ' →', PAD.l + PW, PAD.t + PH + 38)
      /* Both axis titles live on one line under the plot, at opposite ends.
         Two earlier placements failed. Rotated down the y-axis it competed
         with the tick labels for a narrow strip, and its "↓" came out as
         "←" because the glyph rotates with the text. Horizontal above the
         y-axis it shared a line with the window band labels, which are centred
         over bands whose positions depend on the data — so whether it
         collided was a property of the spec. The strip under the axis belongs
         to nothing else. */
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      ctx.fillText('↓ ' + spec.procAxis.label.toUpperCase(), 4, PAD.t + PH + 38)

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [spec])

  /* Same rule as TracePlayer: follow the active step only when the reader
     asked for it, never on mount. StrictMode runs mount effects twice, so
     "skip the first" does not work — the flag has to be set by the click. */
  useEffect(() => {
    if (!stepDrivenRef.current) return
    stepDrivenRef.current = false
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
                {i === stepIdx && <div className="tp" key={i} dangerouslySetInnerHTML={{ __html: s.prose }} />}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
