import { useState } from 'react'
import { fmt } from '../format'
import { LAD, LadderSlider } from '../ladder'
import { queueMultiplier } from '../latencyModel'

/* ============================================================
   Hardware envelope widget: one stateless instance. Pick a shape
   and a per-instance workload, see which resource binds first.

   Model (r req/s on one instance, c ms CPU per request, w ms
   waiting on dependencies, k KB response, N configured workers,
   P pooled outbound connections):
     W          = c + w                    total service time
     slots used = r · W/1000               Little's Law
     cores      = r · c/1000
     memory     = base + N · perWorkerMB
     NIC out    = r · k / 1024             MB/s
     sockets    = N + P + keep-alive conns vs the fd limit
     ports      = P outbound to one destination vs 28,232

   The interesting row is none of those: it is the queueing
   multiplier 1/(1−ρ) on slot utilization, which is why a tier at
   90% "full" is not 10% away from trouble.
   ============================================================ */

interface Shape {
  name: string
  cores: number
  ramGB: number
  nicGbps: number
  note: string
}

const SHAPES: Shape[] = [
  { name: 'Small container', cores: 1, ramGB: 2, nicGbps: 1, note: '1 vCPU · 2 GB · burstable' },
  { name: 'Standard pod', cores: 2, ramGB: 8, nicGbps: 5, note: '2 vCPU · 8 GB · 5 Gbps' },
  { name: 'Big instance', cores: 8, ramGB: 32, nicGbps: 10, note: '8 vCPU · 32 GB · 10 GbE' },
  { name: 'Fat box', cores: 32, ramGB: 128, nicGbps: 25, note: '32 vCPU · 128 GB · 25 GbE' },
]

const BASE_MB = 300 // runtime, code, shared structures before any worker exists
const KEEPALIVE = 200 // inbound connections held open between requests
/* Linux default ephemeral range is 32768–60999 — 28,232 ports, and they are
   consumed per (source IP, destination IP, destination port) tuple. A pool of
   outbound connections to one dependency draws from exactly one such pool. */
const EPHEMERAL = 28232
const FD_LIMIT = 65536 // after someone raises it; the default is 1024

