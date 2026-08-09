import { Link } from 'react-router-dom'
import SiteNav from '../../components/SiteNav'
import SiteFooter from '../../components/SiteFooter'
import IdeaStrip from '../../components/IdeaStrip'
import TracePlayer from '../../components/TracePlayer'
import MetricRunbook from '../../components/MetricRunbook'
import ClusterZoom from './ClusterZoom'
import { Sandbox } from '../ModulePanel'
import HardwareEnvelope from './HardwareEnvelope'
import { produceTrace, consumeTrace } from './traces'
import { computeScaleOut, scaleOutInputs } from './scaleout'
import { METRICS, cascadeTrace } from './ops'

const CHAPTERS = [
  { id: 'abstraction', n: 1, title: 'The core abstraction' },
  { id: 'anatomy', n: 2, title: 'Anatomy of a broker' },
  { id: 'hardware', n: 3, title: 'The hardware envelope' },
  { id: 'scale-up', n: 4, title: 'Scaling up' },
  { id: 'scale-out', n: 5, title: 'Scaling out' },
  { id: 'ops', n: 6, title: 'Operations: the pager view' },
  { id: 'bigcluster', n: 7, title: 'What a large cluster looks like' },
  { id: 'boundaries', n: 8, title: 'Boundaries & failures' },
  { id: 'sources', n: 9, title: 'Primary sources' },
]

const LIMITS: [string, string, string][] = [
  ['Throughput / partition', '~10 MB/s (order of magnitude)', 'One partition = one leader append path on one broker. Spread load by adding partitions.'],
  ['Consumers / group', '≤ partition count', 'The hard cap on parallelism. Extra consumers idle.'],
  ['Partitions / cluster', 'hundreds of thousands+ (KRaft)', 'The KRaft metadata quorum lifted the old ZooKeeper-era ceiling; each partition still costs file handles, memory, and rebalance time.'],
  ['Ordering', 'Per-partition only', 'Global ordering requires a single partition — which caps you at one consumer. Order by key instead.'],
  ['Rebalancing', 'Seconds of pause', 'Consumer churn reshuffles partition ownership. Cooperative/static membership softens it.'],
  ['Replication', '×RF disk & network', 'acks=all waits on the ISR; RF=3 triples storage and doubles-plus inter-broker traffic.'],
  ['fsync', 'Off by default', 'Durability comes from replication, not flush. Single-DC power loss across all replicas is the (accepted) residual risk.'],
]

