import { Link } from 'react-router-dom'

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap foot-in">
        <div>
          <b style={{ color: 'var(--ink-2)' }}>Scale Lab</b> — an interactive systems-design
          teaching tool. Numbers are order-of-magnitude engineering rules of thumb; verify against
          real load tests before sizing production.
        </div>
        <div className="foot-links">
          <Link to="/">Home</Link>
          <Link to="/components">Deep-Dives</Link>
          <Link to="/sims/feed">Feed at Scale</Link>
        </div>
      </div>
    </footer>
  )
}
