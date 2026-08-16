/* Chapter diagrams for the papers book. Same conventions as src/read/diagrams.tsx:
   small, self-contained SVGs on the paper palette — ink #1a1a1a · denim #3f6191 ·
   terra #bd5f3d · muted #8a8177.

   Layout discipline learned the hard way: mono text is ~0.6em per character, so
   at fontSize 7 a 24-char line needs ~100 viewBox units. Every label below was
   budgeted against that before placing — eyeball the rendered SVG anyway. */

const INK = '#1a1a1a'
const DENIM = '#3f6191'
const TERRA = '#bd5f3d'
const MUTED = '#8a8177'
const MONO = 'JetBrains Mono, monospace'

/** Interlude — the RUM triangle. Corners are the three overheads; a design sits
 *  near the corners it minimises. Positions are illustrative, not measured, and
 *  the drawing says so — this is a lens, not a benchmark. */
export function RumTriangleDiagram() {
  // apex R at top, U bottom-left, M bottom-right
  const A: [number, number] = [172, 30]
  const B: [number, number] = [46, 132]
  const C: [number, number] = [298, 132]
  /* Labels sit BELOW their dot, never above. The first draft put them above and
     the geometry lint found the triangle's own left edge drawn straight through
     "B-tree" — near the apex the interior is only ~70 units wide, which is three
     words. Anything placed up there has to be checked against the edge at that
     exact y, so the rule is simpler: label downwards, into the wide part. */
  const dot = (x: number, y: number, label: string, accent: string) => (
    <>
      <circle cx={x} cy={y} r="4" fill={accent} />
      <text x={x} y={y + 12} textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={accent}>
        {label}
      </text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 190"
      role="img"
      aria-label="A triangle whose corners are read, update and memory overhead. A B-tree sits toward read, an LSM tree toward update, a heap file toward memory: every access method minimises two and pays the third."
    >
      <text x="8" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        pick two corners — the third sends the bill
      </text>
      <path
        d={`M${A[0]} ${A[1]} L${B[0]} ${B[1]} L${C[0]} ${C[1]} Z`}
        fill="none"
        stroke={INK}
        strokeWidth="1.8"
      />
      <text x="172" y="24" textAnchor="middle" fontFamily={MONO} fontSize="7.4" fill={INK}>
        READ
      </text>
      <text x="36" y="146" textAnchor="start" fontFamily={MONO} fontSize="7.4" fill={INK}>
        UPDATE
      </text>
      <text x="308" y="146" textAnchor="end" fontFamily={MONO} fontSize="7.4" fill={INK}>
        MEMORY
      </text>

      {dot(172, 52, 'all indexed', DENIM)}
      {dot(143, 80, 'B-tree', DENIM)}
      {dot(100, 110, 'LSM tree', TERRA)}
      {dot(248, 110, 'no index', MUTED)}

      <text x="8" y="168" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        nearer a corner = cheaper on that overhead
      </text>
      <text x="8" y="182" fontFamily={MONO} fontSize="6.2" fill={TERRA}>
        positions are the argument, not a measurement
      </text>
    </svg>
  )
}

/** Interlude — you cannot leave the triangle, but you can buy along it. Each
 *  row is a mechanism, what it spends, and what it buys back. */
export function RumTradesDiagram() {
  const row = (y: number, name: string, spend: string, buy: string) => (
    <>
      <text x="10" y={y} fontFamily={MONO} fontSize="6.4" fill={INK}>{name}</text>
      <text x="128" y={y} fontFamily={MONO} fontSize="6.4" fill={TERRA}>{spend}</text>
      <text x="196" y={y} fontFamily={MONO} fontSize="6.4" fill={MUTED}>→</text>
      <text x="216" y={y} fontFamily={MONO} fontSize="6.4" fill={DENIM}>{buy}</text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 140"
      role="img"
      aria-label="Bloom filters spend memory to buy reads; compaction spends updates to buy reads and memory; compression spends read cost to buy memory; caching spends memory to buy reads."
    >
      <text x="10" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        every optimisation is a purchase
      </text>
      <text x="128" y="30" fontFamily={MONO} fontSize="6" fill={MUTED}>spends</text>
      <text x="216" y="30" fontFamily={MONO} fontSize="6" fill={MUTED}>buys</text>
      <line x1="10" y1="36" x2="334" y2="36" stroke={MUTED} strokeWidth="0.8" />
      {row(52, 'bloom filter', 'memory', 'reads')}
      {row(70, 'compaction', 'updates', 'reads + memory')}
      {row(88, 'compression', 'reads (decode)', 'memory')}
      {row(106, 'a second index', 'memory + updates', 'reads')}
      <text x="172" y="130" textAnchor="middle" fontFamily={MONO} fontSize="6.6" fill={INK}>
        &ldquo;just faster&rdquo; is not an answer — ask which one it spent
      </text>
    </svg>
  )
}

/** Interlude — the CAP proof, which is one paragraph long and almost nobody
 *  has read. Two servers, a lost message, and a node that has to answer a
 *  question it cannot answer correctly. Drawn because the argument is short
 *  enough to fit in a picture, and seeing that is most of the point. */
export function CapProofDiagram() {
  const server = (x: number, name: string, sub: string) => (
    <>
      <rect x={x} y="44" width="104" height="30" fill="#fff" stroke={INK} strokeWidth="1.6" />
      <text x={x + 10} y="58" fontFamily={MONO} fontSize="7" fill={INK}>{name}</text>
      <text x={x + 10} y="68" fontFamily={MONO} fontSize="6" fill={MUTED}>{sub}</text>
    </>
  )
  const outcome = (x: number, head: string, what: string, lost: string) => (
    <>
      <rect x={x} y="112" width="140" height="42" fill="none" stroke={TERRA} strokeWidth="1.6" />
      <text x={x + 10} y="126" fontFamily={MONO} fontSize="6.6" fill={TERRA}>{head}</text>
      <text x={x + 10} y="137" fontFamily={MONO} fontSize="6" fill={INK}>{what}</text>
      <text x={x + 10} y="148" fontFamily={MONO} fontSize="6" fill={TERRA}>{lost}</text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 186"
      role="img"
      aria-label="Two servers separated by a partition. One took a write and acknowledged it; the other never heard. A read arriving at the second server can answer with the stale value, losing consistency, or wait forever, losing availability. There is no third option."
    >
      <text x="14" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        the whole proof, in one picture
      </text>
      <text x="172" y="34" textAnchor="middle" fontFamily={MONO} fontSize="6" fill={TERRA}>
        every message between them is lost
      </text>
      {/* the partition itself: a gap the drawing leaves empty on purpose */}
      <line x1="172" y1="40" x2="172" y2="92" stroke={TERRA} strokeWidth="1.6" strokeDasharray="4 4" />
      {server(20, 'p1', 'took write v2, said ok')}
      {server(220, 'p2', 'never heard about it')}

      <line x1="14" y1="92" x2="330" y2="92" stroke={MUTED} strokeWidth="0.8" />
      <text x="172" y="106" textAnchor="middle" fontFamily={MONO} fontSize="6.6" fill={INK}>
        a read reaches p2. It has two options, and no third
      </text>
      {outcome(20, 'ANSWER', 'hands back the old v1', 'consistency is gone')}
      {outcome(184, 'WAIT FOR p1', 'the read never returns', 'availability is gone')}

      <text x="172" y="176" textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        that is the entire theorem — the rest is what you do about it
      </text>
    </svg>
  )
}

