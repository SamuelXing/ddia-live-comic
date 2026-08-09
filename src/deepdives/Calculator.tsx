import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fmt } from './format'

/* ============================================================
   Capacity planning from first principles.

   Every ceiling on this page is COMPUTED from the hardware constants
   below — no rules of thumb, no remembered magic numbers. The constants
   are editable and sourced (napkin-math, MIT, measured March 2026 on a
   c4-standard-48-lssd), so you can swap in your own hardware and watch
   every threshold move.
   ============================================================ */

interface Inp {
  id: string
  label: string
  /** the only values this input can take — a 1-2-5 ladder, so you choose a
   *  scale rather than a falsely precise number. 16k is not a real input. */
  steps: number[]
  val: number
  fmt: (v: number) => string
  hint: string
}

const L = {
  count: [1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6, 2e6, 5e6, 1e7, 2e7, 5e7, 1e8, 2e8, 5e8],
  small: [1, 2, 5, 10, 20, 50, 100, 200],
  mult: [1, 1.5, 2, 3, 5, 10],
  pct: [0, 10, 20, 30, 40, 50, 60, 70, 75, 80, 85, 90, 95, 99],
  kb: [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000],
  ms: [5, 10, 20, 50, 100, 200, 500, 1000],
  mo: [1, 3, 6, 12, 24, 36, 60],
  growth: [0, 1, 2, 5, 10, 20, 50],
  pow2: [1, 2, 4, 8, 16, 32, 64],
  us: [10, 20, 50, 100, 200, 500, 1000, 2000, 5000],
  gbps: [1, 2, 5, 10, 25, 40, 100],
  slots: [4, 8, 16, 32, 64, 128, 256, 512, 1024],
  amp: [1, 2, 3, 5, 10, 20],
}

const WORKLOAD: Inp[] = [
  { id: 'dau', label: 'Daily active users', steps: L.count, val: 5e7, fmt: (v) => fmt.compact(v), hint: 'Or any daily population driving the system.' },
  { id: 'actions', label: 'Actions / user / day', steps: L.small, val: 20, fmt: (v) => fmt.int(v) + '/day', hint: 'Requests one active user makes in a day.' },
  { id: 'peak', label: 'Peak factor', steps: L.mult, val: 3, fmt: (v) => '×' + fmt.n1(v), hint: 'Busiest moment vs the daily average.' },
  { id: 'readPct', label: 'Read share', steps: L.pct, val: 85, fmt: (v) => v + '% reads', hint: 'Reads cache and replicate. Writes are the wall.' },
  { id: 'payload', label: 'Avg object / response size', steps: L.kb, val: 50, fmt: (v) => fmt.bytes(v * 1024), hint: 'Drives bandwidth and storage.' },
  { id: 'lat', label: 'Avg request latency', steps: L.ms, val: 100, fmt: (v) => v + ' ms', hint: 'Service time per request, for Little’s Law.' },
  { id: 'retention', label: 'Data retention', steps: L.mo, val: 12, fmt: (v) => v + ' mo', hint: 'How long writes are kept.' },
  { id: 'growth', label: 'Monthly growth', steps: L.growth, val: 10, fmt: (v) => v + '%/mo', hint: 'Compounded, for the runway estimate.' },
]

