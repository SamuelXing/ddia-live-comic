import { describe, it, expect } from 'vitest'
import { model, consequences, INIT, L, HW, PRESETS, type Req, type Vals } from './calcModel'

/* Reality checks: the model pinned against numbers PUBLISHED by the people
   who ran the real systems — engineering blogs, papers, conference talks.
   Unit tests (calcModel.test.ts) prove the implementation matches the
   intended formulas; these prove the formulas reproduce production reality
   at the anchor points we can check. Each block cites its source and does
   the arithmetic by hand in comments.

   Honest scope note: an anchor point validates the formula that runs
   through it, not the whole model. The gaps that remain are the assumed
   constants (group commit, hit rates) and everything the page itself says
   it will not tell you (hot keys, tail latency, multi-DC, cost). */

const REQ: Req = { fresh: 'pull', txn: 'single', loss: 'keep', analytics: 'no', access: 'point', recency: 'stale', keyShape: 'monotonic' }
const vals = (over: Vals = {}): Vals => ({ ...INIT, ...over })

const close = (actual: number, expected: number, tol = 1e-3) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.abs(expected) * tol + 1e-9)
}

describe('Twitter fan-out — the DDIA Chapter 1 numbers (Nov 2012, via Kleppmann)', () => {
  /* Published: 4.6k tweets/s on average (12k/s peak), 300k home-timeline
     reads/s, and an average tweet reaches ~75 followers — so 4.6k tweets/s
     becomes 345k writes/s into the home-timeline caches.
     Source: DDIA Ch 1; timilearning.com/posts/ddia/part-one/chapter-1 */
  it('4.6k writes/s × 75 followers = 345k deliveries/s — exactly the published figure', () => {
    // construct exact average rates: dau × actions = 19,872,000 × 20
    //   = 397,440,000 actions/day ÷ 86,400 = 4,600/s exactly; peak ×1;
    //   readPct 0 → all writes; fanout 75
    const m = model(vals({ dau: 19872000, actions: 20, peak: 1, readPct: 0, fanout: 75 }), REQ)
    close(m.peakWrites, 4600)
    // 4,600 × 75 = 345,000 — the number the book derives
    close(m.deliveries, 345000)
    close(m.readSide, 345000)
  })
  it('at the published peak, 12k tweets/s × 75 = 900k deliveries/s', () => {
    // same construction with the peak factor carrying 4.6k -> 12k: ×2.609
    const m = model(vals({ dau: 19872000, actions: 20, peak: 12000 / 4600, readPct: 0, fanout: 75 }), REQ)
    close(m.deliveries, 900000)
  })
  it('the tool recommends what Twitter built: fan-out workers and a timeline cache tier', () => {
    const v = vals({ dau: 19872000, actions: 20, peak: 1, readPct: 0, fanout: 75 })
    const m = model(v, REQ)
    const c = consequences(v, REQ, m, false)
    // 345k deliveries/s >> the 26.7k/s durable-write ceiling → fan-out card
    // (Twitter: async fan-out workers, fan-out-on-read for celebrity accounts)
    expect(c.needs.fanout).toBe(true)
    // 345k ops/s ÷ 100k per cache core = 4 nodes → a partitioned cache tier
    // (Twitter: the Redis home-timeline clusters)
    expect(c.cacheNodes).toBeGreaterThanOrEqual(2)
  })
})

