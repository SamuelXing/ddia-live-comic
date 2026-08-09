import { Link } from 'react-router-dom'
import SiteNav from '../../components/SiteNav'
import SiteFooter from '../../components/SiteFooter'
import IdeaStrip from '../../components/IdeaStrip'
import TracePlayer from '../../components/TracePlayer'
import MetricRunbook from '../../components/MetricRunbook'
import { Sandbox } from '../ModulePanel'
import HardwareEnvelope from './HardwareEnvelope'
import { queryTrace, mvccTrace, fleetTrace } from './traces'
import { computeScaleOut, scaleOutInputs } from './scaleout'
import { METRICS, cascadeTrace } from './ops'

const CHAPTERS = [
  { id: 'abstraction', n: 1, title: 'The core abstraction' },
  { id: 'anatomy', n: 2, title: 'Anatomy of the primary' },
  { id: 'hardware', n: 3, title: 'The hardware envelope' },
  { id: 'scale-up', n: 4, title: 'Scaling up' },
  { id: 'scale-out', n: 5, title: 'Scaling out' },
  { id: 'ops', n: 6, title: 'Operations: the pager view' },
  { id: 'bigfleet', n: 7, title: 'What a large fleet looks like' },
  { id: 'boundaries', n: 8, title: 'Boundaries & failures' },
  { id: 'sources', n: 9, title: 'Primary sources' },
]

const LIMITS: [string, string, string][] = [
  ['Writable primaries', '1', 'No native multi-master. Every write funnels through one box — the deepest wall in the stack. The ladder postpones it; only sharding escapes it.'],
  ['Connections', '1 OS process each', 'Default max_connections = 100; a few hundred active backends saturate a big box. PgBouncer is standard equipment, not an optimization.'],
  ['Commit latency', '1 WAL fsync (~0.1–1 ms)', 'The floor under every write. Synchronous replication adds a network RTT on top of it.'],
  ['UPDATE cost', 'new version + index entries', 'MVCC write amplification: an update is an insert plus deferred cleanup, and touches every index unless HOT applies.'],
  ['Transaction IDs', '32-bit, circular', 'Vacuum must freeze old tuples or the database refuses writes — wraparound is the hardest failure on this page.'],
  ['Physical replicas', 'byte-identical, read-only', 'Streaming replication copies the whole cluster, same major version, no partial subscriptions. Logical replication is the selective escape hatch.'],
  ['Working set', 'must ~fit in RAM', 'shared_buffers + OS cache. When the hot set spills, every miss is a random read — a cliff, not a slope.'],
]