/** Interlude — PACELC. CAP describes the rare case and says nothing about the
 *  common one; the else-clause is where a system spends almost all of its life.
 *  Classifications are Abadi's own, from the 2012 paper, not my reading. */
export function PacelcDiagram() {
  const row = (y: number, name: string, p: string, e: string, code: string, accent: string) => (
    <>
      <text x="14" y={y} fontFamily={MONO} fontSize="6.4" fill={INK}>{name}</text>
      <text x="132" y={y} fontFamily={MONO} fontSize="6.4" fill={accent}>{p}</text>
      <text x="214" y={y} fontFamily={MONO} fontSize="6.4" fill={accent}>{e}</text>
      <text x="286" y={y} fontFamily={MONO} fontSize="6.4" fill={MUTED}>{code}</text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 196"
      role="img"
      aria-label="PACELC: if partitioned, a system keeps availability or consistency; else it keeps latency or consistency. Dynamo and Cassandra keep availability then latency; Bigtable and HBase keep consistency in both cases; MongoDB keeps availability under partition and consistency otherwise."
    >
      <text x="14" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        the question CAP forgets to ask
      </text>
      <text x="14" y="30" fontFamily={MONO} fontSize="6.4" fill={INK}>
        if Partitioned: A or C. Else: Latency or C.
      </text>
      <text x="132" y="48" fontFamily={MONO} fontSize="6" fill={MUTED}>partitioned</text>
      <text x="214" y="48" fontFamily={MONO} fontSize="6" fill={MUTED}>otherwise</text>
      <line x1="14" y1="54" x2="330" y2="54" stroke={MUTED} strokeWidth="0.8" />
      {row(72, 'Dynamo', 'available', 'fast', 'PA/EL', TERRA)}
      {row(90, 'Cassandra', 'available', 'fast', 'PA/EL', TERRA)}
      {row(108, 'Bigtable / HBase', 'consistent', 'consistent', 'PC/EC', DENIM)}
      {row(126, 'MongoDB', 'available', 'consistent', 'PA/EC', INK)}
      <text x="14" y="158" fontFamily={MONO} fontSize="6.2" fill={INK}>
        CAP describes only the first column
      </text>
      <text x="14" y="172" fontFamily={MONO} fontSize="6.2" fill={TERRA}>
        the second is where your system spends its life
      </text>
      <text x="14" y="188" fontFamily={MONO} fontSize="6" fill={MUTED}>
        classifications from Abadi 2012
      </text>
    </svg>
  )
}

/** Ch 8 — the one idea underneath every consensus algorithm, which is a fact
 *  about sets rather than about computers: two majorities of the same group
 *  cannot be disjoint, so whatever the first one decided, the second one has
 *  somebody in it who remembers. */
export function QuorumOverlapDiagram() {
  const node = (key: string, x: number, y: number, label: string, fill: string, stroke: string) => (
    <g key={key}>
      <circle cx={x} cy={y} r="15" fill={fill} stroke={stroke} strokeWidth="1.8" />
      <text x={x} y={y + 3} textAnchor="middle" fontFamily={MONO} fontSize="7.6" fill={stroke}>{label}</text>
    </g>
  )
  const row = (y: number, members: boolean[], accent: string) =>
    members.map((inSet, i) =>
      node(
        `${y}-${i}`,
        46 + i * 63,
        y,
        ['A', 'B', 'C', 'D', 'E'][i],
        inSet ? (accent === DENIM ? '#e8edf5' : '#f6e9e2') : '#fff',
        inSet ? accent : MUTED,
      ),
    )
  return (
    <svg
      viewBox="0 0 344 214"
      role="img"
      aria-label="Five servers. One majority of three and another majority of three, chosen differently, must still share at least one server — so the second group always contains somebody who remembers what the first decided."
    >
      <text x="14" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        five servers, two different majorities
      </text>
      <text x="14" y="36" fontFamily={MONO} fontSize="6.4" fill={DENIM}>first round accepted by</text>
      {row(62, [true, true, true, false, false], DENIM)}
      <text x="14" y="112" fontFamily={MONO} fontSize="6.4" fill={TERRA}>later round asks</text>
      {row(138, [false, false, true, true, true], TERRA)}
      <text x="172" y="176" textAnchor="middle" fontFamily={MONO} fontSize="6.6" fill={INK}>
        C is in both, and C cannot forget
      </text>
      <text x="172" y="192" textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        no arrangement of two majorities avoids this
      </text>
      <text x="172" y="208" textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={DENIM}>
        that overlap is the entire safety argument
      </text>
    </svg>
  )
}

/** Ch 8 — the measurement that justified writing a second paper about an
 *  algorithm that already worked. Understandability is not usually something
 *  anyone puts a number on. */
export function RaftStudyDiagram() {
  const bar = (y: number, label: string, score: number, accent: string) => (
    <>
      <text x="14" y={y + 4} fontFamily={MONO} fontSize="6.4" fill={INK}>{label}</text>
      <rect x="96" y={y - 6} width={(score / 60) * 200} height="13" fill={accent === DENIM ? '#e8edf5' : '#f6e9e2'} stroke={accent} strokeWidth="1.4" />
      <text x={100 + (score / 60) * 200} y={y + 4} fontFamily={MONO} fontSize="6.4" fill={accent}>{score}</text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 176"
      role="img"
      aria-label="43 students each learned both algorithms and took both quizzes. Mean score out of 60 was 25.7 for Raft and 20.8 for Paxos, and 33 of the 43 scored higher on Raft — despite 15 of them having prior Paxos experience and the Paxos lecture being longer."
    >
      <text x="14" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        43 students, both lectures, both quizzes
      </text>
      <text x="96" y="32" fontFamily={MONO} fontSize="6" fill={MUTED}>mean score, out of 60</text>
      {bar(56, 'Raft', 25.7, DENIM)}
      {bar(80, 'Paxos', 20.8, TERRA)}
      <text x="14" y="116" fontFamily={MONO} fontSize="6.2" fill={INK}>
        33 of 43 scored higher on Raft
      </text>
      <text x="14" y="132" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        and the study was tilted toward Paxos:
      </text>
      <text x="14" y="146" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        15 had prior Paxos experience, and its lecture ran 14% longer
      </text>
      <text x="14" y="166" fontFamily={MONO} fontSize="6.2" fill={DENIM}>
        an algorithms paper with a control group
      </text>
    </svg>
  )
}

/** Ch 9 — the paper's Table 1, and the most useful shape in the whole act:
 *  adding servers makes reads faster and writes slower, measured, on one page. */
export function ZkThroughputDiagram() {
  const row = (y: number, servers: string, reads: string, writes: string) => (
    <>
      <text x="20" y={y} fontFamily={MONO} fontSize="6.4" fill={INK}>{servers}</text>
      <text x="110" y={y} fontFamily={MONO} fontSize="6.4" fill={DENIM}>{reads}</text>
      <text x="220" y={y} fontFamily={MONO} fontSize="6.4" fill={TERRA}>{writes}</text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 190"
      role="img"
      aria-label="Saturated throughput by cluster size: 3 servers do 87 thousand reads and 21 thousand writes per second; 13 servers do 460 thousand reads and 8 thousand writes. Adding servers multiplies read capacity and divides write capacity."
    >
      <text x="20" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        saturated throughput, ops/sec (Table 1)
      </text>
      <text x="110" y="32" fontFamily={MONO} fontSize="6" fill={MUTED}>all reads</text>
      <text x="220" y="32" fontFamily={MONO} fontSize="6" fill={MUTED}>all writes</text>
      <line x1="20" y1="38" x2="324" y2="38" stroke={MUTED} strokeWidth="0.8" />
      {row(56, '3 servers', '87,000', '21,000')}
      {row(74, '5 servers', '165,000', '18,000')}
      {row(92, '7 servers', '257,000', '14,000')}
      {row(110, '9 servers', '296,000', '12,000')}
      {row(128, '13 servers', '460,000', '8,000')}
      <text x="20" y="158" fontFamily={MONO} fontSize="6.2" fill={DENIM}>
        more servers → more read capacity
      </text>
      <text x="20" y="174" fontFamily={MONO} fontSize="6.2" fill={TERRA}>
        more servers → LESS write capacity, and less fault to spare
      </text>
    </svg>
  )
}

