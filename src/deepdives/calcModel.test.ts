import { describe, it, expect } from 'vitest'
import {
  model, consequences, outcome, sensitivity, INIT, PRESETS, WORKLOAD, DERIVED_INP, HW, STORES, POINTER_BYTES,
  type Req, type Vals,
} from './calcModel'

/* Every expected value in this file is computed BY HAND in the comment above
   it, from the stated formula — never copied from the implementation's output.
   If a test fails, first re-do the hand arithmetic; if the hand arithmetic is
   right, the model is wrong. This tool recommends real infrastructure — a
   silently wrong number here is the most expensive kind of bug we can ship. */

const REQ: Req = { fresh: 'pull', txn: 'single', loss: 'keep', analytics: 'no', access: 'point', recency: 'stale', keyShape: 'monotonic' }
const vals = (over: Vals = {}): Vals => ({ ...INIT, ...over })
const req = (over: Partial<Req> = {}): Req => ({ ...REQ, ...over })

/** relative-tolerance assertion for hand-computed values */
const close = (actual: number, expected: number, tol = 1e-3) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.abs(expected) * tol + 1e-9)
}

describe('workload derivations (defaults: 50M DAU, 20/day, ×3 peak, 85% reads, fanout 1, 2 KB written, 50 KB read)', () => {
  const m = model(vals(), req())

  it('request rates', () => {
    // 5e7 × 20 = 1e9 actions/day; ÷ 86,400 = 11,574.074/s avg; ×3 = 34,722.22 peak
    close(m.actionsPerDay, 1e9)
    close(m.avgQps, 11574.074)
    close(m.peakQps, 34722.222)
  })
  it('read/write split and delivery side', () => {
    // 34,722.22 × 85% = 29,513.89 reads; remainder 5,208.33 writes
    close(m.peakReads, 29513.889)
    close(m.peakWrites, 5208.333)
    // fanout 1: deliveries = writes; readSide = 29,513.89 + 5,208.33 = 34,722.22
    close(m.deliveries, 5208.333)
    close(m.readSide, 34722.222)
  })
  it('storage from the WRITTEN object, not the read response', () => {
    // 1e9 × 15% = 1.5e8 writes/day × 2,048 B = 3.072e11 B/day; ×30×12 = 1.10592e14 B
    close(m.writesPerDay, 1.5e8)
    close(m.storagePerDay, 3.072e11)
    close(m.storageTotal, 1.10592e14)
  })
  it('egress = reads × response + deliveries × object, + protocol bytes, ×8', () => {
    // at 800 B overhead: 29,513.89 × 52,000 + 5,208.33 × 2,848
    //                  = 1.534722e9 + 1.483333e7 = 1.549556e9 B/s ×8 = 12.396 Gbps
    close(m.egressFor(800), 12.3964)
    // at 10 B overhead: 29,513.89 × 51,210 + 5,208.33 × 2,058
    //                 = 1.511406e9 + 1.071875e7 = 1.522125e9 B/s ×8 = 12.177 Gbps
    close(m.egressFor(10), 12.177)
  })
})

describe('ceilings are one division each', () => {
  const m = model(vals(), req())

  it('durable writes = commits per fsync ÷ fsync latency', () => {
    // 8 ÷ 300e-6 s = 26,666.67/s
    close(m.writeCeiling, 26666.667)
  })
  it('random reads = queue depth ÷ read latency', () => {
    // 8 ÷ 100e-6 s = 80,000/s
    close(m.diskReadCeiling, 80000)
  })
  it('cache ops = 1 ÷ per-op cost', () => {
    // 1 ÷ 10e-6 s = 100,000/s
    close(m.cacheCeiling, 100000)
  })
  it('full scan = stored bytes ÷ sequential read rate', () => {
    // 1.10592e14 B ÷ (8 × 2^30 = 8.58993e9 B/s) = 12,874.6 s (~3.6 h)
    close(m.scanSeconds, 12874.6)
  })
  it('RAM feasibility = stored bytes ÷ RAM per node', () => {
    // 1.10592e14 ÷ (128 × 2^30 = 1.37439e11) = 804.66 → ceil 805 hosts
    expect(m.ramHosts).toBe(805)
  })
})

describe('transport: the freshness requirement filters, arithmetic ranks survivors', () => {
  it('pull → request/response wins, nothing disqualified', () => {
    const m = model(vals(), req({ fresh: 'pull' }))
    expect(m.transportWin).toBe('req')
    expect(m.tCols.every((c) => c.dq === null)).toBe(true)
  })
  it('push → request/response is OUT; WebSocket beats polling on overhead', () => {
    const m = model(vals(), req({ fresh: 'push' }))
    expect(m.transportWin).toBe('ws')
    expect(m.tCols.find((c) => c.id === 'req')!.dq).toBeTruthy()
    // both hold 5e7 × 10% = 5e6 connections → ceil(5e6 / 1e5) = 50 hosts each
    expect(m.tCols.find((c) => c.id === 'poll')!.hosts).toBe(50)
    expect(m.tCols.find((c) => c.id === 'ws')!.hosts).toBe(50)
    // polling repays 800 B vs 10 B per message → strictly more egress
    const [, poll, ws] = m.tCols
    expect(poll.eg).toBeGreaterThan(ws.eg)
  })
})

