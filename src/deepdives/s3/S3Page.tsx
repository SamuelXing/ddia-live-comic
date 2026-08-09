import { Link } from 'react-router-dom'
import SiteNav from '../../components/SiteNav'
import SiteFooter from '../../components/SiteFooter'
import IdeaStrip from '../../components/IdeaStrip'
import TracePlayer from '../../components/TracePlayer'
import MetricRunbook from '../../components/MetricRunbook'
import { Sandbox } from '../ModulePanel'
import HardwareEnvelope from './HardwareEnvelope'
import { getTrace, putTrace, fleetTrace } from './traces'
import { computeScaleOut, scaleOutInputs } from './scaleout'
import { METRICS, cascadeTrace } from './ops'
import '../../styles/deepdives.css'
import '../../styles/flagship.css'

const CHAPTERS = [
  { id: 'abstraction', n: 1, title: 'The core abstraction' },
  { id: 'anatomy', n: 2, title: 'Anatomy of a request' },
  { id: 'hardware', n: 3, title: 'The envelope' },
  { id: 'scale-up', n: 4, title: 'Scaling up' },
  { id: 'scale-out', n: 5, title: 'Scaling out' },
  { id: 'ops', n: 6, title: 'Operations: the pager view' },
  { id: 'bigfleet', n: 7, title: 'What a large workload looks like' },
  { id: 'boundaries', n: 8, title: 'Boundaries & failures' },
  { id: 'sources', n: 9, title: 'Primary sources' },
]

const LIMITS: [string, string, string][] = [
  ['Storage', 'Effectively unlimited', 'The one tier on this site where “how much” is never the question. There is nothing to provision, nothing to resize, and no capacity meter anywhere on this page.'],
  ['Requests per prefix', '~3,500 write · 5,500 read /s', 'The real scaling knob. It is per partitioned prefix, a bucket may have unlimited prefixes, and partitioning happens gradually in response to load — so a correct new design still throttles on its first day.'],
  ['First-byte latency', '~100–200 ms, small objects', 'Structural, not incidental: DNS, TLS, signature verification, policy evaluation, index lookup, fan-out read. You cannot tune below it, only avoid paying it — which is what a CDN is for.'],
  ['Object size', '5 TB max · 5 GB single PUT', 'Past 5 GB multipart is mandatory rather than advisable. And with a 10,000-part ceiling, a 5 TB object needs parts of at least ~512 MB — at the top end part size is a correctness constraint, not a tuning knob.'],
  ['Mutation', 'None — replace the whole object', 'No append, no in-place edit, no rename. Rename is copy-then-delete, which is not atomic, costs bytes, and takes time proportional to the data. Every filesystem-shaped assumption breaks precisely here.'],
  ['LIST', '1,000 keys per call', 'Enumerating ten million objects is ten thousand sequential, billed calls. Any hot path that lists is a design bug — keep your own index, which is largely what table formats like Iceberg are.'],
  ['Consistency', 'Strong read-after-write', 'Since December 2020. The old eventual-consistency footgun is gone, and code still carrying workarounds for it is now merely slower than it needs to be.'],
  ['Durability', '11 nines — none of it about DELETE', 'The famous figure describes redundancy against hardware failure. It says nothing about a wrong lifecycle rule, a widened bucket policy, or a confident DELETE. Versioning and MFA-delete cover that gap; the durability number never will.'],
  ['Cost shape', 'Requests & egress dominate', 'Storage is the cheap line. The invoice is a direct readout of your access pattern, which makes it the one capacity signal on this page worth alerting on.'],
]

