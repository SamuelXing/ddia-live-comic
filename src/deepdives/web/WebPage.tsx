import { Link } from 'react-router-dom'
import SiteNav from '../../components/SiteNav'
import SiteFooter from '../../components/SiteFooter'
import IdeaStrip from '../../components/IdeaStrip'
import TracePlayer from '../../components/TracePlayer'
import MetricRunbook from '../../components/MetricRunbook'
import { Sandbox } from '../ModulePanel'
import HardwareEnvelope from './HardwareEnvelope'
import { requestTrace, autoscaleTrace, fleetTrace } from './traces'
import { computeScaleOut, scaleOutInputs } from './scaleout'
import { METRICS, cascadeTrace } from './ops'

const CHAPTERS = [
  { id: 'abstraction', n: 1, title: 'The core abstraction' },
  { id: 'anatomy', n: 2, title: 'Anatomy of one instance' },
  { id: 'hardware', n: 3, title: 'The hardware envelope' },
  { id: 'scale-up', n: 4, title: 'Scaling up' },
  { id: 'scale-out', n: 5, title: 'Scaling out' },
  { id: 'ops', n: 6, title: 'Operations: the pager view' },
  { id: 'bigfleet', n: 7, title: 'What a large fleet looks like' },
  { id: 'boundaries', n: 8, title: 'Boundaries & failures' },
  { id: 'sources', n: 9, title: 'Primary sources' },
]

const LIMITS: [string, string, string][] = [
  ['Throughput per instance', '= workers ÷ W', 'The only capacity equation on this page. 64 slots and 200 ms requests give 320 req/s on any hardware you buy — cores do not enter into it unless you are actually computing.'],
  ['Useful utilization', '~70–80% of slots', 'Queueing multiplies service time by 1 ÷ (1 − ρ). At 90% a 20 ms request takes 200 ms with nothing downstream having changed. The last 20% of a stateless tier is not capacity, it is latency.'],
  ['Memory per slot', '~100 KB async · ~1–8 MB thread', 'This single ratio is why async runtimes exist. A thread-per-request server runs out of RAM at a few thousand slots; an event loop holds tens of thousands on the same box.'],
  ['Accept queue', 'min(backlog, somaxconn)', 'Overflow does not raise an error — the kernel drops the SYN and the client stalls for a TCP retransmit. Seconds of user-visible latency with no log line anywhere in your application.'],
  ['Ephemeral ports', '~28,232 per destination', 'Linux hands out 32768–60999 per (src, dst, dst-port) tuple, and TIME_WAIT holds each for ~60 s after close. Without keep-alive a busy instance simply stops being able to connect.'],
  ['File descriptors', '1,024 by default', 'Sockets, files, and pipes all draw on it. The default is a decade out of date and takes down a first production deploy with monotonous regularity.'],
  ['Autoscaling reaction', '~3–5 minutes', 'Stale scrape + alarm hysteresis + boot + warm-up + health checks. Any spike faster than this must be absorbed by headroom or refused — it cannot be scaled into.'],
  ['Statelessness', 'Hard requirement', 'Not a nice-to-have. One in-process session, local upload, or non-disposable cache and you have bought sticky sessions, uneven load, and lossy deploys, permanently.'],
]