export default function HardwareEnvelope() {
  /* The landing state is chosen to be the chapter's argument, not a neutral
     midpoint: an I/O-bound handler (2 ms of CPU, 50 ms of waiting) on a box
     with cores to spare, which runs out of SLOTS at ~81% while CPU sits near
     25%. That fires the queueing-multiplier verdict, which is the one thing
     on this page most worth arriving already knowing. */
  const [shapeIdx, setShapeIdx] = useState(2)
  const [rps, setRps] = useState(1000)
  const [cpuMs, setCpuMs] = useState(2)
  const [waitMs, setWaitMs] = useState(50)
  const [respKB, setRespKB] = useState(20)
  const [workers, setWorkers] = useState(64)
  const [perWorker, setPerWorker] = useState(5)

  const sh = SHAPES[shapeIdx]
  const nicMBs = sh.nicGbps * 125 // per direction

  const W = cpuMs + waitMs
  const slotsUsed = (rps * W) / 1000
  const cores = (rps * cpuMs) / 1000
  const memMB = BASE_MB + workers * perWorker
  const netOut = (rps * respKB) / 1024
  const pool = Math.min(workers, 20)
  const sockets = workers + pool + KEEPALIVE

  const slotUtil = (slotsUsed / workers) * 100
  const mult = queueMultiplier(slotUtil)
  const effW = W * mult

  const rows = [
    { label: 'Worker slots', used: slotsUsed, cap: workers, unit: 'slots', why: `Little's Law: ${fmt.compact(rps)}/s × ${W} ms = ${fmt.sig(slotsUsed)} requests held at once. Slots are the capacity; everything else is usually spare.` },
    { label: 'CPU', used: cores, cap: sh.cores, unit: 'cores', why: `${fmt.compact(rps)}/s × ${cpuMs} ms of actual computation. The ${waitMs} ms of waiting costs no CPU at all — which is exactly why CPU is a poor fullness gauge here.` },
    { label: 'Memory', used: memMB / 1024, cap: sh.ramGB, unit: 'GB', why: `${BASE_MB} MB baseline + ${workers} workers × ${perWorker} MB. This is the real cap on thread-per-request: a slot costs a stack, an async slot costs a few hundred bytes.` },
    { label: 'NIC egress', used: netOut, cap: nicMBs, unit: 'MB/s', why: `${fmt.compact(rps)}/s × ${respKB} KB of response. Binds early for media and large payloads, essentially never for JSON.` },
    { label: 'Sockets / file descriptors', used: sockets, cap: FD_LIMIT, unit: 'fds', why: `${workers} workers + ${pool} pooled outbound + ~${KEEPALIVE} kept-alive inbound. Harmless at 65,536 — instant death at the 1,024 default nobody remembers to raise.` },
    { label: 'Ephemeral ports (one destination)', used: pool * 40, cap: EPHEMERAL, unit: 'ports', why: `Outbound connections to a single dependency draw from one ${fmt.int(EPHEMERAL)}-port range. Without keep-alive, every request burns a port that then sits in TIME_WAIT for 60 s.` },
  ]

  const worst = rows.reduce((a, b) => (b.used / b.cap > a.used / a.cap ? b : a), rows[0])
  const worstPct = (worst.used / worst.cap) * 100

  const explain: Record<string, string> = {
    'Worker slots':
      'Slots are the honest capacity number, and there are only two ways to move it: raise N (costs memory) or cut W (costs engineering, and pays twice — it shrinks the fleet and the connection count together).',
    CPU: 'Genuinely CPU-bound is the good case: it means scale-out is linear and honest. Check first that it is your handler and not serialization, compression, or TLS — those move to a different layer.',
    Memory:
      'Memory per worker is what really decides your concurrency model. If each slot costs megabytes you will run out of RAM long before you run out of anything interesting; that is the whole argument for async runtimes.',
    'NIC egress':
      'You are shipping bytes, not computing. Put a CDN in front — it is the only fix that reduces both the bandwidth bill and the request count at the same time.',
    'Sockets / file descriptors':
      'Raise the limit, and check it on every base image you inherit. This one is pure operational hygiene and it takes down a first deploy roughly once per career.',
    'Ephemeral ports (one destination)':
      'Reuse connections. Keep-alive to a small number of upstream hosts is the fix; without it, a busy instance exhausts a 28,232-port range and starts failing to connect while looking completely idle.',
  }

  const verdict =
    worstPct >= 100
      ? { s: 'crit', t: `<b>${worst.label} is over capacity</b> (${Math.round(worstPct)}%). ${explain[worst.label]}` }
      : slotUtil >= 80
        ? {
            s: 'warn',
            t: `<b>Slots are ${Math.round(slotUtil)}% utilized — so the queue now owns your latency.</b> At that utilization the M/M/1 multiplier is <code>1 ÷ (1 − ${(slotUtil / 100).toFixed(2)}) = ${fmt.n1(mult)}×</code>, turning a ${W} ms request into roughly <b>${fmt.sig(effW)} ms</b>. The box is not ${Math.round(slotUtil)}% full; it is ${fmt.n1(mult)}× slower. This is why a stateless tier is sized for ~70%, not ~95%.`,
          }
        : worstPct >= 75
          ? { s: 'warn', t: `<b>${worst.label} binds first</b>, at ${Math.round(worstPct)}%. ${explain[worst.label]}` }
          : {
              s: 'good',
              t: `<b>Comfortable.</b> Binding resource: ${worst.label} at ${Math.round(worstPct)}%, with slots at ${Math.round(slotUtil)}% and a queueing multiplier of ${fmt.n1(mult)}×. Notice what never binds on a healthy web instance: nothing stateful. That is the entire reason this tier is the easy one.`,
            }

  return (
    <div className="hwv card" style={{ padding: 0 }}>
      <div className="sandbox">
        <div className="sb-controls">
          <p className="sb-title">Instance shape & per-instance load</p>
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
            { label: 'Requests / sec (this instance)', val: rps, set: setRps, steps: LAD.rateSm, fmtV: (v: number) => fmt.compact(v) + '/s', hint: 'What one instance is asked to serve — fleet RPS divided by fleet size.' },
            { label: 'CPU per request', val: cpuMs, set: setCpuMs, steps: LAD.ms, fmtV: (v: number) => v + ' ms', hint: 'Actual computation: routing, deserialization, templating, serialization.' },
            { label: 'Waiting per request', val: waitMs, set: setWaitMs, steps: LAD.ms, fmtV: (v: number) => v + ' ms', hint: 'Blocked on the database, cache, and other services. Usually the bulk of W.' },
            { label: 'Response size', val: respKB, set: setRespKB, steps: LAD.kb, fmtV: (v: number) => fmt.bytes(v * 1024), hint: 'Bytes returned per request — the only input that touches the NIC.' },
            { label: 'Workers configured', val: workers, set: setWorkers, steps: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048], fmtV: (v: number) => fmt.int(v), hint: 'Concurrent slots: threads, goroutines, or event-loop continuations.' },
            { label: 'Memory per worker', val: perWorker, set: setPerWorker, steps: [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50], fmtV: (v: number) => (v < 1 ? v * 1000 + ' KB' : v + ' MB'), hint: 'A thread stack plus per-request heap. An async slot is closer to 100 KB; a thread is closer to 5 MB.' },
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
            /* Counts of discrete things print exactly — a file-descriptor
               limit rounded to "66,000" contradicts the prose next to it. */
            const f = (n: number) =>
              r.unit === 'cores' || r.unit === 'GB'
                ? fmt.n1(n)
                : r.unit === 'fds' || r.unit === 'ports' || r.unit === 'slots'
                  ? fmt.int(n)
                  : fmt.sig(n)
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
              <span className="meter-label">Queueing multiplier</span>
              <span className="meter-num">
                {fmt.n1(mult)}× → {fmt.sig(effW)} ms
              </span>
            </div>
            <div className="meter-detail">
              Slots are {Math.round(slotUtil)}% utilized, so waiting-for-a-slot multiplies service time by{' '}
              <code>1 ÷ (1 − ρ)</code> — the same M/M/1 term the latency budget calculator uses. A {W} ms request
              is served in about {fmt.sig(effW)} ms. This row is why the useful ceiling is ~70%, not ~100%.
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
