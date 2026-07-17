import { useState } from 'react'
import type { InputDef, Values } from './types'
import { fmt } from './format'

const INPUTS: InputDef[] = [
  { id: 'rps', label: 'Peak requests / sec', min: 100, max: 500000, step: 100, val: 20000, fmt: (v) => fmt.compact(v) + '/s', hint: 'Busiest-moment traffic.' },
  { id: 'payload', label: 'Avg response payload', min: 1, max: 5000, step: 1, val: 40, fmt: (v) => fmt.bytes(v * 1024), hint: 'Drives S3/CDN bandwidth & cost.' },
  { id: 'readPct', label: 'Read share', min: 0, max: 100, step: 1, val: 85, fmt: (v) => v + '% reads', hint: 'Reads cache & replicate well; writes are the wall.' },
  { id: 'lat', label: 'Avg request latency', min: 5, max: 2000, step: 5, val: 150, fmt: (v) => v + ' ms', hint: "For Little's-Law web sizing." },
  { id: 'cacheHit', label: 'Cache hit ratio', min: 0, max: 99, step: 1, val: 80, fmt: (v) => v + '%', hint: 'Share of reads served by Redis, not the DB.' },
  { id: 'dbQ', label: 'DB queries / request', min: 0, max: 20, step: 1, val: 2, fmt: (v) => fmt.int(v), hint: 'Uncached DB round-trips per request.' },
  { id: 'msgs', label: 'Events / request', min: 0, max: 20, step: 1, val: 1, fmt: (v) => fmt.int(v), hint: 'Messages published to Kafka/RMQ per request.' },
  { id: 'growth', label: 'Monthly growth', min: 0, max: 50, step: 1, val: 12, fmt: (v) => v + '%/mo', hint: 'Compounded for the 12-month projection.' },
]

interface Signal {
  sev: number
  t: string
}

