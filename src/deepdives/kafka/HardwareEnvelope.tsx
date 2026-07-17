import { useState } from 'react'
import { fmt } from '../format'

/* ============================================================
   Hardware envelope widget: pick an instance shape + workload,
   see which resource binds first on a Kafka broker.
   Model (per broker, cluster ingress W MB/s, N brokers, RF,
   C consumer fan-out, leadership evenly spread):
     net in   = W·RF / N                (leader share + follower fetch-in)
     net out  = W·(RF−1+C) / N          (replication out + consumer reads)
     disk wr  = W·RF / N                (every replica persists its copy)
     storage  = W·3600·hours·RF / N
     cache window = usable RAM ÷ disk-write rate (seconds of hot tail)
   ============================================================ */

interface Shape {
  name: string
  cores: number
  ramGB: number
  nicGbps: number
  diskMBs: number
  diskTB: number
  note: string
}

const SHAPES: Shape[] = [
  { name: 'Dev box', cores: 4, ramGB: 16, nicGbps: 1, diskMBs: 450, diskTB: 1, note: '4 vCPU · 16 GB · 1 GbE · SATA SSD' },
  { name: 'Small prod', cores: 8, ramGB: 32, nicGbps: 10, diskMBs: 1000, diskTB: 2, note: '8 vCPU · 32 GB · 10 GbE · NVMe' },
  { name: 'Confluent baseline', cores: 24, ramGB: 64, nicGbps: 10, diskMBs: 900, diskTB: 12, note: '24 cores · 64 GB · 10 GbE · 12×1TB RAID10' },
  { name: 'Big NVMe', cores: 32, ramGB: 128, nicGbps: 25, diskMBs: 3000, diskTB: 8, note: '32 vCPU · 128 GB · 25 GbE · NVMe stripe' },
]

const HEAP_GB = 6 // Kafka heap stays small; the rest of RAM is page cache

