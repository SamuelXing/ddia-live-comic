/* ============================================================
   The calculator's arithmetic, as a pure module.

   No React, no formatting, no prose — inputs in, numbers and
   decisions out, so every derivation, filter, ranking and chain
   transformation is unit-testable in isolation (calcModel.test.ts).
   The thesis implemented here: REQUIREMENTS FILTER, LOAD RANKS,
   CEILINGS FORCE — and each forced addition transforms the load
   every later tier (including the engine columns) actually sees.
   ============================================================ */

export interface Inp {
  id: string
  label: string
  /** the only values this input can take — a 1-2-5 ladder, so you choose a
   *  scale rather than a falsely precise number. 16k is not a real input. */
  steps: number[]
  val: number
  fmt: (v: number) => string
  hint: string
  /** the longer "what does this limit actually mean" note, shown on hover/focus */
  info?: string
}

export interface Opt {
  id: string
  label: string
  info: string
}

export type Vals = Record<string, number>
export interface Req {
  fresh: string
  txn: string
  loss: string
  analytics: string
  /** primary read shape: point lookup or ordered range */
  access: string
  /** may a read be answered from a copy that has not caught up? */
  recency: string
  /** where a new row lands in the sort order: at the end, or anywhere */
  keyShape: string
}

const int = (n: number) => Math.round(n).toLocaleString('en-US')
const compact = (n: number): string => {
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k'
  return Math.round(n).toString()
}
const bytes = (b: number): string => {
  const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let i = 0
  while (b >= 1024 && i < u.length - 1) {
    b /= 1024
    i++
  }
  return (b >= 100 ? Math.round(b) : Math.round(b * 10) / 10) + ' ' + u[i]
}

export const L = {
  count: [1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6, 2e6, 5e6, 1e7, 2e7, 5e7, 1e8, 2e8, 5e8],
  small: [1, 2, 5, 10, 20, 50, 100, 200],
  mult: [1, 1.5, 2, 3, 5, 10],
  pct: [0, 10, 20, 30, 40, 50, 60, 70, 75, 80, 85, 90, 95, 99],
  kb: [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000],
  ms: [5, 10, 20, 50, 100, 200, 500, 1000],
  mo: [1, 3, 6, 12, 24, 36, 60],
  growth: [0, 1, 2, 5, 10, 20, 50],
  pow2: [1, 2, 4, 8, 16, 32, 64],
  /* 300 breaks the 1-2-5 pattern on purpose: fsync is a MEASURED constant, and
     a measured value has to be exactly representable or the slider thumb sits
     on one number while the label prints another. The ladder rule is for
     estimates; a measurement outranks it. */
  us: [10, 20, 50, 100, 200, 300, 500, 1000, 2000, 5000],
  gbps: [1, 2, 5, 10, 25, 40, 100],
  slots: [4, 8, 16, 32, 64, 128, 256, 512, 1024],
  amp: [1, 2, 3, 5, 10, 20],
  fan: [0, 1, 2, 5, 10, 50, 100, 500, 1000],
  onl: [1, 2, 5, 10, 20, 30, 50],
  /** tops out at 2M — the published record for one tuned box (WhatsApp, 2012) */
  conns: [1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6, 2e6],
  views: [0, 1, 2, 3, 4, 5],
  hit: [50, 70, 80, 90, 95, 99],
}

export const WORKLOAD: Inp[] = [
  { id: 'dau', label: 'Daily active users', steps: L.count, val: 5e7, fmt: (v) => compact(v), hint: 'Or any daily population driving the system.', info: 'The population driving the system on a normal day. Everything downstream scales from it, so it is worth stating the assumption out loud rather than reaching for a request rate directly.' },
  { id: 'actions', label: 'Actions / user / day', steps: L.small, val: 20, fmt: (v) => int(v) + '/day', hint: 'Requests one active user makes in a day.', info: 'How many requests one active user generates per day. A read-heavy feed might be 50; a banking app might be 3. This times users is your daily volume.' },
  { id: 'peak', label: 'Peak factor', steps: L.mult, val: 3, fmt: (v) => '×' + v, hint: 'Busiest moment vs the daily average.', info: 'Traffic is never flat. The busiest minute usually runs a few times the daily average — more for consumer apps with an evening peak, less for global systems whose load spreads across time zones. You must size for the peak, not the average.' },
  { id: 'readPct', label: 'Read share', steps: L.pct, val: 85, fmt: (v) => v + '% reads', hint: 'Reads cache and replicate. Writes are the wall.', info: 'The split matters more than the total, because reads and writes scale differently: reads spread across caches and replicas, while writes all funnel to one place until you shard. A system that is 99% reads is a very different machine from one that is 50% writes.' },
  { id: 'fanout', label: 'Deliveries per write', steps: L.fan, val: 1, fmt: (v) => (v === 0 ? 'none' : '×' + int(v)), hint: 'A message to a 50-person group is 50 deliveries. 0 = write-only ingest.', info: "How many people a single write must reach. For 1:1 messaging it is 1; for a group chat it is the group size; for a social feed it is the follower count; for sensor ingest nobody is waiting, so it is 0. This is the multiplier that decides whether you fan out on write or on read — and it is usually the number that breaks a design, because the write side is cheap while the delivery side is not." },
  { id: 'online', label: 'Peak concurrently online', steps: L.onl, val: 10, fmt: (v) => v + '% of DAU', hint: 'Share of daily users present at the same moment.', info: 'What fraction of a day’s users are present at the busiest moment. It only turns into held connections if the transport keeps one open per user — which is exactly what the transport decision on the right computes.' },
  { id: 'writeSize', label: 'Avg written object', steps: L.kb, val: 2, fmt: (v) => bytes(v * 1024), hint: 'What one write stores. Drives disk and storage.', info: 'The size of what a write actually persists — a message, an order row, an event. It multiplies into storage, disk bandwidth and delivery egress. Kept separate from the read response below, because in most systems they differ wildly: you write a 2 KB message and read back a 50 KB page.' },
  { id: 'readSize', label: 'Avg read response', steps: L.kb, val: 50, fmt: (v) => bytes(v * 1024), hint: 'What one read returns. Drives egress.', info: 'The size of what a read sends back — a page, a timeline, an API response, usually an assembly of many stored objects. This is what network egress is made of, which is why it is a different slider from the written object: conflating them muddles the disk bill with the bandwidth bill.' },
  { id: 'lat', label: 'Avg request latency', steps: L.ms, val: 100, fmt: (v) => v + ' ms', hint: 'Service time per request, for Little’s Law.', info: "How long the server spends on one request. With Little's Law it decides how many instances you need: halve the latency and you halve the fleet, which is why profiling often beats autoscaling." },
  { id: 'retention', label: 'Data retention', steps: L.mo, val: 12, fmt: (v) => v + ' mo', hint: 'How long writes are kept.', info: 'How long you keep writes before deleting or archiving them. Storage is retention times daily volume, so a policy decision — not a technical one — usually sets your disk bill.' },
  { id: 'growth', label: 'Monthly growth', steps: L.growth, val: 10, fmt: (v) => v + '%/mo', hint: 'Compounded, for the runway estimate.', info: "Compounded month over month. Its real use is not the 12-month number but the runway: how long before today's comfortable headroom becomes next quarter's incident." },
]

/** the derived-views requirement is a count, so it renders as a slider */
export const DERIVED_INP: Inp = {
  id: 'derived', label: 'Who else must see each write', steps: L.views, val: 1,
  fmt: (v) => (v === 0 ? 'none' : int(v)),
  hint: 'The search index, the analytics table, the cache — count the copies.',
  info: 'When a user posts a message, the primary database stores it — but the search index must also index it, the cache must drop the stale page, the analytics table must count it. Count those OTHER systems. Each one holds a copy of the same fact, and copies drift: write to each directly and a crash between writes, or two updates racing in different orders, makes them disagree — quietly, forever. One copy is easy to wire by hand. At two or more, this page recommends writing once to a log and letting every copy replay the same order.',
}

