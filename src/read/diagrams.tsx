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