/** Ch 7 — the paper's Figure 1, redrawn with time running downward because that
 *  is the direction a web page is read. Deliberately carries NO per-event text
 *  labels: nine small labels beside three vertical lines and four diagonal
 *  arrows is a geometry-lint fight with nothing to win, and colour says the
 *  same thing. Denim is a path that exists; terra is a pair with no path
 *  either way. */
export function HappenedBeforeDiagram() {
  const X = { p: 60, q: 172, r: 284 }
  const dot = (x: number, y: number, fill = INK, r = 3.4) => <circle cx={x} cy={y} r={r} fill={fill} />
  return (
    <svg
      viewBox="0 0 344 208"
      role="img"
      aria-label="Three process lines with events and messages between them. A chain of message and process steps links one event on P to a later event on P, so those are ordered. Another pair, one on P and one on R, has no path in either direction, so nothing can order them."
    >
      <defs>
        <marker id="pb-hb" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
          <path d="M0 0 L7 3.5 L0 7 z" fill={MUTED} />
        </marker>
        <marker id="pb-hbd" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
          <path d="M0 0 L7 3.5 L0 7 z" fill={DENIM} />
        </marker>
      </defs>
      <text x="14" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        time runs downward · each line is one process
      </text>
      {(['p', 'q', 'r'] as const).map((k, i) => (
        <g key={k}>
          <text x={X[k]} y="32" textAnchor="middle" fontFamily={MONO} fontSize="7.4" fill={INK}>
            {['P', 'Q', 'R'][i]}
          </text>
          <line x1={X[k]} y1="40" x2={X[k]} y2="172" stroke={MUTED} strokeWidth="1.2" />
        </g>
      ))}

      {/* the ordered chain: P's first event reaches P's last, the long way round */}
      <path d={`M${X.p} 56 L${X.q} 76`} stroke={DENIM} strokeWidth="2" markerEnd="url(#pb-hbd)" />
      <line x1={X.q} y1="76" x2={X.q} y2="116" stroke={DENIM} strokeWidth="2" />
      <path d={`M${X.q} 116 L${X.p} 136`} stroke={DENIM} strokeWidth="2" markerEnd="url(#pb-hbd)" />

      {/* the other traffic, which is what makes the concurrent pair interesting */}
      <path d={`M${X.q} 50 L${X.r} 64`} stroke={MUTED} strokeWidth="1.3" markerEnd="url(#pb-hb)" />
      <path d={`M${X.r} 110 L${X.q} 156`} stroke={MUTED} strokeWidth="1.3" markerEnd="url(#pb-hb)" />

      {dot(X.p, 56, DENIM)}
      {dot(X.q, 76, DENIM)}
      {dot(X.q, 116, DENIM)}
      {dot(X.p, 136, DENIM)}
      {dot(X.q, 50)}
      {dot(X.q, 156)}
      {dot(X.r, 64)}
      {/* the concurrent pair */}
      {dot(X.p, 96, TERRA, 4.4)}
      {dot(X.r, 110, TERRA, 4.4)}

      <text x="14" y="190" fontFamily={MONO} fontSize="6.2" fill={DENIM}>
        a path exists — so this happened before that
      </text>
      <text x="14" y="202" fontFamily={MONO} fontSize="6.2" fill={TERRA}>
        no path either way — concurrent, and no clock fixes it
      </text>
    </svg>
  )
}

/** Ch 7 — the anomaly, which is the paper's own objection to its own answer.
 *  Information can travel by a route the system cannot see, and then the total
 *  order is internally perfect and disagrees with what actually happened. */
export function AnomalyDiagram() {
  const box = (x: number, name: string, what: string, stamp: string) => (
    <>
      <rect x={x} y="34" width="140" height="44" fill="#fff" stroke={INK} strokeWidth="1.6" />
      <text x={x + 12} y="50" fontFamily={MONO} fontSize="6.6" fill={INK}>{name}</text>
      <text x={x + 12} y="62" fontFamily={MONO} fontSize="6" fill={MUTED}>{what}</text>
      <text x={x + 12} y="72" fontFamily={MONO} fontSize="6" fill={TERRA}>{stamp}</text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 168"
      role="img"
      aria-label="A person makes a request on computer A, then telephones a friend who makes a request on computer B. The phone call is outside the system, so B can get the lower timestamp and be ordered first. The ordering is internally consistent and disagrees with what happened."
    >
      <defs>
        <marker id="pb-an" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
          <path d="M0 0 L7 3.5 L0 7 z" fill={TERRA} />
        </marker>
      </defs>
      <text x="14" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        the order is perfect, and it is backwards
      </text>
      {box(14, 'Computer A', 'request A, made first', 'timestamp 40')}
      {box(190, 'Computer B', 'request B, made after', 'timestamp 12')}
      <path d="M156 56 L186 56" stroke={TERRA} strokeWidth="1.6" strokeDasharray="4 3" markerEnd="url(#pb-an)" />
      <text x="172" y="98" textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={TERRA}>
        a phone call — a channel the system cannot see
      </text>
      <text x="14" y="124" fontFamily={MONO} fontSize="6.2" fill={INK}>
        so the system orders B before A, and it is not confused
      </text>
      <text x="14" y="138" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        it ordered every event it was told about, correctly
      </text>
      <text x="14" y="158" fontFamily={MONO} fontSize="6.2" fill={DENIM}>
        two exits: carry the timestamp by hand, or buy real clocks
      </text>
    </svg>
  )
}

/** Ch 6 — the marriage, itemised. Two parents, and the row that matters is the
 *  bottom one: what it declined, and why. A synthesis is defined by its
 *  refusals; anyone can list what a system borrowed. */
export function MarriageDiagram() {
  const took = (x: number, lines: string[]) =>
    lines.map((t, i) => (
      <text key={i} x={x} y={56 + i * 14} fontFamily={MONO} fontSize="6" fill={INK}>{t}</text>
    ))
  const refused = (y: number, what: string, why: string) => (
    <>
      <text x="14" y={y} fontFamily={MONO} fontSize="6" fill={TERRA}>{what}</text>
      <text x="150" y={y} fontFamily={MONO} fontSize="6" fill={MUTED}>{why}</text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 206"
      role="img"
      aria-label="Cassandra took the ring, gossip, quorums and no write-path master from Dynamo, and column families, the commit log and memtable, immutable files and bloom filters from Bigtable. It refused Dynamo's vector clocks because a write would need a read, refused Bigtable's dependency on GFS, and refused Bigtable's master — though ZooKeeper came back in anyway."
    >
      <text x="14" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        what it took, and what it would not take
      </text>
      <text x="14" y="36" fontFamily={MONO} fontSize="6.6" fill={DENIM}>from Dynamo</text>
      <text x="180" y="36" fontFamily={MONO} fontSize="6.6" fill={DENIM}>from Bigtable</text>
      <line x1="14" y1="42" x2="330" y2="42" stroke={MUTED} strokeWidth="0.8" />
      {took(14, ['the ring', 'gossip membership', 'N replicas, quorum', 'no master on writes'])}
      {took(180, ['column families', 'commit log + memtable', 'immutable files', 'bloom filter per file'])}

      <line x1="14" y1="118" x2="330" y2="118" stroke={MUTED} strokeWidth="0.8" />
      <text x="14" y="132" fontFamily={MONO} fontSize="6.6" fill={TERRA}>REFUSED</text>
      {refused(150, 'Dynamo: vector clocks', 'a write would need a read')}
      {refused(164, 'Bigtable: GFS underneath', 'the log and the ring instead')}
      {refused(178, 'Bigtable: one master', 'ZooKeeper came back anyway')}

      <text x="14" y="198" fontFamily={MONO} fontSize="6.2" fill={INK}>
        anyone can list the borrowings — the refusals are the design
      </text>
    </svg>
  )
}

