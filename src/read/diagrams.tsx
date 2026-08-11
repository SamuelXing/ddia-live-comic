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
        <marker id="gn-ar" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" refX="6" refY="4.5" orient="auto">
          <path d="M0 0 L9 4.5 L0 9 z" fill={TERRA} />
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
      {/* write arrow in — kept fully inside the frame */}
      <text x="88" y="12" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={TERRA}>write</text>
      <path d="M88 16 L88 26" stroke={INK} strokeWidth="2" markerEnd="url(#gn-a2)" />
      {/* leader */}
      <rect x="62" y="30" width="52" height="28" rx="4" fill={DENIM} stroke={INK} strokeWidth="2" />
      <text x="88" y="48" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#fff">leader</text>
      {/* replication arrows */}
      <path d="M74 60 L44 94" stroke={MUTED} strokeWidth="2" strokeDasharray="3 3" markerEnd="url(#gn-a2)" />
      <path d="M102 60 L132 94" stroke={MUTED} strokeWidth="2" strokeDasharray="3 3" markerEnd="url(#gn-a2)" />
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
      {/* the gap never closes: writes keep crossing, the follower keeps trailing */}
      <path className="gn-an-flow" d="M80 31 L96 31" stroke={MUTED} strokeWidth="2" strokeDasharray="3 3" />
      <text x="88" y="26" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>lag</text>
      {/* stale read */}
      <path d="M131 46 L131 92" stroke={INK} strokeWidth="2" markerEnd="url(#gn-a3)" />
      <defs>
        <marker id="gn-a3" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0 0 L7 3.5 L0 7 z" fill={INK} />
        </marker>
      </defs>
      <g className="gn-an-breathe">
        <rect x="86" y="96" width="90" height="30" rx="4" fill="#fbeee8" stroke={INK} strokeWidth="2" />
        <text x="131" y="115" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={TERRA}>reads stale 1</text>
      </g>
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
      {/* the whole panel is one clock: beats stop, the timeout fires, A wakes.
          The heartbeat line fades because the beat is what went missing. */}
      <path className="gn-an-breathe" d="M84 28 L112 28" stroke={MUTED} strokeWidth="2" strokeDasharray="2 4" />
      <text x="98" y="11" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6" fill={TERRA}>no heartbeat</text>
      {/* declared dead — the monitor's 5s runs out */}
      <g className="gn-an-cue">
        <rect x="98" y="64" width="66" height="26" rx="4" fill="#fbeee8" stroke={INK} strokeWidth="2" />
        <text x="131" y="80" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={TERRA}>“A is dead”</text>
        <path d="M138 50 L131 62" stroke={INK} strokeWidth="2" markerEnd="url(#gn-a2)" />
      </g>
      {/* zombie wakes — three seconds after the verdict, on the same clock */}
      <g className="gn-an-cue" style={{ animationDelay: '1.6s' }}>
        <rect x="12" y="104" width="80" height="34" rx="4" fill="#fff" stroke={INK} strokeWidth="2" strokeDasharray="4 3" />
        <text x="52" y="118" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={INK}>A wakes up</text>
        <text x="52" y="130" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={TERRA}>“still leader!”</text>
        <path d="M52 50 L52 104" stroke={MUTED} strokeWidth="2" strokeDasharray="3 3" markerEnd="url(#gn-a2)" />
      </g>
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
      {/* votes arrive one after another — an election is a sequence, not a state */}
      {followers.map((f, i) => (
        <g key={i}>
          <path className="gn-an-flow" style={{ animationDelay: `${i * 0.18}s` }} d={`M${f.x} ${f.y} L88 78`} stroke={DENIM} strokeWidth="2" strokeDasharray="3 3" markerEnd="url(#gn-av)" />
          <circle cx={f.x} cy={f.y} r="14" fill="#fff" stroke={INK} strokeWidth="2" />
          <text x={f.x} y={f.y + 3} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={INK}>vote</text>
        </g>
      ))}
      {/* the majority lands: the candidate becomes leader */}
      <circle className="gn-an-beat" cx="88" cy="78" r="20" fill={DENIM} stroke={INK} strokeWidth="2" />
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

/* ============================================================
   Per-step panels — one drawing per beat, so each comic reads as a
   sequence of pictures rather than prose with a single illustration.
   Ch 3 · Storage & Retrieval
   ============================================================ */

/** Ch 3 · Step 01 — appending is O(1); finding means scanning the whole log. */
export function AppendScanDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="Records appended to the end of a log are fast to write, but a lookup must scan every record.">
      <defs>
        <marker id="gn-ap-t" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={TERRA} /></marker>
        <marker id="gn-ap-m" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={MUTED} /></marker>
      </defs>
      <text x="88" y="12" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={MUTED}>log file</text>
      {[10, 44, 78, 112].map((x) => (
        <rect key={x} x={x} y="28" width="30" height="20" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      ))}
      <rect x="146" y="28" width="22" height="20" rx="2" fill={TERRA} stroke={INK} strokeWidth="1.5" />
      <path d="M157 12 L157 24" stroke={TERRA} strokeWidth="2" markerEnd="url(#gn-ap-t)" />
      <text x="157" y="60" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={TERRA}>append</text>
      <text x="88" y="86" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={TERRA}>write = fast</text>
      <path d="M10 106 L166 106" stroke={MUTED} strokeWidth="2" strokeDasharray="3 3" markerEnd="url(#gn-ap-m)" />
      <text x="88" y="124" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>get(k) checks every record</text>
      <text x="88" y="140" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={INK}>read = slow</text>
    </svg>
  )
}

/** Ch 3 · Step 02 — a B-tree lookup walks a few pages; writes edit a page in place. */
export function BTreeDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="A B-tree: a root page points to internal pages, which point to leaf pages; a lookup walks one path from root to leaf.">
      <rect x="62" y="16" width="52" height="18" rx="2" fill={DENIM} stroke={INK} strokeWidth="1.5" />
      <text x="88" y="29" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill="#fff">root page</text>
      <path d="M76 34 L46 56" stroke={DENIM} strokeWidth="2.5" />
      <path d="M100 34 L130 56" stroke={INK} strokeWidth="1.5" />
      <rect x="18" y="58" width="56" height="18" rx="2" fill="#fff" stroke={DENIM} strokeWidth="2.5" />
      <rect x="102" y="58" width="56" height="18" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <path d="M36 76 L28 98" stroke={DENIM} strokeWidth="2.5" />
      <path d="M58 76 L66 98" stroke={INK} strokeWidth="1.5" />
      <path d="M120 76 L112 98" stroke={INK} strokeWidth="1.5" />
      <path d="M140 76 L148 98" stroke={INK} strokeWidth="1.5" />
      <rect x="10" y="100" width="34" height="18" rx="2" fill="#eaf0f8" stroke={DENIM} strokeWidth="2.5" />
      <rect x="50" y="100" width="34" height="18" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <rect x="92" y="100" width="34" height="18" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <rect x="132" y="100" width="34" height="18" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <text x="27" y="112" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={DENIM}>leaf</text>
      <text x="88" y="136" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>one path, a few pages</text>
      <text x="88" y="150" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={DENIM}>write edits a page in place</text>
    </svg>
  )
}

