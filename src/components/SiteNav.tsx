import { Link, NavLink } from 'react-router-dom'

export default function SiteNav() {
  return (
    <div className="site-nav">
      <div className="site-nav-in">
        <Link className="brand" to="/" data-keep>
          <span className="mark" /> DDIA
          <span style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--muted)', fontSize: '0.8em', marginLeft: 4 }}>
            , as a live comic
          </span>
        </Link>
        <nav className="nav-links">
          <NavLink to="/read" className={({ isActive }) => (isActive ? 'active' : '')}>
            Read the Ideas
          </NavLink>
          <NavLink to="/components" className={({ isActive }) => (isActive ? 'active' : '')}>
            Component Deep-Dives
          </NavLink>
          <a href="/#apps">App Simulations</a>
        </nav>
        <div className="nav-spacer" />
        <Link className="nav-cta" to="/read" data-keep>
          ▶ Read the ideas
        </Link>
      </div>
    </div>
  )
}
