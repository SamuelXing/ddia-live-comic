import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import { BOOK, TOC } from './book'
import { ACT_FIGURES } from './actDiagrams'
import { CHAPTER_BY_SLUG } from './chapters'
import { SITE_TITLE } from '../routeTitle'

/* ============================================================
   The papers book — cover + season table of contents.
   The whole season is visible from day one, unwritten chapters
   included: the book's spine is the story arc, and the reader
   should see its shape before choosing where to step in.
   ============================================================ */

export default function PapersIndexPage() {
  useEffect(() => {
    document.title = `${BOOK.title} · ${SITE_TITLE}`
  }, [])

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
          <div className="gn-kicker">{BOOK.season}</div>
          <h1>{BOOK.title}</h1>
          <p className="dek">{BOOK.dek}</p>
          <div className="gn-tags">
            <span className="gn-tag">1 of 18 chapters live</span>
            <span className="gn-tag">Each chapter · one paper</span>
          </div>
        </header>

        <div className="pb-toc">
          {TOC.map((act) => {
            /* the same world, redrawn under each act's new pressure — the
               shape change carries the plot for anyone who only looks */
            const Figure = ACT_FIGURES[act.figure]
            return (
            <section className="pb-act box" key={act.act} data-obs>
              <div className="ah">{act.act}</div>
              <div className="pb-actsum">
                <div className="fig">{Figure && <Figure />}</div>
                <div className="txt">
                  <p>{act.summary}</p>
                  <p className="nx">{act.next}</p>
                </div>
              </div>
              {act.entries.map((e) => {
                const live = e.slug && CHAPTER_BY_SLUG[e.slug]
                return live ? (
                  <Link className="pb-row" to={`/papers/${e.slug}`} key={e.no + e.title}>
                    <span className="no">{e.no}</span>
                    <span className="tt">{e.title}</span>
                    <span className="pp">{e.paper}</span>
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
