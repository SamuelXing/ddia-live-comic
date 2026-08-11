import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import {
  RingDiagram,
  LeaderFollowerDiagram,
  LagDiagram,
  QuorumDiagram,
  WriteSkewDiagram,
  TimeoutDiagram,
  RaftDiagram,
  StorageDiagram,
  TailDiagram,
  ShuffleDiagram,
  DualityDiagram,
  CompoundKeyDiagram,
} from './diagrams'


/** Each idea's inked panel — the graphic that leads the card. Pulled from the
 *  same diagrams the comics use, so the index is a peek at the panels inside. */
export const PANEL: Record<string, ReactNode> = {
  'tail-latency': <TailDiagram />,
  storage: <StorageDiagram />,
  'replication-leader': <LeaderFollowerDiagram />,
  'replication-lag': <LagDiagram />,
  'replication-quorum': <QuorumDiagram />,
  partitioning: <RingDiagram />,
  'partition-key': <CompoundKeyDiagram />,
  transactions: <WriteSkewDiagram />,
  'distributed-troubles': <TimeoutDiagram />,
  consensus: <RaftDiagram />,
  shuffle: <ShuffleDiagram />,
  'stream-table': <DualityDiagram />,
}

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

export const PARTS: Part[] = [
  {
    rn: 'I',
    pt: 'Foundations',
    ps: 'single node',
    ideas: [
      { no: 'Ch 1', title: 'Tail Latency', hook: 'Why the average hides the pain, and 1% of requests becomes 63% of them.', slug: 'tail-latency' },
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
      { no: 'Ch 6', title: 'Choosing the Partition Key', hook: 'Hash it and range scans ask everyone; sort it and today takes every write.', slug: 'partition-key' },
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
      { no: 'Ch 10', title: 'The Shuffle', hook: 'The sort in the middle — and why one hot key makes the cluster stop mattering.', slug: 'shuffle' },
      { no: 'Ch 11', title: 'Stream–Table Duality', hook: 'A table is a cached answer; the log is the thing that is true.', slug: 'stream-table' },
    ],
  },
]

const LIVE_COUNT = PARTS.flatMap((p) => p.ideas).filter((i) => i.slug).length

export default function IndexPage() {
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
          <div className="gn-kicker">The concept lens · inspired by DDIA, 1st edition</div>
          <h1>The hard ideas, drawn out.</h1>
          <p className="dek">
            Distributed systems are full of arcane ideas — replication, partitioning, consensus. Read each one as a
            short comic, then follow it into the real machines and architectures where it actually lives.
          </p>
          <div className="gn-tags">
            {/* counted, not typed — the last comic shipped with this still
                reading "11", because a hand-written number has no reason to
                change when a card is added below it. */}
            <span className="gn-tag">{LIVE_COUNT} ideas live</span>
            <span className="gn-tag">Parts I–III drawn</span>
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
                const panel = idea.slug ? PANEL[idea.slug] : null
                const inner = (
                  <>
                    <div className={'gn-ipanel' + (panel ? '' : ' ph')}>
                      <span className="no">{idea.no}</span>
                      {panel ?? <span className="phlabel">in the sketchbook</span>}
                    </div>
                    <div className="gn-icap">
                      <h4>{idea.title}</h4>
                      <p className="hook">{idea.hook}</p>
                      <div className="meta">
                        {live ? <span className="go">Read the comic →</span> : <span className="soon">Coming soon</span>}
                      </div>
                    </div>
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
