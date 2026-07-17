import type { ModuleDef, Values, ComputeResult } from '../types'
import { fmt } from '../format'

function compute(v: Values): ComputeResult {
  const POOL_WARN = 400 // comfortable ceiling for real backends
  const connPct = (v.conns / POOL_WARN) * 100
  const writePct = (v.wtps / v.wceil) * 100
  const cacheRatio = (v.ram / v.data) * 100 // % of working set cached
  const shardsForWrite = Math.ceil(v.wtps / v.wceil)

  const meters = [
    {
      label: 'Connection load',
      valTxt: fmt.int(v.conns) + ' conns',
      pct: connPct,
      detail: `Each is an OS process (~few MB + work_mem). Past ~${POOL_WARN} real backends you need PgBouncer to multiplex — otherwise memory & context-switching crush the primary.`,
    },
    {
      label: 'Write utilization (single primary)',
      valTxt: Math.round(writePct) + '%',
      pct: writePct,
      detail: `${fmt.compact(v.wtps)} TPS of a ~${fmt.compact(v.wceil)} TPS primary ceiling. Writes can't be spread across replicas — this is THE wall. Over 100% ⇒ scale up or shard.`,
    },
    {
      label: 'Working set in cache',
      valTxt: Math.min(100, Math.round(cacheRatio)) + '% cached',
      pct: 100 - Math.min(100, cacheRatio),
      invert: true,
      detail:
        cacheRatio >= 100
          ? `Working set fits in RAM — reads served from the buffer cache, fast.`
          : `Only ${Math.round(cacheRatio)}% of the ${fmt.bytes(v.data * 1e9)} working set fits in ${v.ram}GB RAM. The rest hits disk, and throughput drops sharply.`,
    },
  ]

  let verdict: ComputeResult['verdict']
  if (writePct >= 100)
    verdict = {
      s: 'crit',
      t: `<b>Write ceiling breached.</b> ${fmt.compact(v.wtps)} TPS exceeds one primary's ~${fmt.compact(v.wceil)} TPS. Replicas won't help — they only serve reads. Scale the primary up, then <b>partition</b>, then <b>shard</b> into ${shardsForWrite} clusters (losing cross-shard transactions). This is the deepest wall in the stack.`,
    }
  else if (connPct >= 100)
    verdict = {
      s: 'crit',
      t: `<b>Too many connections.</b> ${fmt.int(v.conns)} direct connections will exhaust memory and scheduler on the primary. Put <b>PgBouncer</b> in transaction mode in front — it multiplexes thousands of app connections onto a few dozen real backends. Cheapest big win available.`,
    }
  else if (cacheRatio < 100)
    verdict = {
      s: 'warn',
      t: `<b>Working set spilling to disk.</b> Only ~${Math.round(cacheRatio)}% of your hot data fits in RAM, so many queries hit disk and latency climbs. Add RAM (scale up), trim the working set with archiving, or add indexes to touch less data.`,
    }
  else if (writePct >= 75)
    verdict = {
      s: 'warn',
      t: `<b>Write headroom getting thin.</b> You're within striking distance of the single-primary ceiling. Start planning partitioning/sharding now — it's a long migration you don't want to do under fire.`,
    }
  else
    verdict = {
      s: 'good',
      t: `<b>Healthy.</b> Connections pooled, writes within primary capacity, working set cached, and ${v.replicas} replica${v.replicas !== 1 ? 's' : ''} absorbing reads. Keep autovacuum tuned and watch replication lag as read traffic grows.`,
    }

  return {
    tiles: [
      { k: 'Write utilization', v: Math.round(writePct) + '%', u: 'of single primary' },
      { k: 'Real backends', v: v.conns > POOL_WARN ? 'pooler needed' : 'ok', u: fmt.int(v.conns) + ' app conns' },
      { k: 'Working set cached', v: Math.min(100, Math.round(cacheRatio)) + '%', u: 'in buffer cache' },
      { k: 'Shards if writes grow', v: fmt.int(shardsForWrite), u: 'PG clusters' },
    ],
    meters,
    verdict,
  }
}

