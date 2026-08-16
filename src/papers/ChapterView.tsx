import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { Chapter } from './types'
import { BOOK, seasonOfAct } from './book'
import { Panel } from '../read/Comic'
import { rich } from '../read/rich'
import SiteNav from '../components/SiteNav'

/* ============================================================
   ChapterView — the papers book's reading page. Same graphic-
   novel skin and panel anatomy as an idea comic (the Panel
   implementation is shared), different masthead: this book's
   brand, the act it belongs to, and the citation card — the
   paper is the answer key, so it is displayed like one.
   ============================================================ */

export default function ChapterView({ chapter }: { chapter: Chapter }) {
  /* Derived, never stored on the chapter: a season is a property of the act,
     and a chapter that carried its own copy could disagree with the contents
     page about which season it is in. */
  const season = seasonOfAct(chapter.act)
  useEffect(() => {
    document.title = `${chapter.title} · ${chapter.paperNo} · ${BOOK.title}`
  }, [chapter])

  const barRef = useRef<HTMLElement | null>(null)

  /* Same scroll-progress + reveal-on-scroll behavior as ComicView. */
  useEffect(() => {
    const bar = barRef.current
    const onScroll = () => {
      const h = document.documentElement
      const max = h.scrollHeight - h.clientHeight
      if (bar) bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%'
    }
    document.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const nodes = Array.from(document.querySelectorAll('.gn [data-obs]'))
    let io: IntersectionObserver | null = null
    if (!reduce && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (es) => {
          for (const e of es)
            if (e.isIntersecting) {
              e.target.classList.add('in')
              io!.unobserve(e.target)
            }
        },
        { threshold: 0.15, rootMargin: '0px 0px -6% 0px' },
      )
      nodes.forEach((el, i) => {
        ;(el as HTMLElement).style.transitionDelay = Math.min(i, 4) * 35 + 'ms'
        io!.observe(el)
      })
    } else {
      nodes.forEach((el) => el.classList.add('in'))
    }
    return () => {
      document.removeEventListener('scroll', onScroll)
      io?.disconnect()
    }
  }, [chapter.slug])

  return (
    <div className="gn">
      <div className="gn-progress" aria-hidden="true">
        <i ref={barRef} />
      </div>

      <SiteNav />

      <div className="gn-sheet">
        <header className="gn-mast box" data-obs>
          <div className="gn-kicker">
            {season?.label ?? BOOK.title} · {chapter.act}
          </div>
          <h1>{chapter.title}</h1>
          <p className="dek">{chapter.dek}</p>
          <div className="gn-tags">
            <span className="gn-tag">Reading time · {chapter.minutes} min</span>
            <span className="gn-tag">{chapter.paperNo}</span>
            {chapter.paper && (
              <span className="gn-tag">
                {chapter.paper.venue} {chapter.paper.year}
              </span>
            )}
          </div>
        </header>

        {/* The citation card — the answer key, displayed like one. An interlude
            has no answer key: it names a pattern the chapters around it keep
            using rather than re-deriving one paper, so the card is absent and
            the cold open starts immediately. */}
        {chapter.paper && (
          <aside className="gn-cite box" data-obs>
            <div className="cl">The paper</div>
            <a className="ct" href={chapter.paper.url} target="_blank" rel="noreferrer">
              {chapter.paper.title}
            </a>
            <div className="ca">
              {chapter.paper.authors} — {chapter.paper.venue} {chapter.paper.year}
            </div>
          </aside>
        )}

        <main className="gn-page">
          <section className="gn-caption" data-obs>
            <div className="nl">Cold open</div>
            <p>{rich(chapter.caption)}</p>
          </section>

          {chapter.steps.map((s, i) => (
            <Panel key={i} step={s} />
          ))}

          {chapter.inTheWild && (
            <details className="gn-wild gn-span2" data-obs>
              <summary>
                <span className="tag">In the wild</span>
                <span className="lead">{chapter.inTheWild.note ?? 'where the clean idea gets complicated'}</span>
                <span className="chev">▸</span>
              </summary>
              <ul>
                {chapter.inTheWild.points.map((p, i) => {
                  const pt = typeof p === 'string' ? { t: p, figure: undefined } : p
                  return (
                    <li key={i}>
                      {rich(pt.t)}
                      {pt.figure && <div className="gn-wild-fig">{pt.figure}</div>}
                    </li>
                  )
                })}
              </ul>
            </details>
          )}

          {chapter.tradeoffs && (
            <details className="gn-tradeoffs gn-span2" data-obs>
              <summary>
                <span className="tag">The call</span>
                <span className="lead">{chapter.tradeoffs.title ?? 'when to reach for which'}</span>
                <span className="chev">▸</span>
              </summary>
              <div className="gn-to-rows">
                {chapter.tradeoffs.rows.map((r, i) => (
                  <div className="gn-to-row" key={i}>
                    <span className="choose">{rich(r.choose)}</span>
                    <span className="when">{rich(r.when)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {chapter.misconception && (
            <div className="gn-misc gn-span2" data-obs>
              <div className="ml">You might think&hellip;</div>
              <div className="think">{rich(chapter.misconception.think)}</div>
              <div className="actually">{rich(chapter.misconception.actually)}</div>
            </div>
          )}

          {/* Bubble bodies go through rich(), like every other prose field.
              The nesting sweep in rich.test.ts already treated them as prose;
              the renderer did not — the same shape as the sources[].note bug,
              a field that was prose in practice long before it was prose in
              code. Nothing already written used markup here, so this changed
              no existing page; it changed what the next author can write. */}
          {chapter.bubbles && chapter.bubbles.length > 0 && (
            <aside className="gn-bubbles gn-span2" data-obs>
              {chapter.bubbles.map((b, i) => (
                <div className="gn-bubble" key={i}>
                  <span className="term">{b.term}</span> {rich(b.body)}
                </div>
              ))}
            </aside>
          )}

          {chapter.sources && chapter.sources.length > 0 && (
            <div className="gn-sources gn-span2" data-obs>
              <div className="sl">Re-reading the originals — what is worth your evening</div>
              {chapter.sources.map((s, i) => (
                <div className="gn-src" key={i}>
                  <span className="yr">{s.year ?? '·'}</span>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.title}
                    </a>
                  ) : (
                    <span className="t">{s.title}</span>
                  )}
                  {/* through rich(), like every other prose field. Three
                      chapters had already written **bold** in a note and been
                      rendering the asterisks — the field was prose in practice
                      long before it was prose in code. */}
                  {s.note && <span className="c">{rich(s.note)}</span>}
                </div>
              ))}
            </div>
          )}

          <section className="gn-continue gn-span2" data-obs>
            <div className="k">↓ See the idea living in a real machine</div>
            <h3>{chapter.finale.title}</h3>
            <p>{rich(chapter.finale.body)}</p>
            <div className="rungs">
              {chapter.seenIn.map((s, i) =>
                s.to ? (
                  <Link key={i} className={s.live ? 'live' : ''} to={s.to}>
                    {s.label} →
                  </Link>
                ) : (
                  <span key={i}>
                    {s.label}
                    {s.note ? ` (${s.note})` : ''}
                  </span>
                ),
              )}
            </div>
          </section>

          <div className="gn-next">
            <span>
              {BOOK.title} — {season?.label}
            </span>
            {chapter.next &&
              (chapter.next.slug ? (
                <Link to={'/papers/' + chapter.next.slug}>Next: {chapter.next.title} →</Link>
              ) : (
                <span className="pb-unwritten">Next: {chapter.next.title} — being drawn</span>
              ))}
          </div>
        </main>
      </div>
    </div>
  )
}
