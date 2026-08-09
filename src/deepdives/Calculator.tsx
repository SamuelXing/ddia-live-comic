import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fmt } from './format'

/* ============================================================
   Capacity planning from first principles.

   Every ceiling on this page is COMPUTED from the hardware constants
   below — no rules of thumb, no remembered magic numbers. The constants
   are editable and sourced (napkin-math, MIT, measured March 2026 on a
   c4-standard-48-lssd), so you can swap in your own hardware and watch
   every threshold move.
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
  fan: [1, 2, 5, 10, 50, 100, 500, 1000],
  onl: [1, 2, 5, 10, 20, 30, 50],
  conns: [1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6],
}

const WORKLOAD: Inp[] = [
  { id: 'dau', label: 'Daily active users', steps: L.count, val: 5e7, fmt: (v) => fmt.compact(v), hint: 'Or any daily population driving the system.', info: 'The population driving the system on a normal day. Everything downstream scales from it, so it is worth stating the assumption out loud rather than reaching for a request rate directly.' },
  { id: 'actions', label: 'Actions / user / day', steps: L.small, val: 20, fmt: (v) => fmt.int(v) + '/day', hint: 'Requests one active user makes in a day.', info: 'How many requests one active user generates per day. A read-heavy feed might be 50; a banking app might be 3. This times users is your daily volume.' },
  { id: 'peak', label: 'Peak factor', steps: L.mult, val: 3, fmt: (v) => '×' + fmt.n1(v), hint: 'Busiest moment vs the daily average.', info: 'Traffic is never flat. The busiest minute usually runs a few times the daily average — more for consumer apps with an evening peak, less for global systems whose load spreads across time zones. You must size for the peak, not the average.' },
  { id: 'readPct', label: 'Read share', steps: L.pct, val: 85, fmt: (v) => v + '% reads', hint: 'Reads cache and replicate. Writes are the wall.', info: 'The split matters more than the total, because reads and writes scale differently: reads spread across caches and replicas, while writes all funnel to one place until you shard. A system that is 99% reads is a very different machine from one that is 50% writes.' },
  { id: 'fanout', label: 'Deliveries per write', steps: L.fan, val: 1, fmt: (v) => '×' + fmt.int(v), hint: 'One message to a 50-person group is 50 deliveries.', info: "How many people a single write must reach. For 1:1 messaging it is 1; for a group chat it is the group size; for a social feed it is the follower count. This is the multiplier that decides whether you fan out on write or on read — and it is usually the number that breaks a design, because the write side is cheap while the delivery side is not." },
  { id: 'online', label: 'Peak concurrently online', steps: L.onl, val: 10, fmt: (v) => v + '% of DAU', hint: 'Share of daily users connected at the same moment.', info: "Systems that hold a live connection per user — chat, presence, collaborative editing, anything over WebSocket — are sized by how many connections they hold, not by requests per second. A mostly idle connection still costs memory, a file descriptor and a heartbeat. Set this to 0 for a plain request/response service." },
  { id: 'payload', label: 'Avg object / response size', steps: L.kb, val: 50, fmt: (v) => fmt.bytes(v * 1024), hint: 'Drives bandwidth and storage.', info: 'The average size of one object or response. It multiplies into three different ceilings — storage, disk bandwidth and network egress — so it is often the number with the most leverage on cost.' },
  { id: 'lat', label: 'Avg request latency', steps: L.ms, val: 100, fmt: (v) => v + ' ms', hint: 'Service time per request, for Little’s Law.', info: "How long the server spends on one request. With Little's Law it decides how many instances you need: halve the latency and you halve the fleet, which is why profiling often beats autoscaling." },
  { id: 'retention', label: 'Data retention', steps: L.mo, val: 12, fmt: (v) => v + ' mo', hint: 'How long writes are kept.', info: 'How long you keep writes before deleting or archiving them. Storage is retention times daily volume, so a policy decision — not a technical one — usually sets your disk bill.' },
  { id: 'growth', label: 'Monthly growth', steps: L.growth, val: 10, fmt: (v) => v + '%/mo', hint: 'Compounded, for the runway estimate.', info: "Compounded month over month. Its real use is not the 12-month number but the runway: how long before today's comfortable headroom becomes next quarter's incident." },
]

/** src: 'napkin' = measured constant; 'assume' = a modelling choice you should challenge */
const HW: (Inp & { src: 'napkin' | 'assume' })[] = [
  { id: 'fsync', label: 'SSD write + fsync', steps: L.us, val: 300, src: 'napkin', fmt: (v) => v + ' µs', hint: 'The cost of making one write durable. Sets the write ceiling.', info: 'A write is not durable until the drive confirms it is on stable media — that confirmation is fsync, and it costs roughly 1000x more than writing to memory. Every committed transaction pays it. That is why this one number sets the ceiling for any database that promises not to lose your data.' },
  { id: 'group', label: 'Transactions per fsync', steps: L.pow2, val: 8, src: 'assume', fmt: (v) => '×' + fmt.int(v), hint: 'Group commit: how many commits share one fsync.', info: 'Databases batch concurrent commits so a single fsync makes several transactions durable at once. Under load the batch fills and throughput multiplies; with one lonely transaction at a time you get no batching at all. This is the biggest assumption on the page: at x1 the ceiling is ~3.3k writes/s, at x8 it is ~27k.' },
  { id: 'randRead', label: 'Random SSD read (8 KiB)', steps: L.us, val: 100, src: 'napkin', fmt: (v) => v + ' µs', hint: 'What a cache miss costs when it reaches disk.', info: 'What a cache miss costs once it reaches disk. Sequential reads stream at gigabytes per second, but a random 8 KiB read costs ~100 us — thousands of times slower than the same bytes in RAM. This gap is the entire reason caches exist.' },
  { id: 'ioDepth', label: 'Concurrent disk reads', steps: L.pow2, val: 8, src: 'assume', fmt: (v) => '×' + fmt.int(v), hint: 'NVMe serves many reads at once; this multiplies read throughput.', info: "A spinning disk served one read at a time; NVMe keeps many in flight, so throughput is queue depth divided by latency rather than one over latency. Real drives sustain far deeper queues — x8 is a deliberately conservative stand-in for one database's effective read parallelism." },
  { id: 'cacheOp', label: 'Cache op, CPU cost', steps: [1, 2, 5, 10, 20, 50, 100], val: 10, src: 'assume', fmt: (v) => v + ' µs', hint: 'Two syscalls cost ~0.6 µs; parsing and the network stack are the rest.', info: 'What one cache command costs the server end to end. The floor is two syscalls (~0.6 us) plus a hash and a memory lookup; parsing, the event loop and the network stack are what actually dominate. Because a cache shard executes commands one at a time on one core, this number IS its throughput.' },
  { id: 'nic', label: 'Origin NIC', steps: L.gbps, val: 10, src: 'assume', fmt: (v) => v + ' Gbps', hint: 'Per-host egress capacity before you need more hosts or a CDN.', info: 'How many bits one host can push. For media-heavy systems bandwidth is usually the first ceiling you hit — you run out of network long before CPU or disk. Once peak egress exceeds this you either add hosts purely for bandwidth, or move the bytes to a CDN.' },
  { id: 'overhead', label: 'Protocol overhead / message', steps: [2, 10, 50, 100, 200, 500, 800, 1500], val: 10, src: 'assume', fmt: (v) => v + ' B', hint: 'Bytes each message costs beyond the payload.', info: "HTTP repays request and response headers on every exchange — often several hundred bytes, which dwarfs a short chat message. A WebSocket frame costs a handful of bytes. When payloads are small, the protocol can cost more than the data." },
  { id: 'readAmp', label: 'Files touched per read', steps: [0, 1, 2, 3, 5], val: 1, src: 'assume', fmt: (v) => (v === 0 ? 'none (RAM)' : '×' + v), hint: 'How many disk lookups one read costs.', info: "A B-tree walks to exactly one leaf page. An LSM store may check the memtable and several sorted files before it finds the key — bloom filters skip most of them, but not for free. An in-memory store touches no disk at all." },
  { id: 'connsPerHost', label: 'Connections per host', steps: L.conns, val: 1e5, src: 'assume', fmt: (v) => fmt.compact(v), hint: 'Live connections one server can hold.', info: "Bounded by memory per connection, file descriptors, and the CPU spent on heartbeats — not by request rate. Tuned servers hold hundreds of thousands; a default-configured one manages far fewer. This is the ceiling that sizes the edge tier of any chat or presence system." },
  { id: 'slots', label: 'Concurrency per instance', steps: L.slots, val: 64, src: 'assume', fmt: (v) => fmt.int(v) + ' slots', hint: 'In-flight requests one app instance handles.', info: "How many requests one instance can have in flight at once — threads, workers, or async tasks. Little's Law turns it into a machine count. Raising it does not create capacity when the work is CPU-bound; it just lets more requests queue." },
  { id: 'writeAmp', label: 'Write amplification', steps: L.amp, val: 3, src: 'assume', fmt: (v) => '×' + fmt.int(v), hint: 'Bytes actually written per logical write: WAL + page + indexes.', info: 'One logical row write touches the disk more than once: the write-ahead log, the page itself, and every index that must be updated. x3 is modest — a table with several indexes is worse. This sets how much disk bandwidth you burn, not how many commits per second you can do.' },
]