/** src: 'napkin' = measured constant; 'assume' = a modelling choice you should challenge */
export const HW: (Inp & { src: 'napkin' | 'assume' })[] = [
  { id: 'fsync', label: 'SSD write + fsync', steps: L.us, val: 300, src: 'napkin', fmt: (v) => v + ' µs', hint: 'The cost of making one write durable. Sets the write ceiling.', info: 'A write is not durable until the drive confirms it is on stable media — that confirmation is fsync, and it costs roughly 1000x more than writing to memory. Every committed transaction pays it. That is why this one number sets the ceiling for any database that promises not to lose your data.' },
  { id: 'group', label: 'Transactions per fsync', steps: L.pow2, val: 8, src: 'assume', fmt: (v) => '×' + int(v), hint: 'Group commit: how many commits share one fsync.', info: 'Databases batch concurrent commits so a single fsync makes several transactions durable at once. Under load the batch fills and throughput multiplies; with one lonely transaction at a time you get no batching at all. This is the biggest assumption on the page: at x1 the ceiling is ~3.3k writes/s, at x8 it is ~27k.' },
  { id: 'randRead', label: 'Random SSD read (8 KiB)', steps: L.us, val: 100, src: 'napkin', fmt: (v) => v + ' µs', hint: 'What a cache miss costs when it reaches disk.', info: 'What a cache miss costs once it reaches disk. Sequential reads stream at gigabytes per second, but a random 8 KiB read costs ~100 us — thousands of times slower than the same bytes in RAM. This gap is the entire reason caches exist.' },
  { id: 'ioDepth', label: 'Concurrent disk reads', steps: L.pow2, val: 8, src: 'assume', fmt: (v) => '×' + int(v), hint: 'NVMe serves many reads at once; this multiplies read throughput.', info: "A spinning disk served one read at a time; NVMe keeps many in flight, so throughput is queue depth divided by latency rather than one over latency. Real drives sustain far deeper queues — x8 is a deliberately conservative stand-in for one database's effective read parallelism." },
  { id: 'seqRead', label: 'Sequential SSD read', steps: [1, 2, 4, 8, 16], val: 8, src: 'napkin', fmt: (v) => v + ' GiB/s', hint: 'Streaming a file end to end. Sets full-scan time.', info: 'Reading a file front to back streams ~80x faster than hopping around it — 8 GiB/s vs the equivalent of ~70 MiB/s for random 8 KiB reads. Dividing your stored bytes by this number tells you how long a full table scan takes, which is the arithmetic behind “do not run analytics on the primary.”' },
  { id: 'seqWrite', label: 'Sequential SSD write', steps: [1, 2, 3, 5, 10], val: 3, src: 'napkin', fmt: (v) => v + ' GiB/s', hint: 'Streaming bandwidth, before fsync. The write-stream budget.', info: 'How fast one node can stream bytes to disk when it does not wait for fsync on each one. The engine decision compares each engine’s write stream — logical writes times its amplification — against this budget.' },
  { id: 'cacheOp', label: 'Cache op, CPU cost', steps: [1, 2, 5, 10, 20, 50, 100], val: 10, src: 'assume', fmt: (v) => v + ' µs', hint: 'Two syscalls cost ~0.6 µs; parsing and the network stack are the rest.', info: 'What one cache command costs the server end to end. The floor is two syscalls (~0.6 us) plus a hash and a memory lookup; parsing, the event loop and the network stack are what actually dominate. Because a cache shard executes commands one at a time on one core, this number IS its throughput.' },
  { id: 'cacheHit', label: 'Cache hit rate', steps: L.hit, val: 90, src: 'assume', fmt: (v) => v + '%', hint: 'Reads the cache absorbs before the database sees them.', info: 'The share of reads answered from memory instead of disk. It depends entirely on access skew — a feed where everyone reads the same hot posts caches beautifully; uniform random access barely caches at all. This is the single most consequential assumption on the page: it decides how much read load survives to hit the database.' },
  { id: 'cdnHit', label: 'CDN offload', steps: L.hit, val: 80, src: 'assume', fmt: (v) => v + '%', hint: 'Egress served from the edge instead of your origin.', info: 'The share of bytes the CDN serves from its edge instead of your origin. High for static objects and popular media; low for personalized or private responses. Whatever it does not absorb still needs origin NICs.' },
  { id: 'nic', label: 'Origin NIC', steps: L.gbps, val: 10, src: 'assume', fmt: (v) => v + ' Gbps', hint: 'Per-host egress capacity before you need more hosts or a CDN.', info: 'How many bits one host can push. For media-heavy systems bandwidth is usually the first ceiling you hit — you run out of network long before CPU or disk. Once peak egress exceeds this you either add hosts purely for bandwidth, or move the bytes to a CDN.' },
  { id: 'overhead', label: 'Protocol overhead / message', steps: [2, 10, 50, 100, 200, 500, 800, 1500], val: 800, src: 'assume', fmt: (v) => v + ' B', hint: 'Bytes each message costs beyond the payload. Set by the transport choice.', info: 'HTTP repays request and response headers on every exchange — often several hundred bytes, which dwarfs a short chat message. A WebSocket frame costs a handful of bytes. When payloads are small, the protocol can cost more than the data. The transport decision writes this value; you can still drag it.' },
  { id: 'readAmp', label: 'Files touched per read', steps: [0, 1, 2, 3, 5], val: 1, src: 'assume', fmt: (v) => (v === 0 ? 'none (RAM)' : '×' + v), hint: 'Disk lookups per read. Set by the engine choice.', info: 'How many disk lookups one read costs — and it depends on the OPERATION, not just the store. Probing for a single key in an LSM means checking the memtable and several sorted files (bloom filters skip most, but not for free), while sweeping a range inside one partition is a single pass over sorted, contiguous rows. A B-tree walks to one leaf either way; an in-memory store touches no disk at all. The store decision writes this value, resolved for the access pattern you chose.' },
  { id: 'writeAmp', label: 'Write amplification', steps: L.amp, val: 3, src: 'assume', fmt: (v) => '×' + int(v), hint: 'Bytes written per logical write. Set by the engine choice.', info: 'One logical row write touches the disk more than once: the write-ahead log, the page itself, and every index that must be updated. x3 is modest — a table with several indexes is worse. The engine decision writes this value; raise it if your tables carry many indexes.' },
  { id: 'connsPerHost', label: 'Connections per host', steps: L.conns, val: 1e5, src: 'assume', fmt: (v) => compact(v), hint: 'Live connections one server can hold.', info: 'Bounded by memory per connection, file descriptors, and the CPU spent on heartbeats — not by request rate. The published record is ~2M on one heroically tuned FreeBSD box (WhatsApp, 2012); a default-configured server manages far fewer. 100k is a deliberately conservative default — 20× under the record.' },
  { id: 'slots', label: 'Concurrency per instance', steps: L.slots, val: 64, src: 'assume', fmt: (v) => int(v) + ' slots', hint: 'In-flight requests one app instance handles.', info: "How many requests one instance can have in flight at once — threads, workers, or async tasks. Little's Law turns it into a machine count. Raising it does not create capacity when the work is CPU-bound; it just lets more requests queue." },
  { id: 'ram', label: 'RAM per node', steps: [16, 32, 64, 128, 256, 512, 1024], val: 128, src: 'assume', fmt: (v) => v + ' GB', hint: 'For the “does it fit in memory” check.', info: 'The feasibility check for an in-memory store is not throughput — it is whether the dataset fits. Stored bytes divided by this number is how many machines of pure RAM you would be buying.' },
  { id: 'diskPerNode', label: 'Data per database node', steps: [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100], val: 10, src: 'assume', fmt: (v) => v + ' TB', hint: 'Past this, the dataset itself forces sharding — rate or no rate.', info: 'Most ceilings are rates, but sheer data size forces a split on its own: backups, replica rebuilds and crash recovery outrun patience long before IOPS do. Published trigger points vary by two orders of magnitude, so this is a real dial rather than a constant — Vitess documents 250 GB per shard as the sweet spot, Cash App splits when a shard reaches about 1 TB, and Notion set an upper bound of 10 TB per physical database. Systems that split automatically go far smaller: CockroachDB ranges are 512 MiB, ScyllaDB tablets target 5 GB.' },
]

/** requirement questions — facts about the promises the system makes.
 *  These FILTER candidates; the load arithmetic only ranks survivors. */