/** Ch 6 — the accrual failure detector, which is the paper's one genuinely
 *  novel piece and the one nobody quotes. A detector that reports a suspicion
 *  level instead of a verdict, so the caller picks its own tolerance. */
export function PhiDiagram() {
  const row = (y: number, phi: string, wrong: string, accent: string, note?: string) => (
    <>
      <text x="14" y={y} fontFamily={MONO} fontSize="6.4" fill={accent}>{phi}</text>
      <text x="110" y={y} fontFamily={MONO} fontSize="6.4" fill={INK}>{wrong}</text>
      {note && <text x="196" y={y} fontFamily={MONO} fontSize="6.4" fill={accent}>{note}</text>}
    </>
  )
  return (
    <svg
      viewBox="0 0 344 168"
      role="img"
      aria-label="The accrual failure detector reports a suspicion level rather than up or down. At phi 1 you are wrong about 10 percent of the time, at phi 2 about 1 percent, at phi 3 about 0.1 percent. Cassandra ran phi 5. On a 100-node cluster a conventional detector took about two minutes to notice a failure; this took about fifteen seconds."
    >
      <text x="14" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        not up or down — a suspicion level
      </text>
      <text x="110" y="32" fontFamily={MONO} fontSize="6" fill={MUTED}>chance you are wrong</text>
      <line x1="14" y1="38" x2="330" y2="38" stroke={MUTED} strokeWidth="0.8" />
      {row(56, 'suspect at Φ=1', 'about 10%', MUTED)}
      {row(74, 'suspect at Φ=2', 'about 1%', MUTED)}
      {row(92, 'suspect at Φ=3', 'about 0.1%', MUTED)}
      {row(110, 'suspect at Φ=5', 'about 0.001%', DENIM, 'what it shipped')}
      <text x="14" y="140" fontFamily={MONO} fontSize="6.2" fill={TERRA}>
        100 nodes, a conventional detector: about 2 minutes
      </text>
      <text x="14" y="156" fontFamily={MONO} fontSize="6.2" fill={DENIM}>
        the same failure, at Φ=5: about 15 seconds
      </text>
    </svg>
  )
}

/** Ch 1 — why 64 MB. The same petabyte catalogued at two block sizes, priced
 *  in the only currency that mattered: the master's RAM. */
export function ChunkBudgetDiagram() {
  const col = (x: number, accent: string, head: string, sub: string, lines: string[], last: string, ok: string) => (
    <>
      <rect x={x} y="24" width="158" height="114" fill="none" stroke={accent} strokeWidth="1.8" />
      <text x={x + 12} y="42" fontFamily={MONO} fontSize="8" fill={accent}>{head}</text>
      <text x={x + 12} y="55" fontFamily={MONO} fontSize="6" fill={MUTED}>{sub}</text>
      {lines.map((t, i) => (
        <text key={i} x={x + 12} y={76 + i * 12} fontFamily={MONO} fontSize="6.4" fill={INK}>{t}</text>
      ))}
      <text x={x + 12} y="118" fontFamily={MONO} fontSize="7.2" fill={accent}>{last}</text>
      <text x={x + 12} y="132" fontFamily={MONO} fontSize="6.2" fill={accent}>{ok}</text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 178"
      role="img"
      aria-label="One petabyte catalogued at 4 KB blocks needs about 15 TB of master memory; at 64 MB chunks it needs under 1 GB."
    >
      <text x="8" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        one petabyte — two ways to keep the catalogue
      </text>
      {col(
        8,
        TERRA,
        '4 KB blocks',
        'what an ordinary file system does',
        ['1 PB ÷ 4 KB', '= 244,000,000,000 blocks', '× 64 B of metadata each'],
        '= ~15 TB of RAM',
        '✗ no such machine, then or now',
      )}
      {col(
        178,
        DENIM,
        '64 MB chunks',
        'what GFS chose',
        ['1 PB ÷ 64 MB', '= 15,000,000 chunks', '× 64 B of metadata each'],
        '= under 1 GB of RAM',
        '✓ fits, with room to grow',
      )}
      <text x="172" y="158" textAnchor="middle" fontFamily={MONO} fontSize="6.6" fill={INK}>
        chunk size is not a disk tuning knob — it is the master&rsquo;s memory budget
      </text>
      <text x="172" y="170" textAnchor="middle" fontFamily={MONO} fontSize="6" fill={MUTED}>
        (64 bytes per chunk is the paper&rsquo;s own figure, §2.6.1)
      </text>
    </svg>
  )
}

/** Ch 4 — what a lock service actually does all day, from the paper's own
 *  snapshot of a typical cell (§4.1). The operation it is named after is too
 *  small to draw, which is the entire point of the figure. */
export function ChubbyTrafficDiagram() {
  const X0 = 10
  const W = 324
  const keep = X0 + W * 0.93
  return (
    <svg
      viewBox="0 0 344 176"
      role="img"
      aria-label="In a typical Chubby cell, 93% of RPCs are KeepAlives and lock acquisition is 31 per million; 60% of open files are naming-related."
    >
      <text x="10" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        one cell, ten minutes of RPCs
      </text>
      <rect x={X0} y="24" width={keep - X0} height="20" fill="#e8edf5" stroke={DENIM} strokeWidth="1.6" />
      <text x={(X0 + keep) / 2} y="37" textAnchor="middle" fontFamily={MONO} fontSize="6.6" fill={DENIM}>
        KeepAlive — 93%
      </text>
      <rect x={keep} y="24" width={X0 + W - keep} height="20" fill="#f6e9e2" stroke={TERRA} strokeWidth="1.6" />
      <text x="10" y="58" fontFamily={MONO} fontSize="6.2" fill={INK}>
        the other 7%: GetStat, Open, CreateSession, reads, writes
      </text>
      <text x="322" y="58" textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={TERRA}>
        7%
      </text>

      <text x="10" y="80" fontFamily={MONO} fontSize="7" fill={MUTED}>
        what the open files are for
      </text>
      <rect x={X0} y="88" width={W * 0.6} height="18" fill="#e8edf5" stroke={DENIM} strokeWidth="1.6" />
      <text x={X0 + W * 0.3} y="100" textAnchor="middle" fontFamily={MONO} fontSize="6.4" fill={DENIM}>
        naming — 60%
      </text>
      <rect x={X0 + W * 0.6} y="88" width={W * 0.4} height="18" fill="#fff" stroke={INK} strokeWidth="1.6" />
      <text x={X0 + W * 0.8} y="100" textAnchor="middle" fontFamily={MONO} fontSize="6.4" fill={INK}>
        locks, config, metadata
      </text>

      <text x="172" y="126" textAnchor="middle" fontFamily={MONO} fontSize="6.4" fill={TERRA}>
        Acquire — the operation it is named after — is 31 per million
      </text>
      <text x="172" y="140" textAnchor="middle" fontFamily={MONO} fontSize="6.4" fill={INK}>
        93% of its traffic is clients saying: still here
      </text>
      <text x="172" y="156" textAnchor="middle" fontFamily={MONO} fontSize="6.8" fill={DENIM}>
        built as a lock service, used as a name service
      </text>
      <text x="172" y="169" textAnchor="middle" fontFamily={MONO} fontSize="5.8" fill={MUTED}>
        (§4.1 reports this as data, not as a confession)
      </text>
    </svg>
  )
}

