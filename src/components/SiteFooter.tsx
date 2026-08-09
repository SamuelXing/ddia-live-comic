import { Link } from 'react-router-dom'
import { REPO_URL } from '../site'

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap foot-in">
        <div>
          <b style={{ color: 'var(--ink-2)' }}>DDIA, as a live comic</b> — an unofficial, illustrated
          companion to <i>Designing Data-Intensive Applications</i> (1st edition) by Martin Kleppmann — chapter numbers follow that edition; not affiliated
          with the author or O’Reilly. The simulations are <b style={{ color: 'var(--ink-2)' }}>experimental</b> —
          one plausible design per app, built on order-of-magnitude rules of thumb. Verify against real
          load tests before sizing production.
        </div>
        <div className="foot-links">
          <Link to="/read">Read the Ideas</Link>
          <Link to="/components">Deep-Dives</Link>
          <Link to="/sims/feed">Simulations</Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            Source on GitHub ★
          </a>
        </div>
      </div>
    </footer>
  )
}