export const postgresModule: ModuleDef = {
  key: 'postgres',
  tab: 'Postgres',
  emoji: '🐘',
  title: 'PostgreSQL',
  kicker: 'The relational core',
  lede: `The database is where scaling stops being easy, because it holds the <b>state</b> everything else offloaded. Postgres gives you ACID transactions and one <b>single writable primary</b> — that primary is both its greatest strength (strong consistency) and its ceiling (all writes funnel through one machine). Scaling it is a strict ladder: <b>pool connections → cache → read replicas → partition → shard</b>, applied in that order because each step is more painful than the last.`,
  content: {
    intro: `<p>Postgres assigns <b>one OS process per connection</b>, each costing a few MB plus <code>work_mem</code> for sorts/joins. That makes connections expensive: a few hundred <em>active</em> ones can saturate CPU, and thousands of mostly-idle ones waste memory and scheduling. This collides head-on with a scaled-out web tier — 50 instances × a 20-connection pool = 1,000 connections — which is why a <b>connection pooler (PgBouncer)</b> in transaction mode is almost mandatory at scale: it multiplexes thousands of client connections onto a few dozen real ones.</p>
  <p><b>Reads</b> scale out well: stream the WAL to <b>read replicas</b> and send read-only queries there. The cost is <b>replication lag</b> — replicas are milliseconds-to-seconds behind, so a user may not immediately read their own write. <b>Writes are the hard wall:</b> every write goes to the one primary. You scale writes by scaling <em>up</em> (bigger box, faster disk) as far as the budget allows, then by <b>partitioning</b> one big table into many, and finally — reluctantly — by <b>sharding</b> across independent Postgres clusters, which sacrifices cross-shard transactions and joins.</p>
  <p>Two quieter ceilings: the <b>working set</b> must mostly fit in RAM (the buffer cache) or every query hits disk and throughput collapses; and <b>autovacuum</b> must keep up with dead rows from updates/deletes, or bloat and transaction-ID wraparound threaten the whole database.</p>`,
    inputs: [
      { id: 'conns', label: 'Connections from app tier', min: 10, max: 20000, step: 10, val: 1200, hint: 'Total = app instances × pool size. The fan-out from scaling web out.', fmt: (v) => fmt.int(v) },
      { id: 'wtps', label: 'Write throughput', min: 100, max: 200000, step: 100, val: 9000, hint: 'Writes/sec — all funnel through the single primary.', fmt: (v) => fmt.compact(v) + ' TPS' },
      { id: 'wceil', label: 'Primary write ceiling', min: 2000, max: 150000, step: 1000, val: 25000, hint: 'What one tuned primary sustains — depends on hardware, schema, indexes.', fmt: (v) => fmt.compact(v) + ' TPS' },
      { id: 'data', label: 'Hot dataset size', min: 1, max: 100000, step: 1, val: 900, hint: 'The working set that queries actually touch.', fmt: (v) => fmt.bytes(v * 1024 * 1024 * 1024) },
      { id: 'ram', label: 'Primary RAM (buffer cache)', min: 4, max: 2048, step: 4, val: 128, hint: "If the working set doesn't fit here, you go to disk on every query.", fmt: (v) => v + ' GB' },
      { id: 'replicas', label: 'Read replicas', min: 0, max: 32, step: 1, val: 2, hint: 'Offload reads — but they lag the primary by ms–seconds.', fmt: (v) => fmt.int(v) },
    ],
    compute,
    limits: [
      ['Connections', '1 process each', 'Few hundred active saturate CPU; thousands idle waste RAM. Pool with PgBouncer.'],
      ['Writes', '1 primary', "The fundamental ceiling. No native multi-master — writes don't spread across replicas."],
      ['Read replicas', 'Many, but lagging', 'Scale reads near-linearly; pay with ms–seconds of replication lag (stale reads).'],
      ['Working set', 'Should fit in RAM', 'Buffer-cache misses go to disk; a working set larger than RAM tanks throughput.'],
      ['Autovacuum', 'Must keep up', 'Updates/deletes leave dead tuples; if vacuum lags you get bloat and, worst case, XID wraparound.'],
      ['Sharding', 'App-level, lossy', 'Splitting across clusters scales writes but breaks cross-shard joins, transactions, and FKs.'],
    ],
    fails: [
      ['Connection storm', 'A scaled-out or restarting app fleet opens thousands of connections at once and the primary falls over. Pool + cap connections.'],
      ['Replication lag surprise', 'App reads its own write from a lagging replica and gets stale data. Route read-your-writes to the primary or use sync replicas selectively.'],
      ['Autovacuum falling behind', 'Write-heavy tables bloat, queries slow, disk fills; extreme neglect risks transaction-ID wraparound and a forced shutdown. Tune vacuum aggressiveness.'],
      ['Lock contention / long transactions', 'A long-running transaction blocks vacuum and holds locks, stalling writers. Keep transactions short; monitor for idle-in-transaction.'],
      ['Runaway query plans', 'A missing index or bad plan turns one query into a full scan that saturates I/O for everyone. Index for the working set; watch pg_stat_statements.'],
      ['The sharding cliff', "Sharding is deferred until it's an emergency, then done under pressure — losing joins/transactions. Design the shard key long before you need it."],
    ],
    ladder: [
      '<b>Pool connections</b> (PgBouncer, transaction mode) — multiplex the app fan-out onto a few dozen real backends. Cheapest, do it early.',
      '<b>Cache reads</b> in Redis/app so the DB never sees repeat work — the highest-leverage move.',
      '<b>Add read replicas</b> and route reads to them; accept and design around replication lag.',
      '<b>Scale the primary up</b> (CPU, RAM, NVMe) to buy write headroom — simple, effective, has a ceiling.',
      '<b>Partition</b> large tables (by time/tenant) so each query and vacuum touches less.',
      "<b>Shard</b> across independent clusters only when the single primary's writes are truly exhausted — the last resort, because it sacrifices cross-shard transactions.",
    ],
  },
}
