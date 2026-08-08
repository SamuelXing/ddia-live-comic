import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fmt } from './format'

/* ============================================================
   Back-of-envelope sizing, the way a system design interview runs it:
   start from the product numbers you are *given* (users, actions,
   payload), derive the engineering numbers, then say which components
   the math forces you to add — and link to the idea and the machine.
   ============================================================ */

interface Inp {
  id: string
  label: string
  min: number
  max: number
  step: number
  val: number
  /** slider moves in log space — DAU and payload span many orders of magnitude */
  log?: boolean
  fmt: (v: number) => string
  hint: string
}

const INPUTS: Inp[] = [
  { id: 'dau', label: 'Daily active users', min: 1e4, max: 5e8, step: 1, val: 1e7, log: true, fmt: (v) => fmt.compact(v), hint: 'The number the interviewer usually opens with.' },
  { id: 'actions', label: 'Actions / user / day', min: 1, max: 200, step: 1, val: 20, fmt: (v) => fmt.int(v) + '/day', hint: 'Requests one active user makes in a day.' },
  { id: 'peak', label: 'Peak factor', min: 1, max: 10, step: 0.5, val: 3, fmt: (v) => '×' + fmt.n1(v), hint: 'Busiest moment vs the daily average. 2–5× is typical.' },
  { id: 'readPct', label: 'Read share', min: 0, max: 100, step: 1, val: 85, fmt: (v) => v + '% reads', hint: 'Reads cache and replicate. Writes are the wall.' },
  { id: 'payload', label: 'Avg object / response size', min: 1, max: 1e4, step: 1, val: 40, log: true, fmt: (v) => fmt.bytes(v * 1024), hint: 'Drives bandwidth, storage and CDN cost.' },
  { id: 'lat', label: 'Avg request latency', min: 5, max: 1000, step: 5, val: 120, fmt: (v) => v + ' ms', hint: "Sizes the web tier via Little's Law." },
  { id: 'retention', label: 'Data retention', min: 1, max: 60, step: 1, val: 12, fmt: (v) => v + ' mo', hint: 'How long writes are kept — sets total storage.' },
  { id: 'growth', label: 'Monthly growth', min: 0, max: 50, step: 1, val: 8, fmt: (v) => v + '%/mo', hint: 'Compounded, for the runway estimate.' },
]

/** one tuned primary, ordinary rows — the number that forces sharding */
const PG_WRITE_CEILING = 10000
/** a read that misses cache still costs a query; one primary+replicas serves roughly this */
const PG_READ_CEILING = 20000
/** where origin bandwidth stops being free and a CDN pays for itself */
const CDN_GBPS = 1
/** reads per second past which you stop hitting the database directly */
const CACHE_TRIGGER = 2000
/** assumed hit ratio once a cache is in front */
const ASSUMED_HIT = 0.8

interface Rec {
  need: boolean
  what: string
  because: string
  number: string
  to: { label: string; href: string }[]
}

function slider(inp: Inp, value: number, set: (n: number) => void) {
  const isLog = !!inp.log
  const lo = isLog ? Math.log10(inp.min) : inp.min
  const hi = isLog ? Math.log10(inp.max) : inp.max
  const pos = isLog ? ((Math.log10(value) - lo) / (hi - lo)) * 1000 : value
  return (
    <input
      type="range"
      min={isLog ? 0 : inp.min}
      max={isLog ? 1000 : inp.max}
      step={isLog ? 1 : inp.step}
      value={pos}
      onChange={(e) => {
        const raw = parseFloat(e.target.value)
        set(isLog ? Math.round(Math.pow(10, lo + (raw / 1000) * (hi - lo))) : raw)
      }}
    />
  )
}