/** Ch 3 · Step 03 — LSM: buffer in memory, flush to sorted files, compact in the background. */
export function LsmFlowDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="Writes buffer in an in-memory memtable, flush to immutable sorted SSTables on disk, and are merged by background compaction.">
      <defs>
        <marker id="gn-lsm-i" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={INK} /></marker>
      </defs>
      <rect x="46" y="10" width="84" height="18" rx="2" fill={TERRA} stroke={INK} strokeWidth="1.5" />
      {/* the buffer filling, then emptying on flush — opacity 0 at rest, so a
          still frame is the original drawing exactly */}
      <rect className="gn-an-fill" x="48" y="12" width="80" height="14" rx="1" fill={INK} opacity="0" />
      <text x="88" y="23" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill="#fff">memtable (RAM)</text>
      <path className="gn-an-flow" d="M88 28 L88 42" stroke={INK} strokeWidth="2" markerEnd="url(#gn-lsm-i)" />
      <text x="96" y="39" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>flush</text>
      <line x1="6" y1="46" x2="170" y2="46" stroke={MUTED} strokeWidth="1.5" strokeDasharray="3 3" />
      <text x="8" y="56" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>disk</text>
      <rect x="46" y="60" width="84" height="14" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <rect x="46" y="78" width="84" height="14" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <rect x="46" y="96" width="84" height="14" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <text x="88" y="70" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={INK}>SSTable (sorted)</text>
      <text x="88" y="88" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={INK}>SSTable</text>
      <text x="88" y="106" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={INK}>SSTable</text>
      {/* compaction runs on its own clock, later in the same 6s cycle */}
      <path className="gn-an-flow" style={{ animationDelay: '.7s' }} d="M134 67 C154 67 154 118 110 118" fill="none" stroke={TERRA} strokeWidth="2" strokeDasharray="3 3" markerEnd="url(#gn-lsm-i)" />
      <g className="gn-an-cue" style={{ animationDelay: '1.4s' }}>
        <rect x="46" y="122" width="60" height="16" rx="2" fill="#fbf1ea" stroke={TERRA} strokeWidth="2" />
        <text x="76" y="133" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={TERRA}>merged file</text>
      </g>
      <text x="88" y="152" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>compaction, in the background</text>
    </svg>
  )
}

/** Ch 3 · Step 04 — the amplification triangle: every engine picks a point. */
export function AmplificationDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="A triangle of write, read, and space amplification; B-trees and LSM-trees sit at different points on it.">
      <polygon points="88,24 22,124 154,124" fill="none" stroke={INK} strokeWidth="2" />
      <text x="88" y="16" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={MUTED}>read amp</text>
      <text x="18" y="138" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={MUTED}>write</text>
      <text x="156" y="138" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={MUTED}>space</text>
      <circle cx="60" cy="92" r="6" fill={DENIM} stroke={INK} strokeWidth="1.5" />
      <text x="60" y="112" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={DENIM}>B-tree</text>
      <circle cx="114" cy="94" r="6" fill={TERRA} stroke={INK} strokeWidth="1.5" />
      <text x="114" y="114" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={TERRA}>LSM</text>
      <text x="88" y="152" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>no free point on the triangle</text>
    </svg>
  )
}

/* ---------------- Ch 5 · Replication: leader & followers ---------------- */

/** Ch 5 · Step 02 — the leader streams an ordered log; followers replay it. */
export function ReplicationLogDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="A leader appends changes to an ordered log and streams it to followers, which replay the entries in the same order.">
      <defs>
        <marker id="gn-rl" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={INK} /></marker>
      </defs>
      <rect x="58" y="8" width="60" height="18" rx="2" fill={DENIM} stroke={INK} strokeWidth="1.5" />
      <text x="88" y="21" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill="#fff">leader</text>
      <path d="M88 26 L88 42" stroke={INK} strokeWidth="2" markerEnd="url(#gn-rl)" />
      <rect x="26" y="46" width="34" height="18" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <rect x="70" y="46" width="34" height="18" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <rect x="114" y="46" width="34" height="18" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <text x="43" y="59" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>#1</text>
      <text x="87" y="59" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>#2</text>
      <text x="131" y="59" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>#3</text>
      <text x="88" y="76" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>replication log</text>
      <path d="M56 82 L34 100" stroke={MUTED} strokeWidth="2" strokeDasharray="3 3" markerEnd="url(#gn-rl)" />
      <path d="M120 82 L142 100" stroke={MUTED} strokeWidth="2" strokeDasharray="3 3" markerEnd="url(#gn-rl)" />
      <rect x="4" y="104" width="64" height="18" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <rect x="108" y="104" width="64" height="18" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <text x="36" y="117" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>follower</text>
      <text x="140" y="117" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>follower</text>
      <text x="88" y="140" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>replay in the same order</text>
      <text x="88" y="152" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={DENIM}>same ending state</text>
    </svg>
  )
}

/** Ch 5 · Step 03 — synchronous waits for the copy; asynchronous confirms first. */
export function SyncAsyncDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="Synchronous replication waits for a follower to confirm before acknowledging; asynchronous acknowledges immediately and copies later.">
      <defs>
        <marker id="gn-sa-i" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={INK} /></marker>
        <marker id="gn-sa-m" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={MUTED} /></marker>
      </defs>
      <text x="43" y="12" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={DENIM}>synchronous</text>
      <rect x="12" y="20" width="62" height="16" rx="2" fill={DENIM} stroke={INK} strokeWidth="1.5" />
      <text x="43" y="32" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill="#fff">leader</text>
      <path d="M43 38 L43 50" stroke={INK} strokeWidth="1.5" markerEnd="url(#gn-sa-i)" />
      <rect x="12" y="54" width="62" height="16" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <text x="43" y="66" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>follower</text>
      <text x="43" y="84" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={DENIM}>it confirms</text>
      <text x="43" y="98" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>then “done”</text>
      <text x="43" y="120" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>safe — one slow</text>
      <text x="43" y="131" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>copy stalls</text>
      <text x="43" y="142" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>everyone</text>
      <line x1="88" y1="14" x2="88" y2="148" stroke={INK} strokeWidth="1.5" strokeDasharray="3 3" />
      <text x="133" y="12" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={TERRA}>asynchronous</text>
      <rect x="102" y="20" width="62" height="16" rx="2" fill={TERRA} stroke={INK} strokeWidth="1.5" />
      <text x="133" y="32" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill="#fff">leader</text>
      <text x="133" y="48" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={TERRA}>“done” at once</text>
      <path d="M133 52 L133 62" stroke={MUTED} strokeWidth="1.5" strokeDasharray="2 2" markerEnd="url(#gn-sa-m)" />
      <rect x="102" y="66" width="62" height="16" rx="2" fill="#fff" stroke={MUTED} strokeWidth="1.5" strokeDasharray="3 2" />
      <text x="133" y="78" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>copies later</text>
      <text x="133" y="98" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>nobody waits</text>
      <text x="133" y="120" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>fast — a crash</text>
      <text x="133" y="131" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>loses the last</text>
      <text x="133" y="142" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>few writes</text>
    </svg>
  )
}

/* ---------------- Ch 5 · Replication lag ---------------- */

/** Ch 5 lag · Fix 01 — route a user's own reads to the leader for a while. */
export function ReadYourWritesDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="After writing, a user's own reads are routed to the leader so they always see their own update, while other readers use followers.">
      <defs>
        <marker id="gn-ryw-d" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={DENIM} /></marker>
        <marker id="gn-ryw-m" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={MUTED} /></marker>
      </defs>
      <rect x="8" y="30" width="46" height="18" rx="2" fill="#fff" stroke={DENIM} strokeWidth="2" />
      <text x="31" y="43" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={DENIM}>you</text>
      <path d="M54 34 L110 34" stroke={DENIM} strokeWidth="2" markerEnd="url(#gn-ryw-d)" />
      <text x="82" y="29" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={DENIM}>write</text>
      <path d="M110 46 L54 46" stroke={DENIM} strokeWidth="2" markerEnd="url(#gn-ryw-d)" />
      <text x="82" y="58" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={DENIM}>your read</text>
      <rect x="112" y="26" width="56" height="26" rx="2" fill={DENIM} stroke={INK} strokeWidth="1.5" />
      <text x="140" y="43" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill="#fff">leader</text>
      <path d="M140 52 L140 76" stroke={MUTED} strokeWidth="2" strokeDasharray="3 3" markerEnd="url(#gn-ryw-m)" />
      <rect x="112" y="80" width="56" height="20" rx="2" fill="#fff" stroke={MUTED} strokeWidth="1.5" />
      <text x="140" y="93" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>follower</text>
      <rect x="8" y="80" width="46" height="20" rx="2" fill="#fff" stroke={MUTED} strokeWidth="1.5" />
      <text x="31" y="93" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>others</text>
      <path d="M110 90 L56 90" stroke={MUTED} strokeWidth="2" strokeDasharray="3 3" markerEnd="url(#gn-ryw-m)" />
      <text x="88" y="120" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={DENIM}>you always see your own write</text>
      <text x="88" y="136" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>everyone else may lag briefly</text>
    </svg>
  )
}

