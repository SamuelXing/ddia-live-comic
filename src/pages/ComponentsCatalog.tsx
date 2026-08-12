import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import { CATALOG } from '../deepdives/catalog'
import type { CatalogEntry } from '../deepdives/catalog'

const live = CATALOG.filter((c) => c.status !== 'planned')
const planned = CATALOG.filter((c) => c.status === 'planned')

/** A built, clickable component. Full deep-dive vs. lighter sandbox is the only
 *  distinction, shown as one small inline tag — never a floating pill. */
function LiveCard({ c }: { c: CatalogEntry }) {
  const full = c.status === 'flagship'
  return (
    <Link className="gn-cat box lift" to={`/components/${c.key}`}>
      <div className="gn-cat-top">
        <span className="dot" style={{ background: c.color }} />
        <h3>{c.name}</h3>
      </div>
      <p>{c.desc}</p>
      <div className="gn-cat-foot">
        <span className={'gn-cat-tag' + (full ? ' full' : '')}>{full ? 'Full deep-dive' : 'Sandbox'}</span>
        <span className="go">Read →</span>
      </div>
    </Link>
  )
}

export default function ComponentsCatalog() {
  return (
    <div className="gn">
      <SiteNav />

      <div className="gn-sheet">
        <header className="gn-mast box">
          <div className="gn-kicker">Component deep-dives</div>
          <h1>How each piece of infrastructure really works</h1>
          <p className="dek">
            One deep-dive per building block: the core idea, the anatomy of a single instance, the
            hardware it burns through, and where it breaks — grounded in the primary sources.
          </p>
        </header>

        <div className="gn-sechead">
          <div className="eb">Live · read now</div>
          <h2>The machines, taken apart</h2>
        </div>
        <div className="gn-cat-grid">
          {live.map((c) => (
            <LiveCard c={c} key={c.key} />
          ))}
        </div>

        <div className="gn-sechead">
          <div className="eb">Roadmap</div>
          <h2>Built from the papers, next</h2>
        </div>
        <div className="gn-cat-grid">
          {planned.map((c) => (
            <div className="gn-cat gn-cat--soon" key={c.key}>
              <div className="gn-cat-top">
                <span className="dot" style={{ background: c.color }} />
                <h3>{c.name}</h3>
              </div>
              <p>{c.desc}</p>
              <div className="gn-cat-foot">
                {c.paper ? <span className="paper">{c.paper}</span> : <span />}
                <span className="gn-cat-tag soon">Planned</span>
              </div>
            </div>
          ))}
        </div>

        <div className="gn-sechead">
          <div className="eb">The through-line</div>
          <h2>The one idea to carry into every page</h2>
          <p>
            Scaling out is easy for <em>stateless</em> work and hard for <em>stateful</em> work. The
            whole architecture of a large system is a series of tricks to turn stateful problems back
            into stateless ones — caches, read replicas, partition keys, sharding, idempotency. Watch
            for that move in every component here.
          </p>
        </div>
        <div className="gn-tbl-wrap">
          <table className="gn-tbl">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Scales by</th>
                <th>The wall you hit first</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Web / app tier</td><td>Cloning stateless instances</td><td>The shared thing behind it — usually the database</td></tr>
              <tr><td>Kafka</td><td>Partitions across brokers</td><td>Consumer parallelism capped by partition count; NIC bandwidth</td></tr>
              <tr><td>RabbitMQ</td><td>Sharding into more queues</td><td>One core per queue; memory flow-control</td></tr>
              <tr><td>Redis</td><td>Replicas, then Cluster shards</td><td>One CPU core; RAM ceiling; hot keys</td></tr>
              <tr><td>Postgres</td><td>Up, then replicas, then shards</td><td>Single writable primary; connection count</td></tr>
              <tr><td>S3</td><td>Automatic (managed)</td><td>Request rate per key prefix; latency floor</td></tr>
            </tbody>
          </table>
        </div>

        <div className="gn-foot">
          <span>
            DDIA, as a live comic — an unofficial, illustrated companion to <em>Designing
            Data-Intensive Applications</em> by Martin Kleppmann. Not affiliated with the author or
            O’Reilly.
          </span>
          <span>
            <Link to="/ddia/read">Read the Ideas</Link> · <Link to="/ddia/components">Deep-Dives</Link> ·{' '}
            <Link to="/ddia/sims/feed">Simulations</Link>
          </span>
        </div>
      </div>
    </div>
  )
}