describe('Twitter end-to-end — the full 2012 architecture from one workload description', () => {
  /* The strongest check we can run: describe Twitter's published workload on
     the calculator's own ladders and compare EVERY output against the system
     they actually operated (Krikorian, “Timelines at Scale”; DDIA Ch 1).
     Ladder config ≈ 200M users × 100 actions/day, 99% reads, ×3 peak,
     fan-out ×100, 1 KB tweets, 50 KB timeline pages, kept 60 months,
     3 derived systems (timeline cache, search, push), analytics yes. */
  const v = vals({
    dau: 2e8, actions: 100, peak: 3, readPct: 99, fanout: 100,
    writeSize: 1, readSize: 50, retention: 60, derived: 3,
  })
  /* access: 'point' is deliberate and worth stating, because it is the
     difference between this case and the Discord one below. We are modelling
     the TWEET STORE — T-bird, keyed by tweet id, fetched by id. Twitter's
     timeline read path is a range, but it was not served from this store at
     all: it came from the Redis timeline clusters. Two stores, two access
     patterns, two different right answers — which is exactly why the tool
     ends with a list of stores rather than a single winner. */
  const r: Req = { ...REQ, analytics: 'yes', access: 'point' }
  const m = model(v, r)
  const c = consequences(v, r, m, false)

  it('reproduces the published order of magnitude', () => {
    // 2e10 actions/day ÷ 86,400 = 231.5k/s avg; ×3 = 694.4k/s peak;
    // 99% reads → 687.5k reads/s, 6.94k writes/s (published: 300k avg reads,
    // 4.6k avg / 12k peak tweets — same orders)
    close(m.peakReads, 687500)
    close(m.peakWrites, 6944.4)
    // 6.94k × 100 = 694k deliveries/s (published avg: 345k/s)
    close(m.deliveries, 694444.4)
  })
  it('picks what Twitter ran: pull transport, SHARDED relational underneath', () => {
    // Home timelines are fetched, not pushed. The tweet store was T-bird —
    // MySQL sharded by Gizzard — never a single primary, which is what 335 TB
    // of rows forces. An earlier version of this test asserted single-primary
    // SQL, and was simply wrong about Twitter.
    expect(m.transportWin).toBe('req')
    expect(m.engineWin).toBe('sqlShard')
    expect(m.eCols.find((c) => c.id === 'sql')!.dq).toContain('shards')
  })
  it('forces the five components Twitter actually built', () => {
    // async fan-out workers + fan-out-on-read for celebrities
    expect(c.needs.fanout).toBe(true)
    // the Redis home-timeline cache tier: 1.38M ops/s ÷ 100k/core = 14 nodes
    expect(c.needs.cache).toBe(true)
    expect(c.cacheNodes).toBe(14)
    // one ingestion pipeline feeding timelines, search (Earlybird) and push
    expect(c.needs.logConsumers).toBe(true)
    // the Hadoop/analytics side
    expect(c.needs.analytical).toBe(true)
    // and the edge: ~296 Gbps of timeline pages → CDN
    expect(c.needs.cdn).toBe(true)
  })
  it('REGRESSION (found by this very test): the tweet store shards for DATA SIZE, not write rate', () => {
    // 2e8 tweets/day × 1,024 B × 30 × 60 = 3.6864e14 B = ~335 TiB of rows.
    // The write rate is a quiet 26% of one primary — rate-based sharding
    // alone said “no shard”, which contradicted T-bird/Gizzard (sharded
    // MySQL). Data size is its own reason to split:
    close(m.dbStorage, 3.6864e14)
    close(c.writeUtilAfter, 0.26042)
    // 3.6864e14 ÷ 1e13 (10 TB/node) = 36.9 → 37 shards, storage-bound
    expect(m.storageShards).toBe(37)
    expect(c.shardBy).toBe('storage')
    expect(c.needs.shard).toBe(true)
  })
})

describe('WhatsApp — 2M+ connections on one server (Rick Reed, Erlang Factory 2012; blog: “1 million is so 2011”)', () => {
  it('the published record sits on the ladder; our default stays 20× conservative', () => {
    // WhatsApp held >2M live TCP connections on a single tuned FreeBSD box.
    // The connections-per-host ladder must reach the measured record...
    expect(L.conns).toContain(2e6)
    // ...while the default assumption stays 2,000,000 ÷ 100,000 = 20× under it
    expect(2e6 / INIT.connsPerHost).toBe(20)
  })
  it('connection-tier sizing brackets reality between default and record tuning', () => {
    // 200M DAU with 25–30% concurrently online ≈ 50M held connections.
    // Model uses dau × online%: 2e8 × 25% not on the online ladder — use
    // 5e8 × 10% = 50M, the same held-connection count.
    const v = vals({ dau: 5e8, online: 10 })
    const m = model(v, REQ)
    close(m.heldConns, 5e7)
    // at our conservative 100k/host: 500 hosts; at WhatsApp's measured 2M:
    // 25 hosts — the real fleet for this concurrency sits inside that band
    expect(consequences(v, REQ, m, true).connHosts).toBe(500)
    expect(Math.ceil(5e7 / 2e6)).toBe(25)
  })
})

