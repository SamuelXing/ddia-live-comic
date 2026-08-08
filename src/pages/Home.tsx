import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import ThumbCanvas from '../components/ThumbCanvas'
import { SIMS, STATUS_META } from '../sims/registry'

import '@fontsource/playfair-display/700.css'
import '@fontsource/playfair-display/800.css'
import '@fontsource/playfair-display/900.css'
import '@fontsource/comic-neue/400.css'
import '@fontsource/comic-neue/700.css'
import '@fontsource/newsreader/400.css'
import '@fontsource/newsreader/500.css'
import '@fontsource/newsreader/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '../styles/comic.css'

/** Wordmark lives in one place so a rename is a one-line change. */
const BRAND = 'DDIA, as a live comic'

const COMPS = [
  { name: 'Apache Kafka', path: '/components/kafka', color: '#c98500', desc: 'A replicated append-only log: partitioning, replication, consensus, all from one design bet.' },
  { name: 'Postgres', path: '/components/postgres', color: '#9085e9', desc: 'The single-primary write wall: storage engines, MVCC, WAL replication, the pool → cache → shard ladder.' },
  { name: 'Redis', path: '/components/redis', color: '#e5533b', desc: 'One CPU core, memory ceilings, eviction, cluster hash slots, and the hot-key problem.' },
  { name: 'Web / App tier', path: '/components/web', color: '#3987e5', desc: "Stateless clones behind a balancer. Little's Law and connection fan-out." },
  { name: 'RabbitMQ', path: '/components/rabbitmq', color: '#0f9fc2', desc: 'The smart broker: exchanges, prefetch, quorum queues, one core per queue.' },
  { name: 'S3 / Object store', path: '/components/s3', color: '#1aa46e', desc: 'Per-prefix request limits, the latency floor, and the cost shape.' },
]

