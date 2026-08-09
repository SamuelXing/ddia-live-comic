import { Link } from 'react-router-dom'
import SiteNav from '../../components/SiteNav'
import SiteFooter from '../../components/SiteFooter'
import TracePlayer from '../../components/TracePlayer'
import MetricRunbook from '../../components/MetricRunbook'
import { Sandbox } from '../ModulePanel'
import HardwareEnvelope from './HardwareEnvelope'
import { eventLoopTrace, persistTrace, clusterTrace } from './traces'
import { computeScaleOut, scaleOutInputs } from './scaleout'
import { METRICS, cascadeTrace } from './ops'

const CHAPTERS = [
  { id: 'abstraction', n: 1, title: 'The core abstraction' },
  { id: 'anatomy', n: 2, title: 'Anatomy of an instance' },
  { id: 'hardware', n: 3, title: 'The hardware envelope' },
  { id: 'scale-up', n: 4, title: 'Scaling up' },
  { id: 'scale-out', n: 5, title: 'Scaling out' },
  { id: 'ops', n: 6, title: 'Operations: the pager view' },
  { id: 'bigfleet', n: 7, title: 'What a large fleet looks like' },
  { id: 'boundaries', n: 8, title: 'Boundaries & failures' },
  { id: 'sources', n: 9, title: 'Primary sources' },
]

const LIMITS: [string, string, string][] = [
  ['Command execution', '1 thread', 'The defining constraint: a 64-core box gives one Redis exactly one core of command throughput. I/O threads move bytes, never commands.'],
  ['Throughput', '~100–150k ops/s/instance', 'Order of magnitude for simple commands; pipelining multiplies it, O(N) commands and megabyte values divide it.'],
  ['Memory', '= RAM − headroom', 'Dataset + ~75 B/key metadata + fragmentation must fit under maxmemory — and leave copy-on-write room for the fork.'],
  ['Durability', 'everysec ≈ 1 s window', 'AOF everysec plus async replication: acked writes can vanish on crash or failover. A dial, not a guarantee.'],
  ['Cluster', '16,384 slots · ~1,000 nodes', 'Fixed sharding granularity; multi-key commands must share a slot (hash tags); no cross-slot transactions.'],
  ['Hot key', 'unsplittable', "One key = one slot = one core. Sharding spreads keys, not popularity — the viral key is a data-model problem."],
  ['Big key', 'blocks everyone', 'O(N) commands run on the one thread; even DEL of a huge collection stalls the instance (use UNLINK).'],
]

const FAILS: [string, string][] = [
  ['The whale key', 'A collection grows unbounded for months, then one SMEMBERS freezes the instance for seconds and triggers the Chapter 6 cascade. Bound every collection in the data model; audit with redis-cli --bigkeys.'],
  ['KEYS * in production', 'A debug habit that scans the entire keyspace on the one thread. At 200M keys it is a multi-second outage per keystroke. SCAN exists precisely so this command never ships.'],
  ['Eviction as silent data loss', 'A store configured like a cache: memory fills, allkeys-lru quietly deletes real data — sessions vanish, queues drop jobs. Stores get noeviction and a capacity plan, or they aren’t stores.'],
  ['The fork OOM', 'maxmemory set to 90% of the box; a write-heavy BGSAVE copy-on-writes the rest; the OOM killer shoots the master mid-snapshot. Size RAM for dataset AND fork headroom — Chapter 3 charges both.'],
  ['Full-resync storm', 'The master restarts; every replica requests a full sync at once — each one a fork plus a complete dataset transfer on top of live traffic. Stagger replicas, size repl-backlog to cover blips.'],
  ['Cache stampede', 'A hot key expires; ten thousand concurrent misses hit the database behind, which was sized assuming the cache. Jittered TTLs, request coalescing, or logical expiry — pick at design time.'],
  ['The encoding cliff', 'A "small" hash crosses a listpack threshold and silently becomes a real hashtable at 5–10× the memory. Instagram’s famous optimization is this cliff, walked in reverse — know your thresholds (Chapter 9).'],
  ['Split brain by busy loop', 'A blocked loop misses gossip PINGs; the cluster fails over a healthy master; unreplicated writes are lost twice a week. Fix the whales, and set cluster-node-timeout with the slowlog in mind.'],
]

function Ch({ id, n, title, children }: { id: string; n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="chapter" id={id}>
      <div className="ch-head">
        <span className="ch-num">{n}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  )
}

