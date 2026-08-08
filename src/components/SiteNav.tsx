import { Link, NavLink } from 'react-router-dom'

/**
 * The one navigation bar, shared by every page (home, idea index, component
 * deep-dives, sims catalog, 404). Comic chrome, self-contained styling so it
 * looks identical on paper pages and token-flipped pages. The wordmark is
 * always the way home; the active section is highlighted.
 */
const linkClass = ({ isActive }: { isActive: boolean }) => 'gn-link' + (isActive ? ' active' : '')

export default function SiteNav() {
  return (
    <nav className="gn-nav">
      <div className="gn-nav-in">
        <Link className="gn-brand" to="/">
          <b>DDIA</b>
          <span className="tl">, as a live comic</span>
        </Link>
        <span className="sp" />
        <NavLink className={linkClass} to="/read">
          Read the Ideas
        </NavLink>
        <NavLink className={linkClass} to="/components">
          Deep-Dives
        </NavLink>
        <a className="gn-link" href="/#apps">
          Simulations
        </a>
      </div>
    </nav>
  )
}