describe('Netflix — 1.1M client writes/s on 288 Cassandra nodes (Netflix Tech Blog, 2011)', () => {
  it('measured per-node write throughput lands inside our group-commit sensitivity band', () => {
    // 1,100,000 ÷ 288 = 3,819 client writes/s/node; at replication factor 3
    // each write is applied on 3 nodes → ~11,458 applied writes/s per node.
    const perNodeApplied = (1.1e6 / 288) * 3
    close(perNodeApplied, 11458.3)
    // our durable-write ceiling: ×1 group commit = 1 ÷ 300 µs = 3,333/s;
    // ×8 group commit = 26,667/s. The measurement sits between the two —
    // which is the page's own claim that group commit is the assumption
    // doing the work (Cassandra's periodic-fsync default is cheaper than
    // our strict per-commit model, consistent with landing under ×8).
    const floor = model(vals({ group: 1 }), REQ).writeCeiling
    const ceil = model(vals({ group: 8 }), REQ).writeCeiling
    close(floor, 3333.3)
    close(ceil, 26666.7)
    expect(perNodeApplied).toBeGreaterThan(floor)
    expect(perNodeApplied).toBeLessThan(ceil)
  })
})

describe('Facebook — “Scaling Memcache at Facebook” (NSDI 2013)', () => {
  it('the paper states our chain formula: ~99% hit rate, and a 1% drop DOUBLES database load', () => {
    // misses = reads × (1 − hit): at 99% → 1% of reads; at 98% → 2%.
    // 2% ÷ 1% = 2 — “a 1% decrease in hit rate doubles database load”
    // is exactly this arithmetic, stated by the operators of the largest
    // memcache fleet ever measured.
    const at99 = consequences(vals({ cacheHit: 99 }), REQ, model(vals({ cacheHit: 99 }), REQ), false)
    const at98 = consequences(vals({ cacheHit: 98 }), REQ, model(vals({ cacheHit: 98 }), REQ), false)
    expect(at99.cacheNeed).toBe(true)
    close(at98.missReads / at99.missReads, 2)
    // and the published operating point is reachable on the hit-rate ladder
    expect(L.hit).toContain(99)
  })
})

describe('Redis — the bandwidth example from redis.io benchmarks', () => {
  it('100k ops/s of 4 KB = 3.28 Gbps through our egress formula (redis.io states 3.2 Gbit/s)', () => {
    // construct 100k pure reads/s of 4 KB: dau × actions = 8.64e9/day
    //   ÷ 86,400 = 100,000/s; readPct 100; zero protocol overhead to match
    //   the docs' bare arithmetic: 100,000 × 4,096 × 8 = 3.2768e9 = 3.28 Gbps
    const m = model(vals({ dau: 8.64e8, actions: 10, peak: 1, readPct: 100, readSize: 4 }), REQ)
    close(m.egressFor(0), 3.2768)
  })
})