const FAILS: [string, string][] = [
  ['Connection storm', 'A deploy restarts the whole app fleet; every pod reconnects at once and the primary drowns in fork() and auth before serving a single query. Pool at the infrastructure level and cap total connections.'],
  ['The forgotten transaction', 'One idle-in-transaction backend pins the xmin horizon: vacuum silently frees nothing, bloat compounds, p99 creeps for days. Set idle_in_transaction_session_timeout — this class of incident is fully preventable.'],
  ['Replication slot left behind', 'A decommissioned replica or dead CDC pipeline leaves a slot; the primary faithfully retains WAL for a reader that will never come until the disk fills and it PANICs. Set max_slot_wal_keep_size.'],
  ['XID wraparound shutdown', 'Autovacuum starved for months on one huge table; the age counter crosses the line and Postgres stops accepting writes mid-business-day, then needs hours of vacuum to reopen. Alert on age(datfrozenxid) — it gives weeks of warning.'],
  ['The 3am plan flip', 'Stats drift past a threshold and the planner flips a hot query from index scan to seq scan. The query that ran in 2 ms all year now takes 40 s and saturates I/O for everyone. ANALYZE is the one-command fix — if you think to look at the plan.'],
  ['Read-your-writes surprise', 'A user posts a comment, the next page load reads a lagging replica, the comment is gone. Session stickiness or LSN-tracking (“wait until replica reaches my write”) — it must be designed, not patched.'],
  ['Checkpoint storm', 'A bulk load fills max_wal_size early, forcing back-to-back checkpoints; full-page writes multiply WAL, which forces more checkpoints. Write latency sawtooths. Raise max_wal_size and spread the flush.'],
  ['The sharding cliff', 'Sharding is deferred until the primary is on fire, then executed under duress — schema changes frozen, joins broken in production. Notion picked its shard key years of growth ahead of the wall. That is the lesson.'],
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

export default function PostgresPage() {
  return (
    <div className="dd-page fl-page">
      <SiteNav />
      <main className="wrap fl-wrap">
        <aside className="fl-toc">
          <div className="fl-toc-title">PostgreSQL</div>
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
          <p className="h-kicker">Deep-dive · relational database</p>
          <h1 className="title">PostgreSQL</h1>
          <p className="lede">
            Postgres is built on two ideas that explain everything else about it. <b>Every change
            is written to a log before it is real</b> — the WAL — so durability, crash recovery,
            replication, and point-in-time restore are all the same operation: <em>replay the
            log</em>. And <b>no reader ever sees a half-truth</b> — MVCC — achieved not with locks
            but by keeping multiple versions of every row, which is where vacuum, bloat, and the
            wraparound doomsday counter come from. This page walks the system the way you&apos;d
            want it explained: <b>what one backend actually does with your UPDATE</b>, what
            hardware it consumes, and only then how it scales.
          </p>

          <IdeaStrip
            ideas={[
              { slug: 'replication-leader', label: 'Leader & Followers' },
              { slug: 'replication-lag', label: 'Replication Lag' },
            ]}
          />

          <Ch id="abstraction" n={1} title="The core abstraction: the transaction">
            <p>
              Postgres&apos;s product is not storage — it&apos;s a <b>guarantee</b>: a transaction
              either happened entirely or not at all, and once committed it survives anything.
              That guarantee is manufactured by two machines running in tandem. The{' '}
              <b>write-ahead log</b> makes changes durable the instant a description of them is
              fsync&apos;d — long before the actual data pages reach disk. And{' '}
              <b>multi-version concurrency control</b> gives every transaction a private,
              frozen-in-time snapshot: writers create new row versions instead of overwriting, so
              readers never wait on writers and writers never wait on readers.
            </p>
            <p>
              Both machines have famous consequences. Because the log is the truth, a replica is
              just a process replaying it, and a backup is just the log archived — one mechanism,
              many features. Because versions accumulate, someone must collect the superseded
              ones — <b>vacuum</b> — and a whole family of production incidents is really
              &ldquo;the collector fell behind.&rdquo; The third structural fact is smaller but
              shapes everything operational: <b>one connection = one OS process</b>, which makes
              connections expensive and puts a pooler in front of nearly every serious deployment.
            </p>
            <div className="note">
              <b>Sound familiar?</b> The WAL is the same append-only-log idea Kafka bet its entire
              design on — pointed inward at 8 KB pages instead of outward at messages. Chapter 7
              of the Kafka deep-dive argues the log is <em>the</em> unifying abstraction of
              distributed systems; Postgres is the strongest single-node evidence for it.
            </div>
          </Ch>

          <Ch id="anatomy" n={2} title="Anatomy of the primary">
            <p>
              A running Postgres is a family of processes around shared memory: one backend per
              connection doing query work, plus the background cast — checkpointer, WAL writer,
              autovacuum workers, walsenders. Press play and follow one <code>UPDATE</code> from
              SQL text to the fsync that makes it real:
            </p>
            <TracePlayer spec={queryTrace} />
            <p>
              The trace above hides the strangest part: what an UPDATE leaves <em>behind</em>.
              Postgres never overwrites a live row — which means the table quietly fills with
              superseded versions, and a background collector decides their fate. This lifecycle
              is the single most operationally important thing to understand about Postgres:
            </p>
            <TracePlayer spec={mvccTrace} />
            <h3>The background cast</h3>
            <p>
              Around the query path run the maintenance loops: the <b>checkpointer</b> flushes
              dirty pages on a timer so crash recovery stays bounded; the <b>background writer</b>{' '}
              trickles pages out so backends rarely wait on eviction; the <b>WAL writer</b> drains
              the WAL buffers between commits; <b>autovacuum workers</b> collect dead versions and
              freeze old ones; <b>walsenders</b> stream the log to replicas; and the{' '}
              <b>stats collector</b> feeds the planner the numbers its next gamble depends on.
              Every one of these has a failure mode that appears by name in Chapter 6.
            </p>
          </Ch>

          <Ch id="hardware" n={3} title="The hardware envelope">
            <p>
              Postgres&apos;s resource profile inverts Kafka&apos;s. Kafka moves bytes and barely
              computes; Postgres <b>computes on every row</b> — parsing, planning, index descent,
              visibility checks — so CPU matters. But the two numbers that actually define a
              primary&apos;s envelope are quieter: <b>does the working set fit in RAM</b>, and{' '}
              <b>how fast can one disk fsync the WAL</b>. RAM misses turn reads into random I/O
              (a cliff, not a slope), and WAL-flush latency is the floor under every commit.
              Pick a shape and push the workload until a meter goes red:
            </p>
            <HardwareEnvelope />
            <p className="fl-src-note">
              Rules of thumb: <code>shared_buffers</code> ≈ 25% of RAM with the OS cache doing the
              rest (PostgreSQL wiki,{' '}
              <a href="https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server" target="_blank" rel="noreferrer">
                Tuning Your PostgreSQL Server
              </a>
              ); per-query CPU costs are order-of-magnitude for tuned OLTP.
            </p>
          </Ch>

          <Ch id="scale-up" n={4} title="Scaling up — what a bigger box buys">
            <p>
              Vertical scaling maps cleanly onto the anatomy. <b>More RAM</b> is the headline
              purchase: it widens the working-set window, and its returns are step-shaped — going
              from &ldquo;hot set spills&rdquo; to &ldquo;hot set fits&rdquo; can be worth 10×,
              while RAM beyond the working set buys almost nothing. <b>Faster NVMe</b> lowers the
              WAL-fsync floor under every commit and absorbs the random reads of cache misses.{' '}
              <b>More cores</b> raise concurrent query throughput and feed parallel scans —
              though a single query&apos;s latency barely moves, and past ~32 cores contention on
              shared structures (lock manager, WAL insertion) eats into the gains.
            </p>
            <p>
              The diminishing returns are structural, and worth naming: every commit still
              serializes through <b>one WAL stream</b> on one disk; vacuum debt grows with write
              rate no matter the hardware; and one giant primary is one giant blast radius —
              failover, re-replication, and restores all scale with its size. Postgres rewards a{' '}
              <em>strong</em> primary, but past a point the money buys risk, not headroom. That
              point is where Chapter 5 begins.
            </p>
          </Ch>

          <Ch id="scale-out" n={5} title="Scaling out — the read/write asymmetry">
            <p>
              Horizontal Postgres is a story of one asymmetry: <b>reads scale out, writes do
              not</b>. Replicas replay the WAL and serve reads near-linearly — but every replica
              replays <em>every write</em>, so replicas add zero write capacity. Meanwhile the
              scaled-out app tier multiplies connections against a database that spends a process
              on each. The sandbox below is the whole game: push the sliders and watch which wall
              you hit first:
            </p>
            <Sandbox content={{ inputs: scaleOutInputs, compute: computeScaleOut }} />
            <div className="boundary">
              <h3>The scaling ladder — apply in order</h3>
              <ol className="ladder">
                <li><b>Pool connections</b> (PgBouncer, transaction mode) — collapse the app fleet&apos;s thousands onto a few dozen backends. Cheapest, do it first.</li>
                <li><b>Cache in front</b> (Redis, app-level) so repeat reads never reach the database at all — the highest-leverage move in the stack.</li>
                <li><b>Add read replicas</b> and route reads to them; make the app lag-literate (read-your-writes to the primary).</li>
                <li><b>Scale the primary up</b> — RAM to fit the working set, NVMe for the WAL floor. Simple, effective, bounded.</li>
                <li><b>Partition</b> big tables (by time or tenant) so indexes, scans, and vacuum each touch less; detach old ranges instead of DELETE-ing them.</li>
                <li><b>Shard</b> across independent clusters only when one primary&apos;s writes are truly exhausted — it costs cross-shard transactions and joins, forever.</li>
              </ol>
            </div>
          </Ch>

          <Ch id="ops" n={6} title="Operations: the pager view">
            <p>
              Everything above assumed things go right. In production, the defining Postgres
              incidents are <b>slow-motion</b> — debt that compounds for days before the first
              alert. The cascade below is the canonical one, and the reason experienced operators
              page on causes, not symptoms. Play it, then keep the runbook:
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
              <b>The operating mindset.</b> Postgres rarely fails suddenly; it fails on a{' '}
              <em>schedule you can read</em> — vacuum debt, XID age, WAL retention, working-set
              growth are all visible weeks ahead. Page on the leading indicators (oldest
              transaction, slot retention, freeze age), set the two timeouts that make whole
              incident classes impossible, and treat p99 as the question, never the answer.
            </div>
          </Ch>

          <Ch id="bigfleet" n={7} title="What a large Postgres fleet actually looks like">
            <p>
              The surprise at the top end is how far <b>one primary</b> goes. Notion ran the
              entire product on a single Postgres instance for five years; Instagram, Basecamp,
              and Stack Overflow&apos;s class of workload all lived on &ldquo;one strong box plus
              replicas&rdquo; far past the point folklore says is possible. When Notion finally
              sharded, the shape of the solution became the industry&apos;s reference:
            </p>
            <div className="bigfacts">
              <div className="bigfact"><div className="bf-v">5 yrs</div><div className="bf-k">on one instance</div><div className="bf-s">before sharding was forced</div></div>
              <div className="bigfact"><div className="bf-v">480</div><div className="bf-k">logical shards</div><div className="bf-s">schemas, keyed by team_id</div></div>
              <div className="bigfact"><div className="bf-v">32 → 96</div><div className="bf-k">physical hosts</div><div className="bf-s">2021 shard-out, tripled in 2023</div></div>
              <div className="bigfact"><div className="bf-v">15 → 5</div><div className="bf-k">schemas per host</div><div className="bf-s">re-sharding = moving schemas</div></div>
            </div>
            <p>
              The key design move: <b>far more logical shards than machines</b>. Splitting data
              into 480 schemas across 32 hosts meant &ldquo;scaling out&rdquo; later was{' '}
              <em>moving schemas between machines</em>, not re-splitting data — the painful
              decision was made once. Below, the topology those articles describe, walked end to
              end — and note how much of it is just the WAL from Chapter 2, pointed at different
              consumers:
            </p>
            <TracePlayer spec={fleetTrace} />
            <p className="fl-src-note">
              Figures:{' '}
              <a href="https://www.notion.so/blog/sharding-postgres-at-notion" target="_blank" rel="noreferrer">Notion — Herding elephants: sharding Postgres</a>{' '}and{' '}
              <a href="https://www.notion.so/blog/the-great-re-shard" target="_blank" rel="noreferrer">The Great Re-shard</a>.
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
                <a href="https://dsf.berkeley.edu/papers/ERL-M85-95.pdf" target="_blank" rel="noreferrer">
                  Stonebraker &amp; Rowe — “The Design of POSTGRES” (Berkeley, 1986)
                </a>
                <p>The original design document. The no-overwrite storage manager it proposes — old versions kept, a “vacuum cleaner” process to sweep them — is MVCC and vacuum, forty years early. Read §5 and recognize Chapter 2.</p>
              </div>
              <div className="src">
                <div className="s-k">The book</div>
                <a href="https://www.interdb.jp/pg/" target="_blank" rel="noreferrer">
                  Hironobu Suzuki — “The Internals of PostgreSQL”
                </a>
                <p>Free, current, and the best systems-internals text on any database. Chapters 5–9 (concurrency control, vacuum, buffer manager, WAL) are this page&apos;s Chapter 2 with the diagrams at full resolution.</p>
              </div>
              <div className="src">
                <div className="s-k">The docs</div>
                <a href="https://www.postgresql.org/docs/current/mvcc.html" target="_blank" rel="noreferrer">
                  PostgreSQL manual — Chapter 13, “Concurrency Control”
                </a>
                <p>Snapshot semantics, isolation levels, and locking, stated precisely by the people who wrote it. Pair with the “Routine Vacuuming” section — the most operationally important pages in the manual.</p>
              </div>
              <div className="src">
                <div className="s-k">The war story</div>
                <a href="https://www.notion.so/blog/sharding-postgres-at-notion" target="_blank" rel="noreferrer">
                  Notion — “Herding elephants: lessons learned from sharding Postgres”
                </a>
                <p>The modern reference for escaping the single-primary wall deliberately: choosing team_id, 480 logical shards, double-writes, and the audited cutover. The sequel, “The Great Re-shard,” shows why logical-over-physical pays off.</p>
              </div>
              <div className="src">
                <div className="s-k">The adversarial read</div>
                <a href="https://www.uber.com/blog/postgres-to-mysql-migration/" target="_blank" rel="noreferrer">
                  Uber — “Why Uber Engineering Switched from Postgres to MySQL” (2016)
                </a>
                <p>The sharpest public critique of the architecture you just learned: MVCC write amplification, per-version index entries, replication byte-coupling. Read it with the community rebuttals and you&apos;ll understand both systems better than either post alone.</p>
              </div>
            </div>
          </Ch>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