/** Ch 2 — every mapper feeds every reducer, so the framework's bookkeeping is
 *  M × R. Deliberately shaped like Ch 1's ChunkBudgetDiagram: it is the same
 *  ceiling — one machine's RAM — one layer up the stack. */
export function FanoutDiagram() {
  const YS = [28, 54, 80]
  const box = (x: number, y: number, label: string, accent: string) => (
    <>
      <rect x={x} y={y} width="56" height="16" fill="#fff" stroke={accent} strokeWidth="1.6" />
      <text x={x + 28} y={y + 10.5} textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={accent}>{label}</text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 172"
      role="img"
      aria-label="Every map task feeds every reduce task, so the master tracks M times R pieces of intermediate state — a billion of them at the paper's own working numbers."
    >
      <text x="10" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        every mapper feeds every reducer
      </text>
      {YS.map((y, i) => (
        <g key={'m' + i}>{box(10, y, `map ${i + 1}`, INK)}</g>
      ))}
      {YS.map((y, i) => (
        <g key={'r' + i}>{box(190, y, `reduce ${i + 1}`, DENIM)}</g>
      ))}
      {YS.map((a, i) =>
        YS.map((b, j) => (
          <line key={`${i}-${j}`} x1="66" y1={a + 8} x2="190" y2={b + 8} stroke={MUTED} strokeWidth="0.7" opacity="0.75" />
        )),
      )}
      <text x="256" y="60" fontFamily={MONO} fontSize="6" fill={MUTED}>one output</text>
      <text x="256" y="70" fontFamily={MONO} fontSize="6" fill={MUTED}>file each</text>

      <text x="172" y="118" textAnchor="middle" fontFamily={MONO} fontSize="6.4" fill={INK}>
        M = 200,000 · R = 5,000 — the paper&rsquo;s own working numbers
      </text>
      <text x="172" y="132" textAnchor="middle" fontFamily={MONO} fontSize="6.4" fill={INK}>
        M × R = 1,000,000,000 pieces to keep track of
      </text>
      <text x="172" y="146" textAnchor="middle" fontFamily={MONO} fontSize="6.4" fill={TERRA}>
        at ~1 byte apiece, ~1 GB in the master&rsquo;s RAM
      </text>
      <text x="172" y="162" textAnchor="middle" fontFamily={MONO} fontSize="6.6" fill={DENIM}>
        the same ceiling as Chapter 1, one floor up
      </text>
    </svg>
  )
}

/** Ch 1 — the consistency model, drawn. Three replicas of one chunk after an
 *  append failed on C and the client retried: the record is in all three, but
 *  the replicas are not identical and one region is garbage. */
export function AppendRegionsDiagram() {
  const REC = '#e8edf5'
  const JUNK = '#f6e9e2'
  const row = (y: number, name: string, firstFill: string, firstStroke: string, firstText: string, firstColor: string) => (
    <>
      <text x="8" y={y + 13} fontFamily={MONO} fontSize="6.2" fill={INK}>{name}</text>
      <rect x="48" y={y} width="136" height="20" fill={firstFill} stroke={firstStroke} strokeWidth="1.6" />
      <text x="116" y={y + 13} textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={firstColor}>{firstText}</text>
      <rect x="184" y={y} width="136" height="20" fill={REC} stroke={DENIM} strokeWidth="1.6" />
      <text x="252" y={y + 13} textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={DENIM}>the record</text>
    </>
  )
  const tick = (x: number) => <line x1={x} y1="108" x2={x} y2="116" stroke={INK} strokeWidth="1.4" />
  return (
    <svg
      viewBox="0 0 344 178"
      role="img"
      aria-label="Three replicas of a chunk after a failed append and a retry: two hold the record twice, one holds padding then the record. Only the retried region is identical in all three."
    >
      <text x="8" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        one chunk, three replicas — after a failure and a retry
      </text>

      {row(24, 'replica A', REC, DENIM, 'the record', DENIM)}
      {row(52, 'replica B', REC, DENIM, 'the record', DENIM)}
      {row(80, 'replica C', JUNK, TERRA, 'padding — the attempt that failed', TERRA)}

      <line x1="48" y1="112" x2="184" y2="112" stroke={TERRA} strokeWidth="1.6" />
      <line x1="184" y1="112" x2="320" y2="112" stroke={DENIM} strokeWidth="1.6" />
      {tick(48)}
      {tick(184)}
      {tick(320)}
      <text x="116" y="126" textAnchor="middle" fontFamily={MONO} fontSize="6.4" fill={TERRA}>inconsistent</text>
      <text x="116" y="137" textAnchor="middle" fontFamily={MONO} fontSize="6" fill={MUTED}>replicas disagree here</text>
      <text x="252" y="126" textAnchor="middle" fontFamily={MONO} fontSize="6.4" fill={DENIM}>defined</text>
      <text x="252" y="137" textAnchor="middle" fontFamily={MONO} fontSize="6" fill={MUTED}>the offset you were handed</text>

      <text x="172" y="158" textAnchor="middle" fontFamily={MONO} fontSize="6.6" fill={INK}>
        the promise: your record is in every replica, at least once
      </text>
      <text x="172" y="170" textAnchor="middle" fontFamily={MONO} fontSize="6.4" fill={TERRA}>
        not exactly once, and not in identical replicas — that part is yours
      </text>
    </svg>
  )
}

/** Ch 3 — the grid is a rendering; the truth is a flattened, sorted KV list.
 *  Left: the human "table" view of Webtable. Right: the same cells as sorted
 *  entries; the empty cells simply never appear. */