/** Ch 5 lag · Step 02 — a second read hits a more-lagged replica: time runs backwards. */
export function MonotonicDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="A first read hits a fresh replica and shows a comment; a second read hits a more-lagged replica and the comment is gone.">
      <defs>
        <marker id="gn-mono" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={INK} /></marker>
      </defs>
      <rect x="10" y="16" width="52" height="18" rx="2" fill="#fff" stroke={DENIM} strokeWidth="2" />
      <text x="36" y="29" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={DENIM}>read #1</text>
      <path d="M62 25 L96 25" stroke={INK} strokeWidth="2" markerEnd="url(#gn-mono)" />
      <rect x="100" y="14" width="68" height="22" rx="2" fill="#eaf0f8" stroke={DENIM} strokeWidth="2" />
      <text x="134" y="28" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={DENIM}>fresh replica</text>
      <text x="88" y="50" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>“the comment is here”</text>
      <line x1="10" y1="62" x2="166" y2="62" stroke={MUTED} strokeWidth="1.5" strokeDasharray="3 3" />
      <rect x="10" y="74" width="52" height="18" rx="2" fill="#fff" stroke={TERRA} strokeWidth="2" />
      <text x="36" y="87" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={TERRA}>read #2</text>
      <path d="M62 83 L96 83" stroke={INK} strokeWidth="2" markerEnd="url(#gn-mono)" />
      <rect x="100" y="72" width="68" height="22" rx="2" fill="#fbf1ea" stroke={TERRA} strokeWidth="2" />
      <text x="134" y="86" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={TERRA}>laggier replica</text>
      <text x="88" y="108" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={TERRA}>“…what comment?”</text>
      <path d="M126 122 L50 122" stroke={TERRA} strokeWidth="2" markerEnd="url(#gn-mono)" />
      <text x="88" y="138" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>the reader moved backwards in time</text>
      <text x="88" y="152" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={DENIM}>fix: pin them to one replica</text>
    </svg>
  )
}

/** Ch 5 lag · Step 03 — the answer replicates faster than the question it answers. */
export function CausalDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="A question and its answer replicate along different paths, so a reader can see the answer before the question.">
      <defs>
        <marker id="gn-cz" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={MUTED} /></marker>
        <marker id="gn-cz-t" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={TERRA} /></marker>
      </defs>
      <rect x="12" y="14" width="66" height="20" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <text x="45" y="27" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={INK}>question</text>
      <rect x="98" y="14" width="66" height="20" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <text x="131" y="27" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={INK}>answer</text>
      <path d="M78 24 L94 24" stroke={INK} strokeWidth="1.5" markerEnd="url(#gn-cz)" />
      <text x="88" y="48" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6" fill={MUTED}>the answer needs it</text>
      <path d="M45 36 C30 60 30 78 45 96" fill="none" stroke={MUTED} strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#gn-cz)" />
      <text x="16" y="70" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>slow</text>
      <text x="16" y="80" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>path</text>
      <path d="M131 36 C146 54 146 70 131 96" fill="none" stroke={TERRA} strokeWidth="2" markerEnd="url(#gn-cz-t)" />
      <text x="150" y="70" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={TERRA}>fast</text>
      <text x="150" y="80" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={TERRA}>path</text>
      <rect x="20" y="100" width="136" height="30" rx="2" fill={INK} stroke={INK} strokeWidth="1.5" />
      <text x="88" y="113" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill="#f7f4ef">reader sees the answer</text>
      <text x="88" y="124" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={TERRA}>before the question</text>
      <text x="88" y="148" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>effect arrives before its cause</text>
    </svg>
  )
}

/* ---------------- Ch 5 · Leaderless & quorums ---------------- */

/** Ch 5 quorum · Step 01 — send to all N, wait for only W acks. */
export function QuorumWriteDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="A client sends a write to all replicas but only waits for W acknowledgements.">
      <defs>
        <marker id="gn-qw" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={DENIM} /></marker>
        <marker id="gn-qw-m" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={MUTED} /></marker>
      </defs>
      <rect x="60" y="8" width="56" height="18" rx="2" fill={INK} stroke={INK} strokeWidth="1.5" />
      <text x="88" y="21" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill="#f7f4ef">client</text>
      <path d="M76 27 L30 52" stroke={DENIM} strokeWidth="2" markerEnd="url(#gn-qw)" />
      <path d="M85 27 L72 52" stroke={DENIM} strokeWidth="2" markerEnd="url(#gn-qw)" />
      <path d="M91 27 L114 52" stroke={DENIM} strokeWidth="2" markerEnd="url(#gn-qw)" />
      <path d="M100 27 L152 52" stroke={MUTED} strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#gn-qw-m)" />
      {[20, 62, 104, 146].map((x, i) => (
        <g key={x}>
          <circle cx={x + 5} cy="70" r="13" fill={i < 3 ? DENIM : '#fff'} stroke={INK} strokeWidth="1.5" />
          <text x={x + 5} y="73" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={i < 3 ? '#fff' : MUTED}>
            {i < 3 ? 'ack' : '…'}
          </text>
        </g>
      ))}
      <text x="88" y="106" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={DENIM}>W acks → write is done</text>
      <text x="88" y="124" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>the rest catch up later</text>
      <text x="88" y="146" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>never wait for all N</text>
    </svg>
  )
}

/** Ch 5 quorum · Step 03 — W and R are dials traded against each other. */
export function DialsDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="W and R shown as dials: lowering one speeds that operation and weakens the freshness guarantee.">
      <text x="88" y="14" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={MUTED}>two dials, one budget</text>
      <text x="12" y="40" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={DENIM}>W</text>
      <line x1="32" y1="36" x2="164" y2="36" stroke={INK} strokeWidth="2" />
      <circle cx="64" cy="36" r="7" fill={DENIM} stroke={INK} strokeWidth="1.5" />
      <text x="32" y="52" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>fast writes</text>
      <text x="164" y="52" textAnchor="end" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>safe writes</text>
      <text x="12" y="82" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={TERRA}>R</text>
      <line x1="32" y1="78" x2="164" y2="78" stroke={INK} strokeWidth="2" />
      <circle cx="130" cy="78" r="7" fill={TERRA} stroke={INK} strokeWidth="1.5" />
      <text x="32" y="94" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>fast reads</text>
      <text x="164" y="94" textAnchor="end" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>fresh reads</text>
      <rect x="16" y="108" width="144" height="22" rx="2" fill="#eaf0f8" stroke={DENIM} strokeWidth="2" />
      <text x="88" y="122" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={DENIM}>keep W + R bigger than N</text>
      <text x="88" y="148" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>break it on purpose → stale reads</text>
    </svg>
  )
}

/** Ch 5 quorum · Step 04 — two clients write the same key at once: who wins? */
export function ConflictDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="Two clients write the same key to different replicas at the same moment, producing two conflicting versions.">
      <defs>
        <marker id="gn-cf" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={INK} /></marker>
      </defs>
      <rect x="6" y="10" width="58" height="18" rx="2" fill={DENIM} stroke={INK} strokeWidth="1.5" />
      <text x="35" y="23" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill="#fff">client A</text>
      <rect x="112" y="10" width="58" height="18" rx="2" fill={TERRA} stroke={INK} strokeWidth="1.5" />
      <text x="141" y="23" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill="#fff">client B</text>
      <path d="M35 28 L35 48" stroke={INK} strokeWidth="2" markerEnd="url(#gn-cf)" />
      <path d="M141 28 L141 48" stroke={INK} strokeWidth="2" markerEnd="url(#gn-cf)" />
      <rect x="6" y="52" width="58" height="22" rx="2" fill="#eaf0f8" stroke={DENIM} strokeWidth="2" />
      <text x="35" y="66" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={DENIM}>x = “red”</text>
      <rect x="112" y="52" width="58" height="22" rx="2" fill="#fbf1ea" stroke={TERRA} strokeWidth="2" />
      <text x="141" y="66" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={TERRA}>x = “blue”</text>
      <text x="88" y="62" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>same key,</text>
      <text x="88" y="72" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>same moment</text>
      <path d="M38 78 L74 100" stroke={INK} strokeWidth="1.5" markerEnd="url(#gn-cf)" />
      <path d="M138 78 L102 100" stroke={INK} strokeWidth="1.5" markerEnd="url(#gn-cf)" />
      <rect x="26" y="104" width="124" height="26" rx="2" fill={INK} stroke={INK} strokeWidth="1.5" />
      <text x="88" y="121" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill="#f7f4ef">which one wins?</text>
      <text x="88" y="148" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>the quorum math can’t answer this</text>
    </svg>
  )
}

