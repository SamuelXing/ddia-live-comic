import type { ComputeResult, InputDef, Values } from '../types'
import { fmt } from '../format'
import { LAD } from '../ladder'

/* The scale-out sandbox: the read/write asymmetry, made tactile.
   Reads spread across replicas near-linearly; every write still
   lands on the one primary; connections multiply with the fleet. */

const POOL_BACKENDS = 64 // what a PgBouncer tier funnels down to
const DIRECT_CEIL = 500 // direct backends before the primary drowns

export const scaleOutInputs: InputDef[] = [
  { id: 'reads', label: 'Read QPS', steps: LAD.rate, val: 5e4, hint: 'Read traffic — the direction that scales out.', fmt: (v) => fmt.compact(v) + '/s' },
  { id: 'writes', label: 'Write TPS', steps: LAD.rate, val: 1e4, hint: 'Write traffic — the direction that does not.', fmt: (v) => fmt.compact(v) + '/s' },
  { id: 'wceil', label: 'Primary write ceiling', steps: LAD.rate, val: 2e4, hint: 'What one tuned primary sustains. The calculator derives ~27k/s from 8 commits per fsync \u00f7 300 \u00b5s; group-commit batching is the assumption that moves it most.', fmt: (v) => fmt.compact(v) + '/s' },
  { id: 'replicas', label: 'Read replicas', steps: LAD.few, val: 2, hint: 'Each replays the full WAL and serves reads ms behind.', fmt: (v) => fmt.int(v) },
  { id: 'rcap', label: 'Read QPS per replica', steps: LAD.rate, val: 2e4, hint: 'One replica’s read capacity (its own RAM/CPU envelope).', fmt: (v) => fmt.compact(v) + '/s' },
  { id: 'conns', label: 'App connections', steps: LAD.conns, val: 2e3, hint: 'App instances × per-pod pool size — the web tier’s fan-out.', fmt: (v) => fmt.int(v) },
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
