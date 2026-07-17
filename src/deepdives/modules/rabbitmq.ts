import type { ModuleDef, Values, ComputeResult } from '../types'
import { fmt } from '../format'

function compute(v: Values): ComputeResult {
  const perQueue = v.rate / v.queues
  const pqPct = (perQueue / v.ceil) * 100
  const totalCap = v.queues * v.ceil
  const MEM_ALARM = 8_000_000 // "backlog too big → flow control" threshold
  const memPct = (v.backlog / MEM_ALARM) * 100
  const capPct = (v.rate / totalCap) * 100

  const meters = [
    {
      label: 'Per-queue load',
      valTxt: fmt.compact(perQueue) + '/s',
      pct: pqPct,
      detail: `${fmt.compact(v.rate)}/s ÷ ${v.queues} queues = ${fmt.compact(perQueue)}/s per queue vs ~${fmt.compact(v.ceil)}/s single-queue ceiling. A queue is one core — this is the real limit, not consumer count.`,
    },
    {
      label: 'Total broker capacity',
      valTxt: fmt.compact(totalCap) + '/s',
      pct: capPct,
      detail: `${v.queues} queues × ${fmt.compact(v.ceil)}/s. To go faster you shard into more queues across more nodes, not more consumers per queue.`,
    },
    {
      label: 'Backlog / memory pressure',
      valTxt: fmt.compact(v.backlog) + ' msgs',
      pct: memPct,
      detail:
        memPct >= 100
          ? `Backlog is large enough to trip memory flow-control — the broker throttles publishers to protect itself.`
          : `Backlog is comfortable. RabbitMQ holds messages in RAM (unless lazy/quorum), so deep backlogs are dangerous.`,
    },
  ]

  let verdict: ComputeResult['verdict']
  if (pqPct >= 100)
    verdict = {
      s: 'crit',
      t: `<b>Queue saturated.</b> Each queue is asked for ${fmt.compact(perQueue)}/s but one queue ≈ one core ≈ ${fmt.compact(v.ceil)}/s. Adding consumers won't help — <b>shard into more queues</b> (consistent-hash exchange) to spread across cores/nodes.`,
    }
  else if (memPct >= 100)
    verdict = {
      s: 'crit',
      t: `<b>Flow control engaged.</b> The backlog is large enough that RabbitMQ is throttling publishers to avoid running out of memory. Drain faster, use lazy/quorum queues that page to disk, or shed load.`,
    }
  else if (capPct >= 75)
    verdict = {
      s: 'warn',
      t: `<b>Approaching capacity.</b> You're using most of the broker's queue capacity. Add queues (and nodes) before a spike pushes a queue over its single-core ceiling.`,
    }
  else
    verdict = {
      s: 'good',
      t: `<b>Comfortable.</b> Per-queue load is well under the single-core ceiling and backlog is small. Keep queues short — RabbitMQ is happiest as a fast-moving buffer, not a store.`,
    }

  return {
    tiles: [
      { k: 'Per-queue load', v: fmt.compact(perQueue), u: 'msg/s' },
      { k: 'Broker capacity', v: fmt.compact(totalCap), u: 'msg/s total' },
      { k: 'Queues in use', v: fmt.int(v.queues), u: 'shards' },
      { k: 'Headroom', v: Math.max(0, Math.round(100 - capPct)) + '%', u: 'to capacity' },
    ],
    meters,
    verdict,
  }
}