/* ---------------- Ch 6 · Partitioning ---------------- */

/** Ch 6 · Step 01 — hash(key) % N drops each key in a bucket. */
export function ModuloDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="Keys are hashed and taken modulo the node count, dropping each key into one of four node buckets.">
      <defs>
        <marker id="gn-mod" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={INK} /></marker>
      </defs>
      <rect x="32" y="10" width="112" height="20" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <text x="88" y="24" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={INK}>hash(key) % 4</text>
      <path d="M64 30 L28 54" stroke={INK} strokeWidth="1.5" markerEnd="url(#gn-mod)" />
      <path d="M80 30 L68 54" stroke={INK} strokeWidth="1.5" markerEnd="url(#gn-mod)" />
      <path d="M96 30 L110 54" stroke={INK} strokeWidth="1.5" markerEnd="url(#gn-mod)" />
      <path d="M112 30 L150 54" stroke={INK} strokeWidth="1.5" markerEnd="url(#gn-mod)" />
      {[6, 48, 90, 132].map((x, i) => (
        <g key={x}>
          <rect x={x} y="58" width="38" height="32" rx="2" fill={DENIM} stroke={INK} strokeWidth="1.5" />
          <text x={x + 19} y="78" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill="#fff">node {i}</text>
        </g>
      ))}
      <text x="88" y="112" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>even spread, nothing to store</text>
      <text x="88" y="134" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={INK}>one line of math…</text>
      <text x="88" y="150" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={TERRA}>…until N changes</text>
    </svg>
  )
}

/** Ch 6 · Step 02 — grow 4 → 5 and almost every key relocates. */
export function StampedeDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="Growing from four nodes to five changes the modulo for about eighty percent of keys, so they must all move.">
      <defs>
        <marker id="gn-st" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={TERRA} /></marker>
      </defs>
      <text x="88" y="12" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={MUTED}>% 4 → % 5</text>
      {[10, 52, 94, 136].map((x) => (
        <rect key={x} x={x} y="20" width="32" height="20" rx="2" fill={DENIM} stroke={INK} strokeWidth="1.5" />
      ))}
      {[6, 40, 74, 108, 142].map((x) => (
        <rect key={x} x={x} y="108" width="28" height="20" rx="2" fill={DENIM} stroke={INK} strokeWidth="1.5" />
      ))}
      {/* the stampede: every arrow is keys in flight, all at once */}
      <path className="gn-an-flow" d="M26 42 L100 104" stroke={TERRA} strokeWidth="1.5" markerEnd="url(#gn-st)" />
      <path className="gn-an-flow" style={{ animationDelay: '.1s' }} d="M68 42 L20 104" stroke={TERRA} strokeWidth="1.5" markerEnd="url(#gn-st)" />
      <path className="gn-an-flow" style={{ animationDelay: '.2s' }} d="M110 42 L54 104" stroke={TERRA} strokeWidth="1.5" markerEnd="url(#gn-st)" />
      <path className="gn-an-flow" style={{ animationDelay: '.3s' }} d="M152 42 L122 104" stroke={TERRA} strokeWidth="1.5" markerEnd="url(#gn-st)" />
      <rect x="46" y="62" width="84" height="22" fill="#fffdf8" stroke={TERRA} strokeWidth="1.5" />
      <text x="88" y="77" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="10" fill={TERRA}>~80% move</text>
      <text x="88" y="148" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>a cluster-wide stampede</text>
    </svg>
  )
}

/** Ch 6 · Step 04 — each machine sits at many points, so load spreads evenly. */
export function VirtualNodesDiagram() {
  const pts = [DENIM, TERRA, MUTED, DENIM, TERRA, MUTED, DENIM, TERRA, MUTED, DENIM, TERRA, MUTED]
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="Each machine is placed at many points around the ring, so every machine owns many small slices instead of one large arc.">
      <circle cx="88" cy="70" r="50" fill="none" stroke={INK} strokeWidth="2" />
      {pts.map((c, i) => {
        const r = ((i * 30 - 90) * Math.PI) / 180
        return <circle key={i} cx={88 + 50 * Math.cos(r)} cy={70 + 50 * Math.sin(r)} r="6" fill={c} stroke={INK} strokeWidth="1.5" />
      })}
      <text x="88" y="68" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>3 machines,</text>
      <text x="88" y="80" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>12 points</text>
      <text x="88" y="140" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>lose one → its slices spread</text>
      <text x="88" y="152" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>across every survivor</text>
    </svg>
  )
}

/* ---------------- Ch 7 · Transactions ---------------- */

/** Ch 7 · Step 01 — atomicity: both writes land, or neither does. */
export function AtomicityDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="A transfer debits one account and credits another; a crash in the middle rolls both back rather than leaving half the work done.">
      <defs>
        <marker id="gn-at" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={INK} /></marker>
      </defs>
      <rect x="10" y="16" width="60" height="24" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <text x="40" y="31" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={INK}>debit A</text>
      <rect x="106" y="16" width="60" height="24" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <text x="136" y="31" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={INK}>credit B</text>
      <path d="M70 28 L102 28" stroke={INK} strokeWidth="1.5" markerEnd="url(#gn-at)" />
      <path d="M78 44 L98 62" stroke={TERRA} strokeWidth="2.5" />
      <path d="M98 44 L78 62" stroke={TERRA} strokeWidth="2.5" />
      <text x="88" y="78" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={TERRA}>crash here</text>
      <rect x="16" y="88" width="144" height="26" rx="2" fill="#eaf0f8" stroke={DENIM} strokeWidth="2" />
      <text x="88" y="105" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={DENIM}>both undone — as if never run</text>
      <text x="88" y="134" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>money never sits in mid-air</text>
      <text x="88" y="150" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={INK}>all, or nothing</text>
    </svg>
  )
}

/** Ch 7 · Step 02 — the same query twice, two different answers. */
export function NonRepeatableDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="Inside one transaction the same query returns 100 and then 80, because another transaction committed in between.">
      <line x1="20" y1="16" x2="20" y2="140" stroke={INK} strokeWidth="2" />
      <text x="30" y="14" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>your transaction</text>
      <rect x="30" y="24" width="86" height="20" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <text x="73" y="37" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={INK}>read → 100</text>
      <rect x="30" y="66" width="132" height="22" rx="2" fill="#fbf1ea" stroke={TERRA} strokeWidth="2" />
      <text x="96" y="80" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={TERRA}>someone else commits 80</text>
      <rect x="30" y="106" width="86" height="20" rx="2" fill="#fff" stroke={TERRA} strokeWidth="2" />
      <text x="73" y="119" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={TERRA}>read → 80</text>
      <text x="88" y="152" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>the ground moved mid-transaction</text>
    </svg>
  )
}

/** Ch 7 · Step 03 — MVCC: many versions, each read sees its own snapshot. */
export function MvccDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="A row keeps several versions stamped with transaction ids; a snapshot decides which version a reader sees.">
      <defs>
        <marker id="gn-mv" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={DENIM} /></marker>
      </defs>
      <text x="88" y="12" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>one row, three versions</text>
      <rect x="18" y="22" width="140" height="20" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <text x="88" y="35" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>v1 · xid 100</text>
      <rect x="18" y="48" width="140" height="20" rx="2" fill="#eaf0f8" stroke={DENIM} strokeWidth="2" />
      <text x="88" y="61" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={DENIM}>v2 · xid 205</text>
      <rect x="18" y="74" width="140" height="20" rx="2" fill="#fff" stroke={MUTED} strokeWidth="1.5" strokeDasharray="3 2" />
      <text x="88" y="87" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>v3 · xid 310 (not yet visible)</text>
      <path d="M8 58 L14 58" stroke={DENIM} strokeWidth="2" markerEnd="url(#gn-mv)" />
      <text x="88" y="112" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={DENIM}>your snapshot picks v2</text>
      <text x="88" y="132" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>writers add versions; readers</text>
      <text x="88" y="144" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>never wait — that’s MVCC</text>
    </svg>
  )
}

