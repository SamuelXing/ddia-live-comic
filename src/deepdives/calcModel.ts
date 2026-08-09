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
  us: [10, 20, 50, 100, 200, 500, 1000, 2000, 5000],
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
  { id: 'readAmp', label: 'Files touched per read', steps: [0, 1, 2, 3, 5], val: 1, src: 'assume', fmt: (v) => (v === 0 ? 'none (RAM)' : '×' + v), hint: 'Disk lookups per read. Set by the engine choice.', info: 'A B-tree walks to exactly one leaf page. An LSM store may check the memtable and several sorted files before it finds the key — bloom filters skip most of them, but not for free. An in-memory store touches no disk at all. The engine decision writes this value.' },
  { id: 'writeAmp', label: 'Write amplification', steps: L.amp, val: 3, src: 'assume', fmt: (v) => '×' + int(v), hint: 'Bytes written per logical write. Set by the engine choice.', info: 'One logical row write touches the disk more than once: the write-ahead log, the page itself, and every index that must be updated. x3 is modest — a table with several indexes is worse. The engine decision writes this value; raise it if your tables carry many indexes.' },
  { id: 'connsPerHost', label: 'Connections per host', steps: L.conns, val: 1e5, src: 'assume', fmt: (v) => compact(v), hint: 'Live connections one server can hold.', info: 'Bounded by memory per connection, file descriptors, and the CPU spent on heartbeats — not by request rate. The published record is ~2M on one heroically tuned FreeBSD box (WhatsApp, 2012); a default-configured server manages far fewer. 100k is a deliberately conservative default — 20× under the record.' },
  { id: 'slots', label: 'Concurrency per instance', steps: L.slots, val: 64, src: 'assume', fmt: (v) => int(v) + ' slots', hint: 'In-flight requests one app instance handles.', info: "How many requests one instance can have in flight at once — threads, workers, or async tasks. Little's Law turns it into a machine count. Raising it does not create capacity when the work is CPU-bound; it just lets more requests queue." },
  { id: 'ram', label: 'RAM per node', steps: [16, 32, 64, 128, 256, 512, 1024], val: 128, src: 'assume', fmt: (v) => v + ' GB', hint: 'For the “does it fit in memory” check.', info: 'The feasibility check for an in-memory store is not throughput — it is whether the dataset fits. Stored bytes divided by this number is how many machines of pure RAM you would be buying.' },
  { id: 'diskPerNode', label: 'Data per database node', steps: [1, 2, 5, 10, 20, 50, 100], val: 10, src: 'assume', fmt: (v) => v + ' TB', hint: 'Past this, the dataset itself forces sharding — rate or no rate.', info: 'Most ceilings are rates, but sheer data size forces a split on its own: past some tens of TB per node, backups, replica rebuilds and crash recovery take longer than anyone can tolerate — long before IOPS run out. This is why Twitter sharded the tweet store and Discord sharded messages at modest write rates: hundreds of TB of rows, not hundreds of thousands of writes.' },
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