export const FRESH: Opt[] = [
  { id: 'pull', label: 'Users ask for it', info: 'New data appears when the client asks — a refresh, a page load, an occasional poll. Nothing has to be held open, so the transport can stay plain request/response.' },
  { id: 'push', label: 'It must appear', info: 'Chat, presence, live dashboards, collaborative editing: the server must deliver the moment something happens, which means holding something open to every online client.' },
]
export const TXN: Opt[] = [
  { id: 'single', label: 'One key at a time', info: 'Each write touches one row, document or key. Per-key atomicity — which every engine on this page provides — is enough.' },
  { id: 'multi', label: 'Atomic across keys', info: 'Money moves between two accounts; an order reserves stock and charges a card. Several keys must change together or not at all. That is a cross-key transaction, and engines that cannot span partitions are disqualified — arithmetic never overrules this.' },
]
export const LOSS: Opt[] = [
  { id: 'keep', label: 'Must survive', info: 'This is the system of record: an acknowledged write is a promise, even if the node dies a millisecond later. Engines whose durability is optional are disqualified from holding it.' },
  { id: 'rebuild', label: 'Can be rebuilt', info: 'A cache, a session, a feed — losing a node costs a recompute from the source of record, not an apology. Durability stops being a filter, and the in-memory column becomes a real candidate.' },
]
export const ANALYTICS: Opt[] = [
  { id: 'no', label: 'Serve it back', info: 'The data is read back the way it was written — a profile, a message, an order. Point lookups and short ranges; the primary handles it.' },
  { id: 'yes', label: 'Also analyze it', info: 'Someone will run questions across ALL of it — dashboards, reports, aggregates over months. That is a different read pattern: scanning columns of everything rather than fetching one row, and it should not share a disk with the row that must return in 5 ms.' },
]
export const ACCESS: Opt[] = [
  { id: 'point', label: 'Fetch one thing', info: 'Reads name what they want — a user, an order, a message by id. This is what an index is for, and it is the pattern a column-oriented store is worst at: one row lives spread across as many files as it has columns.' },
  { id: 'range', label: 'Scan a range', info: 'Reads sweep an ordered slice — a time window, a feed, everything under one partition key. Sorted layouts win here, and the sort key becomes the most consequential schema decision you will make.' },
]
export const KEY_SHAPE: Opt[] = [
  { id: 'monotonic', label: 'New rows sort last', info: 'Ids that only ever grow — a timestamp, an auto-increment, Snowflake, UUIDv7. Every insert lands at the right-hand edge of the sort order, so a B-tree touches the same leaf page over and over and that page is always in memory. This is the free version, and it is a choice you make once when you pick an id format.' },
  { id: 'scattered', label: 'New rows land anywhere', info: 'Random UUIDs, hashes, natural keys like an email — the insert point is unpredictable. A B-tree has to fetch the leaf page it is about to write, and once the data outgrows RAM that fetch is a disk seek on every single insert. An LSM does not care: it appends to a sorted buffer and puts the row in place later, during compaction. This is the field that decides whether write-heavy means "buy a bigger box" or "change engines".' },
]
export const RECENCY: Opt[] = [
  { id: 'stale', label: 'Slightly stale is fine', info: 'A feed a few seconds behind, a count that lags, a profile that updates eventually. This is what makes caches and read replicas legal — you can answer from a copy that has not caught up yet, which is the cheapest scaling move in this entire tool.' },
  { id: 'current', label: 'Must be current', info: 'An account balance, remaining stock at checkout, a permission check. The read must reflect the write that just happened. Asynchronous replicas cannot serve it — they are behind by definition — and a cache is only safe if writes update or invalidate it in the same breath, which puts the cache on the write path too.' },
]

/** transports the tool decides between; sets{} writes into the visible constants */
export const PROTOCOLS = [
  {
    id: 'req', label: 'Request / response', holds: false, sets: { overhead: 800 },
    info: 'Plain HTTP. Nothing is held between requests, so there is no connection tier to size — but every message repays full headers, and the server cannot push.',
  },
  {
    id: 'poll', label: 'Long polling', holds: true, sets: { overhead: 800 },
    info: 'The client holds a request open waiting for news, then immediately reconnects. You pay for BOTH: a held connection per client and full headers on every message. It is the expensive way to fake push.',
  },
  {
    id: 'ws', label: 'WebSocket / SSE', holds: true, sets: { overhead: 10 },
    info: 'One connection stays open and the server can push down it. Per-message overhead collapses to a few bytes, but every online user costs memory and a file descriptor — so you size a connection tier.',
  },
]

/* ============================================================
   Where the data lives.

   "SQL vs NoSQL" is a category from marketing, not from mechanism —
   "NoSQL" spans document, wide-column, key-value and graph stores that
   share nothing but a negation. What actually decides the answer is four
   roughly independent dimensions, and real products are compositions of
   them:

     data model        relational · document · wide-column · key-value ·
                       column-oriented        — what a record looks like
     storage engine    B-tree · LSM · columnar · in-memory
                                              — read vs write vs space
                                                amplification (the RUM
                                                trade-off, Ch 3)
     distribution      one primary · sharded primaries · leaderless ring
                                              — how writes scale, and who
                                                does the sharding
     atomicity scope   cross-table · per shard · per partition · per key
                                              — how much coordination you
                                                are allowed to ask for

   Keeping them separate matters because they trade off independently:
   choosing an LSM engine used to silently choose ring-based distribution
   too, which is a different decision with different consequences.
   ============================================================ */
export interface Store {
  id: string
  label: string
  short: string
  /** the four dimensions, shown as rows */
  model: string
  engine: string
  dist: string
  txnScope: string
  /** how much cross-key atomicity it can actually offer */
  multiKey: 'yes' | 'shard' | 'no'
  durable: boolean
  /** can it answer "give me this one record" without reading half the table? */
  pointFast: boolean
  /* Read amplification is a property of the OPERATION, not just the engine.
     Probing for one key means checking several sorted runs with bloom filters;
     sweeping a range inside one partition reads sorted, contiguous data in one
     pass. Charging an LSM its point-lookup penalty on a range scan penalised
     Cassandra for the exact workload it is built for — which is why this tool
     used to pick single-primary SQL for a Discord-shaped chat at every scale. */
  /** does one INSERT have to READ a page before it can write it? True for
   *  every B-tree — the row goes where it belongs, so the leaf page has to be
   *  in hand first. False for LSM-family engines, which append to a sorted
   *  buffer in memory and place the row later, in compaction. Only costs
   *  anything when the insert point is unpredictable AND the node is past RAM. */
  sets: { writeAmp: number; readAmp: { point: number; range: number }; writeReadsFirst: boolean }
  perWrite: string
  scale: string
  info: string
  /** the products that are this composition — a column called "wide-column ring"
   *  is an abstraction until you can name what you would actually install */
  examples: string
  /** one operator running it at a published scale. An abstraction with a name
   *  attached to it is a claim someone can check, which is the point. */
  wild: string
  /** only set where a name is jargon rather than a product you could look up.
   *  "hand-rolled" needs saying; PostgreSQL does not. */
  examplesInfo?: string
  /** where the scale claim comes from, so it stays checkable rather than trivia */
  sources: { label: string; href: string }[]
  /** Why someone picks this when the arithmetic does not pick it for them.
      Two of these stores can never win a capacity comparison — a document
      store's numbers match sharded SQL almost exactly, and a column store is
      a sidecar rather than a system of record. Leaving them in the table with
      no explanation would be dangling options that cannot be chosen; a test
      requires this text for any store that never wins. */
  chooseFor: string
}

