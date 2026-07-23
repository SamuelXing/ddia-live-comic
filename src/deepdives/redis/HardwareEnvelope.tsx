import { useState } from 'react'
import { fmt } from '../format'

/* ============================================================
   Hardware envelope widget: pick an instance shape + workload,
   see which resource binds first on a single Redis instance.
   Model (O ops/s, V value bytes, D dataset GB, w write fraction,
   N replicas):
     one core   = O · (5 µs + V·0.3 µs/KB)     — commands never
                  leave the main thread, whatever the box has
     RAM        = D·1.35 (overhead+frag) + D·w  (COW headroom)
     NIC egress = reads·V + writes·V·N          (replies + repl)
     disk write = writes·(V+60 B) + RDB cycle   (AOF + snapshots)
     fork stall ≈ 15 ms per resident GB (virtualized)
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
  { name: 'Dev box', cores: 2, ramGB: 8, nicGbps: 1, diskMBs: 450, note: '2 vCPU · 8 GB · 1 GbE · SATA SSD' },
  { name: 'Standard cache', cores: 4, ramGB: 16, nicGbps: 10, diskMBs: 1000, note: '4 vCPU · 16 GB · 10 GbE · NVMe' },
  { name: 'Big cache', cores: 8, ramGB: 64, nicGbps: 10, diskMBs: 2000, note: '8 vCPU · 64 GB · 10 GbE · NVMe' },
  { name: 'RAM monster', cores: 16, ramGB: 256, nicGbps: 25, diskMBs: 3000, note: '16 vCPU · 256 GB · 25 GbE · NVMe' },
]

const BASE_US = 5 // µs of main-thread time per simple command
const US_PER_KB = 0.3 // extra µs per KB of value moved
const OVERHEAD = 1.35 // per-key metadata + fragmentation
const FORK_MS_PER_GB = 15 // rough, virtualized hosts

export default function HardwareEnvelope() {
  const [shapeIdx, setShapeIdx] = useState(1)
  const [ops, setOps] = useState(150000)
  const [valB, setValB] = useState(1024)
  const [dataGB, setDataGB] = useState(6)
  const [writePct, setWritePct] = useState(20)
  const [replicas, setReplicas] = useState(1)

  const sh = SHAPES[shapeIdx]
  const nicMBs = sh.nicGbps * 125 // per direction

  const valKB = valB / 1024
  const coreUsed = (ops * (BASE_US + valKB * US_PER_KB)) / 1e6 // cores
  const w = writePct / 100
  const ramNeeded = dataGB * OVERHEAD + dataGB * w // COW headroom ∝ write rate
  const reads = ops * (1 - w)
  const writes = ops * w
  const netOut = (reads * valB + writes * valB * replicas) / 1e6 // MB/s
  const diskWr = (writes * (valB + 60)) / 1e6 + (dataGB * 1024) / 300 // AOF + ~5-min RDB cycle
  const forkMs = dataGB * FORK_MS_PER_GB

  const rows = [
    { label: 'The one core', used: coreUsed, cap: 1, unit: 'cores', why: `O × (${BASE_US} µs + ${US_PER_KB} µs/KB) — command execution never leaves the main thread; the box's other ${sh.cores - 1} cores get I/O threads and background jobs only` },
    { label: 'RAM', used: ramNeeded, cap: sh.ramGB, unit: 'GB', why: `dataset × ${OVERHEAD} (per-key overhead + fragmentation) + dataset × ${writePct}% copy-on-write headroom for the fork` },
    { label: 'NIC egress', used: netOut, cap: nicMBs, unit: 'MB/s', why: 'read replies + write stream × replicas — big values hit this wall long before the ops ceiling' },
    { label: 'Disk write', used: diskWr, cap: sh.diskMBs, unit: 'MB/s', why: 'AOF appends (everysec batches) + the RDB snapshot cycle' },
  ]
  const worst = rows.reduce((a, b) => (b.used / b.cap > a.used / a.cap ? b : a), rows[0])
  const worstPct = (worst.used / worst.cap) * 100

  const verdict =
    worstPct >= 100
      ? {
          s: 'crit',
          t: `<b>${worst.label} is over capacity</b> (${Math.round(worstPct)}%). ${
            worst.label === 'The one core'
              ? 'And this is the wall money can’t move: a bigger box adds cores Redis won’t use. Pipeline to cut per-op overhead, then shard (Chapter 5).'
              : worst.label === 'RAM'
                ? 'The dataset (plus overhead and fork headroom) doesn’t fit. Audit encodings and TTLs first — then bigger RAM or Cluster shards. Never reclaim the fork headroom; the OOM killer collects that debt.'
                : worst.label === 'NIC egress'
                  ? 'Values are moving more bytes than the wire carries. Compress, trim payloads, or read from replicas — the ops number was never the problem.'
                  : 'AOF + snapshot writes exceed the disk. everysec batches help; so does moving snapshots off-peak — or accepting RDB-only durability, consciously.'
          }`
        }
      : worstPct >= 75
        ? {
            s: 'warn',
            t: `<b>${worst.label} is the binding resource</b> at ${Math.round(worstPct)}% — this is what you'll hit first as load grows. Note the shape of this envelope: one core and one RAM stick define it; the disk exists only for the side-car persistence.`
          }
        : {
            s: 'good',
            t: `<b>Comfortable.</b> Binding resource: ${worst.label} at ${Math.round(worstPct)}%. The invisible number to respect: fork stall ≈ <b>${forkMs >= 1000 ? fmt.n1(forkMs / 1000) + ' s' : fmt.int(forkMs) + ' ms'}</b> at this dataset size — every snapshot, rewrite, and replica sync pays it on the one thread.`
          }

  return (
    <div className="hwv card" style={{ padding: 0 }}>
      <div className="sandbox">
        <div className="sb-controls">
          <p className="sb-title">Instance shape & workload</p>
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
            { label: 'Operations / sec', val: ops, set: setOps, min: 10000, max: 1500000, step: 10000, fmtV: (v: number) => fmt.compact(v) + '/s', hint: 'Commands hitting this one instance.' },
            { label: 'Avg value size', val: valB, set: setValB, min: 32, max: 65536, step: 32, fmtV: (v: number) => fmt.bytes(v), hint: 'Bytes per value — the NIC and per-op CPU both scale with it.' },
            { label: 'Dataset', val: dataGB, set: setDataGB, min: 1, max: 200, step: 1, fmtV: (v: number) => v + ' GB', hint: 'Logical data size. Overhead and fork headroom stack on top.' },
            { label: 'Write ratio', val: writePct, set: setWritePct, min: 0, max: 100, step: 5, fmtV: (v: number) => v + '%', hint: 'Writes drive replication, AOF, and copy-on-write headroom.' },
            { label: 'Replicas', val: replicas, set: setReplicas, min: 0, max: 5, step: 1, fmtV: (v: number) => String(v), hint: 'Each replica receives the full write stream.' },
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
          <p className="sb-title">Load vs {sh.name}</p>
          {rows.map((r) => {
            const pct = (r.used / r.cap) * 100
            const st = pct >= 100 ? 'crit' : pct >= 75 ? 'warn' : 'good'
            const f = (n: number) => (r.unit === 'cores' || r.unit === 'GB' ? fmt.n1(n) : fmt.int(n))
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
              <span className="meter-label">Fork stall</span>
              <span className="meter-num">~{forkMs >= 1000 ? fmt.n1(forkMs / 1000) + ' s' : fmt.int(forkMs) + ' ms'} on the one thread</span>
            </div>
            <div className="meter-detail">
              Paid on every snapshot, AOF rewrite, and replica resync: fork() copies page tables ∝ resident memory (~{FORK_MS_PER_GB} ms/GB virtualized) — the built-in argument for many small instances over one big one.
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
