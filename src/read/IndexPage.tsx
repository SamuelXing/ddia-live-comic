import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav'

import '@fontsource/playfair-display/700.css'
import '@fontsource/playfair-display/800.css'
import '@fontsource/playfair-display/900.css'
import '@fontsource/comic-neue/400.css'
import '@fontsource/comic-neue/700.css'
import '@fontsource/newsreader/400.css'
import '@fontsource/newsreader/500.css'
import '@fontsource/newsreader/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '../styles/comic.css'

interface Idea {
  no: string
  title: string
  hook: string
  slug?: string
  pill?: string
}
interface Part {
  rn: string
  pt: string
  ps: string
  ideas: Idea[]
}

const PARTS: Part[] = [
  {
    rn: 'I',
    pt: 'Foundations',
    ps: 'single node',
    ideas: [
      { no: 'Ch 1', title: 'Tail Latency', hook: 'Why the average hides the pain, and percentiles don’t.' },
      { no: 'Ch 3', title: 'B-trees vs LSM-trees', hook: 'The two ways a database turns keys into bytes on disk.', slug: 'storage' },
    ],
  },
  {
    rn: 'II',
    pt: 'Distributed Data',
    ps: 'many machines',
    ideas: [
      { no: 'Ch 5', title: 'Leader & Followers', hook: 'One writer, many readers — the scheme almost everything uses.', slug: 'replication-leader' },
      { no: 'Ch 5', title: 'Replication Lag', hook: 'Async replication means your followers live a little in the past.', slug: 'replication-lag' },
      { no: 'Ch 5', title: 'Leaderless & Quorums', hook: 'No boss — just the inequality W + R > N.', slug: 'replication-quorum' },
      { no: 'Ch 6', title: 'Consistent Hashing', hook: 'Add a node and move ~1/N of the keys, not ~80%.', slug: 'partitioning' },
      { no: 'Ch 7', title: 'Isolation Levels', hook: 'Dirty reads, write skew, phantoms — anomalies, frame by frame.', slug: 'transactions' },
      { no: 'Ch 8', title: 'Why It’s Hard', hook: 'Unreliable clocks, timeouts, and how a healthy server gets declared dead.', slug: 'distributed-troubles' },
      { no: 'Ch 9', title: 'Raft, Illustrated', hook: 'Leader election and a replicated log that survives a split vote.', slug: 'consensus' },
    ],
  },
  {
    rn: 'III',
    pt: 'Derived Data',
    ps: 'batch & stream',
    ideas: [
      { no: 'Ch 10', title: 'The Shuffle', hook: 'How batch jobs move data between stages — and the join strategies that race.' },
      { no: 'Ch 11', title: 'Stream–Table Duality', hook: 'Where a stream and a table turn out to be two views of one thing.' },
    ],
  },
]

export default function IndexPage() {
  useEffect(() => {
    window.scrollTo(0, 0)
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
          <div className="gn-kicker">The concept lens · inspired by DDIA</div>
          <h1>The hard ideas, drawn out.</h1>
          <p className="dek">
            Distributed systems are full of arcane ideas — replication, partitioning, consensus. Read each one as a
            short comic, then follow it into the real machines and architectures where it actually lives.
          </p>
          <div className="gn-tags">
            <span className="gn-tag">8 ideas live</span>
            <span className="gn-tag">More drawing</span>
          </div>
        </header>

        {PARTS.map((part) => (
          <div key={part.rn}>
            <div className="gn-partband" data-obs>
              <span className="rn">{part.rn}</span>
              <span className="pt">{part.pt}</span>
              <span className="ps">{part.ps}</span>
            </div>
            <div className="gn-ideas">
              {part.ideas.map((idea, i) => {
                const live = !!idea.slug
                const inner = (
                  <>
                    <span className="no">{idea.no}</span>
                    <h4>
                      {idea.title}
                      {idea.pill && <span className="gn-pill">{idea.pill}</span>}
                    </h4>
                    <p className="hook">{idea.hook}</p>
                    <div className="meta">{live ? <span className="go">Read the comic →</span> : <span className="soon">Coming soon</span>}</div>
                  </>
                )
                return live ? (
                  <Link key={i} className="gn-idea box lift live" to={'/read/' + idea.slug} data-obs>
                    {inner}
                  </Link>
                ) : (
                  <div key={i} className="gn-idea box soon" data-obs>
                    {inner}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <div className="gn-foot">
          <span>DDIA, as a live comic — an unofficial, illustrated companion to the book</span>
          <span>
            <Link to="/components">Component deep-dives</Link> · <Link to="/#apps">App simulations</Link>
          </span>
        </div>
      </div>
    </div>
  )
}