export const STORES: Store[] = [
  {
    id: 'sql', label: 'Single-primary SQL', short: 'Single-primary SQL',
    model: 'relational', engine: 'B-tree', dist: 'one primary + replicas', txnScope: 'anything, one transaction',
    multiKey: 'yes', durable: true, pointFast: true,
    sets: { writeAmp: 3, readAmp: { point: 1, range: 1 }, writeReadsFirst: true },
    perWrite: '×3 — WAL, page, indexes',
    scale: 'You shard by hand when the time comes: choose a partition key, route to it, rebalance later — and the key is nearly impossible to change once data exists.',
    chooseFor:
      'Simplicity, and transactions that can touch anything. While the data fits one primary this is the least machinery that can possibly work — and that is a real engineering argument, not a consolation prize.',
    examples: 'PostgreSQL · MySQL · SQL Server',
    sources: [{ label: 'Stack Overflow architecture', href: 'https://nickcraver.com/blog/2016/02/17/stack-overflow-the-architecture-2016-edition/' }],
    wild: 'Stack Overflow served the whole site — ~2B page views a month, 6k+ requests/s — from one active SQL Server primary with a hot standby, in front of nine web servers.',
    info: 'Postgres, MySQL. One machine accepts every write, so anything can be atomic with anything. That single writer is both the feature and the ceiling.',
  },
  {
    id: 'sqlShard', label: 'Sharded SQL', short: 'Sharded SQL',
    model: 'relational', engine: 'B-tree', dist: 'sharded primaries', txnScope: 'within one shard',
    multiKey: 'shard', durable: true, pointFast: true,
    sets: { writeAmp: 3, readAmp: { point: 1, range: 1 }, writeReadsFirst: true },
    perWrite: '×3 — same, per shard',
    scale: 'Already sharded — the work is routing, rebalancing, and living with a partition key you chose early. Cross-shard transactions need two-phase commit, which is slower and fails in more ways.',
    chooseFor:
      'Keeping SQL, joins and per-shard transactions after the data outgrows one box. The relational answer at scale.',
    examples: 'Vitess · Citus · hand-rolled',
    examplesInfo:
      '“Hand-rolled” means no middleware: the application works out which shard a key belongs to and connects to that database directly. Notion shards Postgres by workspace id; Figma spent nine months building its own proxy. Vitess and Citus do the same job off the shelf.',
    sources: [
      { label: 'Slack / Vitess', href: 'https://slack.engineering/scaling-datastores-at-slack-with-vitess/' },
      { label: 'Notion', href: 'https://www.notion.com/blog/sharding-postgres-at-notion' },
      { label: 'Figma', href: 'https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/' },
    ],
    wild: 'Slack runs MySQL behind Vitess, sharded by channel id, at 2.3M queries a second and a 2 ms median — the same chat workload Discord solved with a ring.',
    info: 'Vitess, Citus, or hand-rolled routing. Keeps the relational model and the B-tree, but writes now scale horizontally — at the cost that a transaction spanning two shards is a distributed transaction.',
  },
  {
    id: 'doc', label: 'Document store', short: 'Document',
    model: 'document', engine: 'B-tree / LSM', dist: 'sharded', txnScope: 'one document',
    // per-document atomicity is NOT cross-key atomicity: a transfer touches two
    // documents, which is exactly the case the requirement is asking about
    multiKey: 'no', durable: true, pointFast: true,
    // Same amplification as the relational B-tree on purpose — WiredTiger IS a
    // B-tree, and journal + document + indexes is the same three writes. Giving
    // it a cheaper constant made it beat single-primary SQL on a number I had
    // invented, when the real reason to choose it is the data model.
    sets: { writeAmp: 3, readAmp: { point: 1, range: 1 }, writeReadsFirst: true },
    perWrite: '×3 — journal, doc, indexes',
    scale: 'Sharding is built in; the partition key is still yours to pick and still hard to change.',
    chooseFor:
      'The DATA MODEL, never the throughput — its numbers here match sharded SQL almost exactly, so this column will not win a capacity argument. You pick it when a record is naturally a nested tree and the shape varies between records, which is a fit question this page cannot measure.',
    examples: 'MongoDB · DynamoDB · Couchbase',
    sources: [{ label: 'DynamoDB (USENIX ATC 2022)', href: 'https://www.usenix.org/system/files/atc22-elhemali.pdf' }],
    wild: 'Amazon’s own services peaked at 89.2M requests/s against DynamoDB during Prime Day 2021 — a number its authors published in the ATC 2022 paper.',
    info: 'MongoDB, DynamoDB-style document stores. A record is a nested document read and written whole, which suits data that is already a tree — and hurts when two documents must change together.',
  },
  {
    id: 'wide', label: 'Wide-column ring', short: 'Wide-column',
    model: 'wide-column', engine: 'LSM', dist: 'leaderless ring', txnScope: 'one partition key',
    multiKey: 'no', durable: true, pointFast: true,
    // point: bloom-filter probes across several sorted runs. range: one sweep of
    // sorted contiguous rows inside the partition — the case it is designed for.
    sets: { writeAmp: 1, readAmp: { point: 2, range: 1 }, writeReadsFirst: false },
    perWrite: '×1 — compaction repays it later',
    scale: 'The ring does it for you — add nodes and partitions move. You pay in compaction load and in giving up anything cross-partition.',
    chooseFor:
      'Write-heavy, partition-scoped workloads where every node should take writes and the ring handles rebalancing — and where nothing ever needs to be atomic across partitions.',
    examples: 'Cassandra · ScyllaDB · HBase',
    sources: [
      { label: 'Discord', href: 'https://discord.com/blog/how-discord-stores-trillions-of-messages' },
      { label: 'Netflix', href: 'https://netflixtechblog.com/benchmarking-cassandra-scalability-on-aws-over-a-million-writes-per-second-39f45f066c9e' },
      { label: 'Twitter / Manhattan', href: 'https://blog.x.com/engineering/en_us/a/2014/manhattan-our-real-time-multi-tenant-distributed-database-for-twitter-scale' },
      { label: 'Manhattan’s data model', href: 'https://blog.twitter.com/engineering/en_us/topics/infrastructure/2018/native-secondary-indexing-in-manhattan' },
      { label: 'Twitter timelines', href: 'https://www.infoq.com/presentations/Real-Time-Delivery-Twitter' },
      { label: 'Why not Cassandra', href: 'https://highscalability.com/blog/2010/7/11/so-why-is-twitter-really-not-using-cassandra-to-store-tweets.html' },
    ],
    /* Every clause here is a claim, and every claim has a link beside it — the
       Twitter one especially, because "a social feed runs Cassandra" is the
       thing everybody assumes and nobody checks. It does not. It runs a store
       Twitter built, with this exact key shape. */
    wild: 'Discord keeps trillions of messages on one (Cassandra, then ScyllaDB — 177 nodes down to 72); Netflix measured 1.1M writes/s across 288 Cassandra nodes. Twitter reached the same shape by building its own: tweets live in Manhattan, keyed by a partition key plus a sorted local key you range-scan inside. It got there the long way — a 2010 move of tweets to Cassandra was announced, then cancelled — and the home timeline every reader sees is a separate Redis fan-out, not this store.',
    info: 'Cassandra, Scylla. Writes append to memory and flush in sorted batches, so ingest is cheap and every node takes writes. Reads may touch several files, and there is no coordinator to ask for a transaction.',
  },
  {
    id: 'col', label: 'Column-oriented', short: 'Columnar',
    model: 'column-oriented', engine: 'merge tree', dist: 'sharded', txnScope: 'none to speak of',
    multiKey: 'no', durable: true, pointFast: false,
    // point: reassembling one row means touching every column file. range: it
    // reads only the columns the query names, which is the whole idea.
    sets: { writeAmp: 1, readAmp: { point: 3, range: 1 }, writeReadsFirst: false },
    perWrite: '×1 — batched writes only',
    scale: 'Add shards and replicas; the real lever is that columns compress severalfold, so a scan reads far less than the logical size.',
    chooseFor:
      'Aggregates, not records — and almost always as the sidecar this page recommends separately rather than as the system of record. It will not win here: fetching whole rows is its worst case, which is why point-lookup reads disqualify it outright.',
    examples: 'ClickHouse · Druid · BigQuery',
    sources: [{ label: 'Cloudflare / ClickHouse', href: 'https://blog.cloudflare.com/http-analytics-for-6m-requests-per-second-using-clickhouse/' }],
    wild: 'Cloudflare feeds its HTTP analytics — 6M requests/s of logs — through Kafka into ClickHouse, having failed to make the previous pipeline scale to it.',
    info: 'ClickHouse, Parquet-based engines. Stores each column separately, so an aggregate over one column reads only that column — and fetching one whole row means touching every column file. That is why it is disqualified the moment reads fetch one record, and competitive the moment they sweep ranges. Superb sidecar, rarely a system of record.',
  },
  {
    id: 'mem', label: 'In-memory key-value', short: 'In-memory',
    model: 'key-value', engine: 'in-memory', dist: 'sharded, single-threaded', txnScope: 'one key',
    multiKey: 'no', durable: false, pointFast: true,
    sets: { writeAmp: 1, readAmp: { point: 0, range: 0 }, writeReadsFirst: false },
    perWrite: 'none — RAM',
    scale: 'Add shards, each single-threaded — but check the data still fits in RAM, which is usually the real limit.',
    chooseFor:
      'Speed on data you can afford to lose, or rebuild from somewhere else. It stops being a candidate the moment the data must survive a node death.',
    examples: 'Redis · Memcached · Valkey',
    sources: [{ label: 'Scaling Memcache at Facebook', href: 'https://pdos.lcs.mit.edu/6.824/notes/l-memcached.txt' }],
    wild: 'Facebook’s memcache fleet — the largest ever measured — ran at roughly a 99% hit rate in front of the databases that actually held the data.',
    info: 'Redis, Memcached. No disk on the read path, so the ceilings become CPU per operation and RAM. Durability is optional, and turning it on buys back the fsync you were avoiding.',
  },
]

