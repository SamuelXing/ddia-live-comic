import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav'

/* /ddia is the hub, and only the hub. The three sections of this book — the
   ideas, the deep-dives, the simulations — each own a page, and this one sends
   you into them. The simulations used to be pasted in halfway down here behind
   a `#apps` anchor, which is why "Simulations" was the one nav item that could
   not be a link to anywhere. */

/** Wordmark lives in one place so a rename is a one-line change. */
const BRAND = 'DDIA, as a live comic'

const COMPS = [
  { name: 'Apache Kafka', path: '/ddia/components/kafka', color: '#c98500', desc: 'A replicated append-only log: partitioning, replication, consensus, all from one design bet.' },
  { name: 'Postgres', path: '/ddia/components/postgres', color: '#9085e9', desc: 'The single-primary write wall: storage engines, MVCC, WAL replication, the pool → cache → shard ladder.' },
  { name: 'Redis', path: '/ddia/components/redis', color: '#e5533b', desc: 'One CPU core, memory ceilings, eviction, cluster hash slots, and the hot-key problem.' },
  { name: 'Web / App tier', path: '/ddia/components/web', color: '#3987e5', desc: "Stateless clones behind a balancer. Little's Law and connection fan-out." },
  { name: 'RabbitMQ', path: '/ddia/components/rabbitmq', color: '#0f9fc2', desc: 'The smart broker: exchanges, prefetch, quorum queues, one core per queue.' },
  { name: 'S3 / Object store', path: '/ddia/components/s3', color: '#1aa46e', desc: 'Per-prefix request limits, the latency floor, and the cost shape.' },
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
            <Link className="gn-btn primary" to="/ddia/read">
              ▶ Read the ideas
            </Link>
            <Link className="gn-btn" to="/ddia/components">
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
          <Link className="gn-lens gap box lift" to="/ddia/read" data-obs>
            <span className="ll">Read · new</span>
            <h3>The Ideas</h3>
            <p>
              Partitioning, replication, consensus — each drawn as a short, readable comic. Start with
              consistent hashing and watch a hash ring rebalance one slice of keys, not the whole
              keyspace.
            </p>
          </Link>
          <Link className="gn-lens built box lift" to="/ddia/components" data-obs>
            <span className="ll">Meet · built</span>
            <h3>The Machines</h3>
            <p>
              Kafka, Postgres, Redis, RabbitMQ — one deep-dive each. How the machine works, where it
              breaks, and which ideas it’s assembled from.
            </p>
          </Link>
          <Link className="gn-lens built box lift" to="/ddia/apps" data-obs>
            <span className="ll">Watch · built</span>
            <h3>The Systems</h3>
            <p>
              Whole applications you push until they break. Requests are particles flowing through real
              services; when arrivals outrun capacity, queues stack and nodes glow red.
            </p>
          </Link>
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
            <Link className="gn-btn primary" to="/ddia/read/partitioning">
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
            <Link to="/ddia/read">Read the Ideas</Link> · <Link to="/ddia/components">Deep-Dives</Link> ·{' '}
            <Link to="/ddia/apps">Simulations</Link>
          </span>
        </div>
      </div>
    </div>
  )
}