describe('engine: requirements filter before any arithmetic', () => {
  it('cross-key atomicity disqualifies LSM and in-memory; only relational survives', () => {
    const m = model(vals(), req({ txn: 'multi' }))
    expect(m.eCols.find((c) => c.id === 'wide')!.dq).toBeTruthy()
    expect(m.eCols.find((c) => c.id === 'mem')!.dq).toBeTruthy()
    // sharded, not single-primary: the default 101 TB of rows needs 12 shards,
    // and one primary over 12 shards is a contradiction, not a trade-off
    expect(m.engineWin).toBe('sqlShard')
    expect(m.eCols.find((c) => c.id === 'sql')!.dq).toContain('shards')
  })
  it('a write-heavy ledger still refuses LSM — arithmetic never overrules the filter', () => {
    // write-dominant load that would rank LSM first if only utilization counted
    const m = model(vals({ readPct: 10, fanout: 0, dau: 5e8, actions: 50 }), req({ txn: 'multi' }))
    expect(m.eCols.find((c) => c.id === 'wide')!.dq).toBeTruthy()
    expect(m.engineWin).toBe('sqlShard')
  })
  it('must-survive data disqualifies in-memory; rebuildable data readmits it', () => {
    expect(model(vals(), req({ loss: 'keep' })).eCols.find((c) => c.id === 'mem')!.dq).toBeTruthy()
    // rebuildable but too big: default dataset needs 805 RAM nodes → still out
    expect(model(vals(), req({ loss: 'rebuild' })).eCols.find((c) => c.id === 'mem')!.dq).toContain('RAM')
  })
})

describe('engine: each column is judged on the load that REACHES it', () => {
  it('defaults: both disk engines sit behind their own cache; B-tree wins on read pressure', () => {
    const m = model(vals(), req())
    const bt = m.eCols.find((c) => c.id === 'sql')!
    const ls = m.eCols.find((c) => c.id === 'wide')!
    // B-tree raw read pressure: 34,722.22 × 1 ÷ 80,000 = 43.4% → forces a cache
    close(bt.rawRU, 0.43403)
    expect(bt.colCache).toBe(true)
    // misses only: 34,722.22 × 10% = 3,472.22 → 3,472.22 ÷ 80,000 = 4.34%
    close(bt.rU, 0.043403)
    // write stream: 5,208.33 × 2,048 × 3 = 32.0e6 B/s ÷ 3×2^30 = 0.993%
    close(bt.bwU, 0.0099341)
    close(bt.worst, 0.043403)
    // LSM: ×2 amp → misses 3,472.22 × 2 ÷ 80,000 = 8.68%; worst 8.68% → B-tree wins
    close(ls.rU, 0.086806)
    expect(m.engineWin).toBe('sqlShard')
  })

  it("REGRESSION (user-reported): 781k writes/s of ingest picks LSM once the chain applies", () => {
    // 500M × 50/day = 2.5e10; peak ×3 = 868,055.6/s; 10% reads → 781,250 writes/s
    const m = model(vals({ dau: 5e8, actions: 50, readPct: 10, fanout: 0 }), req())
    close(m.peakWrites, 781250)
    // writeUtil = 781,250 ÷ 26,666.67 = 29.3 → the log is forced (peak ×3 ≥ 2)
    expect(m.logNeed).toBe(true)
    // behind the log: 781,250 ÷ 3 = 260,416.7/s sustained
    close(m.dbWrites, 260416.67)
    const bt = m.eCols.find((c) => c.id === 'sql')!
    const ls = m.eCols.find((c) => c.id === 'wide')!
    // B-tree write stream: 260,416.7 × 2,048 × 3 = 1.6e9 B/s ÷ 3.2212e9 = 49.7%
    close(bt.bwU, 0.49671)
    expect(bt.worstName).toBe('the write stream')
    // LSM: bw 16.6%; reads 86,805.6 → raw 217% → cache → 8,680.6 × 2 ÷ 80,000 = 21.7%
    close(ls.rU, 0.21701)
    close(ls.worst, 0.21701)
    // 21.7% < 49.7% → LSM wins, for the right reason
    expect(m.engineWin).toBe('wide')
  })

  it('moderate ingest honestly stays on the B-tree — one primary behind a log handles it', () => {
    // 50M × 20/day, 10% reads, 5 KB writes: writes 31,250/s peak → 10,416.7 sustained
    const m = model(vals({ readPct: 10, fanout: 0, writeSize: 5 }), req())
    // B-tree bw: 10,416.7 × 5,120 × 3 = 1.6e8 ÷ 3.2212e9 = 4.97%; reads 3,472.2 ÷ 80k = 4.34%
    // worst 4.97% vs LSM worst = reads ×2 = 8.68% → relational
    expect(m.engineWin).toBe('sqlShard')
  })

  it('small rebuildable dataset: in-memory competes and wins on ops-per-core', () => {
    // 1M × 20/day ×3 = 694.4/s peak; 85/15 split; fanout 1 → readSide 694.4
    const m = model(vals({ dau: 1e6, retention: 1, writeSize: 1 }), req({ loss: 'rebuild' }))
    // storage: 3e6 writes/day × 1,024 B × 30 × 1 = 9.216e10 B → 1 RAM host → eligible
    expect(m.ramHosts).toBe(1)
    const mem = m.eCols.find((c) => c.id === 'mem')!
    expect(mem.dq).toBeNull()
    // mem worst: (694.44 + 104.17) ÷ 100,000 = 0.799%
    close(mem.worst, 0.0079861)
    // btree worst: reads 694.44 ÷ 80,000 = 0.868% → mem is lower → mem wins
    expect(m.engineWin).toBe('mem')
  })

  it('blobs leave the database: the engine is judged on pointer rows', () => {
    // 5 MB written objects → blobNeed; engine bw uses 1,024 B pointers:
    // 5,208.33 × 1,024 × 3 = 1.6e7 B/s ÷ 3.2212e9 = 0.497%
    const m = model(vals({ writeSize: 5000 }), req())
    expect(m.blobNeed).toBe(true)
    expect(m.dbBytesW).toBe(POINTER_BYTES)
    close(m.eCols.find((c) => c.id === 'sql')!.bwU, 0.0049671)
    // and so are RAM, scan and storage-shard checks: 1.5e8 pointers/day × 1,024 B
    // × 360 = 5.5296e13 B of rows (not the 270 PB of blobs)
    close(m.dbStorage, 5.5296e13)
    // 5.5296e13 ÷ 1.37439e11 = 402.3 → 403 RAM hosts; ÷ 1e13 = 5.53 → 6 shards
    expect(m.ramHosts).toBe(403)
    expect(m.storageShards).toBe(6)
  })
})