interface Profile {
  id: string
  label: string
  info: string
  /** the constants this choice implies */
  sets: Record<string, number>
}

/** How clients talk to you. Decides whether connections are HELD, and what
 *  each message costs in protocol bytes on top of the payload. */
const PROTOCOLS: Profile[] = [
  {
    id: 'req', label: 'Request / response',
    info: 'Plain HTTP. Nothing is held between requests, so there is no connection tier to size — but every message repays full headers, and the server cannot push. Fine for anything the client can ask for on its own schedule.',
    sets: { online: 0, overhead: 800 },
  },
  {
    id: 'poll', label: 'Long polling',
    info: 'The client holds a request open waiting for news, then immediately reconnects. You pay for BOTH: a held connection per client and full headers on every message. It is the expensive way to fake push, and it is why WebSocket exists.',
    sets: { online: 10, overhead: 800 },
  },
  {
    id: 'ws', label: 'WebSocket / SSE',
    info: 'One connection stays open and the server can push down it. Per-message overhead collapses to a few bytes, but every online user now costs memory and a file descriptor whether or not they are doing anything — so you size a connection tier.',
    sets: { online: 10, overhead: 10 },
  },
]

/** The storage engine. Decides how much disk one logical write really costs,
 *  how many files a read may touch, and who does the sharding. */