/** one-click typical systems: a hand that moves the visible sliders and
 *  requirement pickers — never a hidden multiplier. Values must sit on the
 *  ladders (enforced by a unit test). */
export interface Preset {
  id: string
  label: string
  info: string
  req: Req
  sets: Vals
}
/* The presets are chosen so that every store a workload can actually reach gets
   reached. Five of them landed on two answers — three on wide-column, two on
   sharded SQL — which made a six-column table look like it had one opinion.

   They are still named for the SYSTEM, never for the store. Working backwards
   from an answer ("here is the workload that picks Cassandra") would invert the
   page's whole argument into a lookup table, and imply each store has one
   canonical use, which is the folklore this page exists to replace. What
   changed is the SET, not the method: two ordinary systems were missing, and
   adding them happens to light up the two reachable columns nothing reached.

   Document and Columnar are deliberately absent from that promise, and cannot
   be added: neither can win a capacity argument at any of the 64 requirement
   combinations, by design. See STORE_NEVER_WINS below. */
export const PRESETS: Preset[] = [
  {
    id: 'app', label: 'Internal / B2B app',
    info: '50k daily users on an ordinary transactional app — the case where the answer is still one database, and the page says so.',
    req: { fresh: 'pull', txn: 'multi', loss: 'keep', analytics: 'no', access: 'point', recency: 'current', keyShape: 'monotonic' },
    sets: { dau: 5e4, actions: 50, peak: 3, readPct: 85, fanout: 1, online: 10, writeSize: 2, readSize: 50, lat: 100, retention: 36, growth: 5, derived: 1 },
  },
  {
    id: 'feed', label: 'Social feed',
    /* "Social feed" is at least two systems, and the column this page picks is
       the SYSTEM OF RECORD for posts — not the timeline. Twitter's home
       timeline is a materialised fan-out in Redis with a separate pull path for
       high-follower accounts; the tweets themselves live in Manhattan. The
       derived count below is set to 2 for exactly that reason, and at 2 this
       page starts recommending a log. Worth saying in the blurb, because a
       reader who takes the single answer as "a feed is one database" has
       learned the opposite of the lesson. */
    info: '50M readers, a post fans out to ~100 followers — the write is cheap, the deliveries are not. The store below is where posts LIVE; the timeline every reader sees is a derived copy, which is why this preset counts 2 derived systems.',
    req: { fresh: 'pull', txn: 'single', loss: 'keep', analytics: 'no', access: 'range', recency: 'stale', keyShape: 'scattered' },
    sets: { dau: 5e7, actions: 50, peak: 3, readPct: 90, fanout: 100, online: 10, writeSize: 1, readSize: 50, lat: 100, retention: 12, growth: 10, derived: 2 },
  },
  {
    id: 'chat', label: 'Chat / messaging',
    info: 'Messages must appear the moment they are sent — held connections, small payloads, half the traffic is writes.',
    req: { fresh: 'push', txn: 'single', loss: 'keep', analytics: 'no', access: 'range', recency: 'stale', keyShape: 'scattered' },
    sets: { dau: 2e7, actions: 50, peak: 2, readPct: 50, fanout: 5, online: 20, writeSize: 1, readSize: 2, lat: 50, retention: 12, growth: 10, derived: 1 },
  },
  {
    id: 'ingest', label: 'Metrics / event ingest',
    info: '50M devices reporting 200 times a day, almost never read back — and analyzed in bulk later.',
    req: { fresh: 'pull', txn: 'single', loss: 'keep', analytics: 'yes', access: 'range', recency: 'stale', keyShape: 'scattered' },
    sets: { dau: 5e7, actions: 200, peak: 2, readPct: 10, fanout: 0, online: 1, writeSize: 2, readSize: 10, lat: 20, retention: 6, growth: 20, derived: 2 },
  },
  {
    id: 'ledger', label: 'Payments / ledger',
    info: 'Money moves between accounts — cross-key transactions disqualify half the table before any arithmetic runs.',
    req: { fresh: 'pull', txn: 'multi', loss: 'keep', analytics: 'yes', access: 'point', recency: 'current', keyShape: 'monotonic' },
    sets: { dau: 1e7, actions: 5, peak: 5, readPct: 60, fanout: 1, online: 2, writeSize: 2, readSize: 5, lat: 200, retention: 60, growth: 5, derived: 2 },
  },
  {
    id: 'media', label: 'Media sharing',
    info: '5 MB uploads and 2 MB views at 100M users — the problem is bandwidth and blobs, not request rate.',
    req: { fresh: 'pull', txn: 'single', loss: 'keep', analytics: 'no', access: 'point', recency: 'stale', keyShape: 'scattered' },
    sets: { dau: 1e8, actions: 20, peak: 3, readPct: 95, fanout: 1, online: 5, writeSize: 5000, readSize: 2000, lat: 100, retention: 60, growth: 10, derived: 1 },
  },
  {
    id: 'sessions', label: 'Sessions / rate limits',
    info: 'Every request checks it, nothing is delivered, and losing a node costs a re-login — the one workload where durability stops being a filter.',
    req: { fresh: 'pull', txn: 'single', loss: 'rebuild', analytics: 'no', access: 'point', recency: 'current', keyShape: 'scattered' },
    sets: { dau: 2e6, actions: 100, peak: 3, readPct: 95, fanout: 1, online: 20, writeSize: 1, readSize: 1, lat: 5, retention: 1, growth: 10, derived: 0 },
  },
]

/* Two of the six columns cannot win a capacity argument at ANY of the 64
   requirement combinations, and that is a design decision rather than an
   oversight — see each store's `chooseFor`. A reader who clicks every preset
   and never sees them picked learns nothing from the silence, so the page says
   it out loud, and `presets.test.ts` re-derives the claim by brute force. If
   the model ever changes so one of these CAN win, that test fails and tells you
   to delete the line rather than leaving the page asserting something stale. */
export const CANNOT_WIN: Record<string, string> = {
  doc: 'its numbers here match sharded SQL almost exactly, so it never wins on arithmetic. You choose it when a record is naturally a nested tree — a fit question this page cannot measure.',
  col: 'it is disqualified the moment reads fetch one record, and when they do not, it is a sidecar fed from the primary rather than the system of record. It wins queries, not workloads.',
}

/**
 * WHERE THE ENGINE CONSTANTS COME FROM.
 *
 * Every slider on this page carries a provenance tag, and `sensitivity()`
 * sweeps each one and reports the ones that flip the answer. The per-store
 * amplification constants had neither: they sat hardcoded in STORES, invisible,
 * unswept — and a sweep of 1,008 workloads showed the ring's point-lookup
 * penalty alone decides relational-vs-ring in about three quarters of them.
 * The number doing the most work was the only one nobody could see.
 *
 * These are the same species as a query planner's cost constants — Postgres
 * ships `random_page_cost = 4.0` and `seq_page_cost = 1.0`, documents that they
 * are modelling choices rather than measurements, and lets you change them.
 * Same deal here. The reader is entitled to see the numbers that picked their
 * database.
 */
export const ENGINE_CONSTANTS: {
  k: 'writeAmp' | 'point' | 'range' | 'seek'
  label: string
  src: 'napkin' | 'assume'
  note: string
}[] = [
  {
    k: 'writeAmp',
    label: 'Writes per logical write',
    src: 'assume',
    note: 'A B-tree commit lands in three places — the WAL, the heap page, and every index that covers the row — so ×3. An LSM appends once to a sorted buffer, so ×1 in the foreground; compaction repays the difference later, off the critical path, and this page does not charge it. That omission flatters the LSM on sustained ingest.',
  },
  {
    k: 'point',
    label: 'Disk lookups per point read',
    src: 'assume',
    note: 'A B-tree walks to one leaf: ×1. An LSM has to consider the memtable and several sorted runs, and bloom filters skip most but not all of them: ×2. A columnar store reassembles a row from as many files as it has columns: ×3. THIS IS THE LOAD-BEARING NUMBER — the ×2 is the entire read-side difference between relational and the ring, so it carries the whole decision whenever reads bind. It is an assumption, not a measurement, and a value of 1.5 would move a lot of answers.',
  },
  {
    k: 'range',
    label: 'Disk lookups per range read',
    src: 'assume',
    note: 'Everything is ×1: a B-tree walks its leaf chain, an LSM sweeps sorted contiguous rows inside one partition, a columnar store reads the columns it was built to read. Which is the real content of “range scans suit sorted layouts” — not that the LSM gets faster, but that it stops paying the point-lookup penalty above.',
  },
  {
    k: 'seek',
    label: 'Does an insert read before it writes',
    src: 'assume',
    note: 'A B-tree puts the row where it belongs, so it fetches that leaf page first — free while the page is resident, a disk seek when it is not. An LSM never does. Modelled as a step at exactly one node of RAM; the truth is a curve, and the buffer pool is only a fraction of RAM, so the cliff edge here is softer and earlier in reality than on this page.',
  },
]

