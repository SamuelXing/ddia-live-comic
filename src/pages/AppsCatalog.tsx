import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import ThumbCanvas from '../components/ThumbCanvas'
import { SIMS, STATUS_META } from '../sims/registry'

/* ============================================================
   The simulations index — /ddia/apps.
   This was a `#apps` anchor halfway down the DDIA home, which
   meant the one section people are sent to most often had no
   URL of its own: it could not be linked, previewed, or titled,
   and arriving at it dumped you into the middle of another page.
   It is a section of the book now, like the ideas and the
   deep-dives, and reachable the same way — from /ddia.
   ============================================================ */

export default function AppsCatalog() {
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
      ;(el as HTMLElement).style.transitionDelay = Math.min(i, 5) * 30 + 'ms'
      io.observe(el)
    })
    return () => io.disconnect()
  }, [])

  return (
    <div className="gn">
      <SiteNav />

      <div className="gn-sheet">
        <header className="gn-mast box" data-obs>
          <div className="gn-kicker">Application simulations · experimental</div>
          <h1>Pick an app and push it until it breaks</h1>
          <p className="dek">
            Each simulation uses the same queueing engine — a different topology, a different workload, a
            different set of walls. These are <em>sketches, not reference architectures</em>: one plausible
            design per app, and a different team with different constraints would draw it differently. Use
            them to build intuition about where things break, not to size anything real.
          </p>
        </header>

        <div className="gn-gallery">
          {SIMS.map((a) => {
            const meta = STATUS_META[a.status]
            const inner = (
              <>
                <div className="thumb">
                  <span className={`status ${meta.cls}`}>{meta.label}</span>
                  <ThumbCanvas accent={a.accent} />
                </div>
                <div className="b">
                  <h3>
                    <span className="em">{a.emoji}</span>
                    {a.name}
                  </h3>
                  <p className="desc">{a.desc}</p>
                  <div className="tags">
                    {a.tags.map((t) => (
                      <span className="tag" key={t}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="foot">{meta.foot}</div>
                </div>
              </>
            )
            return a.status === 'live' && a.path ? (
              <Link className="gn-appcard box lift" to={a.path} key={a.id} data-obs>
                {inner}
              </Link>
            ) : (
              <div className="gn-appcard box soon" key={a.id} data-obs>
                {inner}
              </div>
            )
          })}
        </div>

        {/* ---- how a simulation works ---- */}
        <div className="gn-sechead" data-obs>
          <div className="eb">How a simulation works</div>
          <h2>Not a cartoon — a real queueing model</h2>
        </div>
        <div className="gn-hiw">
          <div className="gn-hstep box lift" data-obs>
            <div className="n">1</div>
            <h4>Every node is a queue</h4>
            <p>
              Each service and datastore has a fixed number of concurrent service slots and a service
              time. Throughput ceiling = slots ÷ service time — the same M/M/c intuition, made visible.
            </p>
          </div>
          <div className="gn-hstep box lift" data-obs>
            <div className="n">2</div>
            <h4>Requests are particles</h4>
            <p>
              Reads, posts, likes and uploads flow along real routes. When arrivals outrun a node’s
              slots, its queue physically stacks up and latency climbs — no hand-waving.
            </p>
          </div>
          <div className="gn-hstep box lift" data-obs>
            <div className="n">3</div>
            <h4>You climb the ladder</h4>
            <p>
              Scale out the web tier, add a cache, shard the database, go multi-region. Each rung
              unlocks a control and a new wall — the order you’d hit them in production.
            </p>
          </div>
        </div>

        <div className="gn-foot">
          <span>
            DDIA, as a live comic — an unofficial, illustrated companion to <em>Designing
            Data-Intensive Applications</em> by Martin Kleppmann. Not affiliated with the author or
            O’Reilly.
          </span>
          <span>
            <Link to="/ddia">← DDIA home</Link>
          </span>
        </div>
      </div>
    </div>
  )
}
