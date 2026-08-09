import { useState } from 'react'
import { fmt } from '../format'
import { LAD, LadderSlider } from '../ladder'

/* ============================================================
   Hardware envelope widget: pick a broker-node shape + workload,
   see which resource binds first on one RabbitMQ node.
   Model (R msg/s, S msg bytes, Q queues, p durable fraction,
   B backlog msgs):
     hottest queue = R/Q vs one-core queue ceiling, which durability
                     discounts: ceil ≈ 45k × (1 − 0.6p)
     CPU cores     = R × (25 µs + p·30 µs)   (routing, queue, store)
     RAM           = B × (S + 200 B) vs 40% watermark
     disk write    = R·p·S × 2               (store + Raft log)
     NIC           = R·S × (2 + 1.33p)       (in + out + replication)
   ============================================================ */

interface Shape {
  name: string
  cores: number
  ramGB: number
  nicGbps: number
  diskMBs: number
  note: string
}

const SHAPES: Shape[] = [
  { name: 'Dev box', cores: 2, ramGB: 4, nicGbps: 1, diskMBs: 450, note: '2 vCPU · 4 GB · 1 GbE · SATA SSD' },
  { name: 'Standard node', cores: 4, ramGB: 16, nicGbps: 10, diskMBs: 1000, note: '4 vCPU · 16 GB · 10 GbE · NVMe' },
  { name: 'Big node', cores: 8, ramGB: 32, nicGbps: 10, diskMBs: 2000, note: '8 vCPU · 32 GB · 10 GbE · NVMe' },
  { name: 'Beefy node', cores: 16, ramGB: 64, nicGbps: 25, diskMBs: 3000, note: '16 vCPU · 64 GB · 25 GbE · NVMe' },
]

const QUEUE_CEIL = 45000 // one transient queue's rough msg/s ceiling
const BASE_US = 25 // per-message broker CPU (route + queue + deliver)
const DURABLE_US = 30 // extra per persistent/quorum message
const MSG_OVERHEAD = 200 // broker bookkeeping bytes per backlogged msg
const WATERMARK = 0.4 // vm_memory_high_watermark default

