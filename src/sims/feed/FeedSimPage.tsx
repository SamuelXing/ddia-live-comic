import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FeedEngine, fmtRps } from './engine'
import type { Snapshot } from './engine'
import { REQ, STAGES } from './model'
import type { GoalCtx } from './model'
import '../../styles/sim.css'

interface Controls {
  traffic: number
  writeShare: number // percent
  cacheHit: number // percent
  web: number
  replicas: number
  partitions: number
  pgShards: number
  redisShards: number
  celeb: boolean
  regions: number
  repl: number // percent
}

function defaultsFor(stageIdx: number, prev?: Controls): Controls {
  const st = STAGES[stageIdx]
  return {
    traffic: prev?.traffic ?? 48,
    writeShare: prev?.writeShare ?? 18,
    cacheHit: prev?.cacheHit ?? 85,
    web: st.web ?? 2,
    replicas: 2,
    partitions: 8,
    pgShards: 1,
    redisShards: 1,
    celeb: false,
    regions: 3,
    repl: 12,
  }
}

function Ctl({
  label,
  value,
  valueText,
  min,
  max,
  step,
  hint,
  hot,
  onChange,
}: {
  label: string
  value: number
  valueText: string
  min: number
  max: number
  step: number
  hint?: string
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
      {hint && <div className="ctl-hint">{hint}</div>}
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

export default function FeedSimPage() {
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

  // engine lifecycle
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
      // evaluate + latch mission goals against the live snapshot
      const idx = stageRef.current
      const stage = STAGES[idx]
      const c = controlsRef.current
      const ctx: GoalCtx = {
        util: (id) => s.bars.find((b) => b.id === id)?.util ?? 0,
        qdepth: (id) => s.bars.find((b) => b.id === id)?.qdepth ?? 0,
        dropPct: s.dropPct,
        regions: s.regions,
        regionsAlive: s.regionsAlive,
        c,
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

  // push controls into the engine
  const apply = useCallback((c: Controls) => {
    const e = engineRef.current
    if (!e) return
    e.traffic = c.traffic
    e.writeShare = c.writeShare / 100
    e.cacheHit = c.cacheHit / 100
    e.celeb = c.celeb
    e.replLag = c.repl / 100
    e.setWebInstances(c.web)
    e.setReplicas(c.replicas)
    e.setPartitions(c.partitions)
    e.setPgShards(c.pgShards)
    e.setRedisShards(c.redisShards)
    if (e.regions !== c.regions) e.setRegions(c.regions)
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

  const spike = useCallback(() => {
    const e = engineRef.current
    if (!e) return
    if (e.stage.map) {
      e.spike()
      return
    }
    const base = controls.traffic
    update({ traffic: Math.min(420, Math.round(base * 2.6)) })
    if (spikeTimer.current) window.clearTimeout(spikeTimer.current)
    spikeTimer.current = window.setTimeout(() => update({ traffic: base }), 3500)
  }, [controls.traffic, update])

  const stage = STAGES[stageIdx]
  const c = stage.controls
  const got = achieved[stageIdx] ?? new Set<string>()
  const stageDone = stage.goals.length > 0 && stage.goals.every((g) => got.has(g.id))
  const isStageComplete = (i: number) => {
    const a = achieved[i]
    return !!a && STAGES[i].goals.every((g) => a.has(g.id))
  }

  return (
    <div className="sim-page">
      <div className="topbar">
        <Link className="home-link" to="/">
          <span className="mk" /> Scale&nbsp;Lab
        </Link>
        <span className="home-sep">/</span>
        <div className="logo">
          <span className="d" /> Feed&nbsp;at&nbsp;Scale <small>social-feed simulation</small>
        </div>
        <Link className="site-link" to="/components">
          Component Deep-Dives
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
        <button className="tbtn" onClick={spike}>
          ⚡ Traffic spike
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
              {snap && snap.map ? (
                <>
                  <Kpi k="Regions live" v={`${snap.regionsAlive}/${snap.regions}`} u="serving traffic" cls={snap.regionsAlive < snap.regions ? 'hot' : 'good'} />
                  <Kpi k="Replication lag" v={String(snap.replLagMs)} u="ms cross-region" cls={controls.repl > 60 ? 'warn' : 'good'} />
                  <Kpi k="Consistency" v={controls.repl > 40 ? 'eventual' : 'near-strong'} u="read-your-writes" cls={controls.repl > 40 ? 'warn' : 'good'} />
                </>
              ) : snap ? (
                <>
                  <Kpi k="Offered" v={fmtRps(snap.offeredRps)} u="req/s in" />
                  <Kpi
                    k="Served"
                    v={fmtRps(snap.servedRps)}
                    u="req/s done"
                    cls={snap.dropPct > 5 ? 'warn' : 'good'}
                  />
                  <Kpi
                    k="Dropped"
                    v={snap.dropPct < 0.1 ? '0' : snap.dropPct.toFixed(1) + '%'}
                    u={fmtRps(snap.dropRps) + ' req/s'}
                    cls={snap.dropPct > 5 ? 'hot' : snap.dropPct > 0.5 ? 'warn' : 'good'}
                  />
                  <Kpi
                    k="Latency"
                    v={Math.round(snap.p95) + ' ms'}
                    u={'p95 · p50 ' + Math.round(snap.p50) + ' ms'}
                    cls={snap.p95 > 900 ? 'hot' : snap.p95 > 400 ? 'warn' : 'good'}
                  />
                  <Kpi k="In flight" v={String(snap.inflight)} u="requests" />
                </>
              ) : null}
            </div>

            <div className="canvas-card">
              <canvas ref={canvasRef} id="viz" />
              <div className={'overload' + (snap?.overloaded ? ' show' : '')}>
                ⚠ OVERLOADED — requests dropping
              </div>
              <div className="legend">
                {stage.map ? (
                  <>
                    <span><i style={{ background: 'var(--good)' }} />region healthy</span>
                    <span><i style={{ background: 'var(--warn)' }} />region busy</span>
                    <span><i style={{ background: '#9085e9' }} />replication pulse</span>
                    <span><i style={{ background: 'var(--hot)' }} />region down</span>
                  </>
                ) : (
                  <>
                    {(Object.keys(REQ) as Array<keyof typeof REQ>).map((k) => (
                      <span key={k}>
                        <i style={{ background: REQ[k].color }} />
                        {REQ[k].label}
                      </span>
                    ))}
                    <span><i style={{ background: '#c07fe0' }} />fan-out write</span>
                    <span><i style={{ background: 'var(--warn)' }} />queue</span>
                  </>
                )}
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
              <div className="next-btn done-all">You&apos;ve scaled the feed, end to end 🎉</div>
            )}

            <div className="m-sec">Controls</div>
            {!stage.map && (
              <>
                <Ctl
                  label="Traffic"
                  value={controls.traffic}
                  valueText={fmtRps(controls.traffic) + ' req/s'}
                  min={8}
                  max={420}
                  step={2}
                  onChange={(v) => update({ traffic: v })}
                />
                <Ctl
                  label="Write share"
                  value={controls.writeShare}
                  valueText={controls.writeShare + '% writes'}
                  min={2}
                  max={60}
                  step={1}
                  onChange={(v) => update({ writeShare: v })}
                />
              </>
            )}
            {c.web && (
              <Ctl
                label="Web / service instances"
                value={controls.web}
                valueText={String(controls.web)}
                min={1}
                max={24}
                step={1}
                onChange={(v) => update({ web: v })}
              />
            )}
            {c.cache && (
              <Ctl
                label="Cache hit rate"
                value={controls.cacheHit}
                valueText={controls.cacheHit + '%'}
                min={30}
                max={99}
                step={1}
                onChange={(v) => update({ cacheHit: v })}
              />
            )}
            {c.replica && (
              <Ctl
                label="Read replicas"
                value={controls.replicas}
                valueText={String(controls.replicas)}
                min={1}
                max={12}
                step={1}
                onChange={(v) => update({ replicas: v })}
              />
            )}
            {c.partitions && (
              <Ctl
                label="Kafka partitions"
                value={controls.partitions}
                valueText={String(controls.partitions)}
                min={1}
                max={64}
                step={1}
                onChange={(v) => update({ partitions: v })}
              />
            )}
            {c.shards && (
              <>
                <Ctl
                  label="Postgres shards"
                  value={controls.pgShards}
                  valueText={String(controls.pgShards)}
                  min={1}
                  max={16}
                  step={1}
                  hot
                  onChange={(v) => update({ pgShards: v })}
                />
                <Ctl
                  label="Redis shards"
                  value={controls.redisShards}
                  valueText={String(controls.redisShards)}
                  min={1}
                  max={16}
                  step={1}
                  hot
                  onChange={(v) => update({ redisShards: v })}
                />
              </>
            )}
            {c.celeb && (
              <div className="toggle-row">
                <button
                  className={'tbtn' + (controls.celeb ? ' on' : '')}
                  onClick={() => update({ celeb: !controls.celeb })}
                >
                  🌟 Celebrity posts: {controls.celeb ? 'on' : 'off'}
                </button>
              </div>
            )}
            {c.regions && (
              <Ctl
                label="Regions"
                value={controls.regions}
                valueText={String(controls.regions)}
                min={1}
                max={5}
                step={1}
                onChange={(v) => update({ regions: v })}
              />
            )}
            {c.repl && (
              <Ctl
                label="Replication lag"
                value={controls.repl}
                valueText={String(controls.repl)}
                min={2}
                max={100}
                step={1}
                hot
                onChange={(v) => update({ repl: v })}
              />
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