export const rabbitmqModule: ModuleDef = {
  key: 'rabbitmq',
  tab: 'RabbitMQ',
  emoji: '🐰',
  title: 'RabbitMQ',
  kicker: 'The message broker',
  lede: `RabbitMQ is the opposite bet from Kafka: instead of a dumb, fast log with smart clients, it is a <b>smart broker</b> — flexible routing through exchanges, per-message acknowledgement, priorities, TTLs, dead-lettering. The price of those semantics is the scaling model: <b>each queue is a single-threaded process</b>, and you scale by sharding queues, not by piling on consumers.`,
  content: {
  intro: `<p>RabbitMQ is a traditional <b>message broker</b>: producers publish to exchanges, which route messages into queues, which push to consumers. Its strengths are flexible routing (topic/fanout/header exchanges), per-message acknowledgement, priorities, TTLs, and dead-lettering — rich <em>messaging semantics</em> rather than Kafka's raw log throughput.</p>
  <p>The critical scaling fact: <b>a single queue is effectively single-threaded.</b> Each queue is one Erlang process pinned to one core on one node, so one queue tops out around the tens-of-thousands of messages/sec (much lower with persistence and complex routing). You <b>don't</b> scale by piling consumers on one queue past that point — you scale by <b>sharding into many queues</b> (via a consistent-hash exchange or partitioned queues) so work spreads across cores and nodes.</p>
  <p>Unlike Kafka, a classic RabbitMQ message is <b>deleted once acknowledged</b> — it's a queue, not a replayable log. Delivery is push-based with a <b>prefetch</b> limit (how many un-acked messages a consumer holds); set it too high and one consumer hogs the backlog, too low and consumers starve. Durability/HA comes from <b>quorum queues</b>, which replicate via Raft at a throughput cost.</p>`,
  inputs: [
    { id: 'rate', label: 'Publish rate', min: 100, max: 2000000, step: 100, val: 120000, hint: 'Peak messages published per second.', fmt: (v) => fmt.compact(v) + '/s' },
    { id: 'queues', label: 'Queues (sharded)', min: 1, max: 512, step: 1, val: 8, hint: 'Spread load across queues — each queue is one core on one node.', fmt: (v) => fmt.int(v) },
    { id: 'ceil', label: 'Per-queue ceiling', min: 1000, max: 80000, step: 1000, val: 35000, hint: 'Single-queue throughput. High for transient, low for persistent/quorum.', fmt: (v) => fmt.compact(v) + '/s' },
    { id: 'cons', label: 'Consumers / queue', min: 1, max: 200, step: 1, val: 6, hint: 'Multiple consumers share a queue, but the queue process is the limit.', fmt: (v) => fmt.int(v) },
    { id: 'backlog', label: 'Current backlog', min: 0, max: 20000000, step: 10000, val: 0, hint: 'Un-acked messages sitting in RAM. Big backlogs trigger flow control.', fmt: (v) => fmt.compact(v) },
  ],
  compute,
  limits: [
    ['Throughput / queue', '~tens of k msg/s', 'One queue = one Erlang process = one core. Persistence/quorum drops this sharply.'],
    ['Scaling unit', 'More queues', "Shard with a consistent-hash exchange; consumers-per-queue helps only up to the queue's own ceiling."],
    ['Prefetch', 'Tune per workload', 'Un-acked messages a consumer may hold. Too high starves peers; too low starves the consumer.'],
    ['Memory / disk alarms', 'Flow control', 'When RAM (or disk) crosses a watermark the broker blocks publishers. Deep backlogs are a liability.'],
    ['Persistence cost', 'Large', 'Durable messages fsync to disk; classic mirrored/quorum queues replicate — both cut throughput several-fold.'],
    ['Message lifetime', 'Deleted on ack', "It's a queue, not a log — no cheap replay. Use Kafka (or streams) if you need re-reads."],
  ],
  fails: [
    ['Unbounded queue growth', 'Consumers slower than publishers → queue grows in RAM → memory alarm → publishers blocked → cascade. Keep queues near-empty; add capacity or shed load.'],
    ['Single fat queue', 'All traffic through one queue caps you at one core no matter how many consumers. Shard across queues/nodes.'],
    ['Poison message requeue loop', 'A message that always fails is redelivered forever, burning capacity. Set a retry limit + dead-letter exchange.'],
    ['Prefetch misconfiguration', 'Default unlimited prefetch lets one consumer grab the whole backlog, starving others and spiking its memory. Set a sane prefetch count.'],
    ['Split-brain on network partition', 'Mirrored/quorum queues can lose availability or diverge during partitions; choose the right partition-handling mode.'],
  ],
  ladder: [
    '<b>Keep queues short</b> — RabbitMQ is a buffer, not a database; deep backlogs threaten the broker itself.',
    '<b>Tune prefetch and acks</b> so consumers share work evenly without hoarding.',
    '<b>Shard into more queues</b> (consistent-hash exchange) to break past the one-core-per-queue ceiling.',
    '<b>Add broker nodes</b> and spread sharded queues across them for throughput and HA.',
    '<b>Use quorum queues for durability</b> — and accept the throughput cost, or reach for Kafka when you need a replayable high-throughput log.',
  ],
  },
}