export function FlattenDiagram() {
  const entry = (y: number, text: string, hot?: boolean) => (
    <text x="180" y={y} fontFamily={MONO} fontSize="7" fill={hot ? DENIM : INK}>
      {text}
    </text>
  )
  return (
    <svg
      viewBox="0 0 344 196"
      role="img"
      aria-label="A sparse table of web pages flattens into a sorted list of key-value entries; empty cells produce no entries."
    >
      {/* ---- left: the grid people draw ---- */}
      <text x="10" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        the table you draw
      </text>
      {/* column headers, centred over their boxes */}
      <text x="86" y="31" textAnchor="middle" fontFamily={MONO} fontSize="6" fill={MUTED}>contents</text>
      <text x="130" y="31" textAnchor="middle" fontFamily={MONO} fontSize="6" fill={MUTED}>anchor:*</text>

      {/* row 1 — com.cnn.www */}
      <text x="10" y="46" fontFamily={MONO} fontSize="6" fill={INK}>com.cnn.www</text>
      <rect x="66" y="36" width="40" height="16" fill="none" stroke={INK} strokeWidth="1.5" />
      <text x="86" y="46" textAnchor="middle" fontFamily={MONO} fontSize="5.8" fill={INK}>t9 t5 t3</text>
      <rect x="110" y="36" width="40" height="16" fill="none" stroke={MUTED} strokeWidth="1" strokeDasharray="2 2" />
      <text x="130" y="46" textAnchor="middle" fontFamily={MONO} fontSize="6.5" fill={MUTED}>—</text>

      {/* row 2 — com.google.www */}
      <text x="10" y="68" fontFamily={MONO} fontSize="6" fill={INK}>com.google.www</text>
      <rect x="66" y="58" width="40" height="16" fill="none" stroke={INK} strokeWidth="1.5" />
      <text x="86" y="68" textAnchor="middle" fontFamily={MONO} fontSize="5.8" fill={INK}>t9</text>
      <rect x="110" y="58" width="40" height="16" fill="none" stroke={INK} strokeWidth="1.5" />
      <text x="130" y="68" textAnchor="middle" fontFamily={MONO} fontSize="5.8" fill={INK}>cnn bbc</text>

      <text x="10" y="90" fontFamily={MONO} fontSize="6" fill={TERRA}>
        empty cell = stores nothing
      </text>

      {/* ---- the arrow between the views ---- */}
      <defs>
        <marker id="pb-ar" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0 0 L8 4 L0 8 z" fill={INK} />
        </marker>
      </defs>
      <path d="M10 108 L146 108" stroke={INK} strokeWidth="2" markerEnd="url(#pb-ar)" />
      <text x="10" y="121" fontFamily={MONO} fontSize="6" fill={INK}>
        enumerate non-empty cells
      </text>

      {/* ---- right: the sorted flat list (the truth on disk) ---- */}
      <text x="172" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        what the SSTable holds — sorted
      </text>
      <rect x="172" y="20" width="162" height="168" fill="none" stroke={INK} strokeWidth="1.8" />
      {entry(36, 'cnn|contents||t9 → html')}
      {entry(49, 'cnn|contents||t5 → html')}
      {entry(62, 'cnn|contents||t3 → html')}
      {entry(75, 'goog|anchor|bbc|t4 → …', true)}
      {entry(88, 'goog|anchor|cnn|t7 → …', true)}
      {entry(101, 'goog|contents||t9 → html')}
      <line x1="180" y1="112" x2="326" y2="112" stroke={MUTED} strokeWidth="1" strokeDasharray="2 2" />
      <text x="180" y="127" fontFamily={MONO} fontSize="6.8" fill={DENIM}>
        row ⊕ family ⊕ column ⊕ ts⁻¹
      </text>
      <text x="180" y="143" fontFamily={MONO} fontSize="6.2" fill={INK}>
        shared prefix = neighbours,
      </text>
      <text x="180" y="155" fontFamily={MONO} fontSize="6.2" fill={INK}>
        so one row is one contiguous
      </text>
      <text x="180" y="167" fontFamily={MONO} fontSize="6.2" fill={INK}>
        slice — read it in one sweep
      </text>
      <text x="180" y="181" fontFamily={MONO} fontSize="6.2" fill={TERRA}>
        the empty cell never appears
      </text>
    </svg>
  )
}

/** Ch 3 — tablets are discovered, not declared: the sorted keyspace split into
 *  contiguous ranges, and a hot range splitting in two. */
export function TabletSplitDiagram() {
  return (
    <svg
      viewBox="0 0 344 152"
      role="img"
      aria-label="A sorted keyspace divided into tablets; one oversized tablet splits into two, and the split only edits metadata."
    >
      <text x="10" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        the sorted keyspace, cut into ranges
      </text>
      {/* the keyspace bar */}
      <rect x="10" y="24" width="86" height="18" fill="#fff" stroke={INK} strokeWidth="1.6" />
      <rect x="96" y="24" width="140" height="18" fill="#f6e9e2" stroke={TERRA} strokeWidth="1.8" />
      <rect x="236" y="24" width="98" height="18" fill="#fff" stroke={INK} strokeWidth="1.6" />
      <text x="53" y="36" textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={INK}>a… — com.c…</text>
      <text x="166" y="36" textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={TERRA}>com.c… — com.g…</text>
      <text x="285" y="36" textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={INK}>com.g… — z…</text>
      <text x="166" y="56" textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={TERRA}>
        grew past its split size
      </text>

      {/* split arrows */}
      <defs>
        <marker id="pb-ar2" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0 0 L7 3.5 L0 7 z" fill={INK} />
        </marker>
      </defs>
      <path d="M144 62 L112 84" stroke={INK} strokeWidth="1.6" markerEnd="url(#pb-ar2)" />
      <path d="M188 62 L220 84" stroke={INK} strokeWidth="1.6" markerEnd="url(#pb-ar2)" />

      {/* the two children */}
      <rect x="52" y="88" width="110" height="18" fill="#e8edf5" stroke={DENIM} strokeWidth="1.8" />
      <text x="107" y="100" textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={DENIM}>com.c… — com.e…</text>
      <rect x="180" y="88" width="110" height="18" fill="#e8edf5" stroke={DENIM} strokeWidth="1.8" />
      <text x="235" y="100" textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={DENIM}>com.e… — com.g…</text>

      <text x="172" y="128" textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={INK}>
        the split edits METADATA only — the bytes never move
      </text>
      <text x="172" y="141" textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        (they live in GFS)
      </text>
    </svg>
  )
}

/** Ch 5 — the paper's Figure 3, redrawn. A version's clock is a list of
 *  (node, counter) pairs, and the only question it answers is whether one
 *  version descends from another or whether the two happened side by side.
 *
 *  Every box is 104 wide because the widest clock here — D5's three pairs —
 *  is 22 mono characters, and at fontSize 6 that is ~80 units. The boxes are
 *  drawn in one helper so a fourth pair added later overflows all of them at
 *  once rather than just the one nobody re-measured. */
export function VectorClockDiagram() {
  const box = (x: number, y: number, name: string, clock: string, accent: string) => (
    <>
      <rect x={x} y={y} width="104" height="30" fill="#fff" stroke={accent} strokeWidth="1.6" />
      <text x={x + 10} y={y + 13} fontFamily={MONO} fontSize="6.6" fill={accent}>{name}</text>
      <text x={x + 10} y={y + 24} fontFamily={MONO} fontSize="6" fill={INK}>{clock}</text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 244"
      role="img"
      aria-label="A version history: D1 and D2 written via node Sx, then D3 via Sy and D4 via Sz branching from D2. D3 and D4 are concurrent — neither clock covers the other — so both survive until a client merges them into D5."
    >
      <defs>
        <marker id="pb-vc" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0 0 L7 3.5 L0 7 z" fill={MUTED} />
        </marker>
      </defs>
      <text x="10" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        one cart, four writes, two of them at once
      </text>

      {box(120, 24, 'D1 · via Sx', '[(Sx,1)]', INK)}
      <path d="M172 54 L172 66" stroke={MUTED} strokeWidth="1.4" markerEnd="url(#pb-vc)" />
      {box(120, 68, 'D2 · via Sx', '[(Sx,2)]', INK)}

      <path d="M150 98 L104 116" stroke={MUTED} strokeWidth="1.4" markerEnd="url(#pb-vc)" />
      <path d="M194 98 L240 116" stroke={MUTED} strokeWidth="1.4" markerEnd="url(#pb-vc)" />
      {box(26, 118, 'D3 · via Sy', '[(Sx,2),(Sy,1)]', TERRA)}
      {box(214, 118, 'D4 · via Sz', '[(Sx,2),(Sz,1)]', TERRA)}

      <text x="172" y="166" textAnchor="middle" fontFamily={MONO} fontSize="6.4" fill={TERRA}>
        neither clock covers the other
      </text>
      <text x="172" y="178" textAnchor="middle" fontFamily={MONO} fontSize="6.4" fill={TERRA}>
        so both are kept, and a read returns both
      </text>

      {/* Both branches rejoin around the OUTSIDE, not diagonally inward. The
          first draft ran them straight from each box's inner corner down to
          D5, and the geometry lint found those two lines drawn through the
          sibling annotation — the funnel narrows to about 70 units by the time
          it reaches D5, and that caption is 115 wide. Elbows keep the whole
          middle of the figure empty for the text that explains it. */}
      <path d="M78 148 L78 203 L116 203" fill="none" stroke={MUTED} strokeWidth="1.4" markerEnd="url(#pb-vc)" />
      <path d="M266 148 L266 203 L228 203" fill="none" stroke={MUTED} strokeWidth="1.4" markerEnd="url(#pb-vc)" />
      {box(120, 188, 'D5 · your merge', '[(Sx,3),(Sy,1),(Sz,1)]', DENIM)}

      <text x="172" y="236" textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        the counters are not clocks — nothing here measures time
      </text>
    </svg>
  )
}

