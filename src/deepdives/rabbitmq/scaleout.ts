import type { ComputeResult, InputDef, Values } from '../types'
import { fmt } from '../format'

/* The scale-out sandbox: the two ceilings that matter — the queue's
   one-core limit (sharding fixes it) and the consumer fleet's
   processing rate (scaling consumers fixes it) — plus the backlog
   that grows whenever either is exceeded. */

export const scaleOutInputs: InputDef[] = [
  { id: 'rate', label: 'Publish rate', min: 1000, max: 2000000, step: 1000, val: 120000, hint: 'Peak messages published per second across the workload.', fmt: (v) => fmt.compact(v) + '/s' },
  { id: 'queues', label: 'Queues (sharded)', min: 1, max: 512, step: 1, val: 8, hint: 'The scaling unit. Each queue is one process on one core.', fmt: (v) => fmt.int(v) },
  { id: 'ceil', label: 'Per-queue ceiling', min: 1000, max: 80000, step: 1000, val: 35000, hint: 'One queue’s throughput — high transient, much lower for quorum.', fmt: (v) => fmt.compact(v) + '/s' },
  { id: 'cons', label: 'Consumers (total)', min: 1, max: 2000, step: 1, val: 48, hint: 'The processing fleet, spread across queues.', fmt: (v) => fmt.int(v) },
  { id: 'proc', label: 'Handler time / msg', min: 1, max: 500, step: 1, val: 5, hint: 'What one consumer spends per message — usually the real limit.', fmt: (v) => v + ' ms' },
  { id: 'backlog', label: 'Current backlog', min: 0, max: 20000000, step: 10000, val: 0, hint: 'Messages already sitting in queues, waiting.', fmt: (v) => fmt.compact(v) },
]

const MEM_ALARM_MSGS = 8_000_000 // rough "watermark at typical sizes" line

export function computeScaleOut(v: Values): ComputeResult {
  const perQueue = v.rate / v.queues
  const pqPct = (perQueue / v.ceil) * 100
  const brokerCap = v.queues * v.ceil
  const fleetCap = v.cons * (1000 / v.proc)
  const sysCap = Math.min(brokerCap, fleetCap)
  const lag = v.rate - sysCap
  const fleetPct = (v.rate / fleetCap) * 100
  const memPct = (v.backlog / MEM_ALARM_MSGS) * 100
  const consNeeded = Math.ceil((v.rate * v.proc) / 1000)
  const drainMin = lag < 0 && v.backlog > 0 ? v.backlog / (-lag * 60) : null

  const meters = [
    {
      label: 'Hottest queue vs its one core',
      valTxt: fmt.compact(perQueue) + '/s',
      pct: pqPct,
      detail: `${fmt.compact(v.rate)}/s ÷ ${v.queues} queues vs a ~${fmt.compact(v.ceil)}/s single-process ceiling. Consumers can't raise this line — only more queues can.`,
    },
    {
      label: 'Consumer fleet vs publish rate',
      valTxt: fmt.compact(fleetCap) + '/s capacity',
      pct: fleetPct,
      detail: `${v.cons} consumers × ${Math.round(1000 / v.proc)} msg/s each (at ${v.proc} ms/msg). ${lag > 0 && fleetCap < brokerCap ? 'Backlog grows ' + fmt.compact(lag) + '/s.' : 'Keeping up.'}`,
    },
    {
      label: 'Backlog vs the watermark',
      valTxt: fmt.compact(v.backlog) + ' msgs',
      pct: memPct,
      detail:
        memPct >= 100
          ? 'Deep enough to threaten the memory alarm — the cluster-wide publish freeze from the anatomy trace.'
          : drainMin !== null
            ? `Draining: ~${drainMin < 1 ? '<1' : fmt.int(drainMin)} min to empty at current spare capacity.`
            : 'Queues near-empty is the design point — RabbitMQ is a conveyor, not a warehouse.',
    },
  ]

  let verdict: ComputeResult['verdict']
  if (pqPct >= 100)
    verdict = { s: 'crit', t: `<b>The queue is the bottleneck, not the consumers.</b> Each queue is asked for ${fmt.compact(perQueue)}/s against a one-process ceiling of ~${fmt.compact(v.ceil)}/s. Piling on consumers changes nothing — <b>shard into more queues</b> (consistent-hash exchange) and spread them across nodes.` }
  else if (fleetPct >= 100)
    verdict = { s: 'crit', t: `<b>The fleet can't keep up.</b> ${fmt.compact(v.rate)}/s in vs ${fmt.compact(fleetCap)}/s of processing: backlog grows ${fmt.compact(lag)}/s, and the Chapter 6 cascade is now a countdown. You need ~${fmt.int(consNeeded)} consumers at ${v.proc} ms/msg — or a faster handler, which is usually the cheaper fix.` }
  else if (memPct >= 100)
    verdict = { s: 'crit', t: `<b>Backlog in the danger zone.</b> Capacity is fine now, but ${fmt.compact(v.backlog)} standing messages put this broker near the watermark. Drain deliberately (temporary consumers, shovel to spillover) before the alarm drains it for you — by freezing every publisher.` }
  else if (pqPct >= 75 || fleetPct >= 75)
    verdict = { s: 'warn', t: `<b>${pqPct >= 75 ? 'A queue is nearing its one-core ceiling' : 'The consumer fleet is nearly saturated'}</b> (${Math.round(Math.max(pqPct, fleetPct))}%). One traffic spike from backlog growth — ${pqPct >= 75 ? 'pre-shard the hot queue now; resharding calmly beats resharding during the cascade' : 'add consumers or shave handler latency before the spike chooses the timing for you'}.` }
  else
    verdict = { s: 'good', t: `<b>Balanced.</b> Queues under their ceilings, the fleet keeps up (${fmt.compact(fleetCap)}/s vs ${fmt.compact(v.rate)}/s), backlog near zero. This is RabbitMQ at its best: a fast conveyor between services, every belt moving, nothing stored.` }

  return {
    tiles: [
      { k: 'System capacity', v: fmt.compact(sysCap), u: sysCap === brokerCap ? 'msg/s — queues bind first' : 'msg/s — fleet binds first' },
      { k: 'Consumers needed', v: fmt.int(consNeeded) + ' / ' + fmt.int(v.cons), u: 'needed / have' },
      { k: 'Hottest queue', v: Math.round(pqPct) + '%', u: 'of its one core' },
      { k: 'Backlog growth', v: lag > 0 ? '+' + fmt.compact(lag) : '0', u: 'msg/s' },
    ],
    meters,
    verdict,
  }
}
