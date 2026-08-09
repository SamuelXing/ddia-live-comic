import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { fmt } from './format'

/* ============================================================
   Capacity planning from first principles.

   The thesis: REQUIREMENTS FILTER, LOAD RANKS, CEILINGS FORCE.
   Requirement facts disqualify kinds of components outright —
   arithmetic never overrules a promise. Load arithmetic ranks the
   surviving candidates. Crossed ceilings force structural additions,
   and each addition transforms the load every later tier sees.
   Every ceiling is derived from the hardware constants below
   (napkin-math, MIT, measured March 2026); pin a column when reality
   has already chosen for you, and everything downstream follows.
   ============================================================ */

interface Inp {
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

const L = {
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
  conns: [1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6],
  views: [0, 1, 2, 3, 4, 5],
  hit: [50, 70, 80, 90, 95, 99],
}

const WORKLOAD: Inp[] = [
  { id: 'dau', label: 'Daily active users', steps: L.count, val: 5e7, fmt: (v) => fmt.compact(v), hint: 'Or any daily population driving the system.', info: 'The population driving the system on a normal day. Everything downstream scales from it, so it is worth stating the assumption out loud rather than reaching for a request rate directly.' },
  { id: 'actions', label: 'Actions / user / day', steps: L.small, val: 20, fmt: (v) => fmt.int(v) + '/day', hint: 'Requests one active user makes in a day.', info: 'How many requests one active user generates per day. A read-heavy feed might be 50; a banking app might be 3. This times users is your daily volume.' },
  { id: 'peak', label: 'Peak factor', steps: L.mult, val: 3, fmt: (v) => '×' + fmt.n1(v), hint: 'Busiest moment vs the daily average.', info: 'Traffic is never flat. The busiest minute usually runs a few times the daily average — more for consumer apps with an evening peak, less for global systems whose load spreads across time zones. You must size for the peak, not the average.' },
  { id: 'readPct', label: 'Read share', steps: L.pct, val: 85, fmt: (v) => v + '% reads', hint: 'Reads cache and replicate. Writes are the wall.', info: 'The split matters more than the total, because reads and writes scale differently: reads spread across caches and replicas, while writes all funnel to one place until you shard. A system that is 99% reads is a very different machine from one that is 50% writes.' },
  { id: 'fanout', label: 'Deliveries per write', steps: L.fan, val: 1, fmt: (v) => (v === 0 ? 'none' : '×' + fmt.int(v)), hint: 'A message to a 50-person group is 50 deliveries. 0 = write-only ingest.', info: "How many people a single write must reach. For 1:1 messaging it is 1; for a group chat it is the group size; for a social feed it is the follower count; for sensor ingest nobody is waiting, so it is 0. This is the multiplier that decides whether you fan out on write or on read — and it is usually the number that breaks a design, because the write side is cheap while the delivery side is not." },
  { id: 'online', label: 'Peak concurrently online', steps: L.onl, val: 10, fmt: (v) => v + '% of DAU', hint: 'Share of daily users present at the same moment.', info: 'What fraction of a day’s users are present at the busiest moment. It only turns into held connections if the transport keeps one open per user — which is exactly what the transport decision on the right computes.' },
  { id: 'writeSize', label: 'Avg written object', steps: L.kb, val: 2, fmt: (v) => fmt.bytes(v * 1024), hint: 'What one write stores. Drives disk and storage.', info: 'The size of what a write actually persists — a message, an order row, an event. It multiplies into storage, disk bandwidth and delivery egress. Kept separate from the read response below, because in most systems they differ wildly: you write a 2 KB message and read back a 50 KB page.' },
  { id: 'readSize', label: 'Avg read response', steps: L.kb, val: 50, fmt: (v) => fmt.bytes(v * 1024), hint: 'What one read returns. Drives egress.', info: 'The size of what a read sends back — a page, a timeline, an API response, usually an assembly of many stored objects. This is what network egress is made of, which is why it is a different slider from the written object: conflating them muddles the disk bill with the bandwidth bill.' },
  { id: 'lat', label: 'Avg request latency', steps: L.ms, val: 100, fmt: (v) => v + ' ms', hint: 'Service time per request, for Little’s Law.', info: "How long the server spends on one request. With Little's Law it decides how many instances you need: halve the latency and you halve the fleet, which is why profiling often beats autoscaling." },
  { id: 'retention', label: 'Data retention', steps: L.mo, val: 12, fmt: (v) => v + ' mo', hint: 'How long writes are kept.', info: 'How long you keep writes before deleting or archiving them. Storage is retention times daily volume, so a policy decision — not a technical one — usually sets your disk bill.' },
  { id: 'growth', label: 'Monthly growth', steps: L.growth, val: 10, fmt: (v) => v + '%/mo', hint: 'Compounded, for the runway estimate.', info: "Compounded month over month. Its real use is not the 12-month number but the runway: how long before today's comfortable headroom becomes next quarter's incident." },
]

/** the derived-views requirement is a count, so it renders as a slider */
const DERIVED_INP: Inp = {
  id: 'derived', label: 'Systems fed by every change', steps: L.views, val: 1,
  fmt: (v) => (v === 0 ? 'none' : fmt.int(v)),
  hint: 'Search index, analytics table, cache invalidation…',
  info: 'Count the other systems that must see every write: the search index, the analytics store, the cache that must be invalidated, the feature store. Each one is a copy that must not drift — and past one of them, how they hear about changes becomes its own design problem.',
}

/** src: 'napkin' = measured constant; 'assume' = a modelling choice you should challenge */
const HW: (Inp & { src: 'napkin' | 'assume' })[] = [
  { id: 'fsync', label: 'SSD write + fsync', steps: L.us, val: 300, src: 'napkin', fmt: (v) => v + ' µs', hint: 'The cost of making one write durable. Sets the write ceiling.', info: 'A write is not durable until the drive confirms it is on stable media — that confirmation is fsync, and it costs roughly 1000x more than writing to memory. Every committed transaction pays it. That is why this one number sets the ceiling for any database that promises not to lose your data.' },
  { id: 'group', label: 'Transactions per fsync', steps: L.pow2, val: 8, src: 'assume', fmt: (v) => '×' + fmt.int(v), hint: 'Group commit: how many commits share one fsync.', info: 'Databases batch concurrent commits so a single fsync makes several transactions durable at once. Under load the batch fills and throughput multiplies; with one lonely transaction at a time you get no batching at all. This is the biggest assumption on the page: at x1 the ceiling is ~3.3k writes/s, at x8 it is ~27k.' },
  { id: 'randRead', label: 'Random SSD read (8 KiB)', steps: L.us, val: 100, src: 'napkin', fmt: (v) => v + ' µs', hint: 'What a cache miss costs when it reaches disk.', info: 'What a cache miss costs once it reaches disk. Sequential reads stream at gigabytes per second, but a random 8 KiB read costs ~100 us — thousands of times slower than the same bytes in RAM. This gap is the entire reason caches exist.' },
  { id: 'ioDepth', label: 'Concurrent disk reads', steps: L.pow2, val: 8, src: 'assume', fmt: (v) => '×' + fmt.int(v), hint: 'NVMe serves many reads at once; this multiplies read throughput.', info: "A spinning disk served one read at a time; NVMe keeps many in flight, so throughput is queue depth divided by latency rather than one over latency. Real drives sustain far deeper queues — x8 is a deliberately conservative stand-in for one database's effective read parallelism." },
  { id: 'seqRead', label: 'Sequential SSD read', steps: [1, 2, 4, 8, 16], val: 8, src: 'napkin', fmt: (v) => v + ' GiB/s', hint: 'Streaming a file end to end. Sets full-scan time.', info: 'Reading a file front to back streams ~80x faster than hopping around it — 8 GiB/s vs the equivalent of ~70 MiB/s for random 8 KiB reads. Dividing your stored bytes by this number tells you how long a full table scan takes, which is the arithmetic behind “do not run analytics on the primary.”' },
  { id: 'seqWrite', label: 'Sequential SSD write', steps: [1, 2, 3, 5, 10], val: 3, src: 'napkin', fmt: (v) => v + ' GiB/s', hint: 'Streaming bandwidth, before fsync. The write-stream budget.', info: 'How fast one node can stream bytes to disk when it does not wait for fsync on each one. The engine decision compares each engine’s write stream — logical writes times its amplification — against this budget.' },
  { id: 'cacheOp', label: 'Cache op, CPU cost', steps: [1, 2, 5, 10, 20, 50, 100], val: 10, src: 'assume', fmt: (v) => v + ' µs', hint: 'Two syscalls cost ~0.6 µs; parsing and the network stack are the rest.', info: 'What one cache command costs the server end to end. The floor is two syscalls (~0.6 us) plus a hash and a memory lookup; parsing, the event loop and the network stack are what actually dominate. Because a cache shard executes commands one at a time on one core, this number IS its throughput.' },
  { id: 'cacheHit', label: 'Cache hit rate', steps: L.hit, val: 90, src: 'assume', fmt: (v) => v + '%', hint: 'Reads the cache absorbs before the database sees them.', info: 'The share of reads answered from memory instead of disk. It depends entirely on access skew — a feed where everyone reads the same hot posts caches beautifully; uniform random access barely caches at all. This is the single most consequential assumption on the page: it decides how much read load survives to hit the database.' },
  { id: 'cdnHit', label: 'CDN offload', steps: L.hit, val: 80, src: 'assume', fmt: (v) => v + '%', hint: 'Egress served from the edge instead of your origin.', info: 'The share of bytes the CDN serves from its edge instead of your origin. High for static objects and popular media; low for personalized or private responses. Whatever it does not absorb still needs origin NICs.' },
  { id: 'nic', label: 'Origin NIC', steps: L.gbps, val: 10, src: 'assume', fmt: (v) => v + ' Gbps', hint: 'Per-host egress capacity before you need more hosts or a CDN.', info: 'How many bits one host can push. For media-heavy systems bandwidth is usually the first ceiling you hit — you run out of network long before CPU or disk. Once peak egress exceeds this you either add hosts purely for bandwidth, or move the bytes to a CDN.' },
  { id: 'overhead', label: 'Protocol overhead / message', steps: [2, 10, 50, 100, 200, 500, 800, 1500], val: 800, src: 'assume', fmt: (v) => v + ' B', hint: 'Bytes each message costs beyond the payload. Set by the transport choice.', info: 'HTTP repays request and response headers on every exchange — often several hundred bytes, which dwarfs a short chat message. A WebSocket frame costs a handful of bytes. When payloads are small, the protocol can cost more than the data. The transport decision writes this value; you can still drag it.' },
  { id: 'readAmp', label: 'Files touched per read', steps: [0, 1, 2, 3, 5], val: 1, src: 'assume', fmt: (v) => (v === 0 ? 'none (RAM)' : '×' + v), hint: 'Disk lookups per read. Set by the engine choice.', info: 'A B-tree walks to exactly one leaf page. An LSM store may check the memtable and several sorted files before it finds the key — bloom filters skip most of them, but not for free. An in-memory store touches no disk at all. The engine decision writes this value.' },
  { id: 'writeAmp', label: 'Write amplification', steps: L.amp, val: 3, src: 'assume', fmt: (v) => '×' + fmt.int(v), hint: 'Bytes written per logical write. Set by the engine choice.', info: 'One logical row write touches the disk more than once: the write-ahead log, the page itself, and every index that must be updated. x3 is modest — a table with several indexes is worse. The engine decision writes this value; raise it if your tables carry many indexes.' },
  { id: 'connsPerHost', label: 'Connections per host', steps: L.conns, val: 1e5, src: 'assume', fmt: (v) => fmt.compact(v), hint: 'Live connections one server can hold.', info: 'Bounded by memory per connection, file descriptors, and the CPU spent on heartbeats — not by request rate. Tuned servers hold hundreds of thousands; a default-configured one manages far fewer. This is the ceiling that sizes the edge tier of any chat or presence system.' },
  { id: 'slots', label: 'Concurrency per instance', steps: L.slots, val: 64, src: 'assume', fmt: (v) => fmt.int(v) + ' slots', hint: 'In-flight requests one app instance handles.', info: "How many requests one instance can have in flight at once — threads, workers, or async tasks. Little's Law turns it into a machine count. Raising it does not create capacity when the work is CPU-bound; it just lets more requests queue." },
  { id: 'ram', label: 'RAM per node', steps: [16, 32, 64, 128, 256, 512, 1024], val: 128, src: 'assume', fmt: (v) => v + ' GB', hint: 'For the “does it fit in memory” check.', info: 'The feasibility check for an in-memory store is not throughput — it is whether the dataset fits. Stored bytes divided by this number is how many machines of pure RAM you would be buying.' },
]

interface Opt {
  id: string
  label: string
  info: string
}

/** requirement questions — facts about the promises the system makes.
 *  These FILTER candidates; the load arithmetic only ranks survivors. */
const FRESH: Opt[] = [
  { id: 'pull', label: 'Users ask for it', info: 'New data appears when the client asks — a refresh, a page load, an occasional poll. Nothing has to be held open, so the transport can stay plain request/response.' },
  { id: 'push', label: 'It must appear', info: 'Chat, presence, live dashboards, collaborative editing: the server must deliver the moment something happens, which means holding something open to every online client.' },
]
const TXN: Opt[] = [
  { id: 'single', label: 'One key at a time', info: 'Each write touches one row, document or key. Per-key atomicity — which every engine on this page provides — is enough.' },
  { id: 'multi', label: 'Atomic across keys', info: 'Money moves between two accounts; an order reserves stock and charges a card. Several keys must change together or not at all. That is a cross-key transaction, and engines that cannot span partitions are disqualified — arithmetic never overrules this.' },
]
const LOSS: Opt[] = [
  { id: 'keep', label: 'Must survive', info: 'This is the system of record: an acknowledged write is a promise, even if the node dies a millisecond later. Engines whose durability is optional are disqualified from holding it.' },
  { id: 'rebuild', label: 'Can be rebuilt', info: 'A cache, a session, a feed — losing a node costs a recompute from the source of record, not an apology. Durability stops being a filter, and the in-memory column becomes a real candidate.' },
]
const ANALYTICS: Opt[] = [
  { id: 'no', label: 'Serve it back', info: 'The data is read back the way it was written — a profile, a message, an order. Point lookups and short ranges; the primary handles it.' },
  { id: 'yes', label: 'Also analyze it', info: 'Someone will run questions across ALL of it — dashboards, reports, aggregates over months. That is a different read pattern: scanning columns of everything rather than fetching one row, and it should not share a disk with the row that must return in 5 ms.' },
]

/** transports the tool decides between; sets{} writes into the visible constants */
const PROTOCOLS = [
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
const ENGINES = [
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

function Picker({ options, value, onPick }: { options: Opt[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="picker">
      {options.map((o) => (
        <button key={o.id} className={'pick' + (o.id === value ? ' on' : '')} onClick={() => onPick(o.id)} title={o.info}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Info({ text }: { text?: string }) {
  if (!text) return null
  return (
    <span className="info" tabIndex={0} role="note" aria-label={text}>
      i<span className="info-tip">{text}</span>
    </span>
  )
}

function Slider({ inp, value, set }: { inp: Inp; value: number; set: (n: number) => void }) {
  let i = inp.steps.indexOf(value)
  if (i < 0) i = inp.steps.reduce((best, s, k) => (Math.abs(s - value) < Math.abs(inp.steps[best] - value) ? k : best), 0)
  return (
    <input
      type="range"
      min={0}
      max={inp.steps.length - 1}
      step={1}
      value={i}
      onChange={(e) => set(inp.steps[parseInt(e.target.value)])}
    />
  )
}

function Ctl({ label, info, hint, children, val }: { label: string; info?: string; hint: string; children: ReactNode; val?: string }) {
  return (
    <div className="ctl">
      <div className="ctl-top">
        <span className="ctl-label">
          {label}
          <Info text={info} />
        </span>
        {val && <span className="ctl-val">{val}</span>}
      </div>
      {children}
      <div className="ctl-hint">{hint}</div>
    </div>
  )
}

/** one decision, laid out as a computed comparison — losing columns stay
 *  visible, disqualified columns say which requirement removed them */
function Decision({
  title, info, rowLabels, cols, winner, pinned, onPin, verdict,
}: {
  title: string
  info: string
  rowLabels: string[]
  cols: { id: string; label: string; cells: ReactNode[]; dq?: string | null }[]
  winner: string
  pinned: string | null
  onPin: (id: string) => void
  verdict: ReactNode
}) {
  const eff = pinned ?? winner
  const cls = (c: { id: string; dq?: string | null }) =>
    c.id === eff ? (pinned ? 'pin' : 'win') : c.dq ? 'dq' : ''
  const pinnedCol = pinned ? cols.find((c) => c.id === pinned) : null
  return (
    <div className="decide">
      <div className="dc-h">
        <b>{title}</b>
        <Info text={info} />
        {pinned && (
          <button className="dc-unpin" onClick={() => onPin(winner)} title="Clear the pin and let the requirements and arithmetic choose">
            let the numbers pick
          </button>
        )}
      </div>
      <div className="dc-scroll">
        <table className="dc-tbl">
          <thead>
            <tr>
              <th />
              {cols.map((c) => (
                <th key={c.id} className={cls(c)}>
                  <button onClick={() => onPin(c.id)} title={c.id === eff ? undefined : c.dq ? c.dq : 'Pin this choice — everything downstream follows'}>
                    {c.label}
                    {c.id === eff && <span className="dc-tag">{pinned ? 'pinned' : 'the numbers pick'}</span>}
                    {c.id !== eff && c.dq && <span className="dc-tag">out</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowLabels.map((rl, i) => (
              <tr key={rl}>
                <td className="rl">{rl}</td>
                {cols.map((c) => (
                  <td key={c.id} className={cls(c)}>{c.cells[i]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="dc-verdict">{verdict}</div>
      {pinnedCol && pinnedCol.dq && (
        <div className="dc-pinnote">Pinned against a requirement — {pinnedCol.dq}.</div>
      )}
      {pinnedCol && !pinnedCol.dq && pinned !== winner && (
        <div className="dc-pinnote">
          Pinned by you — on these numbers the arithmetic would pick {cols.find((c) => c.id === winner)?.label}.
        </div>
      )}
    </div>
  )
}

const INIT: Record<string, number> = {}
;[...WORKLOAD, DERIVED_INP, ...HW].forEach((i) => (INIT[i.id] = i.val))

const pc = (x: number) => fmt.n1(x * 100) + '%'
const dur = (s: number) =>
  s < 90 ? Math.round(s) + ' s' : s < 5400 ? Math.round(s / 60) + ' min' : s < 172800 ? fmt.n1(s / 3600) + ' h' : fmt.n1(s / 86400) + ' days'

export default function Calculator() {
  const [v, setV] = useState<Record<string, number>>(INIT)
  const [showHw, setShowHw] = useState(false)
  const [fresh, setFresh] = useState('pull')
  const [txn, setTxn] = useState('single')
  const [loss, setLoss] = useState('keep')
  const [analytics, setAnalytics] = useState('no')
  const [pinT, setPinT] = useState<string | null>(null)
  const [pinE, setPinE] = useState<string | null>(null)
  const set = (id: string) => (n: number) => setV((s) => ({ ...s, [id]: n }))
  const atDefaults =
    Object.keys(INIT).every((k) => v[k] === INIT[k]) &&
    fresh === 'pull' && txn === 'single' && loss === 'keep' && analytics === 'no' && pinT === null && pinE === null

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
  const ramHosts = Math.ceil(storageTotal / ramBytes)

  // ---------- decision 1: transport, filtered by the freshness requirement ----------
  const heldConns = (v.dau * v.online) / 100
  /** egress = responses to readers + pushed deliveries, each plus protocol bytes */
  const egressFor = (oh: number) => (peakReads * (bytesR + oh) + deliveries * (bytesW + oh)) * 8 / 1e9
  const tCols = PROTOCOLS.map((p) => {
    const hosts = p.holds ? Math.ceil(heldConns / v.connsPerHost) : 0
    const eg = egressFor(p.sets.overhead)
    return {
      id: p.id,
      label: p.label,
      hosts,
      eg,
      dq: fresh === 'push' && !p.holds ? 'data must appear on its own — nothing is held open to push down' : null,
      cells: [
        p.id === 'req' ? 'no' : 'yes',
        p.holds ? `${fmt.compact(heldConns)} · ${fmt.int(hosts)} host${hosts === 1 ? '' : 's'}` : '—',
        `~${p.sets.overhead} B`,
        `${fmt.n1(eg)} Gbps`,
      ] as ReactNode[],
    }
  })
  const transportWin = fresh === 'push' ? 'ws' : 'req'
  const effT = PROTOCOLS.find((p) => p.id === (pinT ?? transportWin))!
  const tVerdict =
    fresh === 'push'
      ? `Request/response is out — data must appear on its own, and nothing is held open to push down. Between the survivors: both hold ${fmt.compact(heldConns)} connections, but polling repays full headers on every message — ${fmt.n1(tCols[1].eg)} vs ${fmt.n1(tCols[2].eg)} Gbps at ${fmt.compact(readSide)} deliveries/s. WebSocket wins on arithmetic.`
      : `Nothing must be pushed, so plain request/response wins: the other columns would hold ${fmt.compact(heldConns)} sockets open — ${fmt.int(tCols[2].hosts)} host${tCols[2].hosts === 1 ? '' : 's'} of connection tier — to deliver nothing the client could not ask for.`

  // ---------- decision 2: engine — requirements filter, then utilization ranks ----------
  /** why each column is disqualified, or null if it survives the requirements */
  const engDq: Record<string, string | null> = {
    btree: null,
    lsm: txn === 'multi' ? 'several keys must change atomically, and transactions do not span partitions' : null,
    mem:
      loss === 'keep'
        ? 'this data must survive a node death, and durability is off by default'
        : txn === 'multi'
          ? 'several keys must change atomically, and transactions do not span shards'
          : ramHosts > 8
            ? `${fmt.bytes(storageTotal)} ÷ ${v.ram} GB = ${fmt.int(ramHosts)} nodes of pure RAM`
            : null,
  }
  const eCols = ENGINES.map((e) => {
    const bw = peakWrites * bytesW * e.sets.writeAmp
    const bwU = e.id === 'mem' ? 0 : bw / seqWriteBps
    const rU = e.sets.readAmp === 0 ? 0 : (readSide * e.sets.readAmp) / diskReadCeiling
    /** in-memory pays CPU per op instead of disk: all ops against one core */
    const worst = e.id === 'mem' ? (readSide + peakWrites) / cacheCeiling : Math.max(bwU, rU)
    const worstName = e.id === 'mem' ? 'ops on one core' : bwU >= rU ? 'the write stream' : 'read pressure'
    return { id: e.id, label: e.label, short: e.short, bw, bwU, rU, worst, worstName, dq: engDq[e.id], e }
  })
  const alive = eCols.filter((c) => !c.dq)
  const engineWin = alive.reduce((best, c) => (c.worst < best.worst ? c : best), alive[0]).id
  const effE = ENGINES.find((e) => e.id === (pinE ?? engineWin))!
  const [bt, ls] = eCols
  const engCols = eCols.map((c) => ({
    id: c.id,
    label: c.label,
    dq: c.dq,
    cells: [
      c.e.perWrite,
      c.id === 'mem' ? '—' : `${fmt.bytes(c.bw)}/s · ${pc(c.bwU)} of ${v.seqWrite} GiB/s`,
      c.id === 'mem' ? `${pc(c.worst)} of one core` : pc(c.rU),
      c.id === 'mem' ? `${fmt.int(ramHosts)} host${ramHosts === 1 ? '' : 's'} × ${v.ram} GB` : '—',
      c.e.giveUp,
    ] as ReactNode[],
  }))
  const outSentences = eCols.filter((c) => c.dq).map((c) => `${c.short} is out — ${c.dq}`)
  let cmp: string
  if (alive.length === 1) {
    cmp = `Only ${alive[0].short} satisfies the requirements; the comparison is moot until a requirement changes.`
  } else {
    const list = alive.map((c) => `${c.short} ${pc(c.worst)} (${c.worstName})`).join(' · ')
    cmp = `Worst ceiling per surviving column: ${list}. The lowest wins; ties go to the simpler machine.`
    if (engineWin === 'lsm') cmp += ' Appending in sorted batches is what holds the LSM lower — it repays the difference later as background compaction, off the commit path.'
    if (!bt.dq && !ls.dq && bt.worst > 1 && ls.worst > 1) cmp += ' Both disk engines are over one node either way, so this data gets partitioned regardless — the lower worst just means fewer shards.'
  }
  const eVerdict = [...outSentences, cmp].join('. ')

  /** the chosen shape writes its constants into the visible panel below */
  useEffect(() => {
    setV((s) => ({ ...s, ...effT.sets, ...effE.sets }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effT.id, effE.id])

  // ---------- consequences of the chosen shape ----------
  const connections = effT.holds ? heldConns : 0
  const connHosts = effT.holds ? Math.ceil(connections / v.connsPerHost) : 0
  const egressGbps = egressFor(v.overhead)
  const diskWriteBytes = peakWrites * bytesW * v.writeAmp
  const webInstances = Math.max(1, Math.ceil((peakQps * (v.lat / 1000)) / v.slots))
  const originHosts = Math.max(1, Math.ceil(egressGbps / v.nic))
  const cacheNodes = Math.max(1, Math.ceil(readSide / cacheCeiling))
  const readUtil = v.readAmp === 0 ? 0 : (readSide * v.readAmp) / diskReadCeiling
  const writeUtil = peakWrites / writeCeiling
  const scanSeconds = storageTotal / seqReadBps

  // ---------- the chain: each forced addition transforms the load downstream ----------
  const cdnNeed = originHosts > 1
  const originAfter = cdnNeed ? egressGbps * (1 - v.cdnHit / 100) : egressGbps
  const originHostsAfter = Math.max(1, Math.ceil(originAfter / v.nic))
  const cacheNeed = readUtil > 0.3
  const missReads = cacheNeed ? readSide * (1 - v.cacheHit / 100) : readSide
  const readUtilAfter = v.readAmp === 0 ? 0 : (missReads * v.readAmp) / diskReadCeiling
  const logNeed = writeUtil > 0.5 && v.peak >= 2
  /** behind a log the database consumes at the daily average, not the worst minute */
  const dbWrites = logNeed ? peakWrites / v.peak : peakWrites
  const writeUtilAfter = dbWrites / writeCeiling
  const shardNeed = writeUtilAfter > 1
  const shards = Math.max(1, Math.ceil(writeUtilAfter))

  const derived: { k: string; v: string; how: string }[] = [
    { k: 'Requests', v: `${fmt.compact(avgQps)}/s avg · ${fmt.compact(peakQps)}/s peak`, how: `${fmt.compact(v.dau)} × ${v.actions} ÷ 86,400 × ${fmt.n1(v.peak)}` },
    { k: 'Split at peak', v: `${fmt.compact(peakReads)}/s reads · ${fmt.compact(peakWrites)}/s writes`, how: `peak × ${v.readPct}% / ${100 - v.readPct}%` },
    { k: 'Delivery side', v: `${fmt.compact(readSide)}/s`, how: v.fanout === 0 ? `${fmt.compact(peakReads)} reads — ingest, nothing is delivered` : `${fmt.compact(peakReads)} reads + ${fmt.compact(peakWrites)} writes × ${v.fanout} fan-out` },
    { k: 'Live connections', v: effT.holds ? `${fmt.compact(connections)} · ~${fmt.int(connHosts)} host${connHosts === 1 ? '' : 's'}` : 'none', how: effT.holds ? `${fmt.compact(v.dau)} × ${v.online}% ÷ ${fmt.compact(v.connsPerHost)} per host` : `${effT.label.toLowerCase()} holds nothing open` },
    { k: 'New data', v: `${fmt.bytes(storagePerDay)}/day`, how: `${fmt.compact(writesPerDay)} writes/day × ${fmt.bytes(bytesW)} written` },
    { k: 'Stored at retention', v: fmt.bytes(storageTotal), how: `${fmt.bytes(storagePerDay)}/day × 30 × ${v.retention} mo, before replication` },
    { k: 'Disk write rate', v: `${fmt.bytes(diskWriteBytes)}/s`, how: `${fmt.compact(peakWrites)} writes/s × ${fmt.bytes(bytesW)} × ${v.writeAmp} amplification` },
    { k: 'Peak egress', v: `${fmt.n1(egressGbps)} Gbps`, how: `${fmt.compact(peakReads)} reads × ${fmt.bytes(bytesR)} + ${fmt.compact(deliveries)} deliveries × ${fmt.bytes(bytesW)}, +${v.overhead} B protocol each` },
    { k: 'Request workers', v: `~${fmt.int(webInstances)}`, how: `Little’s Law: ${fmt.compact(peakQps)}/s × ${v.lat} ms ÷ ${v.slots} slots${effT.holds ? ' — separate from the connection tier' : ''}` },
  ]

  const ceilings: { k: string; v: string; how: string }[] = [
    { k: 'Durable writes, one primary', v: `${fmt.compact(writeCeiling)}/s`, how: `${v.group} commits per fsync ÷ ${v.fsync} µs` },
    { k: 'Random reads, one node', v: `${fmt.compact(diskReadCeiling)}/s`, how: `${v.ioDepth} concurrent ÷ ${v.randRead} µs` },
    { k: 'Cache ops, one core', v: `${fmt.compact(cacheCeiling)}/s`, how: `1 ÷ ${v.cacheOp} µs per op` },
    { k: 'Full scan of the dataset', v: dur(scanSeconds), how: `${fmt.bytes(storageTotal)} ÷ ${v.seqRead} GiB/s sequential` },
    { k: 'Egress, one host', v: `${v.nic} Gbps`, how: 'NIC capacity' },
    { k: 'Connections, one host', v: fmt.compact(v.connsPerHost), how: 'memory + file descriptors + heartbeat CPU' },
  ]

  interface Rec { need: boolean; what: string; number: string; because: string; to: { label: string; href: string }[] }
  const recs: Rec[] = [
    {
      need: connHosts > 1,
      what: 'A separate connection tier',
      number: `${fmt.compact(connections)} live connections ÷ ${fmt.compact(v.connsPerHost)} per host = ${connHosts} hosts, before any request work`,
      because:
        'connections are held, not served — a mostly idle socket still costs memory, a file descriptor and a heartbeat. This tier is sized by concurrency, not by request rate, so it scales separately from everything else and is usually stateless in front of a message bus',
      to: [
        { label: 'Web / app tier', href: '/components/web' },
        { label: 'Idea: the trouble with distributed systems', href: '/read/distributed-troubles' },
      ],
    },
    {
      need: v.fanout > 1 && deliveries > writeCeiling,
      what: 'Fan-out on read, or a fan-out worker pool',
      number: `${fmt.compact(peakWrites)} writes/s × ${v.fanout} = ${fmt.compact(deliveries)} deliveries/s`,
      because:
        'writing once is cheap; delivering it to every recipient is what costs. Past a certain fan-out you stop pushing copies at write time and let readers pull instead — or you accept the write amplification and do it asynchronously in workers',
      to: [
        { label: 'Idea: leader & followers', href: '/read/replication-leader' },
        { label: 'Kafka deep-dive', href: '/components/kafka' },
      ],
    },
    {
      need: cdnNeed,
      what: 'A CDN in front of the origin',
      number: `${fmt.n1(egressGbps)} Gbps ÷ ${v.nic} Gbps per host = ${originHosts} hosts of pure bandwidth — after ${v.cdnHit}% offload, ${fmt.n1(originAfter)} Gbps and ${originHostsAfter} host${originHostsAfter === 1 ? '' : 's'}`,
      because: 'serving these bytes from your own origin costs hosts and egress; a CDN moves the copy next to the user and the bill off your origin. What it cannot absorb — personalized, private — still needs origin NICs',
      to: [{ label: 'S3 / object storage', href: '/components/s3' }],
    },
    {
      need: v.writeSize >= 500,
      what: 'Blobs out of the database',
      number: `${fmt.bytes(bytesW)} written per object — a database page is 8 KB, so one object spans ~${fmt.int(bytesW / 8192)} pages`,
      because:
        'a row store is built for KB-scale rows: replication, backups and vacuuming all re-carry every byte you put in it. Store a pointer in the row and the bytes in object storage, and let the CDN serve them from there',
      to: [{ label: 'S3 / object storage', href: '/components/s3' }],
    },
    {
      need: cacheNeed,
      what: 'A cache in front of the database',
      number: `${fmt.compact(readSide)}/s of read+delivery work is ${fmt.n1(readUtil * 100)}% of one node’s ${fmt.compact(diskReadCeiling)}/s random-read ceiling — at ${v.cacheHit}% hits, ${fmt.compact(missReads)}/s survives to disk`,
      because: `a disk read costs ${v.randRead} µs; the same read from memory costs ~20 ns. Caching is not only about throughput — it is a 1000× latency difference`,
      to: [
        { label: 'Redis deep-dive', href: '/components/redis' },
        { label: 'Idea: replication lag', href: '/read/replication-lag' },
      ],
    },
    {
      need: cacheNodes > 1,
      what: 'More than one cache node',
      number: `${fmt.compact(readSide)}/s delivery side ÷ ${fmt.compact(cacheCeiling)}/s per core = ${cacheNodes} node${cacheNodes === 1 ? '' : 's'}`,
      because: 'a cache server is effectively single-threaded per shard, so past one core’s worth of operations you are partitioning, not scaling up',
      to: [
        { label: 'Redis deep-dive', href: '/components/redis' },
        { label: 'Idea: consistent hashing', href: '/read/partitioning' },
      ],
    },
    {
      need: logNeed,
      what: 'A log in front of the writes',
      number: `peaks reach ${fmt.n1(writeUtil * 100)}% of the write ceiling, ×${fmt.n1(v.peak)} above average — behind the log the primary consumes ${fmt.compact(dbWrites)}/s sustained`,
      because: 'a durable log absorbs the spike at sequential-write speed and lets the database consume at its own pace, instead of sizing the database for the worst minute of the day',
      to: [{ label: 'Kafka deep-dive', href: '/components/kafka' }],
    },
    {
      need: shardNeed,
      what: 'Shard the write path',
      number: `${fmt.compact(dbWrites)} writes/s${logNeed ? ' sustained, behind the log,' : ''} vs a ${fmt.compact(writeCeiling)}/s ceiling (${fmt.n1(writeUtilAfter * 100)}% of one primary)`,
      because: `replicas do not help: every replica replays every write. Past one primary the only move left is to split the data. ${effE.scale}`,
      to: [
        { label: 'Idea: consistent hashing', href: '/read/partitioning' },
        { label: 'Postgres deep-dive', href: '/components/postgres' },
      ],
    },
    {
      need: v.derived >= 2,
      what: 'One log, many consumers',
      number: `${fmt.int(v.derived)} derived systems × ${fmt.compact(peakWrites)} writes/s — every change applied in ${fmt.int(v.derived + 1)} places`,
      because:
        'if the app writes to each system directly, two of them will eventually apply “the same” changes in different orders and drift apart forever. Write once to a durable log and let every consumer — search, analytics, cache invalidation — replay the same order at its own pace',
      to: [
        { label: 'Kafka deep-dive', href: '/components/kafka' },
        { label: 'Idea: leader & followers', href: '/read/replication-leader' },
      ],
    },
    {
      need: analytics === 'yes',
      what: 'A separate analytical store',
      number: `a full scan of ${fmt.bytes(storageTotal)} at ${v.seqRead} GiB/s sequential = ${dur(scanSeconds)} — on the same disk your 5 ms lookups live on`,
      because:
        'a row store reads every column of every row to answer an aggregate. A columnar store reads only the columns the query touches and compresses them severalfold (structured data compresses 5–10×, per napkin-math) — fed from the same log by change-data-capture, so the primary never feels the scan',
      to: [
        { label: 'Idea: B-trees vs LSM-trees', href: '/read/storage' },
        { label: 'Kafka deep-dive', href: '/components/kafka' },
      ],
    },
  ]
  const needed = recs.filter((r) => r.need)
  const notYet = recs.filter((r) => !r.need)

  /** the load each tier sees once the forced additions exist */
  const after: { k: string; v: string; how: string }[] = []
  if (cdnNeed)
    after.push({ k: 'Origin egress', v: `${fmt.n1(egressGbps)} → ${fmt.n1(originAfter)} Gbps`, how: `× (1 − ${v.cdnHit}% CDN offload) → ${originHostsAfter} origin host${originHostsAfter === 1 ? '' : 's'}` })
  if (cacheNeed)
    after.push({ k: 'Reads reaching the database', v: `${fmt.compact(readSide)} → ${fmt.compact(missReads)}/s`, how: `misses only: × (1 − ${v.cacheHit}% hit rate) → ${pc(readUtilAfter)} of the read ceiling` })
  if (logNeed)
    after.push({ k: 'Writes reaching the primary', v: `${fmt.compact(peakWrites)} → ${fmt.compact(dbWrites)}/s`, how: `the log absorbs the ×${fmt.n1(v.peak)} peak; the primary consumes at the daily average` })
  if (shardNeed)
    after.push({ k: 'Writes per shard', v: `${fmt.compact(dbWrites / shards)}/s × ${shards} shards`, how: `${pc(dbWrites / shards / writeCeiling)} of one primary each` })
  else if (cacheNeed || logNeed)
    after.push({ k: 'Primary write headroom', v: pc(writeUtilAfter), how: `${fmt.compact(dbWrites)}/s ÷ ${fmt.compact(writeCeiling)}/s ceiling — no sharding yet` })

  const g = v.growth / 100
  const monthsToWall =
    peakWrites >= writeCeiling ? 0 : g > 0 ? Math.log(writeCeiling / Math.max(1, peakWrites)) / Math.log(1 + g) : Infinity

  return (
    <section>
      <p className="h-kicker">Capacity planning</p>
      <h1 className="title">What does this system actually need?</h1>
      <p className="lede">
        <b>Requirements filter, load ranks, ceilings force.</b> State the promises the system makes
        and the load it carries; requirement facts disqualify kinds of components outright —
        arithmetic never overrules a promise — the load arithmetic ranks what survives, and every
        crossed ceiling forces a structural addition, which changes the load every later tier sees.
        Every ceiling comes from the <b>hardware constants below</b>; none of it is a remembered
        rule of thumb.
      </p>

      <details className="calc-help">
        <summary>
          <span className="chev">▸</span> How to use this, and how it works
        </summary>
        <div className="calc-help-b">
          <h4>Using it</h4>
          <ol>
            <li>
              <b>State the requirements</b> — must data appear on its own, do writes span keys, can
              the data be rebuilt, will anyone run analytics across all of it. These are facts about
              the product, not technology choices — and they act as <em>filters</em>: a requirement
              can disqualify a column outright, and no throughput number un-disqualifies it.
            </li>
            <li>
              <b>Describe the workload</b> — how many people, how often each one acts, how much
              bigger the busiest moment is, how large one written object and one read response are.
              Every input snaps to a round step (10k, 20k, 50k…) because at this level of modelling
              the <em>scale</em> is the answer; “16k users” implies a precision nobody has.
            </li>
            <li>
              <b>Read “the choices the numbers make.”</b> Transport and storage engine are computed
              comparisons: every option is a column, disqualified columns are greyed with the
              requirement that removed them, and among survivors the winner is the column whose
              worst ceiling utilization is lowest. If reality has already chosen — you run Postgres,
              the client is stuck behind HTTP — <b>click that column to pin it</b>, and everything
              downstream follows the pinned choice instead.
            </li>
            <li>
              <b>Read “what the numbers force,”</b> then <b>“the load, after the additions.”</b> A
              component appears only when a computed ceiling is crossed, and each addition
              transforms the load downstream: the cache absorbs hits, the log absorbs the peak, the
              CDN absorbs egress. The after-table shows what actually survives to each tier — which
              is why adding a log can make sharding unnecessary.
            </li>
            <li>
              <b>Open “the hardware underneath”</b> and change a constant to see how sensitive the
              conclusion is. If a decision flips when you nudge an assumption, that decision was
              never solid.
            </li>
          </ol>

          <h4>How the ceilings are computed</h4>
          <p>Nothing here is a remembered rule of thumb. Each ceiling is one division:</p>
          <ul className="calc-formulas">
            <li><code>durable writes/s = commits per fsync ÷ fsync latency</code> — a commit is not durable until the write reaches disk, and one fsync can cover a batch of commits.</li>
            <li><code>random reads/s = concurrent reads ÷ random read latency</code> — an SSD serves many reads at once, so the queue depth multiplies throughput.</li>
            <li><code>cache ops/s = 1 ÷ per-op CPU cost</code> — a cache shard runs one command at a time on one core.</li>
            <li><code>full scan = stored bytes ÷ sequential read rate</code> — the arithmetic behind “don’t run analytics on the primary.”</li>
            <li><code>egress = reads × response size + deliveries × object size, ×8</code> — bytes to bits, against one host’s NIC.</li>
            <li><code>app instances = peak rate × latency ÷ concurrency</code> — Little’s Law: concurrency is arrival rate times service time.</li>
          </ul>
          <p>
            The chain works the same way: <code>misses = reads × (1 − hit rate)</code>,{' '}
            <code>sustained writes = peak ÷ peak factor</code>,{' '}
            <code>origin egress = egress × (1 − offload)</code>. Each is one line, and the two hit
            rates are <span className="src-a">assumed</span> constants you should challenge.
          </p>

          <h4>What it will not tell you</h4>
          <p>
            It sizes <em>throughput and capacity</em>, not correctness, cost, or tail latency. It
            assumes an even spread — one hot key or one celebrity row breaks every average on this
            page. And the constants marked <span className="src-a">assumed</span> depend on your
            rows, indexes and access pattern. Treat the output as the order of magnitude you are
            dealing with, then measure the real thing.
          </p>
        </div>
      </details>

      <div className="card" style={{ padding: 0 }}>
        <div className="sandbox">
          <div className="sb-controls">
            <div className="sb-head">
              <p className="sb-title" style={{ margin: 0 }}>The requirements</p>
              <button
                className="reset-btn"
                onClick={() => {
                  setV(INIT)
                  setFresh('pull')
                  setTxn('single')
                  setLoss('keep')
                  setAnalytics('no')
                  setPinT(null)
                  setPinE(null)
                }}
                disabled={atDefaults}
                title={atDefaults ? 'Already at defaults' : 'Restore every requirement, input and constant to its default'}
              >
                Reset all
              </button>
            </div>
            <Ctl label="How users get new data" info={FRESH.find((o) => o.id === fresh)!.info} hint={FRESH.find((o) => o.id === fresh)!.info.split('.')[0] + '.'}>
              <Picker options={FRESH} value={fresh} onPick={setFresh} />
            </Ctl>
            <Ctl label="Writes that span keys" info={TXN.find((o) => o.id === txn)!.info} hint={TXN.find((o) => o.id === txn)!.info.split('.')[0] + '.'}>
              <Picker options={TXN} value={txn} onPick={setTxn} />
            </Ctl>
            <Ctl label="If a node dies, this data" info={LOSS.find((o) => o.id === loss)!.info} hint={LOSS.find((o) => o.id === loss)!.info.split('.')[0] + '.'}>
              <Picker options={LOSS} value={loss} onPick={setLoss} />
            </Ctl>
            <Ctl label="What the data must answer" info={ANALYTICS.find((o) => o.id === analytics)!.info} hint={ANALYTICS.find((o) => o.id === analytics)!.info.split('.')[0] + '.'}>
              <Picker options={ANALYTICS} value={analytics} onPick={setAnalytics} />
            </Ctl>
            <Ctl label={DERIVED_INP.label} info={DERIVED_INP.info} hint={DERIVED_INP.hint} val={DERIVED_INP.fmt(v.derived)}>
              <Slider inp={DERIVED_INP} value={v.derived} set={set('derived')} />
            </Ctl>

            <p className="sb-title" style={{ marginTop: 18 }}>The workload</p>
            {WORKLOAD.map((inp) => (
              <Ctl key={inp.id} label={inp.label} info={inp.info} hint={inp.hint} val={inp.fmt(v[inp.id])}>
                <Slider inp={inp} value={v[inp.id]} set={set(inp.id)} />
              </Ctl>
            ))}

            <button className="hw-toggle" onClick={() => setShowHw((s) => !s)}>
              {showHw ? '▾' : '▸'} The hardware underneath
            </button>
            {showHw && (
              <div className="hw-body">
                <p className="hw-note">
                  Defaults are measured constants from{' '}
                  <a href="https://github.com/sirupsen/napkin-math" target="_blank" rel="noreferrer">
                    napkin-math
                  </a>{' '}
                  (MIT, March 2026, a 24-core Xeon with local SSD), plus modelling choices marked{' '}
                  <span className="src-a">assumed</span>. The transport and engine decisions write
                  into the protocol-overhead and amplification constants; everything else is yours
                  to drag, and every ceiling above moves with it.
                </p>
                {HW.map((inp) => (
                  <div className="ctl" key={inp.id}>
                    <div className="ctl-top">
                      <span className="ctl-label">
                        {inp.label}{' '}
                        <span className={inp.src === 'napkin' ? 'src-n' : 'src-a'}>
                          {inp.src === 'napkin' ? 'measured' : 'assumed'}
                        </span>
                        <Info text={inp.info} />
                      </span>
                      <span className="ctl-val">{inp.fmt(v[inp.id])}</span>
                    </div>
                    <Slider inp={inp} value={v[inp.id]} set={set(inp.id)} />
                    <div className="ctl-hint">{inp.hint}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sb-out">
            <p className="sb-title">So the system is</p>
            <table className="tbl">
              <tbody>
                {derived.map((r) => (
                  <tr key={r.k}>
                    <td>{r.k}</td>
                    <td>{r.v}</td>
                    <td className="how">{r.how}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="sb-title">The ceilings these run into</p>
            <table className="tbl">
              <tbody>
                {ceilings.map((r) => (
                  <tr key={r.k}>
                    <td>{r.k}</td>
                    <td>{r.v}</td>
                    <td className="how">{r.how}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="sb-title">The choices the numbers make</p>
            <Decision
              title="How clients connect"
              info="Filtered by one requirement: whether data must appear on its own — if it must, request/response is disqualified no matter what it costs. Among survivors, each column is computed from the workload: held connections from the online share, egress from the two payload sizes plus that protocol's per-message overhead."
              rowLabels={['Server can push', 'Held connections', 'Protocol cost / message', 'Peak egress']}
              cols={tCols}
              winner={transportWin}
              pinned={pinT}
              onPin={(id) => setPinT(id === transportWin ? null : id)}
              verdict={tVerdict}
            />
            <Decision
              title="Where writes land"
              info="Requirements filter first: cross-key atomicity disqualifies engines that cannot span partitions, and must-survive data disqualifies optional durability — no throughput number overrules that. Among survivors, each engine's columns are computed from the workload, and the lowest worst-case utilization wins."
              rowLabels={['Disk per logical write', 'Write stream at peak', 'Read pressure, one node', 'Whole dataset in RAM', 'You give up']}
              cols={engCols}
              winner={engineWin}
              pinned={pinE}
              onPin={(id) => setPinE(id === engineWin ? null : id)}
              verdict={eVerdict}
            />

            <p className="sb-title">What the numbers force</p>
            {needed.length === 0 && (
              <div className="verdict v-good">
                <span className="vi">✓</span>
                <span>
                  <b>One machine still does this.</b> Nothing above crosses a ceiling. The useful
                  answer is to say so — and to name the number that would change it.
                </span>
              </div>
            )}
            {needed.map((r) => (
              <div className="rec" key={r.what}>
                <div className="rec-h">
                  <span className="rec-tag">add</span>
                  <b>{r.what}</b>
                </div>
                <div className="rec-n">{r.number}</div>
                <p className="rec-b">{r.because}</p>
                <div className="rec-l">
                  {r.to.map((l) => (
                    <Link key={l.href} to={l.href}>
                      {l.label} →
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            {after.length > 0 && (
              <>
                <p className="sb-title">The load, after the additions</p>
                <table className="tbl">
                  <tbody>
                    {after.map((r) => (
                      <tr key={r.k}>
                        <td>{r.k}</td>
                        <td>{r.v}</td>
                        <td className="how">{r.how}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {notYet.length > 0 && (
              <>
                <p className="sb-title">Not yet — and the number to watch</p>
                {notYet.map((r) => (
                  <div className="rec rec-off" key={r.what}>
                    <div className="rec-h">
                      <span className="rec-tag off">not yet</span>
                      <b>{r.what}</b>
                    </div>
                    <div className="rec-n">{r.number}</div>
                  </div>
                ))}
              </>
            )}

            <p className="sb-title">Runway</p>
            <div className="tiles">
              <div className="tile">
                <div className="k">Writes at peak</div>
                <div className="v">{fmt.compact(peakWrites)}/s</div>
                <div className="u">{fmt.n1(writeUtil * 100)}% of ceiling</div>
              </div>
              <div className="tile">
                <div className="k">Write ceiling</div>
                <div className="v">{fmt.compact(writeCeiling)}/s</div>
                <div className="u">{v.group} ÷ {v.fsync} µs</div>
              </div>
              <div className="tile">
                <div className="k">Time to that wall</div>
                <div className="v">{monthsToWall === 0 ? 'now' : isFinite(monthsToWall) ? Math.round(monthsToWall) + ' mo' : '∞'}</div>
                <div className="u">at {v.growth}%/mo, unmitigated</div>
              </div>
              <div className="tile">
                <div className="k">Users in 12 mo</div>
                <div className="v">{fmt.compact(v.dau * Math.pow(1 + g, 12))}</div>
                <div className="u">×{fmt.n1(Math.pow(1 + g, 12))}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <details className="calc-help">
        <summary>
          <span className="chev">▸</span> Checked against published measurements
        </summary>
        <div className="calc-help-b">
          <p>
            A model nobody has checked is just tidier folklore. These are the points where this
            page&apos;s arithmetic can be compared against numbers somebody else published.
          </p>
          <table className="tbl">
            <thead>
              <tr>
                <th>What this page computes</th>
                <th>What is published</th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  Bandwidth: 100k ops/s × 4 KB ={' '}
                  <b>{fmt.n1((100000 * 4096 * 8) / 1e9)} Gbps</b>
                </td>
                <td>
                  The Redis docs work the same example and state <b>3.2 Gbit/s</b>, noting it fits a
                  10 Gbit/s link but not a 1 Gbit/s one.
                </td>
                <td className="ok">matches</td>
              </tr>
              <tr>
                <td>
                  Cache ceiling: 1 ÷ {v.cacheOp} µs = <b>{fmt.compact(cacheCeiling)}/s</b> per core
                </td>
                <td>
                  <code>redis-benchmark</code> reports <b>72k/s</b> on random keys and{' '}
                  <b>180k/s</b> on a single key, without pipelining — and <b>1.5M/s</b> with
                  pipelining ×16.
                </td>
                <td className="ok">in range</td>
              </tr>
              <tr>
                <td>
                  Write ceiling: {v.group} ÷ {v.fsync} µs = <b>{fmt.compact(writeCeiling)}/s</b>
                </td>
                <td>
                  fsync is measured at <b>300 µs</b>. With no group commit that is only{' '}
                  <b>{fmt.compact(1 / (v.fsync / 1e6))}/s</b> — the batch size is doing the work
                  here, and it is an assumption, not a measurement.
                </td>
                <td className="warn">sensitive</td>
              </tr>
              <tr>
                <td>
                  Random reads: {v.ioDepth} ÷ {v.randRead} µs = <b>{fmt.compact(diskReadCeiling)}/s</b>
                </td>
                <td>
                  Modern NVMe drives are rated for several hundred thousand IOPS at high queue
                  depth, so this is deliberately conservative at queue depth {v.ioDepth}.
                </td>
                <td className="ok">conservative</td>
              </tr>
              <tr>
                <td>
                  Sequential vs random: {v.seqRead} GiB/s streaming vs ~
                  <b>{fmt.bytes((8192 / v.randRead) * 1e6)}/s</b> of random 8 KiB reads
                </td>
                <td>
                  napkin-math measures both directly: <b>8 GiB/s</b> sequential, <b>~70 MiB/s</b>{' '}
                  random — the ~100× gap that makes full scans and analytics a different problem.
                </td>
                <td className="ok">matches</td>
              </tr>
            </tbody>
          </table>
          <p className="calc-src">
            Sources:{' '}
            <a href="https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/benchmarks/" target="_blank" rel="noreferrer">
              redis.io benchmarks
            </a>{' '}
            ·{' '}
            <a href="https://github.com/sirupsen/napkin-math" target="_blank" rel="noreferrer">
              sirupsen/napkin-math
            </a>{' '}
            (MIT). The honest gaps: the write ceiling swings by ~8× depending on group commit, and
            the two hit rates in the chain are assumptions with no universal value — both are worth
            replacing with measurements from your own system before believing the after-table.
          </p>
        </div>
      </details>

      <div className="note">
        <b>Where these numbers come from.</b> The hardware constants are measured, not folklore —{' '}
        <a href="https://github.com/sirupsen/napkin-math" target="_blank" rel="noreferrer">
          sirupsen/napkin-math
        </a>{' '}
        (MIT), last measured March 2026 on a 24-core Xeon with local SSD. The rest is arithmetic:
        requirements disqualify, Little’s Law sizes the app tier, every ceiling divides a constant
        by the work one operation costs, and every decision picks the surviving column whose worst
        utilization is lowest. What is <em>not</em> measured are the modelling choices marked{' '}
        <span className="src-a">assumed</span> — group commit size, write amplification, the two
        hit rates. Those depend on your rows, indexes and access pattern, so treat the output as an
        order-of-magnitude starting point and then measure your own system. A calculator is for
        knowing which wall you are walking towards, not for sizing a purchase order.
      </div>
    </section>
  )
}