/** src: 'napkin' = measured constant; 'assume' = a modelling choice you should challenge */
const HW: (Inp & { src: 'napkin' | 'assume' })[] = [
  { id: 'fsync', label: 'SSD write + fsync', steps: L.us, val: 300, src: 'napkin', fmt: (v) => v + ' µs', hint: 'The cost of making one write durable. Sets the write ceiling.' },
  { id: 'group', label: 'Transactions per fsync', steps: L.pow2, val: 8, src: 'assume', fmt: (v) => '×' + fmt.int(v), hint: 'Group commit: how many commits share one fsync.' },
  { id: 'randRead', label: 'Random SSD read (8 KiB)', steps: L.us, val: 100, src: 'napkin', fmt: (v) => v + ' µs', hint: 'What a cache miss costs when it reaches disk.' },
  { id: 'ioDepth', label: 'Concurrent disk reads', steps: L.pow2, val: 8, src: 'assume', fmt: (v) => '×' + fmt.int(v), hint: 'NVMe serves many reads at once; this multiplies read throughput.' },
  { id: 'cacheOp', label: 'Cache op, CPU cost', steps: [1, 2, 5, 10, 20, 50, 100], val: 10, src: 'assume', fmt: (v) => v + ' µs', hint: 'Two syscalls cost ~0.6 µs; parsing and the network stack are the rest.' },
  { id: 'nic', label: 'Origin NIC', steps: L.gbps, val: 10, src: 'assume', fmt: (v) => v + ' Gbps', hint: 'Per-host egress capacity before you need more hosts or a CDN.' },
  { id: 'slots', label: 'Concurrency per instance', steps: L.slots, val: 64, src: 'assume', fmt: (v) => fmt.int(v) + ' slots', hint: 'In-flight requests one app instance handles.' },
  { id: 'writeAmp', label: 'Write amplification', steps: L.amp, val: 3, src: 'assume', fmt: (v) => '×' + fmt.int(v), hint: 'Bytes actually written per logical write: WAL + page + indexes.' },
]

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

