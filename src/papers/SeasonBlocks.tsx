import { Link } from 'react-router-dom'
import { ARC, THREADS } from './season'
import { CHAPTER_BY_SLUG } from './chapters'
import { rich } from '../read/rich'

/* The two blocks the close is made of, as components rather than markup inside
   the chapter, for the same reason every other figure is: a chapter file should
   read as an argument, not as a table.

   They render inside a step's `diagram` slot, which is where DesignIt goes too
   — so the precedent for putting rich HTML there rather than an SVG already
   exists. Both carry .pb-close so .gn-diagram drops to a single column; a
   four-across table squeezed into the 340px figure column is unreadable. */

/** The arc: one act per row, as the move it makes. */
export function ArcTable() {
  return (
    <div className="pb-close">
      <div className="pb-arc">
        {ARC.map((r) => (
          <div className="pb-arc-row" key={r.act}>
            <div className="ac">{r.act}</div>
            <div className="cells">
              <div className="cell">
                <span className="k">the wall</span>
                {r.wall}
              </div>
              <div className="cell gave">
                <span className="k">gave up</span>
                {r.gave}
              </div>
              <div className="cell got">
                <span className="k">got</span>
                {r.got}
              </div>
              <div className="cell cost">
                <span className="k">the bill</span>
                {r.cost}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** The ideas that cross acts without ever owning a chapter. */
export function ThroughLines() {
  return (
    <div className="pb-close">
      <div className="pb-threads">
        {THREADS.map((t) => (
          <div className="pb-thread" key={t.name}>
            <h3>{t.name}</h3>
            <p>{rich(t.body)}</p>
            <div className="gn-seen">
              {t.chapters.map((s) => (
                <Link className="live" to={`/papers/${s}`} key={s}>
                  {CHAPTER_BY_SLUG[s]?.title ?? s} →
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