/** Ch 7 · Step 05 — 2PL blocks; SSI lets them run and aborts a loser. */
export function TwoPlSsiDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="Two-phase locking makes the second transaction wait; serializable snapshot isolation runs both and aborts one if a dangerous pattern appears.">
      <text x="44" y="12" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={DENIM}>2PL</text>
      <rect x="12" y="20" width="64" height="18" rx="2" fill={DENIM} stroke={INK} strokeWidth="1.5" />
      <text x="44" y="32" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill="#fff">T1 holds lock</text>
      <rect x="12" y="46" width="64" height="18" rx="2" fill="#fff" stroke={MUTED} strokeWidth="1.5" strokeDasharray="3 2" />
      <text x="44" y="58" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>T2 waits…</text>
      <text x="44" y="84" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>prevent</text>
      <text x="44" y="104" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>safe, but they</text>
      <text x="44" y="116" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>queue up</text>
      <line x1="88" y1="14" x2="88" y2="146" stroke={INK} strokeWidth="1.5" strokeDasharray="3 3" />
      <text x="132" y="12" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={TERRA}>SSI</text>
      <rect x="100" y="20" width="64" height="18" rx="2" fill={TERRA} stroke={INK} strokeWidth="1.5" />
      <text x="132" y="32" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill="#fff">T1 runs</text>
      <rect x="100" y="46" width="64" height="18" rx="2" fill={TERRA} stroke={INK} strokeWidth="1.5" />
      <text x="132" y="58" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill="#fff">T2 runs too</text>
      <text x="132" y="84" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>detect</text>
      <text x="132" y="104" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>fast, but a loser</text>
      <text x="132" y="116" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>gets aborted</text>
      <text x="88" y="152" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>block early, or retry later</text>
    </svg>
  )
}

/* ---------------- Ch 8 · The trouble with distributed systems ---------------- */

/** Ch 8 · Step 01 — one silence, five different causes. */
export function SilenceDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="After sending a request and hearing nothing, five different failures are indistinguishable from the caller's side.">
      <defs>
        <marker id="gn-si" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={INK} /></marker>
      </defs>
      <rect x="38" y="8" width="100" height="18" rx="2" fill={INK} stroke={INK} strokeWidth="1.5" />
      <text x="88" y="21" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill="#f7f4ef">you send a request</text>
      <path d="M88 26 L88 40" stroke={INK} strokeWidth="2" markerEnd="url(#gn-si)" />
      <text x="88" y="52" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={TERRA}>…silence…</text>
      {[
        'the request was lost',
        'it arrived, node died',
        'it is still working',
        'the reply was lost',
        'everything is just slow',
      ].map((t, i) => (
        <g key={t}>
          <rect x="10" y={62 + i * 16} width="156" height="13" rx="2" fill="#fff" stroke={MUTED} strokeWidth="1.2" />
          <text x="88" y={71 + i * 16} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={INK}>{t}</text>
        </g>
      ))}
      <text x="88" y="156" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={TERRA}>you cannot tell them apart</text>
    </svg>
  )
}

/** Ch 8 · Step 02 — two clocks disagree, so timestamps mis-order events. */
export function ClockSkewDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="Two machines with skewed clocks stamp events so that the later event carries an earlier timestamp.">
      <circle cx="44" cy="42" r="26" fill="#fff" stroke={INK} strokeWidth="2" />
      <path d="M44 42 L44 24 M44 42 L58 42" stroke={DENIM} strokeWidth="2" />
      <text x="44" y="80" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={DENIM}>node A · 10:00.5</text>
      <circle cx="132" cy="42" r="26" fill="#fff" stroke={INK} strokeWidth="2" />
      <path d="M132 42 L132 24 M132 42 L120 50" stroke={TERRA} strokeWidth="2" />
      <text x="132" y="80" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={TERRA}>node B · 09:59.8</text>
      <text x="88" y="100" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>B’s write really happened later</text>
      <rect x="18" y="110" width="140" height="24" rx="2" fill="#fbf1ea" stroke={TERRA} strokeWidth="2" />
      <text x="88" y="125" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={TERRA}>…but its timestamp is older</text>
      <text x="88" y="150" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>order by timestamp → lose the write</text>
    </svg>
  )
}

/** Ch 8 · Step 04 — a fencing token makes a stale writer harmless. */
export function FencingDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="The storage layer remembers the highest fencing token seen and rejects any write carrying an older token.">
      <defs>
        <marker id="gn-fe" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={INK} /></marker>
      </defs>
      <rect x="6" y="14" width="70" height="24" rx="2" fill="#fff" stroke={MUTED} strokeWidth="1.5" strokeDasharray="3 2" />
      <text x="41" y="24" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>zombie leader</text>
      <text x="41" y="34" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={TERRA}>token 32</text>
      <rect x="100" y="14" width="70" height="24" rx="2" fill={DENIM} stroke={INK} strokeWidth="1.5" />
      <text x="135" y="24" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill="#fff">new leader</text>
      <text x="135" y="34" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill="#dfe7f0">token 33</text>
      <path d="M41 40 L60 66" stroke={TERRA} strokeWidth="2" markerEnd="url(#gn-fe)" />
      <path d="M135 40 L116 66" stroke={DENIM} strokeWidth="2" markerEnd="url(#gn-fe)" />
      <rect x="30" y="70" width="116" height="30" rx="2" fill={INK} stroke={INK} strokeWidth="1.5" />
      <text x="88" y="83" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill="#f7f4ef">storage remembers</text>
      <text x="88" y="94" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill="#f7f4ef">highest token = 33</text>
      <text x="30" y="118" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={TERRA}>32 → rejected</text>
      <text x="146" y="118" textAnchor="end" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={DENIM}>33 → accepted</text>
      <text x="88" y="146" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>detection can be wrong; action can’t</text>
    </svg>
  )
}

/* ---------------- Ch 9 · Consistency & consensus ---------------- */

/** Ch 9 · Step 01 — eventual replicas diverge then converge; linearizable is one timeline. */
export function ConsistencyKindsDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="Eventual consistency lets replicas diverge before converging; linearizability behaves as a single copy on one timeline.">
      <text x="88" y="12" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={TERRA}>eventual</text>
      <path d="M12 34 C50 18 60 50 96 32 C130 16 150 34 164 30" fill="none" stroke={TERRA} strokeWidth="2" />
      <path d="M12 46 C50 62 60 30 96 48 C130 64 150 44 164 40" fill="none" stroke={MUTED} strokeWidth="2" strokeDasharray="3 3" />
      <circle cx="164" cy="35" r="5" fill={TERRA} stroke={INK} strokeWidth="1.5" />
      <text x="88" y="74" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>disagree for a while, then meet</text>
      <line x1="10" y1="88" x2="166" y2="88" stroke={INK} strokeWidth="1.5" strokeDasharray="3 3" />
      <text x="88" y="104" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={DENIM}>linearizable</text>
      <line x1="12" y1="122" x2="164" y2="122" stroke={DENIM} strokeWidth="2.5" />
      {[30, 66, 102, 138].map((x) => (
        <circle key={x} cx={x} cy="122" r="5" fill={DENIM} stroke={INK} strokeWidth="1.5" />
      ))}
      <text x="88" y="144" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>one copy, one order, no surprises</text>
      <text x="88" y="156" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={INK}>and it isn’t free</text>
    </svg>
  )
}

