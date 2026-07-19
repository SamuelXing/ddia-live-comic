import type { ComputeResult, InputDef, Values } from '../types'
import { fmt } from '../format'

/* The scale-out sandbox: shard math plus the catch sharding can't
   fix. CRC16 spreads KEYS evenly; it does nothing about POPULARITY.
   One viral key routes its entire load to one shard's one core. */

const KEY_OVERHEAD = 75 // bytes of metadata per key

export const scaleOutInputs: InputDef[] = [
  { id: 'ops', label: 'Operations / sec', min: 10000, max: 5000000, step: 10000, val: 600000, hint: 'Total command volume across the keyspace.', fmt: (v) => fmt.compact(v) + '/s' },
  { id: 'ceil', label: 'Single-shard op ceiling', min: 20000, max: 500000, step: 10000, val: 120000, hint: "One instance's one-core throughput — command mix sets it.", fmt: (v) => fmt.compact(v) + '/s' },
  { id: 'keys', label: 'Keys', min: 1000000, max: 2000000000, step: 1000000, val: 200000000, hint: 'Total keys. Each carries ~75 B of metadata on top of its value.', fmt: (v) => fmt.compact(v) },
  { id: 'val', label: 'Avg value size', min: 16, max: 8192, step: 16, val: 512, hint: 'Value bytes → memory per shard.', fmt: (v) => fmt.bytes(v) },
  { id: 'mem', label: 'maxmemory per shard', min: 1, max: 256, step: 1, val: 32, hint: 'RAM budget per primary before eviction or OOM errors.', fmt: (v) => v + ' GB' },
  { id: 'hot', label: 'Hottest-key share', min: 0, max: 80, step: 1, val: 10, hint: 'Share of ALL ops hitting one viral key. The slider sharding can’t touch.', fmt: (v) => v + '%' },
]

export function computeScaleOut(v: Values): ComputeResult {
  const memBytes = v.keys * (v.val + KEY_OVERHEAD)
  const shardBytes = v.mem * 1024 * 1024 * 1024
  const shardsMem = Math.ceil(memBytes / shardBytes)
  const shardsOps = Math.ceil(v.ops / v.ceil)
  const shards = Math.max(shardsMem, shardsOps, 1)

  const hotFrac = v.hot / 100
  const hotShardOps = v.ops * hotFrac + (v.ops * (1 - hotFrac)) / shards
  const avgShardOps = v.ops / shards
  const hotPct = (hotShardOps / v.ceil) * 100
  const avgPct = (avgShardOps / v.ceil) * 100
  const memPct = (memBytes / shards / shardBytes) * 100
  const slotsPerShard = Math.floor(16384 / shards)

  const meters = [
    {
      label: 'Memory per shard',
      valTxt: fmt.bytes(memBytes / shards) + ' / ' + v.mem + ' GB',
      pct: memPct,
      detail: `${fmt.compact(v.keys)} keys × ~${fmt.bytes(v.val + KEY_OVERHEAD)} (value + metadata) ÷ ${shards} shard${shards > 1 ? 's' : ''}. Leave fork headroom above this (Chapter 3).`,
    },
    {
      label: 'Average shard load',
      valTxt: fmt.compact(avgShardOps) + '/s',
      pct: avgPct,
      detail: `${fmt.compact(v.ops)}/s ÷ ${shards} shards vs a ${fmt.compact(v.ceil)}/s one-core ceiling — the number sharding fixes.`,
    },
    {
      label: 'Hottest shard load',
      valTxt: fmt.compact(hotShardOps) + '/s',
      pct: hotPct,
      detail: `${v.hot}% of all ops hit one key, and one key lives on one shard's one core. CRC16 spreads keys, not popularity.`,
    },
  ]

  let verdict: ComputeResult['verdict']
  if (hotPct >= 100)
    verdict = { s: 'crit', t: `<b>The hot key wins.</b> The viral key alone pushes its shard to ${Math.round(hotPct)}% — and re-sharding moves it around without splitting it. The fixes live outside the cluster: <b>client-side caching</b> (RESP3 invalidation), replicating the key and reading from replicas, or splitting it into sub-keys (<code>counter:1 … counter:16</code>) and merging in the app.` }
  else if (hotPct >= 75)
    verdict = { s: 'warn', t: `<b>One shard is running hot</b> (${Math.round(hotPct)}% vs a ${Math.round(avgPct)}% average). The gap between those two numbers is pure key skew — watch it, because virality is a step function and the next retweet is the cliff.` }
  else if (shards > 1)
    verdict = { s: 'good', t: `<b>${shards} shards, balanced.</b> ${shardsMem > shardsOps ? 'Memory' : 'Throughput'} set the shard count (${shardsMem} for memory, ${shardsOps} for ops); each holds ~${fmt.int(slotsPerShard)} hash slots. The remaining rules: multi-key ops need hash tags, and every shard still obeys Chapter 3's one-core envelope.` }
  else
    verdict = { s: 'good', t: `<b>One instance is enough</b> — memory and the one core both have headroom. The cheapest scaling move from here isn't a second node: it's <b>pipelining</b> (batch round-trips, ~5× per-op overhead saved) and keeping O(N) commands out of the hot path.` }

  return {
    tiles: [
      { k: 'Shards required', v: fmt.int(shards), u: `${shardsMem} for memory · ${shardsOps} for ops` },
      { k: 'Hottest / average shard', v: Math.round(hotPct) + '% / ' + Math.round(avgPct) + '%', u: 'of one core each' },
      { k: 'Hash slots per shard', v: fmt.int(slotsPerShard), u: 'of 16,384' },
      { k: 'Total memory', v: fmt.bytes(memBytes), u: 'across the cluster' },
    ],
    meters,
    verdict,
  }
}