describe('“must be current” puts the cache on the write path — and pays for it', () => {
  /* The page has always SAID this: an asynchronous copy cannot answer a read
     that must reflect the write that just happened, so the only safe cache is
     one every write updates or invalidates. It just never charged for it —
     `cacheNodes` was sized from reads alone, so the sentence was true and the
     arithmetic beside it was not. */

  // 500M DAU × 20/day, 50/50 split, no fan-out: 347,222/s peak, half each way.
  // readSide = 173,611/s (no deliveries). writeUtil = 173,611 ÷ 26,667 = 6.5,
  // so the log is forced and the store sees 173,611 ÷ 3 = 57,870/s sustained.
  const v = vals({ dau: 5e8, readPct: 50, fanout: 0 })
  const stale = model(v, req({ recency: 'stale' }))
  const current = model(v, req({ recency: 'current' }))

  it('a stale-tolerant cache absorbs reads only', () => {
    close(stale.readSide, 173611.1)
    close(stale.dbWrites, 57870.37)
    const c = consequences(v, req({ recency: 'stale' }), stale, false)
    // 173,611.1 ÷ 100,000 per core = 1.736 → 2 nodes
    close(c.cacheOps, 173611.1)
    expect(c.cacheNodes).toBe(2)
  })

  it('a current cache absorbs reads AND writes, and that costs a node', () => {
    const c = consequences(v, req({ recency: 'current' }), current, false)
    expect(current.cacheOnWritePath).toBe(true)
    // (173,611.1 + 57,870.4) ÷ 100,000 = 2.315 → 3 nodes
    close(c.cacheOps, 231481.5)
    expect(c.cacheNodes).toBe(3)
  })

  it('the requirement is no longer inert: it moves a number, not just a sentence', () => {
    const a = consequences(v, req({ recency: 'stale' }), stale, false)
    const b = consequences(v, req({ recency: 'current' }), current, false)
    expect(b.cacheOps).toBeGreaterThan(a.cacheOps)
    expect(b.cacheNodes).toBeGreaterThan(a.cacheNodes)
  })
})

/* THE BUFFER-POOL CLIFF.
   A B-tree writes the row where it belongs, so it must first READ the leaf page
   that position sits on. Two things have to be true for that read to cost a
   disk seek: the insert point has to be somewhere unpredictable (a random id,
   a hash), AND a node's slice of the data has to have outgrown its RAM. Miss
   either and the page is already in the buffer pool and the read is free —
   which is why a B-tree feels fine for years and then does not.

   Both conditions are load-bearing, and the second test below is the one that
   keeps the model honest: without the key-shape condition every dataset larger
   than RAM would charge the penalty, and this page would answer "LSM" to
   everything — which it did, in a first attempt at this. */
