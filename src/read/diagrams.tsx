/* Small, self-contained SVG diagrams for the comics. Palette matches comic.css:
   ink #1a1a1a · denim #3f6191 · terra #bd5f3d · muted #8a8177. */

const INK = '#1a1a1a'
const DENIM = '#3f6191'
const TERRA = '#bd5f3d'
const MUTED = '#8a8177'

/** Ch 6 — a hash ring: four nodes on a circle, a key mapping clockwise. */
export function RingDiagram() {
  return (
    <svg viewBox="0 0 160 160" role="img" aria-label="A hash ring with four nodes; a key maps clockwise to the next node.">
      <circle cx="80" cy="80" r="58" fill="none" stroke={INK} strokeWidth="2" />
      <g stroke={INK} strokeWidth="2" fill={DENIM}>
        <circle cx="80" cy="22" r="8" />
        <circle cx="138" cy="80" r="8" />
        <circle cx="80" cy="138" r="8" />
        <circle cx="22" cy="80" r="8" />
      </g>
      <circle cx="122" cy="38" r="4.5" fill={TERRA} stroke={INK} strokeWidth="1.5" />
      <path d="M122 38 A58 58 0 0 1 138 72" fill="none" stroke={TERRA} strokeWidth="2.5" strokeDasharray="3 3" markerEnd="url(#gn-ar)" />
      <defs>
        <marker id="gn-ar" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0 0 L7 3.5 L0 7 z" fill={TERRA} />
        </marker>
      </defs>
      <text x="80" y="84" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={MUTED}>
        2³² ring
      </text>
    </svg>
  )
}

/** Ch 5 — one leader, two followers; writes to leader, reads fan out. */
export function LeaderFollowerDiagram() {
  return (
    <svg viewBox="0 0 176 150" role="img" aria-label="One leader replicating to two followers; writes go to the leader, reads to followers.">
      <defs>
        <marker id="gn-a2" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0 0 L7 3.5 L0 7 z" fill={INK} />
        </marker>
      </defs>
      {/* leader */}
      <rect x="62" y="8" width="52" height="30" rx="4" fill={DENIM} stroke={INK} strokeWidth="2" />
      <text x="88" y="27" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#fff">leader</text>
      {/* write arrow in */}
      <path d="M88 -2 L88 6" stroke={INK} strokeWidth="2" markerEnd="url(#gn-a2)" />
      <text x="94" y="4" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={TERRA}>write</text>
      {/* replication arrows */}
      <path d="M74 40 L40 96" stroke={MUTED} strokeWidth="2" strokeDasharray="3 3" markerEnd="url(#gn-a2)" />
      <path d="M102 40 L136 96" stroke={MUTED} strokeWidth="2" strokeDasharray="3 3" markerEnd="url(#gn-a2)" />
      {/* followers */}
      <rect x="14" y="100" width="52" height="30" rx="4" fill="#fff" stroke={INK} strokeWidth="2" />
      <text x="40" y="119" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={INK}>follower</text>
      <rect x="110" y="100" width="52" height="30" rx="4" fill="#fff" stroke={INK} strokeWidth="2" />
      <text x="136" y="119" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={INK}>follower</text>
      <text x="40" y="146" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={DENIM}>read</text>
      <text x="136" y="146" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={DENIM}>read</text>
    </svg>
  )
}

/** Ch 5 — replication lag: leader ahead, follower behind, a stale read. */
export function LagDiagram() {
  return (
    <svg viewBox="0 0 176 150" role="img" aria-label="A follower lagging behind the leader returns a stale value.">
      <rect x="10" y="16" width="70" height="30" rx="4" fill={DENIM} stroke={INK} strokeWidth="2" />
      <text x="45" y="30" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill="#fff">leader</text>
      <text x="45" y="41" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill="#dfe7f0">x = 2</text>
      <rect x="96" y="16" width="70" height="30" rx="4" fill="#fff" stroke={INK} strokeWidth="2" />
      <text x="131" y="30" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={INK}>follower</text>
      <text x="131" y="41" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={TERRA}>x = 1</text>
      <path d="M80 31 L96 31" stroke={MUTED} strokeWidth="2" strokeDasharray="3 3" />
      <text x="88" y="26" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>lag</text>
      {/* stale read */}
      <path d="M131 46 L131 92" stroke={INK} strokeWidth="2" markerEnd="url(#gn-a3)" />
      <defs>
        <marker id="gn-a3" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0 0 L7 3.5 L0 7 z" fill={INK} />
        </marker>
      </defs>
      <rect x="86" y="96" width="90" height="30" rx="4" fill="#fbeee8" stroke={INK} strokeWidth="2" />
      <text x="131" y="115" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={TERRA}>reads stale 1</text>
    </svg>
  )
}