export default function Calculator() {
  const [values, setValues] = useState<Values>(() => {
    const d: Values = {}
    INPUTS.forEach((i) => (d[i.id] = i.val))
    return d
  })
  const v = values

  const reads = (v.rps * v.readPct) / 100
  const writes = v.rps - reads
  // WEB
  const latS = v.lat / 1000
  const workers = 64
  const capPerInst = workers / latS
  const webInst = Math.max(1, Math.ceil(v.rps / capPerInst))
  // REDIS: every read tries cache first
  const redisOpsAll = reads
  const redisShards = Math.max(1, Math.ceil(redisOpsAll / 120000))
  // POSTGRES
  const cacheMiss = reads * (1 - v.cacheHit / 100)
  const dbReadQ = cacheMiss * v.dbQ
  const dbWriteTPS = writes * Math.max(1, v.dbQ)
  const pgWriteCeil = 25000
  const pgShards = Math.max(1, Math.ceil(dbWriteTPS / pgWriteCeil))
  const poolConns = webInst * 20
  const readReplicas = Math.max(0, Math.ceil(dbReadQ / 40000) - 1)
  // MESSAGING
  const msgRate = v.rps * v.msgs
  const kafkaParts = Math.max(1, Math.ceil(msgRate / 20000))
  // S3 / CDN
  const bwMBs = (reads * v.payload) / 1024
  const s3Prefixes = Math.max(1, Math.ceil(reads / 5500))

  const signals: Signal[] = []
  if (pgShards > 1)
    signals.push({ sev: 3, t: `<b>Postgres writes</b> — ${fmt.compact(dbWriteTPS)} write-TPS exceeds one primary (~${fmt.compact(pgWriteCeil)}), forcing ~${pgShards} shards. This is your deepest constraint; everything else is easier.` })
  if (redisShards > 1)
    signals.push({ sev: 2, t: `<b>Redis throughput</b> — ${fmt.compact(redisOpsAll)} cache ops/s needs ~${redisShards} Cluster shards (one core each).` })
  if (poolConns > 400)
    signals.push({ sev: 2, t: `<b>DB connections</b> — ${webInst} web instances × 20 = ${fmt.int(poolConns)} connections; you need PgBouncer in front of Postgres.` })
  if (kafkaParts > 200)
    signals.push({ sev: 2, t: `<b>Kafka partitions</b> — ~${fmt.int(kafkaParts)} partitions to keep up; watch rebalance cost and broker count.` })
  if (s3Prefixes > 50)
    signals.push({ sev: 1, t: `<b>S3 prefixes</b> — spread keys across ~${fmt.int(s3Prefixes)} prefixes to avoid throttling; front hot objects with a CDN.` })
  if (!signals.length)
    signals.push({ sev: 0, t: `<b>No hard wall yet</b> — at this load every tier scales with standard moves. The first tier to watch as you grow is almost always <b>Postgres writes</b>.` })
  signals.sort((a, b) => b.sev - a.sev)
  const top = signals[0]
  const sevClass = top.sev >= 3 ? 'crit' : top.sev >= 1 ? 'warn' : 'good'

  const g = v.growth / 100
  const rps12 = v.rps * Math.pow(1 + g, 12)
  const write12 = writes * Math.pow(1 + g, 12) * Math.max(1, v.dbQ)
  const monthsToWall =
    g > 0 ? Math.log(pgWriteCeil / Math.max(1, dbWriteTPS)) / Math.log(1 + g) : Infinity

  const rows: [string, string, string][] = [
    ['🖥️ Web tier', `${fmt.int(webInst)} instances`, `Little's Law: ${fmt.compact(v.rps)}/s × ${v.lat}ms`],
    ['📨 Messaging', `${fmt.compact(msgRate)}/s → ~${fmt.int(kafkaParts)} partitions`, `${v.msgs} event(s)/request`],
    ['⚡ Redis', `${fmt.int(redisShards)} shard(s), serves ${fmt.compact(redisOpsAll)} ops/s`, `${v.cacheHit}% hit ratio on reads`],
    ['🐘 Postgres', `${fmt.compact(dbWriteTPS)} write-TPS · ${fmt.int(pgShards)} shard(s) · ${fmt.int(readReplicas)} replica(s)`, `writes + ${fmt.compact(cacheMiss)}/s cache misses`],
    ['🔌 Connections', `${fmt.int(poolConns)} → ${poolConns > 400 ? 'pooler required' : 'direct ok'}`, `${webInst} instances × 20 pool`],
    ['🪣 S3 / CDN', `${fmt.n1(bwMBs)} MB/s · ~${fmt.int(s3Prefixes)} prefix(es)`, `${fmt.compact(reads)} reads/s × ${fmt.bytes(v.payload * 1024)}`],
  ]

  const proj = [
    { k: 'Traffic in 12 mo', v: fmt.compact(rps12), u: 'req/s (from ' + fmt.compact(v.rps) + ')' },
    { k: 'Write-TPS in 12 mo', v: fmt.compact(write12), u: 'vs ~' + fmt.compact(pgWriteCeil) + ' / primary' },
    { k: 'Time to write wall', v: isFinite(monthsToWall) ? (monthsToWall <= 0 ? 'now' : Math.round(monthsToWall) + ' mo') : '∞', u: 'until sharding' },
    { k: 'Growth factor (12mo)', v: '×' + fmt.n1(Math.pow(1 + g, 12)), u: 'compounded' },
  ]

  return (
    <section>
      <p className="h-kicker">🧮 &nbsp;End-to-end sizing</p>
      <h1 className="title">Capacity calculator</h1>
      <p className="lede">
        Describe your workload once, and see how <b>every tier</b> sizes up together — plus the{' '}
        <b>first bottleneck</b> you&apos;ll hit and a 12-month growth projection. This chains the
        same models from each deep-dive, so the web tier&apos;s connection fan-out feeds the
        Postgres row, and so on.
      </p>

      <div className="card" style={{ padding: 0 }}>
        <div className="sandbox">
          <div className="sb-controls">
            <p className="sb-title">Your workload</p>
            {INPUTS.map((inp) => (
              <div className="ctl" key={inp.id}>
                <div className="ctl-top">
                  <span className="ctl-label">{inp.label}</span>
                  <span className="ctl-val">{inp.fmt(values[inp.id] ?? inp.val)}</span>
                </div>
                <input
                  type="range"
                  min={inp.min}
                  max={inp.max}
                  step={inp.step}
                  value={values[inp.id] ?? inp.val}
                  onChange={(e) =>
                    setValues((s) => ({ ...s, [inp.id]: parseFloat(e.target.value) }))
                  }
                />
                <div className="ctl-hint">{inp.hint}</div>
              </div>
            ))}
          </div>
          <div className="sb-out">
            <p className="sb-title">How each tier sizes up</p>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>Sizing at peak</th>
                  <th>Driver</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r[0]}>
                    <td>{r[0]}</td>
                    <td>{r[1]}</td>
                    <td style={{ color: 'var(--muted)', fontSize: '12.5px' }}>{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="sb-title">First bottleneck</p>
            <div className={`verdict v-${sevClass}`}>
              <span className="vi">{top.sev >= 3 ? '✕' : top.sev >= 1 ? '▲' : '✓'}</span>
              <span dangerouslySetInnerHTML={{ __html: top.t }} />
            </div>
            {signals.length > 1 && (
              <div style={{ marginTop: 10 }}>
                {signals.slice(1).map((s, i) => (
                  <div
                    className="meter-detail"
                    key={i}
                    dangerouslySetInnerHTML={{ __html: '• ' + s.t }}
                  />
                ))}
              </div>
            )}

            <p className="sb-title">12-month projection at {v.growth}%/mo</p>
            <div className="tiles">
              {proj.map((t) => (
                <div className="tile" key={t.k}>
                  <div className="k">{t.k}</div>
                  <div className="v">{t.v}</div>
                  <div className="u">{t.u}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="note">
        <b>How to read this:</b> the calculator chains the per-tier models. Reads are absorbed by
        the cache (hit ratio); only cache <em>misses</em> and all writes reach Postgres; writes are
        what force sharding because they can&apos;t spread across replicas. That&apos;s why, for
        almost every real workload, <b>the write path of your database is the tier that decides
        your ceiling</b> — plan it first.
      </div>
    </section>
  )
}
