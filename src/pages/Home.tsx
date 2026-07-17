import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import HeroCanvas from '../components/HeroCanvas'
import ThumbCanvas from '../components/ThumbCanvas'
import { SIMS, STATUS_META } from '../sims/registry'
import '../styles/home.css'

const COMPS = [
  { name: 'Apache Kafka', path: '/components/kafka', color: '#e6a72a', desc: 'Flagship deep-dive: broker anatomy, animated request traces, hardware math.' },
  { name: 'Postgres', path: '/components/postgres', color: '#9085e9', desc: 'The single-primary write wall: pool → cache → replicas → shard.' },
  { name: 'Redis', path: '/components/redis', color: '#e5533b', desc: 'One CPU core, memory ceilings, eviction, and the hot-key problem.' },
  { name: 'Web / App tier', path: '/components/web', color: '#3987e5', desc: "Stateless clones behind a balancer. Little's Law and connection fan-out." },
  { name: 'RabbitMQ', path: '/components/rabbitmq', color: '#37b6c4', desc: 'The smart broker: exchanges, prefetch, one core per queue.' },
  { name: 'S3 / Object store', path: '/components/s3', color: '#25b866', desc: 'Per-prefix request limits, latency floor, and cost shape.' },
]

export default function Home() {
  return (
    <div className="home-page">
      <SiteNav />

      <header className="hero">
        <HeroCanvas />
        <div className="wrap hero-in">
          <span className="eyebrow">◆ Interactive systems-design lab</span>
          <h1>
            Understand scaling by <span className="grad">watching it happen</span>
          </h1>
          <p className="sub">
            Scale Lab turns distributed-systems theory into things you can drag, break, and fix.
            Push traffic through a live application until a database saturates or a queue backs up
            — then watch the same fix that works on the whiteboard work on the screen.
          </p>
          <div className="hero-cta">
            <Link className="btn btn-primary" to="/sims/feed">
              ▶ Open Feed at Scale
            </Link>
            <Link className="btn btn-ghost" to="/components">
              Explore the components
            </Link>
          </div>
          <div className="hero-stats">
            <div>
              <b>5</b> infrastructure tiers
            </div>
            <div>
              <b>6</b> stages · local → global
            </div>
            <div>
              <b>{SIMS.filter((s) => s.status === 'live').length}+</b> live app simulations
            </div>
            <div>
              <b>0</b> setup — runs in your browser
            </div>
          </div>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <p className="sec-kicker">Two ways in</p>
            <h2>Learn the pieces, then watch them work together</h2>
            <p>
              Every backend is the same handful of building blocks arranged differently. Master
              each block on its own, then see how a real application stitches them into something
              that has to survive real traffic.
            </p>
          </div>
          <div className="pillars">
            <Link className="pillar pill-a" to="/components">
              <div className="pi">🧩</div>
              <h3>Component Deep-Dives</h3>
              <p>
                One interactive tour per building block — the web tier, Kafka &amp; RabbitMQ,
                Redis, Postgres, and S3. Drag the sliders to find each component&apos;s real wall:
                the single-primary write ceiling, the one-CPU Redis core, the per-prefix S3 limit.
                Includes an end-to-end capacity calculator.
              </p>
              <span className="go">Explore the components →</span>
            </Link>
            <a className="pillar pill-b" href="#apps">
              <div className="pi">🌐</div>
              <h3>Application Simulations</h3>
              <p>
                Whole applications you can watch scale from a single laptop to a
                globally-distributed system. Requests are animated particles flowing through real
                services; when arrivals outrun capacity, queues back up and nodes glow red — the
                animation <em>is</em> the queueing math.
              </p>
              <span className="go">Browse the gallery →</span>
            </a>
          </div>
        </div>
      </section>

      <section id="apps" style={{ paddingTop: 24 }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="sec-kicker">Application simulations</p>
            <h2>Pick an app and push it until it breaks</h2>
            <p>
              Each simulation uses the same honest engine — a different topology, a different
              workload, a different set of walls. New apps land here as we build them.
            </p>
          </div>
          <div className="gallery">
            {SIMS.map((a) => {
              const meta = STATUS_META[a.status]
              const inner = (
                <>
                  <div className="thumb">
                    <span className={`status ${meta.cls}`}>{meta.label}</span>
                    <ThumbCanvas accent={a.accent} />
                  </div>
                  <div className="body">
                    <h3>
                      <span className="emoji">{a.emoji}</span>
                      {a.name}
                    </h3>
                    <p>{a.desc}</p>
                    <div className="tags">
                      {a.tags.map((t) => (
                        <span className="tag" key={t}>
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="foot">{meta.foot}</div>
                  </div>
                </>
              )
              return a.status === 'live' && a.path ? (
                <Link className="appcard live" to={a.path} key={a.id}>
                  {inner}
                </Link>
              ) : (
                <div className="appcard" key={a.id}>
                  {inner}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 20 }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="sec-kicker">How a simulation works</p>
            <h2>Not a cartoon — a real queueing model</h2>
          </div>
          <div className="hiw">
            <div className="step">
              <div className="n">1</div>
              <h4>Every node is a queue</h4>
              <p>
                Each service and datastore has a fixed number of concurrent service slots and a
                service time. Throughput ceiling = slots ÷ service time — the same M/M/c intuition,
                made visible.
              </p>
            </div>
            <div className="step">
              <div className="n">2</div>
              <h4>Requests are particles</h4>
              <p>
                Reads, posts, likes and uploads flow along real routes. When arrivals outrun a
                node&apos;s slots, its queue physically stacks up and latency climbs — no
                hand-waving.
              </p>
            </div>
            <div className="step">
              <div className="n">3</div>
              <h4>You climb the ladder</h4>
              <p>
                Scale out the web tier, add a cache, shard the database, go multi-region. Each rung
                unlocks a control and a new wall — exactly the order you&apos;d hit them in
                production.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 20 }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="sec-kicker">The building blocks</p>
            <h2>Every tier scales differently — and breaks differently</h2>
            <p>Jump straight into any component&apos;s deep-dive.</p>
          </div>
          <div className="compgrid">
            {COMPS.map((cp) => (
              <Link className="comp" to={cp.path} key={cp.name}>
                <span className="dot" style={{ background: cp.color }} />
                <h4>{cp.name}</h4>
                <p>{cp.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 8 }}>
        <div className="wrap">
          <div className="band">
            <h2>Start with the social feed</h2>
            <p>
              Watch a feed grow from one overloaded box to a globally-distributed system — and meet
              the fan-out, hot-key, and write-wall problems every large app eventually faces.
            </p>
            <Link className="btn btn-primary" to="/sims/feed">
              ▶ Launch Feed at Scale
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