/** the visible constants a store implies, resolved for this access pattern */
export function storeConstants(st: Store, access: string) {
  return { writeAmp: st.sets.writeAmp, readAmp: access === 'range' ? st.sets.readAmp.range : st.sets.readAmp.point }
}

export const INIT: Vals = {}
;[...WORKLOAD, DERIVED_INP, ...HW].forEach((i) => (INIT[i.id] = i.val))

/** a stored pointer row, once blobs move to object storage */
export const POINTER_BYTES = 1024

export interface EngineCol {
  id: string
  /** read pressure on unmitigated reads — decides whether this store forces a cache */
  rawRU: number
  colCache: boolean
  colReads: number
  rU: number
  bw: number
  bwU: number
  worst: number
  /** utilisation of the ceiling that is not binding — headroom on the other axis */
  next: number
  /** random reads this store's own INSERTS cost: a B-tree fetching the leaf
   *  page it is about to write, once that page stopped being resident. 0 for
   *  LSM engines at any size, and 0 for anything while the page is in RAM. */
  poolMisses: number
  /** the bytes ONE node holds — dbStorage split across the shards it needs.
   *  The cliff is a per-node fact, so it has to be measured after sharding. */
  nodeBytes: number
  worstName: 'the write stream' | 'read pressure' | 'the buffer-pool cliff' | 'ops on one core'
  dq: string | null
  /** the arithmetic behind the disqualification, so a claim like "needs 19
   *  shards" can be traced to the division that produced 19 */
  dqHow: string | null
  /** which ceilings-table row that arithmetic came from */
  dqCeil: Ceil | null
  store: Store
}

/** which row of "what one machine can do" a utilisation was measured against */
export type Ceil = 'writes' | 'reads' | 'stream' | 'cache' | 'data' | 'egress' | 'conns' | 'scan'