/** Ch 9 · Step 03 — an entry commits once a majority has stored it. */
export function LogCommitDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="The leader ships a log entry to followers; once a majority have stored it the entry is committed.">
      <defs>
        <marker id="gn-lc" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill={INK} /></marker>
      </defs>
      <rect x="10" y="12" width="60" height="18" rx="2" fill={DENIM} stroke={INK} strokeWidth="1.5" />
      <text x="40" y="25" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill="#fff">leader</text>
      {[
        { y: 44, ok: true, label: 'follower · stored' },
        { y: 68, ok: true, label: 'follower · stored' },
        { y: 92, ok: false, label: 'follower · behind' },
        { y: 116, ok: false, label: 'follower · down' },
      ].map((f) => (
        <g key={f.y}>
          <path d={`M70 26 L96 ${f.y + 8}`} stroke={f.ok ? INK : MUTED} strokeWidth={f.ok ? 2 : 1.2} strokeDasharray={f.ok ? undefined : '3 3'} markerEnd="url(#gn-lc)" />
          <rect x="100" y={f.y} width="70" height="17" rx="2" fill={f.ok ? '#eaf0f8' : '#fff'} stroke={f.ok ? DENIM : MUTED} strokeWidth={f.ok ? 2 : 1.2} />
          <text x="135" y={f.y + 12} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6" fill={f.ok ? DENIM : MUTED}>{f.label}</text>
        </g>
      ))}
      <text x="40" y="70" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>3 of 5</text>
      <text x="40" y="82" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>hold it</text>
      <rect x="6" y="94" width="70" height="24" rx="2" fill={DENIM} stroke={INK} strokeWidth="1.5" />
      <text x="41" y="109" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill="#fff">committed</text>
      <text x="88" y="146" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>a majority is enough — never all</text>
    </svg>
  )
}

/** Ch 9 · Step 04 — a split vote elects nobody; a stale leader steps down. */
export function SplitVoteDiagram() {
  return (
    <svg viewBox="0 0 176 160" role="img" aria-label="Two candidates split the vote so no one reaches a majority; a partitioned old leader on a lower term steps down.">
      <text x="88" y="12" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={MUTED}>term 7 — a tie</text>
      <circle cx="40" cy="38" r="16" fill={DENIM} stroke={INK} strokeWidth="1.5" />
      <text x="40" y="41" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill="#fff">2 votes</text>
      <circle cx="136" cy="38" r="16" fill={TERRA} stroke={INK} strokeWidth="1.5" />
      <text x="136" y="41" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill="#fff">2 votes</text>
      <text x="88" y="42" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>vs</text>
      <text x="88" y="66" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={TERRA}>neither has a majority</text>
      <text x="88" y="80" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>→ no leader this term</text>
      <line x1="10" y1="92" x2="166" y2="92" stroke={INK} strokeWidth="1.5" strokeDasharray="3 3" />
      <rect x="10" y="102" width="72" height="24" rx="2" fill="#fff" stroke={MUTED} strokeWidth="1.5" strokeDasharray="3 2" />
      <text x="46" y="112" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6" fill={MUTED}>old leader</text>
      <text x="46" y="122" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6" fill={MUTED}>term 6</text>
      <rect x="94" y="102" width="72" height="24" rx="2" fill={DENIM} stroke={INK} strokeWidth="1.5" />
      <text x="130" y="112" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6" fill="#fff">sees term 8</text>
      <text x="130" y="122" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6" fill="#dfe7f0">steps down</text>
      <text x="88" y="146" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>a tie costs latency, never correctness</text>
    </svg>
  )
}

/* ---- Ch 1 · Tail Latency ---- */

/** The distribution nobody draws: right-skewed, so the MEAN sits in the fat
 *  part while the p99 lives far out where nobody is looking. */
export function TailDiagram() {
  const bars = [
    [18, 10], [29, 30], [40, 52], [51, 62], [62, 54], [73, 40],
    [84, 28], [95, 19], [106, 13], [117, 9], [128, 7], [139, 5], [150, 4],
  ]
  return (
    <svg viewBox="0 0 180 132" role="img" aria-label="A right-skewed latency distribution: most requests are fast, a long tail is slow, and the mean sits above the median.">
      <line x1="14" y1="100" x2="166" y2="100" stroke={INK} strokeWidth="2" />
      {bars.map(([x, h]) => (
        <rect key={x} x={x} y={100 - h} width="9" height={h} fill={x <= 84 ? DENIM : TERRA} stroke={INK} strokeWidth="1.5" />
      ))}
      {/* median: where half the requests are */}
      <line x1="55" y1="18" x2="55" y2="100" stroke={INK} strokeWidth="1.5" strokeDasharray="3 3" />
      <text x="55" y="14" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={INK}>p50</text>
      {/* mean: dragged right by the tail, describing a request that rarely happens */}
      <line x1="72" y1="30" x2="72" y2="100" stroke={DENIM} strokeWidth="1.5" strokeDasharray="2 2" />
      <text x="76" y="27" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={DENIM}>mean</text>
      {/* p99: out in the tail */}
      <line x1="145" y1="44" x2="145" y2="100" stroke={TERRA} strokeWidth="2" strokeDasharray="3 2" />
      <text x="145" y="40" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={TERRA}>p99</text>
      <text x="90" y="115" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={MUTED}>response time →</text>
      <text x="90" y="127" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={MUTED}>the mean is not the middle</text>
    </svg>
  )
}

/** One request, many backends, and the answer waits for the slowest of them. */
export function FanoutTailDiagram() {
  return (
    <svg viewBox="0 0 180 140" role="img" aria-label="One request fans out to five backends; four are fast and one is slow, so the whole request is slow.">
      <defs>
        <marker id="gn-ft" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0 0 L7 3.5 L0 7 z" fill={MUTED} />
        </marker>
      </defs>
      <rect x="62" y="8" width="56" height="22" rx="4" fill={INK} stroke={INK} strokeWidth="2" />
      <text x="90" y="23" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8.5" fill="#fff">1 request</text>
      {[18, 54, 90, 126, 162].map((x, i) => (
        <g key={x}>
          <path d={`M90 32 L${x} 60`} stroke={MUTED} strokeWidth="1.5" markerEnd="url(#gn-ft)" />
          <rect x={x - 14} y="64" width="28" height="24" rx="3" fill={i === 3 ? TERRA : DENIM} stroke={INK} strokeWidth="2" />
          <text x={x} y="80" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill="#fff">
            {i === 3 ? 'slow' : 'fast'}
          </text>
        </g>
      ))}
      <text x="90" y="106" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={TERRA}>
        the answer waits for the slowest
      </text>
      <text x="90" y="122" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill={INK}>
        1 − 0.99¹⁰⁰ = 63%
      </text>
      <text x="90" y="134" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={MUTED}>
        of requests touch one slow backend
      </text>
    </svg>
  )
}

/** A hedged request: send a second copy once the first passes its p95, and
 *  take whichever returns. It only needs ONE of them to be fast. */
export function HedgeDiagram() {
  return (
    <svg viewBox="0 0 180 116" role="img" aria-label="A hedged request: the first copy runs long, a second is sent at the p95 mark, and the earlier reply wins.">
      <defs>
        <marker id="gn-hg" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0 0 L7 3.5 L0 7 z" fill={INK} />
        </marker>
      </defs>
      {/* the unlucky first copy */}
      <text x="6" y="26" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={MUTED}>copy 1</text>
      <rect x="44" y="18" width="108" height="12" rx="2" fill={TERRA} stroke={INK} strokeWidth="1.5" />
      <text x="98" y="27" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill="#fff">stuck behind something</text>
      {/* the p95 mark, where the hedge fires */}
      <line x1="86" y1="10" x2="86" y2="86" stroke={INK} strokeWidth="1.5" strokeDasharray="3 3" />
      <text x="86" y="8" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>p95</text>
      {/* the hedge */}
      <text x="6" y="58" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={MUTED}>copy 2</text>
      <rect x="86" y="50" width="30" height="12" rx="2" fill={DENIM} stroke={INK} strokeWidth="1.5" />
      <path d="M116 56 L136 56" stroke={INK} strokeWidth="2" markerEnd="url(#gn-hg)" />
      <text x="140" y="59" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={DENIM}>wins</text>
      <text x="90" y="102" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={INK}>1,800 ms → 74 ms at the p99</text>
      <text x="90" y="113" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={MUTED}>for 2% more requests</text>
    </svg>
  )
}