export default function HardwareEnvelope() {
  const [shapeIdx, setShapeIdx] = useState(1)
  const [rate, setRate] = useState(1e4)
  const [msgB, setMsgB] = useState(2048)
  const [queues, setQueues] = useState(10)
  const [durablePct, setDurablePct] = useState(50)
  const [backlog, setBacklog] = useState(50000)

  const sh = SHAPES[shapeIdx]
  const nicMBs = sh.nicGbps * 125
  const p = durablePct / 100

  const perQueue = rate / queues
  const effCeil = QUEUE_CEIL * (1 - 0.6 * p)
  const coreUsed = (rate * (BASE_US + p * DURABLE_US)) / 1e6
  const watermarkGB = sh.ramGB * WATERMARK
  const backlogGB = (backlog * (msgB + MSG_OVERHEAD)) / 1e9
  const diskWr = (rate * p * msgB * 2) / 1e6
  const netUse = (rate * msgB * (2 + 1.33 * p)) / 1e6

  const rows = [
    { label: 'Hottest queue vs one core', used: perQueue, cap: effCeil, unit: 'msg/s', why: `R ÷ ${queues} queues vs ~${fmt.compact(effCeil)}/s per queue at ${durablePct}% durable — the ceiling consumers can't raise` },
    { label: 'CPU (all queues)', used: coreUsed, cap: sh.cores, unit: 'cores', why: `R × (${BASE_US} µs + ${DURABLE_US} µs·durable) — unlike Redis, queues DO parallelize across cores` },
    { label: 'RAM vs watermark', used: backlogGB, cap: watermarkGB, unit: 'GB', why: `backlog × (msg + ${MSG_OVERHEAD} B bookkeeping) vs the ${Math.round(WATERMARK * 100)}%-of-RAM alarm line — cross it and every publisher blocks` },
    { label: 'Disk write', used: diskWr, cap: sh.diskMBs, unit: 'MB/s', why: 'durable messages × 2 (message store + quorum Raft log)' },
    { label: 'NIC', used: netUse, cap: nicMBs, unit: 'MB/s', why: 'in + out + quorum replication to followers' },
  ]
  const worst = rows.reduce((a, b) => (b.used / b.cap > a.used / a.cap ? b : a), rows[0])
  const worstPct = (worst.used / worst.cap) * 100

  const verdict =
    worstPct >= 100
      ? {
          s: 'crit',
          t: `<b>${worst.label} is over capacity</b> (${Math.round(worstPct)}%). ${
            worst.label === 'Hottest queue vs one core'
              ? 'One queue is past its single-process ceiling — and more consumers can’t help; the queue itself is the bottleneck. Shard into more queues (consistent-hash exchange) so the load spreads across cores and nodes.'
              : worst.label === 'RAM vs watermark'
                ? 'The backlog is heading for the memory alarm — the cluster-wide publish freeze. Drain it, shed it, or bulkhead it (max-length + TTL); do not simply raise the watermark and wait.'
                : worst.label === 'CPU (all queues)'
                  ? 'Aggregate message work exceeds the node. Good news: this is the scalable direction — add nodes and spread queue leaders across them.'
                  : worst.label === 'Disk write'
                    ? 'Durable message volume is outrunning the disk — confirm latency is climbing with it. Faster NVMe, batched publishes, or honestly reconsider which messages need durability.'
                    : 'Message bytes are saturating the wire. Slim payloads (store blobs in S3, send references) before buying NICs.'
          }`
        }
      : worstPct >= 75
        ? {
            s: 'warn',
            t: `<b>${worst.label} is the binding resource</b> at ${Math.round(worstPct)}% — this is what you'll hit first as load grows. Note the envelope's shape: the per-queue ceiling and the watermark are architectural lines, not hardware ones — bigger boxes move them less than you'd hope.`
          }
        : {
            s: 'good',
            t: `<b>Comfortable.</b> Binding resource: ${worst.label} at ${Math.round(worstPct)}%. The number to respect: the memory alarm line on this node is <b>${fmt.n1(watermarkGB)} GB</b> — a backlog of ~${fmt.compact((watermarkGB * 1e9) / (msgB + MSG_OVERHEAD))} messages at this size, and then every publisher in the cluster freezes.`
          }

  return (
    <div className="hwv card" style={{ padding: 0 }}>
      <div className="sandbox">
        <div className="sb-controls">
          <p className="sb-title">Node shape & workload</p>
          <div className="ctl">
            <div className="ctl-top"><span className="ctl-label">Instance shape</span></div>
            <div className="hw-shapes">
              {SHAPES.map((s, i) => (
                <button key={s.name} className={'hw-shape' + (i === shapeIdx ? ' on' : '')} onClick={() => setShapeIdx(i)}>
                  <b>{s.name}</b>
                  <span>{s.note}</span>
                </button>
              ))}
            </div>
          </div>
          {[
            { label: 'Publish rate', val: rate, set: setRate, steps: LAD.rate, fmtV: (v: number) => fmt.compact(v) + '/s', hint: 'Messages entering this node per second.' },
            { label: 'Avg message size', val: msgB, set: setMsgB, steps: LAD.bytes, fmtV: (v: number) => fmt.bytes(v), hint: 'Payload bytes — NIC, disk, and backlog RAM all scale with it.' },
            { label: 'Queues (sharded)', val: queues, set: setQueues, steps: LAD.many, fmtV: (v: number) => fmt.int(v), hint: 'Load spreads across queues; each is one process on one core.' },
            { label: 'Durable share', val: durablePct, set: setDurablePct, steps: LAD.pct, fmtV: (v: number) => v + '%', hint: 'Persistent / quorum messages: fsync + replication per message.' },
            { label: 'Standing backlog', val: backlog, set: setBacklog, steps: LAD.deep, fmtV: (v: number) => fmt.compact(v) + ' msgs', hint: 'Messages sitting unconsumed — the distance to the watermark.' },
          ].map((c) => (
            <div className="ctl" key={c.label}>
              <div className="ctl-top">
                <span className="ctl-label">{c.label}</span>
                <span className="ctl-val">{c.fmtV(c.val)}</span>
              </div>
              <LadderSlider steps={c.steps} value={c.val} onChange={c.set} ariaLabel={c.label} />
              <div className="ctl-hint">{c.hint}</div>
            </div>
          ))}
        </div>
        <div className="sb-out">
          <p className="sb-title">Load vs {sh.name}</p>
          {rows.map((r) => {
            const pct = (r.used / r.cap) * 100
            const st = pct >= 100 ? 'crit' : pct >= 75 ? 'warn' : 'good'
            const f = (n: number) => (r.unit === 'cores' || r.unit === 'GB' ? fmt.n1(n) : fmt.sig(n))
            return (
              <div className="meter" key={r.label}>
                <div className="meter-top">
                  <span className="meter-label">{r.label}</span>
                  <span className={`meter-num st-${st}`}>
                    {f(r.used)} / {f(r.cap)} {r.unit}
                  </span>
                </div>
                <div className="meter-bar">
                  <div className={`meter-fill fill-${st}`} style={{ width: Math.min(100, pct) + '%' }} />
                </div>
                <div className="meter-detail">{r.why}</div>
              </div>
            )
          })}
          <div className="meter">
            <div className="meter-top">
              <span className="meter-label">The alarm line</span>
              <span className="meter-num">{fmt.n1(watermarkGB)} GB = cluster-wide publish freeze</span>
            </div>
            <div className="meter-detail">
              vm_memory_high_watermark (default {Math.round(WATERMARK * 100)}% of RAM): the memory level at which this node blocks every publishing connection in the cluster — the defining operational line of RabbitMQ.
            </div>
          </div>
          <div className={`verdict v-${verdict.s}`}>
            <span className="vi">{verdict.s === 'good' ? '✓' : verdict.s === 'warn' ? '▲' : '✕'}</span>
            <span dangerouslySetInnerHTML={{ __html: verdict.t }} />
          </div>
        </div>
      </div>
    </div>
  )
}