export function model(v: Vals, req: Req) {
  // ---------- workload ----------
  const actionsPerDay = v.dau * v.actions
  const avgQps = actionsPerDay / 86400
  const peakQps = avgQps * v.peak
  const peakReads = (peakQps * v.readPct) / 100
  const peakWrites = peakQps - peakReads
  const writesPerDay = actionsPerDay * (1 - v.readPct / 100)
  /** a write must reach fanout recipients — the delivery side, not the write side */
  const deliveries = peakWrites * v.fanout
  /** everything the read path serves: direct reads plus fan-out deliveries */
  const readSide = peakReads + deliveries
  const bytesW = v.writeSize * 1024
  const bytesR = v.readSize * 1024
  const storagePerDay = writesPerDay * bytesW
  const storageTotal = storagePerDay * 30 * v.retention

  // ---------- ceilings, derived from the constants ----------
  /** one fsync makes a group of commits durable */
  const writeCeiling = v.group / (v.fsync / 1e6)
  /** NVMe serves ioDepth random reads concurrently */
  const diskReadCeiling = v.ioDepth / (v.randRead / 1e6)
  /** one core, one op at a time */
  const cacheCeiling = 1 / (v.cacheOp / 1e6)
  const seqWriteBps = v.seqWrite * 2 ** 30
  const seqReadBps = v.seqRead * 2 ** 30
  const ramBytes = v.ram * 2 ** 30

  /** blobs leave the database: what the engine stores and scans is a pointer row */
  const blobNeed = v.writeSize >= 500
  const dbBytesW = blobNeed ? POINTER_BYTES : bytesW
  /** the bytes that actually live in the database — rows, not blobs */
  const dbStorage = blobNeed ? writesPerDay * dbBytesW * 30 * v.retention : storageTotal
  const ramHosts = Math.ceil(dbStorage / ramBytes)
  const scanSeconds = dbStorage / seqReadBps
  /** data size alone can force a split: backups and recovery, not IOPS */
  const storageShards = Math.max(1, Math.ceil(dbStorage / (v.diskPerNode * 1e12)))

  // ---------- decision 1: transport, filtered by the freshness requirement ----------
  const heldConns = (v.dau * v.online) / 100
  /** egress = responses to readers + pushed deliveries, each plus protocol bytes */
  const egressFor = (oh: number) => ((peakReads * (bytesR + oh) + deliveries * (bytesW + oh)) * 8) / 1e9
  const tCols = PROTOCOLS.map((p) => ({
    id: p.id,
    holds: p.holds,
    hosts: p.holds ? Math.ceil(heldConns / v.connsPerHost) : 0,
    eg: egressFor(p.sets.overhead),
    dq: req.fresh === 'push' && !p.holds ? 'data must appear on its own — nothing is held open to push down' : null,
  }))
  const transportWin = req.fresh === 'push' ? 'ws' : 'req'

  // ---------- decision 2: engine — requirements filter, then utilization ranks ----------
  /* Requirements FILTER — a promise the store cannot keep disqualifies it, and
     no throughput number un-disqualifies it. Each dimension does its own
     filtering, which is the point of keeping them separate. */
  const disqualify = (st: Store): { why: string; how?: string; ceil?: Ceil } | null => {
    if (req.txn === 'multi' && st.multiKey === 'no')
      return { why: `several keys must change atomically, and its atomicity stops at ${st.txnScope}` }
    if (req.loss === 'keep' && !st.durable)
      return { why: 'this data must survive a node death, and durability is off by default' }
    if (req.access === 'point' && !st.pointFast)
      return { why: 'reads fetch one record, and a row here is spread across every column file' }
    if (st.id === 'mem' && ramHosts > 8)
      return {
        why: `the dataset is ${int(ramHosts)} nodes of pure RAM`,
        how: `${bytes(dbStorage)} of rows ÷ ${v.ram} GB per node`,
        ceil: 'data',
      }
    /* A single writer is not an option once the data itself needs splitting.
       This is the load disqualifying a store rather than a requirement doing
       it — but it is still a disqualification, not a score: you cannot run one
       primary over ${'${n}'} shards, whatever the throughput says. */
    if (st.dist === 'one primary + replicas' && shardsNeeded > 1)
      return {
        why: `this data needs ${int(shardsNeeded)} shards — one primary is not on the table; the relational answer here is the sharded one`,
        how:
          storageShards >= writeShardsNeeded
            ? `${bytes(dbStorage)} of rows ÷ ${v.diskPerNode} TB per node`
            : `${compact(dbWrites)} writes/s ÷ ${compact(writeCeiling)}/s per primary`,
        ceil: storageShards >= writeShardsNeeded ? 'data' : 'writes',
      }
    return null
  }
  /** the log is store-independent: if peaks force one, every store consumes sustained */
  const writeUtil = peakWrites / writeCeiling
  const logNeed = writeUtil > 0.5 && v.peak >= 2
  /** behind a log the database consumes at the daily average, not the worst minute */
  const dbWrites = logNeed ? peakWrites / v.peak : peakWrites
  /* Two independent reasons to split, and the larger wins. This lives in the
     model rather than in consequences because a store has to be judged against
     it: recommending "single-primary SQL" while simultaneously reporting 185
     shards is not a trade-off, it is a contradiction. */
  const writeShardsNeeded = Math.max(1, Math.ceil(dbWrites / writeCeiling))
  /* A THIRD reason to split, and it only exists for a B-tree taking scattered
     inserts: shard until a node's slice fits its RAM, and the leaf page you are
     about to write is resident again. This is not a throughput fix, it is the
     escape route from the buffer-pool cliff below — and it is a real one, taken
     in production: Slack shards messages by channel ID across THOUSANDS of
     MySQL shards, the same key Discord handed to a ring. That is the actual
     Discord-vs-Slack argument, and it is about who runs the split, not about
     which engine is faster. Charging the seek penalty while ignoring this
     route would have told the reader sharded MySQL cannot store chat, which is
     false and which Slack's numbers refute. */
  const ramShardsNeeded = req.keyShape === 'scattered' ? Math.max(1, ramHosts) : 1
  const shardsNeeded = Math.max(storageShards, writeShardsNeeded, ramShardsNeeded)
  /* How often the split has to be redone. Storage grows with the workload, so
     the shard count doubles on the same clock the data does — no invented
     constant, just the growth rate the reader set. */
  const monthsToDouble = v.growth > 0 ? Math.log(2) / Math.log(1 + v.growth / 100) : Infinity
  /* Reads that must be current cannot be served from a copy that has not caught
     up, so the cache stops being a free absorber: it has to sit on the write
     path (write-through or invalidate-on-write) to be safe at all. We keep it —
     that is a real pattern — but the store is judged knowing every write now
     also touches the cache. */
  const cacheOnWritePath = req.recency === 'current'
  /* WHO DECIDES THE CACHE EXISTS. It has to be the read RATE against one node's
     ceiling — never the engine, or the comparison stops being apples to apples.
     Deciding it per store meant a high-amplification engine could cross the
     threshold, collect the cache discount, and score BETTER at reads than the
     engine whose reads were cheap enough not to need one: "worse at reads
     wins", the second time this page has produced that artifact. The
     sensitivity sweep is what caught it — at a doubled read ceiling the winner
     flipped to the wide-column ring for exactly this reason. The engine still
     pays its own amplification, but on the same surviving reads as everyone
     else. What each store then forces on its own is a RECOMMENDATION, computed
     downstream in consequences() from the store you actually chose. */
  const cacheAbsorbs = readSide / diskReadCeiling > 0.3
  /** Each store is judged on the load that would REACH it in the system built
   *  around it: if its own read pressure forces a cache, its reads become the
   *  misses; if the peak forces a log, its writes become the sustained rate;
   *  if blobs move to object storage, its rows become pointers. Judging on
   *  unmitigated load taxed the LSM's read amplification for reads the cache
   *  absorbs — the pre-cache bias this replaces. */
  const eCols: EngineCol[] = STORES.map((e) => {
    const readAmp = storeConstants(e, req.access).readAmp
    const rawRU = readAmp === 0 ? 0 : (readSide * readAmp) / diskReadCeiling
    const colCache = readAmp !== 0 && cacheAbsorbs
    const colReads = colCache ? readSide * (1 - v.cacheHit / 100) : readSide
    /* THE BUFFER-POOL CLIFF — the only place this model knows the difference
       between the two engines' WRITE paths, rather than just their byte counts.

       A B-tree puts a new row where it belongs, so before it can write it must
       READ the leaf page that position sits on. That read is free while the
       page is resident, and it is a disk seek when it is not. TWO conditions
       have to hold for it to cost anything:

         · the insert point is unpredictable (`keyShape: scattered`) — an
           ordered id lands at the right-hand edge every time, and that one leaf
           page is always in memory however large the table gets; and
         · a node's slice has outgrown that node's RAM.

       Both matter. Charging the penalty on size alone makes this page answer
       "LSM" to every workload above 128 GB, which is not true and was the first
       attempt at this.

       An LSM pays it at no size: it appends to a sorted buffer in memory and
       puts the row where it belongs later, during compaction, sequentially.
       THIS is why write-heavy stores end up on LSMs — the amplification
       constants (×3 vs ×1) flatter the B-tree, because they price the bytes
       written and not the seek that has to happen first.

       Measured PER NODE, after sharding, so the model states the real choice:
       shard until a node's slice fits RAM, or run an engine whose writes read
       nothing. Sharding rarely wins it outright — a node holds ~70x more disk
       than memory, so a store sharded to fit its disk is still far past this
       line. */
    const nodeBytes = dbStorage / Math.max(1, e.dist === 'one primary + replicas' ? 1 : shardsNeeded)
    const poolMisses =
      e.sets.writeReadsFirst && req.keyShape === 'scattered' && nodeBytes > ramBytes ? dbWrites : 0
    const rU = readAmp === 0 ? 0 : (colReads * readAmp + poolMisses) / diskReadCeiling
    const bw = dbWrites * dbBytesW * e.sets.writeAmp
    const bwU = e.id === 'mem' ? 0 : bw / seqWriteBps
    /** in-memory pays CPU per op instead of disk: all ops against one core */
    const worst = e.id === 'mem' ? (readSide + dbWrites) / cacheCeiling : Math.max(bwU, rU)
    /** the ceiling that is NOT binding — headroom, and the tie-break */
    const next = e.id === 'mem' ? 0 : Math.min(bwU, rU)
    /* Naming this wall honestly matters more than usual: "read pressure" on a
       store whose reads are fine and whose INSERTS are doing the seeking sends
       the reader off to add a cache, which does nothing at all for writes. */
    const worstName =
      e.id === 'mem'
        ? ('ops on one core' as const)
        : bwU >= rU
          ? ('the write stream' as const)
          : poolMisses > colReads * readAmp
            ? ('the buffer-pool cliff' as const)
            : ('read pressure' as const)
    const d = disqualify(e)
    return {
      id: e.id, rawRU, colCache, colReads, poolMisses, nodeBytes, rU, bw, bwU, worst, next, worstName,
      dq: d ? d.why : null, dqHow: d?.how ?? null, dqCeil: d?.ceil ?? null, store: e,
    }
  })
  const alive = eCols.filter((c) => !c.dq)
  /** lowest worst-case wins; strict < keeps the earlier (simpler) machine on ties.
   *  STORES is ordered simplest-first for exactly this reason. */
  /* Lowest binding ceiling wins. When two stores bind at the same ceiling —
     which happens whenever reads dominate and they read alike — the one with
     more headroom on the OTHER axis wins. Falling back to list order there
     would report the order I happened to type the stores in as a finding. */
  const engineWin = alive.reduce((best, c) => {
    if (c.worst < best.worst * 0.95) return c
    if (best.worst < c.worst * 0.95) return best
    return c.next < best.next ? c : best
  }, alive[0]).id
  const winner = alive.find((c) => c.id === engineWin)!
  /* Stores within a few percent of the winner are not really beaten — the
     arithmetic simply does not separate them, and saying "SQL wins" because it
     happens to sit first in the list would be dressing list order up as a
     result. When this set has more than one member the verdict says so, and
     points at what actually decides: at a high shard count, who does the
     sharding costs more than per-node efficiency. */
  const engineTie = alive
    .filter((c) => c.worst <= winner.worst * 1.05 + 1e-9)
    .map((c) => c.id)

  /* AMDAHL'S LAW, applied to ceilings. Hennessy & Patterson's oldest rule is
     that the speedup from improving one part is capped by the part you did not
     improve. Here every store binds on ONE wall while the other sits idle, so
     the honest question about any fix is not "how much faster is this wall"
     but "how far away is the next one". That distance — worst ÷ next — is the
     entire budget the fix has to spend, no matter how good it is.
     next = 0 means nothing else in this model binds at all. */
  const headroom = (c: EngineCol) => (c.next <= 0 ? Infinity : c.worst / c.next)
  const amdahl = {
    binding: winner.worstName,
    bindingUtil: winner.worst,
    nextUtil: winner.next,
    /** the most that removing the binding wall entirely could buy */
    gain: headroom(winner),
  }

  return {
    actionsPerDay, avgQps, peakQps, peakReads, peakWrites, writesPerDay, deliveries, readSide,
    bytesW, bytesR, storagePerDay, storageTotal, dbStorage, storageShards,
    writeCeiling, diskReadCeiling, cacheCeiling, seqWriteBps, seqReadBps, ramBytes, ramHosts, scanSeconds,
    ramShardsNeeded,
    heldConns, egressFor, tCols, transportWin,
    writeUtil, logNeed, dbWrites, blobNeed, dbBytesW, eCols, engineWin, engineTie, cacheOnWritePath,
    writeShardsNeeded, shardsNeeded, monthsToDouble, amdahl, cacheAbsorbs,
  }
}

export type Model = ReturnType<typeof model>

/** consequences of the chosen shape — uses v's (possibly hand-tuned) synced
 *  constants plus the effective transport's holds flag */