export default function Calculator() {
  const init: Record<string, number> = {}
  ;[...WORKLOAD, ...HW].forEach((i) => (init[i.id] = i.val))
  const [v, setV] = useState<Record<string, number>>(init)
  const [showHw, setShowHw] = useState(false)
  const set = (id: string) => (n: number) => setV((s) => ({ ...s, [id]: n }))

  // ---------- workload ----------
  const actionsPerDay = v.dau * v.actions
  const avgQps = actionsPerDay / 86400
  const peakQps = avgQps * v.peak
  const peakReads = (peakQps * v.readPct) / 100
  const peakWrites = peakQps - peakReads
  const writesPerDay = actionsPerDay * (1 - v.readPct / 100)
  const bytesPerObj = v.payload * 1024
  const storagePerDay = writesPerDay * bytesPerObj
  const storageTotal = storagePerDay * 30 * v.retention
  const egressGbps = (peakReads * bytesPerObj * 8) / 1e9

  // ---------- ceilings, derived from the constants ----------
  /** one fsync makes a group of commits durable */
  const writeCeiling = v.group / (v.fsync / 1e6)
  /** NVMe serves ioDepth random reads concurrently */
  const diskReadCeiling = v.ioDepth / (v.randRead / 1e6)
  /** one core, one op at a time */
  const cacheCeiling = 1 / (v.cacheOp / 1e6)
  const diskWriteBytes = peakWrites * bytesPerObj * v.writeAmp
  const webInstances = Math.max(1, Math.ceil((peakQps * (v.lat / 1000)) / v.slots))
  const originHosts = Math.max(1, Math.ceil(egressGbps / v.nic))
  const cacheNodes = Math.max(1, Math.ceil(peakReads / cacheCeiling))
  const readUtil = peakReads / diskReadCeiling
  const writeUtil = peakWrites / writeCeiling

  const derived: { k: string; v: string; how: string }[] = [
    { k: 'Requests', v: `${fmt.compact(avgQps)}/s avg · ${fmt.compact(peakQps)}/s peak`, how: `${fmt.compact(v.dau)} × ${v.actions} ÷ 86,400 × ${fmt.n1(v.peak)}` },
    { k: 'Split at peak', v: `${fmt.compact(peakReads)}/s reads · ${fmt.compact(peakWrites)}/s writes`, how: `peak × ${v.readPct}% / ${100 - v.readPct}%` },
    { k: 'New data', v: `${fmt.bytes(storagePerDay)}/day`, how: `${fmt.compact(writesPerDay)} writes/day × ${fmt.bytes(bytesPerObj)}` },
    { k: 'Stored at retention', v: fmt.bytes(storageTotal), how: `${fmt.bytes(storagePerDay)}/day × 30 × ${v.retention} mo, before replication` },
    { k: 'Disk write rate', v: `${fmt.bytes(diskWriteBytes)}/s`, how: `${fmt.compact(peakWrites)} writes/s × ${fmt.bytes(bytesPerObj)} × ${v.writeAmp} amplification` },
    { k: 'Peak egress', v: `${fmt.n1(egressGbps)} Gbps`, how: `${fmt.compact(peakReads)} reads/s × ${fmt.bytes(bytesPerObj)} × 8 bits` },
    { k: 'App instances', v: `~${fmt.int(webInstances)}`, how: `Little’s Law: ${fmt.compact(peakQps)}/s × ${v.lat} ms ÷ ${v.slots} slots` },
  ]

  const ceilings: { k: string; v: string; how: string }[] = [
    { k: 'Durable writes, one primary', v: `${fmt.compact(writeCeiling)}/s`, how: `${v.group} commits per fsync ÷ ${v.fsync} µs` },
    { k: 'Random reads, one node', v: `${fmt.compact(diskReadCeiling)}/s`, how: `${v.ioDepth} concurrent ÷ ${v.randRead} µs` },
    { k: 'Cache ops, one core', v: `${fmt.compact(cacheCeiling)}/s`, how: `1 ÷ ${v.cacheOp} µs per op` },
    { k: 'Egress, one host', v: `${v.nic} Gbps`, how: 'NIC capacity' },
  ]

  interface Rec { need: boolean; what: string; number: string; because: string; to: { label: string; href: string }[] }
  const recs: Rec[] = [
    {
      need: originHosts > 1,
      what: 'A CDN, or more origin hosts',
      number: `${fmt.n1(egressGbps)} Gbps ÷ ${v.nic} Gbps per host = ${originHosts} host${originHosts === 1 ? '' : 's'} of pure bandwidth`,
      because: 'serving these bytes from your own origin costs hosts and egress; a CDN moves the copy next to the user and the bill off your origin',
      to: [{ label: 'S3 / object storage', href: '/components/s3' }],
    },
    {
      need: readUtil > 0.3,
      what: 'A cache in front of the database',
      number: `${fmt.compact(peakReads)} reads/s is ${fmt.n1(readUtil * 100)}% of one node’s ${fmt.compact(diskReadCeiling)}/s random-read ceiling`,
      because: `a disk read costs ${v.randRead} µs; the same read from memory costs ~20 ns. Caching is not only about throughput — it is a 1000× latency difference`,
      to: [
        { label: 'Redis deep-dive', href: '/components/redis' },
        { label: 'Idea: replication lag', href: '/read/replication-lag' },
      ],
    },
    {
      need: cacheNodes > 1,
      what: 'More than one cache node',
      number: `${fmt.compact(peakReads)} reads/s ÷ ${fmt.compact(cacheCeiling)}/s per core = ${cacheNodes} nodes`,
      because: 'a cache server is effectively single-threaded per shard, so past one core’s worth of operations you are partitioning, not scaling up',
      to: [
        { label: 'Redis deep-dive', href: '/components/redis' },
        { label: 'Idea: consistent hashing', href: '/read/partitioning' },
      ],
    },
    {
      need: writeUtil > 1,
      what: 'Shard the write path',
      number: `${fmt.compact(peakWrites)} writes/s vs a ${fmt.compact(writeCeiling)}/s ceiling (${fmt.n1(writeUtil * 100)}% of one primary)`,
      because: 'replicas do not help: every replica replays every write. Past one primary the only move left is to split the data',
      to: [
        { label: 'Idea: consistent hashing', href: '/read/partitioning' },
        { label: 'Postgres deep-dive', href: '/components/postgres' },
      ],
    },
    {
      need: writeUtil > 0.5 && v.peak >= 2,
      what: 'A log in front of the writes',
      number: `peaks reach ${fmt.n1(writeUtil * 100)}% of the write ceiling, ×${fmt.n1(v.peak)} above average`,
      because: 'a durable log absorbs the spike at sequential-write speed and lets the database consume at its own pace, instead of sizing the database for the worst minute of the day',
      to: [{ label: 'Kafka deep-dive', href: '/components/kafka' }],
    },
  ]
  const needed = recs.filter((r) => r.need)
  const notYet = recs.filter((r) => !r.need)

  const g = v.growth / 100
  const monthsToWall =
    peakWrites >= writeCeiling ? 0 : g > 0 ? Math.log(writeCeiling / Math.max(1, peakWrites)) / Math.log(1 + g) : Infinity

  return (
    <section>
      <p className="h-kicker">Capacity planning</p>
      <h1 className="title">What does this system actually need?</h1>
      <p className="lede">
        Describe the workload, and the arithmetic gives you the request rate, the storage, the
        bandwidth — and <b>which components the numbers force you to add</b>. Every ceiling here is
        computed from the <b>hardware constants below</b>, which you can see and change; none of them
        are remembered rules of thumb.
      </p>

      <div className="card" style={{ padding: 0 }}>
        <div className="sandbox">
          <div className="sb-controls">
            <p className="sb-title">The workload</p>
            {WORKLOAD.map((inp) => (
              <div className="ctl" key={inp.id}>
                <div className="ctl-top">
                  <span className="ctl-label">{inp.label}</span>
                  <span className="ctl-val">{inp.fmt(v[inp.id])}</span>
                </div>
                <Slider inp={inp} value={v[inp.id]} set={set(inp.id)} />
                <div className="ctl-hint">{inp.hint}</div>
              </div>
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
                  <span className="src-a">assumed</span>. Change any of them and every ceiling above
                  moves.
                </p>
                {HW.map((inp) => (
                  <div className="ctl" key={inp.id}>
                    <div className="ctl-top">
                      <span className="ctl-label">
                        {inp.label}{' '}
                        <span className={inp.src === 'napkin' ? 'src-n' : 'src-a'}>
                          {inp.src === 'napkin' ? 'measured' : 'assumed'}
                        </span>
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
                <div className="v">{fmt.compact(peakWrites)}/s</div>
                <div className="u">{fmt.n1(writeUtil * 100)}% of ceiling</div>
              </div>
              <div className="tile">
                <div className="k">Write ceiling</div>
                <div className="v">{fmt.compact(writeCeiling)}/s</div>
                <div className="u">{v.group} ÷ {v.fsync} µs</div>
              </div>
              <div className="tile">
                <div className="k">Time to that wall</div>
                <div className="v">{monthsToWall === 0 ? 'now' : isFinite(monthsToWall) ? Math.round(monthsToWall) + ' mo' : '∞'}</div>
                <div className="u">at {v.growth}%/mo</div>
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

      <div className="note">
        <b>Where these numbers come from.</b> The hardware constants are measured, not folklore —{' '}
        <a href="https://github.com/sirupsen/napkin-math" target="_blank" rel="noreferrer">
          sirupsen/napkin-math
        </a>{' '}
        (MIT), last measured March 2026 on a 24-core Xeon with local SSD. The rest is arithmetic:
        Little’s Law sizes the app tier, and every ceiling divides a constant by the work one
        operation costs. What is <em>not</em> measured are the modelling choices marked{' '}
        <span className="src-a">assumed</span> — group commit size, write amplification, cache op
        cost. Those depend on your rows, indexes and access pattern, so treat the output as an
        order-of-magnitude starting point and then measure your own system. A calculator is for
        knowing which wall you are walking towards, not for sizing a purchase order.
      </div>
    </section>
  )
}