/** Ch 5 — leaderless quorum: W + R > N overlap guarantees a fresh read. */
export function QuorumDiagram() {
  const nodes = [
    { x: 30, y: 34 },
    { x: 88, y: 22 },
    { x: 146, y: 34 },
    { x: 52, y: 96 },
    { x: 124, y: 96 },
  ]
  return (
    <svg viewBox="0 0 176 150" role="img" aria-label="Five replicas: a write quorum of three and a read quorum of three must overlap.">
      {nodes.map((n, i) => {
        const written = i < 3 // W = 3 (top three)
        const read = i >= 2 // R = 3 (overlapping)
        const overlap = written && read
        return (
          <g key={i}>
            <circle
              cx={n.x}
              cy={n.y}
              r="14"
              fill={overlap ? TERRA : written ? DENIM : read ? '#eaf0f7' : '#fff'}
              stroke={INK}
              strokeWidth="2"
            />
            <text x={n.x} y={n.y + 3} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={written && !overlap ? '#fff' : INK}>
              {overlap ? '✓' : written ? 'W' : read ? 'R' : '·'}
            </text>
          </g>
        )
      })}
      <text x="88" y="140" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill={INK}>
        W=3 · R=3 · N=5 → overlap
      </text>
    </svg>
  )
}

/** Ch 7 — write skew: two transactions read the same state, both write, both "safe" alone. */
export function WriteSkewDiagram() {
  return (
    <svg viewBox="0 0 176 156" role="img" aria-label="Two transactions both read on-call=2 and each take one doctor off call, leaving zero.">
      <rect x="58" y="8" width="60" height="26" rx="4" fill="#fff" stroke={INK} strokeWidth="2" />
      <text x="88" y="25" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8.5" fill={INK}>on-call = 2</text>
      {/* two reads */}
      <path d="M70 34 L40 60" stroke={DENIM} strokeWidth="2" strokeDasharray="3 3" markerEnd="url(#gn-a2)" />
      <path d="M106 34 L136 60" stroke={DENIM} strokeWidth="2" strokeDasharray="3 3" markerEnd="url(#gn-a2)" />
      <defs>
        <marker id="gn-a2" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={INK} /></marker>
      </defs>
      <rect x="12" y="62" width="56" height="30" rx="4" fill={DENIM} stroke={INK} strokeWidth="2" />
      <text x="40" y="75" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill="#fff">T1 reads 2</text>
      <text x="40" y="87" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill="#dfe7f0">off-call me</text>
      <rect x="108" y="62" width="56" height="30" rx="4" fill={DENIM} stroke={INK} strokeWidth="2" />
      <text x="136" y="75" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill="#fff">T2 reads 2</text>
      <text x="136" y="87" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill="#dfe7f0">off-call me</text>
      {/* result */}
      <path d="M40 92 L78 116" stroke={MUTED} strokeWidth="2" markerEnd="url(#gn-a2)" />
      <path d="M136 92 L98 116" stroke={MUTED} strokeWidth="2" markerEnd="url(#gn-a2)" />
      <rect x="50" y="118" width="76" height="30" rx="4" fill="#fbeee8" stroke={INK} strokeWidth="2" />
      <text x="88" y="137" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8.5" fill={TERRA}>on-call = 0 ✗</text>
    </svg>
  )
}

