import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FeedEngine, fmtRps } from './engine'
import type { Snapshot } from './engine'
import { REQ, STAGES } from './model'
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

function Bar({ name, util, dead, extra }: { name: string; util: number; dead: boolean; extra?: string }) {
  const pct = Math.min(100, Math.round((dead ? 0 : util) * 100))
  const col = dead ? '#3a3f4d' : util >= 0.95 ? 'var(--hot)' : util >= 0.7 ? 'var(--warn)' : 'var(--good)'
  return (
    <div className="cbar">
      <div className="cbar-top">
        <span className="cbar-name">{name}</span>
        <span className="cbar-val">{dead ? 'DOWN' : pct + '%' + (extra ?? '')}</span>
      </div>
      <div className="cbar-track">
        <div className="cbar-fill" style={{ width: pct + '%', background: col }} />
      </div>
    </div>
  )
}

function Tile({ k, v, u, cls, wide }: { k: string; v: string | number; u: string; cls?: string; wide?: boolean }) {
  return (
    <div className={'mt' + (wide ? ' wide' : '')}>
      <div className="k">{k}</div>
      <div className={'v ' + (cls ?? '')}>{v}</div>
      <div className="u">{u}</div>
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
  const spikeTimer = useRef<number | null>(null)

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
    const poll = window.setInterval(() => setSnap(engine.getSnapshot()), 200)
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

      <div className="ladder">
        {STAGES.map((s, i) => (
          <span key={s.n} style={{ display: 'contents' }}>
            {i > 0 && <span className="arrow">▸</span>}
            <button className="rung" aria-current={i === stageIdx} onClick={() => selectStage(i)}>
              <span className="num">{s.n}</span>
              {s.title}
            </button>
          </span>
        ))}
      </div>

      <div className="main">
        <div className="stage-wrap">
          <canvas ref={canvasRef} id="viz" />
          <div className="overlay-hint">
            <div className="st">
              Stage {stage.n} · {stage.kicker}
            </div>
            <h2>{stage.title}</h2>
            <p>{stage.desc}</p>
          </div>
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
                <span><i style={{ background: 'var(--warn)' }} />queued</span>
                <span><i style={{ background: 'var(--hot)' }} />saturated</span>
              </>
            )}
          </div>
        </div>

        <aside className="rail">
          <div className="sec-t">Live metrics</div>
          <div className="mgrid">
            {snap && snap.map ? (
              <>
                <Tile k="Regions live" v={`${snap.regionsAlive}/${snap.regions}`} u="serving traffic" cls="good" wide />
                <Tile k="Replication lag" v={snap.replLagMs} u="ms cross-region" cls={controls.repl > 60 ? 'warn' : 'good'} />
                <Tile k="Consistency" v={controls.repl > 40 ? 'eventual' : 'near-strong'} u="read-your-writes" cls={controls.repl > 40 ? 'warn' : 'good'} />
              </>
            ) : snap ? (
              <>
                <Tile k="Offered" v={fmtRps(snap.offeredRps)} u="req/s in" />
                <Tile k="Served" v={fmtRps(snap.servedRps)} u="req/s done" cls="good" />
                <Tile
                  k="Dropped"
                  v={snap.dropPct < 0.1 ? '0' : snap.dropPct.toFixed(1) + '%'}
                  u={fmtRps(snap.dropRps) + ' req/s'}
                  cls={snap.dropPct > 5 ? 'hot' : snap.dropPct > 0.5 ? 'warn' : 'good'}
                />
                <Tile k="In flight" v={snap.inflight} u="requests" />
                <Tile k="p50 latency" v={Math.round(snap.p50)} u="ms" />
                <Tile k="p95 latency" v={Math.round(snap.p95)} u="ms" cls={snap.p95 > 1200 ? 'hot' : snap.p95 > 500 ? 'warn' : 'good'} />
              </>
            ) : null}
          </div>

          <div className="sec-t">Component load</div>
          <div>
            {snap?.bars.map((b) => (
              <Bar
                key={b.id}
                name={b.label}
                util={b.util}
                dead={b.dead}
                extra={b.kind === 'fanout' && b.qdepth > 0 ? ` · lag ${b.qdepth}` : undefined}
              />
            ))}
          </div>

          {!stage.map && (
            <>
              <div className="sec-t">Traffic</div>
              <Ctl
                label="Traffic"
                value={controls.traffic}
                valueText={fmtRps(controls.traffic) + ' req/s'}
                min={8}
                max={420}
                step={2}
                hint={`Requests per second hitting the system (${fmtRps(controls.traffic)} req/s).`}
                onChange={(v) => update({ traffic: v })}
              />
              <Ctl
                label="Write share"
                value={controls.writeShare}
                valueText={controls.writeShare + '% writes'}
                min={2}
                max={60}
                step={1}
                hint="Portion of traffic that writes (posts + likes) vs reads."
                onChange={(v) => update({ writeShare: v })}
              />
            </>
          )}

          <div className="sec-t">Scaling controls</div>
          {c.web && (
            <Ctl
              label="Web / service instances"
              value={controls.web}
              valueText={String(controls.web)}
              min={1}
              max={24}
              step={1}
              hint="Clone the stateless API gateway + services. Near-linear — until the DB is the wall."
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
              hint="Share of reads served from Redis instead of Postgres."
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
              hint="Postgres read replicas absorbing read queries (they lag the primary)."
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
              hint="Caps fan-out consumer parallelism. Too few → fan-out lag piles up."
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
                hint="Shard the write primary by user_id — the only way writes scale out."
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
                hint="Redis Cluster shards for cache memory + throughput."
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
              hint="More regions = closer to users, more replication traffic."
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
              hint="Cross-region propagation delay. Higher = more eventual, weaker consistency."
              onChange={(v) => update({ repl: v })}
            />
          )}

          <div className="tip">
            <b>{stage.tip.h}</b>
            <p>{stage.tip.p}</p>
            <div className="try">
              ▸ Try: <span dangerouslySetInnerHTML={{ __html: stage.tip.try }} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