const ENGINES: (Profile & { scale: string })[] = [
  {
    id: 'btree', label: 'Single-primary SQL',
    info: 'Postgres, MySQL. A write updates pages in place, so it pays the write-ahead log, the page itself and every index. You get transactions and predictable reads; you do the sharding yourself, and there is exactly one machine that accepts writes.',
    sets: { writeAmp: 3, readAmp: 1 },
    scale: 'You will do this by hand: choose a partition key, route to it, and rebalance later — the hard part is that the key is nearly impossible to change once data exists.',
  },
  {
    id: 'lsm', label: 'LSM / wide-column',
    info: 'Cassandra, Scylla, RocksDB. Writes append to memory and flush in sorted batches, so the disk work per write is smaller and sequential — but it comes back later as compaction, and a read may touch several files. Partitioning is built in; transactions largely are not.',
    sets: { writeAmp: 1, readAmp: 2 },
    scale: 'The ring does it for you — add nodes and the partitions move. You pay instead in compaction load and in giving up cross-partition transactions.',
  },
  {
    id: 'mem', label: 'In-memory store',
    info: 'Redis, Memcached. No disk on the read path at all, so the ceilings that matter become CPU per operation and RAM. Durability is optional and costs you the fsync you were avoiding — treat it as a cache unless you have thought hard about it.',
    sets: { writeAmp: 1, readAmp: 0 },
    scale: 'Add shards, each single-threaded — but first check the data still fits in RAM, which is usually the real limit.',
  },
]

