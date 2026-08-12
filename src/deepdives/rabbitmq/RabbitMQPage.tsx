import { Link } from 'react-router-dom'
import SiteNav from '../../components/SiteNav'
import SiteFooter from '../../components/SiteFooter'
import TracePlayer from '../../components/TracePlayer'
import MetricRunbook from '../../components/MetricRunbook'
import { Sandbox } from '../ModulePanel'
import HardwareEnvelope from './HardwareEnvelope'
import { publishTrace, beamTrace, estateTrace } from './traces'
import { computeScaleOut, scaleOutInputs } from './scaleout'
import { METRICS, cascadeTrace } from './ops'

const CHAPTERS = [
  { id: 'abstraction', n: 1, title: 'The core abstraction' },
  { id: 'anatomy', n: 2, title: 'Anatomy of the broker' },
  { id: 'hardware', n: 3, title: 'The hardware envelope' },
  { id: 'scale-up', n: 4, title: 'Scaling up' },
  { id: 'scale-out', n: 5, title: 'Scaling out' },
  { id: 'ops', n: 6, title: 'Operations: the pager view' },
  { id: 'bigfleet', n: 7, title: 'What a real estate looks like' },
  { id: 'boundaries', n: 8, title: 'Boundaries & failures' },
  { id: 'sources', n: 9, title: 'Primary sources' },
]

const LIMITS: [string, string, string][] = [
  ['Throughput / queue', '~50k msg/s transient', 'One queue = one Erlang process = one core. Durability discounts it steeply: quorum queues land at a fraction of transient throughput.'],
  ['Scaling unit', 'more queues', 'Consumers on one queue share its single process; past the ceiling only sharding (consistent-hash exchange) adds capacity.'],
  ['Backlog', 'RAM until paged', 'Messages wait in process heaps with per-message bookkeeping; deep backlogs degrade the queue serving them, then threaten the node.'],
  ['Memory alarm', '40% of RAM', 'The watermark. Crossing it blocks every publishing connection cluster-wide — the single most important line in RabbitMQ operations.'],
  ['Durability', 'majority fsync', 'Quorum queues confirm after a Raft majority persists the message — real guarantees, priced per message in latency and disk.'],
  ['Message lifetime', 'deleted on ack', 'A message is a task, not a record: consumed once, then gone. No replay, no second reader — streams exist for that.'],
  ['Connections & channels', 'stateful, costly', 'Multi-round-trip handshakes and broker-side processes each. Long-lived connections are mandatory; churn is a denial of service you run against yourself.'],
]