describe('the buffer-pool cliff: when an insert has to seek before it can write', () => {
  /* 50M DAU × 20/day, 10% reads, no fan-out, 5 KB writes — the same workload as
     "moderate ingest" above, which stays on sharded SQL with an ordered key. */
  const heavy = (over: Partial<Req> = {}) =>
    model(vals({ readPct: 10, fanout: 0, writeSize: 5 }), req({ keyShape: 'scattered', ...over }))

  it('a scattered key past RAM does not change the engine — it explodes the shard count', () => {
    const m = heavy()
    // 9e8 writes/day × 5,120 B × 30 × 12 = 1.65888e15 B; ÷ 10 TB = 166 shards
    // is all the DISK asks for. RAM asks for far more: ÷ 1.37439e11 = 12,069.94
    close(m.dbStorage, 1.65888e15)
    expect(m.storageShards).toBe(166)
    expect(m.ramHosts).toBe(12070)
    expect(m.shardsNeeded).toBe(12070)
    // behind the forced log: 31,250 ÷ 3 = 10,416.7 writes/s sustained
    close(m.dbWrites, 10416.667)

    /* THE ACTUAL BILL. A B-tree can keep scattered inserts cheap — by splitting
       until a node's slice is back inside its RAM. That is 73x more shards than
       the disk alone needed, and it is a real operational choice, not a
       theoretical one: it is what Slack runs. The tool's job is to print the
       number, not to hide it inside a utilisation percentage. */
    const bt = m.eCols.find((c) => c.id === 'sqlShard')!
    close(bt.nodeBytes, 1.3743828e11)
    expect(bt.nodeBytes).toBeLessThanOrEqual(m.ramBytes)
    expect(bt.poolMisses).toBe(0)
    // so per node it is the same machine as before: reads 3,472.2 ÷ 80,000 = 4.34%,
    // write stream 10,416.7 × 5,120 × 3 ÷ 3.2212e9 = 4.97%
    close(bt.rU, 0.043403)
    close(bt.bwU, 0.049671)
    expect(m.engineWin).toBe('sqlShard')

    /* The store that CANNOT split is the one that eats the seek. Single-primary
       SQL is already disqualified here for needing shards at all — but the
       column still has to report an honest number beside the disqualification,
       and "one random read per insert" is that number. */
    const one = m.eCols.find((c) => c.id === 'sql')!
    expect(one.dq).not.toBeNull()
    close(one.poolMisses, 10416.667)
    // (3,472.2 × 1 + 10,416.7) ÷ 80,000 = 17.36%, and the seeks outweigh the reads
    close(one.rU, 0.173611)
    expect(one.worstName).toBe('the buffer-pool cliff')

    // the LSM is charged nothing at any size: it appends to a sorted buffer and
    // places the row later, in compaction
    expect(m.eCols.find((c) => c.id === 'wide')!.poolMisses).toBe(0)
  })

  it('the SAME workload with an ordered key never leaves the buffer pool', () => {
    // Time-ordered ids (UUIDv7, Snowflake, an auto-increment) insert at the
    // right-hand edge of the tree. That leaf page is the one page guaranteed to
    // be resident, so the read costs nothing however large the dataset gets.
    const m = model(vals({ readPct: 10, fanout: 0, writeSize: 5 }), req({ keyShape: 'monotonic' }))
    const bt = m.eCols.find((c) => c.id === 'sqlShard')!
    expect(bt.poolMisses).toBe(0)
    // back to reads alone: 3,472.2 ÷ 80,000 = 4.34%, under the 4.97% write stream
    close(bt.rU, 0.043403)
    expect(bt.worstName).toBe('the write stream')
    expect(m.engineWin).toBe('sqlShard')
  })

  it('a scattered key under RAM is free too — this is what retention buys you', () => {
    // 100k DAU × 20/day, 1 KB writes, 1 month kept: 1.8e6 writes/day × 1,024 B
    // × 30 = 5.5296e10 B, inside one node's 1.37439e11 B of RAM.
    // A workflow store that garbage-collects finished runs lives here, which is
    // why random UUID keys cost it nothing.
    const m = model(
      vals({ dau: 1e5, readPct: 10, fanout: 0, writeSize: 1, retention: 1 }),
      req({ keyShape: 'scattered' }),
    )
    close(m.dbStorage, 5.5296e10)
    expect(m.storageShards).toBe(1)
    const bt = m.eCols.find((c) => c.id === 'sql')!
    close(bt.nodeBytes, 5.5296e10)
    expect(bt.poolMisses).toBe(0)
    expect(m.engineWin).toBe('sql')
  })

  it('the reason named for the shard count is the reason that actually won', () => {
    /* The page prints the shard count and the division that produced it side by
       side; that pairing IS the product. A count of 1,342 next to arithmetic
       yielding 19 is worse than printing no arithmetic at all, and adding the
       memory reason without adding its name to `shardBy` did exactly that on
       five of the seven presets before this test existed. */
    for (const p of PRESETS) {
      const v = { ...INIT, ...p.sets }
      const m = model(v, p.req)
      const c = consequences(v, p.req, m, true)
      const claimed =
        c.shardBy === 'memory' ? m.ramShardsNeeded
        : c.shardBy === 'storage' ? m.storageShards
        : c.shardBy === 'writes' ? m.writeShardsNeeded
        : Math.max(m.storageShards, m.writeShardsNeeded)
      expect(claimed, `${p.id} says it shards by ${c.shardBy}, which yields ${claimed}, not ${c.shards}`).toBe(c.shards)
    }
  })

  it('the binding-wall utilisation is reproducible from reads plus insert seeks', () => {
    // the same invariant one level down: rU has to be exactly what wallOf prints
    const m = heavy()
    const one = m.eCols.find((c) => c.id === 'sql')!
    close((one.colReads * 1 + one.poolMisses) / m.diskReadCeiling, one.rU)
  })

  it('every preset states a key shape, and the ordered default keeps old answers', () => {
    /* The dimension is new; the presets are the record of what this page used
       to answer. Any preset that flips has to flip because someone decided its
       ids are scattered — never because the field defaulted to something. */
    for (const p of PRESETS) expect(p.req.keyShape, `${p.id} has no keyShape`).toBeTruthy()
  })
})

