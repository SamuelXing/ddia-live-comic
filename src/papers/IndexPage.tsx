import { useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import { BOOK, SEASONS, seasonPath } from './book'
import { ACT_FIGURES } from './actDiagrams'
import { CHAPTER_BY_SLUG } from './chapters'
import { CHAPTER_LINES } from './season'
import { rich } from '../read/rich'
import { SITE_TITLE } from '../routeTitle'

/* ============================================================
   The papers book — cover + season table of contents.
   The whole season is visible from day one, unwritten chapters
   included: the book's spine is the story arc, and the reader
   should see its shape before choosing where to step in.

   Two things sit under the map. Each row carries its chapter's
   one-line argument, so the contents say what a chapter claims
   and not only what it is called. And the foot looks forward to
   the next season — the looking-back is a page of its own, the
   last row of the Epilogue, because a retrospective printed here
   would be scenery rather than something anybody chose to read.
   ============================================================ */

/* One season at a time, and one nav item — the same split the two calculators
   use, for the same reason. Thirteen acts on one page is a scroll nobody
   finishes, and the two seasons ask different questions; putting them
   side by side made the page long without making it clearer. */
export default function PapersIndexPage({ season: seasonN }: { season: number }) {
  const season = SEASONS.find((s) => s.n === seasonN) ?? SEASONS[0]
  useEffect(() => {
    document.title = `${season.label} · ${BOOK.title} · ${SITE_TITLE}`
  }, [season])

  /* reveal-on-scroll for the [data-obs] panels — same contract as the other
     .gn index pages: without this the panels stay at opacity 0 forever */
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
          <div className="gn-kicker">{season.label}</div>
          <h1>{BOOK.title}</h1>
          <p className="dek">{rich(season.dek)}</p>
        </header>

        <nav className="pb-tabs" aria-label="Which season">
          {SEASONS.map((s) => (
            <NavLink
              key={s.n}
              end
              to={seasonPath(s.n)}
              className={({ isActive }) => 'pb-tab' + (isActive ? ' on' : '')}
            >
              Season {s.n}
              <span>{s.label.split(' · ')[1]}</span>
            </NavLink>
          ))}
        </nav>

        <div className="pb-toc">
          {season.acts.map((act) => {
            /* the same world, redrawn under each act's new pressure — the
               shape change carries the plot for anyone who only looks */
            const Figure = act.figure ? ACT_FIGURES[act.figure] : undefined
            return (
            <section className="pb-act box" key={act.act} data-obs>
              <div className="ah">{act.act}</div>
              {act.summary && (
                <div className="pb-actsum">
                  <div className="fig">{Figure && <Figure />}</div>
                  <div className="txt">
                    <p>{act.summary}</p>
                    {act.next && <p className="nx">{act.next}</p>}
                  </div>
                </div>
              )}
              {act.entries.map((e) => {
                const live = e.slug && CHAPTER_BY_SLUG[e.slug]
                return live ? (
                  /* the one-line argument under the title: a contents page that
                     says what each chapter claims, not only what it is called */
                  <Link className="pb-row pb-line" to={`/papers/${e.slug}`} key={e.no + e.title}>
                    <span className="no">{e.no}</span>
                    <span className="tt">
                      {e.title}
                      <em>{CHAPTER_LINES[e.slug as string]}</em>
                    </span>
                    <span className="pp">{e.paper ?? e.note ?? 'interlude'}</span>
                  </Link>
                ) : (
                  <div className={'pb-row soon' + (e.interlude ? ' interlude' : '')} key={e.no + e.title}>
                    <span className="no">{e.no}</span>
                    <span className="tt">{e.title}</span>
                    {e.paper ? <span className="pp">{e.paper}</span> : <span className="badge">interlude</span>}
                  </div>
                )
              })}
            </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
