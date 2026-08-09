import type { ComputeResult, InputDef, Values } from '../types'
import { fmt } from '../format'
import { LAD } from '../ladder'

/* The scale-out sandbox: partitions × consumers × throughput.
   (Same model as the original messaging deep-dive, now chapter 5
   of the flagship page.) */

export const scaleOutInputs: InputDef[] = [
  { id: 'rate', label: 'Message rate', steps: LAD.rate, val: 5e5, hint: 'Peak messages produced per second across the topic.', fmt: (v) => fmt.compact(v) + '/s' },
  { id: 'size', label: 'Avg message size', steps: LAD.kb, val: 5, hint: 'Bigger messages mean throughput, not message-count, becomes the limit.', fmt: (v) => v + ' KB' },
  { id: 'parts', label: 'Partitions', steps: LAD.many, val: 50, hint: 'The master knob: caps consumer parallelism AND spreads throughput.', fmt: (v) => fmt.int(v) },
  { id: 'cons', label: 'Consumer instances (1 group)', steps: LAD.many, val: 20, hint: 'Workers pulling from the topic. Beyond partition count they idle.', fmt: (v) => fmt.int(v) },
  { id: 'perCons', label: 'Throughput / consumer', steps: LAD.rateSm, val: 2e4, hint: 'How fast one consumer processes (bounded by your handler, not Kafka).', fmt: (v) => fmt.compact(v) + '/s' },
]

export function computeScaleOut(v: Values): ComputeResult {
  const ingestMBs = (v.rate * v.size) / 1024
  const perPartMBs = ingestMBs / v.parts
  const active = Math.min(v.cons, v.parts)
  const idle = Math.max(0, v.cons - v.parts)
  const capacity = active * v.perCons
  const lag = v.rate - capacity
  const PP_CEIL = 10
  const ppPct = (perPartMBs / PP_CEIL) * 100
  const consPct = (v.rate / Math.max(1, capacity)) * 100

  const meters = [
    {
      label: 'Consume vs produce',
      valTxt: lag <= 0 ? 'keeps up' : 'falling behind',
      pct: consPct,
      detail: `Produce ${fmt.compact(v.rate)}/s vs consume ${fmt.compact(capacity)}/s (${active} active × ${fmt.compact(v.perCons)}). ${lag > 0 ? 'Backlog growing ' + fmt.compact(lag) + '/s.' : 'Draining fine.'}`,
    },
    {
      label: 'Per-partition throughput',
      valTxt: fmt.sig(perPartMBs) + ' MB/s',
      pct: ppPct,
      detail: `${fmt.mbs(ingestMBs)} ÷ ${v.parts} partitions. The ~${PP_CEIL} MB/s guideline is an operational one, not a disk limit — a partition is a sequential append and the disk streams ~3 GB/s. What gets slow past it is recovery: a fat partition takes proportionally longer to re-replicate onto a replacement broker.`,
    },
    {
      label: 'Consumer parallelism used',
      valTxt: active + ' / ' + v.parts + ' partitions',
      pct: (active / v.parts) * 100,
      detail:
        idle > 0
          ? `${idle} consumer${idle > 1 ? 's' : ''} sitting idle — more consumers than partitions means they get no work.`
          : `Every partition has a consumer. To add parallelism you must add partitions.`,
    },
  ]

  let verdict: ComputeResult['verdict']
  if (lag > 0)
    verdict = { s: 'crit', t: `<b>Consumers can't keep up.</b> Backlog grows ${fmt.compact(lag)} msg/s and end-to-end lag climbs without bound. Add consumers <em>and</em> partitions together (consumers alone stop helping at ${v.parts}), or make each handler faster.` }
  else if (idle > 0)
    verdict = { s: 'warn', t: `<b>Wasted consumers.</b> ${idle} consumer${idle > 1 ? 's are' : ' is'} idle because there are only ${v.parts} partitions. Raise partition count (ideally at topic creation) to unlock the parallelism you're paying for.` }
  else if (ppPct >= 100)
    verdict = { s: 'warn', t: `<b>Hot partitions.</b> At ${fmt.sig(perPartMBs)} MB/s each, individual partitions are heavy. The disk can stream it — what suffers is recovery and rebalance time, since a replacement broker must re-copy the whole partition before it can join.` }
  else
    verdict = { s: 'good', t: `<b>Balanced.</b> Consumers keep up, no idle workers, partitions aren't hot. Remember every partition also costs file handles, memory, and rebalance time.` }

  return {
    tiles: [
      { k: 'Ingest throughput', v: ingestMBs >= 1000 ? fmt.sig(ingestMBs / 1000) : fmt.sig(ingestMBs), u: ingestMBs >= 1000 ? 'GB/s' : 'MB/s' },
      { k: 'Max consumer parallelism', v: fmt.int(v.parts), u: '= partition count' },
      { k: 'Active / idle consumers', v: active + ' / ' + idle, u: 'working / wasted' },
      { k: 'Backlog growth', v: lag > 0 ? '+' + fmt.compact(lag) : '0', u: 'msg/s' },
    ],
    meters,
    verdict,
  }
}