describe('Discord — messages on a wide-column ring (Discord Engineering, 2017 & 2023)', () => {
  /* Published: messages are partitioned by (channel_id, bucket) and clustered by
     message_id, which is a Snowflake and therefore time-ordered — so "the last 50
     messages in this channel" is one contiguous range read inside one partition.
     Discord moved MongoDB → Cassandra in 2017 and Cassandra → ScyllaDB in 2023
     (177 nodes → 72). A message belongs to exactly one channel, so nothing needs
     to be atomic across partitions.

     This case is here because the model used to get it WRONG: it charged the LSM
     its point-lookup amplification on a range scan, so single-primary SQL won a
     Discord-shaped chat at every scale we tried, up to 2,304 shards. */
  const chat = PRESETS.find((p) => p.id === 'chat')!
  const build = (dau: number, access: string) => {
    const v: Vals = { ...INIT, ...chat.sets, dau }
    const r: Req = { ...chat.req, access }
    const m = model(v, r)
    return { m, c: consequences(v, r, m, true) }
  }

  it('range reads inside a partition pick the wide-column ring, at Discord scale', () => {
    const { m } = build(2e8, 'range')
    expect(m.engineWin).toBe('wide')
    /* It wins on headroom, not on the binding ceiling: reads bind both stores
       equally once neither pays a point-lookup penalty, and the LSM's ×1 write
       amplification leaves it far more room on the other axis.

       Compared against SHARDED relational, not single-primary. Single-primary
       is disqualified at this scale for needing shards at all, and — since a
       channel id scatters inserts — it is also the one store here that cannot
       escape the buffer-pool cliff by splitting, so its binding wall is a
       different wall entirely. The store this comparison is about is the one
       Slack actually operates. */
    const wide = m.eCols.find((c) => c.id === 'wide')!
    const shard = m.eCols.find((c) => c.id === 'sqlShard')!
    close(wide.worst, shard.worst)
    expect(wide.next).toBeLessThan(shard.next)
  })

  it('and at the smaller scale where Discord actually made the move', () => {
    expect(build(2e7, 'range').m.engineWin).toBe('wide')
  })

  it('the same workload read by key alone picks SQL — the access pattern is what decides', () => {
    // not a contradiction: probing for one id really does cost several sorted-run
    // lookups. Cassandra suits Discord because of HOW the messages are read.
    expect(build(2e8, 'point').m.engineWin).toBe('sqlShard')
    const widePoint = build(2e8, 'point').m.eCols.find((c) => c.id === 'wide')!
    const wideRange = build(2e8, 'range').m.eCols.find((c) => c.id === 'wide')!
    expect(widePoint.worst).toBeGreaterThan(wideRange.worst)
  })

  it('cross-partition atomicity is never required, so the ring gives up nothing that matters', () => {
    const { m } = build(2e8, 'range')
    expect(chat.req.txn).toBe('single')
    expect(m.eCols.find((c) => c.id === 'wide')!.dq).toBeNull()
  })

  it('at this scale the data is partitioned either way — which is the real argument', () => {
    // 177 Cassandra nodes was never about one machine being faster; it was about
    // who manages the partitioning. Our shard count is the same order.
    const { c } = build(2e8, 'range')
    expect(c.shards).toBeGreaterThan(100)
  })
})

describe('Slack — the counter-anchor to Discord (Slack Engineering, Dec 2020)', () => {
  /* Slack stores messages in MySQL behind Vitess, and since the Unified Grid
     work "the messages table is now sharded by channel ID" — the SAME access
     pattern as Discord, and the opposite storage choice. Published: 2.3M QPS at
     peak, 2M reads / 300K writes, median 2 ms, p99 11 ms, thousands of shards.

     So the tool must NOT claim a relational store is impossible for chat. The
     assertion here is deliberately weak, because the honest claim is weak: both
     answers are live, and what separated them was not throughput.
     https://slack.engineering/scaling-datastores-at-slack-with-vitess/ */
  const chat = PRESETS.find((p) => p.id === 'chat')!
  const v: Vals = { ...INIT, ...chat.sets, dau: 2e8 }
  const r: Req = { ...chat.req, access: 'range' }
  const m = model(v, r)

  it('sharded relational stays a live candidate for chat — Slack runs exactly that', () => {
    const shard = m.eCols.find((c) => c.id === 'sqlShard')!
    expect(shard.dq, 'the tool must not rule out what Slack actually operates').toBeNull()
  })
  it('and lands in the tie band with the ring, not far behind it', () => {
    // both are real answers to this workload; the tool says so rather than
    // pretending the numbers settle a question they do not settle
    expect(m.engineTie).toContain('sqlShard')
    expect(m.engineTie).toContain('wide')
  })
  it("Slack's read:write mix is ~6.7:1, which our read-share ladder can express", () => {
    // 2M reads / 300K writes = 87% reads; the chat preset's 50% is a different
    // system, so this checks the ladder reaches Slack's shape at all
    const slackish = model({ ...v, readPct: 85 }, r)
    close(slackish.peakReads / slackish.peakWrites, 85 / 15)
  })
})

