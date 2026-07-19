import { useState } from 'react'
import { fmt } from '../format'

/* ============================================================
   Hardware envelope widget: pick a primary's shape + workload,
   see which resource binds first on a Postgres primary.
   Model (single primary, R read QPS, W write TPS, S working set,
   D total data, N streaming replicas):
     cpu cores  = R·0.12ms + W·0.4ms          (parse/plan/execute)
     cached     = min(1, usableRAM / S)        (shared buffers + OS cache)
     disk read  = R·(1−cached)·1.5 pages       (the spill — 0 if S fits)
     WAL        = W·6 KB (records + index WAL + FPW amortized)
     disk write = WAL·2.2                      (WAL now + checkpoint later)
     net egress = WAL·N + R·2 KB               (replication fan-out + results)
     capacity   = D·1.3                        (indexes + bloat headroom)
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
  { name: 'Dev box', cores: 4, ramGB: 16, nicGbps: 1, diskMBs: 450, diskTB: 0.5, note: '4 vCPU · 16 GB · 1 GbE · SATA SSD' },
  { name: 'Small prod', cores: 8, ramGB: 64, nicGbps: 10, diskMBs: 1500, diskTB: 1, note: '8 vCPU · 64 GB · 10 GbE · NVMe' },
  { name: 'Serious primary', cores: 32, ramGB: 256, nicGbps: 10, diskMBs: 3000, diskTB: 4, note: '32 vCPU · 256 GB · 10 GbE · NVMe' },
  { name: 'Monster', cores: 96, ramGB: 768, nicGbps: 25, diskMBs: 6000, diskTB: 16, note: '96 vCPU · 768 GB · 25 GbE · NVMe stripe' },
]

const READ_MS = 0.12 // core-ms per cached indexed read
const WRITE_MS = 0.4 // core-ms per write incl. index maintenance
const WAL_KB = 6 // WAL bytes per write, FPW amortized
const RAM_USABLE = 0.85 // shared_buffers + OS cache share of RAM

export default function HardwareEnvelope() {
  const [shapeIdx, setShapeIdx] = useState(2)
  const [reads, setReads] = useState(40000)
  const [writes, setWrites] = useState(8000)
  const [workset, setWorkset] = useState(200) // GB
  const [dataGB, setDataGB] = useState(1200)
  const [replicas, setReplicas] = useState(2)

  const sh = SHAPES[shapeIdx]
  const nicMBs = sh.nicGbps * 125 // per direction

  const cpuCores = (reads * READ_MS + writes * WRITE_MS) / 1000
  const usableRAM = sh.ramGB * RAM_USABLE
  const cached = Math.min(1, usableRAM / workset)
  const diskReadMBs = (reads * (1 - cached) * 1.5 * 8) / 1024
  const walMBs = (writes * WAL_KB) / 1024
  const diskWrMBs = walMBs * 2.2
  const netOut = walMBs * replicas + (reads * 2) / 1024
  const capTB = (dataGB * 1.3) / 1000
  const ckptGB = (walMBs * 300) / 1024 // WAL per 5-min checkpoint cycle

  const rows = [
    { label: 'CPU', used: cpuCores, cap: sh.cores, unit: 'cores', why: `R·${READ_MS} ms + W·${WRITE_MS} ms — parse, plan, execute, index maintenance` },
    { label: 'RAM vs working set', used: workset, cap: usableRAM, unit: 'GB', why: `working set vs ~${Math.round(RAM_USABLE * 100)}% of RAM (shared_buffers + OS cache). Past 100% every miss is a random disk read` },
    { label: 'Disk write', used: diskWrMBs, cap: sh.diskMBs, unit: 'MB/s', why: 'WAL now + checkpoint flush later ≈ 2.2× WAL bytes' },
    { label: 'Disk read (spill)', used: diskReadMBs, cap: sh.diskMBs, unit: 'MB/s', why: cached >= 1 ? 'zero — the working set fits in RAM' : `${fmt.compact(reads * (1 - cached))} misses/s × 8 KB random reads` },
    { label: 'NIC egress', used: netOut, cap: nicMBs, unit: 'MB/s', why: `WAL × ${replicas} replica${replicas !== 1 ? 's' : ''} + result sets` },
    { label: 'Disk capacity', used: capTB, cap: sh.diskTB, unit: 'TB', why: 'data + indexes + bloat headroom (~1.3×)' },
  ]
  const worst = rows.reduce((a, b) => (b.used / b.cap > a.used / a.cap ? b : a), rows[0])
  const worstPct = (worst.used / worst.cap) * 100

  const verdict =
    worstPct >= 100
      ? {
          s: 'crit',
          t: `<b>${worst.label} is over capacity</b> (${Math.round(worstPct)}%). ${
            worst.label === 'RAM vs working set' || worst.label === 'Disk read (spill)'
              ? 'The working set has spilled out of memory — this is a cliff, not a slope: every miss is a random read competing with the WAL. Add RAM, archive cold data, or fix bloat before adding anything else.'
              : worst.label === 'CPU'
                ? 'Cores are burning on parse/plan/execute. Before buying cores, check pg_stat_statements — one seq-scanning query can eat more CPU than the rest of the workload combined.'
                : worst.label === 'Disk capacity'
                  ? 'The volume is filling. Archive cold data, partition-and-detach old ranges, or grow the disk — and check bloat first; it is often a third of the “data.”'
                  : worst.label === 'NIC egress'
                    ? 'WAL fan-out to the replicas is saturating the NIC. Cascading replication (replicas feeding replicas) or a bigger NIC.'
                    : 'The write path is outrunning the disk. Faster NVMe, or spread the checkpoint (max_wal_size ↑, completion_target 0.9) so flushes stop bunching.'
          }`
        }
      : worstPct >= 75
        ? {
            s: 'warn',
            t: `<b>${worst.label} is the binding resource</b> at ${Math.round(worstPct)}% — this is what you'll hit first as load grows. Note what's absent: raw QPS barely features. Postgres capacity is about whether the working set fits in RAM and how fast one disk can fsync.`
          }
        : {
            s: 'good',
            t: `<b>Comfortable.</b> Binding resource: ${worst.label} at ${Math.round(worstPct)}%. Commit latency floor: one WAL fsync (~0.2 ms NVMe) — group commit batches concurrent sessions, so throughput scales even though each commit waits its turn.`
          }

  return (
    <div className="hwv card" style={{ padding: 0 }}>
      <div className="sandbox">
        <div className="sb-controls">
          <p className="sb-title">Primary shape & workload</p>
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
            { label: 'Read QPS', val: reads, set: setReads, min: 1000, max: 300000, step: 1000, fmtV: (v: number) => fmt.compact(v) + '/s', hint: 'Simple indexed OLTP reads hitting the primary.' },
            { label: 'Write TPS', val: writes, set: setWrites, min: 100, max: 80000, step: 100, fmtV: (v: number) => fmt.compact(v) + '/s', hint: 'INSERT/UPDATE/DELETE — each is WAL + heap + index work.' },
            { label: 'Working set', val: workset, set: setWorkset, min: 10, max: 4000, step: 10, fmtV: (v: number) => v + ' GB', hint: 'The hot data queries actually touch. THE number to know.' },
            { label: 'Total data', val: dataGB, set: setDataGB, min: 50, max: 30000, step: 50, fmtV: (v: number) => (v >= 1000 ? fmt.n1(v / 1000) + ' TB' : v + ' GB'), hint: 'Everything on disk, hot or cold → capacity.' },
            { label: 'Streaming replicas', val: replicas, set: setReplicas, min: 0, max: 8, step: 1, fmtV: (v: number) => String(v), hint: 'Each replica receives the full WAL stream.' },
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
            const f = (n: number) => (r.unit === 'TB' || r.unit === 'cores' ? fmt.n1(n) : fmt.int(n))
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
              <span className="meter-label">Checkpoint burst</span>
              <span className="meter-num">~{ckptGB >= 1 ? fmt.n1(ckptGB) + ' GB' : fmt.int(ckptGB * 1024) + ' MB'} / 5-min cycle</span>
            </div>
            <div className="meter-detail">
              WAL generated per checkpoint interval — after each checkpoint, the first touch of every page logs the full 8 KB again (torn-page protection), so write volume spikes on this rhythm.
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
