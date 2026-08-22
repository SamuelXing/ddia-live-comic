import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import { SITE_TITLE } from '../routeTitle'
import { BOOK, TOC, MODE_LABEL, progressLabel } from './book'

/**
 * The contents page, and for now the whole book. Nothing is written; every row
 * is a hole with a name on it.
 *
 * That is deliberate and it is book B's precedent: its season map was on the
 * page from day one, which made the shape arguable while the shape was still
 * cheap to change, and made the gaps visible rather than implied. A private
 * plan gets agreed with nobody.
 *
 * The one thing this page does that book B's does not is print what each act
 * READS. Book B never had to, because the answer was always "a paper". Here it
 * is a paper for five chapters and the API or the source for the rest, and a
 * reader who assumes otherwise will go hunting for a citation that does not
 * exist.
 */
export default function K8sIndexPage() {
  useEffect(() => {
    document.title = `${BOOK.title} · ${SITE_TITLE}`
  }, [])

  return (
    <div className="gn">
      <SiteNav />
      <div className="gn-sheet">
        <header className="gn-mast box">
          <div className="gn-kicker">Book three · just started</div>
          <h1>{BOOK.title}</h1>
          <p className="dek">{BOOK.dek}</p>
          <p className="pb-howto">
            Kubernetes has no DDIA — no single volume that takes a competent engineer to the far side. What it has
            instead is unusual: <b>its designers published their reasoning</b>, including a section on what they would
            not do again. This book reads that first, and then reads the parts nobody wrote a paper about.
          </p>
          <div className="gn-tags">
            <span className="gn-tag">{progressLabel()}</span>
          </div>
        </header>

        <main className="gn-page">
          {TOC.map((act) => (
            <section key={act.act} className="gn-panel box lift gn-span2">
              <div className="head">
                <span className="ht">{act.act}</span>
                <span className="gn-tag">{MODE_LABEL[act.mode]}</span>
              </div>
              <div className="gn-prose">
                <p>{act.summary}</p>
              </div>
              <ul className="k8-toc">
                {act.entries.map((e) => (
                  <li key={e.no + e.title} className={(e.slug ? 'live' : 'soon') + (e.interlude ? ' interlude' : '')}>
                    <span className="no">{e.no}</span>
                    {e.slug ? (
                      <Link to={'/k8s/' + e.slug}>{e.title}</Link>
                    ) : (
                      <span className="t">{e.title}</span>
                    )}
                    <span className="reads">{e.reads}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <div className="gn-next">
            <span>
              Unofficial, and not affiliated with the Kubernetes project, the CNCF or Google. The three papers it reads
              are cited in full where each chapter reads them.
            </span>
            <Link to="/">← the bookshelf</Link>
          </div>
        </main>
      </div>
    </div>
  )
}