export function consequences(v: Vals, req: Req, m: Model, effTHolds: boolean) {
  const connections = effTHolds ? m.heldConns : 0
  const connHosts = effTHolds ? Math.ceil(connections / v.connsPerHost) : 0
  const egressGbps = m.egressFor(v.overhead)
  const diskWriteBytes = m.peakWrites * m.bytesW * v.writeAmp
  const webInstances = Math.max(1, Math.ceil((m.peakQps * (v.lat / 1000)) / v.slots))
  const originHosts = Math.max(1, Math.ceil(egressGbps / v.nic))
  /* WHAT THE CACHE HAS TO ABSORB. Reads always. Writes too, whenever the reads
     must be current: an asynchronous copy is behind by definition, so the only
     cache that is safe to answer from is one every write updates or
     invalidates in the same breath. That is not free — it puts the write path
     through the cache tier, and the tier has to be sized for it.
     This page has said that sentence in prose since it shipped while sizing the
     tier from reads alone, so the sentence was true and the arithmetic printed
     next to it was not. */
  const cacheOps = m.readSide + (m.cacheOnWritePath ? m.dbWrites : 0)
  const cacheNodes = Math.max(1, Math.ceil(cacheOps / m.cacheCeiling))
  const readUtil = v.readAmp === 0 ? 0 : (m.readSide * v.readAmp) / m.diskReadCeiling

  // ---------- the chain: each forced addition transforms the load downstream ----------
  const cdnNeed = originHosts > 1
  const originAfter = cdnNeed ? egressGbps * (1 - v.cdnHit / 100) : egressGbps
  const originHostsAfter = Math.max(1, Math.ceil(originAfter / v.nic))
  const cacheNeed = readUtil > 0.3
  const missReads = cacheNeed ? m.readSide * (1 - v.cacheHit / 100) : m.readSide
  const readUtilAfter = v.readAmp === 0 ? 0 : (missReads * v.readAmp) / m.diskReadCeiling
  const writeUtilAfter = m.dbWrites / m.writeCeiling
  /** two independent reasons to split: the write rate, or the sheer data size */
  const writeShards = m.writeShardsNeeded
  const shardNeed = m.shardsNeeded > 1
  const shards = m.shardsNeeded
  /* WHICH DIVISION PRODUCED THE SHARD COUNT. The page prints the count and the
     arithmetic behind it side by side, so this has to name the reason that
     actually won `Math.max` — not a plausible-sounding one. Memory is now a
     third reason (scattered inserts have to keep a node's slice inside its
     RAM), and it usually dominates by an order of magnitude: a node holds
     ~70x more disk than memory. Reporting that count as "storage" would print
     "1,342 shards" beside a division that yields 19. */
  const shardBy: 'writes' | 'storage' | 'memory' | 'both' =
    m.ramShardsNeeded >= Math.max(m.storageShards, m.writeShardsNeeded) && m.ramShardsNeeded > 1
      ? 'memory'
      : writeUtilAfter > 1 && m.storageShards > 1
        ? 'both'
        : writeUtilAfter > 1
          ? 'writes'
          : 'storage'

  const g = v.growth / 100
  const monthsToWall =
    m.peakWrites >= m.writeCeiling ? 0 : g > 0 ? Math.log(m.writeCeiling / Math.max(1, m.peakWrites)) / Math.log(1 + g) : Infinity

  /** which recommendations fire — one boolean per card, in display order */
  const needs = {
    connTier: connHosts > 1,
    fanout: v.fanout > 1 && m.deliveries > m.writeCeiling,
    cdn: cdnNeed,
    blob: m.blobNeed,
    cache: cacheNeed,
    cacheNodes: cacheNodes > 1,
    log: m.logNeed,
    shard: shardNeed,
    logConsumers: v.derived >= 2,
    analytical: req.analytics === 'yes',
  }

  return {
    connections, connHosts, egressGbps, diskWriteBytes, webInstances, originHosts, cacheNodes, readUtil,
    cdnNeed, originAfter, originHostsAfter, cacheNeed, missReads, readUtilAfter,
    writeUtilAfter, writeShards, shardNeed, shards, shardBy, cacheOps,
    monthsToWall, needs,
  }
}

export type Consequences = ReturnType<typeof consequences>

/* ============================================================
   Which assumption is load-bearing.

   Borrowed from Hennessy & Patterson, who never quote a result without
   saying how it moves when the inputs do. A point estimate built on
   fifteen constants tells you nothing about which of the fifteen you
   have to get right — and on this page four of them are marked ASSUMED,
   meaning nobody measured them for your system.

   So: take each constant, move it ONE RUNG on its own ladder (roughly a
   factor of two either way), re-run the whole model, and report only
   the moves that change an ANSWER — not the ones that merely change a
   number. A conclusion that survives every rung is robust; one that
   flips on a constant nobody measured is a coin toss wearing a table.
   ============================================================ */

/** the answers this page gives — what a sensitivity sweep compares */
export interface Outcome {
  store: string
  shards: number
  needs: Consequences['needs']
}

export const NEED_LABEL: Record<keyof Consequences['needs'], string> = {
  connTier: 'a separate connection tier',
  fanout: 'a fan-out worker pool',
  cdn: 'a CDN',
  blob: 'blobs out of the database',
  cache: 'a cache',
  cacheNodes: 'more than one cache node',
  log: 'a log in front of the writes',
  shard: 'sharding the database',
  logConsumers: 'one log, many consumers',
  analytical: 'a separate analytical store',
}

/** run the whole page for one set of constants, resolved self-consistently:
 *  the store the arithmetic picks writes its own amplification back in before
 *  the consequences are computed, exactly as the UI does. */
export function outcome(v: Vals, req: Req): Outcome {
  const m = model(v, req)
  const win = STORES.find((s) => s.id === m.engineWin)!
  const t = PROTOCOLS.find((p) => p.id === m.transportWin)!
  const c = consequences({ ...v, ...t.sets, ...storeConstants(win, req.access) }, req, m, t.holds)
  return { store: m.engineWin, shards: c.shards, needs: c.needs }
}

export interface Flip {
  id: string
  label: string
  src: 'napkin' | 'assume'
  from: string
  to: string
  dir: 'down' | 'up'
  /** the answers that changed, in plain words */
  changes: string[]
}

/** constants the DECISIONS write into — perturbing an output models nothing */
/** Constants the page's own decisions write, not the reader: the transport
 *  choice sets protocol overhead, the store choice sets both amplifications.
 *  They are outputs wearing an input's clothes, which is why the sensitivity
 *  sweep skips them — and why a shared link must not carry them either. */
export const DECIDED = new Set(['overhead', 'readAmp', 'writeAmp'])

function diffOutcome(a: Outcome, b: Outcome): string[] {
  const out: string[] = []
  if (a.store !== b.store)
    out.push(`the store becomes ${STORES.find((s) => s.id === b.store)!.short}`)
  ;(Object.keys(a.needs) as (keyof Consequences['needs'])[]).forEach((k) => {
    if (a.needs[k] !== b.needs[k])
      out.push(`${NEED_LABEL[k]} ${b.needs[k] ? 'becomes necessary' : 'is no longer forced'}`)
  })
  // a shard count that merely drifts is not a different answer; a doubling is
  if (a.shards > 1 && b.shards > 1 && (b.shards >= a.shards * 2 || a.shards >= b.shards * 2))
    out.push(`shards go from ${int(a.shards)} to ${int(b.shards)}`)
  return out
}

export function sensitivity(v: Vals, req: Req): Flip[] {
  const base = outcome(v, req)
  const flips: Flip[] = []
  for (const h of HW) {
    if (DECIDED.has(h.id)) continue
    const i = h.steps.indexOf(v[h.id])
    if (i < 0) continue
    for (const [j, dir] of [[i - 1, 'down'], [i + 1, 'up']] as const) {
      if (j < 0 || j >= h.steps.length) continue
      const changes = diffOutcome(base, outcome({ ...v, [h.id]: h.steps[j] }, req))
      if (changes.length)
        flips.push({ id: h.id, label: h.label, src: h.src, from: h.fmt(v[h.id]), to: h.fmt(h.steps[j]), dir, changes })
    }
  }
  /* Assumptions first: a measured constant being load-bearing is a fact about
     hardware, but an ASSUMED one being load-bearing means the answer rests on
     a number nobody checked. Then by blast radius. */
  return flips.sort((a, b) =>
    a.src === b.src ? b.changes.length - a.changes.length : a.src === 'assume' ? -1 : 1,
  )
}
