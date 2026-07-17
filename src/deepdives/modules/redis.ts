import type { ModuleDef, Values, ComputeResult } from '../types'
import { fmt } from '../format'

function compute(v: Values): ComputeResult {
  const perKey = v.val + 75 // value + rough overhead
  const memBytes = v.keys * perKey
  const nodeBytes = v.mem * 1024 * 1024 * 1024
  const shardsMem = Math.ceil(memBytes / nodeBytes)
  const shardsOps = Math.ceil(v.ops / v.ceil)
  const shards = Math.max(shardsMem, shardsOps, 1)
  const memPctSingle = (memBytes / nodeBytes) * 100
  const opsPctSingle = (v.ops / v.ceil) * 100

  const meters = [
    {
      label: 'Memory (single node)',
      valTxt: fmt.bytes(memBytes) + ' / ' + v.mem + 'GB',
      pct: memPctSingle,
      detail: `${fmt.compact(v.keys)} keys × ~${fmt.bytes(perKey)} (value + overhead) = ${fmt.bytes(memBytes)}. Past maxmemory Redis evicts (cache) or rejects writes (store).`,
    },
    {
      label: 'Throughput vs one core',
      valTxt: fmt.compact(v.ops) + ' / ' + fmt.compact(v.ceil),
      pct: opsPctSingle,
      detail: `Redis runs commands on ONE thread. ${fmt.compact(v.ops)}/s against a ~${fmt.compact(v.ceil)}/s single-core ceiling. More cores on the box don't help a single instance.`,
    },
    {
      label: 'Cluster shards required',
      valTxt: shards + ' primaries',
      pct: shards > 1 ? 100 : Math.max(memPctSingle, opsPctSingle),
      detail: `Need ${shardsMem} for memory, ${shardsOps} for throughput → ${shards} shard${shards > 1 ? 's' : ''} (16,384 hash slots split across them). Each typically gets a replica too.`,
    },
  ]

  let verdict: ComputeResult['verdict']
  if (shards > 1)
    verdict = {
      s: 'crit',
      t: `<b>One node isn't enough — go Cluster.</b> You need <b>${shards} shards</b> (${shardsMem} for memory, ${shardsOps} for ops). Cluster splits the 16,384 hash slots across primaries so memory and writes scale out. Watch for multi-key ops and hot keys, which sharding can't fix.`,
    }
  else if (opsPctSingle >= 75 || memPctSingle >= 75)
    verdict = {
      s: 'warn',
      t: `<b>Nearing single-node limits.</b> You're close to either the one-core throughput ceiling or the memory budget. Plan for Cluster, add replicas for read offload, and audit for O(N) commands before a spike forces the issue.`,
    }
  else
    verdict = {
      s: 'good',
      t: `<b>Comfortable on one node.</b> Memory and single-core throughput both have headroom. Keep values small, avoid O(N) commands (<code>KEYS</code>, huge <code>SMEMBERS</code>) that block the one thread, and add replicas if reads grow.`,
    }

  return {
    tiles: [
      { k: 'Memory needed', v: fmt.bytes(memBytes), u: 'in RAM' },
      { k: 'Shards required', v: fmt.int(shards), u: 'cluster primaries' },
      { k: 'Single-core load', v: Math.round(opsPctSingle) + '%', u: 'of one thread' },
      { k: 'Per-key overhead', v: '~' + fmt.bytes(perKey - v.val), u: 'on top of value' },
    ],
    meters,
    verdict,
  }
}

