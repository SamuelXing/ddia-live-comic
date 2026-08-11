import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { Comic, CodeBlock as CodeBlockT, Step } from './types'
import { rich } from './rich'
import { SITE_TITLE } from '../routeTitle'

// self-hosted fonts (no runtime network dependency)

/** render one code line, colouring text after `#` as a comment */
function codeLine(t: string) {
  const hash = t.indexOf('#')
  if (hash < 0) return t
  return (
    <>
      {t.slice(0, hash)}
      <span className="cm">{t.slice(hash)}</span>
    </>
  )
}

function CodeBlock({ code }: { code: CodeBlockT }) {
  return (
    <div className="gn-code">
      <div className="bar">
        <i />
        <span className="fn">{code.file}</span>
      </div>
      <pre>
        {code.lines.map((l, i) => (
          <span key={i} className={'ln' + (l.hl === 'good' ? ' hl-good' : l.hl === 'bad' ? ' hl-bad' : '')}>
            {codeLine(l.t)}
            {'\n'}
          </span>
        ))}
      </pre>
    </div>
  )
}

function DeeperAside({ d }: { d: NonNullable<Step['deeper']> }) {
  return (
    <details className="gn-deeper">
      <summary>
        <span className="chev">▸</span>
        <span className="tag">{d.tag ?? 'Go deeper'}</span>
        {d.summary}
      </summary>
      <div className="gn-deeper-body">
        {d.body?.map((p, i) => (
          <p key={i}>{rich(p)}</p>
        ))}
        {d.figure && <div className="gn-deeper-fig">{d.figure}</div>}
        {d.code && <CodeBlock code={d.code} />}
      </div>
    </details>
  )
}

function ThinkPrompt({ t }: { t: NonNullable<Step['think']> }) {
  return (
    <details className="gn-think">
      <summary>
        <span className="tag">Think it through</span>
        <span className="q">{rich(t.q)}</span>
        <span className="chev">Reveal ▸</span>
      </summary>
      <div className="gn-think-a">{rich(t.a)}</div>
    </details>
  )
}

function Panel({ step }: { step: Step }) {
  const wide = step.span === 2 || !!step.diagram
  const accent = step.accent && step.accent !== 'ink' ? ' ' + step.accent : ''
  const body = (
    <>
      {step.body?.map((p, i) => <p key={i}>{rich(p)}</p>)}
      {step.code && <CodeBlock code={step.code} />}
      {step.callout && (
        <div className={'gn-callout ' + (step.callout.kind === 'good' ? 'good' : 'bad')}>
          <span className="big">{step.callout.big}</span>
          <span className="t">{rich(step.callout.text)}</span>
        </div>
      )}
    </>
  )
  return (
    <article className={'gn-panel box lift' + accent + (wide ? ' gn-span2' : '')} data-obs>
      {step.rung && <div className="gn-layertag">{step.rung}</div>}
      <div className="head">
        <span className="gn-step">{step.n}</span>
        <span className="ht">{step.title}</span>
      </div>
      {step.diagram ? (
        <div className="gn-diagram">
          <div>{body}</div>
          {step.diagram}
        </div>
      ) : (
        body
      )}
      {step.deeper && <DeeperAside d={step.deeper} />}
      {step.think && <ThinkPrompt t={step.think} />}
    </article>
  )
}