/** Ch 8 — a healthy node frozen by a GC pause is declared dead by a timeout, then wakes as a zombie. */
export function TimeoutDiagram() {
  return (
    <svg viewBox="0 0 176 150" role="img" aria-label="A node paused by GC misses heartbeats, is declared dead, then wakes still believing it is leader.">
      <defs>
        <marker id="gn-a2" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={INK} /></marker>
      </defs>
      <rect x="20" y="16" width="64" height="34" rx="4" fill={DENIM} stroke={INK} strokeWidth="2" />
      <text x="52" y="30" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill="#fff">node A</text>
      <text x="52" y="42" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill="#dfe7f0">GC pause 8s</text>
      <rect x="112" y="16" width="52" height="34" rx="4" fill="#fff" stroke={INK} strokeWidth="2" />
      <text x="138" y="30" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={INK}>monitor</text>
      <text x="138" y="42" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={MUTED}>waits 5s</text>
      {/* missed heartbeats */}
      <path d="M84 28 L112 28" stroke={MUTED} strokeWidth="2" strokeDasharray="2 4" />
      <text x="98" y="23" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={TERRA}>♥ ✗</text>
      {/* declared dead */}
      <rect x="98" y="64" width="66" height="26" rx="4" fill="#fbeee8" stroke={INK} strokeWidth="2" />
      <text x="131" y="80" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={TERRA}>“A is dead”</text>
      <path d="M138 50 L131 62" stroke={INK} strokeWidth="2" markerEnd="url(#gn-a2)" />
      {/* zombie wakes */}
      <rect x="12" y="104" width="80" height="34" rx="4" fill="#fff" stroke={INK} strokeWidth="2" strokeDasharray="4 3" />
      <text x="52" y="118" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={INK}>A wakes up</text>
      <text x="52" y="130" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={TERRA}>“still leader!”</text>
      <path d="M52 50 L52 104" stroke={MUTED} strokeWidth="2" strokeDasharray="3 3" markerEnd="url(#gn-a2)" />
    </svg>
  )
}

/** Ch 9 — Raft: four followers grant votes to one candidate; a majority makes it leader. */
export function RaftDiagram() {
  const followers = [
    { x: 30, y: 30 },
    { x: 146, y: 30 },
    { x: 30, y: 118 },
    { x: 146, y: 118 },
  ]
  return (
    <svg viewBox="0 0 176 156" role="img" aria-label="A candidate collects votes from a majority of followers and becomes leader.">
      <defs>
        <marker id="gn-av" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={DENIM} /></marker>
      </defs>
      {followers.map((f, i) => (
        <g key={i}>
          <path d={`M${f.x} ${f.y} L88 78`} stroke={DENIM} strokeWidth="2" strokeDasharray="3 3" markerEnd="url(#gn-av)" />
          <circle cx={f.x} cy={f.y} r="14" fill="#fff" stroke={INK} strokeWidth="2" />
          <text x={f.x} y={f.y + 3} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={INK}>vote</text>
        </g>
      ))}
      <circle cx="88" cy="78" r="20" fill={DENIM} stroke={INK} strokeWidth="2" />
      <text x="88" y="76" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill="#fff">leader</text>
      <text x="88" y="87" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill="#dfe7f0">term 4</text>
      <text x="88" y="150" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8.5" fill={INK}>4 of 5 → majority ✓</text>
    </svg>
  )
}

/** Ch 3 — B-tree (update in place) vs LSM-tree (buffer + flush + compact). */
export function StorageDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="A B-tree updates fixed pages in place; an LSM-tree buffers writes in a memtable and flushes to sorted SSTables.">
      <defs>
        <marker id="gn-a2" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={INK} /></marker>
      </defs>
      {/* B-tree */}
      <text x="44" y="14" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={DENIM}>B-tree</text>
      <rect x="28" y="22" width="32" height="16" rx="2" fill={DENIM} stroke={INK} strokeWidth="1.5" />
      <rect x="10" y="52" width="28" height="16" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <rect x="50" y="52" width="28" height="16" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <path d="M40 38 L24 52 M48 38 L64 52" stroke={INK} strokeWidth="1.5" />
      <rect x="6" y="82" width="20" height="14" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <rect x="30" y="82" width="20" height="14" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <rect x="54" y="82" width="20" height="14" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <text x="44" y="120" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>update pages</text>
      <text x="44" y="130" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>in place</text>
      {/* divider */}
      <line x1="90" y1="18" x2="90" y2="138" stroke={INK} strokeWidth="1.5" strokeDasharray="3 3" />
      {/* LSM */}
      <text x="132" y="14" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={TERRA}>LSM-tree</text>
      <rect x="104" y="22" width="56" height="16" rx="2" fill={TERRA} stroke={INK} strokeWidth="1.5" />
      <text x="132" y="33" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill="#fff">memtable</text>
      <path d="M132 38 L132 48" stroke={INK} strokeWidth="1.5" markerEnd="url(#gn-a2)" />
      <rect x="106" y="50" width="52" height="12" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <rect x="106" y="66" width="52" height="12" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <rect x="106" y="82" width="52" height="12" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <text x="132" y="59" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={INK}>SSTable</text>
      <text x="132" y="75" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={INK}>SSTable</text>
      <text x="132" y="91" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={INK}>SSTable</text>
      <text x="132" y="120" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>append + </text>
      <text x="132" y="130" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>compact</text>
    </svg>
  )
}