const FAILS: [string, string][] = [
  ['The slow-consumer freeze', 'A consumer deploy hangs; depth grows; the watermark trips; every publisher in the company blocks — the full Chapter 6 cascade. Alert on depth trend + consumer utilisation, and bulkhead every queue.'],
  ['The single fat queue', 'All traffic through one queue caps the system at one core, while sixteen consumers idle and the postmortem blames "RabbitMQ performance." Shard before the ceiling, not after.'],
  ['Poison requeue loop', 'A malformed message fails, requeues, and returns forever — one core burning on a task that cannot succeed, real work queueing behind it. A retry cap + dead-letter exchange is table stakes on every queue.'],
  ['The prefetch hoarder', 'One consumer with unlimited prefetch grabs the entire backlog; its peers starve; its memory balloons; when it dies, everything redelivers at once. Set prefetch everywhere — unlimited is never correct.'],
  ['Memory-alarm gridlock', 'Team A’s backlog freezes team B’s publishers — who retry harder, holding connections open, keeping pressure on. Per-vhost limits and max-length turn a company-wide freeze back into one team’s bad day.'],
  ['Connection-per-message churn', 'An integration opens a connection, publishes once, and closes — thousands of times a second. The node spends itself on handshakes; throughput collapses with every queue empty. Fix the client, not the broker.'],
  ['The partition surprise', 'A network blip splits the cluster; pause_minority (correctly) halts the minority side — and nobody knew which services were connected to it. Know your partition-handling mode before the partition does.'],
  ['The queue as a database', 'Using backlog as storage — "consumers will catch up eventually" — parks the system permanently next to the watermark. RabbitMQ is a conveyor; if data must rest, it belongs in a log (Kafka) or a store (Postgres).'],
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

export default function RabbitMQPage() {
  return (
    <div className="dd-page fl-page">
      <SiteNav />
      <main className="wrap fl-wrap">
        <aside className="fl-toc">
          <div className="fl-toc-title">RabbitMQ</div>
          {CHAPTERS.map((c) => (
            <a key={c.id} href={'#' + c.id}>
              <span>{c.n}</span> {c.title}
            </a>
          ))}
          <Link className="fl-toc-back" to="/ddia/components">
            ← All components
          </Link>
        </aside>

        <div className="fl-body">
          <p className="h-kicker">Deep-dive · message broker</p>
          <h1 className="title">RabbitMQ</h1>
          <p className="lede">
            RabbitMQ is the <b>opposite bet from Kafka</b>, made a decade earlier: put the
            intelligence in the <b>broker</b> — routing, delivery tracking, per-message
            acknowledgement, retries, dead-lettering — so that clients stay simple and messages
            behave like <em>tasks</em>, not log entries. Every strength (routing topologies,
            backpressure, work distribution) and every constraint (the one-core queue, the memory
            watermark, no replay) follows from that one choice. This page walks the system the way
            you&apos;d want it explained: <b>what the broker actually does with one message</b>,
            what hardware it consumes, and only then how it scales.
          </p>

          <Ch id="abstraction" n={1} title="The core abstraction: the smart broker">
            <p>
              The AMQP model is three objects and a contract. Producers publish to{' '}
              <b>exchanges</b> (named routers), exchanges match <b>bindings</b> (routing rules) to
              deliver into <b>queues</b>, and queues push to consumers who must{' '}
              <b>acknowledge</b> each message — at which point it is deleted. The broker owns the
              whole lifecycle: it knows every unacked delivery, redelivers on failure, expires,
              dead-letters, and prioritizes. A message is a <em>unit of work with a chain of
              custody</em>, and the broker is the custodian.
            </p>
            <p>
              Compare the Kafka page&apos;s opening move: Kafka made the broker <em>dumb</em> — an
              append-only log that tracks nothing per consumer — and pushed all delivery
              intelligence to clients, buying colossal throughput. RabbitMQ keeps the intelligence
              central and pays for it <b>per message</b>: routing computation, delivery state,
              ack bookkeeping. That price sets every ceiling in Chapter 3 — and buys semantics
              Kafka cannot express: route this message to <em>these</em> queues, retry it three
              times, then park it for a human.
            </p>
            <div className="note">
              <b>The lineage.</b> Kafka bet on the log; Postgres on WAL + MVCC; Redis on RAM +
              one thread. RabbitMQ&apos;s bet is the <em>actor model</em>: everything — every
              queue, channel, connection — is an isolated Erlang process passing messages. The
              broker for messages is itself built out of message passing, and its scaling law
              (Chapter 2&apos;s second trace) falls straight out of that.
            </div>
          </Ch>

          <Ch id="anatomy" n={2} title="Anatomy of the broker">
            <p>
              Press play and follow one message from <code>basic.publish</code> to the ack that
              deletes it — through the exchange, the binding trie, the queue process, and the
              prefetch window:
            </p>
            <TracePlayer spec={publishTrace} />
            <p>
              The trace above shows the happy path through <em>one</em> queue. The second trace is
              the system&apos;s strangest and most consequential truth: what a queue actually{' '}
              <em>is</em> — and what happens on the day consumers slow down:
            </p>
            <TracePlayer spec={beamTrace} />
            <h3>The background cast</h3>
            <p>
              Around the message path run the maintenance machinery: the <b>management/metrics
              database</b> aggregating stats from every process (its UI is the ops console of
              Chapter 6); <b>Raft ticks</b> keeping quorum queue members in step; the{' '}
              <b>message store</b> compacting segment files; per-process <b>Erlang GC</b>{' '}
              collecting each actor&apos;s heap independently; and <b>cluster heartbeats</b>{' '}
              watching for partitions. Every one of them reappears by name in the runbook.
            </p>
          </Ch>

          <Ch id="hardware" n={3} title="The hardware envelope">
            <p>
              RabbitMQ&apos;s envelope has a split personality. <b>Across</b> queues it scales
              like a normal multicore system — the BEAM spreads processes over every core.{' '}
              <b>Within</b> a queue it is Redis all over again: one process, one core, a hard
              ceiling. And hovering above both is a line no other system on this site has:{' '}
              <b>the watermark</b> — the memory level where the node stops <em>everyone&apos;s</em>{' '}
              publishers, cluster-wide. Pick a shape and push:
            </p>
            <HardwareEnvelope />
            <p className="fl-src-note">
              Ceilings are order-of-magnitude for small messages; the 40% watermark default and
              alarm behavior are from the{' '}
              <a href="https://www.rabbitmq.com/docs/memory" target="_blank" rel="noreferrer">
                memory documentation
              </a>
              .
            </p>
          </Ch>

          <Ch id="scale-up" n={4} title="Scaling up — cores help, with a catch">
            <p>
              Unlike Redis, a bigger box genuinely helps — <b>if your queue count cooperates</b>.
              More cores run more queue processes in parallel; a node with 16 cores and 200 queues
              uses them all. More RAM moves the watermark up, buying tolerance for bursts and
              bigger in-flight windows. Faster NVMe directly cuts confirm latency for durable and
              quorum traffic, since a majority fsync sits on the write path of every confirmed
              publish.
            </p>
            <p>
              The catches are structural. A <b>single hot queue</b> gets nothing from any of it —
              its ceiling is one process on one core, whatever the box. RAM spent tolerating
              deeper backlogs is spent <em>enabling the anti-pattern</em>: the system is designed
              for empty queues, and hardware that lets debt accumulate quietly just moves the
              cliff. And bigger nodes mean bigger blast radii — more queue leaders failing over at
              once, longer quorum re-syncs. The estate answer (Chapter 7) is the same as
              Kafka&apos;s and Redis&apos;s: <b>modest nodes, more of them, leaders spread</b>.
            </p>
          </Ch>

          <Ch id="scale-out" n={5} title="Scaling out — two ceilings, one backlog">
            <p>
              Every RabbitMQ capacity question reduces to two independent ceilings: the{' '}
              <b>queue&apos;s</b> (one core per queue — raise it by sharding into more queues) and
              the <b>fleet&apos;s</b> (consumers × per-message handler time — raise it with more
              consumers or faster handlers). Whichever binds first, the symptom is identical:{' '}
              <b>backlog</b>, and Chapter 2 showed where backlog leads. The sandbox puts both
              ceilings under your fingers:
            </p>
            <Sandbox content={{ inputs: scaleOutInputs, compute: computeScaleOut }} />
            <div className="boundary">
              <h3>The scaling ladder — apply in order</h3>
              <ol className="ladder">
                <li><b>Keep queues empty</b> — depth is debt. Bulkhead every queue with max-length + TTL so the debt is bounded by design.</li>
                <li><b>Tune prefetch and handlers</b> — prefetch ≈ rate × RTT, and a 5 ms handler beats ten new consumers. Cheapest capacity there is.</li>
                <li><b>Add consumers</b> up to the queue&apos;s own ceiling — the easy direction while it lasts.</li>
                <li><b>Shard into more queues</b> (consistent-hash exchange) — the real unit of broker scaling, across cores and nodes.</li>
                <li><b>Add nodes</b> and spread quorum leaders so every node carries its share.</li>
                <li><b>Split the estate</b> — per-team vhosts with limits, separate clusters per workload class, and streams or Kafka for the firehoses.</li>
              </ol>
            </div>
          </Ch>

          <Ch id="ops" n={6} title="Operations: the pager view">
            <p>
              The defining RabbitMQ incident is not a crash — the broker is famously hard to
              kill. It is a <b>freeze</b>: the broker protecting itself, exactly as documented,
              from a backlog somebody else created. The cascade below is the one every RabbitMQ
              operator eventually meets. Play it, then keep the runbook:
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
              <b>The operating mindset.</b> Queue depth is the master signal — everything else
              orbits it. Alert on the <em>leading</em> pair (depth trend, consumer utilisation),
              bulkhead so no single queue can reach the watermark, and when the freeze comes
              anyway, remember: the broker is almost never the broken thing. <em>Look at the
              consumers first.</em>
            </div>
          </Ch>

          <Ch id="bigfleet" n={7} title="What a real messaging estate looks like">
            <p>
              Production RabbitMQ rarely looks like one big cluster. It looks like an{' '}
              <b>estate</b>: several bounded clusters (three or five nodes each), per-team vhosts
              with limits, a dead-letter topology beside every work queue, async federation
              between data centers — and, in mature shops, an honest boundary where log-shaped
              traffic is handed to streams or Kafka. The numbers that define the shape:
            </p>
            <div className="bigfacts">
              <div className="bigfact"><div className="bf-v">1M+/s</div><div className="bf-k">messages per second</div><div className="bf-s">the classic 30-node benchmark (2013)</div></div>
              <div className="bigfact"><div className="bf-v">3 · 5</div><div className="bf-k">quorum replicas</div><div className="bf-s">majority fsync per confirm</div></div>
              <div className="bigfact"><div className="bf-v">40%</div><div className="bf-k">of RAM</div><div className="bf-s">the watermark where publishers freeze</div></div>
              <div className="bigfact"><div className="bf-v">2–5×</div><div className="bf-k">throughput cost</div><div className="bf-s">transient → fully durable quorum</div></div>
            </div>
            <p>
              Below, that estate walked end to end — connections, quorum writes, the dead-letter
              parking lot, bulkheads, federation, and the handoff. Note how many steps are the
              same lesson Kafka&apos;s and Redis&apos;s Chapter 7 taught:{' '}
              <em>many bounded clusters, loosely coupled, blast radius by design</em>:
            </p>
            <TracePlayer spec={estateTrace} />
            <p className="fl-src-note">
              Figures: the{' '}
              <a href="https://tanzu.vmware.com/content/blog/rabbitmq-hits-one-million-messages-per-second-on-google-compute-engine" target="_blank" rel="noreferrer">
                1M msg/s Google Compute Engine benchmark
              </a>{' '}
              (2013) and the{' '}
              <a href="https://www.rabbitmq.com/docs/quorum-queues" target="_blank" rel="noreferrer">quorum queues documentation</a>.
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
                <div className="s-k">The model</div>
                <a href="https://www.rabbitmq.com/tutorials/amqp-concepts" target="_blank" rel="noreferrer">
                  RabbitMQ documentation — “AMQP 0-9-1 Model Explained”
                </a>
                <p>Exchanges, bindings, queues, acks, prefetch — Chapter 1 and the publish trace, stated precisely. One of the best conceptual docs any messaging system has produced.</p>
              </div>
              <div className="src">
                <div className="s-k">The paper</div>
                <a href="https://raft.github.io/raft.pdf" target="_blank" rel="noreferrer">
                  Ongaro &amp; Ousterhout — “In Search of an Understandable Consensus Algorithm” (Raft, 2014)
                </a>
                <p>Quorum queues are Raft groups — this is their spec. Reading it now pays twice: it&apos;s also the foundation of the planned etcd deep-dive, and of Kafka&apos;s KRaft.</p>
              </div>
              <div className="src">
                <div className="s-k">The deep read</div>
                <a href="https://jack-vanlightly.com/blog/2018/6/29/quorum-queues-making-rabbitmq-more-competitive" target="_blank" rel="noreferrer">
                  Jack Vanlightly — the quorum queues &amp; RabbitMQ internals series
                </a>
                <p>The most rigorous public writing on RabbitMQ&apos;s replication, fsync behavior, and failure modes — by an engineer who later helped build it. Start anywhere; read all of it.</p>
              </div>
              <div className="src">
                <div className="s-k">The comparison</div>
                <a href="https://jack-vanlightly.com/blog/2017/12/4/rabbitmq-vs-kafka-part-1-messaging-topologies" target="_blank" rel="noreferrer">
                  Jack Vanlightly — “RabbitMQ vs Kafka” series
                </a>
                <p>The definitive treatment of the smart-broker vs dumb-broker trade this page opened with — topology by topology, guarantee by guarantee, with the failure cases most comparisons skip.</p>
              </div>
              <div className="src">
                <div className="s-k">The ops bible</div>
                <a href="https://www.rabbitmq.com/docs/alarms" target="_blank" rel="noreferrer">
                  RabbitMQ documentation — memory &amp; disk alarms
                </a>
                <p>The watermark, the blocking behavior, and paging — the Chapter 6 cascade in the vendor&apos;s own words. Short; every on-call engineer should have read it before the first freeze, not after.</p>
              </div>
            </div>
          </Ch>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
