import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import { CATALOG } from '../deepdives/catalog'
import '../styles/deepdives.css'
import '../styles/flagship.css'

const BADGE = {
  flagship: { cls: 'badge-flagship', label: 'Flagship deep-dive' },
  classic: { cls: 'badge-classic', label: 'Classic' },
  planned: { cls: 'badge-planned', label: 'Planned' },
}

export default function ComponentsCatalog() {
  const flagship = CATALOG.filter((c) => c.status === 'flagship')
  const classic = CATALOG.filter((c) => c.status === 'classic')
  const planned = CATALOG.filter((c) => c.status === 'planned')

  return (
    <div className="dd-page">
      <SiteNav />
      <main className="wrap" style={{ paddingTop: 38, paddingBottom: 80 }}>
        <p className="h-kicker">🧩 &nbsp;Component deep-dives</p>
        <h1 className="title">How each piece of infrastructure really works</h1>
        <p className="lede">
          One deep-dive per building block, structured the way understanding actually builds:{' '}
          <b>the core abstraction → the anatomy of a single instance → the hardware it consumes →
          scaling up → scaling out → the boundaries</b> — grounded in the primary sources.
          Flagship pages get the full treatment with animated request traces; classic pages carry
          the interactive sandboxes until their redesign lands.
        </p>

        <div className="cat-grid">
          {flagship.map((c) => (
            <Link className="cat-card flagship" to={`/components/${c.key}`} key={c.key}>
              <span className={`badge ${BADGE[c.status].cls}`}>{BADGE[c.status].label}</span>
              <h3>
                <span>{c.emoji}</span> {c.name}
              </h3>
              <p>{c.desc}</p>
            </Link>
          ))}
          {classic.map((c) => (
            <Link className="cat-card" to={`/components/${c.key}`} key={c.key}>
              <span className={`badge ${BADGE[c.status].cls}`}>{BADGE[c.status].label}</span>
              <h3>
                <span>{c.emoji}</span> {c.name}
              </h3>
              <p>{c.desc}</p>
            </Link>
          ))}
          <Link className="cat-card" to="/components/calculator">
            <span className="badge badge-classic">Tool</span>
            <h3>
              <span>🧮</span> Capacity calculator
            </h3>
            <p>Describe one workload and size every tier together — with the first bottleneck flagged and a 12-month growth projection.</p>
          </Link>
        </div>

        <p className="cat-sec">On the roadmap — built from the papers</p>
        <div className="cat-grid">
          {planned.map((c) => (
            <div className="cat-card planned" key={c.key}>
              <span className={`badge ${BADGE[c.status].cls}`}>{BADGE[c.status].label}</span>
              <h3>
                <span>{c.emoji}</span> {c.name}
              </h3>
              <p>{c.desc}</p>
              {c.paper && <span className="paper-tag">📄 {c.paper}</span>}
            </div>
          ))}
        </div>

        <h2 style={{ marginTop: 52 }}>The one idea to carry into every page</h2>
        <p>
          Scaling out is easy for <em>stateless</em> work and hard for <em>stateful</em> work. The
          entire architecture of a large system is a series of tricks to turn stateful problems
          back into stateless ones — caches, read replicas, partition keys, sharding, idempotency.
          Watch for that pattern in every component here.
        </p>
        <table className="tbl">
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
      </main>
      <SiteFooter />
    </div>
  )
}
