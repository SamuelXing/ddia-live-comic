import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { fmt } from './format'
import {
  WORKLOAD, DERIVED_INP, HW, FRESH, TXN, LOSS, ANALYTICS, PROTOCOLS, ENGINES, PRESETS, INIT,
  model, consequences, type Inp, type Opt, type Req, type Vals,
} from './calcModel'

/* ============================================================
   Capacity planning from first principles.

   The arithmetic lives in calcModel.ts (pure, unit-tested — see
   calcModel.test.ts, `npm test`); this file is presentation: the
   sliders, the decision tables, the verdict prose. The thesis:
   REQUIREMENTS FILTER, LOAD RANKS, CEILINGS FORCE — and every
   forced addition transforms the load each later tier sees.
   ============================================================ */

function Picker({ options, value, onPick }: { options: Opt[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="picker">
      {options.map((o) => (
        <button key={o.id} className={'pick' + (o.id === value ? ' on' : '')} onClick={() => onPick(o.id)} title={o.info}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Info({ text }: { text?: string }) {
  if (!text) return null
  return (
    <span className="info" tabIndex={0} role="note" aria-label={text}>
      i<span className="info-tip">{text}</span>
    </span>
  )
}

function Slider({ inp, value, set }: { inp: Inp; value: number; set: (n: number) => void }) {
  let i = inp.steps.indexOf(value)
  if (i < 0) i = inp.steps.reduce((best, s, k) => (Math.abs(s - value) < Math.abs(inp.steps[best] - value) ? k : best), 0)
  return (
    <input
      type="range"
      min={0}
      max={inp.steps.length - 1}
      step={1}
      value={i}
      onChange={(e) => set(inp.steps[parseInt(e.target.value)])}
    />
  )
}

function Ctl({ label, info, hint, children, val }: { label: string; info?: string; hint: string; children: ReactNode; val?: string }) {
  return (
    <div className="ctl">
      <div className="ctl-top">
        <span className="ctl-label">
          {label}
          <Info text={info} />
        </span>
        {val && <span className="ctl-val">{val}</span>}
      </div>
      {children}
      <div className="ctl-hint">{hint}</div>
    </div>
  )
}

/** one decision, laid out as a computed comparison — losing columns stay
 *  visible, disqualified columns say which requirement removed them */
function Decision({
  title, info, rowLabels, cols, winner, pinned, onPin, verdict,
}: {
  title: string
  info: string
  rowLabels: string[]
  cols: { id: string; label: string; cells: ReactNode[]; dq?: string | null }[]
  winner: string
  pinned: string | null
  onPin: (id: string) => void
  verdict: ReactNode
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
                  <button onClick={() => onPin(c.id)} title={c.id === eff ? undefined : c.dq ? c.dq : 'Pin this choice — everything downstream follows'}>
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
              <tr key={rl}>
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
  const [pinT, setPinT] = useState<string | null>(null)
  const [pinE, setPinE] = useState<string | null>(null)
  const [preset, setPreset] = useState<string | null>(null)
  const req: Req = { fresh, txn, loss, analytics }

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
    setPinT(null)
    setPinE(null)
    setPreset(null)
  }
  const atDefaults =
    Object.keys(INIT).every((k) => v[k] === INIT[k]) &&
    fresh === 'pull' && txn === 'single' && loss === 'keep' && analytics === 'no' && pinT === null && pinE === null

  // ---------- all arithmetic: the pure, unit-tested model ----------
  const m = model(v, req)
  const effT = PROTOCOLS.find((p) => p.id === (pinT ?? m.transportWin))!
  const effE = ENGINES.find((e) => e.id === (pinE ?? m.engineWin))!
  const c = consequences(v, req, m, effT.holds)

  /** the chosen shape writes its constants into the visible panel below */
  useEffect(() => {
    setV((s) => ({ ...s, ...effT.sets, ...effE.sets }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effT.id, effE.id])

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
    const e = ENGINES.find((x) => x.id === col.id)!
    const bwNotes = [m.logNeed ? 'sustained, behind the log' : '', m.blobNeed ? 'pointer rows — blobs in object storage' : '']
      .filter(Boolean)
      .join('; ')
    return {
      id: col.id,
      label: e.label,
      dq: col.dq,
      cells: [
        e.perWrite,
        col.id === 'mem' ? '—' : `${fmt.bytes(col.bw)}/s · ${pc(col.bwU)} of ${v.seqWrite} GiB/s${bwNotes ? ' — ' + bwNotes : ''}`,
        col.id === 'mem' ? `${pc(col.worst)} of one core` : `${pc(col.rU)}${col.colCache ? ' — misses only, behind its cache' : ''}`,
        col.id === 'mem' ? `${fmt.int(m.ramHosts)} host${m.ramHosts === 1 ? '' : 's'} × ${v.ram} GB` : '—',
        e.giveUp,
      ] as ReactNode[],
    }
  })
  const [bt, ls] = m.eCols
  const alive = m.eCols.filter((x) => !x.dq)
  const shortOf = (id: string) => ENGINES.find((e) => e.id === id)!.short
  const outSentences = m.eCols.filter((x) => x.dq).map((x) => `${shortOf(x.id)} is out — ${x.dq}`)
  const mitigations = [
    m.eCols.some((x) => !x.dq && x.colCache) ? `the cache absorbs ${v.cacheHit}% of its reads` : '',
    m.logNeed ? `the log absorbs the ×${fmt.n1(v.peak)} peak` : '',
    m.blobNeed ? 'blobs live in object storage, so rows are pointers' : '',
  ].filter(Boolean)
  let cmp: string
  if (alive.length === 1) {
    cmp = `Only ${shortOf(alive[0].id)} satisfies the requirements; the comparison is moot until a requirement changes.`
  } else {
    const list = alive.map((x) => `${shortOf(x.id)} ${pc(x.worst)} (${x.worstName})`).join(' · ')
    cmp = `Each engine is judged on what reaches it${mitigations.length ? ` — ${mitigations.join(', ')}` : ''}. Worst remaining ceiling: ${list}. The lowest wins; ties go to the simpler machine.`
    if (m.engineWin === 'lsm') cmp += ' Appending in sorted batches is what holds the LSM lower — it repays the difference later as background compaction, off the commit path.'
    if (!bt.dq && !ls.dq && bt.worst > 1 && ls.worst > 1) cmp += ' Both disk engines are over one node either way, so this data gets partitioned regardless — the lower worst just means fewer shards.'
  }
  const eVerdict = [...outSentences, cmp].join('. ')

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

  const ceilings: { k: string; v: string; how: string }[] = [
    { k: 'Durable writes, one primary', v: `${fmt.compact(m.writeCeiling)}/s`, how: `${v.group} commits per fsync ÷ ${v.fsync} µs` },
    { k: 'Random reads, one node', v: `${fmt.compact(m.diskReadCeiling)}/s`, how: `${v.ioDepth} concurrent ÷ ${v.randRead} µs` },
    { k: 'Cache ops, one core', v: `${fmt.compact(m.cacheCeiling)}/s`, how: `1 ÷ ${v.cacheOp} µs per op` },
    { k: 'Full scan of the dataset', v: dur(m.scanSeconds), how: `${fmt.bytes(m.dbStorage)} of rows ÷ ${v.seqRead} GiB/s sequential` },
    { k: 'Data one node should hold', v: `${v.diskPerNode} TB`, how: 'backup + replica-rebuild time, not IOPS' },
    { k: 'Egress, one host', v: `${v.nic} Gbps`, how: 'NIC capacity' },
    { k: 'Connections, one host', v: fmt.compact(v.connsPerHost), how: 'memory + file descriptors + heartbeat CPU' },
  ]

  interface Rec { need: boolean; what: string; number: string; because: string; to: { label: string; href: string }[] }
  const recs: Rec[] = [
    {
      need: c.needs.connTier,
      what: 'A separate connection tier',
      number: `${fmt.compact(c.connections)} live connections ÷ ${fmt.compact(v.connsPerHost)} per host = ${c.connHosts} hosts, before any request work`,
      because:
        'connections are held, not served — a mostly idle socket still costs memory, a file descriptor and a heartbeat. This tier is sized by concurrency, not by request rate, so it scales separately from everything else and is usually stateless in front of a message bus',
      to: [
        { label: 'Web / app tier', href: '/components/web' },
        { label: 'Idea: the trouble with distributed systems', href: '/read/distributed-troubles' },
      ],
    },
    {
      need: c.needs.fanout,
      what: 'Fan-out on read, or a fan-out worker pool',
      number: `${fmt.compact(m.peakWrites)} writes/s × ${v.fanout} = ${fmt.compact(m.deliveries)} deliveries/s`,
      because:
        'writing once is cheap; delivering it to every recipient is what costs. Past a certain fan-out you stop pushing copies at write time and let readers pull instead — or you accept the write amplification and do it asynchronously in workers',
      to: [
        { label: 'Idea: leader & followers', href: '/read/replication-leader' },
        { label: 'Kafka deep-dive', href: '/components/kafka' },
      ],
    },
    {
      need: c.needs.cdn,
      what: 'A CDN in front of the origin',
      number: `${fmt.n1(c.egressGbps)} Gbps ÷ ${v.nic} Gbps per host = ${c.originHosts} hosts of pure bandwidth — after ${v.cdnHit}% offload, ${fmt.n1(c.originAfter)} Gbps and ${c.originHostsAfter} host${c.originHostsAfter === 1 ? '' : 's'}`,
      because: 'serving these bytes from your own origin costs hosts and egress; a CDN moves the copy next to the user and the bill off your origin. What it cannot absorb — personalized, private — still needs origin NICs',
      to: [{ label: 'S3 / object storage', href: '/components/s3' }],
    },
    {
      need: c.needs.blob,
      what: 'Blobs out of the database',
      number: `${fmt.bytes(m.bytesW)} written per object — a database page is 8 KB, so one object spans ~${fmt.int(m.bytesW / 8192)} pages`,
      because:
        'a row store is built for KB-scale rows: replication, backups and vacuuming all re-carry every byte you put in it. Store a pointer in the row and the bytes in object storage, and let the CDN serve them from there',
      to: [{ label: 'S3 / object storage', href: '/components/s3' }],
    },
    {
      need: c.needs.cache,
      what: 'A cache in front of the database',
      number: `${fmt.compact(m.readSide)}/s of read+delivery work is ${fmt.n1(c.readUtil * 100)}% of one node’s ${fmt.compact(m.diskReadCeiling)}/s random-read ceiling — at ${v.cacheHit}% hits, ${fmt.compact(c.missReads)}/s survives to disk`,
      because: `a disk read costs ${v.randRead} µs; the same read from memory costs ~20 ns. Caching is not only about throughput — it is a 1000× latency difference`,
      to: [
        { label: 'Redis deep-dive', href: '/components/redis' },
        { label: 'Idea: replication lag', href: '/read/replication-lag' },
      ],
    },
    {
      need: c.needs.cacheNodes,
      what: 'More than one cache node',
      number: `${fmt.compact(m.readSide)}/s delivery side ÷ ${fmt.compact(m.cacheCeiling)}/s per core = ${c.cacheNodes} node${c.cacheNodes === 1 ? '' : 's'}`,
      because: 'a cache server is effectively single-threaded per shard, so past one core’s worth of operations you are partitioning, not scaling up',
      to: [
        { label: 'Redis deep-dive', href: '/components/redis' },
        { label: 'Idea: consistent hashing', href: '/read/partitioning' },
      ],
    },
    {
      need: c.needs.log,
      what: 'A log in front of the writes',
      number: `peaks reach ${fmt.n1(m.writeUtil * 100)}% of the write ceiling, ×${fmt.n1(v.peak)} above average — behind the log the primary consumes ${fmt.compact(m.dbWrites)}/s sustained`,
      because: 'a durable log absorbs the spike at sequential-write speed and lets the database consume at its own pace, instead of sizing the database for the worst minute of the day',
      to: [{ label: 'Kafka deep-dive', href: '/components/kafka' }],
    },
    {
      need: c.needs.shard,
      what: 'Shard the database',
      number:
        c.shardBy === 'storage'
          ? `${fmt.bytes(m.dbStorage)} of rows ÷ ${v.diskPerNode} TB per node = ${m.storageShards} shards — the write rate alone (${fmt.n1(c.writeUtilAfter * 100)}% of one primary) would never have forced this`
          : c.shardBy === 'writes'
            ? `${fmt.compact(m.dbWrites)} writes/s${m.logNeed ? ' sustained, behind the log,' : ''} vs a ${fmt.compact(m.writeCeiling)}/s ceiling (${fmt.n1(c.writeUtilAfter * 100)}% of one primary)`
            : `two independent reasons: ${fmt.compact(m.dbWrites)} writes/s needs ${c.writeShards} shards, ${fmt.bytes(m.dbStorage)} of rows needs ${m.storageShards} — the larger wins`,
      because: `replicas do not help: every replica holds every byte and replays every write. ${c.shardBy === 'storage' ? 'Past some tens of TB, backups and replica rebuilds take longer than anyone can tolerate — data size splits the store even when the write rate never would.' : 'Past one primary the only move left is to split the data.'} ${effE.scale}`,
      to: [
        { label: 'Idea: consistent hashing', href: '/read/partitioning' },
        { label: 'Postgres deep-dive', href: '/components/postgres' },
      ],
    },
    {
      need: c.needs.logConsumers,
      what: 'One log, many consumers',
      number: `${fmt.int(v.derived)} derived systems × ${fmt.compact(m.peakWrites)} writes/s — every change applied in ${fmt.int(v.derived + 1)} places`,
      because:
        'if the app writes to each system directly, two of them will eventually apply “the same” changes in different orders and drift apart forever. Write once to a durable log and let every consumer — search, analytics, cache invalidation — replay the same order at its own pace',
      to: [
        { label: 'Kafka deep-dive', href: '/components/kafka' },
        { label: 'Idea: leader & followers', href: '/read/replication-leader' },
      ],
    },
    {
      need: c.needs.analytical,
      what: 'A separate analytical store',
      number: `a full scan of ${fmt.bytes(m.dbStorage)} of rows at ${v.seqRead} GiB/s sequential = ${dur(m.scanSeconds)} — on the same disk your 5 ms lookups live on`,
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
    <section>
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

          <h4>What it will not tell you</h4>
          <p>
            It sizes <em>throughput and capacity</em>, not correctness, cost, or tail latency. It
            assumes an even spread — one hot key or one celebrity row breaks every average on this
            page. And the constants marked <span className="src-a">assumed</span> depend on your
            rows, indexes and access pattern. Treat the output as the order of magnitude you are
            dealing with, then measure the real thing.
          </p>
        </div>
      </details>

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
            <Ctl label="How users get new data" info={FRESH.find((o) => o.id === fresh)!.info} hint={FRESH.find((o) => o.id === fresh)!.info.split('.')[0] + '.'}>
              <Picker options={FRESH} value={fresh} onPick={pickReq(setFresh)} />
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

            <p className="sb-title">The ceilings these run into</p>
            <table className="tbl">
              <tbody>
                {ceilings.map((r) => (
                  <tr key={r.k}>
                    <td>{r.k}</td>
                    <td>{r.v}</td>
                    <td className="how">{r.how}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="sb-title">The choices the numbers make</p>
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
            <Decision
              title="Where writes land"
              info="Requirements filter first: cross-key atomicity disqualifies engines that cannot span partitions, and must-survive data disqualifies optional durability — no throughput number overrules that. Among survivors, each engine is judged on the load that would reach it in the system built around it: if its read pressure forces a cache, its reads become the misses; if the peak forces a log, its writes become the sustained rate; if blobs move to object storage, its rows become pointers. Lowest worst-case utilization wins."
              rowLabels={['Disk per logical write', 'Write stream reaching disk', 'Read pressure, one node', 'Whole dataset in RAM', 'You give up']}
              cols={engCols}
              winner={m.engineWin}
              pinned={pinE}
              onPin={(id) => setPinE(id === m.engineWin ? null : id)}
              verdict={eVerdict}
            />

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
                </div>
                <div className="rec-n">{r.number}</div>
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
                <p className="sb-title">Not yet — and the number to watch</p>
                {notYet.map((r) => (
                  <div className="rec rec-off" key={r.what}>
                    <div className="rec-h">
                      <span className="rec-tag off">not yet</span>
                      <b>{r.what}</b>
                    </div>
                    <div className="rec-n">{r.number}</div>
                  </div>
                ))}
              </>
            )}

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
          <table className="tbl">
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
            <a href="https://www.scylladb.com/tech-talk/how-discord-migrated-trillions-of-messages-from-cassandra-to-scylladb/" target="_blank" rel="noreferrer">
              Discord / ScyllaDB
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