export default function Home() {
  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const nodes = Array.from(document.querySelectorAll('.gn [data-obs]'))
    if (reduce || !('IntersectionObserver' in window)) {
      nodes.forEach((el) => el.classList.add('in'))
      return
    }
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es)
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )
    nodes.forEach((el, i) => {
      ;(el as HTMLElement).style.transitionDelay = Math.min(i, 5) * 30 + 'ms'
      io.observe(el)
    })
    return () => io.disconnect()
  }, [])

  return (
    <div className="gn">
      <SiteNav />

      <div className="gn-sheet">
        {/* ---- hero ---- */}
        <header className="gn-mast box" data-obs>
          <div className="gn-kicker">An illustrated guide to distributed systems</div>
          <h1>Read the idea. Meet the machine. Watch it break.</h1>
          <p className="dek">
            The hard ideas behind every backend — replication, partitioning, consensus — drawn as
            short comics inspired by <em>Designing Data-Intensive Applications</em>. Then meet the
            real machines built from them — Kafka, Postgres, Redis — and push whole systems until
            they break under live traffic.
          </p>
          <div className="gn-cta">
            <Link className="gn-btn primary" to="/read">
              ▶ Read the ideas
            </Link>
            <Link className="gn-btn" to="/components">
              See them in the machines
            </Link>
          </div>
        </header>

        {/* ---- three ways in ---- */}
        <div className="gn-sechead" data-obs>
          <div className="eb">Three ways in</div>
          <h2>The same idea, at three scales</h2>
          <p>
            Every backend is the same handful of ideas arranged differently. Read each idea as a comic,
            meet the real component built from it, then watch a whole application lean on it under live
            traffic — one concept, seen at three scales.
          </p>
        </div>
        <div className="gn-idx-lenses">
          <Link className="gn-lens gap box lift" to="/read" data-obs>
            <span className="ll">Read · new</span>
            <h3>The Ideas</h3>
            <p>
              Partitioning, replication, consensus — each drawn as a short, readable comic. Start with
              consistent hashing and watch a hash ring rebalance one slice of keys, not the whole
              keyspace.
            </p>
          </Link>
          <Link className="gn-lens built box lift" to="/components" data-obs>
            <span className="ll">Meet · built</span>
            <h3>The Machines</h3>
            <p>
              Kafka, Postgres, Redis, RabbitMQ — one deep-dive each. How the machine works, where it
              breaks, and which ideas it’s assembled from.
            </p>
          </Link>
          <a className="gn-lens built box lift" href="#apps" data-obs>
            <span className="ll">Watch · built</span>
            <h3>The Systems</h3>
            <p>
              Whole applications you push until they break. Requests are particles flowing through real
              services; when arrivals outrun capacity, queues stack and nodes glow red.
            </p>
          </a>
        </div>

        {/* ---- app simulations ---- */}
        <div className="gn-sechead" id="apps" data-obs>
          <div className="eb">Application simulations · Scale Lab</div>
          <h2>Pick an app and push it until it breaks</h2>
          <p>
            Each simulation uses the same honest engine — a different topology, a different workload, a
            different set of walls. New apps land here as we build them.
          </p>
        </div>
        <div className="gn-gallery">
          {SIMS.map((a) => {
            const meta = STATUS_META[a.status]
            const inner = (
              <>
                <div className="thumb">
                  <span className={`status ${meta.cls}`}>{meta.label}</span>
                  <ThumbCanvas accent={a.accent} />
                </div>
                <div className="b">
                  <h3>
                    <span className="em">{a.emoji}</span>
                    {a.name}
                  </h3>
                  <p className="desc">{a.desc}</p>
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
              <Link className="gn-appcard box lift" to={a.path} key={a.id} data-obs>
                {inner}
              </Link>
            ) : (
              <div className="gn-appcard box soon" key={a.id} data-obs>
                {inner}
              </div>
            )
          })}
        </div>

        {/* ---- how a simulation works ---- */}
        <div className="gn-sechead" data-obs>
          <div className="eb">How a simulation works</div>
          <h2>Not a cartoon — a real queueing model</h2>
        </div>
        <div className="gn-hiw">
          <div className="gn-hstep box lift" data-obs>
            <div className="n">1</div>
            <h4>Every node is a queue</h4>
            <p>
              Each service and datastore has a fixed number of concurrent service slots and a service
              time. Throughput ceiling = slots ÷ service time — the same M/M/c intuition, made visible.
            </p>
          </div>
          <div className="gn-hstep box lift" data-obs>
            <div className="n">2</div>
            <h4>Requests are particles</h4>
            <p>
              Reads, posts, likes and uploads flow along real routes. When arrivals outrun a node’s
              slots, its queue physically stacks up and latency climbs — no hand-waving.
            </p>
          </div>
          <div className="gn-hstep box lift" data-obs>
            <div className="n">3</div>
            <h4>You climb the ladder</h4>
            <p>
              Scale out the web tier, add a cache, shard the database, go multi-region. Each rung
              unlocks a control and a new wall — the order you’d hit them in production.
            </p>
          </div>
        </div>

        {/* ---- building blocks ---- */}
        <div className="gn-sechead" data-obs>
          <div className="eb">The building blocks</div>
          <h2>Every tier scales differently — and breaks differently</h2>
          <p>Jump straight into any component’s deep-dive.</p>
        </div>
        <div className="gn-compgrid">
          {COMPS.map((cp) => (
            <Link className="gn-comp box lift" to={cp.path} key={cp.name} data-obs>
              <h4>
                <span className="dot" style={{ background: cp.color }} />
                {cp.name}
              </h4>
              <p>{cp.desc}</p>
            </Link>
          ))}
        </div>

        {/* ---- closing band ---- */}
        <div style={{ marginTop: 60 }} data-obs>
          <div className="gn-band">
            <h2>Start with consistent hashing</h2>
            <p>
              The flagship comic: add a node to a hash ring and watch a single slice of keys move
              instead of the whole keyspace — the idea behind Redis Cluster and Kafka partitions.
            </p>
            <Link className="gn-btn primary" to="/read/partitioning">
              ▶ Read the first comic
            </Link>
          </div>
        </div>

        <div className="gn-foot">
          <span>
            {BRAND} — an unofficial, illustrated companion to <em>Designing Data-Intensive
            Applications</em> by Martin Kleppmann. Not affiliated with the author or O’Reilly.
          </span>
          <span>
            <Link to="/read">Read the Ideas</Link> · <Link to="/components">Deep-Dives</Link> ·{' '}
            <a href="#apps">Simulations</a>
          </span>
        </div>
      </div>
    </div>
  )
}