export default function RedisPage() {
  return (
    <div className="dd-page fl-page">
      <SiteNav />
      <main className="wrap fl-wrap">
        <aside className="fl-toc">
          <div className="fl-toc-title">Redis</div>
          {CHAPTERS.map((c) => (
            <a key={c.id} href={'#' + c.id}>
              <span>{c.n}</span> {c.title}
            </a>
          ))}
          <Link className="fl-toc-back" to="/components">
            ← All components
          </Link>
        </aside>

        <div className="fl-body">
          <p className="h-kicker">Deep-dive · in-memory data structures</p>
          <h1 className="title">Redis</h1>
          <p className="lede">
            Redis is what you get when you <b>delete the durability constraint and spend all the
            winnings on latency</b>. Two bets define it: everything lives in <b>RAM</b> (disk is
            never on the request path), and one <b>single thread</b> executes every command (no
            locks, atomicity for free). Every famous Redis property — microsecond responses, rich
            data structures, effortless atomic counters — and every famous Redis incident — the
            blocked event loop, the fork spike, the hot key, the evicted "store" — falls out of
            those two bets. This page walks the system the way you&apos;d want it explained:
            <b> what the one thread actually does</b>, what hardware it consumes, and only then
            how it scales.
          </p>

          <Ch id="abstraction" n={1} title="The core abstraction: data structures on one thread">
            <p>
              Redis is not a key-value store; it is a <b>data-structure server</b>. The values
              behind keys are live structures — lists, sets, sorted sets, hashes, streams,
              bitmaps — with commands that operate on them <em>in place</em>:{' '}
              <code>ZINCRBY</code> a score, <code>LPUSH</code> a queue, <code>SETBIT</code> a
              bloom filter. The insight is that a huge class of application logic (leaderboards,
              rate limiters, session state, queues, counters) is really a small data-structure
              operation — and if the structure lives in RAM on a single thread, that operation is
              a few microseconds and <b>atomic by construction</b>.
            </p>
            <p>
              The two bets are load-bearing. <b>RAM-only</b> means no buffer pool, no WAL on the
              request path, no page cache games — and it means capacity is measured in memory
              prices and durability is a side-car (Chapter 2&apos;s second trace).{' '}
              <b>Single-threaded</b> means zero lock overhead and perfect sequential consistency
              per instance — and it means one core is the whole engine, and anything slow on that
              core stops the world (Chapter 6&apos;s cascade). Postgres pays latency for
              guarantees; Kafka pays structure for throughput; Redis pays <em>risk</em> for speed.
            </p>
            <div className="note">
              <b>The lineage.</b> Kafka bet everything on the append-only log; Postgres on
              WAL + MVCC; Redis bets on the oldest systems trick of all —{' '}
              <em>keep it in memory and don&apos;t share it between threads</em>. All three pages
              are really about what each bet costs, and where the bill arrives.
            </div>
          </Ch>

          <Ch id="anatomy" n={2} title="Anatomy of a single instance">
            <p>
              A Redis instance is one process whose heart is an event loop over every client
              socket. Press play and follow one command through it — and watch where the other
              ten thousand clients are while yours runs:
            </p>
            <TracePlayer spec={eventLoopTrace} />
            <p>
              Nothing in that trace touched a disk. Durability happens <em>beside</em> the request
              path, not on it — through one elegant, dangerous kernel trick used by every
              persistence feature Redis has:
            </p>
            <TracePlayer spec={persistTrace} />
            <h3>The background cast</h3>
            <p>
              Around the loop run the maintenance cycles, all sharing the same thread budget: the{' '}
              <b>active expire cycle</b> samples keys with TTLs and deletes the dead;{' '}
              <b>incremental rehashing</b> migrates dict buckets a step at a time;{' '}
              <b>active defragmentation</b> (optional) compacts jemalloc arenas; <b>I/O threads</b>{' '}
              shuttle bytes; and forked children write snapshots. Every one of them is designed
              around the same rule the commands obey: <em>never hold the one thread for long</em> —
              and every Chapter 6 metric is some version of that rule being broken.
            </p>
          </Ch>

          <Ch id="hardware" n={3} title="The hardware envelope">
            <p>
              Redis&apos;s envelope is the simplest of the three flagships and the most brutal:{' '}
              <b>one CPU core and a stick of RAM</b>. Core count barely matters — clock speed
              does. Disk exists only for the persistence side-car. The two numbers that define an
              instance are how many microseconds of the one core each operation costs, and whether
              the dataset — <em>plus per-key overhead, plus fragmentation, plus copy-on-write
              headroom for the fork</em> — fits in memory. Pick a shape and push:
            </p>
            <HardwareEnvelope />
            <p className="fl-src-note">
              Per-op costs and the fork rule of thumb are order-of-magnitude, from Redis&apos;s own{' '}
              <a href="https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/latency/" target="_blank" rel="noreferrer">
                latency documentation
              </a>{' '}
              and benchmarks; values move with command mix and value size.
            </p>
          </Ch>

          <Ch id="scale-up" n={4} title="Scaling up — the box that barely helps">
            <p>
              Vertical scaling is where Redis inverts every intuition the Postgres chapter built.{' '}
              <b>More cores do almost nothing</b> — command execution stays on one thread, so a
              64-core monster runs your workload exactly as fast as a 4-core box with the same
              clock. (I/O threads absorb socket work at high connection counts; that&apos;s the
              whole cores story.) <b>Faster cores help linearly</b> — single-thread performance is
              the one CPU number that matters. <b>More RAM</b> holds more data — genuinely useful,
              and the reason big boxes exist here at all.
            </p>
            <p>
              But RAM has a structural catch: <b>operations get worse as the instance grows</b>.
              Fork stalls scale with resident memory (~15 ms/GB — a 100 GB instance freezes for
              seconds per snapshot); replica full syncs transfer the whole dataset; restarts
              re-load it; the blast radius of one OOM grows with everything. Redis practice is
              therefore the opposite of Postgres&apos;s &ldquo;one strong primary&rdquo;:{' '}
              <b>many small instances</b> (commonly ~10–25 GB each), sharded early — because
              here, scaling up doesn&apos;t just stop helping, it starts <em>hurting</em>.
            </p>
          </Ch>

          <Ch id="scale-out" n={5} title="Scaling out — shards, and the key that won't shard">
            <p>
              Scaling out is two moves: <b>replicas</b> for reads and failover (async, stale by
              design), and <b>Cluster</b> for memory and write throughput — the keyspace split
              across 16,384 hash slots, walked in detail in Chapter 7. The math is clean: shards
              needed = max(memory ÷ per-node RAM, ops ÷ per-core ceiling). The catch is the
              slider below that sharding cannot touch: <b>popularity</b>. CRC16 spreads keys
              evenly; it does nothing about one key being read a million times a second.
            </p>
            <Sandbox content={{ inputs: scaleOutInputs, compute: computeScaleOut }} />
            <div className="boundary">
              <h3>The scaling ladder — apply in order</h3>
              <ol className="ladder">
                <li><b>Pipeline and batch</b> — 10 commands per round-trip cuts per-op overhead ~5×. Free capacity, no new hardware.</li>
                <li><b>Right-size the data model</b> — bound collections, respect encoding thresholds, TTL everything temporary. Most &ldquo;capacity problems&rdquo; are model problems.</li>
                <li><b>Add replicas</b> for read offload and failover; accept stale reads consciously.</li>
                <li><b>Shard with Cluster</b> when memory or the one core is truly exhausted — 16,384 slots across many small primaries.</li>
                <li><b>Kill hot keys</b> — client-side caching (RESP3 invalidation), key splitting, replica reads. The failure sharding can&apos;t fix.</li>
                <li><b>Split by use-case</b> — separate clusters for cache vs store vs queues, so policies and failures never mix.</li>
              </ol>
            </div>
          </Ch>

          <Ch id="ops" n={6} title="Operations: the pager view">
            <p>
              Redis incidents have a signature shape: <b>fast and total</b>. Nothing degrades
              gracefully on a single thread — the instance is fine, then it is entirely stopped,
              then the cluster is making it worse. The canonical cascade starts with a data-model
              decision made months earlier. Play it, then keep the runbook:
            </p>
            <TracePlayer spec={cascadeTrace} />
            <h3>The metrics that matter — a runbook</h3>
            <p>
              Tap any metric for the full card: what healthy looks like, what a spike means, what
              breaks next, likely causes ranked common-to-rare, and what you actually do — safest
              action first.
            </p>
            <MetricRunbook cards={METRICS} />
            <div className="note">
              <b>The operating mindset.</b> Watch the <em>one core</em>, not the host CPU; treat
              every O(N) command as an availability decision; and remember the slowlog is the only
              alarm that rings <em>before</em> the storm. Most Redis pages trace back to a data
              model that outgrew its design — the fix usually isn&apos;t in redis.conf.
            </div>
          </Ch>

          <Ch id="bigfleet" n={7} title="What a large Redis fleet actually looks like">
            <p>
              At scale, Redis disappears into the plumbing: it fronts nearly every large system
              (Twitter&apos;s and Instagram&apos;s caching layers are the canonical publics), and
              the fleet shape is always the same — <b>many small instances, organized into
              per-use-case clusters</b>. The published numbers that define the shape:
            </p>
            <div className="bigfacts">
              <div className="bigfact"><div className="bf-v">16,384</div><div className="bf-k">hash slots</div><div className="bf-s">the fixed sharding granularity</div></div>
              <div className="bigfact"><div className="bf-v">~1,000</div><div className="bf-k">nodes per cluster</div><div className="bf-s">the documented practical ceiling</div></div>
              <div className="bigfact"><div className="bf-v">300M → 5 GB</div><div className="bf-k">key-value pairs</div><div className="bf-s">Instagram&apos;s encoding-aware packing</div></div>
              <div className="bigfact"><div className="bf-v">~100 µs</div><div className="bf-k">command latency</div><div className="bf-s">the budget every choice protects</div></div>
            </div>
            <p>
              The Instagram number deserves its own sentence: by packing 300 million key-value
              pairs into buckets of ~1,000 as <b>hash-encoded listpacks</b> — riding the encoding
              cliff <em>deliberately, from the cheap side</em> — they cut memory ~4× versus plain
              keys. At Redis scale, understanding the anatomy <em>is</em> the capacity plan. Below,
              the cluster machinery those fleets run on, walked end to end:
            </p>
            <TracePlayer spec={clusterTrace} />
            <p className="fl-src-note">
              Figures:{' '}
              <a href="https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/" target="_blank" rel="noreferrer">Redis Cluster specification</a>{' '}and{' '}
              <a href="https://instagram-engineering.com/storing-hundreds-of-millions-of-simple-key-value-pairs-in-redis-1091ae80f74c" target="_blank" rel="noreferrer">Instagram engineering</a>.
            </p>
          </Ch>

          <Ch id="boundaries" n={8} title="Boundaries & failure modes">
            <table className="tbl">
              <thead>
                <tr><th>Limit</th><th>Rough value</th><th>Why it matters</th></tr>
              </thead>
              <tbody>
                {LIMITS.map((r) => (
                  <tr key={r[0]}>
                    <td>{r[0]}</td>
                    <td><code>{r[1]}</code></td>
                    <td>{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="fails">
              {FAILS.map((f) => (
                <div className="fail" key={f[0]}>
                  <div className="fn">{f[0]}</div>
                  <p className="fd">{f[1]}</p>
                </div>
              ))}
            </div>
          </Ch>

          <Ch id="sources" n={9} title="Primary sources — read the real thing">
            <div className="srcs">
              <div className="src">
                <div className="s-k">The paper</div>
                <a href="https://www.usenix.org/conference/osdi20/presentation/yang-juncheng" target="_blank" rel="noreferrer">
                  Yang, Yue &amp; Rashmi — “A large scale analysis of hundreds of in-memory cache clusters at Twitter” (OSDI ’20)
                </a>
                <p>What production caching actually is, measured across Twitter&apos;s fleet: write-heavy clusters are common, objects are tiny, TTLs dominate eviction policy. The empirical companion to every intuition on this page.</p>
              </div>
              <div className="src">
                <div className="s-k">The classic</div>
                <a href="http://oldblog.antirez.com/post/redis-persistence-demystified.html" target="_blank" rel="noreferrer">
                  Salvatore Sanfilippo — “Redis persistence demystified” (2012)
                </a>
                <p>The fork/COW/AOF story of Chapter 2&apos;s second trace, told by the author. Old, and still the clearest statement of what Redis durability is and is not.</p>
              </div>
              <div className="src">
                <div className="s-k">The docs</div>
                <a href="https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/" target="_blank" rel="noreferrer">
                  Redis Cluster specification
                </a>
                <p>Slots, gossip, epochs, MOVED/ASK, the failover election — Chapter 7 with full precision. One of the better distributed-systems specs you&apos;ll read, and refreshingly honest about its trade-offs.</p>
              </div>
              <div className="src">
                <div className="s-k">The war story</div>
                <a href="https://instagram-engineering.com/storing-hundreds-of-millions-of-simple-key-value-pairs-in-redis-1091ae80f74c" target="_blank" rel="noreferrer">
                  Instagram — “Storing hundreds of millions of simple key-value pairs in Redis” (2011)
                </a>
                <p>300M keys, 4× memory saved by understanding encodings — the engineering mindset this page tries to teach, applied for real. Read with the memory-optimization chapter of the Redis docs beside it.</p>
              </div>
              <div className="src">
                <div className="s-k">The ops bible</div>
                <a href="https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/latency/" target="_blank" rel="noreferrer">
                  Redis documentation — “Diagnosing latency issues”
                </a>
                <p>Every Chapter 6 cause with its measurement command: intrinsic latency, fork stalls, transparent huge pages, AOF fsync contention, expire cycles. The runbook behind the runbook.</p>
              </div>
            </div>
          </Ch>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
