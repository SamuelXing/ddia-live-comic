import { Link, NavLink } from 'react-router-dom'

export default function SiteNav() {
  return (
    <div className="site-nav">
      <div className="site-nav-in">
        <Link className="brand" to="/" data-keep>
          <span className="mark" /> Scale&nbsp;Lab
        </Link>
        <nav className="nav-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Home
          </NavLink>
          <NavLink to="/components" className={({ isActive }) => (isActive ? 'active' : '')}>
            Component Deep-Dives
          </NavLink>
          <a href="/#apps">App Simulations</a>
        </nav>
        <div className="nav-spacer" />
        <Link className="nav-cta" to="/sims/feed" data-keep>
          ▶ Launch a simulation
        </Link>
      </div>
    </div>
  )
}