export default function Calculator() {
  const [v, setV] = useState<Record<string, number>>(() => {
    const d: Record<string, number> = {}
    INPUTS.forEach((i) => (d[i.id] = i.val))
    return d
  })

  // ---- derive the engineering numbers from the product numbers ----
  const actionsPerDay = v.dau * v.actions
  const avgQps = actionsPerDay / 86400
  const peakQps = avgQps * v.peak
  const peakReads = (peakQps * v.readPct) / 100
  const peakWrites = peakQps - peakReads
  const writesPerDay = actionsPerDay * (1 - v.readPct / 100)
  const bytesPerWrite = v.payload * 1024
  const storagePerDay = writesPerDay * bytesPerWrite
  const storageTotal = storagePerDay * 30 * v.retention
  const egressGbps = (peakReads * bytesPerWrite * 8) / 1e9
  const webInstances = Math.max(1, Math.ceil((peakQps * (v.lat / 1000)) / 64))
  const dbReadsNoCache = peakReads
  const dbReadsCached = peakReads * (1 - ASSUMED_HIT)

  // ---- what the math forces you to add ----
  const recs: Rec[] = [
    {
      need: egressGbps > CDN_GBPS,
      what: 'A CDN in front of the object store',
      because: `serving ${fmt.n1(egressGbps)} Gbps from your origin is bandwidth you pay for twice — once in egress, once in latency for far-away users`,
      number: `${fmt.n1(egressGbps)} Gbps peak egress vs ~${CDN_GBPS} Gbps`,
      to: [{ label: 'S3 / object storage', href: '/components/s3' }],
    },
    {
      need: dbReadsNoCache > CACHE_TRIGGER,
      what: 'A cache in front of the database',
      because: `${fmt.compact(dbReadsNoCache)} reads/s would otherwise land on the database; a cache absorbs most of them, at the price of serving slightly stale data`,
      number: `${fmt.compact(dbReadsNoCache)} reads/s vs ~${fmt.compact(CACHE_TRIGGER)}`,
      to: [
        { label: 'Redis deep-dive', href: '/components/redis' },
        { label: 'Idea: replication lag', href: '/read/replication-lag' },
      ],
    },
    {
      need: dbReadsCached > PG_READ_CEILING,
      what: 'Read replicas',
      because: `even after the cache, ~${fmt.compact(dbReadsCached)} reads/s reach the database — more than one machine should serve, and reads are the easy thing to spread`,
      number: `${fmt.compact(dbReadsCached)} reads/s vs ~${fmt.compact(PG_READ_CEILING)} per node`,
      to: [
        { label: 'Idea: leader & followers', href: '/read/replication-leader' },
        { label: 'Postgres deep-dive', href: '/components/postgres' },
      ],
    },
    {
      need: peakWrites > PG_WRITE_CEILING,
      what: 'Shard the write path',
      because: `writes cannot be spread by adding replicas — every replica replays every write, so past one primary the only move is to split the data`,
      number: `${fmt.compact(peakWrites)} writes/s vs ~${fmt.compact(PG_WRITE_CEILING)} on one primary`,
      to: [
        { label: 'Idea: consistent hashing', href: '/read/partitioning' },
        { label: 'Postgres deep-dive', href: '/components/postgres' },
      ],
    },
    {
      need: peakWrites > 1000 && v.peak >= 2,
      what: 'A log / queue in front of the writes',
      because: `a ×${fmt.n1(v.peak)} spike means the write path sees ${fmt.compact(peakWrites)}/s at the worst moment; a durable log absorbs the burst and lets consumers work at their own pace`,
      number: `${fmt.compact(peakWrites)} writes/s at peak, ×${fmt.n1(v.peak)} above average`,
      to: [{ label: 'Kafka deep-dive', href: '/components/kafka' }],
    },
  ]
  const needed = recs.filter((r) => r.need)
  const notYet = recs.filter((r) => !r.need)

  // ---- runway: when do writes hit the single-primary ceiling? ----
  const g = v.growth / 100
  const monthsToWall =
    peakWrites >= PG_WRITE_CEILING
      ? 0
      : g > 0
        ? Math.log(PG_WRITE_CEILING / Math.max(1, peakWrites)) / Math.log(1 + g)
        : Infinity

  const derived: [string, string, string][] = [
    ['Requests', `${fmt.compact(avgQps)}/s avg · ${fmt.compact(peakQps)}/s peak`, `${fmt.compact(actionsPerDay)} actions/day ÷ 86,400 × ${fmt.n1(v.peak)}`],
    ['Split at peak', `${fmt.compact(peakReads)}/s reads · ${fmt.compact(peakWrites)}/s writes`, `${v.readPct}% reads`],
    ['New data', `${fmt.bytes(storagePerDay)}/day`, `${fmt.compact(writesPerDay)} writes/day × ${fmt.bytes(bytesPerWrite)}`],
    ['Stored at retention', fmt.bytes(storageTotal), `${v.retention} months, before replication`],
    ['Peak egress', `${fmt.n1(egressGbps)} Gbps`, `${fmt.compact(peakReads)} reads/s × ${fmt.bytes(bytesPerWrite)}`],
    ['Web tier', `~${fmt.int(webInstances)} instances`, `Little's Law: ${fmt.compact(peakQps)}/s × ${v.lat}ms ÷ 64 slots`],
  ]

  return (
    <section>
      <p className="h-kicker">Back-of-envelope sizing</p>
      <h1 className="title">What does this system actually need?</h1>
      <p className="lede">
        Start where an interview starts — <b>users, actions, payload</b> — and the arithmetic tells
        you the rest: the request rate, the storage, the bandwidth, and then{' '}
        <b>which components the numbers force you to add, and why</b>. Every recommendation links to
        the idea behind it and the machine that implements it.
      </p>

      <div className="card" style={{ padding: 0 }}>
        <div className="sandbox">
          <div className="sb-controls">
            <p className="sb-title">What you know</p>
            {INPUTS.map((inp) => (
              <div className="ctl" key={inp.id}>
                <div className="ctl-top">
                  <span className="ctl-label">{inp.label}</span>
                  <span className="ctl-val">{inp.fmt(v[inp.id])}</span>
                </div>
                {slider(inp, v[inp.id], (n) => setV((s) => ({ ...s, [inp.id]: n })))}
                <div className="ctl-hint">{inp.hint}</div>
              </div>
            ))}
          </div>

          <div className="sb-out">
            <p className="sb-title">So the system is</p>
            <table className="tbl">
              <tbody>
                {derived.map((r) => (
                  <tr key={r[0]}>
                    <td>{r[0]}</td>
                    <td>{r[1]}</td>
                    <td style={{ color: 'var(--muted)', fontSize: '12.5px' }}>{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="sb-title">What you need, and why</p>
            {needed.length === 0 && (
              <div className="verdict v-good">
                <span className="vi">✓</span>
                <span>
                  <b>One machine still does this.</b> At this load nothing above forces a cache, a
                  replica, a shard or a queue. The honest interview answer is to say so — and to name
                  the number that would change your mind.
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
                <div className="k">Writes today</div>
                <div className="v">{fmt.compact(peakWrites)}/s</div>
                <div className="u">at peak</div>
              </div>
              <div className="tile">
                <div className="k">Single-primary ceiling</div>
                <div className="v">{fmt.compact(PG_WRITE_CEILING)}/s</div>
                <div className="u">then you shard</div>
              </div>
              <div className="tile">
                <div className="k">Time to that wall</div>
                <div className="v">
                  {monthsToWall === 0 ? 'now' : isFinite(monthsToWall) ? Math.round(monthsToWall) + ' mo' : '∞'}
                </div>
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
        <b>How to use this in an interview:</b> say the numbers out loud in this order — users →
        requests/s → storage → bandwidth — then add components only when a number forces one, and
        name the number. &ldquo;I&apos;d add a cache here, because {fmt.compact(dbReadsNoCache)}{' '}
        reads/s against the database is too many&rdquo; is a much better answer than listing
        technologies. The thresholds here are deliberately round order-of-magnitude figures, not
        benchmarks; real ceilings depend on your rows, indexes and hardware.
      </div>
    </section>
  )
}