export const redisModule: ModuleDef = {
  key: 'redis',
  tab: 'Redis',
  emoji: '⚡',
  title: 'Redis',
  kicker: 'In-memory data store',
  lede: `Redis is astonishingly fast because it keeps everything in <b>RAM</b> and runs commands on a <b>single thread</b> — no lock contention, atomic operations, predictable latency. Those same two facts are its walls: <b>one CPU core</b> per node caps your ops/sec no matter how big the box, and <b>memory</b> is a hard ceiling. Scaling Redis is the art of working around a single-threaded, memory-bound process.`,
  content: {
    intro: `<p>Redis processes commands one at a time on a single main thread. That's why a <code>GET</code> is measured in microseconds and every operation is effectively atomic — but it also means <b>a single Redis instance can only use one CPU core for command execution.</b> A 64-core machine doesn't make one Redis faster; it just wastes 63 cores. Typical ceiling is ~100k simple ops/sec (higher with pipelining, lower for complex commands).</p>
  <p>The second wall is <b>memory</b>. Everything lives in RAM, so your dataset must fit — plus overhead (~tens of bytes per key for internal structures). You set <code>maxmemory</code> and an <b>eviction policy</b> (e.g. <code>allkeys-lru</code>): once full, Redis either evicts keys or rejects writes. Treating Redis as a cache means eviction is fine; treating it as a database means an eviction is data loss.</p>
  <p>Scaling directions: <b>Replicas</b> add read capacity and failover (writes still go to one primary — reads can be slightly stale). <b>Cluster</b> shards the keyspace across primaries using <b>16,384 hash slots</b>, so both memory and write throughput scale out. The catch cluster can't solve is the <b>hot key</b>: a single wildly-popular key lives on one shard's one core, and no amount of sharding splits it.</p>`,
    inputs: [
      { id: 'ops', label: 'Operations / sec', min: 1000, max: 3000000, step: 1000, val: 250000, hint: 'Commands per second across the workload.', fmt: (v) => fmt.compact(v) + '/s' },
      { id: 'val', label: 'Avg value size', min: 16, max: 65536, step: 16, val: 512, hint: 'Bigger values eat memory and network faster.', fmt: (v) => fmt.bytes(v) },
      { id: 'keys', label: 'Number of keys', min: 100000, max: 2000000000, step: 100000, val: 80000000, hint: 'Total keys held. Each carries ~60–90 B of overhead too.', fmt: (v) => fmt.compact(v) },
      { id: 'mem', label: 'maxmemory / node', min: 1, max: 512, step: 1, val: 32, hint: 'RAM budget per Redis node before eviction kicks in.', fmt: (v) => v + ' GB' },
      { id: 'ceil', label: 'Single-node op ceiling', min: 20000, max: 500000, step: 10000, val: 120000, hint: "One core's throughput — simple ops high, O(N)/big values low.", fmt: (v) => fmt.compact(v) + '/s' },
    ],
    compute,
    limits: [
      ['Command execution', '1 thread / core', 'The core constraint. I/O threads help networking, but command logic is single-threaded.'],
      ['Throughput', '~100k ops/s (simple)', 'Order of magnitude for GET/SET; pipelining raises it, O(N) commands and large values drop it.'],
      ['Memory', '= RAM', 'Hard ceiling. Dataset + overhead must fit under maxmemory or eviction/rejection begins.'],
      ['Cluster', '16,384 hash slots', 'Keyspace shards across slots → primaries. Multi-key ops must share a slot (hash tags).'],
      ['Persistence fork', 'RAM spike', 'RDB snapshots fork the process (copy-on-write); heavy writes during a fork can nearly double memory.'],
      ['Hot key', 'Unsplittable', "One popular key = one slot = one core. Sharding can't divide it — you need client-side caching or key-splitting."],
    ],
    fails: [
      ['O(N) command stalls', 'A <code>KEYS *</code> or huge <code>SMEMBERS</code> on the single thread freezes every other client for its duration. Use SCAN and bound collection sizes.'],
      ['Hot key on one shard', 'A viral item routes all traffic to one core while other shards idle. Cache it in-process, or split it into sub-keys.'],
      ['Eviction as silent data loss', 'Using Redis as a store with an eviction policy means memory pressure quietly deletes real data. Use noeviction + capacity planning for stores.'],
      ['Fork memory spike / OOM', 'RDB/AOF-rewrite forks during write-heavy periods can double memory and trigger the OOM killer. Size headroom for the fork.'],
      ['Big-value network saturation', 'Multi-MB values saturate the NIC and inflate latency even below the ops ceiling. Keep values small; compress or offload to S3.'],
    ],
    ladder: [
      '<b>Scale up</b> to a bigger-RAM box first — it buys memory headroom (but not more than one core of throughput).',
      '<b>Add replicas</b> to offload reads and gain failover; accept slightly stale reads.',
      '<b>Shard with Cluster</b> when memory or write throughput exceeds one node — 16,384 slots spread across primaries.',
      "<b>Eliminate hot keys and O(N) commands</b> — the failures sharding can't fix.",
      '<b>Add a client-side / near cache</b> for the hottest keys so requests never reach Redis at all.',
    ],
  },
}