/** Ch 5 — §6.3, the number that decides whether any of this is worth it: how
 *  often the shopping cart service actually saw a conflict over 24 hours.
 *  Percentages that small stop meaning anything, so each is restated as a
 *  count out of a million reads, which is arithmetic the reader can check. */
export function DivergenceDiagram() {
  const row = (y: number, versions: string, pct: string, perM: string, accent: string) => (
    <>
      <text x="14" y={y} fontFamily={MONO} fontSize="6.4" fill={accent}>{versions}</text>
      <text x="120" y={y} fontFamily={MONO} fontSize="6.4" fill={INK}>{pct}</text>
      <text x="212" y={y} fontFamily={MONO} fontSize="6.4" fill={accent}>{perM}</text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 146"
      role="img"
      aria-label="Over 24 hours the shopping cart service saw one version on 99.94 percent of reads, two versions on 0.00057 percent, three on 0.00047 percent and four on 0.00009 percent — about six reads in a million returning a conflict."
    >
      <text x="14" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        shopping cart reads over 24 hours (§6.3)
      </text>
      <text x="120" y="32" fontFamily={MONO} fontSize="6" fill={MUTED}>of requests</text>
      <text x="212" y="32" fontFamily={MONO} fontSize="6" fill={MUTED}>per million reads</text>
      <line x1="14" y1="38" x2="330" y2="38" stroke={MUTED} strokeWidth="0.8" />
      {row(54, '1 version', '99.94%', 'essentially all', DENIM)}
      {row(72, '2 versions', '0.00057%', 'about 6', TERRA)}
      {row(90, '3 versions', '0.00047%', 'about 5', TERRA)}
      {row(108, '4 versions', '0.00009%', 'about 1', TERRA)}
      <text x="14" y="136" fontFamily={MONO} fontSize="6.2" fill={INK}>
        and the cause was not failures — it was concurrent writers
      </text>
    </svg>
  )
}

/** Ch 10 — the paper's Figure 3, which is the only picture of snapshot
 *  isolation anybody needs. Read at your start stamp, write at your commit
 *  stamp, and what you see is settled the instant you begin. Time runs left to
 *  right; the open square is a start, the filled circle a commit. */
export function SnapshotIsolationDiagram() {
  const row = (y: number, name: string, x0: number, x1: number, accent: string) => (
    <>
      <text x="12" y={y + 3} fontFamily={MONO} fontSize="6.4" fill={MUTED}>
        {name}
      </text>
      <line x1={x0} y1={y} x2={x1} y2={y} stroke={accent} strokeWidth="1.8" />
      <rect x={x0 - 4} y={y - 4} width="8" height="8" fill="#fff" stroke={accent} strokeWidth="1.6" />
      <circle cx={x1} cy={y} r="4.4" fill={accent} />
    </>
  )
  return (
    <svg
      viewBox="0 0 344 212"
      role="img"
      aria-label="Three transactions on a timeline. Each reads at its start stamp and writes at its commit stamp. Transaction two began before transaction one committed, so it never sees transaction one. Transaction three began after both committed and sees both. One and two overlap, so if they write the same cell one of them aborts."
    >
      <text x="12" y="16" fontFamily={MONO} fontSize="7" fill={MUTED}>
        read at your start stamp □ · write at your commit stamp ●
      </text>

      {/* the dashed pair that carries the whole argument: txn 2 starts left of
          txn 1's commit, so txn 1 is invisible to it, forever */}
      <line x1="150" y1="44" x2="150" y2="132" stroke={TERRA} strokeWidth="0.9" strokeDasharray="3 3" />
      <line x1="104" y1="44" x2="104" y2="132" stroke={TERRA} strokeWidth="0.9" strokeDasharray="3 3" />

      {row(48, 'txn 1', 60, 150, INK)}
      {row(84, 'txn 2', 104, 232, TERRA)}
      {row(120, 'txn 3', 262, 308, DENIM)}

      <line x1="44" y1="146" x2="324" y2="146" stroke={MUTED} strokeWidth="0.8" />
      <text x="324" y="158" textAnchor="end" fontFamily={MONO} fontSize="6" fill={MUTED}>
        time →
      </text>

      <text x="12" y="174" fontFamily={MONO} fontSize="6.2" fill={TERRA}>
        txn 2 began before txn 1 committed — it never sees txn 1
      </text>
      <text x="12" y="188" fontFamily={MONO} fontSize="6.2" fill={DENIM}>
        txn 3 began after both — it sees both, and waited for nothing
      </text>
      <text x="12" y="202" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        1 and 2 overlap: same cell → one of them aborts. different cells → both commit
      </text>
    </svg>
  )
}

/** Ch 10 — Figure 7's shape, which is the figure that tells you when NOT to use
 *  this. Two regimes with a crossover you can compute: random lookups per
 *  update against streaming the whole repository. The vertical asymptote is the
 *  honest part — Percolator does not degrade at saturation, it stops. */