describe('the chain: forced additions transform downstream load', () => {
  it('defaults: cache and CDN fire; misses and origin egress are the residuals', () => {
    const m = model(vals(), req())
    const c = consequences(vals(), req(), m, false)
    // readUtil 43.4% > 30% → cache; misses = 34,722.22 × 10% = 3,472.22/s → 4.34%
    expect(c.needs.cache).toBe(true)
    close(c.missReads, 3472.22)
    close(c.readUtilAfter, 0.043403)
    // egress 12.396 Gbps > 10 → CDN; after 80% offload: 2.479 Gbps → 1 host
    expect(c.needs.cdn).toBe(true)
    close(c.originAfter, 2.4793)
    expect(c.originHostsAfter).toBe(1)
    // writes 19.5% of ceiling → no log, and the write RATE never forces a shard —
    // but 1.10592e14 B of rows ÷ 10 TB per node = 11.06 → 12 shards on data size
    expect(c.needs.log).toBe(false)
    close(c.writeUtilAfter, 0.19531)
    expect(c.shardBy).toBe('storage')
    expect(m.storageShards).toBe(12)
    expect(c.needs.shard).toBe(true)
  })

  it('REGRESSION: the log absorbs the peak — the write RATE stops forcing shards', () => {
    // 500M DAU, defaults otherwise: writes 52,083.3/s peak = 195% of ceiling
    const v = vals({ dau: 5e8 })
    const m = model(v, req())
    const c = consequences(v, req(), m, false)
    close(m.writeUtil, 1.9531)
    expect(m.logNeed).toBe(true)
    // sustained: 52,083.3 ÷ 3 = 17,361.1/s → 65.1% of one primary — the write
    // bound needs exactly 1 shard behind the log (it needed 2 without it)
    close(c.writeUtilAfter, 0.65104)
    expect(c.writeShards).toBe(1)
    // what still splits the store is data size: 1.10592e15 B ÷ 1e13 = 111 shards
    expect(c.shardBy).toBe('storage')
    expect(c.shards).toBe(111)
  })

  it('Little’s Law sizes the app tier', () => {
    // 34,722.22/s × 0.1 s ÷ 64 slots = 54.25 → 55 instances
    const c = consequences(vals(), req(), model(vals(), req()), false)
    expect(c.webInstances).toBe(55)
  })

  it('runway: months to the write wall at compounded growth', () => {
    // ln(26,666.67 ÷ 5,208.33) ÷ ln(1.10) = ln(5.12) ÷ 0.09531 = 17.1 months
    const c = consequences(vals(), req(), model(vals(), req()), false)
    close(c.monthsToWall, 17.135, 1e-2)
  })

  it('held connections exist only when the transport holds them', () => {
    const m = model(vals(), req())
    // holds: 5e6 conns → 50 hosts; not holding: zero
    expect(consequences(vals(), req(), m, true).connHosts).toBe(50)
    expect(consequences(vals(), req(), m, false).connHosts).toBe(0)
  })
})