function Picker({ options, value, onPick }: { options: Profile[]; value: string; onPick: (p: Profile) => void }) {
  return (
    <div className="picker">
      {options.map((o) => (
        <button
          key={o.id}
          className={'pick' + (o.id === value ? ' on' : '')}
          onClick={() => onPick(o)}
          title={o.info}
        >
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

const INIT: Record<string, number> = {}
;[...WORKLOAD, ...HW].forEach((i) => (INIT[i.id] = i.val))

export default function Calculator() {
  const [v, setV] = useState<Record<string, number>>(INIT)
  const [showHw, setShowHw] = useState(false)
  const [proto, setProto] = useState('ws')
  const [engine, setEngine] = useState('btree')
  const pick = (setId: (s: string) => void) => (p: Profile) => {
    setId(p.id)
    setV((s) => ({ ...s, ...p.sets }))
  }
  const eng = ENGINES.find((e) => e.id === engine)!
  const set = (id: string) => (n: number) => setV((s) => ({ ...s, [id]: n }))
  const atDefaults = Object.keys(INIT).every((k) => v[k] === INIT[k])

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
  const connections = (v.dau * v.online) / 100
  const connHosts = Math.ceil(connections / v.connsPerHost)
  const bytesPerObj = v.payload * 1024
  const storagePerDay = writesPerDay * bytesPerObj
  const storageTotal = storagePerDay * 30 * v.retention
  const egressGbps = (readSide * (bytesPerObj + v.overhead) * 8) / 1e9

  // ---------- ceilings, derived from the constants ----------
  /** one fsync makes a group of commits durable */
  const writeCeiling = v.group / (v.fsync / 1e6)
  /** NVMe serves ioDepth random reads concurrently */
  const diskReadCeiling = v.ioDepth / (v.randRead / 1e6)
  /** one core, one op at a time */
  const cacheCeiling = 1 / (v.cacheOp / 1e6)
  const diskWriteBytes = peakWrites * bytesPerObj * v.writeAmp
  const webInstances = Math.max(1, Math.ceil((peakQps * (v.lat / 1000)) / v.slots))
  const originHosts = Math.max(1, Math.ceil(egressGbps / v.nic))
  const cacheNodes = Math.max(1, Math.ceil(readSide / cacheCeiling))
  const readUtil = v.readAmp === 0 ? 0 : (readSide * v.readAmp) / diskReadCeiling
  const writeUtil = peakWrites / writeCeiling

  const derived: { k: string; v: string; how: string }[] = [
    { k: 'Requests', v: `${fmt.compact(avgQps)}/s avg · ${fmt.compact(peakQps)}/s peak`, how: `${fmt.compact(v.dau)} × ${v.actions} ÷ 86,400 × ${fmt.n1(v.peak)}` },
    { k: 'Split at peak', v: `${fmt.compact(peakReads)}/s reads · ${fmt.compact(peakWrites)}/s writes`, how: `peak × ${v.readPct}% / ${100 - v.readPct}%` },
    { k: 'Delivery side', v: `${fmt.compact(readSide)}/s`, how: `${fmt.compact(peakReads)} reads + ${fmt.compact(peakWrites)} writes × ${v.fanout} fan-out` },
    { k: 'Live connections', v: v.online > 0 ? `${fmt.compact(connections)} · ~${fmt.int(connHosts)} host${connHosts === 1 ? '' : 's'}` : 'none', how: v.online > 0 ? `${fmt.compact(v.dau)} × ${v.online}% ÷ ${fmt.compact(v.connsPerHost)} per host` : 'request/response only' },
    { k: 'New data', v: `${fmt.bytes(storagePerDay)}/day`, how: `${fmt.compact(writesPerDay)} writes/day × ${fmt.bytes(bytesPerObj)}` },
    { k: 'Stored at retention', v: fmt.bytes(storageTotal), how: `${fmt.bytes(storagePerDay)}/day × 30 × ${v.retention} mo, before replication` },
    { k: 'Disk write rate', v: `${fmt.bytes(diskWriteBytes)}/s`, how: `${fmt.compact(peakWrites)} writes/s × ${fmt.bytes(bytesPerObj)} × ${v.writeAmp} amplification` },
    { k: 'Peak egress', v: `${fmt.n1(egressGbps)} Gbps`, how: `${fmt.compact(readSide)}/s × (${fmt.bytes(bytesPerObj)} + ${v.overhead} B protocol) × 8 bits` },
    { k: 'Request workers', v: `~${fmt.int(webInstances)}`, how: `Little’s Law: ${fmt.compact(peakQps)}/s × ${v.lat} ms ÷ ${v.slots} slots${v.online > 0 ? ' — separate from the connection tier above' : ''}` },
  ]

  const ceilings: { k: string; v: string; how: string }[] = [
    { k: 'Durable writes, one primary', v: `${fmt.compact(writeCeiling)}/s`, how: `${v.group} commits per fsync ÷ ${v.fsync} µs` },
    { k: 'Random reads, one node', v: `${fmt.compact(diskReadCeiling)}/s`, how: `${v.ioDepth} concurrent ÷ ${v.randRead} µs` },
    { k: 'Cache ops, one core', v: `${fmt.compact(cacheCeiling)}/s`, how: `1 ÷ ${v.cacheOp} µs per op` },
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
      need: originHosts > 1,
      what: 'A CDN, or more origin hosts',
      number: `${fmt.n1(egressGbps)} Gbps ÷ ${v.nic} Gbps per host = ${originHosts} host${originHosts === 1 ? '' : 's'} of pure bandwidth`,
      because: 'serving these bytes from your own origin costs hosts and egress; a CDN moves the copy next to the user and the bill off your origin',
      to: [{ label: 'S3 / object storage', href: '/components/s3' }],
    },
    {
      need: readUtil > 0.3,
      what: 'A cache in front of the database',
      number: `${fmt.compact(readSide)}/s of read+delivery work is ${fmt.n1(readUtil * 100)}% of one node’s ${fmt.compact(diskReadCeiling)}/s random-read ceiling`,
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
      need: writeUtil > 1,
      what: 'Shard the write path',
      number: `${fmt.compact(peakWrites)} writes/s vs a ${fmt.compact(writeCeiling)}/s ceiling (${fmt.n1(writeUtil * 100)}% of one primary)`,
      because: `replicas do not help: every replica replays every write. Past one primary the only move left is to split the data. ${eng.scale}`,
      to: [
        { label: 'Idea: consistent hashing', href: '/read/partitioning' },
        { label: 'Postgres deep-dive', href: '/components/postgres' },
      ],
    },
    {
      need: writeUtil > 0.5 && v.peak >= 2,
      what: 'A log in front of the writes',
      number: `peaks reach ${fmt.n1(writeUtil * 100)}% of the write ceiling, ×${fmt.n1(v.peak)} above average`,
      because: 'a durable log absorbs the spike at sequential-write speed and lets the database consume at its own pace, instead of sizing the database for the worst minute of the day',
      to: [{ label: 'Kafka deep-dive', href: '/components/kafka' }],
    },
  ]
  const needed = recs.filter((r) => r.need)
  const notYet = recs.filter((r) => !r.need)

  const g = v.growth / 100
  const monthsToWall =
    peakWrites >= writeCeiling ? 0 : g > 0 ? Math.log(writeCeiling / Math.max(1, peakWrites)) / Math.log(1 + g) : Infinity

  return (
    <section>
      <p className="h-kicker">Capacity planning</p>
      <h1 className="title">What does this system actually need?</h1>
      <p className="lede">
        Describe the workload, and the arithmetic gives you the request rate, the storage, the
        bandwidth — and <b>which components the numbers force you to add</b>. Every ceiling here is
        computed from the <b>hardware constants below</b>, which you can see and change; none of them
        are remembered rules of thumb.
      </p>

      <details className="calc-help">
        <summary>
          <span className="chev">▸</span> How to use this, and how it works
        </summary>
        <div className="calc-help-b">
          <h4>Using it</h4>
          <ol>
            <li>
              <b>Describe the workload</b> on the left — how many people, how often each one acts,
              how much bigger the busiest moment is, and how large one object is. Every input snaps
              to a round step (10k, 20k, 50k…) because at this level of modelling the{' '}
              <em>scale</em> is the answer; “16k users” implies a precision nobody has.
            </li>
            <li>
              <b>Read “so the system is.”</b> Each row shows its arithmetic beside the result, so you
              can check the number rather than trust it.
            </li>
            <li>
              <b>Read “what the numbers force.”</b> A component appears only when a computed ceiling
              is crossed, and it tells you which number crossed it. Anything not needed yet is listed
              underneath with the figure to watch, so “we don’t need that yet” stays a real answer.
            </li>
            <li>
              <b>Open “the hardware underneath”</b> and change a constant to see how sensitive the
              conclusion is. If a recommendation flips when you nudge an assumption, that
              recommendation was never solid.
            </li>
          </ol>

          <h4>How the ceilings are computed</h4>
          <p>Nothing here is a remembered rule of thumb. Each ceiling is one division:</p>
          <ul className="calc-formulas">
            <li><code>durable writes/s = commits per fsync ÷ fsync latency</code> — a commit is not durable until the write reaches disk, and one fsync can cover a batch of commits.</li>
            <li><code>random reads/s = concurrent reads ÷ random read latency</code> — an SSD serves many reads at once, so the queue depth multiplies throughput.</li>
            <li><code>cache ops/s = 1 ÷ per-op CPU cost</code> — a cache shard runs one command at a time on one core.</li>
            <li><code>egress = reads/s × object size × 8</code> — bytes to bits, compared against one host’s NIC.</li>
            <li><code>app instances = peak rate × latency ÷ concurrency</code> — Little’s Law: concurrency is arrival rate times service time.</li>
          </ul>

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
            <p className="sb-title">The shape of the system</p>
            <div className="ctl">
              <div className="ctl-top">
                <span className="ctl-label">
                  How clients connect
                  <Info text={PROTOCOLS.find((x) => x.id === proto)!.info} />
                </span>
              </div>
              <Picker options={PROTOCOLS} value={proto} onPick={pick(setProto)} />
              <div className="ctl-hint">{PROTOCOLS.find((x) => x.id === proto)!.info.split('.')[0]}.</div>
            </div>
            <div className="ctl">
              <div className="ctl-top">
                <span className="ctl-label">
                  Where writes land
                  <Info text={eng.info} />
                </span>
              </div>
              <Picker options={ENGINES} value={engine} onPick={pick(setEngine)} />
              <div className="ctl-hint">{eng.info.split('.')[0]}.</div>
            </div>

            <div className="sb-head">
              <p className="sb-title" style={{ margin: 0 }}>The workload</p>
              <button
                className="reset-btn"
                onClick={() => {
                  setV(INIT)
                  setProto('ws')
                  setEngine('btree')
                }}
                disabled={atDefaults}
                title={atDefaults ? 'Already at defaults' : 'Restore every input and constant to its default'}
              >
                Reset all
              </button>
            </div>
            {WORKLOAD.map((inp) => (
              <div className="ctl" key={inp.id}>
                <div className="ctl-top">
                  <span className="ctl-label">
                    {inp.label}
                    <Info text={inp.info} />
                  </span>
                  <span className="ctl-val">{inp.fmt(v[inp.id])}</span>
                </div>
                <Slider inp={inp} value={v[inp.id]} set={set(inp.id)} />
                <div className="ctl-hint">{inp.hint}</div>
              </div>
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
                  <span className="src-a">assumed</span>. Change any of them and every ceiling above
                  moves.
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
                <div className="u">at {v.growth}%/mo</div>
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
            (MIT). The honest gap: the write ceiling swings by ~8× depending on group commit, which
            is the one assumption most worth replacing with a measurement from your own database.
          </p>
        </div>
      </details>

      <div className="note">
        <b>Where these numbers come from.</b> The hardware constants are measured, not folklore —{' '}
        <a href="https://github.com/sirupsen/napkin-math" target="_blank" rel="noreferrer">
          sirupsen/napkin-math
        </a>{' '}
        (MIT), last measured March 2026 on a 24-core Xeon with local SSD. The rest is arithmetic:
        Little’s Law sizes the app tier, and every ceiling divides a constant by the work one
        operation costs. What is <em>not</em> measured are the modelling choices marked{' '}
        <span className="src-a">assumed</span> — group commit size, write amplification, cache op
        cost. Those depend on your rows, indexes and access pattern, so treat the output as an
        order-of-magnitude starting point and then measure your own system. A calculator is for
        knowing which wall you are walking towards, not for sizing a purchase order.
      </div>
    </section>
  )
}