const FAILS: [string, string][] = [
  ['Under-partitioned topic', 'You picked 6 partitions, now need 60 consumers. Raising partitions rehashes keys and breaks per-key ordering — a painful migration. Over-provision partitions early.'],
  ['Consumer lag blowup', 'Consumers slower than producers means lag grows without bound; breach retention and unread data is deleted. Alert on lag, not CPU.'],
  ['Page-cache pollution', 'A backfilling consumer pages in cold segments, evicting the hot tail — suddenly tail consumers hit disk too. Isolate backfills; consider follower fetching or tiered storage.'],
  ['Rebalance storms', 'Flaky consumers repeatedly join/leave, pausing the whole group each time. Tune session timeouts; use static membership.'],
  ['Hot partition from skewed keys', 'One whale key dominates a partition while others idle. Compound keys or route hot keys separately.'],
  ['ISR shrink under load', 'A slow follower falls out of the ISR; with acks=all and min.insync.replicas=2, one more failure stops writes entirely. Watch under-replicated partitions.'],
  ['Unclean leader election', 'Electing an out-of-sync replica after failures loses committed data. It is off by default — leave it off unless availability truly beats durability.'],
  ['Poison-pill message', "One un-processable message blocks its partition's offset from advancing. Dead-letter topic + skip-with-log."],
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

export default function KafkaPage() {
  return (
    <div className="dd-page fl-page">
      <SiteNav />
      <main className="wrap fl-wrap">
        <aside className="fl-toc">
          <div className="fl-toc-title">Kafka</div>
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
          <p className="h-kicker">Deep-dive · distributed log</p>
          <h1 className="title">Apache Kafka</h1>
          <p className="lede">
            Kafka is what happens when you take one idea — <b>a replicated, append-only log on the
            filesystem</b> — and refuse to compromise on it. Every famous Kafka property
            (throughput, replay, consumer groups, exactly-once) and every famous Kafka limitation
            (partition counts, rebalances, ordering scope) falls out of that single design bet.
            This page walks the system the way you&apos;d want it explained: <b>what one broker
            actually does</b>, what hardware it consumes, and only then how it scales.
          </p>

          <IdeaStrip
            ideas={[
              { slug: 'partitioning', label: 'Consistent Hashing' },
              { slug: 'replication-leader', label: 'Leader & Followers' },
              { slug: 'replication-quorum', label: 'Leaderless & Quorums' },
            ]}
          />

          <Ch id="abstraction" n={1} title="The core abstraction: the log">
            <p>
              A Kafka <b>topic</b> is a named log, split into <b>partitions</b>. A partition is the
              real unit of everything: an ordered, immutable sequence of records where the only
              write is <em>append</em> and a reader&apos;s only state is an <b>offset</b> — a
              number marking how far it has read. Records aren&apos;t deleted when consumed; they
              age out by retention policy (time, size, or compaction by key).
            </p>
            <p>
              This inversion — <b>the broker doesn&apos;t track consumers; consumers track
              themselves</b> — is what makes the rest cheap. A queue, pub/sub fan-out, replay from
              history, stream processing state, and change-data-capture are all just <em>different
              offsets held by different readers over the same bytes</em>. On disk a partition is a
              directory of <b>segment files</b> (the newest is the &ldquo;active&rdquo; segment
              taking appends) plus sparse index files — which means deleting old data is
              &ldquo;unlink a file,&rdquo; not &ldquo;compact a B-tree.&rdquo;
            </p>
            <div className="note">
              <b>Why an append-only log?</b> Sequential disk I/O runs at hundreds of MB/s on
              anything — even spinning disks — while random I/O is orders of magnitude slower.
              Restricting the storage engine to appends and sequential scans lets Kafka ride the
              fastest path every storage device has, and lean on the OS page cache instead of
              managing its own buffer pool. Jay Kreps&apos; essay <em>The Log</em> (chapter 7) is
              the canonical statement of this idea.
            </div>
          </Ch>

          <Ch id="anatomy" n={2} title="Anatomy of a single broker">
            <p>
              A broker is a surprisingly thin orchestration layer over the operating system:
              network threads shuttle bytes, I/O threads append to files, and the OS page cache
              does almost all the caching and buffering. Press play and follow one produce request
              with <code>acks=all</code> through the machinery:
            </p>
            <TracePlayer spec={produceTrace} />
            <p>
              The read path is even more radical — on the happy path the broker never copies your
              data into its own memory at all:
            </p>
            <TracePlayer spec={consumeTrace} />
            <h3>The background cast</h3>
            <p>
              Around these two paths run the maintenance loops: <b>log cleaner</b> threads perform
              key-based compaction; the <b>retention</b> task deletes whole aged-out segments;{' '}
              <b>replica fetchers</b> keep this broker&apos;s follower partitions in sync with
              their leaders elsewhere; and the <b>controller</b> — since Kafka 4.0 a{' '}
              <b>KRaft quorum</b> (Raft-replicated metadata log, no more ZooKeeper) — assigns
              partition leadership and propagates cluster metadata. Note the symmetry: cluster
              metadata itself is stored as <em>a replicated log</em>. It&apos;s logs all the way
              down.
            </p>
          </Ch>

          <Ch id="hardware" n={3} title="The hardware envelope">
            <p>
              Kafka&apos;s resource profile is unusual: brokers <b>move bytes rather than compute</b>,
              so CPU is rarely the wall (compression and TLS are the exceptions). Confluent&apos;s
              production baseline is telling: <b>24 cores, 64 GB RAM — but only ~6 GB of JVM
              heap</b>, with everything else deliberately left to the OS page cache; <b>12×1 TB
              disks in RAID 10</b> (or JBOD data dirs) on XFS/ext4, valued for sequential
              throughput rather than IOPS; and ordinary 1–10 GbE networking. Dedicated KRaft
              controllers are tiny (4 cores / 4 GB / 64 GB SSD) — they replicate metadata, not
              data.
            </p>
            <p>
              The reason the <b>network</b> is usually the first wall is replication arithmetic:
              one MB/s of producer traffic becomes RF MB/s of cluster disk-write and{' '}
              <code>(RF−1) + consumers</code> MB/s of egress. Pick a broker shape and push the
              workload until a meter goes red:
            </p>
            <HardwareEnvelope />
            <p className="fl-src-note">
              Baseline figures from Confluent&apos;s{' '}
              <a href="https://docs.confluent.io/platform/current/kafka/deployment.html" target="_blank" rel="noreferrer">
                production deployment guide
              </a>
              .
            </p>
          </Ch>

          <Ch id="scale-up" n={4} title="Scaling up — what a bigger box buys">
            <p>
              Vertical scaling maps cleanly onto the anatomy. A <b>faster NIC</b> (10→25→100 GbE)
              raises the usual binding resource linearly. <b>More disks</b> striped or as JBOD add
              sequential throughput and retention capacity. <b>More RAM</b> widens the page-cache
              window — how many minutes of tail data stay in memory for consumers and replication
              to read for free. <b>More cores</b> only matter when compression, TLS, or very high
              partition counts push CPU.
            </p>
            <p>
              The diminishing returns are also structural: a single partition&apos;s writes still
              funnel through one leader&apos;s append path no matter the hardware, so per-partition
              throughput has a per-core-ish ceiling; and one giant broker is a bigger blast radius
              — when it dies, re-replicating terabytes takes hours and hammers the survivors.
              Kafka&apos;s sweet spot is <em>moderately</em> beefy brokers, many of them.
            </p>
          </Ch>

          <Ch id="scale-out" n={5} title="Scaling out — partitions, brokers, and the quorum">
            <p>
              Horizontal scale has three independent axes. <b>Partitions</b> spread a topic&apos;s
              load and cap consumer parallelism — the knob you must size <em>up front</em>, because
              raising it later rehashes keys and breaks per-key ordering. <b>Brokers</b> add NICs,
              disks, and page cache; partitions (and leadership) rebalance across them.{' '}
              <b>Consumer groups</b> scale processing up to the partition count, coordinated
              through rebalance protocols. The sandbox below is the classic partition-math
              exercise — now you know <em>why</em> each ceiling exists:
            </p>
            <Sandbox content={{ inputs: scaleOutInputs, compute: computeScaleOut }} />
            <div className="boundary">
              <h3>The scaling ladder — apply in order</h3>
              <ol className="ladder">
                <li><b>Choose partition count for peak parallelism + headroom</b> at topic creation — the decision you can&apos;t cheaply undo.</li>
                <li><b>Scale consumers</b> up to the partition count for linear processing power.</li>
                <li><b>Add brokers</b> to grow aggregate NIC, disk, and page cache; rebalance partitions onto them.</li>
                <li><b>Key thoughtfully</b> so ordering holds where needed and load spreads where not.</li>
                <li><b>Watch consumer lag, not CPU</b> — lag is the true signal you&apos;ve hit a wall.</li>
              </ol>
            </div>
          </Ch>

          <Ch id="ops" n={6} title="Operations: the pager view">
            <p>
              Everything above assumed things go right. They don&apos;t. In production you live by a
              handful of metrics, and the skill is reading a spike backwards to its cause — because
              the number that pages you is usually several hops from what actually broke. Start with
              the cascade, then the runbook.
            </p>
            <TracePlayer spec={cascadeTrace} />
            <h3>The metrics that matter — a runbook</h3>
            <p>
              Tap any metric for the full card: what healthy looks like, what a spike means, what
              breaks next, the likely causes ranked common-to-rare, and what you actually do —
              safest action first.
            </p>
            <MetricRunbook cards={METRICS} />
            <div className="note">
              <b>The operating mindset.</b> Don&apos;t ask &ldquo;will this scale?&rdquo; — ask
              &ldquo;when this breaks, how will I know, and what will I do?&rdquo; Alert on the
              leading indicators (disk %, handler idle, ISR flaps), not just the trailing symptom
              (p99). And never react to a single metric in isolation: the cascade is the truth.
            </div>
          </Ch>

          <Ch id="bigcluster" n={7} title="What a large cluster actually looks like">
            <p>
              At the top end, Kafka runs at a scale that&apos;s hard to picture. LinkedIn — where
              Kafka was born — publishes its numbers, and they reframe what &ldquo;a Kafka
              deployment&rdquo; even means:
            </p>
            <div className="bigfacts">
              <div className="bigfact"><div className="bf-v">7T</div><div className="bf-k">messages / day</div><div className="bf-s">across the whole ecosystem</div></div>
              <div className="bigfact"><div className="bf-v">100+</div><div className="bf-k">clusters</div><div className="bf-s">not one giant cluster</div></div>
              <div className="bigfact"><div className="bf-v">4,000+</div><div className="bf-k">brokers</div><div className="bf-s">~40 per cluster on average</div></div>
              <div className="bigfact"><div className="bf-v">100k+</div><div className="bf-k">topics</div><div className="bf-s">multi-tenant</div></div>
              <div className="bigfact"><div className="bf-v">7M</div><div className="bf-k">partitions</div><div className="bf-s">~1,750 per broker</div></div>
            </div>
            <p>
              The most important thing that table tells you: <b>nobody runs one enormous cluster.</b>{' '}
              100+ clusters averaging ~40 brokers each is deliberate — a fault-domain hierarchy built
              for failure. Zoom through it, from regions down into a single broker (and fail a zone at
              the rack-awareness step to see why the layout is shaped the way it is):
            </p>
            <ClusterZoom />
            <h3>The techniques that don&apos;t show up in the picture</h3>
            <ul className="clean">
              <li><b>Tiered storage (KIP-405).</b> Offload cold log segments to object storage (S3/GCS) so brokers keep only the hot tail on local disk — the disk-capacity wall from Chapter 3 stops being the constraint.</li>
              <li><b>Target ~80% of sustained max.</b> Leave headroom so a broker loss or a recovering replica (which writes fast) doesn&apos;t tip a survivor over its own limit.</li>
              <li><b>KRaft over ZooKeeper.</b> The metadata quorum (Chapter 2) replaced ZooKeeper precisely to lift the per-cluster partition ceiling that used to force even more fragmentation.</li>
            </ul>
            <p className="fl-src-note">
              Figures:{' '}
              <a href="https://blog.bytebytego.com/p/how-linkedin-customizes-its-7-trillion" target="_blank" rel="noreferrer">LinkedIn&apos;s 7-trillion-message ecosystem</a>{' '}and{' '}
              <a href="https://aws.amazon.com/blogs/big-data/best-practices-for-right-sizing-your-apache-kafka-clusters-to-optimize-performance-and-cost/" target="_blank" rel="noreferrer">AWS right-sizing guidance</a>.
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
                <a href="https://notes.stephenholiday.com/Kafka.pdf" target="_blank" rel="noreferrer">
                  Kreps, Narkhede &amp; Rao — “Kafka: a Distributed Messaging System for Log Processing” (NetDB ’11)
                </a>
                <p>The original LinkedIn paper. Short and readable — §3 is the storage/efficiency design (sequential I/O, page cache, sendfile) you just watched in the traces.</p>
              </div>
              <div className="src">
                <div className="s-k">The essay</div>
                <a href="https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying" target="_blank" rel="noreferrer">
                  Jay Kreps — “The Log: What every software engineer should know…” (2013)
                </a>
                <p>The philosophical companion: why the log is the unifying abstraction for replication, messaging, and stream processing. Arguably the best systems essay of its decade.</p>
              </div>
              <div className="src">
                <div className="s-k">The design docs</div>
                <a href="https://kafka.apache.org/documentation/#design" target="_blank" rel="noreferrer">
                  Apache Kafka documentation — §4 “Design”
                </a>
                <p>Unusually good official docs: persistence, efficiency, the ISR model and its comparison to quorum replication (§4.7 is the underrated gem).</p>
              </div>
              <div className="src">
                <div className="s-k">The metadata revolution</div>
                <a href="https://cwiki.apache.org/confluence/display/KAFKA/KIP-500%3A+Replace+ZooKeeper+with+a+Self-Managed+Metadata+Quorum" target="_blank" rel="noreferrer">
                  KIP-500 — Replace ZooKeeper with a self-managed metadata quorum (KRaft)
                </a>
                <p>Why external coordination had to go, and how a Raft-replicated metadata log lifted the partition-count ceiling. Read alongside the Raft paper when we build the etcd/consensus deep-dive.</p>
              </div>
              <div className="src">
                <div className="s-k">The clever bit</div>
                <a href="https://www.confluent.io/blog/apache-kafka-purgatory-hierarchical-timing-wheels/" target="_blank" rel="noreferrer">
                  “Apache Kafka, Purgatory, and Hierarchical Timing Wheels” (Confluent)
                </a>
                <p>How hundreds of thousands of parked requests (acks=all produces, long-poll fetches) are managed in O(1) — the data structure behind steps 6 and 2 of the traces.</p>
              </div>
            </div>
          </Ch>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