const FAILS: [string, string][] = [
  ['The date-prefixed hot partition', 'Keys named <code>2026-08-08/…</code> sort beautifully and send every write today into a single partition while yesterday’s sits idle. The bucket has enormous unused capacity and none of it is reachable. Put a hash or a tenant id at the front of the key — the fix costs nothing and has to happen before the data exists.'],
  ['The retry storm that prevented its own fix', 'S3 answers a hot prefix with <code>503 SlowDown</code> and starts repartitioning. A client that retries immediately keeps the prefix saturated so the repartition cannot complete. Backing off makes the job finish sooner, which is genuinely hard to believe at 3am.'],
  ['The invisible multipart bill', 'Parts of abandoned uploads are stored and billed but do not appear in a LIST, so the bucket looks smaller than the invoice. It accumulates for years. One lifecycle rule — AbortIncompleteMultipartUpload — makes the entire failure class impossible.'],
  ['LIST as a database', 'Finding work by listing a prefix degrades linearly with the data and costs a request per thousand keys. It works perfectly in staging and slowly stops working in production. Write an index row when you write the object.'],
  ['Egress bill shock', 'Serving user traffic straight from the bucket bills per gigabyte leaving AWS, so cost grows with popularity while every technical dashboard stays green. A CDN cuts requests, egress, and latency at once — it is the highest-leverage move on this page.'],
  ['S3 as a hot key-value store', 'The latency floor is per request, so a workload of small reads pays it over and over. It is not slow because it is misconfigured; it is slow because it is an authenticated HTTP request to a web service. Small and hot belongs in Redis.'],
  ['The rename that was a copy', 'Job commit protocols that finish by renaming a directory assume an atomic, free rename. On an object store it is copy-then-delete: not atomic, priced in bytes, and slow in proportion to output. Hadoop shipped entirely new committers to escape it.'],
  ['The delete that eleven nines did not cover', 'A lifecycle rule with a slightly wrong prefix, or a policy change, and the data is gone exactly as designed. Durability is about hardware failure. Versioning, MFA-delete, and a separate-account backup are about you.'],
  ['The single-threaded transfer', 'A 100 Gb/s instance moving objects one at a time achieves a small fraction of one percent of its NIC. The ceiling was the SDK connection pool, at its default, the entire time — and no dashboard anywhere says so.'],
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

export default function S3Page() {
  return (
    <div className="dd-page fl-page">
      <SiteNav />
      <main className="wrap fl-wrap">
        <aside className="fl-toc">
          <div className="fl-toc-title">S3 / Object storage</div>
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
          <p className="h-kicker">Deep-dive · object storage</p>
          <h1 className="title">S3 / object storage</h1>
          <p className="lede">
            Object storage bought unlimited scale by <b>giving up everything a filesystem
            promises</b>. No directories, no appends, no in-place edits, no rename — an object is
            an immutable blob addressed by a string, and every operation is an authenticated HTTP
            request to a web service. Each thing it refuses is what lets it partition without ever
            coordinating, and each one is also why code written for a disk breaks here in a
            specific way. This page is about the three consequences that actually decide designs:{' '}
            <b>the key name is a shard key</b>, <b>the latency floor is per request</b>, and{' '}
            <b>the bill is a readout of your access pattern</b>.
          </p>

          <IdeaStrip
            ideas={[
              { slug: 'partitioning', label: 'Consistent Hashing' },
              { slug: 'storage', label: 'The Storage Engine' },
            ]}
          />

          <Ch id="abstraction" n={1} title="The core abstraction: a key, a blob, and no filesystem">
            <p>
              An object is <b>bytes plus metadata, addressed by a string, and immutable</b>. That is
              the entire data model, and every property of the service is downstream of it. Because
              an object cannot be modified, a write never has to coordinate with a previous writer —
              which means writes can be placed anywhere, in parallel, forever. Because a key is just
              a string, the namespace is <b>flat</b>: <code>a/b/c.jpg</code> contains no
              directories, only slashes, and the folders you see in the console are a display
              convention over a prefix scan.
            </p>
            <p>
              The second bet is where all the operational consequences hide. The index that maps
              keys to storage is <b>partitioned by key range</b>, and a partition serves a bounded
              request rate. So the documented “3,500 writes and 5,500 reads per second per prefix”
              is not a policy AWS chose to impose on you — <em>it is the shape of the index showing
              through the API</em>. That single sentence explains why key naming is the most
              consequential design decision on this page, why a date-prefixed key throttles a bucket
              with petabytes of spare capacity, and why the fix is free if you make it before the
              data exists.
            </p>
            <p>
              Third: durability is manufactured by <b>erasure coding across independent availability
              zones</b> plus a scrubbing loop that never stops. Eleven nines is a claim about how
              many simultaneous, independent hardware failures it would take to lose a fragment set.
              It is not a claim that your data is safe, and confusing the two is the most expensive
              misreading on this page.
            </p>
            <div className="note">
              <b>Sound familiar?</b> A key-range-partitioned index that splits partitions when they
              get hot is exactly the mechanism in the <Link to="/read/partitioning">Consistent
              Hashing</Link> comic — and the hot prefix is that comic&apos;s hot key wearing a
              filename. S3 is the largest existing proof that the idea works, and Chapter 6 is the
              proof that it still needs a good shard key from you.
            </div>
          </Ch>

          <Ch id="anatomy" n={2} title="Anatomy of a request">
            <p>
              Press play and follow one <code>GET</code>. The thing to watch for is how much
              happens before any disk is involved — because that, not the disk, is what the latency
              floor is made of:
            </p>
            <TracePlayer spec={getTrace} />
            <p>
              The write path is where the interesting ordering lives. Fragments become durable
              first and the key becomes visible last, and that sequence is the whole reason S3 can
              promise strong read-after-write consistency on a system this size:
            </p>
            <TracePlayer spec={putTrace} />
            <h3>The background cast</h3>
            <p>
              Running behind both paths are the loops that make the numbers true: the{' '}
              <b>scrubber</b>, continuously re-verifying checksums and rebuilding fragments from
              parity before anyone notices bit rot; the <b>repartitioner</b>, splitting index ranges
              that get hot — the mechanism at the centre of Chapter 6; <b>lifecycle jobs</b>, moving
              objects between storage classes on your rules; <b>replication</b>, copying
              asynchronously to another region with a lag you own; and the <b>placement</b>{' '}
              machinery deciding which drives, in which zones, get which fragments. You never
              operate any of them. You do get paged for two.
            </p>
          </Ch>

          <Ch id="hardware" n={3} title="The envelope — when you do not own the hardware">
            <p>
              Every other deep-dive on this site starts Chapter 3 by picking an instance shape. Here
              there is nothing to pick, and that is the interesting part: <b>the envelope of a
              managed service is a rate limit and a price list</b>. So the shape below is{' '}
              <em>your</em> client, and the ceilings are the service&apos;s published limits — plus
              two that nobody expects, which are your own SDK connection pool and the per-request
              charge. Push the sliders until a meter goes red:
            </p>
            <HardwareEnvelope />
            <p className="fl-src-note">
              Rate ceilings from{' '}
              <a href="https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html" target="_blank" rel="noreferrer">
                AWS — “Best practices design patterns: optimizing Amazon S3 performance”
              </a>
              , which also documents the ~100–200 ms small-object latency and single-instance
              transfer up to 100 Gb/s. Prices are us-east-1 S3 Standard list, used at
              order-of-magnitude only. The requests-in-flight row is Little&apos;s Law, the same one
              driving the <Link to="/components/web">web tier</Link>.
            </p>
          </Ch>

          <Ch id="scale-up" n={4} title="Scaling up — the unit of scale is the object">
            <p>
              There is no bigger box to buy, so “scaling up” here means exactly one thing:{' '}
              <b>make the objects bigger and the requests fewer</b>. The per-request cost is fixed —
              a latency floor of roughly 100 ms and a charge of $0.0004 per thousand — so both
              amortize against object size and against nothing else. At 100 MB the floor is a
              rounding error. At 4 KB it <em>is</em> the workload: request charges alone come to
              about ten cents per gigabyte read, which is more than four times what storing that
              same gigabyte costs for a month.
            </p>
            <p>
              Above that, the tools are all forms of parallelism within one object.{' '}
              <b>Multipart upload</b> splits a large write across many connections, and{' '}
              <b>byte-range GETs</b> do the same for reads — parts around 8–16 MB, until the client
              NIC is the limit. That is the honest ceiling and it arrives quickly: a 25 Gbps
              instance saturates at roughly 3 GB/s no matter how many parts you use.
            </p>
            <p>
              The diminishing returns are unusually sharp in both directions. Past NIC saturation,
              more parallelism buys nothing. And below roughly a megabyte, parallelism buys nothing{' '}
              <em>either</em> — you are paying a fixed cost per request and the only real fix is to
              stop making so many requests: pack small objects together, batch them into columnar
              files, or keep them somewhere else entirely. <b>Object size is chosen at write time
              and cannot be renegotiated later</b>, which makes it the one decision on this page
              worth arguing about in a design review.
            </p>
          </Ch>

          <Ch id="scale-out" n={5} title="Scaling out — the prefix is the shard key">
            <p>
              Horizontal scale on S3 is a single knob — how many partitioned prefixes your keys
              spread across — and one lever that beats it, which is not sending the request at all.
              The sandbox has both, plus the bill, because on a managed tier the invoice{' '}
              <em>is</em> a capacity signal:
            </p>
            <Sandbox content={{ inputs: scaleOutInputs, compute: computeScaleOut }} />
            <div className="boundary">
              <h3>The scaling ladder — apply in order</h3>
              <ol className="ladder">
                <li><b>Make objects bigger.</b> Fewer, larger objects cut request charges, amortize the latency floor, and reduce LIST pressure in one move. Nothing else on this ladder improves three things at once.</li>
                <li><b>Put a CDN in front of the hot fraction.</b> Access is always skewed. The edge removes request charges, egress charges, and the latency floor together — for the requests that never arrive.</li>
                <li><b>Spread keys across prefixes</b> with a hashed or high-cardinality leading segment. This is the actual horizontal knob: unlimited prefixes, each worth another 5,500 reads and 3,500 writes per second.</li>
                <li><b>Parallelize within objects</b> — multipart writes, byte-range reads — until the client NIC is the binding resource, then add clients.</li>
                <li><b>Back off on 503 with jitter.</b> S3 repartitions for you, but only if load subsides enough to let it. Retrying harder is the one response that makes throttling permanent.</li>
                <li><b>Keep your own index.</b> Never LIST to find something in a hot path; write a row when you write the object. This is, essentially, what Iceberg and Delta are.</li>
                <li><b>Lifecycle the cold data</b> to cheaper classes once the access pattern is understood — last, because it optimizes the smallest line on the bill.</li>
              </ol>
            </div>
          </Ch>

          <Ch id="ops" n={6} title="Operations: the pager view">
            <p>
              You do not operate S3. You operate the <b>access pattern</b>, and the canonical
              incident is a key-naming decision made months earlier arriving as a throttled
              pipeline. It has the same self-sustaining shape as the web tier&apos;s retry storm,
              with one extra twist that makes it stranger: <b>S3 fixes this by itself — but only if
              you slow down enough to let it.</b>
            </p>
            <TracePlayer spec={cascadeTrace} />
            <h3>The metrics that matter — a runbook</h3>
            <p>
              Tap any metric for the full card: what healthy looks like, what a spike means, what
              breaks next, likely causes ranked common-to-rare, and what you actually do — safest
              action first. Notice how much of it is about your own client and your own invoice; on
              a managed tier, those <em>are</em> the operational surface.
            </p>
            <MetricRunbook cards={METRICS} />
            <div className="note">
              <b>The operating mindset.</b> Three things. <b>Alert on the distribution, not the
              total</b> — a bucket at 1% of aggregate capacity throttles happily if the traffic
              shares a prefix. <b>Treat 503 as a message rather than a fault</b>; it is the only
              service on this site that tells you the answer and then waits for you to stop
              shouting. And <b>read the invoice as a metric</b>: a surprising request charge means
              the objects are too small, and a surprising egress charge means something in front of
              the bucket is missing.
            </div>
          </Ch>

          <Ch id="bigfleet" n={7} title="What a large workload on S3 looks like">
            <p>
              The scale figures are worth stating not to be impressive but because of what they
              imply. Between 2013 and 2025 the fleet grew by orders of magnitude and{' '}
              <b>the interface did not change at all</b> — still a bucket, a key, and a blob. That
              is the strongest argument anyone has ever made for the abstraction in Chapter 1:
            </p>
            <div className="bigfacts">
              <div className="bigfact"><div className="bf-v">2T</div><div className="bf-k">objects, in 2013</div><div className="bf-s">peaks over 1.1M requests/s</div></div>
              <div className="bigfact"><div className="bf-v">100s of T</div><div className="bf-k">objects, in 2025</div><div className="bf-s">across 36 regions</div></div>
              <div className="bigfact"><div className="bf-v">11</div><div className="bf-k">nines of durability</div><div className="bf-s">designed-for, hardware only</div></div>
              <div className="bigfact"><div className="bf-v">3,500 / 5,500</div><div className="bf-k">writes / reads per second</div><div className="bf-s">per prefix — unlimited prefixes</div></div>
            </div>
            <p>
              Since you never operate the fleet, the thing worth walking is the workload:{' '}
              <b>four decisions</b> that between them determine whether a petabyte-scale system on
              S3 is cheap and fast or expensive and throttled. None of them is a capacity decision:
            </p>
            <TracePlayer spec={fleetTrace} />
            <p className="fl-src-note">
              2013 figures from{' '}
              <a href="https://aws.amazon.com/blogs/aws/amazon-s3-two-trillion-objects-11-million-requests-second/" target="_blank" rel="noreferrer">
                AWS News Blog — “Amazon S3 — Two Trillion Objects, 1.1 Million Requests/Second”
              </a>{' '}
              (April 2013); 2025 figures from{' '}
              <a href="https://www.allthingsdistributed.com/2025/03/in-s3-simplicity-is-table-stakes.html" target="_blank" rel="noreferrer">
                Werner Vogels — “In S3, simplicity is table stakes”
              </a>
              , which also describes single customers driving tens of terabytes per second.
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
                  <p className="fd" dangerouslySetInnerHTML={{ __html: f[1] }} />
                </div>
              ))}
            </div>
          </Ch>

          <Ch id="sources" n={9} title="Primary sources — read the real thing">
            <div className="srcs">
              <div className="src">
                <div className="s-k">The paper</div>
                <a href="https://www.amazon.science/publications/using-lightweight-formal-methods-to-validate-a-key-value-storage-node-in-amazon-s3" target="_blank" rel="noreferrer">
                  Bornholt et al. — “Using Lightweight Formal Methods to Validate a Key-Value Storage Node in Amazon S3” (SOSP ’21)
                </a>
                <p>The best public look inside a real S3 storage node — ShardStore, log-structured, checked with reference models and property-based testing. Read it for the engineering culture as much as the design: this is what “eleven nines” looks like as a day job rather than a marketing figure.</p>
              </div>
              <div className="src">
                <div className="s-k">The insider account</div>
                <a href="https://www.allthingsdistributed.com/2025/03/in-s3-simplicity-is-table-stakes.html" target="_blank" rel="noreferrer">
                  Werner Vogels — “In S3, simplicity is table stakes”
                </a>
                <p>Twenty years of S3 told as a series of things deliberately <em>not</em> added. The central argument — that the constraints in Chapter 1 are the reason the service scaled, not a compromise it lived with — is the thesis of this whole page, from the person who signed off on it.</p>
              </div>
              <div className="src">
                <div className="s-k">The docs</div>
                <a href="https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html" target="_blank" rel="noreferrer">
                  AWS — “Best practices design patterns: optimizing Amazon S3 performance”
                </a>
                <p>Short, specific, and the source of nearly every number on this page: the per-prefix rates, the gradual-scaling caveat that explains Chapter 6, the ~100–200 ms latency band, and 100 Gb/s single-instance transfer. Unusually honest documentation about a service&apos;s own limits.</p>
              </div>
              <div className="src">
                <div className="s-k">The war story</div>
                <a href="https://aws.amazon.com/message/41926/" target="_blank" rel="noreferrer">
                  AWS — “Summary of the Amazon S3 Service Disruption in the Northern Virginia (US-EAST-1) Region” (2017)
                </a>
                <p>A typo in a capacity-removal command took out more index-subsystem capacity than intended, and the restart took hours because those subsystems had not been restarted in years. Two lessons, both general: recovery paths decay when unexercised, and the metadata layer is the fragile one.</p>
              </div>
              <div className="src">
                <div className="s-k">The adversarial read</div>
                <a href="https://hadoop.apache.org/docs/stable/hadoop-aws/tools/hadoop-aws/committers.html" target="_blank" rel="noreferrer">
                  Apache Hadoop — “Committing work to S3 with the S3A Committers”
                </a>
                <p>What it costs when an entire ecosystem assumes a filesystem and gets an object store. “The S3A client still mimics <code>rename()</code> by copying files and then deleting the originals. This can fail partway through…” — a whole family of committers exists to work around one missing operation. Read it as the bill for Chapter 1&apos;s trade.</p>
              </div>
            </div>
          </Ch>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