/* ---- Ch 10 · Batch Processing ---- */

/** The shuffle: every mapper sends to every reducer, because a key can appear
 *  in any input split and all of its records must land in one place. */
export function ShuffleDiagram() {
  const M = [30, 90, 150]
  const R = [30, 90, 150]
  return (
    <svg viewBox="0 0 180 140" role="img" aria-label="Three mappers each sending to all three reducers, an all-to-all shuffle across the network.">
      {M.map((x) => R.map((r) => <line key={`${x}-${r}`} x1={x} y1="42" x2={r} y2="94" stroke={MUTED} strokeWidth="1" />))}
      {M.map((x, i) => (
        <g key={x}>
          <rect x={x - 22} y="18" width="44" height="24" rx="3" fill={DENIM} stroke={INK} strokeWidth="2" />
          <text x={x} y="34" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill="#fff">map {i + 1}</text>
        </g>
      ))}
      {R.map((x, i) => (
        <g key={x}>
          <rect x={x - 22} y="94" width="44" height="24" rx="3" fill={INK} stroke={INK} strokeWidth="2" />
          <text x={x} y="110" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill="#fff">red {i + 1}</text>
        </g>
      ))}
      <text x="90" y="10" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={MUTED}>every key, sorted to one place</text>
      <text x="90" y="132" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={TERRA}>M × R connections across the network</text>
    </svg>
  )
}

/** The join that skips the shuffle entirely: if one side fits in memory, ship a
 *  copy to every mapper and never move the big side at all. */
export function BroadcastJoinDiagram() {
  return (
    <svg viewBox="0 0 180 126" role="img" aria-label="A small table broadcast to every mapper, so the large table never moves across the network.">
      <defs>
        <marker id="gn-bj" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0 0 L7 3.5 L0 7 z" fill={DENIM} />
        </marker>
      </defs>
      <rect x="60" y="8" width="60" height="20" rx="3" fill={DENIM} stroke={INK} strokeWidth="2" />
      <text x="90" y="22" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill="#fff">small side</text>
      {[30, 90, 150].map((x) => (
        <g key={x}>
          <path d={`M90 30 L${x} 54`} stroke={DENIM} strokeWidth="1.5" strokeDasharray="3 2" markerEnd="url(#gn-bj)" />
          <rect x={x - 24} y="58" width="48" height="26" rx="3" fill="#fff" stroke={INK} strokeWidth="2" />
          <text x={x} y="70" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>mapper</text>
          <text x={x} y="80" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>+ its split</text>
        </g>
      ))}
      <text x="90" y="102" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={INK}>no shuffle at all</text>
      <text x="90" y="118" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={MUTED}>the big side never moves</text>
    </svg>
  )
}

/** Skew: one hot key means one reducer, and one reducer means one job. */
export function SkewDiagram() {
  const bars = [[20, 12], [44, 10], [68, 14], [92, 74], [116, 11], [140, 13]]
  return (
    <svg viewBox="0 0 180 130" role="img" aria-label="Six reducers, one of them doing far more work than the rest because a single key is hot.">
      <line x1="12" y1="96" x2="168" y2="96" stroke={INK} strokeWidth="2" />
      {bars.map(([x, h], i) => (
        <g key={x}>
          <rect x={x} y={96 - h} width="20" height={h} fill={i === 3 ? TERRA : DENIM} stroke={INK} strokeWidth="1.5" />
          <text x={x + 10} y="106" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>r{i + 1}</text>
        </g>
      ))}
      <text x="102" y="16" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={TERRA}>one hot key</text>
      <text x="90" y="120" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={INK}>the job ends when r4 ends</text>
    </svg>
  )
}

/* ---- Ch 11 · Stream Processing ---- */

/** The duality, drawn: a table is the current state, a stream is the changes,
 *  and each one turns into the other. */
export function DualityDiagram() {
  return (
    <svg viewBox="0 0 180 128" role="img" aria-label="A table and a stream converting into each other: a changelog turns a table into a stream, replay turns a stream back into a table.">
      <defs>
        <marker id="gn-du" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0 0 L7 3.5 L0 7 z" fill={INK} />
        </marker>
      </defs>
      <rect x="10" y="42" width="56" height="40" rx="3" fill={DENIM} stroke={INK} strokeWidth="2" />
      <text x="38" y="60" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8.5" fill="#fff">table</text>
      <text x="38" y="72" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill="#dbe3ee">state now</text>
      <rect x="114" y="42" width="56" height="40" rx="3" fill={INK} stroke={INK} strokeWidth="2" />
      <text x="142" y="60" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8.5" fill="#fff">stream</text>
      <text x="142" y="72" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill="#c9c2b6">every change</text>
      <path d="M68 52 L112 52" stroke={INK} strokeWidth="2" markerEnd="url(#gn-du)" />
      <text x="90" y="46" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>changelog</text>
      <path d="M112 74 L68 74" stroke={TERRA} strokeWidth="2" markerEnd="url(#gn-du)" />
      <text x="90" y="90" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={TERRA}>replay</text>
      <text x="90" y="112" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={MUTED}>two views of one fact</text>
      <text x="90" y="124" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={MUTED}>the log is the one that is true</text>
    </svg>
  )
}

/** Log compaction: keep the newest value per key and the log becomes the table. */
export function CompactionDiagram() {
  const before = [['a', 1], ['b', 1], ['a', 2], ['c', 1], ['b', 2], ['a', 3]] as [string, number][]
  const after = [['b', 2], ['c', 1], ['a', 3]] as [string, number][]
  return (
    <svg viewBox="0 0 180 118" role="img" aria-label="A log with repeated keys compacting down to one record per key, which is the table.">
      <defs>
        <marker id="gn-cp" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0 0 L7 3.5 L0 7 z" fill={INK} />
        </marker>
      </defs>
      <text x="6" y="16" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>log</text>
      {before.map(([k, val], i) => (
        <g key={i}>
          <rect x={6 + i * 28} y="22" width="24" height="20" rx="2"
            fill={(k === 'a' && val < 3) || (k === 'b' && val < 2) ? '#fff' : DENIM}
            stroke={INK} strokeWidth="1.5" />
          <text x={18 + i * 28} y="36" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5"
            fill={(k === 'a' && val < 3) || (k === 'b' && val < 2) ? MUTED : '#fff'}>{k}={val}</text>
        </g>
      ))}
      <path d="M90 48 L90 62" stroke={INK} strokeWidth="2" markerEnd="url(#gn-cp)" />
      <text x="96" y="59" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>compact</text>
      <text x="6" y="80" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>table</text>
      {after.map(([k, val], i) => (
        <g key={i}>
          <rect x={40 + i * 34} y="70" width="30" height="20" rx="2" fill={DENIM} stroke={INK} strokeWidth="1.5" />
          <text x={55 + i * 34} y="84" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill="#fff">{k}={val}</text>
        </g>
      ))}
      <text x="90" y="110" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={MUTED}>one record per key, whatever the history</text>
    </svg>
  )
}

/** Windows: the same events, cut three different ways. */
export function WindowDiagram() {
  return (
    <svg viewBox="0 0 180 132" role="img" aria-label="A timeline of events cut into tumbling, hopping and session windows.">
      {[22, 62, 102].map((y, row) => (
        <g key={y}>
          <line x1="10" y1={y + 16} x2="170" y2={y + 16} stroke={MUTED} strokeWidth="1" />
          {row === 0 && [10, 62, 114].map((x) => (
            <rect key={x} x={x} y={y} width="50" height="16" rx="2" fill="none" stroke={DENIM} strokeWidth="2" />
          ))}
          {row === 1 && [10, 40, 70, 100, 130].map((x, i) => (
            <rect key={x} x={x} y={y + (i % 2) * 4 - 2} width="46" height="14" rx="2" fill="none" stroke={DENIM} strokeWidth="1.5" opacity="0.9" />
          ))}
          {row === 2 && [[12, 34], [70, 26], [120, 44]].map(([x, w]) => (
            <rect key={x} x={x} y={y} width={w} height="16" rx="2" fill="none" stroke={TERRA} strokeWidth="2" />
          ))}
        </g>
      ))}
      <text x="10" y="14" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>tumbling · fixed, no overlap</text>
      <text x="10" y="54" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>hopping · fixed, overlapping</text>
      <text x="10" y="94" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>session · gaps decide the edges</text>
      <text x="90" y="128" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={MUTED}>same events, three answers</text>
    </svg>
  )
}