export function CrawlRateDiagram() {
  // plot box: x 44..320, y 36..150. y=150 is zero, y=36 is ~2500 s.
  const tick = (x: number, label: string) => (
    <>
      <line x1={x} y1="150" x2={x} y2="154" stroke={MUTED} strokeWidth="0.8" />
      <text x={x} y="164" textAnchor="middle" fontFamily={MONO} fontSize="6" fill={MUTED}>
        {label}
      </text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 200"
      role="img"
      aria-label="Median delay from crawl to clustered, against how much of the repository is crawled per hour. MapReduce sits above twenty minutes at every rate and rises slowly. Percolator sits at about two seconds until forty percent per hour, where it saturates and the delay goes vertical."
    >
      <text x="12" y="16" fontFamily={MONO} fontSize="7" fill={MUTED}>
        median delay, crawl → clustered · 240 machines (Figure 7)
      </text>

      <line x1="44" y1="150" x2="324" y2="150" stroke={MUTED} strokeWidth="0.8" />
      <line x1="44" y1="30" x2="44" y2="150" stroke={MUTED} strokeWidth="0.8" />
      {tick(44, '10%')}
      {tick(113, '20%')}
      {tick(182, '30%')}
      {tick(251, '40%')}
      {tick(320, '50%')}
      <text x="182" y="180" textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        percentage of the repository crawled per hour
      </text>

      {/* MapReduce: high everywhere, and the rise is weak because stragglers,
          not data volume, set the floor at these rates */}
      <path d="M44 70 C 130 66, 220 56, 320 46" fill="none" stroke={INK} strokeWidth="1.8" />
      <text x="52" y="92" fontFamily={MONO} fontSize="6.4" fill={INK}>
        MapReduce — 20+ minutes, set by the repository
      </text>

      {/* Percolator: flat at ~2 s, then a wall */}
      <line x1="44" y1="142" x2="251" y2="142" stroke={DENIM} strokeWidth="1.8" />
      <text x="52" y="134" fontFamily={MONO} fontSize="6.4" fill={DENIM}>
        Percolator — about 2 seconds
      </text>
      <line x1="251" y1="142" x2="251" y2="36" stroke={TERRA} strokeWidth="1.8" strokeDasharray="4 3" />
      {/* short lines, stacked, and kept low: the MapReduce curve runs across
          the top right of the plot and will happily be drawn through anything
          wide placed up there. */}
      {['at 40%/hour', 'it saturates:', 'queue grows', 'without bound'].map((t, i) => (
        <text key={t} x="257" y={92 + i * 10} fontFamily={MONO} fontSize="6.2" fill={TERRA}>
          {t}
        </text>
      ))}

      <text x="12" y="196" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        the crossover is arithmetic: lookups per update, against streaming the whole repository
      </text>
    </svg>
  )
}

/** Ch 11 — the one idea. Every other clock API returns a number and declines to
 *  mention that the number is wrong; TrueTime returns a width. The sawtooth
 *  underneath is that width measured in production, and it is the reason the
 *  chapter is about buying hardware. */
export function TrueTimeDiagram() {
  // sawtooth: 3 teeth across x 44..320, ε from 1 ms (y=196) to 7 ms (y=160)
  const teeth = [44, 136, 228, 320]
  return (
    <svg
      viewBox="0 0 344 214"
      role="img"
      aria-label="Above: an ordinary clock call returns one number and says nothing about how wrong it is. TrueTime returns an interval, earliest to latest, guaranteed to contain the true time, with epsilon on each side. Below: epsilon measured in production sawtooths from about one millisecond to seven over each thirty-second poll interval."
    >
      <text x="12" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        what the call gives back
      </text>

      {/* the ordinary clock */}
      <text x="12" y="36" fontFamily={MONO} fontSize="6.4" fill={TERRA}>
        gettimeofday()
      </text>
      <line x1="44" y1="52" x2="320" y2="52" stroke={MUTED} strokeWidth="0.8" />
      <line x1="176" y1="45" x2="176" y2="59" stroke={TERRA} strokeWidth="2.2" />
      <text x="176" y="70" textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={TERRA}>
        one number, and no idea how far off it is
      </text>

      {/* TrueTime */}
      <text x="12" y="96" fontFamily={MONO} fontSize="6.4" fill={DENIM}>
        TT.now()
      </text>
      <line x1="44" y1="112" x2="320" y2="112" stroke={MUTED} strokeWidth="0.8" />
      <line x1="122" y1="104" x2="122" y2="120" stroke={DENIM} strokeWidth="2.2" />
      <line x1="230" y1="104" x2="230" y2="120" stroke={DENIM} strokeWidth="2.2" />
      <line x1="122" y1="112" x2="230" y2="112" stroke={DENIM} strokeWidth="4" opacity="0.35" />
      <circle cx="163" cy="112" r="3.6" fill={INK} />
      <text x="122" y="100" textAnchor="middle" fontFamily={MONO} fontSize="6" fill={DENIM}>
        earliest
      </text>
      <text x="230" y="100" textAnchor="middle" fontFamily={MONO} fontSize="6" fill={DENIM}>
        latest
      </text>
      <text x="176" y="132" textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={INK}>
        the true time is in here somewhere · half-width ε
      </text>

      {/* ε in production */}
      <text x="12" y="156" fontFamily={MONO} fontSize="6.4" fill={MUTED}>
        ε, measured
      </text>
      {teeth.slice(0, 3).map((x, i) => (
        <path
          key={x}
          d={`M${x} 196 L${teeth[i + 1] - 2} 160 L${teeth[i + 1]} 196`}
          fill="none"
          stroke={DENIM}
          strokeWidth="1.6"
        />
      ))}
      <line x1="44" y1="196" x2="320" y2="196" stroke={MUTED} strokeWidth="0.8" />
      <text x="12" y="212" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        1 ms after each poll, 7 ms just before the next · average 4 ms · one tooth is 30 seconds
      </text>
    </svg>
  )
}

/** Ch 11 — commit wait, which is the trick and also the bill. The coordinator
 *  picks the pessimistic end of the interval and then refuses to say anything
 *  until that stamp is definitely in the past. Everything downstream — global
 *  snapshots, lock-free reads, atomic schema change — is bought with this bar. */
export function CommitWaitDiagram() {
  return (
    <svg
      viewBox="0 0 344 190"
      role="img"
      aria-label="A timeline. Transaction one picks its commit stamp at the latest end of the TrueTime interval, then holds its locks and tells nobody until that stamp is certainly in the past. Only then is the write visible. Any transaction starting after that gets a larger stamp, so the stamps agree with real time."
    >
      <text x="12" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        real time runs left to right — the thing nobody can read directly
      </text>

      <line x1="20" y1="120" x2="330" y2="120" stroke={MUTED} strokeWidth="0.8" />

      {/* the wait itself */}
      <rect x="96" y="52" width="84" height="26" fill={TERRA} opacity="0.16" />
      <rect x="96" y="52" width="84" height="26" fill="none" stroke={TERRA} strokeWidth="1.4" />
      <text x="138" y="69" textAnchor="middle" fontFamily={MONO} fontSize="6.4" fill={TERRA}>
        commit wait
      </text>

      {/* s is chosen */}
      <line x1="96" y1="46" x2="96" y2="120" stroke={DENIM} strokeWidth="1.8" />
      <text x="96" y="40" textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={DENIM}>
        s = TT.now().latest
      </text>
      <text x="96" y="134" textAnchor="middle" fontFamily={MONO} fontSize="6" fill={MUTED}>
        locks held
      </text>

      {/* the wait ends */}
      <line x1="180" y1="46" x2="180" y2="120" stroke={INK} strokeWidth="1.8" />
      <text x="180" y="40" textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={INK}>
        TT.after(s)
      </text>
      <text x="184" y="134" fontFamily={MONO} fontSize="6" fill={INK}>
        now the write is visible
      </text>

      {/* the next transaction */}
      <line x1="262" y1="88" x2="262" y2="120" stroke={DENIM} strokeWidth="1.8" />
      <text x="262" y="82" textAnchor="middle" fontFamily={MONO} fontSize="6.2" fill={DENIM}>
        txn 2 starts
      </text>
      <text x="330" y="148" textAnchor="end" fontFamily={MONO} fontSize="6" fill={DENIM}>
        its stamp must exceed s
      </text>

      <text x="12" y="160" fontFamily={MONO} fontSize="6.2" fill={TERRA}>
        the cost: about 2ε of doing nothing, roughly 10 ms, on every write
      </text>
      <text x="12" y="176" fontFamily={MONO} fontSize="6.2" fill={DENIM}>
        what it buys: stamps that agree with wall time everywhere on earth
      </text>
    </svg>
  )
}