describe('sanity properties', () => {
  it('fanout 0 means the read side is exactly the reads', () => {
    const m = model(vals({ fanout: 0 }), req())
    close(m.readSide, m.peakReads)
  })
  it('doubling users doubles every rate', () => {
    const a = model(vals(), req())
    const b = model(vals({ dau: 1e8 }), req())
    close(b.peakQps / a.peakQps, 2)
    close(b.storageTotal / a.storageTotal, 2)
  })
  it('a disqualified column never wins', () => {
    for (const r of [req({ txn: 'multi' }), req({ loss: 'keep' }), req({ txn: 'multi', loss: 'rebuild' })]) {
      const m = model(vals({ readPct: 10, fanout: 0, dau: 5e8 }), r)
      const win = m.eCols.find((c) => c.id === m.engineWin)!
      expect(win.dq).toBeNull()
    }
  })
})

describe('presets', () => {
  it('every preset value sits on its slider’s ladder — presets move visible knobs, nothing hidden', () => {
    const inputs = [...WORKLOAD, DERIVED_INP]
    for (const p of PRESETS) {
      for (const [id, val] of Object.entries(p.sets)) {
        const inp = inputs.find((i) => i.id === id)
        expect(inp, `${p.id}: unknown input ${id}`).toBeDefined()
        expect(inp!.steps, `${p.id}.${id} = ${val} is not on the ladder`).toContain(val)
      }
    }
  })
  it('each preset produces the outcome it exists to teach', () => {
    const run = (id: string) => {
      const p = PRESETS.find((x) => x.id === id)!
      const v = vals(p.sets)
      const m = model(v, p.req)
      return { m, c: consequences(v, p.req, m, m.tCols.find((t) => t.id === m.transportWin)!.holds) }
    }
    // feed: 8,680.6 writes/s × 100 followers = 868k deliveries > 26.7k ceiling → fan-out
    expect(run('feed').c.needs.fanout).toBe(true)
    // chat: push → WebSocket; 2e7 × 20% = 4e6 connections → connection tier
    expect(run('chat').m.transportWin).toBe('ws')
    expect(run('chat').c.needs.connTier).toBe(true)
    // ingest: 104k sustained writes/s of 2 KB — the LSM workload, plus the analytical store
    expect(run('ingest').m.engineWin).toBe('wide')
    expect(run('ingest').c.needs.analytical).toBe(true)
    // ledger: the transaction filter, not arithmetic, decides
    expect(run('ledger').m.eCols.find((c) => c.id === 'wide')!.dq).toBeTruthy()
    // media: blobs out of the database, CDN forced, metadata stays on the B-tree
    expect(run('media').m.blobNeed).toBe(true)
    expect(run('media').c.needs.cdn).toBe(true)
    // 184 TB of POINTER rows (the blobs live in object storage) needs 19 shards
    expect(run('media').m.engineWin).toBe('sqlShard')
  })
})

describe('the storage decision is decomposed, and each dimension filters', () => {
  it('cross-key atomicity keeps only the stores that can span keys', () => {
    const m = model(vals(), req({ txn: 'multi' }))
    const alive = m.eCols.filter((c) => !c.dq).map((c) => c.id)
    // per-document, per-partition and per-key atomicity are all disqualified;
    // relational stores survive (sharded SQL with a cross-shard caveat)
    // single-primary is out on shard count at the default 101 TB, so the only
    // store that both spans keys AND fits the data is the sharded relational one
    expect(alive).toEqual(['sqlShard'])
    expect(m.engineWin).toBe('sqlShard')
  })
  it('point-lookup reads disqualify the column store, for a reason it states', () => {
    const m = model(vals(), req({ access: 'point' }))
    expect(m.eCols.find((c) => c.id === 'col')!.dq).toContain('column file')
    // ...and a range workload lets it compete
    expect(model(vals(), req({ access: 'range' })).eCols.find((c) => c.id === 'col')!.dq).toBeNull()
  })
  it('every store carries all four dimensions, so none of them hide inside another', () => {
    for (const c of model(vals(), req()).eCols) {
      for (const k of ['model', 'engine', 'dist', 'txnScope'] as const) {
        expect(c.store[k], `${c.id} is missing ${k}`).toBeTruthy()
      }
    }
  })
  it('single-primary SQL still wins when the data actually fits one primary', () => {
    // the disqualification is load-driven, not a blanket ban: shrink the data
    // until one machine holds it and the simplest store comes back
    const m = model(vals({ dau: 1e5, retention: 1 }), req())
    expect(m.shardsNeeded).toBe(1)
    expect(m.eCols.find((c) => c.id === 'sql')!.dq).toBeNull()
    expect(m.engineWin).toBe('sql')
  })
  it('relational stores are not separated by invented constants — only by requirements', () => {
    // sql, sharded sql and the document store share an engine, so their
    // computed numbers must tie; what separates them is atomicity scope
    const m = model(vals({ dau: 1e5, retention: 1 }), req())
    const [sql, shard, doc] = ['sql', 'sqlShard', 'doc'].map((id) => m.eCols.find((c) => c.id === id)!)
    close(sql.worst, shard.worst)
    close(sql.worst, doc.worst)
  })
  it('reads that must be current put the cache on the write path', () => {
    expect(model(vals(), req({ recency: 'current' })).cacheOnWritePath).toBe(true)
    expect(model(vals(), req({ recency: 'stale' })).cacheOnWritePath).toBe(false)
  })
})