/** engines the tool decides between */
export const ENGINES = [
  {
    id: 'btree', label: 'Single-primary SQL', short: 'B-tree', sets: { writeAmp: 3, readAmp: 1 },
    info: 'Postgres, MySQL. A write updates pages in place, so it pays the write-ahead log, the page itself and every index. You get transactions and predictable reads; you do the sharding yourself.',
    scale: 'You will do this by hand: choose a partition key, route to it, and rebalance later — the hard part is that the key is nearly impossible to change once data exists.',
    giveUp: 'nothing extra — but you shard by hand',
    perWrite: '×3 — WAL + page + indexes',
  },
  {
    id: 'lsm', label: 'LSM / wide-column', short: 'LSM', sets: { writeAmp: 1, readAmp: 2 },
    info: 'Cassandra, Scylla, RocksDB. Writes append to memory and flush in sorted batches, so the disk work per write is small and sequential — but it comes back later as background compaction, and a read may touch several files. Partitioning is built in; transactions largely are not.',
    scale: 'The ring does it for you — add nodes and the partitions move. You pay instead in compaction load and in giving up cross-partition transactions.',
    giveUp: 'cross-partition transactions',
    perWrite: '×1 now — compaction repays later',
  },
  {
    id: 'mem', label: 'In-memory store', short: 'In-memory', sets: { writeAmp: 1, readAmp: 0 },
    info: 'Redis, Memcached. No disk on the read path at all, so the ceilings that matter become CPU per operation and RAM. Durability is optional — and turning it on costs you the fsync you were avoiding.',
    scale: 'Add shards, each single-threaded — but first check the data still fits in RAM, which is usually the real limit.',
    giveUp: 'durability, by default',
    perWrite: 'none — RAM only',
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
export const PRESETS: Preset[] = [
  {
    id: 'feed', label: 'Social feed',
    info: '50M readers, a post fans out to ~100 followers — the write is cheap, the deliveries are not.',
    req: { fresh: 'pull', txn: 'single', loss: 'keep', analytics: 'no' },
    sets: { dau: 5e7, actions: 50, peak: 3, readPct: 90, fanout: 100, online: 10, writeSize: 1, readSize: 50, lat: 100, retention: 12, growth: 10, derived: 2 },
  },
  {
    id: 'chat', label: 'Chat / messaging',
    info: 'Messages must appear the moment they are sent — held connections, small payloads, half the traffic is writes.',
    req: { fresh: 'push', txn: 'single', loss: 'keep', analytics: 'no' },
    sets: { dau: 2e7, actions: 50, peak: 2, readPct: 50, fanout: 5, online: 20, writeSize: 1, readSize: 2, lat: 50, retention: 12, growth: 10, derived: 1 },
  },
  {
    id: 'ingest', label: 'Metrics / event ingest',
    info: '50M devices reporting 200 times a day, almost never read back — and analyzed in bulk later.',
    req: { fresh: 'pull', txn: 'single', loss: 'keep', analytics: 'yes' },
    sets: { dau: 5e7, actions: 200, peak: 2, readPct: 10, fanout: 0, online: 1, writeSize: 2, readSize: 10, lat: 20, retention: 6, growth: 20, derived: 2 },
  },
  {
    id: 'ledger', label: 'Payments / ledger',
    info: 'Money moves between accounts — cross-key transactions disqualify half the table before any arithmetic runs.',
    req: { fresh: 'pull', txn: 'multi', loss: 'keep', analytics: 'yes' },
    sets: { dau: 1e7, actions: 5, peak: 5, readPct: 60, fanout: 1, online: 2, writeSize: 2, readSize: 5, lat: 200, retention: 60, growth: 5, derived: 2 },
  },
  {
    id: 'media', label: 'Media sharing',
    info: '5 MB uploads and 2 MB views at 100M users — the problem is bandwidth and blobs, not request rate.',
    req: { fresh: 'pull', txn: 'single', loss: 'keep', analytics: 'no' },
    sets: { dau: 1e8, actions: 20, peak: 3, readPct: 95, fanout: 1, online: 5, writeSize: 5000, readSize: 2000, lat: 100, retention: 60, growth: 10, derived: 1 },
  },
]

export const INIT: Vals = {}
;[...WORKLOAD, DERIVED_INP, ...HW].forEach((i) => (INIT[i.id] = i.val))

/** a stored pointer row, once blobs move to object storage */
export const POINTER_BYTES = 1024

export interface EngineCol {
  id: string
  /** read pressure on unmitigated reads — decides whether this engine forces a cache */
  rawRU: number
  colCache: boolean
  colReads: number
  rU: number
  bw: number
  bwU: number
  worst: number
  worstName: 'the write stream' | 'read pressure' | 'ops on one core'
  dq: string | null
}

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
  const engDq: Record<string, string | null> = {
    btree: null,
    lsm: req.txn === 'multi' ? 'several keys must change atomically, and transactions do not span partitions' : null,
    mem:
      req.loss === 'keep'
        ? 'this data must survive a node death, and durability is off by default'
        : req.txn === 'multi'
          ? 'several keys must change atomically, and transactions do not span shards'
          : ramHosts > 8
            ? `the dataset is ${int(ramHosts)} nodes of pure RAM`
            : null,
  }
  /** the log is engine-independent: if peaks force one, every engine consumes sustained */
  const writeUtil = peakWrites / writeCeiling
  const logNeed = writeUtil > 0.5 && v.peak >= 2
  /** behind a log the database consumes at the daily average, not the worst minute */
  const dbWrites = logNeed ? peakWrites / v.peak : peakWrites
  /** Each engine is judged on the load that would REACH it in the system built
   *  around it: if its own read pressure forces a cache, its reads become the
   *  misses; if the peak forces a log, its writes become the sustained rate;
   *  if blobs move to object storage, its rows become pointers. Judging on
   *  unmitigated load taxed the LSM's read amplification for reads the cache
   *  absorbs — the pre-cache bias this replaces. */
  const eCols: EngineCol[] = ENGINES.map((e) => {
    const rawRU = e.sets.readAmp === 0 ? 0 : (readSide * e.sets.readAmp) / diskReadCeiling
    const colCache = rawRU > 0.3
    const colReads = colCache ? readSide * (1 - v.cacheHit / 100) : readSide
    const rU = e.sets.readAmp === 0 ? 0 : (colReads * e.sets.readAmp) / diskReadCeiling
    const bw = dbWrites * dbBytesW * e.sets.writeAmp
    const bwU = e.id === 'mem' ? 0 : bw / seqWriteBps
    /** in-memory pays CPU per op instead of disk: all ops against one core */
    const worst = e.id === 'mem' ? (readSide + dbWrites) / cacheCeiling : Math.max(bwU, rU)
    const worstName = e.id === 'mem' ? ('ops on one core' as const) : bwU >= rU ? ('the write stream' as const) : ('read pressure' as const)
    return { id: e.id, rawRU, colCache, colReads, rU, bw, bwU, worst, worstName, dq: engDq[e.id] }
  })
  const alive = eCols.filter((c) => !c.dq)
  /** lowest worst-case wins; strict < keeps the earlier (simpler) machine on ties */
  const engineWin = alive.reduce((best, c) => (c.worst < best.worst ? c : best), alive[0]).id

  return {
    actionsPerDay, avgQps, peakQps, peakReads, peakWrites, writesPerDay, deliveries, readSide,
    bytesW, bytesR, storagePerDay, storageTotal, dbStorage, storageShards,
    writeCeiling, diskReadCeiling, cacheCeiling, seqWriteBps, seqReadBps, ramBytes, ramHosts, scanSeconds,
    heldConns, egressFor, tCols, transportWin,
    writeUtil, logNeed, dbWrites, blobNeed, dbBytesW, eCols, engineWin,
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
  const cacheNodes = Math.max(1, Math.ceil(m.readSide / m.cacheCeiling))
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
  const writeShards = Math.max(1, Math.ceil(writeUtilAfter))
  const shardNeed = writeUtilAfter > 1 || m.storageShards > 1
  const shards = Math.max(writeShards, m.storageShards)
  const shardBy: 'writes' | 'storage' | 'both' =
    writeUtilAfter > 1 && m.storageShards > 1 ? 'both' : writeUtilAfter > 1 ? 'writes' : 'storage'

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
    writeUtilAfter, writeShards, shardNeed, shards, shardBy,
    monthsToWall, needs,
  }
}

export type Consequences = ReturnType<typeof consequences>
