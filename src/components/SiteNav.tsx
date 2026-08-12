import { Link, NavLink, useLocation } from 'react-router-dom'
import { REPO_URL } from '../site'

/** The GitHub mark (Octicon `mark-github`, 16px), inlined rather than fetched
 *  so the nav never waits on a network request to finish drawing itself. */
function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

const linkClass = ({ isActive }: { isActive: boolean }) => 'gn-link' + (isActive ? ' active' : '')

/** The DDIA book's three sections. Each is its own world once you are inside
 *  it, so the only nav link a section offers is the way back up its own
 *  index — never a jump sideways into one of the others. */
const DDIA_SECTIONS = [
  { at: '/ddia/read', back: '← All ideas' },
  { at: '/ddia/components', back: '← All deep-dives' },
  { at: '/ddia/apps', back: '← All simulations' },
]

/**
 * The one navigation bar — but every book, tool and section is an isolated
 * world, so the bar changes identity with the path: its brand is that world's
 * wordmark (and the way to its home), and it offers exactly one link, back up
 * one level. Nothing cross-links sideways.
 *
 * Which means the hubs do the connecting: the bookshelf at `/` is where the
 * books meet, and `/ddia` is where its three sections meet. A reader inside a
 * comic is reading a comic, not choosing between three products.
 */
export default function SiteNav() {
  const path = useLocation().pathname
  const section = path.startsWith('/ddia')
    ? 'ddia'
    : path.startsWith('/papers')
      ? 'papers'
      : path.startsWith('/calculator')
        ? 'calc'
        : 'shelf'
  /* only once you are *below* a section index — on the index itself the brand
     is already the way up */
  const ddiaBack = DDIA_SECTIONS.find((s) => path.startsWith(s.at + '/'))

  return (
    <nav className="gn-nav">
      <div className="gn-nav-in">
        {section === 'ddia' && (
          <Link className="gn-brand" to="/ddia">
            <b>DDIA</b>
            <span className="tl">, as a live comic</span>
          </Link>
        )}
        {section === 'papers' && (
          <Link className="gn-brand" to="/papers">
            <b>The Papers</b>
            <span className="tl">, that broke the database</span>
          </Link>
        )}
        {section === 'calc' && (
          <Link className="gn-brand" to="/calculator">
            <b>Calculator</b>
            <span className="tl">, for doing napkin math</span>
          </Link>
        )}
        {section === 'shelf' && (
          <Link className="gn-brand" to="/">
            <b>systems</b>
            <span className="tl"> comic — the bookshelf</span>
          </Link>
        )}
        <span className="sp" />
        {section === 'ddia' && ddiaBack && (
          <NavLink className={linkClass} to={ddiaBack.at} end>
            {ddiaBack.back}
          </NavLink>
        )}
        {section === 'papers' && path !== '/papers' && (
          <NavLink className={linkClass} to="/papers" end>
            ← All chapters
          </NavLink>
        )}
        <a
          className="gn-link gn-gh"
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          title="Star this project on GitHub"
        >
          <GitHubMark />
          <span className="lbl">Star</span>
        </a>
      </div>
    </nav>
  )
}
