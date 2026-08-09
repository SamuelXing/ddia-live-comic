import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { fmt } from './format'
import { Picker, Info, Num, Slider, Ctl } from './calcUI'
import {
  WORKLOAD, DERIVED_INP, HW, FRESH, TXN, LOSS, ANALYTICS, ACCESS, RECENCY, PROTOCOLS, STORES, PRESETS, INIT, storeConstants,
  model, consequences, sensitivity, NEED_LABEL,
  type Ceil, type EngineCol, type Req, type Vals,
} from './calcModel'

/* ============================================================
   Capacity planning from first principles.

   The arithmetic lives in calcModel.ts (pure, unit-tested — see
   calcModel.test.ts, `npm test`); this file is presentation: the
   sliders, the decision tables, the verdict prose. The thesis:
   REQUIREMENTS FILTER, LOAD RANKS, CEILINGS FORCE — and every
   forced addition transforms the load each later tier sees.
   ============================================================ */

/** one decision, laid out as a computed comparison — losing columns stay
 *  visible, disqualified columns say which requirement removed them */
function Decision({
  title, info, rowLabels, cols, winner, pinned, onPin, verdict, pickFor, wild, sources, survivors,
}: {
  title: string
  info: string
  rowLabels: ReactNode[]
  cols: { id: string; label: string; cells: ReactNode[]; dq?: string | null; why?: string }[]
  winner: string
  pinned: string | null
  onPin: (id: string) => void
  verdict: ReactNode
  /** why you would choose the store in play, when the numbers alone do not say */
  pickFor?: string
  /** one operator running this composition at a published scale */
  wild?: string
  /** where that claim comes from — checkable rather than trivia */
  sources?: { label: string; href: string }[]
  /** stated outright, because the winner's highlight implies otherwise: a
   *  column that survived the requirements is a system you could actually run */
  survivors?: ReactNode
}) {
  const eff = pinned ?? winner
  const cls = (c: { id: string; dq?: string | null }) =>
    c.id === eff ? (pinned ? 'pin' : 'win') : c.dq ? 'dq' : ''
  const pinnedCol = pinned ? cols.find((c) => c.id === pinned) : null
  return (
    <div className="decide">
      <div className="dc-h">
        <b>{title}</b>
        <Info text={info} />
        {pinned && (
          <button className="dc-unpin" onClick={() => onPin(winner)} title="Clear the pin and let the requirements and arithmetic choose">
            let the numbers pick
          </button>
        )}
      </div>
      <div className="dc-scroll">
        <table className="dc-tbl">
          <thead>
            <tr>
              <th />
              {cols.map((c) => (
                <th key={c.id} className={cls(c)}>
                  <button onClick={() => onPin(c.id)} title={c.why ?? (c.dq ? c.dq : 'Pin this choice — everything downstream follows')}>
                    {c.label}
                    {c.id === eff && <span className="dc-tag">{pinned ? 'pinned' : 'the numbers pick'}</span>}
                    {c.id !== eff && c.dq && <span className="dc-tag">out</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowLabels.map((rl, i) => (
              <tr key={i}>
                <td className="rl">{rl}</td>
                {cols.map((c) => (
                  <td key={c.id} className={cls(c)}>{c.cells[i]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="dc-verdict">{verdict}</div>
      {survivors && <div className="dc-survivors">{survivors}</div>}
      {pickFor && <div className="dc-pick">You pick it for — {pickFor}</div>}
      {wild && (
        <div className="dc-pick">
          Someone runs it at scale — {wild}
          {sources && sources.length > 0 && (
            <span className="dc-src">
              {sources.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
                  {l.label} ↗
                </a>
              ))}
            </span>
          )}
        </div>
      )}
      {pinnedCol && pinnedCol.dq && (
        <div className="dc-pinnote">Pinned against a requirement — {pinnedCol.dq}.</div>
      )}
      {pinnedCol && !pinnedCol.dq && pinned !== winner && (
        <div className="dc-pinnote">
          Pinned by you — on these numbers the arithmetic would pick {cols.find((c) => c.id === winner)?.label}.
        </div>
      )}
    </div>
  )
}

const pc = (x: number) => fmt.n1(x * 100) + '%'
const dur = (s: number) =>
  s < 90 ? Math.round(s) + ' s' : s < 5400 ? Math.round(s / 60) + ' min' : s < 172800 ? fmt.n1(s / 3600) + ' h' : fmt.n1(s / 86400) + ' days'

export default function Calculator() {
  const [v, setV] = useState<Vals>(INIT)
  const [showHw, setShowHw] = useState(false)
  const [fresh, setFresh] = useState('pull')
  const [txn, setTxn] = useState('single')
  const [loss, setLoss] = useState('keep')
  const [analytics, setAnalytics] = useState('no')
  const [access, setAccess] = useState('point')
  const [recency, setRecency] = useState('stale')
  const [pinT, setPinT] = useState<string | null>(null)
  const [pinE, setPinE] = useState<string | null>(null)
  const [preset, setPreset] = useState<string | null>(null)
  const req: Req = { fresh, txn, loss, analytics, access, recency }

  /** any hand edit means we are no longer exactly the preset */
  const set = (id: string) => (n: number) => {
    setPreset(null)
    setV((s) => ({ ...s, [id]: n }))
  }
  const pickReq = (setter: (s: string) => void) => (id: string) => {
    setPreset(null)
    setter(id)
  }
  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!
    setPreset(id)
    setFresh(p.req.fresh)
    setTxn(p.req.txn)
    setLoss(p.req.loss)
    setAnalytics(p.req.analytics)
    setAccess(p.req.access)
    setRecency(p.req.recency)
    setPinT(null)
    setPinE(null)
    // reset workload+derived to defaults first so a preset is deterministic,
    // then apply its values; hardware constants are left alone
    setV((s) => {
      const n = { ...s }
      ;[...WORKLOAD, DERIVED_INP].forEach((i) => (n[i.id] = i.val))
      return { ...n, ...p.sets }
    })
  }
  const resetAll = () => {
    setV(INIT)
    setFresh('pull')
    setTxn('single')
    setLoss('keep')
    setAnalytics('no')
    setAccess('point')
    setRecency('stale')
    setPinT(null)
    setPinE(null)
    setPreset(null)
  }
  const atDefaults =
    Object.keys(INIT).every((k) => v[k] === INIT[k]) &&
    fresh === 'pull' && txn === 'single' && loss === 'keep' && analytics === 'no' &&
    access === 'point' && recency === 'stale' && pinT === null && pinE === null

  // ---------- all arithmetic: the pure, unit-tested model ----------
  const m = model(v, req)
  const effT = PROTOCOLS.find((p) => p.id === (pinT ?? m.transportWin))!
  const effE = STORES.find((e) => e.id === (pinE ?? m.engineWin))!
  const winE = STORES.find((e) => e.id === m.engineWin)!
  const c = consequences(v, req, m, effT.holds)
  /* The counterfactual: the same workload with the store the ARITHMETIC picked.
     Pinning a different survivor changes what the system needs — a store whose
     reads cost twice as much can push the read pressure over the threshold that
     forces a cache — and the honest thing is to attribute that change to the
     pick rather than let it appear as if the workload changed. */
  const cWin = consequences({ ...v, ...storeConstants(winE, access) }, req, m, effT.holds)
  const sens = sensitivity(v, req)

  /* Clicking a computed percentage should answer "percent of WHAT" by taking
     you to the ceiling it was divided by, and marking it so you can see which
     row you landed on. */
  const [flash, setFlash] = useState<Ceil | null>(null)
  const flashTimer = useRef<number | null>(null)
  useEffect(() => () => { if (flashTimer.current) window.clearTimeout(flashTimer.current) }, [])
  const jump = (id: Ceil) => {
    const el = document.getElementById('ceil-' + id)
    if (!el) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' })
    setFlash(id)
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(null), 2000)
  }

  /** the chosen shape writes its constants into the visible panel below */
  useEffect(() => {
    // read amplification is resolved for the access pattern, so switching
    // between point lookups and range scans moves the visible constant too
    setV((s) => ({ ...s, ...effT.sets, ...storeConstants(effE, access) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effT.id, effE.id, access])

  // ---------- decision cards: model numbers, dressed in prose ----------
  const tCols = m.tCols.map((t) => {
    const p = PROTOCOLS.find((x) => x.id === t.id)!
    return {
      id: t.id,
      label: p.label,
      dq: t.dq,
      cells: [
        t.id === 'req' ? 'no' : 'yes',
        t.holds ? `${fmt.compact(m.heldConns)} · ${fmt.int(t.hosts)} host${t.hosts === 1 ? '' : 's'}` : '—',
        `~${p.sets.overhead} B`,
        `${fmt.n1(t.eg)} Gbps`,
      ] as ReactNode[],
    }
  })
  const tVerdict =
    fresh === 'push'
      ? `Request/response is out — data must appear on its own, and nothing is held open to push down. Between the survivors: both hold ${fmt.compact(m.heldConns)} connections, but polling repays full headers on every message — ${fmt.n1(m.tCols[1].eg)} vs ${fmt.n1(m.tCols[2].eg)} Gbps at ${fmt.compact(m.readSide)} deliveries/s. WebSocket wins on arithmetic.`
      : `Nothing must be pushed, so plain request/response wins: the other columns would hold ${fmt.compact(m.heldConns)} sockets open — ${fmt.int(m.tCols[2].hosts)} host${m.tCols[2].hosts === 1 ? '' : 's'} of connection tier — to deliver nothing the client could not ask for.`

  const engCols = m.eCols.map((col) => {
    const e = col.store
    return {
      id: col.id,
      label: e.label,
      dq: col.dq,
      why: e.chooseFor,
      cells: [
        <span className="dc-ex">
          {e.examples}
          <Info text={e.examplesInfo} />
        </span>,
        e.model,
        e.engine,
        e.dist,
        e.txnScope,
        e.perWrite,
        col.id === 'mem' ? '—' : `${fmt.bytes(col.bw)}/s · ${pc(col.bwU)}`,
        col.id === 'mem' ? `${pc(col.worst)}` : pc(col.rU),
        col.id === 'mem' ? `${fmt.int(m.ramHosts)} host${m.ramHosts === 1 ? '' : 's'} × ${v.ram} GB` : '—',
      ] as ReactNode[],
    }
  })
  const alive = m.eCols.filter((x) => !x.dq)
  const outCols = m.eCols.filter((x) => x.dq)
  const effCol = m.eCols.find((x) => x.id === effE.id)!
  const winCol = m.eCols.find((x) => x.id === m.engineWin)!
  /** a pin the requirements allow — a real alternative, not an override */
  const pinnedAlt = pinE !== null && pinE !== m.engineWin && !effCol.dq
  const shortOf = (id: string) => STORES.find((e) => e.id === id)!.short

  /* Every utilisation on this page is a division by one of the ceilings in the
     table above. Naming which ceiling — and showing the division — is what
     turns "8.7%" from a verdict into something the reader can check. */
  const wallOf = (col: EngineCol): { ceil: Ceil; how: string } => {
    const amp = storeConstants(col.store, access).readAmp
    if (col.id === 'mem')
      return { ceil: 'cache', how: `${fmt.compact(m.readSide + m.dbWrites)}/s of ops ÷ ${fmt.compact(m.cacheCeiling)}/s on one core` }
    if (col.worstName === 'the write stream')
      return { ceil: 'stream', how: `${fmt.bytes(col.bw)}/s ÷ ${v.seqWrite} GiB/s sequential` }
    return { ceil: 'reads', how: `${fmt.compact(col.colReads)}/s${m.cacheAbsorbs ? ' of misses' : ''} × ×${amp} per read ÷ ${fmt.compact(m.diskReadCeiling)}/s` }
  }

  /** what the load has already become by the time it reaches any store */
  const chain: ReactNode[] = []
  if (m.cacheAbsorbs)
    chain.push(
      <>
        {fmt.compact(m.readSide)}/s of read + delivery work, but a cache absorbs {v.cacheHit}% of it — so{' '}
        <Num how={`${fmt.compact(m.readSide)}/s × (1 − ${v.cacheHit}%)`} ceil="reads" jump={jump}>
          {fmt.compact(m.readSide * (1 - v.cacheHit / 100))}/s
        </Num>{' '}
        is what actually reaches a disk. Every column is judged on that number, not the raw one.
      </>,
    )
  if (m.logNeed)
    chain.push(
      <>
        peaks run ×{fmt.n1(v.peak)} above average and a log absorbs them, so the store consumes{' '}
        <Num how={`${fmt.compact(m.peakWrites)}/s peak ÷ ×${fmt.n1(v.peak)}`} ceil="writes" jump={jump}>
          {fmt.compact(m.dbWrites)} writes/s
        </Num>{' '}
        sustained rather than {fmt.compact(m.peakWrites)}/s.
      </>,
    )
  if (m.blobNeed)
    chain.push(
      <>
        objects are {fmt.bytes(m.bytesW)}, so the bytes live in object storage and the store holds a{' '}
        {fmt.bytes(m.dbBytesW)} pointer row — {fmt.bytes(m.dbStorage)} of rows instead of{' '}
        {fmt.bytes(m.storageTotal)}.
      </>,
    )

  /* AMDAHL'S LAW on the ceilings: the wall you are against, how far away it is,
     and — the part people skip — how little removing it would buy, because the
     wall behind it does not move. */
  const a = m.amdahl
  const otherWall = a.binding === 'the write stream' ? 'read pressure' : 'the write stream'
  const headroom: ReactNode =
    !isFinite(a.gain) ? (
      <>
        {shortOf(m.engineWin)} binds on {a.binding} at{' '}
        <Num how={wallOf(winCol).how} ceil="cache" jump={jump}>{pc(a.bindingUtil)}</Num>, and nothing else in this model binds at all — it is
        the only wall here.
      </>
    ) : a.bindingUtil >= 1 ? (
      <>
        {shortOf(m.engineWin)} is <em>already past</em> {a.binding}, at{' '}
        <Num how={wallOf(winCol).how} ceil={wallOf(winCol).ceil} jump={jump}>{pc(a.bindingUtil)}</Num> of one node — which is why this data gets
        partitioned. The other wall, {otherWall}, sits at {pc(a.nextUtil)}, so splitting for the first one has{' '}
        <Num how={`${pc(a.bindingUtil)} ÷ ${pc(a.nextUtil)}`}>×{fmt.sig(a.gain)}</Num> of runway before the second
        becomes the problem.
      </>
    ) : (
      <>
        {shortOf(m.engineWin)} binds first on {a.binding}, at{' '}
        <Num how={wallOf(winCol).how} ceil={wallOf(winCol).ceil} jump={jump}>{pc(a.bindingUtil)}</Num> — so{' '}
        <Num how={`1 ÷ ${pc(a.bindingUtil)}`}>×{fmt.sig(1 / a.bindingUtil)}</Num> more load before it binds at all. The
        other wall, {otherWall}, sits at {pc(a.nextUtil)}, and that is what caps any fix to the first one:{' '}
        <Num how={`${pc(a.bindingUtil)} ÷ ${pc(a.nextUtil)}`}>×{fmt.sig(a.gain)}</Num> at the very most, after which
        you are against the next wall instead.
      </>
    )

  /** the closing read: what actually decides it, once throughput has spoken */
  let so: ReactNode
  if (alive.length === 1) {
    so = <>Only {shortOf(alive[0].id)} satisfies the requirements. There is no comparison to make until a requirement changes.</>
  } else if (m.engineTie.length > 1) {
    const names = m.engineTie.map(shortOf)
    const joined = names.length === 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
    so = (
      <>
        {joined} land within 5% of each other, so <b>throughput does not decide this one</b>.{' '}
        {c.shards > 8 ? (
          <>
            At <Num how={c.shardBy === 'storage' ? `${fmt.bytes(m.dbStorage)} ÷ ${v.diskPerNode} TB per node` : `${fmt.compact(m.dbWrites)} writes/s ÷ ${fmt.compact(m.writeCeiling)}/s`} ceil={c.shardBy === 'storage' ? 'data' : 'writes'} jump={jump}>{c.shards} shards</Num>{' '}
            it is decided operationally instead: a ring rebalances itself and hand-sharded primaries do not — you own
            the routing, the rebalancing and the failover, forever. Weigh that against the atomicity scope row: what
            each one stops being able to promise.
          </>
        ) : (
          <>Pick on the atomicity scope row — what each one stops being able to promise — not on the numbers.</>
        )}
      </>
    )
  } else {
    so = (
      <>
        {shortOf(m.engineWin)} has the lowest first wall, so the arithmetic picks it.
        {m.engineWin === 'wide' && ' Appending in sorted batches is what holds it lower — it repays the difference later as background compaction, off the commit path.'}
        {access === 'range' && ' Reads sweep ranges here, so the sorted stores are not paying their point-lookup penalty: a range scan inside one partition is one pass over contiguous rows, not a probe across several files.'}
      </>
    )
  }

  const eVerdict = (
    <>
      {outCols.length > 0 && (
        <div className="vd-sec">
          <span className="vd-h out">Ruled out by a requirement</span>
          <ul className="vd-list">
            {outCols.map((x) => (
              <li key={x.id}>
                <b>{shortOf(x.id)}</b> — {x.dq}
                {x.dqHow && (
                  <div className="vd-how">
                    ↳{' '}
                    <Num ceil={x.dqCeil ?? undefined} jump={jump}>
                      {x.dqHow}
                    </Num>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {chain.length > 0 && (
        <div className="vd-sec">
          <span className="vd-h">What is left by the time it reaches a store</span>
          <ul className="vd-list">
            {chain.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      {alive.length > 1 && (
        <div className="vd-sec">
          <span className="vd-h">How close each survivor gets to its first wall</span>
          <table className="vd-tbl">
            <thead>
              <tr>
                <th>Store</th>
                <th>Its first wall</th>
                <th>How close</th>
                <th>The division that produced it</th>
              </tr>
            </thead>
            <tbody>
              {alive.map((col) => {
                const w = wallOf(col)
                return (
                  <tr key={col.id} className={col.id === m.engineWin ? 'w' : ''}>
                    <td>{shortOf(col.id)}</td>
                    <td>{col.worstName}</td>
                    <td>
                      <Num how={w.how} ceil={w.ceil} jump={jump}>
                        {pc(col.worst)}
                      </Num>
                    </td>
                    <td className="how">{w.how}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="vd-sec">
        <span className="vd-h">Headroom, and what fixing the wall would buy</span>
        <p>{headroom}</p>
      </div>
      <div className="vd-sec">
        <span className="vd-h">So</span>
        <p>{so}</p>
      </div>
    </>
  )

  // ---------- output tables ----------
  const derived: { k: string; v: string; how: string }[] = [
    { k: 'Requests', v: `${fmt.compact(m.avgQps)}/s avg · ${fmt.compact(m.peakQps)}/s peak`, how: `${fmt.compact(v.dau)} × ${v.actions} ÷ 86,400 × ${fmt.n1(v.peak)}` },
    { k: 'Split at peak', v: `${fmt.compact(m.peakReads)}/s reads · ${fmt.compact(m.peakWrites)}/s writes`, how: `peak × ${v.readPct}% / ${100 - v.readPct}%` },
    { k: 'Delivery side', v: `${fmt.compact(m.readSide)}/s`, how: v.fanout === 0 ? `${fmt.compact(m.peakReads)} reads — ingest, nothing is delivered` : `${fmt.compact(m.peakReads)} reads + ${fmt.compact(m.peakWrites)} writes × ${v.fanout} fan-out` },
    { k: 'Live connections', v: effT.holds ? `${fmt.compact(c.connections)} · ~${fmt.int(c.connHosts)} host${c.connHosts === 1 ? '' : 's'}` : 'none', how: effT.holds ? `${fmt.compact(v.dau)} × ${v.online}% ÷ ${fmt.compact(v.connsPerHost)} per host` : `${effT.label.toLowerCase()} holds nothing open` },
    { k: 'New data', v: `${fmt.bytes(m.storagePerDay)}/day`, how: `${fmt.compact(m.writesPerDay)} writes/day × ${fmt.bytes(m.bytesW)} written` },
    { k: 'Stored at retention', v: fmt.bytes(m.storageTotal), how: `${fmt.bytes(m.storagePerDay)}/day × 30 × ${v.retention} mo, before replication${m.blobNeed ? ` — ${fmt.bytes(m.dbStorage)} of it as rows, the rest in object storage` : ''}` },
    { k: 'Disk write rate', v: `${fmt.bytes(c.diskWriteBytes)}/s`, how: `${fmt.compact(m.peakWrites)} writes/s × ${fmt.bytes(m.bytesW)} × ${v.writeAmp} amplification` },
    { k: 'Peak egress', v: `${fmt.n1(c.egressGbps)} Gbps`, how: `${fmt.compact(m.peakReads)} reads × ${fmt.bytes(m.bytesR)} + ${fmt.compact(m.deliveries)} deliveries × ${fmt.bytes(m.bytesW)}, +${v.overhead} B protocol each` },
    { k: 'Request workers', v: `~${fmt.int(c.webInstances)}`, how: `Little’s Law: ${fmt.compact(m.peakQps)}/s × ${v.lat} ms ÷ ${v.slots} slots${effT.holds ? ' — separate from the connection tier' : ''}` },
  ]

  /* These are properties of ONE MACHINE, so they do not move when the workload
     does — that is the whole point of a ceiling. The `use` column is what
     changes: how close this particular workload gets to each wall. Without it
     the section looked frozen, and a reader switching presets reasonably
     concluded the page was broken. */
  const cacheUse = m.readSide / m.cacheCeiling
  const ceilings: { id: Ceil; k: string; v: string; use: string; how: string }[] = [
    { id: 'writes', k: 'Durable writes', v: `${fmt.compact(m.writeCeiling)}/s`,
      use: `${fmt.compact(m.peakWrites)}/s at peak · ${pc(m.writeUtil)}`,
      how: `${v.group} commits per fsync ÷ ${v.fsync} µs` },
    { id: 'reads', k: 'Random reads', v: `${fmt.compact(m.diskReadCeiling)}/s`,
      use: v.readAmp === 0 ? 'no disk reads — it is all RAM' : `${fmt.compact(m.readSide)}/s × ${v.readAmp} · ${pc(c.readUtil)}`,
      how: `${v.ioDepth} concurrent ÷ ${v.randRead} µs` },
    /* The engine table measures every write stream against this, so it has to
       be listed as a ceiling too — otherwise "1.1% of 3 GiB/s" points at a wall
       the reader was never shown. */
    { id: 'stream', k: 'Write stream', v: `${v.seqWrite} GiB/s`,
      use: effE.id === 'mem' ? 'nothing reaches disk — it is all RAM' : `${fmt.bytes(effCol.bw)}/s · ${pc(effCol.bwU)}`,
      how: 'sequential bandwidth, before any fsync' },
    { id: 'cache', k: 'Cache ops', v: `${fmt.compact(m.cacheCeiling)}/s`,
      use: `${fmt.compact(m.readSide)}/s · ${pc(cacheUse)} → ${c.cacheNodes} node${c.cacheNodes === 1 ? '' : 's'}`,
      how: `1 ÷ ${v.cacheOp} µs per op` },
    { id: 'data', k: 'Data it should hold', v: `${v.diskPerNode} TB`,
      use: `${fmt.bytes(m.dbStorage)} of rows · ${m.storageShards} shard${m.storageShards === 1 ? '' : 's'}`,
      how: 'backup + replica-rebuild time, not IOPS' },
    { id: 'egress', k: 'Egress', v: `${v.nic} Gbps`,
      use: `${fmt.n1(c.egressGbps)} Gbps · ${pc(c.egressGbps / v.nic)} → ${c.originHosts} host${c.originHosts === 1 ? '' : 's'}`,
      how: 'NIC capacity' },
    { id: 'conns', k: 'Connections held', v: fmt.compact(v.connsPerHost),
      use: effT.holds ? `${fmt.compact(c.connections)} held · ${c.connHosts} host${c.connHosts === 1 ? '' : 's'}` : 'none held',
      how: 'memory + file descriptors + heartbeat CPU' },
    { id: 'scan', k: 'Full scan', v: dur(m.scanSeconds),
      use: 'grows with retention — not a fixed wall',
      how: `${fmt.bytes(m.dbStorage)} of rows ÷ ${v.seqRead} GiB/s sequential` },
  ]

  /* `trigger` is what a not-yet card is missing: the lever that would make it
     fire. Several components are gated by a REQUIREMENT rather than a
     threshold — no amount of workload tuning reaches a connection tier — so
     "the number to watch" was 0 forever and told the reader nothing. */
  type NeedKey = keyof typeof c.needs
  /** `crossShard` is decided by the chosen store rather than by a ceiling, so
   *  it lives here rather than in the model's needs flags */
  interface Rec { key: NeedKey | 'crossShard'; need: boolean; what: string; number: string; trigger: string; because: string; to: { label: string; href: string }[] }
  /* Which forced components differ because YOU pinned a store rather than
     taking the one the arithmetic picked. A store whose point lookups cost
     twice as much can push read pressure over the threshold that forces a
     cache — that is a real consequence of the pick, and it should be
     attributed to the pick rather than appearing as if the workload moved. */
  const crossShard = (st: typeof effE, cc: typeof c) => txn === 'multi' && cc.shardNeed && st.multiKey === 'shard'
  const pinChanged: string[] = !pinnedAlt
    ? []
    : [
        ...(Object.keys(c.needs) as NeedKey[]).filter((k) => c.needs[k] !== cWin.needs[k]),
        ...(crossShard(effE, c) !== crossShard(winE, cWin) ? ['crossShard'] : []),
      ]
  const recs: Rec[] = [
    {
      key: 'connTier',
      need: c.needs.connTier,
      what: 'A separate connection tier',
      number: effT.holds
        ? `${fmt.compact(c.connections)} live connections ÷ ${fmt.compact(v.connsPerHost)} per host = ${c.connHosts} hosts, before any request work`
        : 'nothing is held open — request/response opens a connection per request and closes it again',
      trigger: effT.holds
        ? `${fmt.compact(c.connections)} connections ÷ ${fmt.compact(v.connsPerHost)} per host — one host still absorbs it`
        : `gated by a requirement, not a number: set “how users get new data” to “it must appear”. At ${v.online}% of ${fmt.compact(v.dau)} online that would be ${fmt.compact(m.heldConns)} held connections`,
      because:
        'connections are held, not served — a mostly idle socket still costs memory, a file descriptor and a heartbeat. This tier is sized by concurrency, not by request rate, so it scales separately from everything else and is usually stateless in front of a message bus',
      to: [
        { label: 'Web / app tier', href: '/components/web' },
        { label: 'Idea: the trouble with distributed systems', href: '/read/distributed-troubles' },
      ],
    },
    {
      key: 'fanout',
      need: c.needs.fanout,
      what: 'Fan-out on read, or a fan-out worker pool',
      number: `${fmt.compact(m.peakWrites)} writes/s × ${v.fanout} = ${fmt.compact(m.deliveries)} deliveries/s`,
      trigger: `fires when deliveries pass the ${fmt.compact(m.writeCeiling)}/s write ceiling — at ${fmt.compact(m.peakWrites)} writes/s that needs a fan-out above ×${fmt.int(Math.max(2, Math.ceil(m.writeCeiling / Math.max(1, m.peakWrites))))}`,
      because:
        'writing once is cheap; delivering it to every recipient is what costs. Past a certain fan-out you stop pushing copies at write time and let readers pull instead — or you accept the write amplification and do it asynchronously in workers',
      to: [
        { label: 'Idea: leader & followers', href: '/read/replication-leader' },
        { label: 'Kafka deep-dive', href: '/components/kafka' },
      ],
    },
    {
      key: 'cdn',
      need: c.needs.cdn,
      what: 'A CDN in front of the origin',
      number: `${fmt.n1(c.egressGbps)} Gbps ÷ ${v.nic} Gbps per host = ${c.originHosts} hosts of pure bandwidth — after ${v.cdnHit}% offload, ${fmt.n1(c.originAfter)} Gbps and ${c.originHostsAfter} host${c.originHostsAfter === 1 ? '' : 's'}`,
      trigger: `fires when peak egress passes one ${v.nic} Gbps NIC — you are at ${fmt.n1(c.egressGbps)} Gbps`,
      because: 'serving these bytes from your own origin costs hosts and egress; a CDN moves the copy next to the user and the bill off your origin. What it cannot absorb — personalized, private — still needs origin NICs',
      to: [{ label: 'S3 / object storage', href: '/components/s3' }],
    },
    {
      key: 'blob',
      need: c.needs.blob,
      what: 'Blobs out of the database',
      number: m.bytesW >= 8192
        ? `${fmt.bytes(m.bytesW)} written per object — a database page is 8 KB, so one object spans ~${fmt.int(m.bytesW / 8192)} pages`
        : `${fmt.bytes(m.bytesW)} written per object — still inside a single 8 KB database page`,
      trigger: `fires at objects of 500 KB and up — yours are ${fmt.bytes(m.bytesW)}`,
      because:
        'a row store is built for KB-scale rows: replication, backups and vacuuming all re-carry every byte you put in it. Store a pointer in the row and the bytes in object storage, and let the CDN serve them from there',
      to: [{ label: 'S3 / object storage', href: '/components/s3' }],
    },
    {
      key: 'cache',
      need: c.needs.cache,
      what: 'A cache in front of the database',
      number: `${fmt.compact(m.readSide)}/s of read+delivery work is ${fmt.n1(c.readUtil * 100)}% of one node’s ${fmt.compact(m.diskReadCeiling)}/s random-read ceiling — at ${v.cacheHit}% hits, ${fmt.compact(c.missReads)}/s survives to disk`,
      trigger: `fires above 30% of one node's random-read ceiling — you are at ${pc(c.readUtil)}`,
      because: m.cacheOnWritePath
        ? `a disk read costs ${v.randRead} µs; the same read from memory costs ~20 ns. But these reads must be current, so this cannot be a read-through cache with a TTL — it has to be written or invalidated in the same breath as the database, which puts it on the write path and makes a stale entry a correctness bug rather than a slow query. Asynchronous read replicas are out for the same reason: they are behind by definition`
        : `a disk read costs ${v.randRead} µs; the same read from memory costs ~20 ns. Caching is not only about throughput — it is a 1000× latency difference. Stale reads being acceptable is what makes this cheap: entries can expire on a timer instead of being invalidated on every write`,
      to: [
        { label: 'Redis deep-dive', href: '/components/redis' },
        { label: 'Idea: replication lag', href: '/read/replication-lag' },
        { label: 'What a cache does NOT do for your p99', href: '/calculator/latency' },
      ],
    },
    {
      key: 'cacheNodes',
      need: c.needs.cacheNodes,
      what: 'More than one cache node',
      number: `${fmt.compact(m.readSide)}/s delivery side ÷ ${fmt.compact(m.cacheCeiling)}/s per core = ${c.cacheNodes} node${c.cacheNodes === 1 ? '' : 's'}`,
      trigger: `fires above ${fmt.compact(m.cacheCeiling)}/s of delivery-side work — you are at ${fmt.compact(m.readSide)}/s`,
      because: 'a cache server is effectively single-threaded per shard, so past one core’s worth of operations you are partitioning, not scaling up',
      to: [
        { label: 'Redis deep-dive', href: '/components/redis' },
        { label: 'Idea: consistent hashing', href: '/read/partitioning' },
      ],
    },
    {
      key: 'log',
      need: c.needs.log,
      what: 'A log in front of the writes',
      number: `peaks reach ${fmt.n1(m.writeUtil * 100)}% of the write ceiling, ×${fmt.n1(v.peak)} above average — behind the log the primary consumes ${fmt.compact(m.dbWrites)}/s sustained`,
      trigger: `fires when peaks pass half the write ceiling with a peak factor of 2 or more — you are at ${pc(m.writeUtil)} of ${fmt.compact(m.writeCeiling)}/s, ×${fmt.n1(v.peak)}`,
      because: 'a durable log absorbs the spike at sequential-write speed and lets the database consume at its own pace, instead of sizing the database for the worst minute of the day',
      to: [
        { label: 'Kafka deep-dive', href: '/components/kafka' },
        { label: 'What the extra hop costs in ms', href: '/calculator/latency' },
      ],
    },
    {
      key: 'shard',
      need: c.needs.shard,
      what: 'Shard the database',
      number:
        c.shardBy === 'storage'
          ? `${fmt.bytes(m.dbStorage)} of rows ÷ ${v.diskPerNode} TB per node = ${m.storageShards} shards — the write rate alone (${fmt.n1(c.writeUtilAfter * 100)}% of one primary) would never have forced this`
          : c.shardBy === 'writes'
            ? `${fmt.compact(m.dbWrites)} writes/s${m.logNeed ? ' sustained, behind the log,' : ''} vs a ${fmt.compact(m.writeCeiling)}/s ceiling (${fmt.n1(c.writeUtilAfter * 100)}% of one primary)`
            : `two independent reasons: ${fmt.compact(m.dbWrites)} writes/s needs ${c.writeShards} shards, ${fmt.bytes(m.dbStorage)} of rows needs ${m.storageShards} — the larger wins`,
      trigger: `fires when sustained writes outgrow one primary (${pc(c.writeUtilAfter)} now) or rows outgrow ${v.diskPerNode} TB per node (${fmt.bytes(m.dbStorage)} now)`,
      because: `replicas do not help: every replica holds every byte and replays every write. ${c.shardBy === 'storage' ? 'Past some tens of TB, backups and replica rebuilds take longer than anyone can tolerate — data size splits the store even when the write rate never would.' : 'Past one primary the only move left is to split the data.'} ${effE.scale}${isFinite(m.monthsToDouble) ? ` And it is not once: at ${v.growth}%/mo the data doubles every ${Math.round(m.monthsToDouble)} months, so the shard count doubles on the same clock. What differs is what each repetition costs. Hand-managed, the worst published case is Google's AdWords MySQL: “the last resharding took over two years of intense effort… across dozens of teams”, and they capped growth rather than do it again. Automatic is far cheaper but not free — DynamoDB splits partitions “in the order of minutes”, while a Cassandra node joining a busy cluster was measured at 106 hours to stream 2.2 TB and three weeks to finish compacting.` : ''}`,
      to: [
        { label: 'Idea: consistent hashing', href: '/read/partitioning' },
        { label: 'Postgres deep-dive', href: '/components/postgres' },
        { label: 'What scatter-gather does to your p99', href: '/calculator/latency' },
      ],
    },
    /* The one recommendation that depends on WHICH store you ended up with.
       A transaction inside one shard is an ordinary transaction; the same
       transaction across two is a distributed one, and only some of these
       columns can even offer it. Pinning a different survivor genuinely
       changes whether this card appears. */
    {
      key: 'crossShard',
      need: txn === 'multi' && c.shardNeed && effE.multiKey === 'shard',
      what: 'A plan for transactions that cross a shard',
      number: `${c.shards} shards, and writes must be atomic across keys — every transaction touching two of them is a distributed transaction`,
      trigger:
        effE.multiKey === 'yes'
          ? `gated by the store: ${effE.short} keeps everything in one transaction, so there is no shard to cross`
          : `gated by two things at once — writes that span keys, AND enough load to force a split. You have ${c.shards} shard${c.shards === 1 ? '' : 's'}`,
      because:
        'inside one shard this is free; across two it needs a coordinator, a prepare phase, and an answer for what happens when the coordinator dies holding locks — slower, and failing in more ways than a local commit can. The usual escape is not a better protocol but a better partition key: pick one that keeps the things that change together on the same shard, and the distributed case stops arising',
      to: [
        { label: 'Idea: consistent hashing', href: '/read/partitioning' },
        { label: 'Idea: the trouble with distributed systems', href: '/read/distributed-troubles' },
      ],
    },
    {
      key: 'logConsumers',
      need: c.needs.logConsumers,
      what: 'One log, many consumers',
      number: `${fmt.int(v.derived)} derived systems × ${fmt.compact(m.peakWrites)} writes/s — every change applied in ${fmt.int(v.derived + 1)} places`,
      trigger: `gated by a requirement: fires at 2 or more systems fed by every write — you have ${fmt.int(v.derived)}`,
      because:
        'if the app writes to each system directly, two of them will eventually apply “the same” changes in different orders and drift apart forever. Write once to a durable log and let every consumer — search, analytics, cache invalidation — replay the same order at its own pace',
      to: [
        { label: 'Kafka deep-dive', href: '/components/kafka' },
        { label: 'Idea: leader & followers', href: '/read/replication-leader' },
      ],
    },
    {
      key: 'analytical',
      need: c.needs.analytical,
      what: 'A separate analytical store',
      number: `a full scan of ${fmt.bytes(m.dbStorage)} of rows at ${v.seqRead} GiB/s sequential = ${dur(m.scanSeconds)} — on the same disk your 5 ms lookups live on`,
      trigger: 'gated by a requirement: set “what the data must answer” to “also analyze it”',
      because:
        'a row store reads every column of every row to answer an aggregate. A columnar store reads only the columns the query touches and compresses them severalfold (structured data compresses 5–10×, per napkin-math) — fed from the same log by change-data-capture, so the primary never feels the scan',
      to: [
        { label: 'Idea: B-trees vs LSM-trees', href: '/read/storage' },
        { label: 'Kafka deep-dive', href: '/components/kafka' },
      ],
    },
  ]
  const needed = recs.filter((r) => r.need)
  const notYet = recs.filter((r) => !r.need)

  /** the load each tier sees once the forced additions exist */
  const after: { k: string; v: string; how: string }[] = []
  if (c.cdnNeed)
    after.push({ k: 'Origin egress', v: `${fmt.n1(c.egressGbps)} → ${fmt.n1(c.originAfter)} Gbps`, how: `× (1 − ${v.cdnHit}% CDN offload) → ${c.originHostsAfter} origin host${c.originHostsAfter === 1 ? '' : 's'}` })
  if (c.cacheNeed)
    after.push({ k: 'Reads reaching the database', v: `${fmt.compact(m.readSide)} → ${fmt.compact(c.missReads)}/s`, how: `misses only: × (1 − ${v.cacheHit}% hit rate) → ${pc(c.readUtilAfter)} of the read ceiling` })
  if (m.logNeed)
    after.push({ k: 'Writes reaching the primary', v: `${fmt.compact(m.peakWrites)} → ${fmt.compact(m.dbWrites)}/s`, how: `the log absorbs the ×${fmt.n1(v.peak)} peak; the primary consumes at the daily average` })
  if (c.shardNeed)
    after.push(
      c.shardBy === 'storage'
        ? { k: 'Data per shard', v: `${fmt.bytes(m.dbStorage / c.shards)} × ${c.shards} shards`, how: `writes per shard: ${fmt.compact(m.dbWrites / c.shards)}/s — ${pc(m.dbWrites / c.shards / m.writeCeiling)} of one primary each` }
        : { k: 'Writes per shard', v: `${fmt.compact(m.dbWrites / c.shards)}/s × ${c.shards} shards`, how: `${pc(m.dbWrites / c.shards / m.writeCeiling)} of one primary each · ${fmt.bytes(m.dbStorage / c.shards)} of rows each` },
    )
  else if (c.cacheNeed || m.logNeed)
    after.push({ k: 'Primary write headroom', v: pc(c.writeUtilAfter), how: `${fmt.compact(m.dbWrites)}/s ÷ ${fmt.compact(m.writeCeiling)}/s ceiling — no sharding yet` })

  const g = v.growth / 100
  const activePreset = preset ? PRESETS.find((p) => p.id === preset)! : null

  return (
    <section className="calc-page">
      <p className="h-kicker">Capacity planning</p>
      <h1 className="title">What does this system actually need?</h1>
      <p className="lede">
        <b>Requirements filter, load ranks, ceilings force.</b> State the promises the system makes
        and the load it carries; requirement facts disqualify kinds of components outright —
        arithmetic never overrules a promise — the load arithmetic ranks what survives, and every
        crossed ceiling forces a structural addition, which changes the load every later tier sees.
        Every ceiling comes from the <b>hardware constants below</b>; none of it is a remembered
        rule of thumb.
      </p>

      {/* Stated up front, because a page full of confident numbers implies a
          scope it does not have. Naming what is NOT modelled is the cheapest
          way to stop the output being read as more than it is. */}
      <div className="calc-scope">
        <div className="scope-col in">
          <span className="scope-h">What it computes</span>
          <p>
            <b>Rates, bytes and machine counts at the peak minute.</b> Requests per second and their
            read/write split · the delivery load a fan-out creates · bytes stored at retention ·
            bytes on the wire · connections held · app instances by Little’s Law. Then it divides
            each of those by <b>one machine’s ceiling</b> — eight of them, all derived from the
            hardware constants — and reports which structural component each crossed ceiling forces,
            and which storage composition the surviving load ranks first.
          </p>
        </div>
        <div className="scope-col out">
          <span className="scope-h">What it does not</span>
          <p>
            <b>No latency, no money, no correctness.</b> There is no p50 or p99 here and no queueing
            model — a ceiling tells you where throughput stops, not what response times do on the way
            there. No dollars. Nothing about whether your data stays consistent, only whether the
            store <em>could</em> keep the promise. And it assumes an <b>even spread</b>: one hot key
            or one celebrity row breaks every average on this page.
          </p>
        </div>
      </div>

      {/* Worth stating plainly: this is a pure function, not a judgement.
          It is also the one property a reader can verify for themselves. */}
      <div className="calc-pure">
        <span className="scope-h">How the answer is produced</span>
        <p>
          <b>There is no model in the loop and nothing is inferred.</b> Every number here is a
          division you could do on paper, from constants printed on the page and adjustable by you.
          The arithmetic is a <em>pure function</em> — the same inputs give the same answer every
          time, with no memory of what it said before — covered by unit tests whose expected values
          were worked out by hand, and by a second suite pinned to figures real operators
          published. The constants marked <span className="src-a">assumed</span> are the honest
          exception: those are modelling choices, nobody checked them against <em>your</em> system,
          and the sweep below tells you which of them your answer is actually resting on. If you
          disagree with a verdict, there is exactly one place to look — the division printed next
          to it.
        </p>
      </div>

      <details className="calc-help">
        <summary>
          <span className="chev">▸</span> How to use this, and how it works
        </summary>
        <div className="calc-help-b">
          <h4>Using it</h4>
          <ol>
            <li>
              <b>Start from a typical system, or from scratch.</b> The presets are one honest hand
              moving every visible slider and requirement at once — inspect what they set, then
              adjust. Nothing about a preset is hidden state.
            </li>
            <li>
              <b>State the requirements</b> — must data appear on its own, do writes span keys, can
              the data be rebuilt, will anyone run analytics across all of it. These are facts about
              the product, not technology choices — and they act as <em>filters</em>: a requirement
              can disqualify a column outright, and no throughput number un-disqualifies it.
            </li>
            <li>
              <b>Describe the workload</b> — how many people, how often each one acts, how much
              bigger the busiest moment is, how large one written object and one read response are.
              Every input snaps to a round step (10k, 20k, 50k…) because at this level of modelling
              the <em>scale</em> is the answer; “16k users” implies a precision nobody has.
            </li>
            <li>
              <b>Read “the choices the numbers make.”</b> Transport and storage engine are computed
              comparisons: every option is a column, disqualified columns are greyed with the
              requirement that removed them, and each survivor is judged on <em>the load that would
              reach it in the system built around it</em> — its reads become misses if it forces a
              cache, its writes become the sustained rate behind a forced log. If reality has
              already chosen, <b>click that column to pin it</b>, and everything downstream follows.
            </li>
            <li>
              <b>Read “what the numbers force,”</b> then <b>“the load, after the additions.”</b> A
              component appears only when a computed ceiling is crossed, and each addition
              transforms the load downstream — which is why adding a log can make sharding
              unnecessary.
            </li>
            <li>
              <b>Open “the hardware underneath”</b> and change a constant to see how sensitive the
              conclusion is. If a decision flips when you nudge an assumption, that decision was
              never solid.
            </li>
          </ol>

          <h4>How the ceilings are computed</h4>
          <p>
            Nothing here is a remembered rule of thumb, and none of it is computed in the page as it
            renders: the arithmetic is a separate, unit-tested module whose expected values were
            worked out by hand. Each ceiling is one division:
          </p>
          <ul className="calc-formulas">
            <li><code>durable writes/s = commits per fsync ÷ fsync latency</code> — a commit is not durable until the write reaches disk, and one fsync can cover a batch of commits.</li>
            <li><code>random reads/s = concurrent reads ÷ random read latency</code> — an SSD serves many reads at once, so the queue depth multiplies throughput.</li>
            <li><code>cache ops/s = 1 ÷ per-op CPU cost</code> — a cache shard runs one command at a time on one core.</li>
            <li><code>full scan = stored bytes ÷ sequential read rate</code> — the arithmetic behind “don’t run analytics on the primary.”</li>
            <li><code>egress = reads × response size + deliveries × object size, ×8</code> — bytes to bits, against one host’s NIC.</li>
            <li><code>app instances = peak rate × latency ÷ concurrency</code> — Little’s Law: concurrency is arrival rate times service time.</li>
          </ul>
          <p>
            The chain works the same way: <code>misses = reads × (1 − hit rate)</code>,{' '}
            <code>sustained writes = peak ÷ peak factor</code>,{' '}
            <code>origin egress = egress × (1 − offload)</code>. Each is one line, and the two hit
            rates are <span className="src-a">assumed</span> constants you should challenge.
          </p>

          <h4>The discipline it borrows</h4>
          <p>
            Three habits are lifted straight from <em>Computer Architecture: A Quantitative
            Approach</em>, which spent five editions arguing that architecture is measurement rather
            than taste.
          </p>
          <ul>
            <li>
              <b>Never quote one number — quote the factors it is made of.</b> Hennessy and
              Patterson refuse to state “performance” without decomposing it into instruction count
              × cycles per instruction × clock time, because each factor is fixed by different
              work. Every number on this page carries the division that produced it, in the column
              beside it, for the same reason: the factored form tells you <em>which lever</em>, and
              the single number never does.
            </li>
            <li>
              <b>Amdahl’s law: the fix is capped by what you did not fix.</b> Each store here binds
              on one wall while the other sits nearly idle, so the useful question about any
              improvement is not how much faster that wall gets — it is how far away the next one
              is. That ratio is printed in the verdict, and it is frequently sobering.
            </li>
            <li>
              <b>Report the sensitivity, not just the estimate.</b> The section “which assumption is
              load-bearing” re-runs the entire model with each constant moved one rung, and lists
              only the moves that change an answer. It is the cheapest possible defence against a
              confident-looking table resting on a number nobody measured — and it earns its keep:
              it caught a real bug in this page’s own ranking, where a store with worse read
              amplification scored better because its own pressure was what forced the cache that
              then absorbed it.
            </li>
          </ul>

          <h4>What it will not tell you</h4>
          <p>
            It sizes <em>throughput and capacity</em>, not correctness, cost, or tail latency. It
            assumes an even spread — one hot key or one celebrity row breaks every average on this
            page. And the constants marked <span className="src-a">assumed</span> depend on your
            rows, indexes and access pattern. Treat the output as the order of magnitude you are
            dealing with, then measure the real thing.
          </p>
          <p>
            <b>The largest thing it cannot see is what your team already knows how to run.</b>{' '}
            Discord and Slack store chat messages with the same access pattern — a range of
            messages inside one channel partition — and made opposite choices: Discord moved to a
            wide-column ring, Slack sharded MySQL by channel id and serves 2.3M queries a second
            through it. Neither is wrong, and no arithmetic on this page separates them.
          </p>
          <p>
            That is not a one-off. Asked why they stayed on a familiar engine rather than a
            better-fitting one, four companies gave the same answer and none of them named a
            technical capability: Uber called it “operational trust… the experience with it that we
            had on the team”; Slack, “years of built up operational practices”; Figma chose “known
            low-risk solutions over potentially easier options with much higher uncertainty”;
            Instagram, “simple, easy-to-understand solutions that we trust”. A page that scores
            only workload fit will confidently disagree with all four. Read the winner here as{' '}
            <em>what the load permits</em>, not as what you should do on Monday.
          </p>
        </div>
      </details>

      {/* The storage comparison is six columns wide. Inside the sheet's
          1060px each column gets ~80px — not enough for a word — so this one
          card breaks out to the viewport, capped. The prose stays at reading
          width above and below it. */}
      <div className="card" style={{ padding: 0 }}>
        <div className="sandbox">
          <div className="sb-controls">
            <div className="sb-head">
              <p className="sb-title" style={{ margin: 0 }}>Start from a typical system</p>
              <button
                className="reset-btn"
                onClick={resetAll}
                disabled={atDefaults}
                title={atDefaults ? 'Already at defaults' : 'Restore every requirement, input and constant to its default'}
              >
                Reset all
              </button>
            </div>
            <div className="ctl">
              <Picker options={PRESETS} value={preset ?? ''} onPick={applyPreset} />
              <div className="ctl-hint">
                {activePreset
                  ? activePreset.info
                  : 'One click moves every slider and requirement below — nothing hidden. Adjust from there; any edit makes it yours.'}
              </div>
            </div>

            <p className="sb-title" style={{ marginTop: 18 }}>The requirements</p>
            <Ctl label="How reads find the data" info={ACCESS.find((o) => o.id === access)!.info} hint={ACCESS.find((o) => o.id === access)!.info.split('.')[0] + '.'}>
              <Picker options={ACCESS} value={access} onPick={pickReq(setAccess)} />
            </Ctl>
            <Ctl label="How fresh reads must be" info={RECENCY.find((o) => o.id === recency)!.info} hint={RECENCY.find((o) => o.id === recency)!.info.split('.')[0] + '.'}>
              <Picker options={RECENCY} value={recency} onPick={pickReq(setRecency)} />
            </Ctl>
            <Ctl label="Writes that span keys" info={TXN.find((o) => o.id === txn)!.info} hint={TXN.find((o) => o.id === txn)!.info.split('.')[0] + '.'}>
              <Picker options={TXN} value={txn} onPick={pickReq(setTxn)} />
            </Ctl>
            <Ctl label="If a node dies, this data" info={LOSS.find((o) => o.id === loss)!.info} hint={LOSS.find((o) => o.id === loss)!.info.split('.')[0] + '.'}>
              <Picker options={LOSS} value={loss} onPick={pickReq(setLoss)} />
            </Ctl>
            <Ctl label="What the data must answer" info={ANALYTICS.find((o) => o.id === analytics)!.info} hint={ANALYTICS.find((o) => o.id === analytics)!.info.split('.')[0] + '.'}>
              <Picker options={ANALYTICS} value={analytics} onPick={pickReq(setAnalytics)} />
            </Ctl>
            <Ctl label={DERIVED_INP.label} info={DERIVED_INP.info} hint={DERIVED_INP.hint} val={DERIVED_INP.fmt(v.derived)}>
              <Slider inp={DERIVED_INP} value={v.derived} set={set('derived')} />
            </Ctl>
            <Ctl label="How users get new data" info={FRESH.find((o) => o.id === fresh)!.info} hint={FRESH.find((o) => o.id === fresh)!.info.split('.')[0] + '.'}>
              <Picker options={FRESH} value={fresh} onPick={pickReq(setFresh)} />
            </Ctl>

            <p className="sb-title" style={{ marginTop: 18 }}>The workload</p>
            {WORKLOAD.map((inp) => (
              <Ctl key={inp.id} label={inp.label} info={inp.info} hint={inp.hint} val={inp.fmt(v[inp.id])}>
                <Slider inp={inp} value={v[inp.id]} set={set(inp.id)} />
              </Ctl>
            ))}

            <button className="hw-toggle" onClick={() => setShowHw((s) => !s)}>
              {showHw ? '▾' : '▸'} The hardware underneath
            </button>
            {showHw && (
              <div className="hw-body">
                <p className="hw-note">
                  Defaults are measured constants from{' '}
                  <a href="https://github.com/sirupsen/napkin-math" target="_blank" rel="noreferrer">
                    napkin-math
                  </a>{' '}
                  (MIT, March 2026, a 24-core Xeon with local SSD), plus modelling choices marked{' '}
                  <span className="src-a">assumed</span>. The transport and engine decisions write
                  into the protocol-overhead and amplification constants; everything else is yours
                  to drag, and every ceiling above moves with it.
                </p>
                {HW.map((inp) => (
                  <div className="ctl" key={inp.id}>
                    <div className="ctl-top">
                      <span className="ctl-label">
                        {inp.label}{' '}
                        <span className={inp.src === 'napkin' ? 'src-n' : 'src-a'}>
                          {inp.src === 'napkin' ? 'measured' : 'assumed'}
                        </span>
                        <Info text={inp.info} />
                      </span>
                      <span className="ctl-val">{inp.fmt(v[inp.id])}</span>
                    </div>
                    <Slider inp={inp} value={v[inp.id]} set={set(inp.id)} />
                    <div className="ctl-hint">{inp.hint}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sb-out">
            <p className="sb-title">So the system is</p>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Quantity</th>
                  <th>This workload</th>
                  <th>How it is worked out</th>
                </tr>
              </thead>
              <tbody>
                {derived.map((r) => (
                  <tr key={r.k}>
                    <td>{r.k}</td>
                    <td>{r.v}</td>
                    <td className="how">{r.how}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="sb-title">What one machine can do — and how close you are</p>
            <table className="tbl tbl-ceil">
              <thead>
                <tr>
                  <th>Limit</th>
                  <th>One machine</th>
                  <th>What you draw</th>
                  <th>Where the ceiling comes from</th>
                </tr>
              </thead>
              <tbody>
                {ceilings.map((r) => (
                  <tr key={r.id} id={'ceil-' + r.id} className={flash === r.id ? 'flash' : ''}>
                    <td>{r.k}</td>
                    <td>{r.v}</td>
                    <td className="use">{r.use}</td>
                    <td className="how">{r.how}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="tbl-note">
              These ceilings are properties of one machine, so they stay put when the workload
              changes — that is what makes them walls. The middle column is the part that moves.
            </p>

            <p className="sb-title">The choices the numbers make</p>
            <Decision
              title="Where the data lives"
              info="“SQL vs NoSQL” is a marketing split, not a mechanical one, so the columns are decomposed into the four dimensions that actually decide the answer: data model, storage engine, distribution, and how much can be atomic at once. Requirements filter first — cross-key atomicity, durability and point-lookup reads each disqualify stores outright, and no throughput number overrules a promise. Among survivors, each store is judged on the load that would reach it in the system built around it, and the lowest worst-case utilization wins."
              /* A caption that is true of the whole row belongs to the row.
                 Printing "misses only, behind its cache" in all six columns
                 spent a quarter of a 69px column repeating itself. */
              rowLabels={[
                'What you install',
                'Data model',
                'Storage engine',
                'Distribution',
                'Atomicity scope',
                'Disk per write',
                <>
                  Write stream
                  <span className="rl-note">
                    of {v.seqWrite} GiB/s
                    {m.logNeed && ' · sustained, behind the log'}
                    {m.blobNeed && ' · pointer rows only'}
                  </span>
                </>,
                <>
                  Read pressure
                  <span className="rl-note">
                    one node{m.cacheAbsorbs ? ' · misses only, behind the cache' : ' · no cache in front'}
                  </span>
                </>,
                <>
                  Dataset in RAM<span className="rl-note">at {v.ram} GB per node</span>
                </>,
              ]}
              cols={engCols}
              winner={m.engineWin}
              pinned={pinE}
              onPin={(id) => setPinE(id === m.engineWin ? null : id)}
              verdict={eVerdict}
              pickFor={effE.chooseFor}
              wild={effE.wild}
              sources={effE.sources}
              survivors={
                <>
                  <b>“The numbers pick” is not “the only one that works.”</b> It means lowest first wall.
                  Every column not marked <span className="vd-out-tag">out</span> is a system you could
                  actually run at this load — {alive.length === 1 ? 'here there is only one' : `here there are ${alive.length}`}.
                  Click any of them to pin it, and the rest of this page re-derives around your choice.
                </>
              }
            />

            {pinnedAlt && (
              <div className="pindiff">
                <div className="pd-h">
                  <b>You pinned {effE.label}; the arithmetic picked {winE.label}.</b>{' '}
                  {effCol.worst <= winCol.worst * 1.05
                    ? 'On capacity these are the same machine — the difference is entirely in what you operate and what you can promise.'
                    : effCol.worst > 1
                      ? `${effE.short} draws ×${fmt.sig(effCol.worst / Math.max(winCol.worst, 1e-9))} what ${winE.short} does on the wall that binds it, and it is past that wall — so this pick costs you roughly ×${fmt.sig(effCol.worst / Math.max(winCol.worst, 1e-9))} the nodes for the same load.`
                      : `${effE.short} draws ×${fmt.sig(effCol.worst / Math.max(winCol.worst, 1e-9))} what ${winE.short} does on the wall that binds it. Both still fit inside one node, so this buys no extra machines today — it spends headroom you would otherwise have kept.`}
                </div>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>What differs</th>
                      <th>{winE.short} — the numbers’ pick</th>
                      <th>{effE.short} — your pick</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Its first wall</td>
                      <td>{winCol.worstName} at {pc(winCol.worst)}</td>
                      <td>{effCol.worstName} at {pc(effCol.worst)}</td>
                    </tr>
                    <tr>
                      <td>What can be atomic</td>
                      <td>{winE.txnScope}</td>
                      <td>{effE.txnScope}</td>
                    </tr>
                    <tr>
                      <td>Who splits the data</td>
                      <td className="how">{winE.scale}</td>
                      <td className="how">{effE.scale}</td>
                    </tr>
                    <tr>
                      <td>What it forces below</td>
                      <td colSpan={2}>
                        {pinChanged.length === 0
                          ? 'nothing changes — the same components either way'
                          : pinChanged
                              .map((k) =>
                                k === 'crossShard'
                                  ? `${crossShard(effE, c) ? 'a plan for cross-shard transactions is now needed' : 'cross-shard transactions stop being a problem'}`
                                  : `${NEED_LABEL[k as NeedKey]} ${c.needs[k as NeedKey] ? 'is now forced' : 'is no longer forced'}`,
                              )
                              .join('; ')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {fresh === 'push' ? (
              <Decision
                title="How clients connect"
                info="Filtered by one requirement: whether data must appear on its own — if it must, request/response is disqualified no matter what it costs. Among survivors, each column is computed from the workload: held connections from the online share, egress from the two payload sizes plus that protocol's per-message overhead."
                rowLabels={['Server can push', 'Held connections', 'Protocol cost / message', 'Peak egress']}
                cols={tCols}
                winner={m.transportWin}
                pinned={pinT}
                onPin={(id) => setPinT(id === m.transportWin ? null : id)}
                verdict={tVerdict}
              />
            ) : (
              <div className="dc-quiet">
                <b>Transport is not a decision here.</b> Nothing has to appear on its own, so plain
                request/response wins by default — holding {fmt.compact(m.heldConns)} sockets open
                would cost {fmt.int(m.tCols[2].hosts)} host{m.tCols[2].hosts === 1 ? '' : 's'} of
                connection tier to deliver nothing the client could not ask for. Set{' '}
                <em>how users get new data</em> to “it must appear” and this becomes a real
                comparison.
              </div>
            )}
            <p className="sb-title">What the numbers force</p>
            {needed.length === 0 && (
              <div className="verdict v-good">
                <span className="vi">✓</span>
                <span>
                  <b>One machine still does this.</b> Nothing above crosses a ceiling. The useful
                  answer is to say so — and to name the number that would change it.
                </span>
              </div>
            )}
            {needed.map((r) => (
              <div className="rec" key={r.what}>
                <div className="rec-h">
                  <span className="rec-tag">add</span>
                  <b>{r.what}</b>
                  {pinChanged.includes(r.key) && <span className="rec-tag pinned">your pick added this</span>}
                </div>
                <div className="rec-n">{r.number}</div>
                {pinChanged.includes(r.key) && (
                  <div className="rec-trig">
                    {effE.short} would not have needed this if you had taken {shortOf(m.engineWin)} — reads cost ×
                    {storeConstants(effE, access).readAmp} here against ×{storeConstants(winE, access).readAmp} there,
                    and that is what crosses the threshold.
                  </div>
                )}
                <p className="rec-b">{r.because}</p>
                <div className="rec-l">
                  {r.to.map((l) => (
                    <Link key={l.href} to={l.href}>
                      {l.label} →
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            {after.length > 0 && (
              <>
                <p className="sb-title">The load, after the additions</p>
                <table className="tbl">
                  <tbody>
                    {after.map((r) => (
                      <tr key={r.k}>
                        <td>{r.k}</td>
                        <td>{r.v}</td>
                        <td className="how">{r.how}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {notYet.length > 0 && (
              <>
                <p className="sb-title">Not yet — and what would change that</p>
                {notYet.map((r) => (
                  <div className="rec rec-off" key={r.what}>
                    <div className="rec-h">
                      <span className="rec-tag off">not yet</span>
                      <b>{r.what}</b>
                      {pinChanged.includes(r.key) && <span className="rec-tag pinned">your pick removed this</span>}
                    </div>
                    <div className="rec-n">{r.number}</div>
                    <div className="rec-trig">
                      {pinChanged.includes(r.key)
                        ? `${shortOf(m.engineWin)} would have needed this — its reads cost ×${storeConstants(winE, access).readAmp} against ×${storeConstants(effE, access).readAmp} for the store you pinned.`
                        : r.trigger}
                    </div>
                  </div>
                ))}
              </>
            )}

            <p className="sb-title">The stores you end up with</p>
            <div className="stores-out">
              {[
                { k: effE.label, why: `the system of record — ${effE.model} model, ${effE.engine} engine, ${effE.dist}`, on: true },
                { k: 'A cache', why: `${v.cacheHit}% of reads answered from memory${m.cacheOnWritePath ? ', invalidated on every write because reads must be current' : ''}`, on: c.needs.cache },
                { k: 'A durable log', why: c.needs.log && c.needs.logConsumers ? 'absorbs the write peak AND feeds every derived copy in one order' : c.needs.log ? 'absorbs the write peak so the primary consumes at its own pace' : 'one ordered stream every derived copy replays', on: c.needs.log || c.needs.logConsumers },
                { k: 'A columnar store', why: 'aggregates across everything, fed by change-data-capture', on: c.needs.analytical },
                { k: 'Object storage + CDN', why: c.needs.blob ? 'the bytes themselves; the database keeps a pointer' : 'serves the egress your origin cannot', on: c.needs.blob || c.needs.cdn },
              ].filter((x) => x.on).map((x) => (
                <div className="store-row" key={x.k}>
                  <b>{x.k}</b>
                  <span>{x.why}</span>
                </div>
              ))}
            </div>
            <p className="tbl-note">
              One database was never the answer — a real system ends up with a store per access
              pattern, and the honest question is how many you are willing to operate. Every one of
              these is a thing to run, monitor, back up and page someone about.
            </p>

            <div className="dc-quiet">
              <b>Every component above is also a hop.</b> A log absorbs the write peak <em>and</em> adds
              latency to every write. A cache cuts database load <em>and</em> leaves your p99 exactly
              where it was until the hit rate passes 99%. Sharding cuts per-node load <em>and</em> turns
              one lookup into a scatter-gather whose p99 is the slowest shard. This page sizes the load;
              the other one prices the time, and they disagree on purpose.{' '}
              <Link to="/calculator/latency">Latency budget →</Link>
            </div>

            {/* The sensitivity sweep. A point estimate built on fifteen constants
                says nothing about which of the fifteen you have to get right. */}
            <p className="sb-title">Which assumption is load-bearing</p>
            <p className="tbl-note">
              Every constant above was moved <b>one rung on its own ladder</b> — roughly a factor of
              two, each way — and the whole page re-run. Listed below are only the moves that change
              an <em>answer</em>; the ones that merely change a number are not interesting.
            </p>
            {sens.length === 0 ? (
              <div className="verdict v-good">
                <span className="vi">✓</span>
                <span>
                  <b>Nothing here turns on a single constant.</b> No assumption, nudged either way,
                  changes the store, the component list or the shard count. That is the strongest
                  thing this page can say about its own output.
                </span>
              </div>
            ) : (
              <div className="sens">
                {sens.map((f) => (
                  <div className="sens-row" key={f.id + f.dir}>
                    <div className="sens-k">
                      {f.label}{' '}
                      <span className={f.src === 'napkin' ? 'src-n' : 'src-a'}>
                        {f.src === 'napkin' ? 'measured' : 'assumed'}
                      </span>
                    </div>
                    <div className="sens-m">
                      {f.from} → {f.to}
                    </div>
                    <div className="sens-v">{f.changes.join(' · ')}</div>
                  </div>
                ))}
              </div>
            )}
            <p className="tbl-note">
              A conclusion that survives every rung is worth acting on. One that flips on a constant
              marked <span className="src-a">assumed</span> — a number nobody measured on your
              system — is a coin toss wearing a table, and the fix is not more arithmetic. It is to
              go and measure that one number.
            </p>

            <p className="sb-title">Runway</p>
            <div className="tiles">
              <div className="tile">
                <div className="k">Writes at peak</div>
                <div className="v">{fmt.compact(m.peakWrites)}/s</div>
                <div className="u">{fmt.n1(m.writeUtil * 100)}% of ceiling</div>
              </div>
              <div className="tile">
                <div className="k">Write ceiling</div>
                <div className="v">{fmt.compact(m.writeCeiling)}/s</div>
                <div className="u">{v.group} ÷ {v.fsync} µs</div>
              </div>
              <div className="tile">
                <div className="k">Time to that wall</div>
                <div className="v">{c.monthsToWall === 0 ? 'now' : isFinite(c.monthsToWall) ? Math.round(c.monthsToWall) + ' mo' : '∞'}</div>
                <div className="u">at {v.growth}%/mo, unmitigated</div>
              </div>
              <div className="tile">
                <div className="k">Users in 12 mo</div>
                <div className="v">{fmt.compact(v.dau * Math.pow(1 + g, 12))}</div>
                <div className="u">×{fmt.n1(Math.pow(1 + g, 12))}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <details className="calc-help">
        <summary>
          <span className="chev">▸</span> Checked against published measurements
        </summary>
        <div className="calc-help-b">
          <p>
            A model nobody has checked is just tidier folklore. The arithmetic on this page lives in
            a pure module covered by unit tests whose expected values were computed by hand — and by
            a second suite of <b>reality tests</b> that pin it, executably, against numbers published
            by the people who ran the real systems. These are the anchor points; an anchor validates
            the formula that runs through it, not the whole model.
          </p>
          <div className="dc-scroll">
          <table className="tbl tbl-anchor">
            <thead>
              <tr>
                <th>What this page computes</th>
                <th>What is published</th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  Bandwidth: 100k ops/s × 4 KB ={' '}
                  <b>{fmt.n1((100000 * 4096 * 8) / 1e9)} Gbps</b>
                </td>
                <td>
                  The Redis docs work the same example and state <b>3.2 Gbit/s</b>, noting it fits a
                  10 Gbit/s link but not a 1 Gbit/s one.
                </td>
                <td className="ok">matches</td>
              </tr>
              <tr>
                <td>
                  Cache ceiling: 1 ÷ {v.cacheOp} µs = <b>{fmt.compact(m.cacheCeiling)}/s</b> per core
                </td>
                <td>
                  <code>redis-benchmark</code> reports <b>72k/s</b> on random keys and{' '}
                  <b>180k/s</b> on a single key, without pipelining — and <b>1.5M/s</b> with
                  pipelining ×16.
                </td>
                <td className="ok">in range</td>
              </tr>
              <tr>
                <td>
                  Write ceiling: {v.group} ÷ {v.fsync} µs = <b>{fmt.compact(m.writeCeiling)}/s</b>
                </td>
                <td>
                  fsync is measured at <b>300 µs</b>. With no group commit that is only{' '}
                  <b>{fmt.compact(1 / (v.fsync / 1e6))}/s</b> — the batch size is doing the work
                  here, and it is an assumption, not a measurement.
                </td>
                <td className="warn">sensitive</td>
              </tr>
              <tr>
                <td>
                  Random reads: {v.ioDepth} ÷ {v.randRead} µs = <b>{fmt.compact(m.diskReadCeiling)}/s</b>
                </td>
                <td>
                  Modern NVMe drives are rated for several hundred thousand IOPS at high queue
                  depth, so this is deliberately conservative at queue depth {v.ioDepth}.
                </td>
                <td className="ok">conservative</td>
              </tr>
              <tr>
                <td>
                  Sequential vs random: {v.seqRead} GiB/s streaming vs ~
                  <b>{fmt.bytes((8192 / v.randRead) * 1e6)}/s</b> of random 8 KiB reads
                </td>
                <td>
                  napkin-math measures both directly: <b>8 GiB/s</b> sequential, <b>~70 MiB/s</b>{' '}
                  random — the ~100× gap that makes full scans and analytics a different problem.
                </td>
                <td className="ok">matches</td>
              </tr>
              <tr>
                <td>
                  Fan-out: 4.6k writes/s × 75 recipients = <b>345k deliveries/s</b>; the tool
                  answers with fan-out workers + a partitioned cache tier
                </td>
                <td>
                  Twitter’s published timeline numbers (2012, via DDIA Ch 1): 4.6k tweets/s becomes{' '}
                  <b>345k</b> home-timeline cache writes/s — served by async fan-out workers and
                  Redis clusters, with fan-out-on-read for celebrity accounts.
                </td>
                <td className="ok">matches</td>
              </tr>
              <tr>
                <td>
                  Connections per host: <b>100k</b> default, ladder up to 2M
                </td>
                <td>
                  WhatsApp held <b>2M+</b> live connections on one heroically tuned FreeBSD box
                  (2012). The ladder reaches the record; the default stays 20× under it.
                </td>
                <td className="ok">conservative</td>
              </tr>
              <tr>
                <td>
                  Write ceiling band: <b>3.3k–26.7k/s</b> per node (group commit ×1–×8)
                </td>
                <td>
                  Netflix measured <b>1.1M writes/s on 288 Cassandra nodes</b> — ~11.5k applied
                  writes/s per node at replication factor 3, inside the band.
                </td>
                <td className="ok">in range</td>
              </tr>
              <tr>
                <td>
                  The chain: misses = reads × (1 − hit rate), so 99% → 98% <b>doubles</b> database
                  load
                </td>
                <td>
                  Facebook’s memcache paper (NSDI 2013) reports <b>~99%</b> hit rate and states
                  that “a 1% decrease in hit rate doubles database load” — the same arithmetic,
                  from the largest cache fleet ever measured.
                </td>
                <td className="ok">matches</td>
              </tr>
              <tr>
                <td>
                  Chat, read as ranges inside a channel partition: this page picks the wide-column
                  ring
                </td>
                <td>
                  Discord does exactly that (Cassandra, then ScyllaDB, 177 → 72 nodes). <b>Slack
                  does the opposite</b> — MySQL behind Vitess, sharded by channel id,{' '}
                  <b>2.3M QPS</b> at 2 ms median. Same shape, opposite answer.
                </td>
                <td className="warn">both are right</td>
              </tr>
              <tr>
                <td>
                  Shard count = rows ÷ data per node, a dial rather than a constant
                </td>
                <td>
                  Published trigger points span two orders of magnitude: Vitess documents{' '}
                  <b>250 GB</b> per shard as the sweet spot, Cash App splits at about <b>1 TB</b>,
                  Notion bounded a physical database at <b>10 TB</b>. Automatic splitters go far
                  smaller — CockroachDB ranges are 512 MiB, ScyllaDB tablets 5 GB.
                </td>
                <td className="warn">yours to set</td>
              </tr>
              <tr>
                <td>
                  What a reshard costs — stated on the page, deliberately not scored
                </td>
                <td>
                  The range is enormous. Google&apos;s manually-sharded AdWords MySQL:{' '}
                  <b>“over two years of intense effort… across dozens of teams”</b>, after which
                  they capped growth rather than repeat it. DynamoDB: splits complete{' '}
                  <b>“in the order of minutes”</b>. Automatic is not free either — a Cassandra node
                  was measured taking <b>106 hours</b> to stream 2.2 TB, plus three weeks of
                  compaction.
                </td>
                <td className="warn">not modelled</td>
              </tr>
              <tr>
                <td>
                  Per-shard write load stays flat as the cluster grows
                </td>
                <td>
                  Netflix measured 48 → 288 Cassandra nodes carrying 174k → <b>1.1M</b> writes/s,
                  with per-node throughput flat at <b>10.9k–11.9k</b> across the whole range.
                </td>
                <td className="ok">matches</td>
              </tr>
              <tr>
                <td>
                  The LSM column’s pitch: partitioning built in, write-optimized, read amp as the
                  price
                </td>
                <td>
                  Discord stores <b>trillions</b> of messages on LSM stores (Cassandra, 177 nodes →
                  ScyllaDB, 72). At that scale, ring-managed partitioning dominates — an operational
                  factor this page prices only through its scale notes, which is what pinning a
                  column is for.
                </td>
                <td className="ok">corroborates</td>
              </tr>
            </tbody>
          </table>
          </div>
          <p className="calc-src">
            Sources:{' '}
            <a href="https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/benchmarks/" target="_blank" rel="noreferrer">
              redis.io benchmarks
            </a>{' '}
            ·{' '}
            <a href="https://github.com/sirupsen/napkin-math" target="_blank" rel="noreferrer">
              sirupsen/napkin-math
            </a>{' '}
            (MIT) ·{' '}
            <a href="https://timilearning.com/posts/ddia/part-one/chapter-1/" target="_blank" rel="noreferrer">
              DDIA Ch 1 (Twitter, 2012)
            </a>{' '}
            ·{' '}
            <a href="https://blog.whatsapp.com/1-million-is-so-2011" target="_blank" rel="noreferrer">
              WhatsApp engineering
            </a>{' '}
            ·{' '}
            <a href="https://netflixtechblog.com/benchmarking-cassandra-scalability-on-aws-over-a-million-writes-per-second-39f45f066c9e" target="_blank" rel="noreferrer">
              Netflix Tech Blog
            </a>{' '}
            ·{' '}
            <a href="https://pdos.lcs.mit.edu/6.824/notes/l-memcached.txt" target="_blank" rel="noreferrer">
              Scaling Memcache at Facebook
            </a>{' '}
            ·{' '}
            <a href="https://discord.com/blog/how-discord-stores-trillions-of-messages" target="_blank" rel="noreferrer">
              Discord
            </a>{' '}
            ·{' '}
            <a href="https://slack.engineering/scaling-datastores-at-slack-with-vitess/" target="_blank" rel="noreferrer">
              Slack / Vitess
            </a>{' '}
            ·{' '}
            <a href="https://www.uber.com/en-IN/blog/how-uber-serves-over-40-million-reads-per-second-using-an-integrated-cache/" target="_blank" rel="noreferrer">
              Uber CacheFront
            </a>{' '}
            ·{' '}
            <a href="https://static.googleusercontent.com/media/research.google.com/en//archive/spanner-osdi2012.pdf" target="_blank" rel="noreferrer">
              Spanner (OSDI 2012)
            </a>{' '}
            ·{' '}
            <a href="https://www.usenix.org/system/files/atc22-elhemali.pdf" target="_blank" rel="noreferrer">
              DynamoDB (ATC 2022)
            </a>{' '}
            ·{' '}
            <a href="https://www.notion.com/blog/sharding-postgres-at-notion" target="_blank" rel="noreferrer">
              Notion
            </a>{' '}
            ·{' '}
            <a href="https://developer.squareup.com/blog/shard-splits-with-consistent-snapshots/" target="_blank" rel="noreferrer">
              Cash App
            </a>
            . The honest gaps: the write ceiling swings by ~8× depending on group commit, and the
            two hit rates in the chain are assumptions with no universal value — both are worth
            replacing with measurements from your own system before believing the after-table.
          </p>
        </div>
      </details>

      <div className="note">
        <b>Where these numbers come from.</b> The hardware constants are measured, not folklore —{' '}
        <a href="https://github.com/sirupsen/napkin-math" target="_blank" rel="noreferrer">
          sirupsen/napkin-math
        </a>{' '}
        (MIT), last measured March 2026 on a 24-core Xeon with local SSD. The rest is arithmetic:
        requirements disqualify, Little’s Law sizes the app tier, every ceiling divides a constant
        by the work one operation costs, and every decision picks the surviving column whose worst
        utilization is lowest. What is <em>not</em> measured are the modelling choices marked{' '}
        <span className="src-a">assumed</span> — group commit size, write amplification, the two
        hit rates. Those depend on your rows, indexes and access pattern, so treat the output as an
        order-of-magnitude starting point and then measure your own system. A calculator is for
        knowing which wall you are walking towards, not for sizing a purchase order.
      </div>
    </section>
  )
}