/* ---------------------------------------------------------------------------
   In-the-wild figures. Wider and shorter than a panel diagram, because they
   sit inside a list item rather than a panel, and capped at 420px by
   .gn-wild-fig — so the usable text size is close to a panel's despite the
   wider viewBox. Only bullets whose subject is a SEQUENCE or a MISMATCH get
   one; prose is better at everything else.
   --------------------------------------------------------------------------- */

/** Ch 5 quorum · wild 1 — a read waits on the slowest of its R replicas. */
export function SlowestOfRDiagram() {
  return (
    <svg viewBox="0 0 240 92" role="img" aria-label="Three replicas answer in 2, 3 and 40 milliseconds; the read cannot return until the slowest one does, so it takes 40 milliseconds.">
      <defs>
        <marker id="gn-sor-m" markerWidth="6" markerHeight="6" refX="4.5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={MUTED} /></marker>
        <marker id="gn-sor-t" markerWidth="6" markerHeight="6" refX="4.5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={TERRA} /></marker>
      </defs>
      <rect x="6" y="8" width="56" height="16" rx="2" fill="#fff" stroke={MUTED} strokeWidth="1.5" />
      <text x="34" y="19" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>A · 2 ms</text>
      <rect x="6" y="30" width="56" height="16" rx="2" fill="#fff" stroke={MUTED} strokeWidth="1.5" />
      <text x="34" y="41" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>B · 3 ms</text>
      <rect x="6" y="52" width="56" height="16" rx="2" fill="#fbf1ea" stroke={TERRA} strokeWidth="2" />
      <text x="34" y="63" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={TERRA}>C · 40 ms</text>
      <path d="M64 16 L128 32" stroke={MUTED} strokeWidth="1.5" markerEnd="url(#gn-sor-m)" />
      <path d="M64 38 L128 38" stroke={MUTED} strokeWidth="1.5" markerEnd="url(#gn-sor-m)" />
      <path d="M64 60 L128 44" stroke={TERRA} strokeWidth="2" markerEnd="url(#gn-sor-t)" />
      <rect x="134" y="24" width="100" height="28" rx="2" fill="#fff" stroke={TERRA} strokeWidth="2" />
      <text x="184" y="36" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>read returns</text>
      <text x="184" y="47" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={TERRA}>at 40 ms</text>
      <text x="120" y="84" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={MUTED}>the slowest replica sets the latency</text>
    </svg>
  )
}

/** Ch 5 quorum · wild 2 — a replica that missed the delete hands the value back. */
export function ZombieValueDiagram() {
  return (
    <svg viewBox="0 0 240 88" role="img" aria-label="A delete happens while replica C is offline; C rejoins still holding the old value, and a later read gets it back.">
      <line x1="14" y1="46" x2="226" y2="46" stroke={INK} strokeWidth="1.5" />
      <circle cx="40" cy="46" r="4" fill={DENIM} />
      <text x="40" y="32" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={DENIM}>delete</text>
      <text x="40" y="62" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>C offline</text>
      <circle cx="122" cy="46" r="4" fill={MUTED} />
      <text x="122" y="32" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>C rejoins</text>
      <circle cx="198" cy="46" r="4" fill={TERRA} />
      <text x="198" y="32" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>read</text>
      <text x="198" y="62" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={TERRA}>old value</text>
      <text x="120" y="80" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={MUTED}>a tombstone is what tells C it was deleted</text>
    </svg>
  )
}

/** Ch 5 quorum · wild 3 — last-write-wins on skewed clocks drops the newer write.
 *  Distinct from Ch 8's ClockSkewDiagram, which shows the clocks themselves
 *  disagreeing; this one shows what LWW then does with those timestamps. */
export function LwwSkewDiagram() {
  return (
    <svg viewBox="0 0 240 96" role="img" aria-label="Two writes carry clock timestamps that disagree with the order they happened in, so last-write-wins keeps the older write and silently drops the newer one.">
      <defs>
        <marker id="gn-skew" markerWidth="6" markerHeight="6" refX="4.5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={MUTED} /></marker>
      </defs>
      <rect x="6" y="8" width="92" height="28" rx="2" fill="#fff" stroke={TERRA} strokeWidth="2" />
      <text x="52" y="20" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>A — happened 2nd</text>
      <text x="52" y="31" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>clock says 10:00:03</text>
      <rect x="6" y="44" width="92" height="28" rx="2" fill="#fff" stroke={MUTED} strokeWidth="1.5" />
      <text x="52" y="56" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>B — happened 1st</text>
      <text x="52" y="67" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>clock says 10:00:07</text>
      <path d="M100 22 L134 32" stroke={MUTED} strokeWidth="1.5" markerEnd="url(#gn-skew)" />
      <path d="M100 58 L134 46" stroke={MUTED} strokeWidth="1.5" markerEnd="url(#gn-skew)" />
      <rect x="140" y="26" width="94" height="28" rx="2" fill="#fbf1ea" stroke={TERRA} strokeWidth="2" />
      <text x="187" y="38" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={INK}>keeps max(ts)</text>
      <text x="187" y="49" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={TERRA}>B wins</text>
      <text x="120" y="88" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={MUTED}>the newer write is the one that vanishes</text>
    </svg>
  )
}

/** Ch 5 quorum · wild 4 — a sloppy quorum writes somewhere the read never looks. */
export function SloppyQuorumDiagram() {
  return (
    <svg viewBox="0 0 240 92" role="img" aria-label="A write is accepted by stand-in nodes D and E, while a later read asks the key's real replicas A, B and C, which never received it.">
      <defs>
        <marker id="gn-slp-d" markerWidth="6" markerHeight="6" refX="4.5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={DENIM} /></marker>
        <marker id="gn-slp-t" markerWidth="6" markerHeight="6" refX="4.5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={TERRA} /></marker>
      </defs>
      <text x="6" y="23" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={DENIM}>write</text>
      <path d="M36 19 L54 19" stroke={DENIM} strokeWidth="2" markerEnd="url(#gn-slp-d)" />
      <rect x="58" y="10" width="24" height="18" rx="2" fill="#fff" stroke={DENIM} strokeWidth="2" />
      <text x="70" y="23" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={DENIM}>D</text>
      <rect x="88" y="10" width="24" height="18" rx="2" fill="#fff" stroke={DENIM} strokeWidth="2" />
      <text x="100" y="23" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={DENIM}>E</text>
      <text x="120" y="23" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={MUTED}>stand-ins, not the key’s nodes</text>
      <text x="6" y="61" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={TERRA}>read</text>
      <path d="M36 57 L54 57" stroke={TERRA} strokeWidth="2" markerEnd="url(#gn-slp-t)" />
      <rect x="58" y="48" width="24" height="18" rx="2" fill="#fff" stroke={MUTED} strokeWidth="1.5" strokeDasharray="3 2" />
      <text x="70" y="61" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={MUTED}>A</text>
      <rect x="88" y="48" width="24" height="18" rx="2" fill="#fff" stroke={MUTED} strokeWidth="1.5" strokeDasharray="3 2" />
      <text x="100" y="61" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={MUTED}>B</text>
      <rect x="118" y="48" width="24" height="18" rx="2" fill="#fff" stroke={MUTED} strokeWidth="1.5" strokeDasharray="3 2" />
      <text x="130" y="61" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={MUTED}>C</text>
      <text x="148" y="61" fontFamily="JetBrains Mono, monospace" fontSize="6.5" fill={TERRA}>never got it</text>
      <text x="120" y="84" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7" fill={MUTED}>it succeeded — the read looks in the right place</text>
    </svg>
  )
}
