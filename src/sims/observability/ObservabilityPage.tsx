import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FeedEngine, fmtRps } from './engine'
import type { Snapshot } from './engine'
import { REQ, STAGES, defaultsFor, estCostUSD } from './model'
import type { GoalCtx, Controls } from './model'

function Ctl({
  label,
  value,
  valueText,
  min,
  max,
  step,
  hot,
  onChange,
}: {
  label: string
  value: number
  valueText: string
  min: number
  max: number
  step: number
  hot?: boolean
  onChange: (v: number) => void
}) {
  return (
    <div className="ctl">
      <div className="ctl-top">
        <span className="ctl-l">{label}</span>
        <span className="ctl-v">{valueText}</span>
      </div>
      <input
        type="range"
        className={hot ? 'hot' : undefined}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}

function Kpi({ k, v, u, cls }: { k: string; v: string; u: string; cls?: string }) {
  return (
    <div className="kpi">
      <span className="k">{k}</span>
      <span className={'v ' + (cls ?? '')}>{v}</span>
      <span className="u">{u}</span>
    </div>
  )
}

export default function ObservabilityPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<FeedEngine | null>(null)
  const [stageIdx, setStageIdx] = useState(0)
  const [controls, setControls] = useState<Controls>(() => defaultsFor(0))
  const [running, setRunning] = useState(true)
  const [speed, setSpeed] = useState(6)
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [achieved, setAchieved] = useState<Record<number, Set<string>>>({})
  const spikeTimer = useRef<number | null>(null)
  const controlsRef = useRef(controls)
  controlsRef.current = controls
  const stageRef = useRef(stageIdx)
  stageRef.current = stageIdx

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const engine = new FeedEngine(canvas)
    engineRef.current = engine
    engine.setStage(0)
    engine.start()
    const onResize = () => engine.resize()
    window.addEventListener('resize', onResize)
    const poll = window.setInterval(() => {
      const s = engine.getSnapshot()
      setSnap(s)
      const idx = stageRef.current
      const stage = STAGES[idx]
      const c = controlsRef.current
      const ctx: GoalCtx = {
        util: (id) => s.bars.find((b) => b.id === id)?.util ?? 0,
        qdepth: (id) => s.bars.find((b) => b.id === id)?.qdepth ?? 0,
        dropPct: s.dropPct,
        p95: s.p95,
        c: {
          ingest: c.ingest,
          queryShare: c.queryShare,
          indexers: c.indexers,
          cardinality: c.cardinality,
          hotShare: c.hotShare,
          retention: c.retention,
          clusters: c.clusters,
          quota: c.quota,
        },
      }
      const fresh = stage.goals.filter((g) => g.done(ctx)).map((g) => g.id)
      if (fresh.length)
        setAchieved((prev) => {
          const cur = prev[idx] ?? new Set<string>()
          if (fresh.every((id) => cur.has(id))) return prev
          const next = new Set(cur)
          fresh.forEach((id) => next.add(id))
          return { ...prev, [idx]: next }
        })
    }, 200)
    return () => {
      window.removeEventListener('resize', onResize)
      window.clearInterval(poll)
      engine.stop()
      engineRef.current = null
      if (spikeTimer.current) window.clearTimeout(spikeTimer.current)
    }
  }, [])

  const apply = useCallback((c: Controls) => {
    const e = engineRef.current
    if (!e) return
    e.traffic = c.ingest
    e.writeShare = c.queryShare / 100
    e.cacheHit = c.hotShare / 100
    e.cardinality = c.cardinality
    e.clusters = c.clusters
    e.setIndexers(c.indexers)
    e.setQuota(c.quota)
  }, [])

  const update = useCallback(
    (patch: Partial<Controls>) => {
      setControls((prev) => {
        const next = { ...prev, ...patch }
        apply(next)
        return next
      })
    },
    [apply],
  )

  const selectStage = useCallback(
    (i: number) => {
      const e = engineRef.current
      if (!e) return
      e.setStage(i)
      setStageIdx(i)
      setControls((prev) => {
        const next = defaultsFor(i, prev)
        apply(next)
        return next
      })
    },
    [apply],
  )

  const storm = useCallback(() => {
    const base = controls.ingest
    update({ ingest: Math.min(420, Math.round(base * 2.6)) })
    if (spikeTimer.current) window.clearTimeout(spikeTimer.current)
    spikeTimer.current = window.setTimeout(() => update({ ingest: base }), 3500)
  }, [controls.ingest, update])

  const stage = STAGES[stageIdx]
  const c = stage.controls
  const got = achieved[stageIdx] ?? new Set<string>()
  const stageDone = stage.goals.length > 0 && stage.goals.every((g) => got.has(g.id))
  const isStageComplete = (i: number) => {
    const a = achieved[i]
    return !!a && STAGES[i].goals.every((g) => a.has(g.id))
  }
  const cost = snap ? estCostUSD(snap.offeredRps * 60, controls.retention, controls.hotShare) : 0
  const costTxt = cost >= 1000 ? '$' + (cost / 1000).toFixed(1) + 'M' : '$' + Math.round(cost) + 'k'

  return (
    <div className="sim-page">
      <div className="topbar">
        <Link className="home-link" to="/">
          <b>DDIA</b>
          <span className="tl">, as a live comic</span>
        </Link>
        <span className="home-sep">/</span>
        <div className="logo">
          <span className="d" /> Observability&nbsp;at&nbsp;Scale <small>logs · metrics · traces</small> <span className="sim-exp" title="A sketch, not a reference architecture. One plausible design among many — real systems differ by workload, budget and team. Treat the numbers as order-of-magnitude intuition, not sizing advice.">experimental</span>
        </div>
        <Link className="site-link" to="/components">
          Deep-Dives
        </Link>
        <Link className="site-link" to="/read" title="The ideas this simulation leans on: partitioning (sharding the index) and the queueing that decides what breaks first">
          ◆ Ideas in play
        </Link>
        <div className="tb-spacer" />
        <div className="speed">
          speed{' '}
          <input
            type="range"
            min={1}
            max={14}
            step={1}
            value={speed}
            onChange={(e) => {
              const v = parseInt(e.target.value)
              setSpeed(v)
              if (engineRef.current) engineRef.current.speed = v
            }}
          />
        </div>
        <button className="tbtn" onClick={storm}>
          ⚡ Log storm
        </button>
        <button className="tbtn danger" onClick={() => engineRef.current?.killNode()}>
          ✕ Fail a node
        </button>
        <button
          className="tbtn play"
          onClick={() => {
            setRunning((r) => {
              if (engineRef.current) engineRef.current.running = !r
              return !r
            })
          }}
        >
          {running ? '⏸ Pause' : '▶ Play'}
        </button>
      </div>

      <div className="stepper">
        {STAGES.map((s, i) => {
          const done = isStageComplete(i)
          return (
            <button
              key={s.n}
              className={'srung' + (done ? ' done' : '')}
              aria-current={i === stageIdx}
              onClick={() => selectStage(i)}
            >
              <span className="num">{done ? '✓' : s.n}</span>
              {s.title}
            </button>
          )
        })}
      </div>

      <div className="labwrap">
        <div className="lab">
          <div className="viz-col">
            <div className="kpis">
              {snap ? (
                <>
                  <Kpi k="Ingest" v={fmtRps(snap.offeredRps)} u="events/s in" />
                  <Kpi
                    k="Indexed"
                    v={fmtRps(snap.servedRps)}
                    u="events/s done"
                    cls={snap.dropPct > 5 ? 'warn' : 'good'}
                  />
                  <Kpi
                    k="Dropped"
                    v={snap.dropPct < 0.1 ? '0' : snap.dropPct.toFixed(1) + '%'}
                    u={fmtRps(snap.dropRps) + ' events/s'}
                    cls={snap.dropPct > 5 ? 'hot' : snap.dropPct > 0.5 ? 'warn' : 'good'}
                  />
                  <Kpi
                    k="Query latency"
                    v={Math.round(snap.p95) + ' ms'}
                    u={'p95 · p50 ' + Math.round(snap.p50) + ' ms'}
                    cls={snap.p95 > 900 ? 'hot' : snap.p95 > 400 ? 'warn' : 'good'}
                  />
                  {c.tiering ? (
                    <Kpi k="Est. cost" v={costTxt} u="/ month" cls={cost > 400 ? 'warn' : 'good'} />
                  ) : (
                    <Kpi k="In flight" v={String(snap.inflight)} u="events" />
                  )}
                </>
              ) : null}
            </div>

            <div className="canvas-card">
              <canvas ref={canvasRef} id="viz" />
              <div className={'overload' + (snap?.overloaded ? ' show' : '')}>
                ⚠ OVERLOADED — events dropping
              </div>
              <div className="legend">
                {(Object.keys(REQ) as Array<keyof typeof REQ>).map((k) => (
                  <span key={k}>
                    <i style={{ background: REQ[k].color }} />
                    {REQ[k].label}
                  </span>
                ))}
                <span><i style={{ background: 'var(--warn)' }} />queue depth</span>
              </div>
            </div>
          </div>

          <aside className="mission">
            <div className="m-kicker">
              Mission · Stage {stage.n} — {stage.kicker}
            </div>
            <h2>{stage.title}</h2>
            <p className="m-desc">{stage.desc}</p>

            <div className="goals">
              {stage.goals.map((g) => {
                const ok = got.has(g.id)
                return (
                  <div key={g.id} className={'goal' + (ok ? ' ok' : '')}>
                    <span className="g-dot">{ok ? '✓' : ''}</span>
                    <span className="g-label">{g.label}</span>
                  </div>
                )
              })}
            </div>

            {stageDone && stageIdx < STAGES.length - 1 && (
              <button className="next-btn" onClick={() => selectStage(stageIdx + 1)}>
                Stage complete — next: {STAGES[stageIdx + 1].title} →
              </button>
            )}
            {stageDone && stageIdx === STAGES.length - 1 && (
              <div className="next-btn done-all">You&apos;ve scaled the pipeline, end to end 🎉</div>
            )}

            <div className="m-sec">Controls</div>
            {c.ingest && (
              <Ctl
                label="Ingest volume"
                value={controls.ingest}
                valueText={fmtRps(controls.ingest) + ' events/s'}
                min={8}
                max={420}
                step={2}
                onChange={(v) => update({ ingest: v })}
              />
            )}
            {c.queryShare && (
              <Ctl
                label="Query share"
                value={controls.queryShare}
                valueText={controls.queryShare + '% queries'}
                min={2}
                max={50}
                step={1}
                onChange={(v) => update({ queryShare: v })}
              />
            )}
            {c.indexers && (
              <Ctl
                label="Indexer shards"
                value={controls.indexers}
                valueText={String(controls.indexers)}
                min={1}
                max={16}
                step={1}
                onChange={(v) => update({ indexers: v })}
              />
            )}
            {c.cardinality && (
              <Ctl
                label="Label cardinality"
                value={controls.cardinality}
                valueText={controls.cardinality + '%'}
                min={0}
                max={100}
                step={1}
                hot
                onChange={(v) => update({ cardinality: v })}
              />
            )}
            {c.tiering && (
              <>
                <Ctl
                  label="Hot window (share in fast tier)"
                  value={controls.hotShare}
                  valueText={controls.hotShare + '%'}
                  min={10}
                  max={100}
                  step={1}
                  onChange={(v) => update({ hotShare: v })}
                />
                <Ctl
                  label="Retention"
                  value={controls.retention}
                  valueText={controls.retention + ' days'}
                  min={7}
                  max={365}
                  step={1}
                  hot
                  onChange={(v) => update({ retention: v })}
                />
              </>
            )}
            {c.clusters && (
              <Ctl
                label="Clusters (per-team)"
                value={controls.clusters}
                valueText={String(controls.clusters)}
                min={1}
                max={8}
                step={1}
                onChange={(v) => update({ clusters: v })}
              />
            )}
            {c.quota && (
              <div className="toggle-row">
                <button
                  className={'tbtn' + (controls.quota ? ' on' : '')}
                  onClick={() => update({ quota: !controls.quota })}
                >
                  🎚 Per-team ingest quotas: {controls.quota ? 'on' : 'off'}
                </button>
              </div>
            )}

            <div className="tip">
              <b>{stage.tip.h}</b>
              <p>{stage.tip.p}</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