export default function HardwareEnvelope() {
  const [shapeIdx, setShapeIdx] = useState(2)
  const [ingress, setIngress] = useState(300) // MB/s cluster-wide
  const [brokers, setBrokers] = useState(6)
  const [rf, setRf] = useState(3)
  const [fanout, setFanout] = useState(2)
  const [retention, setRetention] = useState(24)

  const sh = SHAPES[shapeIdx]
  const nicMBs = sh.nicGbps * 125 // per direction

  const netIn = (ingress * rf) / brokers
  const netOut = (ingress * (rf - 1 + fanout)) / brokers
  const diskWr = (ingress * rf) / brokers
  const storageTB = (ingress * 3600 * retention * rf) / brokers / 1e6
  const cacheGB = Math.max(1, sh.ramGB - HEAP_GB)
  const cacheWindowS = (cacheGB * 1024) / Math.max(0.1, diskWr)

  const rows = [
    { label: 'NIC ingress', used: netIn, cap: nicMBs, unit: 'MB/s', why: `W·RF/N — leader writes in + follower fetch-in` },
    { label: 'NIC egress', used: netOut, cap: nicMBs, unit: 'MB/s', why: `W·(RF−1+${fanout})/N — replication out + ${fanout} consumer group${fanout !== 1 ? 's' : ''}` },
    { label: 'Disk write', used: diskWr, cap: sh.diskMBs, unit: 'MB/s', why: 'sequential append — every replica persists its copy' },
    { label: 'Disk capacity', used: storageTB, cap: sh.diskTB, unit: 'TB', why: `${retention}h retention × RF ÷ brokers` },
  ]
  const worst = rows.reduce((a, b) => (b.used / b.cap > a.used / a.cap ? b : a), rows[0])
  const worstPct = (worst.used / worst.cap) * 100

  const verdict =
    worstPct >= 100
      ? { s: 'crit', t: `<b>${worst.label} is over capacity</b> (${Math.round(worstPct)}%). ${worst.label.startsWith('NIC') ? 'The network is almost always Kafka’s first wall — every ingress MB/s costs RF× in and (RF−1+consumers)× out across the cluster. Bigger NICs or more brokers.' : worst.label === 'Disk capacity' ? 'Retention × replication is outrunning disk — shorten retention, use tiered storage, or add brokers/disks.' : 'Sequential writes are outrunning the disk — stripe more disks (JBOD) or add brokers.'}` }
      : worstPct >= 75
        ? { s: 'warn', t: `<b>${worst.label} is the binding resource</b> at ${Math.round(worstPct)}% — this is what you'll hit first as traffic grows. Note CPU barely features: brokers move bytes, they don't compute (compression and TLS are the exceptions).` }
        : { s: 'good', t: `<b>Comfortable.</b> Binding resource: ${worst.label} at ${Math.round(worstPct)}%. Page cache holds ~${cacheWindowS > 3600 ? fmt.n1(cacheWindowS / 3600) + ' h' : fmt.int(cacheWindowS / 60) + ' min'} of tail data — consumers lagging beyond that window fall out of RAM onto disk.` }

  return (
    <div className="hwv card" style={{ padding: 0 }}>
      <div className="sandbox">
        <div className="sb-controls">
          <p className="sb-title">Broker shape & workload</p>
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
            { label: 'Cluster ingress', val: ingress, set: setIngress, min: 10, max: 3000, step: 10, fmtV: (v: number) => v + ' MB/s', hint: 'Total producer traffic entering the cluster.' },
            { label: 'Brokers', val: brokers, set: setBrokers, min: 3, max: 30, step: 1, fmtV: (v: number) => String(v), hint: 'Load spreads across brokers (leadership balanced).' },
            { label: 'Replication factor', val: rf, set: setRf, min: 1, max: 5, step: 1, fmtV: (v: number) => '×' + v, hint: 'Every MB/s in becomes RF MB/s of cluster disk + network.' },
            { label: 'Consumer fan-out', val: fanout, set: setFanout, min: 0, max: 8, step: 1, fmtV: (v: number) => v + ' groups', hint: 'Independent consumer groups reading everything.' },
            { label: 'Retention', val: retention, set: setRetention, min: 1, max: 336, step: 1, fmtV: (v: number) => v + ' h', hint: 'How long the log keeps data → disk capacity.' },
          ].map((c) => (
            <div className="ctl" key={c.label}>
              <div className="ctl-top">
                <span className="ctl-label">{c.label}</span>
                <span className="ctl-val">{c.fmtV(c.val)}</span>
              </div>
              <input type="range" min={c.min} max={c.max} step={c.step} value={c.val} onChange={(e) => c.set(parseFloat(e.target.value))} />
              <div className="ctl-hint">{c.hint}</div>
            </div>
          ))}
        </div>
        <div className="sb-out">
          <p className="sb-title">Per-broker load vs {sh.name}</p>
          {rows.map((r) => {
            const pct = (r.used / r.cap) * 100
            const st = pct >= 100 ? 'crit' : pct >= 75 ? 'warn' : 'good'
            return (
              <div className="meter" key={r.label}>
                <div className="meter-top">
                  <span className="meter-label">{r.label}</span>
                  <span className={`meter-num st-${st}`}>
                    {r.unit === 'TB' ? fmt.n1(r.used) : fmt.int(r.used)} / {r.unit === 'TB' ? fmt.n1(r.cap) : fmt.int(r.cap)} {r.unit}
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
              <span className="meter-label">Page-cache window (RAM − {HEAP_GB} GB heap)</span>
              <span className="meter-num">
                {cacheWindowS > 3600 ? fmt.n1(cacheWindowS / 3600) + ' h' : fmt.int(cacheWindowS / 60) + ' min'} of tail data in RAM
              </span>
            </div>
            <div className="meter-detail">
              Consumers lagging beyond this window read from disk and evict hot pages — the noisy-neighbor failure from the consume trace.
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