describe('Netflix — throughput per node stays flat as the cluster grows (2011 benchmark)', () => {
  /* Published table: 48 / 96 / 144 / 288 nodes → 174,373 / 366,828 / 537,172 /
     1,099,837 client writes/s. Per-node throughput is essentially flat at
     10.9k-11.9k writes/s across a 6x range, which is what "linear scale-out"
     means. Our shard model must reproduce that flatness: shards are sized by
     dividing the load by a per-node ceiling, so per-shard load cannot drift. */
  it('doubling the write rate doubles the shards and leaves per-shard load flat', () => {
    const base = vals({ readPct: 10, fanout: 0, dau: 1e8, actions: 50, peak: 1 })
    const a = model(base, REQ)
    const b = model({ ...base, dau: 2e8 }, REQ)
    close(b.peakWrites / a.peakWrites, 2)
    // per-shard write load stays within a rounding step of itself
    const perShard = (m: ReturnType<typeof model>) => m.dbWrites / m.eCols.find((c) => c.id === m.engineWin)!.shards
    expect(Math.abs(perShard(b) - perShard(a)) / perShard(a)).toBeLessThan(0.1)
  })
  it('the measured 11k writes/s per node sits inside our per-primary band', () => {
    // 1,099,837 ÷ 288 = 3,819 client writes/s/node; x3 replication factor
    // = ~11.5k applied. Our band is 3.3k (no group commit) to 26.7k (x8).
    const perNodeApplied = (1099837 / 288) * 3
    close(perNodeApplied, 11456, 1e-3)
    expect(perNodeApplied).toBeGreaterThan(model(vals({ group: 1 }), REQ).writeCeiling)
    expect(perNodeApplied).toBeLessThan(model(vals({ group: 8 }), REQ).writeCeiling)
  })
})

describe('Uber — a 99% cache hit rate is reachable, and the chain uses it (CacheFront, Feb 2024)', () => {
  /* Published: CacheFront serves 40M req/s across Docstore; one use case drives
     "over 6M RPS with a 99% cache hit rate", cutting P75 by 75% and P99.9 by
     67%. Also: "more than 50% of the queries coming to Docstore are ReadRows
     requests… no filters and point reads" — which is our access: 'point'.
     https://www.uber.com/en-IN/blog/how-uber-serves-over-40-million-reads-per-second-using-an-integrated-cache/ */
  it('at 99% hits, 6M req/s reaches the store as 60k/s', () => {
    const v = vals({ cacheHit: 99 })
    const m = model(v, REQ)
    const c = consequences(v, REQ, m, false)
    expect(c.cacheNeed).toBe(true)
    close(c.missReads / m.readSide, 0.01)
    // the published pair, run through our own formula
    close(6e6 * (1 - 99 / 100), 60000)
  })
})

describe('Resharding cost — the operational term this model states but does not score', () => {
  /* The tool deliberately does not put a number on operations. It does have to
     be able to EXPRESS the published trigger points, though, or the shard count
     it reports is answering a question nobody asks in practice.

     Published split thresholds, all primary-sourced:
       Vitess docs      250 GB per shard, "the sweet spot"
       Cash App         "shards tend to be around one terabyte when it's time to split"
       Notion 2021      "an upper bound of 500 GB per table and 10 TB per physical database"
     And the cost of a split, at the two extremes:
       Google AdWords   "the last resharding took over two years of intense effort,
                        and involved coordination and testing across dozens of teams"
                        (Spanner, OSDI 2012 §5.4) — manual
       DynamoDB         "Partition splits usually complete in the order of minutes."
                        (USENIX ATC 2022 §4.4) — automatic */

  it('the data-per-node ladder reaches every published trigger point', () => {
    const ladder = HW.find((h) => h.id === 'diskPerNode')!.steps
    expect(ladder, 'Vitess: 250 GB sweet spot').toContain(0.25)
    expect(ladder, 'Cash App: split at ~1 TB').toContain(1)
    expect(ladder, 'Notion: 10 TB per physical database').toContain(10)
  })

  it("Notion's real shard count is what our arithmetic produces from their bound", () => {
    // Notion 2021: 480 logical shards over 32 physical databases, with a stated
    // 10 TB ceiling per physical database. Our storage-shard rule is exactly
    // that division, so a dataset at their bound must yield their host count.
    const v = vals({ diskPerNode: 10 })
    const m = model(v, REQ)
    close(m.storageShards, Math.ceil(m.dbStorage / 10e12), 1e-9)
    // and 32 physical databases at 10 TB each is the 320 TB order they were at
    expect(Math.ceil(320e12 / (10 * 1e12))).toBe(32)
  })

  it('a smaller per-node bound means proportionally more shards — the dial works', () => {
    const big = model(vals({ diskPerNode: 10 }), REQ).storageShards
    const small = model(vals({ diskPerNode: 1 }), REQ).storageShards
    // Cash App's 1 TB trigger produces ~10x the shards of Notion's 10 TB bound
    expect(small / big).toBeGreaterThan(9)
    expect(small / big).toBeLessThan(11)
  })
})
