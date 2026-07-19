import type { ComputeResult, InputDef, Values } from '../types'
import { fmt } from '../format'

/* The scale-out sandbox: the read/write asymmetry, made tactile.
   Reads spread across replicas near-linearly; every write still
   lands on the one primary; connections multiply with the fleet. */

const POOL_BACKENDS = 64 // what a PgBouncer tier funnels down to
const DIRECT_CEIL = 500 // direct backends before the primary drowns

export const scaleOutInputs: InputDef[] = [
  { id: 'reads', label: 'Read QPS', min: 1000, max: 500000, step: 1000, val: 60000, hint: 'Read traffic — the direction that scales out.', fmt: (v) => fmt.compact(v) + '/s' },
  { id: 'writes', label: 'Write TPS', min: 100, max: 150000, step: 100, val: 9000, hint: 'Write traffic — the direction that does not.', fmt: (v) => fmt.compact(v) + '/s' },
  { id: 'wceil', label: 'Primary write ceiling', min: 5000, max: 100000, step: 1000, val: 30000, hint: 'What one tuned primary sustains — hardware, schema, and index count set this.', fmt: (v) => fmt.compact(v) + '/s' },
  { id: 'replicas', label: 'Read replicas', min: 0, max: 16, step: 1, val: 2, hint: 'Each replays the full WAL and serves reads ms behind.', fmt: (v) => fmt.int(v) },
  { id: 'rcap', label: 'Read QPS per replica', min: 5000, max: 100000, step: 1000, val: 25000, hint: 'One replica’s read capacity (its own RAM/CPU envelope).', fmt: (v) => fmt.compact(v) + '/s' },
  { id: 'conns', label: 'App connections', min: 100, max: 20000, step: 100, val: 2400, hint: 'App instances × per-pod pool size — the web tier’s fan-out.', fmt: (v) => fmt.int(v) },
]

export function computeScaleOut(v: Values): ComputeResult {
  const writePct = (v.writes / v.wceil) * 100
  const primarySpare = Math.max(0, 1 - v.writes / v.wceil)
  const primaryReadCap = v.rcap * primarySpare
  const readCap = v.replicas * v.rcap + primaryReadCap
  const readPct = (v.reads / Math.max(1, readCap)) * 100
  const connPct = (v.conns / DIRECT_CEIL) * 100
  const poolRatio = Math.max(1, Math.round(v.conns / POOL_BACKENDS))
  const shards = Math.ceil(v.writes / v.wceil)
  const replicasNeeded = Math.ceil(Math.max(0, v.reads - primaryReadCap) / v.rcap)

  const meters = [
    {
      label: 'Primary write utilization',
      valTxt: Math.round(writePct) + '%',
      pct: writePct,
      detail: `${fmt.compact(v.writes)}/s of a ~${fmt.compact(v.wceil)}/s ceiling. Replicas carry zero of this — every write is WAL on the one primary.`,
    },
    {
      label: 'Read capacity',
      valTxt: fmt.compact(v.reads) + ' / ' + fmt.compact(readCap) + '/s',
      pct: readPct,
      detail: `${v.replicas} replica${v.replicas !== 1 ? 's' : ''} × ${fmt.compact(v.rcap)}/s + ${fmt.compact(primaryReadCap)}/s of primary left over after writes.`,
    },
    {
      label: 'Connection fan-in (if direct)',
      valTxt: fmt.int(v.conns) + ' conns',
      pct: connPct,
      detail: `Direct, ~${DIRECT_CEIL} backends drown the primary in processes. Through PgBouncer: ${fmt.int(v.conns)} app conns → ~${POOL_BACKENDS} real backends (${poolRatio}:1).`,
    },
  ]

  let verdict: ComputeResult['verdict']
  if (writePct >= 100)
    verdict = { s: 'crit', t: `<b>The write wall.</b> ${fmt.compact(v.writes)}/s exceeds one primary — and no number of replicas helps, because every replica replays every write anyway. Your options, in order: raise the ceiling (hardware, fewer indexes, batching), partition so vacuum and indexes shrink, then shard into ~${shards} clusters — paying with cross-shard transactions.` }
  else if (readPct >= 100)
    verdict = { s: 'crit', t: `<b>Reads over capacity — the fixable direction.</b> You need ~${fmt.int(replicasNeeded)} replicas for this read load (have ${fmt.int(v.replicas)}). Adding replicas is routine: each new one replays the WAL and takes a share. Just keep the app lag-literate — read-your-writes must route to the primary.` }
  else if (readPct >= 85)
    verdict = { s: 'warn', t: `<b>Replicas near saturation — lag is next.</b> A busy replica replays WAL with leftover cycles; past ~85% busy, replay starts losing to queries and <b>replication lag grows</b> even though nothing is “down.” Add a replica before the lag alerts start.` }
  else if (writePct >= 75)
    verdict = { s: 'warn', t: `<b>Write headroom thinning</b> (${Math.round(100 - writePct)}% left). Partitioning and sharding are long migrations — start the design now, ship it calmly later. Teams that wait shard in a war room.` }
  else
    verdict = { s: 'good', t: `<b>Balanced.</b> Writes fit one primary with room, replicas absorb the reads, and the pooler keeps ${fmt.int(v.conns)} app connections down to ~${POOL_BACKENDS} backends. This shape — one strong primary, N replicas, PgBouncer in front — is where most successful products live for years.` }

  return {
    tiles: [
      { k: 'Write headroom', v: Math.max(0, Math.round(100 - writePct)) + '%', u: 'of one primary' },
      { k: 'Replicas needed', v: fmt.int(replicasNeeded) + ' / ' + fmt.int(v.replicas), u: 'needed / have' },
      { k: 'Pooler ratio', v: poolRatio + ':1', u: 'app conns : backends' },
      { k: 'Shards if forced', v: fmt.int(shards), u: 'independent clusters' },
    ],
    meters,
    verdict,
  }
}
