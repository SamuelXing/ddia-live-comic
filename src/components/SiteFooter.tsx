import { Link } from 'react-router-dom'

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap foot-in">
        <div>
          <b style={{ color: 'var(--ink-2)' }}>DDIA, as a live comic</b> — an unofficial, illustrated
          companion to <i>Designing Data-Intensive Applications</i> by Martin Kleppmann; not affiliated
          with the author or O’Reilly. The <b style={{ color: 'var(--ink-2)' }}>Scale Lab</b> simulations
          use order-of-magnitude engineering rules of thumb; verify against real load tests before sizing
          production.
        </div>
        <div className="foot-links">
          <Link to="/read">Read the Ideas</Link>
          <Link to="/components">Deep-Dives</Link>
          <Link to="/sims/feed">Simulations</Link>
        </div>
      </div>
    </footer>
  )
}