describe('the cache is decided by the read rate, never by the engine', () => {
  /* THE ARTIFACT THIS PREVENTS. When each store decided its own cache from its
     own amplified read pressure, a store could cross the 30% threshold BECAUSE
     it reads badly, collect the 90% cache discount, and then score better at
     reads than the store whose reads were cheap enough not to need one.
     "Worse at reads wins" — the second time this page produced that artifact,
     and it was the sensitivity sweep that caught it. */
  it('every disk store is judged on the same incoming read load', () => {
    const m = model(vals(), req({ access: 'point' }))
    const disk = m.eCols.filter((c) => c.id !== 'mem')
    disk.forEach((c) => close(c.colReads, disk[0].colReads))
    // and the decision itself is the raw rate against one node's ceiling
    // 34,722.22 ÷ 80,000 = 43.4% > 30% → a cache, for everyone
    expect(m.cacheAbsorbs).toBe(true)
    disk.forEach((c) => expect(c.colCache, c.id).toBe(true))
  })

  it('REGRESSION: a better disk must not hand the win to the store that reads worse', () => {
    // At ×16 queue depth the ceiling is 160,000/s, so 34,722.22 raw reads are
    // 21.7% — under the threshold, so NOBODY gets a cache. Judged on the same
    // load, the B-tree's ×1 (21.7%) beats the LSM's ×2 (43.4%).
    const at = (ioDepth: number) => model(vals({ ioDepth }), req({ access: 'point' }))
    expect(at(8).engineWin).toBe('sqlShard')
    const m = at(16)
    expect(m.cacheAbsorbs).toBe(false)
    close(m.eCols.find((c) => c.id === 'sqlShard')!.worst, 0.21701)
    close(m.eCols.find((c) => c.id === 'wide')!.worst, 0.43403)
    expect(m.engineWin).toBe('sqlShard')
  })
})

describe("Amdahl's law: the fix is capped by the wall you did not move", () => {
  it('the gain is the distance between the binding wall and the next one', () => {
    const m = model(vals(), req())
    const w = m.eCols.find((c) => c.id === m.engineWin)!
    // defaults: read pressure 4.3403%, write stream 0.99341% → 4.3403 ÷ 0.99341
    expect(m.amdahl.binding).toBe('read pressure')
    close(m.amdahl.bindingUtil, 0.043403)
    close(m.amdahl.nextUtil, 0.0099341)
    close(m.amdahl.gain, 4.36907)
    // the identity that makes it Amdahl: load-to-first-wall × gain = load-to-second
    close((1 / m.amdahl.bindingUtil) * m.amdahl.gain, 1 / m.amdahl.nextUtil)
    close(m.amdahl.gain, w.worst / w.next)
  })
  it('a store with only one modelled wall reports an unbounded gain', () => {
    // in-memory pays CPU per op and touches no disk, so nothing else binds
    const m = model(vals({ dau: 1e5, retention: 1 }), req({ loss: 'rebuild' }))
    const mem = m.eCols.find((c) => c.id === 'mem')!
    expect(mem.next).toBe(0)
  })
})

describe('sensitivity: which assumption is load-bearing', () => {
  it('every reported flip really happens when you make that move', () => {
    const v = vals()
    const before = JSON.stringify(outcome(v, req()))
    const flips = sensitivity(v, req())
    expect(flips.length).toBeGreaterThan(0)
    for (const f of flips) {
      const h = HW.find((x) => x.id === f.id)!
      const i = h.steps.indexOf(v[f.id])
      const after = outcome({ ...v, [f.id]: h.steps[f.dir === 'up' ? i + 1 : i - 1] }, req())
      expect(JSON.stringify(after), `${f.label} ${f.dir}`).not.toBe(before)
    }
  })

  it('never perturbs a constant the decisions themselves write', () => {
    // read/write amplification and protocol overhead are OUTPUTS of the store
    // and transport picks — moving them models nothing, it just contradicts
    const ids = PRESETS.flatMap((p) => sensitivity({ ...INIT, ...p.sets }, p.req).map((f) => f.id))
    expect(ids).not.toContain('readAmp')
    expect(ids).not.toContain('writeAmp')
    expect(ids).not.toContain('overhead')
  })

  it('assumptions are listed before measurements', () => {
    // a measured constant being load-bearing is a fact about hardware; an
    // assumed one being load-bearing means the answer rests on a guess
    const flips = sensitivity(vals(), req())
    const firstNapkin = flips.findIndex((f) => f.src === 'napkin')
    const lastAssume = flips.map((f) => f.src).lastIndexOf('assume')
    if (firstNapkin >= 0 && lastAssume >= 0) expect(lastAssume).toBeLessThan(firstNapkin)
  })

  it('defaults: doubling disk read parallelism removes the forced cache', () => {
    // 8 ÷ 100 µs = 80,000/s → 16 ÷ 100 µs = 160,000/s.
    // 34,722.22 ÷ 160,000 = 21.7%, under the 30% that forces a cache.
    const f = sensitivity(vals(), req()).find((x) => x.id === 'ioDepth' && x.dir === 'up')!
    expect(f.src).toBe('assume')
    expect(f.changes).toContain('a cache is no longer forced')
  })

  it('defaults: the shard count is a linear function of an assumed constant', () => {
    // published thresholds span 250 GB to 10 TB per node — a 40x range — so
    // this dial, not the workload, is what sets the shard count
    const f = sensitivity(vals(), req()).find((x) => x.id === 'diskPerNode' && x.dir === 'up')!
    expect(f.changes.some((c) => /shards go from \d+ to \d+/.test(c))).toBe(true)
  })
})