const FAILS: [string, string][] = [
  ['The retry storm', 'A dependency slows, clients time out and re-send, and offered load becomes 3× real demand — all of it work the tier already did once. Past the point where retries alone exceed capacity, fixing the original trigger changes nothing. Budget retries globally, back off with jitter, and shed load fast.'],
  ['The thundering herd', 'A deploy or cache flush sends every instance to the database for the same cold keys in the same second. Single-flight the misses, jitter the TTLs, and warm caches before an instance enters rotation.'],
  ['The connection stampede', 'Scaling out multiplies pools, not just capacity: 200 instances × 20 connections is 4,000 backends against a database that wanted a few hundred. The web tier scales fine and takes the database down doing it.'],
  ['The blocking call in the event loop', 'One synchronous file read, crypto call, or JSON parse of a huge payload freezes every concurrent request in that process — not just its own. The failure is indistinguishable from the machine being gone, and it looks fine on every CPU graph.'],
  ['The slow dependency that ate every worker', 'One degraded downstream ties up all the slots, so unrelated endpoints queue behind it. Separate pools per dependency (bulkheads), timeouts shorter than your patience, and a breaker that stops trying.'],
  ['The health check that lied', 'A check that returns 200 without touching a dependency keeps every broken instance in rotation; a check that hits every dependency takes the whole fleet out when one of them blips. Both are common, and they fail in opposite directions.'],
  ['The autoscaler that scaled the wrong way', 'On an I/O-bound tier, saturation makes threads wait, so CPU falls — and a CPU-driven autoscaler removes capacity during an incident. This is not a thought experiment; it is in Slack’s January 2021 postmortem.'],
  ['The deploy that halved capacity', 'Rolling 25% of the fleet out of rotation at peak leaves 75% carrying 100%. If you were running at 80% utilization, you are now over — an outage on a schedule you picked yourself.'],
  ['The port exhaustion mystery', 'An instance making many short-lived outbound calls to one service burns through the ephemeral range, then fails to connect while sitting near-idle. Every graph looks healthy. The fix is connection reuse, not more instances.'],
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

export default function WebPage() {
  return (
    <div className="dd-page fl-page">
      <SiteNav />
      <main className="wrap fl-wrap">
        <aside className="fl-toc">
          <div className="fl-toc-title">Web / App tier</div>
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
          <p className="h-kicker">Deep-dive · stateless compute</p>
          <h1 className="title">The web / app tier</h1>
          <p className="lede">
            This is the one tier that scales by copying, and the copying is genuinely easy — which
            is exactly why it gets so little attention and causes so many outages. Everything here
            falls out of two facts. <b>A server is not fast; it has N slots, and each request
            occupies one for W seconds</b> — so capacity is <code>N ÷ W</code> and nothing else. And{' '}
            <b>statelessness is something you buy, not something you have</b>: sessions, uploads,
            and caches all have to live somewhere, and where you put them decides whether cloning
            works at all. The interesting part is never the cloning. It is what the clones{' '}
            <em>multiply</em>.
          </p>

          <IdeaStrip
            ideas={[
              { slug: 'tail-latency', label: 'Tail Latency' },
              { slug: 'distributed-troubles', label: 'The Trouble with Distributed Systems' },
            ]}
          />

          <Ch id="abstraction" n={1} title="The core abstraction: a request with nowhere to live">
            <p>
              An app server turns requests into responses and remembers nothing. That single
              constraint is the product. Because no request depends on which instance served the
              last one, <b>any instance can serve anything and every instance is disposable</b> —
              which is what makes load balancing trivial, autoscaling possible, rolling deploys
              safe, and spot instances sane. Nothing else in your stack has this property, and
              everything else in your stack is harder for exactly that reason.
            </p>
            <p>
              The second bet is quieter and does more damage when it is missed. A server does not
              have a speed; it has <b>a fixed number of concurrency slots</b>. Whether a slot is an
              OS thread, a goroutine, or a continuation on an event loop changes what it costs in
              memory — not how many you need. That count comes from{' '}
              <b>Little&apos;s Law</b>: the average number of requests in flight equals arrival rate
              times time-in-system, <code>L = λ × W</code>. Serve 10,000 req/s at 200 ms and you are
              holding 2,000 requests at every instant. Have fewer slots than that and the rest
              queue, which raises W, which raises L. <em>Latency and capacity are the same
              measurement taken from different ends.</em>
            </p>
            <p>
              Everything operational on this page follows from putting those two together.
              Statelessness must be purchased — session state to Redis or a signed token, uploads to
              object storage, local caches strictly disposable — and the price is that{' '}
              <b>every clone multiplies its relationship with the tiers behind it</b>. Two hundred
              instances is two hundred connection pools, two hundred cold caches after a deploy, and
              two hundred clients retrying in unison. The web tier rarely breaks. It is astonishingly
              good at breaking things it depends on.
            </p>
            <div className="note">
              <b>The through-line, stated plainly.</b> Scaling out is easy for stateless work and
              hard for stateful work, so most of architecture is tricks for turning the second into
              the first. This page is what the easy side actually looks like up close — and the
              recurring lesson is that the difficulty did not disappear, it{' '}
              <em>moved one tier down</em>.
            </div>
          </Ch>

          <Ch id="anatomy" n={2} title="Anatomy of one instance">
            <p>
              Press play and follow a single request from TLS handshake to the last byte on the
              wire. Watch for how little of it is your code, and for the two queues nobody
              instruments:
            </p>
            <TracePlayer spec={requestTrace} />
            <p>
              The trace above is the steady state. The web tier&apos;s strangest mechanism is what
              happens when the steady state moves — because the fix arrives late, by construction.
              An autoscaler is a control loop, and every stage of it is <b>dead time</b>:
            </p>
            <TracePlayer spec={autoscaleTrace} />
            <h3>The background cast</h3>
            <p>
              Around the request path run the loops that decide whether any of it works: the{' '}
              <b>load balancer&apos;s health checker</b>, deciding which instances exist; the{' '}
              <b>garbage collector or event loop</b>, which can freeze every slot at once; the{' '}
              <b>connection pools</b>, one per dependency per instance, quietly multiplying with the
              fleet; the <b>autoscaler</b> from the trace above; and the <b>deploy controller</b>,
              which removes capacity on purpose several times a week. Every one of them has a
              failure mode that appears by name in Chapter 6, and not one of them is part of your
              application.
            </p>
          </Ch>

          <Ch id="hardware" n={3} title="The hardware envelope">
            <p>
              A stateless instance has an unusual resource profile: <b>the thing it runs out of
              first is usually not a resource at all</b>. It runs out of <em>slots</em> — a number
              you configured — while CPU, memory, and network sit largely idle. That is why the
              honest fullness metric here is in-flight requests, and why CPU utilization, the
              default autoscaling signal almost everywhere, is close to meaningless on an I/O-bound
              tier. Pick a shape and push the workload until a meter goes red:
            </p>
            <HardwareEnvelope />
            <p className="fl-src-note">
              The queueing multiplier is the M/M/1 term <code>1 ÷ (1 − ρ)</code>, the same one
              behind the <Link to="/calculator/latency">latency budget calculator</Link> — imported
              from the same module rather than restated, so the two pages cannot drift. Ephemeral
              port range and file-descriptor defaults are Linux defaults (
              <code>net.ipv4.ip_local_port_range</code> = 32768–60999,{' '}
              <code>ulimit -n</code> = 1024).
            </p>
          </Ch>

          <Ch id="scale-up" n={4} title="Scaling up — and the reason it is not pointless">
            <p>
              Vertical scaling maps onto the envelope with almost no romance. <b>More cores</b> raise
              throughput only for the fraction of W that is genuinely computation — for a handler
              that spends 5 ms computing and 200 ms waiting, cores buy you nothing at all.{' '}
              <b>More RAM</b> buys slots, and only matters if a slot is expensive: it is the
              difference between three thousand threads and thirty thousand continuations on the
              same box. <b>A faster NIC</b> matters if you ship bytes and is irrelevant if you ship
              JSON. And every runtime has a ceiling that no hardware clears: one event loop is one
              core, a global interpreter lock is a global interpreter lock, and garbage-collection
              pause time grows with the heap you just enlarged.
            </p>
            <p>
              So the textbook advice is to skip vertical scaling here and just add instances. The
              textbook is missing the one case that matters. <b>Connection fan-out is per instance,
              not per request</b> — so the same traffic served by 20 large instances instead of 200
              small ones creates a tenth of the connections, a tenth of the cold caches after a
              deploy, and a tenth of the retry sources during an incident. <em>On a stateless tier,
              scaling up is frequently how you protect the stateful tier behind it.</em> The
              counter-pressure is real and worth stating: bigger instances mean coarser autoscaling
              steps, longer boot times, and a larger blast radius per failure. The right answer is
              a shape, not a direction — and the sandbox in Chapter 5 is where you find it.
            </p>
          </Ch>

          <Ch id="scale-out" n={5} title="Scaling out — what the clones multiply">
            <p>
              Horizontal scaling works. That is not the interesting claim; it is the premise. Push
              the sliders below and watch the three things that scale <em>with</em> the fleet and
              should not: the connection count the shared tier sees, the capacity your own deploy
              removes, and the queueing multiplier that turns high utilization into latency rather
              than throughput.
            </p>
            <Sandbox content={{ inputs: scaleOutInputs, compute: computeScaleOut }} />
            <div className="boundary">
              <h3>The scaling ladder — apply in order</h3>
              <ol className="ladder">
                <li><b>Cut W.</b> Halving time per request halves the fleet <em>and</em> halves the connections, cold caches, and retry sources with it. The cheapest capacity you will ever buy, and the only rung that makes every other number better at once.</li>
                <li><b>Cache reads</b> so the request never reaches the shared tier. Hit rate is the conversion factor between your traffic and your database&apos;s traffic — the highest-leverage single number in the stack.</li>
                <li><b>Go properly stateless</b> — sessions out, uploads out, sticky sessions off — because everything below this rung silently assumes it.</li>
                <li><b>Scale out</b> behind a balancer with real health checks and graceful connection draining. This is where you live long-term, and it is genuinely near-linear.</li>
                <li><b>Decouple the fleet from the connection count</b> with a pooler, or by running fewer, larger instances. Do this <em>before</em> the fleet size that needs it.</li>
                <li><b>Autoscale on a leading signal</b> — in-flight requests or queue depth, never CPU alone — with headroom sized to the dead time from Chapter 2.</li>
                <li><b>Shed load deliberately</b> when demand outruns the loop. A fast 429 protects everyone still queued; the alternative is not "serve everyone", it is Chapter 6.</li>
              </ol>
            </div>
          </Ch>

          <Ch id="ops" n={6} title="Operations: the pager view">
            <p>
              The defining web-tier incident does not begin with anything being down, and it does
              not end when the trigger is fixed. It is a <b>metastable failure</b>: a system pushed
              into a second stable state that sustains itself, where the retries alone are now more
              load than the tier can serve. Play it, then keep the runbook:
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
              <b>The operating mindset.</b> Three rules cover most of it. <b>Measure fullness in
              requests, not in CPU</b> — the tier is full when the slots are full, and CPU can fall
              while things get worse. <b>Treat every latency regression as a capacity event</b>,
              because <code>L = λ × W</code> makes it one whether you planned for it or not. And{' '}
              <b>decide in advance what you will refuse</b>: a tier that cannot say no has only one
              way to fail, and it is the slow, self-sustaining one above.
            </div>
          </Ch>

          <Ch id="bigfleet" n={7} title="What a large web tier actually looks like">
            <p>
              The instructive example at the top end is not the biggest fleet — it is the smallest
              one that has no right to be. In 2016 Stack Overflow published a full day of counters
              alongside its hardware list, and the two together make an argument no benchmark can:
            </p>
            <div className="bigfacts">
              <div className="bigfact"><div className="bf-v">9</div><div className="bf-k">web servers</div><div className="bf-s">of 11; two are dev &amp; Meta</div></div>
              <div className="bigfact"><div className="bf-v">209M</div><div className="bf-k">HTTP requests</div><div className="bf-s">in one day — ~2,400/s average</div></div>
              <div className="bigfact"><div className="bf-v">22.7 ms</div><div className="bf-k">average render</div><div className="bf-s">question page, 49M of them</div></div>
              <div className="bigfact"><div className="bf-v">≈ 6</div><div className="bf-k">requests in flight</div><div className="bf-s">per server, from L = λ × W</div></div>
            </div>
            <p>
              Run the law on their own published numbers and the fleet stops being surprising:
              2,400 requests per second held for 23 milliseconds is <b>about 55 requests in flight
              across the entire tier</b>. Nine servers is not nine servers&apos; worth of load; it is
              redundancy, deploy headroom, and peak. <em>They did not buy a small fleet with clever
              scaling — they bought it by making W tiny</em>, which is rung one of the ladder above
              and the only rung most teams never attempt. Walk the topology and the ratios:
            </p>
            <TracePlayer spec={fleetTrace} />
            <p className="fl-src-note">
              Every figure from{' '}
              <a href="https://nickcraver.com/blog/2016/02/17/stack-overflow-the-architecture-2016-edition/" target="_blank" rel="noreferrer">
                Nick Craver — “Stack Overflow: The Architecture — 2016 Edition”
              </a>
              , counters for 9 February 2016; the per-request ratios and the in-flight figure are
              arithmetic on those counters. Daily averages, so peak is several times higher —
              which is rather the point.
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
                <div className="s-k">The law</div>
                <a href="https://www.jstor.org/stable/167570" target="_blank" rel="noreferrer">
                  J. D. C. Little — “A Proof for the Queuing Formula: L = λW” (Operations Research, 1961)
                </a>
                <p>Four pages that quietly govern this entire page. The result is almost embarrassingly general — it assumes no distribution, no arrival process, nothing — which is why it applies to your thread pool, your connection pool, and the queue at a coffee shop equally well.</p>
              </div>
              <div className="src">
                <div className="s-k">The paper</div>
                <a href="https://sigops.org/s/conferences/hotos/2021/papers/hotos21-s11-bronson.pdf" target="_blank" rel="noreferrer">
                  Bronson, Aghayev, Charapko &amp; Zhu — “Metastable Failures in Distributed Systems” (HotOS ’21)
                </a>
                <p>The paper that gave Chapter 6&apos;s incident a name and a shape. Its central claim is the one operators learn the hard way: past a threshold, removing the trigger does not restore the system, because the sustaining effect is now the load itself. Short, and it will change how you read postmortems.</p>
              </div>
              <div className="src">
                <div className="s-k">The book</div>
                <a href="https://sre.google/sre-book/handling-overload/" target="_blank" rel="noreferrer">
                  Google SRE — “Handling Overload” and “Addressing Cascading Failures”
                </a>
                <p>Free online, and the two chapters together are the definitive practical treatment of shedding load, retry budgets, and why a server that cannot refuse work has only one failure mode. Read them as the answer to the trace in Chapter 6.</p>
              </div>
              <div className="src">
                <div className="s-k">The war story</div>
                <a href="https://slack.engineering/slacks-outage-on-january-4th-2021/" target="_blank" rel="noreferrer">
                  Slack — “Slack&apos;s Outage on January 4th 2021”
                </a>
                <p>Unusually honest, and it contains this page&apos;s two hardest lessons in the operators&apos; own words: falling CPU triggering automated <em>downscaling</em> during saturation, and 1,200 instances launched in fourteen minutes that mostly never provisioned — because the provisioning path ran over the same degraded network.</p>
              </div>
              <div className="src">
                <div className="s-k">The adversarial read</div>
                <a href="https://www.usenix.org/system/files/conference/hotos15/hotos15-paper-mcsherry.pdf" target="_blank" rel="noreferrer">
                  McSherry, Isard &amp; Murray — “Scalability! But at what COST?” (HotOS ’15)
                </a>
                <p>An attack on the premise of this whole page. The authors measure the Configuration that Outperforms a Single Thread and find that several published distributed systems never reach it — they scale beautifully away from an overhead they introduced themselves. Read it before your next "we need to scale out" meeting.</p>
              </div>
            </div>
          </Ch>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
