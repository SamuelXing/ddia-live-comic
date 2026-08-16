import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import { BOOK, SEASONS, progressLabel } from '../papers/book'

/* ============================================================
   The bookshelf — the front door of systemscomic.com.
   Each book is an isolated world under its own prefix; this
   page is the shelf they sit on. Books that are still being
   written are shown too: the shelf is a promise of shape, the
   same way a book's table of contents is.
   ============================================================ */

const LIVE_BOOKS = [
  {
    to: '/ddia',
    kicker: 'Book one · complete and growing',
    title: 'DDIA, as a live comic',
    dek: 'Replication, partitioning, consensus — drawn as short comics, then met again inside Kafka, Postgres and Redis, where you can push them until they break.',
    meta: '12 idea comics · 6 deep-dives · 2 simulations',
  },
  {
    to: '/papers',
    kicker: 'Book two · being written',
    title: BOOK.title,
    dek: BOOK.dek,
    /* Both halves derived. This line used to read "· Season 1 · Where Data
       Lives" beside a count of every live chapter in the book, which was fine
       while there was one season and became a lie the moment there were two —
       23 chapters live, sitting next to the name of the season that holds 17
       of them. A shelf card summarises a book, so both facts have to be about
       the whole book. `bookshelf.test.ts` keeps a season name out of here. */
    meta: `${progressLabel()} · ${SEASONS.length} seasons`,
  },
]

const TOOL = {
  to: '/calculator/capacity',
  title: 'The calculator',
  dek: 'Not a book — the napkin math tool the books share. Put in a workload, get machine counts back, and check every number against the division that produced it.',
}

const UPCOMING = [
  { title: 'The Analytical Engine', note: 'one node, taken apart — scaffolded on CMU 15-721' },
  { title: 'AI, from nets to models', note: 'the ideas line, then the machinery' },
  { title: 'Concurrency', note: 'Dijkstra to Rust, one race at a time' },
  { title: 'The Operating System', note: 'xv6, read as literature' },
]

export default function Bookshelf() {
  /* document.title comes from RouteTitle ('/' → the fullTitle fallback) —
     setting it here too just meant two competing spellings of the slogan */
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
      ;(el as HTMLElement).style.transitionDelay = Math.min(i, 4) * 35 + 'ms'
      io.observe(el)
    })
    return () => io.disconnect()
  }, [])

  return (
    <div className="gn">
      <SiteNav />
      <div className="gn-sheet">
        <header className="gn-mast box" data-obs>
          <div className="gn-kicker">Books with working parts</div>
          <h1>systems comic</h1>
          <p className="dek">
            A comic about distributed systems. A story book about the papers behind it. More coming
            — one subject each, all built the same way: <em>read the idea, then push on it until it
            breaks.</em>
          </p>
        </header>

        <div className="bs-shelf">
          {LIVE_BOOKS.map((b) => (
            <Link className="bs-book box lift" to={b.to} key={b.to} data-obs>
              <div className="bk">{b.kicker}</div>
              <h2>{b.title}</h2>
              <p>{b.dek}</p>
              <div className="bm">{b.meta} →</div>
            </Link>
          ))}
        </div>

        <Link className="bs-tool box lift" to={TOOL.to} data-obs>
          <div className="bk">Shared instrument</div>
          <h2>{TOOL.title}</h2>
          <p>{TOOL.dek}</p>
        </Link>

        <section className="bs-upcoming box" data-obs>
          <div className="bk">On the shelf next — in the order the questions arrived</div>
          <div className="rows">
            {UPCOMING.map((u) => (
              <div className="row" key={u.title}>
                <span className="tt">{u.title}</span>
                <span className="nn">{u.note}</span>
              </div>
            ))}
          </div>
        </section>

        {/* The shelf had no footer at all, which meant the front door of the
            site carried no disclaimer — and book one is a companion to
            somebody else's book. It also never expanded "DDIA", so a visitor
            who does not already know the acronym got no help on the page most
            likely to be their first. One line does both jobs. */}
        <div className="gn-foot">
          <span>
            Book one is an unofficial companion to{' '}
            <a href="https://dataintensive.net" target="_blank" rel="noreferrer">
              Designing Data-Intensive Applications
            </a>{' '}
            by Martin Kleppmann — not affiliated with the author or O’Reilly.
          </span>
          <span>Everything here is drawn and written from the ideas, not from the text.</span>
        </div>
      </div>
    </div>
  )
}