describe('a column is a thing you could install', () => {
  it('every store names real products and one operator running it', () => {
    // "wide-column ring" is an abstraction until you can name what to install,
    // and a scale claim with an operator attached is one someone can check
    STORES.forEach((s) => {
      expect(s.examples.length, s.id).toBeGreaterThan(8)
      expect(s.wild.length, s.id).toBeGreaterThan(40)
    })
  })
})

/* The requirements are a filter, and a filter can in principle remove
   everything. Nothing in `model` handles that case: engineWin seeds a reduce
   with `alive[0]`, and the line after it asserts the result non-null with `!`.
   On an empty list that is `undefined` laundered through a type assertion —
   a crash or a garbage verdict, not a graceful "nothing fits".

   It cannot happen today. The reason is worth writing down, because it is an
   accident rather than a design: NO filter is written to keep a store alive,
   and sharded SQL survives all of them only as a side effect of its own
   capabilities. Seven requirements, two options each, so 128 combinations —
   small enough to simply try all of them rather than argue about it. */
describe('the candidate list can never empty', () => {
  const OPTS = {
    fresh: ['pull', 'push'],
    txn: ['single', 'multi'],
    loss: ['keep', 'rebuild'],
    analytics: ['no', 'yes'],
    access: ['point', 'range'],
    recency: ['stale', 'current'],
    keyShape: ['monotonic', 'scattered'],
  }

  const COMBOS: Req[] = []
  for (const fresh of OPTS.fresh)
    for (const txn of OPTS.txn)
      for (const loss of OPTS.loss)
        for (const analytics of OPTS.analytics)
          for (const access of OPTS.access)
            for (const recency of OPTS.recency)
              for (const keyShape of OPTS.keyShape)
                COMBOS.push({ fresh, txn, loss, analytics, access, recency, keyShape })

  /* Two of the five disqualifications are load-dependent, not requirement-
     dependent — the in-memory RAM check and the single-primary shard check —
     so the sweep has to move along the load axis too. Every value sits on its
     own ladder, the same rule the sliders obey. */
  const SCALES: { name: string; v: Vals }[] = [
    { name: 'one small box', v: vals({ dau: 1e4, actions: 1, peak: 1, fanout: 0, writeSize: 1, readSize: 1, retention: 1 }) },
    { name: 'defaults', v: vals() },
    { name: 'very large', v: vals({ dau: 5e8, actions: 200, peak: 10, fanout: 1000, writeSize: 5000, readSize: 10000, retention: 60 }) },
  ]

  it('every requirement combination, at every scale, leaves a store standing', () => {
    expect(COMBOS.length).toBe(128)
    SCALES.forEach((s) =>
      COMBOS.forEach((r) => {
        const m = model(s.v, r)
        const alive = m.eCols.filter((c) => !c.dq).map((c) => c.id)
        const where = `${s.name} · ${Object.values(r).join('/')}`
        expect(alive.length, where).toBeGreaterThan(0)
        // and the winner has to be one of the survivors rather than the
        // undefined the `!` would otherwise hide
        expect(alive, where).toContain(m.engineWin)
      }),
    )
  })

  it('names the store the guarantee actually rests on', () => {
    /* A canary. If this list ever stops containing sqlShard, the test above
       is one new filter away from failing, and whoever added that filter
       should find out here rather than from a blank verdict in production. */
    const universal = STORES.filter((st) =>
      SCALES.every((s) => COMBOS.every((r) => !model(s.v, r).eCols.find((c) => c.id === st.id)!.dq)),
    ).map((st) => st.id)
    expect(universal).toContain('sqlShard')
  })
})