export default function ComicView({ comic }: { comic: Comic }) {
  /* The comic titles the tab, because it already holds the comic — doing it in
     App's route table would mean importing every comic into the eager chunk.
     Sharing reads document.title, so this is what labels a shared link. */
  useEffect(() => {
    document.title = `${comic.title} · ${comic.chapterNo} · ${SITE_TITLE}`
  }, [comic])

  const barRef = useRef<HTMLElement | null>(null)

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
  }, [comic.slug])

  return (
    <div className="gn">
      <div className="gn-progress" aria-hidden="true">
        <i ref={barRef} />
      </div>

      <nav className="gn-nav">
        <div className="gn-nav-in">
          <Link className="gn-brand" to="/">
            <b>DDIA</b>
            <span className="tl">, as a live comic</span>
          </Link>
          <span className="sp" />
          <Link className="gn-link" to="/read">
            ← All ideas
          </Link>
        </div>
      </nav>

      <div className="gn-sheet">
        <header className="gn-mast box" data-obs>
          <div className="gn-kicker">Inspired by DDIA, 1st ed. · {comic.chapter}</div>
          <h1>{comic.title}</h1>
          <p className="dek">{comic.dek}</p>
          <div className="gn-tags">
            <span className="gn-tag">Reading time · {comic.minutes} min</span>
            <span className="gn-tag">{comic.chapterNo}</span>
          </div>
        </header>

        <main className="gn-page">
          <section className="gn-caption" data-obs>
            <div className="nl">Narration</div>
            <p>{rich(comic.caption)}</p>
          </section>

          {comic.steps.map((s, i) => (
            <Panel key={i} step={s} />
          ))}

          {comic.inTheWild && (
            <details className="gn-wild gn-span2" data-obs>
              <summary>
                <span className="tag">In the wild</span>
                <span className="lead">{comic.inTheWild.note ?? 'where the clean idea gets complicated'}</span>
                <span className="chev">▸</span>
              </summary>
              <ul>
                {comic.inTheWild.points.map((p, i) => {
                  /* A bullet is either prose or prose plus a figure. Normalising
                     here rather than at every call site keeps the 40-odd bullets
                     that are pure prose written as plain strings. */
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

          {comic.tradeoffs && (
            <details className="gn-tradeoffs gn-span2" data-obs>
              <summary>
                <span className="tag">The call</span>
                <span className="lead">{comic.tradeoffs.title ?? 'when to reach for which'}</span>
                <span className="chev">▸</span>
              </summary>
              <div className="gn-to-rows">
                {comic.tradeoffs.rows.map((r, i) => (
                  <div className="gn-to-row" key={i}>
                    <span className="choose">{rich(r.choose)}</span>
                    <span className="when">{rich(r.when)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {comic.misconception && (
            <div className="gn-misc gn-span2" data-obs>
              <div className="ml">You might think&hellip;</div>
              <div className="think">{rich(comic.misconception.think)}</div>
              <div className="actually">{rich(comic.misconception.actually)}</div>
            </div>
          )}

          {comic.bubbles && comic.bubbles.length > 0 && (
            <aside className="gn-bubbles gn-span2" data-obs>
              {comic.bubbles.map((b, i) => (
                <div className="gn-bubble" key={i}>
                  <span className="term">{b.term}</span> {b.body}
                </div>
              ))}
            </aside>
          )}

          {comic.sources && comic.sources.length > 0 && (
            <div className="gn-sources gn-span2" data-obs>
              <div className="sl">Primary sources — dive as deep as you like</div>
              {comic.sources.map((s, i) => (
                <div className="gn-src" key={i}>
                  <span className="yr">{s.year ?? '·'}</span>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.title}
                    </a>
                  ) : (
                    <span className="t">{s.title}</span>
                  )}
                  {s.note && <span className="c">{s.note}</span>}
                </div>
              ))}
            </div>
          )}

          <section className="gn-continue gn-span2" data-obs>
            <div className="k">↓ Continue deeper — see it in a real machine</div>
            <h3>{comic.finale.title}</h3>
            <p>{rich(comic.finale.body)}</p>
            <div className="rungs">
              {comic.seenIn.map((s, i) =>
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
            <span>DDIA, as a live comic — inspired by the book by Martin Kleppmann</span>
            {comic.next && <Link to={'/read/' + comic.next.slug}>Next: {comic.next.title} →</Link>}
          </div>
        </main>
      </div>
    </div>
  )
}
