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

/** Ch 12 — the thundering herd, priced. One popular key, heavy read and write
 *  traffic, and every invalidation sends the whole fleet back to MySQL at once.
 *  Two bars, one week of production data, and the ratio is the argument. */
export function LeaseHerdDiagram() {
  const bar = (y: number, label: string, w: number, value: string, accent: string) => (
    <>
      <text x="12" y={y + 4} fontFamily={MONO} fontSize="6.4" fill={MUTED}>
        {label}
      </text>
      <rect x="118" y={y - 7} width={w} height="15" fill={accent} opacity="0.85" />
      <text x={118 + w + 8} y={y + 4} fontFamily={MONO} fontSize="7" fill={accent}>
        {value}
      </text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 160"
      role="img"
      aria-label="Peak database query rate for one week of cache misses on keys prone to thundering herds. Without leases, seventeen thousand queries a second. With leases, one thousand three hundred. A thirteenfold reduction in the peak the database must be provisioned for."
    >
      <text x="12" y="18" fontFamily={MONO} fontSize="7" fill={MUTED}>
        peak database queries/sec · one week, keys prone to herds
      </text>
      {bar(56, 'no leases', 150, '17,000/s', TERRA)}
      {bar(96, 'with leases', 11, '1,300/s', DENIM)}
      <text x="12" y="134" fontFamily={MONO} fontSize="6.2" fill={INK}>
        one token per key per 10 seconds — everybody else is told to wait
      </text>
      <text x="12" y="150" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        and you provision the database for the peak, so this is the whole bill
      </text>
    </svg>
  )
}

/** Ch 12 — how stale is the cache, actually. The paper samples one delete in a
 *  million and checks later whether the item is really gone. Two curves,
 *  because distance from the master region is the variable that matters and
 *  nobody's architecture diagram shows it. */
export function InvalidationLatencyDiagram() {
  // x: 1s .. 1d on a log scale across 44..320; y: reliability, 3 nines at the
  // bottom of the useful range up to 5 nines at the top
  const X: Record<string, number> = { '1s': 44, '10s': 100, '1m': 156, '10m': 212, '1h': 268, '1d': 320 }
  const tick = (k: string) => (
    <g key={k}>
      <line x1={X[k]} y1="122" x2={X[k]} y2="126" stroke={MUTED} strokeWidth="0.8" />
      <text x={X[k]} y="136" textAnchor="middle" fontFamily={MONO} fontSize="6" fill={MUTED}>
        {k}
      </text>
    </g>
  )
  return (
    <svg
      viewBox="0 0 344 178"
      role="img"
      aria-label="Reliability of cache invalidation against how long you wait. Inside the master region, four nines of deletes have landed within one second and five nines within an hour. Between replica regions it is three nines within a second and four nines within ten minutes."
    >
      <text x="12" y="16" fontFamily={MONO} fontSize="7" fill={MUTED}>
        share of deletes that have actually landed
      </text>
      <line x1="44" y1="122" x2="324" y2="122" stroke={MUTED} strokeWidth="0.8" />
      <line x1="44" y1="30" x2="44" y2="122" stroke={MUTED} strokeWidth="0.8" />
      {Object.keys(X).map(tick)}
      <text x="12" y="44" fontFamily={MONO} fontSize="6" fill={MUTED}>
        5 nines
      </text>
      <text x="12" y="98" fontFamily={MONO} fontSize="6" fill={MUTED}>
        3 nines
      </text>

      {/* master region: starts at four nines within a second */}
      <path d="M44 66 L100 58 L156 52 L212 48 L268 44 L320 42" fill="none" stroke={DENIM} strokeWidth="1.8" />
      <text x="150" y="40" fontFamily={MONO} fontSize="6.2" fill={DENIM}>
        inside the master region
      </text>

      {/* replica to replica: a decade of latency worse, all the way along */}
      <path d="M44 98 L100 88 L156 78 L212 68 L268 62 L320 58" fill="none" stroke={TERRA} strokeWidth="1.8" />
      <text x="150" y="110" fontFamily={MONO} fontSize="6.2" fill={TERRA}>
        replica region to replica region
      </text>

      <text x="12" y="158" fontFamily={MONO} fontSize="6.2" fill={INK}>
        a cache is a replica — and this is its replication lag, measured
      </text>
      <text x="12" y="172" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        the tail is not machines failing, it is a delete that needed one retry
      </text>
    </svg>
  )
}

/** Ch 13 — Kreps' own analogy, drawn. A log of changes and a table of current
 *  values are the same information; the log is the more fundamental one because
 *  you can build any number of tables from it and not the other way round. */
export function LogTableDiagram() {
  const rows = [
    ['+ 100  alice', 'alice   180'],
    ['+  60  bob', 'bob      40'],
    ['-  20  alice', ''],
    ['+ 100  alice', ''],
    ['-  20  bob', ''],
  ]
  return (
    <svg
      viewBox="0 0 344 186"
      role="img"
      aria-label="On the left, a log of credits and debits in order. On the right, a table of current balances. The table is what you get by replaying the log; the log is what you cannot get back from the table."
    >
      <text x="12" y="16" fontFamily={MONO} fontSize="7" fill={MUTED}>
        the same information, twice
      </text>
      <text x="16" y="36" fontFamily={MONO} fontSize="6.6" fill={DENIM}>
        the log — every change, in order
      </text>
      <text x="200" y="36" fontFamily={MONO} fontSize="6.6" fill={INK}>
        the table — where it ended
      </text>
      <line x1="16" y1="42" x2="168" y2="42" stroke={DENIM} strokeWidth="0.8" />
      <line x1="200" y1="42" x2="330" y2="42" stroke={MUTED} strokeWidth="0.8" />
      {rows.map(([l, r], i) => (
        <g key={i}>
          <text x="16" y={60 + i * 15} fontFamily={MONO} fontSize="6.6" fill={INK}>
            {l}
          </text>
          {r && (
            <text x="200" y={60 + i * 15} fontFamily={MONO} fontSize="6.6" fill={INK}>
              {r}
            </text>
          )}
        </g>
      ))}
      <text x="16" y="146" fontFamily={MONO} fontSize="6.2" fill={DENIM}>
        replay the log → you get the table, and every other table you want
      </text>
      <text x="16" y="162" fontFamily={MONO} fontSize="6.2" fill={TERRA}>
        read the table → the history is gone, and it is not coming back
      </text>
      <text x="16" y="180" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        so the log is the primary record and the table is a view of it
      </text>
    </svg>
  )
}

/** Ch 13 — the data-integration argument, which is the reason the blog post
 *  mattered more than the paper. Point-to-point pipelines grow as the product
 *  of the two sides; one log in the middle turns that into a sum. */
export function IntegrationDiagram() {
  const src = [30, 62, 94]
  const dst = [30, 62, 94]
  return (
    <svg
      viewBox="0 0 344 200"
      role="img"
      aria-label="On the left, three sources each wired directly to three destinations: nine bespoke pipelines. On the right, the same six systems each connected once to a shared log: six connections. The count grows as a product on one side and a sum on the other."
    >
      <text x="12" y="16" fontFamily={MONO} fontSize="7" fill={MUTED}>
        wiring six systems together, two ways
      </text>

      {/* left: every source to every sink */}
      <text x="12" y="34" fontFamily={MONO} fontSize="6.4" fill={TERRA}>
        point to point
      </text>
      {src.flatMap((y1) =>
        dst.map((y2) => (
          <line key={`${y1}-${y2}`} x1="34" y1={y1 + 22} x2="118" y2={y2 + 22} stroke={TERRA} strokeWidth="0.7" opacity="0.75" />
        )),
      )}
      {src.map((y) => (
        <circle key={`s${y}`} cx="34" cy={y + 22} r="4" fill={INK} />
      ))}
      {dst.map((y) => (
        <circle key={`d${y}`} cx="118" cy={y + 22} r="4" fill={INK} />
      ))}
      <text x="12" y="150" fontFamily={MONO} fontSize="6.4" fill={TERRA}>
        9 pipelines, each
      </text>
      <text x="12" y="162" fontFamily={MONO} fontSize="6.4" fill={TERRA}>
        one somebody owns
      </text>

      {/* right: everything through one log */}
      <text x="204" y="34" fontFamily={MONO} fontSize="6.4" fill={DENIM}>
        through one log
      </text>
      <rect x="248" y="46" width="18" height="76" fill={DENIM} opacity="0.2" stroke={DENIM} strokeWidth="1.4" />
      {src.map((y) => (
        <line key={`ls${y}`} x1="212" y1={y + 22} x2="248" y2={y + 22} stroke={DENIM} strokeWidth="1.2" />
      ))}
      {dst.map((y) => (
        <line key={`ld${y}`} x1="266" y1={y + 22} x2="302" y2={y + 22} stroke={DENIM} strokeWidth="1.2" />
      ))}
      {src.map((y) => (
        <circle key={`ls2${y}`} cx="212" cy={y + 22} r="4" fill={INK} />
      ))}
      {dst.map((y) => (
        <circle key={`ld2${y}`} cx="302" cy={y + 22} r="4" fill={INK} />
      ))}
      <text x="204" y="150" fontFamily={MONO} fontSize="6.4" fill={DENIM}>
        6 connections, and
      </text>
      <text x="204" y="162" fontFamily={MONO} fontSize="6.4" fill={DENIM}>
        one contract to keep
      </text>

      <text x="12" y="192" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        add one more system: three new pipelines on the left, one on the right
      </text>
    </svg>
  )
}

/** Ch 14 — what actually crosses the network on a write. Five kinds of data in
 *  the mirrored MySQL configuration, three of the steps sequential; one kind in
 *  Aurora. The measured ratio is at the bottom and it is not subtle. */
export function WriteAmplificationDiagram() {
  const items = ['redo log', 'binlog → S3', 'data pages', 'double-write', 'FRM metadata']
  return (
    <svg
      viewBox="0 0 344 200"
      role="img"
      aria-label="A mirrored MySQL write puts five kinds of data on the network: redo log, binary log, data pages, a double write to avoid torn pages, and metadata files. Aurora puts one: redo log records. Measured over thirty minutes, that is 7.4 IOs per transaction against 0.95."
    >
      <text x="12" y="16" fontFamily={MONO} fontSize="7" fill={MUTED}>
        what crosses the network on one write
      </text>

      <text x="12" y="38" fontFamily={MONO} fontSize="6.6" fill={TERRA}>
        mirrored MySQL
      </text>
      {items.map((t, i) => (
        <g key={t}>
          <rect x="16" y={48 + i * 17} width="130" height="13" fill={TERRA} opacity="0.18" stroke={TERRA} strokeWidth="1" />
          <text x="22" y={57.5 + i * 17} fontFamily={MONO} fontSize="6.2" fill={INK}>
            {t}
          </text>
        </g>
      ))}
      <text x="16" y="150" fontFamily={MONO} fontSize="6" fill={TERRA}>
        and three of the steps are
      </text>
      <text x="16" y="160" fontFamily={MONO} fontSize="6" fill={TERRA}>
        sequential — latency adds up
      </text>

      <text x="196" y="38" fontFamily={MONO} fontSize="6.6" fill={DENIM}>
        Aurora
      </text>
      <rect x="200" y="48" width="130" height="13" fill={DENIM} opacity="0.22" stroke={DENIM} strokeWidth="1" />
      <text x="206" y="57.5" fontFamily={MONO} fontSize="6.2" fill={INK}>
        redo log records
      </text>
      <text x="200" y="82" fontFamily={MONO} fontSize="6" fill={MUTED}>
        no pages. not on eviction,
      </text>
      <text x="200" y="92" fontFamily={MONO} fontSize="6" fill={MUTED}>
        not on checkpoint, not ever.
      </text>

      <line x1="12" y1="174" x2="332" y2="174" stroke={MUTED} strokeWidth="0.8" />
      <text x="12" y="192" fontFamily={MONO} fontSize="6.4" fill={INK}>
        measured over 30 min: 7.4 IOs/txn → 0.95, and 35× the transactions
      </text>
    </svg>
  )
}

/** Ch 14 — why three copies is not enough when one of the failures is an
 *  entire availability zone. The point is that an AZ loss is a CORRELATED
 *  failure, so it lands on top of the background noise rather than instead of
 *  it, and that is what breaks a 2-of-3. */
export function AzQuorumDiagram() {
  const az = (x: number, name: string, dead: number[]) => (
    <g key={name}>
      <rect x={x} y="44" width="76" height="58" fill="none" stroke={MUTED} strokeWidth="1" strokeDasharray="3 3" />
      <text x={x + 38} y="38" textAnchor="middle" fontFamily={MONO} fontSize="6.4" fill={MUTED}>
        {name}
      </text>
      {[0, 1].map((i) => (
        <g key={i}>
          <rect
            x={x + 12}
            y={56 + i * 24}
            width="52"
            height="16"
            fill={dead.includes(i) ? TERRA : DENIM}
            opacity={dead.includes(i) ? 0.28 : 0.85}
            stroke={dead.includes(i) ? TERRA : DENIM}
            strokeWidth="1.2"
          />
          {dead.includes(i) && (
            <text x={x + 38} y={68 + i * 24} textAnchor="middle" fontFamily={MONO} fontSize="6" fill={TERRA}>
              down
            </text>
          )}
        </g>
      ))}
    </g>
  )
  return (
    <svg
      viewBox="0 0 344 190"
      role="img"
      aria-label="Six copies of a segment, two in each of three availability zones. A whole zone is lost and one further node has failed in the background. Three copies remain, which still satisfies a read quorum of three of six, so no data is lost."
    >
      <text x="12" y="16" fontFamily={MONO} fontSize="7" fill={MUTED}>
        6 copies · 2 per zone · write 4 of 6 · read 3 of 6
      </text>
      {az(20, 'AZ A', [1])}
      {az(134, 'AZ B', [])}
      {az(248, 'AZ C — lost', [0, 1])}

      <text x="12" y="128" fontFamily={MONO} fontSize="6.4" fill={TERRA}>
        a zone dies AND one node was already down: 3 copies left
      </text>
      <text x="12" y="144" fontFamily={MONO} fontSize="6.4" fill={DENIM}>
        3 of 6 still reads — nothing is lost, and writes resume once repaired
      </text>
      <text x="12" y="166" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        with 3 copies and 2-of-3 the same pair of events leaves one copy,
      </text>
      <text x="12" y="178" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        and no way to tell whether that one is current
      </text>
    </svg>
  )
}

/** Ch 15 — the whole argument, drawn once. A row store interleaves every
 *  column on every page, so a query touching two fields still drags 200
 *  through the I/O path. Turning the data ninety degrees means the fields you
 *  did not ask for are never read at all. */
export function ColumnLayoutDiagram() {
  const cell = (x: number, y: number, w: number, fill: string, op: number) => (
    <rect x={x} y={y} width={w} height="9" fill={fill} opacity={op} stroke={INK} strokeWidth="0.5" />
  )
  return (
    <svg
      viewBox="0 0 344 200"
      role="img"
      aria-label="Row layout puts every column of a record together, so reading two fields still pulls whole records off disk. Column layout stores each field contiguously, so a query reads only the two stripes it asked for and never touches the rest."
    >
      <text x="12" y="16" fontFamily={MONO} fontSize="7" fill={MUTED}>
        a query wants 2 fields out of 200
      </text>

      <text x="12" y="38" fontFamily={MONO} fontSize="6.6" fill={TERRA}>
        by row — one record at a time
      </text>
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3, 4, 5, 6, 7].map((c) => (
          <g key={`r${r}c${c}`}>{cell(16 + c * 38, 46 + r * 12, 36, c === 1 || c === 5 ? DENIM : MUTED, c === 1 || c === 5 ? 0.8 : 0.18)}</g>
        )),
      )}
      <text x="16" y="96" fontFamily={MONO} fontSize="6.2" fill={TERRA}>
        every read drags the whole record through
      </text>

      <text x="12" y="124" fontFamily={MONO} fontSize="6.6" fill={DENIM}>
        by column — one field at a time
      </text>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((c) => (
        <g key={`c${c}`}>
          <rect
            x={16 + c * 38}
            y="132"
            width="36"
            height="34"
            fill={c === 1 || c === 5 ? DENIM : MUTED}
            opacity={c === 1 || c === 5 ? 0.8 : 0.12}
            stroke={INK}
            strokeWidth="0.5"
          />
        </g>
      ))}
      <text x="16" y="182" fontFamily={MONO} fontSize="6.2" fill={DENIM}>
        the other 198 fields are never opened
      </text>
      <text x="16" y="196" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        and a stripe is all one type, so it compresses far harder
      </text>
    </svg>
  )
}

/** Ch 15 — the second paper's actual contribution, which is the part people
 *  skip. Values alone cannot say where in a nested record they sat, so each
 *  one carries two small integers. This is Figure 3 of the Dremel paper for
 *  one column, and it is worth reading a row at a time. */
export function RepetitionLevelDiagram() {
  const rows: [string, string, string][] = [
    ['en-us', '0', '2'],
    ['en', '2', '2'],
    ['NULL', '1', '1'],
    ['en-gb', '1', '2'],
    ['NULL', '0', '1'],
  ]
  return (
    <svg
      viewBox="0 0 344 200"
      role="img"
      aria-label="One column of nested values, each carrying a repetition level and a definition level. Repetition says which repeated field the value repeated at; definition says how many optional levels were actually present. Together they encode the record structure losslessly."
    >
      <text x="12" y="16" fontFamily={MONO} fontSize="7" fill={MUTED}>
        column: Name.Language.Code — two records, striped
      </text>
      <text x="16" y="40" fontFamily={MONO} fontSize="6.4" fill={MUTED}>
        value
      </text>
      <text x="150" y="40" fontFamily={MONO} fontSize="6.4" fill={DENIM}>
        r
      </text>
      <text x="186" y="40" fontFamily={MONO} fontSize="6.4" fill={TERRA}>
        d
      </text>
      <line x1="16" y1="46" x2="220" y2="46" stroke={MUTED} strokeWidth="0.8" />
      {rows.map(([v, r, d], i) => (
        <g key={i}>
          <text x="16" y={62 + i * 16} fontFamily={MONO} fontSize="6.6" fill={v === 'NULL' ? MUTED : INK}>
            {v}
          </text>
          <text x="150" y={62 + i * 16} fontFamily={MONO} fontSize="6.6" fill={DENIM}>
            {r}
          </text>
          <text x="186" y={62 + i * 16} fontFamily={MONO} fontSize="6.6" fill={TERRA}>
            {d}
          </text>
        </g>
      ))}
      <text x="228" y="62" fontFamily={MONO} fontSize="6" fill={MUTED}>
        r = 0 starts
      </text>
      <text x="228" y="72" fontFamily={MONO} fontSize="6" fill={MUTED}>
        a new record
      </text>
      <text x="228" y="94" fontFamily={MONO} fontSize="6" fill={MUTED}>
        NULLs are never
      </text>
      <text x="228" y="104" fontFamily={MONO} fontSize="6" fill={MUTED}>
        stored — d says
      </text>
      <text x="228" y="114" fontFamily={MONO} fontSize="6" fill={MUTED}>
        they were absent
      </text>

      <text x="16" y="158" fontFamily={MONO} fontSize="6.2" fill={DENIM}>
        r: at which repeated field did this value repeat
      </text>
      <text x="16" y="172" fontFamily={MONO} fontSize="6.2" fill={TERRA}>
        d: how many optional ancestors were actually present
      </text>
      <text x="16" y="190" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        two small integers, packed to as few bits as the schema needs
      </text>
    </svg>
  )
}

/** Ch 16 — the sentence that turned out to be the product. Paying by the
 *  compute-hour makes the two bars cost the same, and one of them finishes
 *  before lunch. The paper puts this in a single aside and then says elasticity
 *  is the biggest differentiator of the whole architecture. */
export function ElasticityDiagram() {
  return (
    <svg
      viewBox="0 0 344 190"
      role="img"
      aria-label="A data load taking fifteen hours on four nodes takes about two hours on thirty-two. Both consume a similar number of compute-hours, so the price is roughly the same, but the wall-clock time differs by more than sevenfold."
    >
      <text x="12" y="16" fontFamily={MONO} fontSize="7" fill={MUTED}>
        the same bill, a different afternoon
      </text>

      <text x="12" y="44" fontFamily={MONO} fontSize="6.4" fill={MUTED}>
        4 nodes
      </text>
      <rect x="76" y="34" width="240" height="16" fill={TERRA} opacity="0.3" stroke={TERRA} strokeWidth="1.2" />
      <text x="82" y="46" fontFamily={MONO} fontSize="6.4" fill={INK}>
        15 hours
      </text>

      <text x="12" y="82" fontFamily={MONO} fontSize="6.4" fill={MUTED}>
        32 nodes
      </text>
      <rect x="76" y="72" width="32" height="16" fill={DENIM} opacity="0.85" stroke={DENIM} strokeWidth="1.2" />
      <text x="116" y="84" fontFamily={MONO} fontSize="6.4" fill={DENIM}>
        2 hours
      </text>

      <line x1="12" y1="108" x2="332" y2="108" stroke={MUTED} strokeWidth="0.8" />
      <text x="12" y="128" fontFamily={MONO} fontSize="6.4" fill={INK}>
        4 × 15 = 60 node-hours · 32 × 2 = 64 node-hours
      </text>
      <text x="12" y="148" fontFamily={MONO} fontSize="6.2" fill={DENIM}>
        you rent by the node-hour, so these cost about the same
      </text>
      <text x="12" y="166" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        which makes wall-clock time nearly free — and that turned out to be
      </text>
      <text x="12" y="180" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        the feature people were buying, rather than the query engine
      </text>
    </svg>
  )
}

/** Ch 16 — why the coupling had to go. In shared-nothing the data lives on the
 *  node, so changing the number of nodes means moving data with the same
 *  machines that are meant to be answering queries. Put the data somewhere else
 *  and resizing costs nothing to move. */
export function SharedDataDiagram() {
  const node = (x: number, y: number, withDisk: boolean, accent: string) => (
    <>
      <rect x={x} y={y} width="26" height="14" fill={accent} opacity="0.75" stroke={INK} strokeWidth="0.8" />
      {withDisk && <rect x={x + 4} y={y + 16} width="18" height="8" fill={MUTED} opacity="0.5" stroke={INK} strokeWidth="0.6" />}
    </>
  )
  return (
    <svg
      viewBox="0 0 344 206"
      role="img"
      aria-label="In a shared-nothing cluster each node owns the data on its own disk, so adding or removing a node means reshuffling data using the same machines that answer queries. With the data in an object store, the compute nodes hold only caches, so resizing moves nothing."
    >
      <text x="12" y="16" fontFamily={MONO} fontSize="7" fill={MUTED}>
        what happens when you add a node
      </text>

      <text x="12" y="38" fontFamily={MONO} fontSize="6.6" fill={TERRA}>
        shared-nothing — the data is on the node
      </text>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>{node(20 + i * 46, 48, true, TERRA)}</g>
      ))}
      <text x="212" y="60" fontFamily={MONO} fontSize="6.4" fill={TERRA}>
        + 1 node ⇒ reshuffle,
      </text>
      <text x="212" y="72" fontFamily={MONO} fontSize="6.4" fill={TERRA}>
        using these same nodes
      </text>

      <text x="12" y="112" fontFamily={MONO} fontSize="6.6" fill={DENIM}>
        shared-data — the node holds only a cache
      </text>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>{node(20 + i * 46, 122, false, DENIM)}</g>
      ))}
      <text x="212" y="132" fontFamily={MONO} fontSize="6.4" fill={DENIM}>
        + 1 node ⇒ nothing moves
      </text>
      <rect x="20" y="152" width="292" height="16" fill={MUTED} opacity="0.22" stroke={INK} strokeWidth="0.8" />
      <text x="26" y="164" fontFamily={MONO} fontSize="6.4" fill={INK}>
        object storage — immutable files, shared by every cluster
      </text>

      <text x="12" y="190" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        so resizing, failing over and upgrading stop being data-movement problems
      </text>
      <text x="12" y="204" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        and start being scheduling problems, which are much easier
      </text>
    </svg>
  )
}

/** Epilogue — the retreat, itemised. Six properties the 2007 paper argued for,
 *  and what the 2022 paper says the system does now. The accent is doing work:
 *  denim marks the one decision that survived intact, and it is the least
 *  famous one on the list. Everything the paper is remembered for is in the
 *  column that got walked back. */
export function RetreatDiagram() {
  const rows: [string, string, string, boolean][] = [
    ['who takes a write', 'any node on the ring', 'the group’s elected leader', false],
    ['ordering writes', 'vector clocks', 'Multi-Paxos', false],
    ['two concurrent writes', 'siblings, you merge them', 'the leader decides', false],
    ['a consistent read', 'not on offer', 'ask for one, it costs more', false],
    ['placing a key', 'hash it onto a ring', 'hash it, then split by heat', true],
    ['who operates it', 'your team, in your account', 'nobody you have met', false],
  ]
  return (
    <svg
      viewBox="0 0 344 216"
      role="img"
      aria-label="Six properties compared between the 2007 Dynamo paper and the 2022 DynamoDB paper. Writes moved from any node on the ring to an elected leader, ordering from vector clocks to Multi-Paxos, conflict resolution from application-merged siblings to leader decision, consistent reads from unavailable to available on request, and operation from your own team to a managed service. Only the hashing of the key survived, and even that now splits ranges under load."
    >
      <text x="12" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        same name, fifteen years apart
      </text>
      <text x="118" y="32" fontFamily={MONO} fontSize="6.6" fill={INK}>
        Dynamo · 2007
      </text>
      <text x="232" y="32" fontFamily={MONO} fontSize="6.6" fill={INK}>
        DynamoDB · 2022
      </text>
      <line x1="12" y1="38" x2="332" y2="38" stroke={INK} strokeWidth="1" />
      <line x1="226" y1="26" x2="226" y2="176" stroke={MUTED} strokeWidth="0.8" />

      {rows.map(([prop, then, now, kept], i) => {
        const y = 54 + i * 20
        return (
          <g key={prop}>
            <text x="12" y={y} fontFamily={MONO} fontSize="6.2" fill={MUTED}>
              {prop}
            </text>
            <text x="118" y={y} fontFamily={MONO} fontSize="6.2" fill={kept ? DENIM : INK}>
              {then}
            </text>
            <text x="232" y={y} fontFamily={MONO} fontSize="6.2" fill={kept ? DENIM : INK}>
              {now}
            </text>
          </g>
        )
      })}

      <line x1="12" y1="182" x2="332" y2="182" stroke={MUTED} strokeWidth="0.8" />
      <text x="12" y="196" fontFamily={MONO} fontSize="6.2" fill={DENIM}>
        one row survived, and it is not the one anybody quotes
      </text>
      <text x="12" y="210" fontFamily={MONO} fontSize="6.2" fill={TERRA}>
        the property it was built for — a write with no leader — is gone
      </text>
    </svg>
  )
}

/** Epilogue — throughput dilution, with the paper's own arithmetic. The whole
 *  point is the direction of the second row: the customer asked for more
 *  capacity and every partition ended up with less than before. Nothing here
 *  is a bug; it is what happens when you divide a table's budget evenly among
 *  partitions and then split partitions. */
export function ThroughputDilutionDiagram() {
  const bar = (x: number, y: number, w: number, accent: string) => (
    <rect x={x} y={y} width={w} height="14" fill={accent} opacity="0.7" stroke={INK} strokeWidth="0.8" />
  )
  return (
    <svg
      viewBox="0 0 344 214"
      role="img"
      aria-label="A table provisioned at 3200 write units is split into four partitions of 800 each. Raise the table to 6000 write units and it becomes eight partitions of 750 each, so every individual partition can now absorb less traffic than before the increase."
    >
      <text x="12" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        one partition tops out around 1000 write units
      </text>

      <text x="12" y="38" fontFamily={MONO} fontSize="6.4" fill={INK}>
        table asks for 3200 → 4 partitions
      </text>
      {[0, 1, 2, 3].map((i) => (
        <g key={`a${i}`}>{bar(12 + i * 46, 46, 40, DENIM)}</g>
      ))}
      <text x="204" y="57" fontFamily={MONO} fontSize="6.4" fill={DENIM}>
        800 each
      </text>

      <text x="12" y="90" fontFamily={MONO} fontSize="6.4" fill={INK}>
        table asks for 6000 → 8 partitions
      </text>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <g key={`b${i}`}>{bar(12 + i * 23, 98, 19, TERRA)}</g>
      ))}
      <text x="204" y="126" fontFamily={MONO} fontSize="6.4" fill={TERRA}>
        750 each — less than before
      </text>

      <line x1="12" y1="142" x2="332" y2="142" stroke={MUTED} strokeWidth="0.8" />
      <text x="12" y="158" fontFamily={MONO} fontSize="6.2" fill={INK}>
        you bought more capacity and each partition got weaker
      </text>
      <text x="12" y="174" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        splitting for size does it too, and the table did nothing at all
      </text>
      <text x="12" y="196" fontFamily={MONO} fontSize="6.2" fill={DENIM}>
        the answer was to stop giving throughput to partitions
      </text>
      <text x="12" y="210" fontFamily={MONO} fontSize="6.2" fill={DENIM}>
        and start counting it for the table as a whole
      </text>
    </svg>
  )
}

/** Epilogue — the cache that is not allowed to hide anything. A 99.75 percent
 *  hit rate means the store behind it is sized for a quarter of a percent of
 *  the traffic, which is fine until the caches go cold together. Refreshing on
 *  a HIT costs strictly more every second and removes the cliff. */
export function MetadataLoadDiagram() {
  return (
    <svg
      viewBox="0 0 344 220"
      role="img"
      aria-label="With a conventional cache the metadata store sees almost no traffic until the caches go cold, at which point load spikes toward the full request rate. When every cache hit also triggers an asynchronous refresh, the metadata store sees a constant high load and a cold start changes nothing."
    >
      <text x="12" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        load on the metadata store, over time
      </text>

      <text x="12" y="34" fontFamily={MONO} fontSize="6.4" fill={TERRA}>
        cache the routing table — 99.75% hits
      </text>
      <line x1="12" y1="102" x2="332" y2="102" stroke={MUTED} strokeWidth="0.8" />
      <line x1="12" y1="44" x2="12" y2="102" stroke={MUTED} strokeWidth="0.8" />
      <path d="M12 99 L150 99 L164 50 L196 50 L214 99 L332 99" fill="none" stroke={TERRA} strokeWidth="1.6" />
      <text x="150" y="44" fontFamily={MONO} fontSize="6" fill={TERRA}>
        a fresh router fleet boots, cold
      </text>
      <text x="18" y="94" fontFamily={MONO} fontSize="6" fill={MUTED}>
        near zero, most of the time
      </text>

      <text x="12" y="130" fontFamily={MONO} fontSize="6.4" fill={DENIM}>
        refresh on every hit, asynchronously
      </text>
      <line x1="12" y1="192" x2="332" y2="192" stroke={MUTED} strokeWidth="0.8" />
      <line x1="12" y1="140" x2="12" y2="192" stroke={MUTED} strokeWidth="0.8" />
      <path d="M12 152 L332 152" fill="none" stroke={DENIM} strokeWidth="1.6" />
      <text x="18" y="166" fontFamily={MONO} fontSize="6" fill={DENIM}>
        flat, and sized for it — a cold start changes nothing
      </text>

      <text x="12" y="214" fontFamily={MONO} fontSize="6.2" fill={INK}>
        the second one costs more every second and has no cliff in it
      </text>
    </svg>
  )
}

/** The close — the season's whole argument as three steps and a loop. Terra on
 *  the guarantee that gets sold and on the bill, denim on what gets built back:
 *  the same two accents the chapters use, so the shape is recognisable before
 *  the words are read. The loop is the point — the bill is the next act's wall,
 *  which is why the book has six acts instead of one. */
export function OneMoveDiagram() {
  const box = (x: number, w: number, n: string, top: string, sub: string, accent: string) => (
    <>
      <rect x={x} y="46" width={w} height="38" fill="none" stroke={accent} strokeWidth="1.6" />
      <text x={x + 6} y="40" fontFamily={MONO} fontSize="6" fill={MUTED}>
        {n}
      </text>
      <text x={x + 6} y="62" fontFamily={MONO} fontSize="7" fill={accent}>
        {top}
      </text>
      <text x={x + 6} y="76" fontFamily={MONO} fontSize="6" fill={MUTED}>
        {sub}
      </text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 172"
      role="img"
      aria-label="Every act of the season makes the same three moves: it hits a limit, gives up a guarantee to get past it, and then spends years buying that guarantee back in a cheaper form. The cost of the last step becomes the wall the next act runs into."
    >
      <text x="12" y="18" fontFamily={MONO} fontSize="7" fill={MUTED}>
        seventeen papers, the same three steps
      </text>

      {box(12, 96, '01', 'hit a wall', 'the world says no', INK)}
      <line x1="112" y1="65" x2="122" y2="65" stroke={INK} strokeWidth="1.2" />
      {box(126, 96, '02', 'sell a guarantee', 'to get past it', TERRA)}
      <line x1="226" y1="65" x2="236" y2="65" stroke={INK} strokeWidth="1.2" />
      {box(240, 92, '03', 'buy it back', 'cheaper, years later', DENIM)}

      <path d="M286 88 L286 108 L58 108 L58 90" fill="none" stroke={TERRA} strokeWidth="1.2" strokeDasharray="3 3" />
      <text x="72" y="122" fontFamily={MONO} fontSize="6.2" fill={TERRA}>
        and what step 3 costs is the next act’s wall
      </text>
      <line x1="12" y1="136" x2="332" y2="136" stroke={MUTED} strokeWidth="0.8" />
      <text x="12" y="152" fontFamily={MONO} fontSize="6.2" fill={INK}>
        which is why there are six acts and not one
      </text>
      <text x="12" y="166" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        nobody in this book solved it; they moved the bill somewhere payable
      </text>
    </svg>
  )
}

/* ============================================================
   SEASON 2 · ACT I — the job that ran all night.
   Season 1's figures drew topology: who talks to whom, and what
   is a copy of what. From here the subject is time, so these
   draw duration, order and the cost of freshness instead. Same
   palette and the same two accents; terra is now "you paid for
   this again" and denim is "kept, and reused."
   ============================================================ */

/** Ch 18 — the arithmetic that made a company. The same logistic regression
 *  over the same 256 MB, and twelve of the fifteen seconds go to turning bytes
 *  into objects that were objects a moment ago. Numbers are Figure 9 and the
 *  paper's own breakdown of it (§6.1). */
export function WhereTheTimeWentDiagram() {
  const X = 14
  const U = 19.6 // viewBox units per second
  const seg = (x: number, w: number, y: number, fill: string) => (
    <rect x={x} y={y} width={w} height="20" fill={fill} fillOpacity="0.22" stroke={fill} strokeWidth="1.2" />
  )
  const key = (y: number, c: string, label: string, n: string) => (
    <>
      <rect x={X} y={y - 6} width="8" height="8" fill={c} fillOpacity="0.22" stroke={c} strokeWidth="1.1" />
      <text x={X + 14} y={y} fontFamily={MONO} fontSize="6.2" fill={INK}>
        {label}
      </text>
      <text x="330" y={y} textAnchor="end" fontFamily={MONO} fontSize="6.2" fill={c}>
        {n}
      </text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 210"
      role="img"
      aria-label="One logistic regression pass over 256 megabytes takes 15.4 seconds when the records are read as text through HDFS: 2 seconds of HDFS overhead, 7 seconds of parsing, 3 seconds turning binary into Java objects, and only about 3 seconds of actual regression. The same pass over records already held as objects in memory takes 2.9 seconds."
    >
      <text x={X} y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        one pass over 256 MB — where the seconds went
      </text>

      <text x={X} y="34" fontFamily={MONO} fontSize="6.4" fill={TERRA}>
        read it back the way the batch job does
      </text>
      {seg(X, 2.0 * U, 42, TERRA)}
      {seg(X + 2.0 * U, 7.0 * U, 42, TERRA)}
      {seg(X + 9.0 * U, 3.0 * U, 42, TERRA)}
      {seg(X + 12.0 * U, 3.4 * U, 42, DENIM)}
      <text x={X + 15.4 * U + 6} y="56" fontFamily={MONO} fontSize="6.6" fill={TERRA}>
        15.4s
      </text>

      <text x={X} y="86" fontFamily={MONO} fontSize="6.4" fill={DENIM}>
        the same records, still objects in RAM
      </text>
      {seg(X, 2.9 * U, 94, DENIM)}
      <text x={X + 2.9 * U + 6} y="108" fontFamily={MONO} fontSize="6.6" fill={DENIM}>
        2.9s
      </text>

      <line x1={X} y1="128" x2="330" y2="128" stroke={MUTED} strokeWidth="0.8" />
      {key(144, TERRA, 'getting the bytes out of HDFS', '2.0s')}
      {key(158, TERRA, 'parsing the text', '7.0s')}
      {key(172, TERRA, 'binary → Java objects', '3.0s')}
      {key(186, DENIM, 'the regression itself', '~3.4s')}

      <text x={X} y="204" fontFamily={MONO} fontSize="6.2" fill={INK}>
        nine more iterations, and it does all four again
      </text>
    </svg>
  )
}

/** Ch 18 — the reframe the chapter is built on. Making memory survivable was
 *  assumed to mean copying it; RDDs copy the recipe instead. Both numbers are
 *  from §6.3: a 100 GB working set against lineage graphs under 10 KB. */
export function LineageNotDataDiagram() {
  return (
    <svg
      viewBox="0 0 344 208"
      role="img"
      aria-label="To make in-memory data survive a failure you can replicate the working set — 100 gigabytes copied across a network slower than RAM, twice the memory — or you can keep the sequence of operations that produced it, which for these jobs was under 10 kilobytes."
    >
      <text x="14" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        a machine died. how do you get its share back?
      </text>

      <rect x="14" y="28" width="150" height="86" fill="none" stroke={TERRA} strokeWidth="1.6" />
      <text x="24" y="44" fontFamily={MONO} fontSize="6.8" fill={TERRA}>
        keep a second copy
      </text>
      <text x="24" y="60" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        of the data itself
      </text>
      <rect x="24" y="70" width="130" height="14" fill={TERRA} fillOpacity="0.22" stroke={TERRA} strokeWidth="1" />
      <text x="28" y="80" fontFamily={MONO} fontSize="6" fill={TERRA}>
        100 GB, over the network
      </text>
      <text x="24" y="98" fontFamily={MONO} fontSize="6" fill={MUTED}>
        twice the RAM, and the wire
      </text>
      <text x="24" y="108" fontFamily={MONO} fontSize="6" fill={MUTED}>
        is far slower than RAM
      </text>

      <rect x="180" y="28" width="150" height="86" fill="none" stroke={DENIM} strokeWidth="1.6" />
      <text x="190" y="44" fontFamily={MONO} fontSize="6.8" fill={DENIM}>
        keep the recipe
      </text>
      <text x="190" y="60" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        how it was made, in order
      </text>
      <rect x="190" y="70" width="9" height="14" fill={DENIM} fillOpacity="0.22" stroke={DENIM} strokeWidth="1" />
      <text x="204" y="80" fontFamily={MONO} fontSize="6" fill={DENIM}>
        under 10 KB
      </text>
      <text x="190" y="98" fontFamily={MONO} fontSize="6" fill={MUTED}>
        recompute only the lost
      </text>
      <text x="190" y="108" fontFamily={MONO} fontSize="6" fill={MUTED}>
        pieces, on every machine at once
      </text>

      <line x1="14" y1="132" x2="330" y2="132" stroke={MUTED} strokeWidth="0.8" />
      <text x="14" y="150" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        the two bars are not to scale — 10 KB against 100 GB is ten
      </text>
      <text x="14" y="162" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        million to one, and no page is wide enough to draw that
      </text>
      <text x="14" y="184" fontFamily={MONO} fontSize="6.4" fill={DENIM}>
        the right-hand copy is small enough to keep on every machine,
      </text>
      <text x="14" y="196" fontFamily={MONO} fontSize="6.4" fill={DENIM}>
        for every dataset, all the time. that is the whole idea
      </text>
    </svg>
  )
}

/** Ch 18 — the bill. "Degrades gracefully" is true and it is not free: losing a
 *  quarter of the memory costs more than doubling the machines gave back.
 *  Numbers are Figure 12 — logistic regression, 100 GB, 25 machines. */
export function MemoryCliffDiagram() {
  const pts: Array<[number, number, string]> = [
    [0, 68.8, '0%'],
    [25, 58.1, '25%'],
    [50, 40.7, '50%'],
    [75, 29.7, '75%'],
    [100, 11.5, '100%'],
  ]
  const x = (p: number) => 40 + (p / 100) * 268
  const y = (s: number) => 148 - (s / 70) * 96
  return (
    <svg
      viewBox="0 0 344 196"
      role="img"
      aria-label="Iteration time for logistic regression on 100 gigabytes across 25 machines, as the share of the dataset held in memory rises: 68.8 seconds with none of it cached, 58.1 at a quarter, 40.7 at half, 29.7 at three quarters, and 11.5 seconds with all of it in memory."
    >
      <text x="14" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        iteration time vs. how much of the data fits
      </text>
      <line x1="40" y1="148" x2="322" y2="148" stroke={MUTED} strokeWidth="0.8" />
      <line x1="40" y1="44" x2="40" y2="148" stroke={MUTED} strokeWidth="0.8" />
      <text x="14" y="54" fontFamily={MONO} fontSize="5.8" fill={MUTED}>
        70s
      </text>
      <text x="14" y="150" fontFamily={MONO} fontSize="5.8" fill={MUTED}>
        0
      </text>
      <path
        d={pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0])} ${y(p[1])}`).join(' ')}
        fill="none"
        stroke={DENIM}
        strokeWidth="1.8"
      />
      {pts.map((p) => (
        <circle key={p[2]} cx={x(p[0])} cy={y(p[1])} r="2.6" fill={DENIM} />
      ))}
      <text x={x(0) + 4} y={y(68.8) - 4} fontFamily={MONO} fontSize="6.2" fill={TERRA}>
        68.8s
      </text>
      <text x={x(100)} y={y(11.5) - 8} textAnchor="end" fontFamily={MONO} fontSize="6.2" fill={DENIM}>
        11.5s
      </text>
      {pts.map((p) => (
        <text
          key={'t' + p[2]}
          x={x(p[0])}
          y="160"
          textAnchor="middle"
          fontFamily={MONO}
          fontSize="5.8"
          fill={MUTED}
        >
          {p[2]}
        </text>
      ))}
      <text x="181" y="174" textAnchor="middle" fontFamily={MONO} fontSize="6" fill={MUTED}>
        share of the dataset held in RAM
      </text>
      <text x="14" y="190" fontFamily={MONO} fontSize="6.2" fill={INK}>
        it degrades gracefully, and the last quarter is worth 2.6× on its own
      </text>
    </svg>
  )
}

/** Ch 19 — what a timestamp has to be if one engine is going to do both jobs.
 *  A plain sequence number cannot say "third time round the loop, on the second
 *  batch of input"; a coordinate can, and the three system vertices are the only
 *  places it ever changes. */
export function TimelyTimestampDiagram() {
  const rule = (y: number, name: string, effect: string, accent: string) => (
    <>
      <text x="20" y={y} fontFamily={MONO} fontSize="6.4" fill={accent}>
        {name}
      </text>
      <text x="96" y={y} fontFamily={MONO} fontSize="6.2" fill={INK}>
        {effect}
      </text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 214"
      role="img"
      aria-label="A timely dataflow timestamp is a pair: the input epoch a record came from, and one counter per enclosing loop. An ingress vertex appends a fresh loop counter, a feedback vertex increments the innermost one, and an egress vertex drops it. Only those three vertices ever change a timestamp."
    >
      <text x="14" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        every message carries a coordinate, not a position
      </text>

      <rect x="14" y="26" width="316" height="44" fill="none" stroke={INK} strokeWidth="1.6" />
      <text x="26" y="48" fontFamily={MONO} fontSize="8.4" fill={INK}>
        ( epoch , ⟨ c₁ , … , c_k ⟩ )
      </text>
      <text x="26" y="62" fontFamily={MONO} fontSize="5.8" fill={MUTED}>
        which batch of input
      </text>
      <text x="150" y="62" fontFamily={MONO} fontSize="5.8" fill={MUTED}>
        which time round each enclosing loop
      </text>

      <text x="14" y="90" fontFamily={MONO} fontSize="6.4" fill={MUTED}>
        three vertices, and nothing else, may touch it
      </text>
      <line x1="14" y1="96" x2="330" y2="96" stroke={MUTED} strokeWidth="0.8" />
      {rule(112, 'ingress', 'entering a loop — append a counter, at 0', DENIM)}
      {rule(128, 'feedback', 'round again — add 1 to the innermost', DENIM)}
      {rule(144, 'egress', 'leaving the loop — drop the counter', DENIM)}

      <line x1="14" y1="158" x2="330" y2="158" stroke={MUTED} strokeWidth="0.8" />
      <text x="14" y="176" fontFamily={MONO} fontSize="6.2" fill={INK}>
        t₁ ≤ t₂ only when both parts agree, so the order is partial
      </text>
      <text x="14" y="190" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        and a partial order is exactly what lets the system prove that
      </text>
      <text x="14" y="202" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        no message at time t can ever arrive again
      </text>
    </svg>
  )
}

/** Ch 19 — the claim, drawn. A batch engine walks down one column; a stream
 *  processor walks along one row; the argument of the paper is that these are
 *  the same picture with different corners filled in. */
export function BothShapesDiagram() {
  const panel = (x: number, title: string, filled: (c: number, r: number) => boolean, accent: string) => (
    <>
      <text x={x} y="34" fontFamily={MONO} fontSize="6.4" fill={accent}>
        {title}
      </text>
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2, 3, 4].map((c) => (
          <circle
            key={`${x}-${r}-${c}`}
            cx={x + 8 + c * 17}
            cy={48 + r * 17}
            r={filled(c, r) ? 3.4 : 2}
            fill={filled(c, r) ? accent : 'none'}
            stroke={filled(c, r) ? accent : MUTED}
            strokeWidth="1"
          />
        )),
      )}
    </>
  )
  return (
    <svg
      viewBox="0 0 344 176"
      role="img"
      aria-label="Three grids with input epochs across and loop iterations down. A batch engine fills one column: many iterations over one fixed input. A stream processor fills one row: many inputs, no iteration. Timely dataflow fills the whole grid, running iterations of one epoch while a later epoch is still arriving."
    >
      <text x="14" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        across: which batch of input · down: which time round the loop
      </text>
      {panel(14, 'batch, in memory', (c) => c === 0, TERRA)}
      {panel(126, 'a stream processor', (_c, r) => r === 0, TERRA)}
      {panel(238, 'timely dataflow', () => true, DENIM)}

      <line x1="14" y1="132" x2="330" y2="132" stroke={MUTED} strokeWidth="0.8" />
      <text x="14" y="150" fontFamily={MONO} fontSize="6.2" fill={INK}>
        the third one is not a third system — it is the first two, unrestricted
      </text>
      <text x="14" y="166" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        iteration 4 of epoch 1 can run while epoch 3 is still arriving
      </text>
    </svg>
  )
}

/** Ch 19 — the season's ladder, measured for the first time. The same query
 *  against the same graph: insist on the freshest answer and you queue behind
 *  the work that makes it; accept one second of age and the wait is gone.
 *  Numbers are §6.4 — 32,000 tweets/s, 10 queries/s. */
export function StalenessDialDiagram() {
  return (
    <svg
      viewBox="0 0 344 200"
      role="img"
      aria-label="Interactive queries against a streaming graph computation. Asking for the freshest possible answer returns in 500 to 900 milliseconds because the query waits behind the update that makes it correct. Asking for data one second old returns in under 10 milliseconds, with occasional peaks near 100."
    >
      <text x="14" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        same question, same data, one dial moved
      </text>

      <text x="14" y="36" fontFamily={MONO} fontSize="6.4" fill={TERRA}>
        &ldquo;answer from the very latest input&rdquo;
      </text>
      <rect x="14" y="44" width="272" height="18" fill={TERRA} fillOpacity="0.22" stroke={TERRA} strokeWidth="1.2" />
      <text x="22" y="57" fontFamily={MONO} fontSize="6.4" fill={TERRA}>
        500–900 ms
      </text>
      <text x="14" y="76" fontFamily={MONO} fontSize="6" fill={MUTED}>
        the query is correct, and it waits behind the work that makes it correct
      </text>

      <text x="14" y="102" fontFamily={MONO} fontSize="6.4" fill={DENIM}>
        &ldquo;answer from data one second old&rdquo;
      </text>
      <rect x="14" y="110" width="7" height="18" fill={DENIM} fillOpacity="0.22" stroke={DENIM} strokeWidth="1.2" />
      <text x="28" y="123" fontFamily={MONO} fontSize="6.4" fill={DENIM}>
        under 10 ms, mostly
      </text>
      <text x="14" y="142" fontFamily={MONO} fontSize="6" fill={MUTED}>
        equally consistent — just describing a moment that has passed
      </text>

      <line x1="14" y1="158" x2="330" y2="158" stroke={MUTED} strokeWidth="0.8" />
      <text x="14" y="176" fontFamily={MONO} fontSize="6.4" fill={INK}>
        one second of age, and the wait falls by roughly fifty times
      </text>
      <text x="14" y="192" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        this is the trade the whole season is about, with a number on it
      </text>
    </svg>
  )
}

/** Ch 20 — the same sentence, compiled twice. The user writes the query they
 *  would have written for a finished table; the planner turns it into something
 *  that maintains a running answer. The point of the drawing is that the top
 *  line is identical in both columns. */
export function IncrementalizeDiagram() {
  const col = (x: number, head: string, rows: string[], accent: string) => (
    <>
      <text x={x} y="72" fontFamily={MONO} fontSize="6.4" fill={accent}>
        {head}
      </text>
      <rect x={x} y="78" width="146" height="62" fill="none" stroke={accent} strokeWidth="1.4" />
      {rows.map((r, i) => (
        <text key={r} x={x + 8} y={94 + i * 14} fontFamily={MONO} fontSize="6" fill={i === rows.length - 1 ? accent : INK}>
          {r}
        </text>
      ))}
    </>
  )
  return (
    <svg
      viewBox="0 0 344 190"
      role="img"
      aria-label="One SQL query written once. Compiled as a batch plan it scans the whole table and groups it. Compiled as a streaming plan it reads only what arrived, updates a stored aggregate, and writes out what changed. The query text is the same in both cases."
    >
      <text x="14" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        what the user writes
      </text>
      <rect x="14" y="22" width="316" height="30" fill="none" stroke={INK} strokeWidth="1.6" />
      <text x="24" y="42" fontFamily={MONO} fontSize="7" fill={INK}>
        select country, count(*) from clicks group by country
      </text>

      <line x1="120" y1="52" x2="88" y2="66" stroke={MUTED} strokeWidth="1" />
      <line x1="224" y1="52" x2="256" y2="66" stroke={MUTED} strokeWidth="1" />

      {col(14, 'run it over a table', ['scan every row', 'group and count', 'write the answer', 'once, from scratch'], MUTED)}
      {col(184, 'run it over a stream', ['read what arrived', 'add to the stored counts', 'write what changed', 'again, every trigger'], DENIM)}

      <text x="14" y="164" fontFamily={MONO} fontSize="6.4" fill={INK}>
        the difference is a compiler decision, not a second program
      </text>
      <text x="14" y="180" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        which is why the backfill and the live job cannot drift apart
      </text>
    </svg>
  )
}

/** Ch 20 — the result table is one thing; how it reaches the outside world is
 *  a separate decision. Keeping them separate is the whole argument against
 *  making the user annotate every operator. */
export function OutputModeDiagram() {
  const mode = (y: number, name: string, what: string, cost: string) => (
    <>
      <text x="18" y={y} fontFamily={MONO} fontSize="6.6" fill={DENIM}>
        {name}
      </text>
      <text x="90" y={y} fontFamily={MONO} fontSize="6.2" fill={INK}>
        {what}
      </text>
      <text x="90" y={y + 11} fontFamily={MONO} fontSize="5.8" fill={MUTED}>
        {cost}
      </text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 186"
      role="img"
      aria-label="The result table is defined by the query alone. Writing it out is a separate choice: complete mode rewrites the whole table each time, append mode adds only new rows and cannot be used where a row might change later, update mode writes only the keys whose values moved."
    >
      <text x="14" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        one definition, three ways of writing it down
      </text>
      <rect x="14" y="24" width="316" height="26" fill="none" stroke={INK} strokeWidth="1.6" />
      <text x="24" y="41" fontFamily={MONO} fontSize="6.6" fill={INK}>
        the result table = the query, over everything received so far
      </text>

      <line x1="14" y1="62" x2="330" y2="62" stroke={MUTED} strokeWidth="0.8" />
      {mode(80, 'complete', 'rewrite the whole table', 'correct always, and priced by the size of the answer')}
      {mode(110, 'append', 'add rows, never revise one', 'refused where a row could still change — including this query')}
      {mode(140, 'update', 'write the keys that moved', 'needs a sink that can be updated by key')}

      <line x1="14" y1="156" x2="330" y2="156" stroke={MUTED} strokeWidth="0.8" />
      <text x="14" y="176" fontFamily={MONO} fontSize="6.2" fill={INK}>
        the reader never annotates an operator — the planner refuses the bad pairs
      </text>
    </svg>
  )
}

/** Ch 20 — the act's closing argument, as a ladder with prices on it. Same API,
 *  same query, same guarantees; three settings of one dial, and each rung buys
 *  its freshness with a different thing. */
export function FreshnessPriceDiagram() {
  const BAR = 126
  const rung = (y: number, w: number, label: string, lat: string, price: string, accent: string) => (
    <>
      <text x="14" y={y + 12} fontFamily={MONO} fontSize="6.2" fill={accent}>
        {label}
      </text>
      <rect x={BAR} y={y} width={w} height="18" fill={accent} fillOpacity="0.2" stroke={accent} strokeWidth="1.2" />
      <text x={BAR + w + 6} y={y + 12} fontFamily={MONO} fontSize="6.2" fill={INK}>
        {lat}
      </text>
      <text x="14" y={y + 30} fontFamily={MONO} fontSize="5.8" fill={MUTED}>
        {price}
      </text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 212"
      role="img"
      aria-label="Three settings of one dial in the same system. Running a single batch every few hours is hours stale and up to ten times cheaper because no servers run around the clock. Microbatching is seconds stale and recovers a dead node one task at a time. Continuous operators are under ten milliseconds and give up shuffles, rescaling and straggler mitigation."
    >
      <text x="14" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        one query, one API, three settings of the same dial
      </text>

      {rung(30, 150, 'one batch, every few hours', 'hours', 'and up to 10× cheaper — nothing runs between times', MUTED)}
      {rung(84, 92, 'microbatches', 'seconds', 'a dead machine costs one task, not the cluster', DENIM)}
      {rung(138, 30, 'continuous operators', 'under 10 ms', 'no shuffles, no rescaling, no straggler cover', TERRA)}

      <line x1="14" y1="182" x2="330" y2="182" stroke={MUTED} strokeWidth="0.8" />
      <text x="14" y="202" fontFamily={MONO} fontSize="6.4" fill={INK}>
        nobody rewrites anything to move between them — that is the argument
      </text>
    </svg>
  )
}

/* ============================================================
   SEASON 2 · ACT II — time is not when it arrived.
   Act I's figures drew duration. From here the subject is two
   different clocks that were always being conflated, so these
   draw the gap between them: what a watermark claims, what it
   costs to be sure, and what you owe the people you already
   answered.
   ============================================================ */

/** Ch 21 — the low watermark, defined. It is not a clock and it is not a
 *  guess about the future; it is the oldest unfinished work anywhere behind
 *  you, and the recursion is what makes it composable down a pipeline. */
export function WatermarkDefinitionDiagram() {
  const stage = (x: number, name: string, oldest: string) => (
    <>
      <rect x={x} y="46" width="82" height="34" fill="none" stroke={INK} strokeWidth="1.6" />
      <text x={x + 8} y="60" fontFamily={MONO} fontSize="6.6" fill={INK}>
        {name}
      </text>
      <text x={x + 8} y="72" fontFamily={MONO} fontSize="5.8" fill={MUTED}>
        {oldest}
      </text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 190"
      role="img"
      aria-label="A computation's low watermark is the minimum of its own oldest unfinished record and the low watermarks of everything feeding into it. Because the definition is recursive, a stage's watermark bounds all the work behind it, not just its own."
    >
      <text x="14" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        the low watermark of a stage
      </text>
      <text x="14" y="32" fontFamily={MONO} fontSize="7" fill={INK}>
        min( its own oldest unfinished record ,
      </text>
      <text x="60" y="42" fontFamily={MONO} fontSize="7" fill={INK}>
        the watermark of everything feeding it )
      </text>

      {stage(14, 'injector', 'oldest file open')}
      {stage(114, 'window count', 'oldest bucket')}
      {stage(214, 'dip detector', 'oldest pending')}
      <line x1="96" y1="63" x2="112" y2="63" stroke={DENIM} strokeWidth="1.4" />
      <line x1="196" y1="63" x2="212" y2="63" stroke={DENIM} strokeWidth="1.4" />
      <path d="M300 63 L318 63 L318 92" fill="none" stroke={DENIM} strokeWidth="1.4" />
      <text x="298" y="104" textAnchor="end" fontFamily={MONO} fontSize="6" fill={DENIM}>
        nothing older than this is still coming
      </text>

      <line x1="14" y1="120" x2="330" y2="120" stroke={MUTED} strokeWidth="0.8" />
      <text x="14" y="138" fontFamily={MONO} fontSize="6.4" fill={INK}>
        it counts in-flight, stored and pending-delivery work alike
      </text>
      <text x="14" y="152" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        so it is a fact about the pipeline, not a reading off a clock
      </text>
      <text x="14" y="174" fontFamily={MONO} fontSize="6.4" fill={TERRA}>
        and it only ever moves forward — even when that makes it wrong
      </text>
    </svg>
  )
}

/** Ch 21 — what a receipt costs. Five steps in a fixed order, and the third
 *  one is the whole guarantee: the record's id is committed in the same
 *  atomic write as the state it changed. */
export function ExactlyOnceLedgerDiagram() {
  const step = (y: number, n: string, text: string, accent: string) => (
    <>
      <text x="16" y={y} fontFamily={MONO} fontSize="6" fill={MUTED}>
        {n}
      </text>
      <text x="38" y={y} fontFamily={MONO} fontSize="6.4" fill={accent}>
        {text}
      </text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 196"
      role="img"
      aria-label="On receiving a record the framework checks it against deduplication data, runs user code, commits the pending state changes and the record's unique id in one atomic write, acknowledges the sender, and only then sends downstream. A Bloom filter of known fingerprints gives a fast path for records never seen before."
    >
      <text x="14" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        what happens when a record arrives
      </text>
      <line x1="14" y1="22" x2="330" y2="22" stroke={MUTED} strokeWidth="0.8" />
      {step(40, '1', 'seen this id before? discard if so', MUTED)}
      {step(58, '2', 'run the user’s code — may change state,', INK)}
      <text x="38" y="70" fontFamily={MONO} fontSize="6.4" fill={INK}>
        timers, and records to send on
      </text>
      {step(90, '3', 'commit all of it, AND the record’s id,', DENIM)}
      <text x="38" y="102" fontFamily={MONO} fontSize="6.4" fill={DENIM}>
        in one atomic write
      </text>
      {step(122, '4', 'acknowledge the sender', MUTED)}
      {step(140, '5', 'now send downstream', MUTED)}

      <line x1="14" y1="152" x2="330" y2="152" stroke={MUTED} strokeWidth="0.8" />
      <text x="14" y="170" fontFamily={MONO} fontSize="6.2" fill={INK}>
        step 3 is the guarantee: the receipt and the change are one fact
      </text>
      <text x="14" y="186" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        a bloom filter of seen fingerprints keeps step 1 off the disk
      </text>
    </svg>
  )
}

/** Ch 21 — the bill, and the reason the paper lets you switch it off. Same
 *  pipeline, same hardware, guarantees on and off. Numbers are §8.1. */
export function GuaranteePriceDiagram() {
  const U = 2.6 // units per millisecond
  const row = (y: number, label: string, med: number, p95: number, accent: string) => (
    <>
      <text x="14" y={y} fontFamily={MONO} fontSize="6.4" fill={accent}>
        {label}
      </text>
      <rect x="14" y={y + 6} width={med * U} height="11" fill={accent} fillOpacity="0.28" stroke={accent} strokeWidth="1.1" />
      <rect
        x={14 + med * U}
        y={y + 6}
        width={(p95 - med) * U}
        height="11"
        fill={accent}
        fillOpacity="0.1"
        stroke={accent}
        strokeWidth="0.9"
        strokeDasharray="2 2"
      />
      <text x={14 + p95 * U + 6} y={y + 15} fontFamily={MONO} fontSize="6" fill={INK}>
        {med} ms · 95th {p95} ms
      </text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 178"
      role="img"
      aria-label="The same single-stage pipeline on 200 CPUs. With exactly-once delivery and checkpoint-before-send switched off, median record latency is 3.6 milliseconds and the 95th percentile is 30. With both switched on, the median is 33.7 milliseconds and the 95th percentile is 93.8."
    >
      <text x="14" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        one stage, 200 CPUs — solid is the median, dashed to the 95th
      </text>
      {row(38, 'guarantees off — retries may duplicate', 3.6, 30, DENIM)}
      {row(84, 'exactly-once + checkpoint before send', 33.7, 93.8, TERRA)}

      <line x1="14" y1="128" x2="330" y2="128" stroke={MUTED} strokeWidth="0.8" />
      <text x="14" y="146" fontFamily={MONO} fontSize="6.4" fill={INK}>
        about nine times the median, to never process a record twice
      </text>
      <text x="14" y="162" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        which is why it is a switch, and why a stateless filter turns it off
      </text>
    </svg>
  )
}

/** Interlude — the three clocks, and the one property that actually separates
 *  them. Event time is fixed and belongs to the world; processing time is
 *  different at every stage; ingestion time is fixed and belongs to you. */
export function ThreeTimesDiagram() {
  const col = (x: number, w: number, name: string, rows: string[], accent: string) => (
    <>
      <text x={x} y="34" fontFamily={MONO} fontSize="6.6" fill={accent}>
        {name}
      </text>
      <line x1={x} y1="40" x2={x + w} y2="40" stroke={accent} strokeWidth="1.2" />
      {rows.map((r, i) => (
        <text key={r + i} x={x} y={56 + i * 16} fontFamily={MONO} fontSize="5.8" fill={i === 2 ? accent : INK}>
          {r}
        </text>
      ))}
    </>
  )
  return (
    <svg
      viewBox="0 0 344 168"
      role="img"
      aria-label="Event time is when it happened, is set by the producer, and never changes. Processing time is when a stage looked at it, is set by your infrastructure, and is different at every stage. Ingestion time is when it entered your system, is set by your edge, and is fixed once."
    >
      <text x="14" y="16" fontFamily={MONO} fontSize="7" fill={MUTED}>
        three timestamps a record can carry
      </text>
      {col(14, 96, 'event time', ['when it happened', 'the producer sets it', 'never changes'], DENIM)}
      {col(126, 96, 'processing time', ['when a stage read it', 'your machines set it', 'differs at every stage'], TERRA)}
      {col(238, 96, 'ingestion time', ['when it reached you', 'your edge sets it', 'fixed, and not the truth'], MUTED)}
      <line x1="14" y1="116" x2="330" y2="116" stroke={MUTED} strokeWidth="0.8" />
      <text x="14" y="134" fontFamily={MONO} fontSize="6.4" fill={INK}>
        most bugs here are a system offering one and a person meaning another
      </text>
      <text x="14" y="152" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        the middle column is the one Act I was silently using
      </text>
    </svg>
  )
}

/** Interlude — why the choice is not a preference. Group by when you looked and
 *  the same input gives different answers on a rerun; group by when it happened
 *  and it does not. That is the whole argument, and it is testable. */
export function ReproducibleDiagram() {
  const run = (y: number, label: string, a: string, b: string, same: boolean) => (
    <>
      <text x="14" y={y} fontFamily={MONO} fontSize="6.4" fill={same ? DENIM : TERRA}>
        {label}
      </text>
      <rect x="150" y={y - 9} width="78" height="14" fill="none" stroke={same ? DENIM : TERRA} strokeWidth="1.1" />
      <text x="156" y={y} fontFamily={MONO} fontSize="5.8" fill={INK}>
        {a}
      </text>
      <rect x="238" y={y - 9} width="78" height="14" fill="none" stroke={same ? DENIM : TERRA} strokeWidth="1.1" />
      <text x="244" y={y} fontFamily={MONO} fontSize="5.8" fill={INK}>
        {b}
      </text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 176"
      role="img"
      aria-label="The same recorded input, replayed twice. Grouped by processing time the two runs give different answers, because the second run reads the file faster. Grouped by event time they give the same answer both times."
    >
      <text x="14" y="16" fontFamily={MONO} fontSize="7" fill={MUTED}>
        the same saved input, replayed twice
      </text>
      <text x="156" y="34" fontFamily={MONO} fontSize="5.8" fill={MUTED}>
        run 1
      </text>
      <text x="244" y="34" fontFamily={MONO} fontSize="5.8" fill={MUTED}>
        run 2
      </text>
      {run(56, 'bucketed by when you read it', '41, 38, 44', '52, 39, 32', false)}
      {run(86, 'bucketed by when it happened', '43, 40, 40', '43, 40, 40', true)}

      <line x1="14" y1="106" x2="330" y2="106" stroke={MUTED} strokeWidth="0.8" />
      <text x="14" y="124" fontFamily={MONO} fontSize="6.4" fill={TERRA}>
        the first is not wrong on either run — it answers a question about
      </text>
      <text x="14" y="136" fontFamily={MONO} fontSize="6.4" fill={TERRA}>
        your pipeline that nobody asked
      </text>
      <text x="14" y="160" fontFamily={MONO} fontSize="6.4" fill={DENIM}>
        only the second can be re-run, backfilled, or audited
      </text>
    </svg>
  )
}

/** Ch 22 — the decomposition the whole paper is remembered for. One pipeline,
 *  four questions, answered independently. Season 1's systems answered all
 *  four at once by having no vocabulary to separate them. */
export function FourQuestionsDiagram() {
  const q = (y: number, word: string, question: string, answer: string) => (
    <>
      <text x="16" y={y} fontFamily={MONO} fontSize="7" fill={DENIM}>
        {word}
      </text>
      <text x="76" y={y} fontFamily={MONO} fontSize="6.2" fill={INK}>
        {question}
      </text>
      <text x="76" y={y + 11} fontFamily={MONO} fontSize="5.8" fill={MUTED}>
        {answer}
      </text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 196"
      role="img"
      aria-label="A pipeline decomposes into four independent questions: what results are computed, answered by the transformations; where in event time they are grouped, answered by windowing; when in processing time they are emitted, answered by triggers; and how later results relate to earlier ones, answered by the accumulation mode."
    >
      <text x="14" y="16" fontFamily={MONO} fontSize="7" fill={MUTED}>
        four questions, and you answer them separately
      </text>
      <line x1="14" y1="24" x2="330" y2="24" stroke={MUTED} strokeWidth="0.8" />
      {q(44, 'what', 'results are being computed', 'the transformations — sums, joins, counts')}
      {q(80, 'where', 'in event time they are grouped', 'windowing — fixed, sliding, per-user sessions')}
      {q(116, 'when', 'in processing time they go out', 'triggers — at the watermark, on a clock, on a count')}
      {q(152, 'how', 'later results relate to earlier ones', 'discard, accumulate, or accumulate and retract')}

      <line x1="14" y1="170" x2="330" y2="170" stroke={MUTED} strokeWidth="0.8" />
      <text x="14" y="188" fontFamily={MONO} fontSize="6.2" fill={INK}>
        every system before this answered all four by answering none of them
      </text>
    </svg>
  )
}

/** Ch 22 — a watermark used as the only signal fails in both directions, and
 *  the two failures want opposite fixes. That is why it stops being the
 *  trigger and becomes one trigger among several. */
export function WatermarkBothWaysDiagram() {
  return (
    <svg
      viewBox="0 0 344 186"
      role="img"
      aria-label="A watermark used as the sole signal for emitting results fails two ways. Sometimes it is too fast, and data arrives behind it. Sometimes it is too slow, because one straggling record holds back the bound for the whole pipeline."
    >
      <text x="14" y="16" fontFamily={MONO} fontSize="7" fill={MUTED}>
        the same bound, two opposite complaints
      </text>

      <rect x="14" y="28" width="150" height="88" fill="none" stroke={TERRA} strokeWidth="1.6" />
      <text x="24" y="46" fontFamily={MONO} fontSize="6.8" fill={TERRA}>
        sometimes too fast
      </text>
      <text x="24" y="62" fontFamily={MONO} fontSize="6" fill={INK}>
        data arrives behind it, so
      </text>
      <text x="24" y="74" fontFamily={MONO} fontSize="6" fill={INK}>
        the answer you published
      </text>
      <text x="24" y="86" fontFamily={MONO} fontSize="6" fill={INK}>
        was incomplete
      </text>
      <text x="24" y="104" fontFamily={MONO} fontSize="6" fill={MUTED}>
        wants: emit again, later
      </text>

      <rect x="180" y="28" width="150" height="88" fill="none" stroke={TERRA} strokeWidth="1.6" />
      <text x="190" y="46" fontFamily={MONO} fontSize="6.8" fill={TERRA}>
        sometimes too slow
      </text>
      <text x="190" y="62" fontFamily={MONO} fontSize="6" fill={INK}>
        one straggling record holds
      </text>
      <text x="190" y="74" fontFamily={MONO} fontSize="6" fill={INK}>
        the bound back for the
      </text>
      <text x="190" y="86" fontFamily={MONO} fontSize="6" fill={INK}>
        whole pipeline
      </text>
      <text x="190" y="104" fontFamily={MONO} fontSize="6" fill={MUTED}>
        wants: emit sooner, early
      </text>

      <line x1="14" y1="132" x2="330" y2="132" stroke={MUTED} strokeWidth="0.8" />
      <text x="14" y="150" fontFamily={MONO} fontSize="6.4" fill={DENIM}>
        one signal cannot want both — so stop making it the only signal
      </text>
      <text x="14" y="168" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        it becomes one trigger among several, and a window emits more than once
      </text>
    </svg>
  )
}

/** Ch 23 — the algorithm, in the only four frames it needs. A barrier arrives
 *  on one input, that input is held, the rest catch up, and only then does the
 *  operator write its state. Nothing else in the graph stops. */
export function BarrierAlignDiagram() {
  const frame = (x: number, n: string, a: string, b: string, note: string, aOn: boolean, bOn: boolean, snap: boolean) => (
    <>
      <text x={x} y="30" fontFamily={MONO} fontSize="6" fill={MUTED}>
        {n}
      </text>
      <rect x={x + 22} y="40" width="30" height="22" fill={snap ? DENIM : 'none'} fillOpacity={snap ? 0.2 : 1} stroke={snap ? DENIM : INK} strokeWidth="1.4" />
      <line x1={x} y1="46" x2={x + 22} y2="46" stroke={aOn ? DENIM : MUTED} strokeWidth={aOn ? 1.8 : 1} />
      <line x1={x} y1="56" x2={x + 22} y2="56" stroke={bOn ? DENIM : MUTED} strokeWidth={bOn ? 1.8 : 1} />
      <text x={x - 2} y="44" textAnchor="end" fontFamily={MONO} fontSize="5.4" fill={aOn ? DENIM : MUTED}>
        {a}
      </text>
      <text x={x - 2} y="59" textAnchor="end" fontFamily={MONO} fontSize="5.4" fill={bOn ? DENIM : MUTED}>
        {b}
      </text>
      <text x={x + 22} y="76" fontFamily={MONO} fontSize="5.4" fill={snap ? DENIM : MUTED}>
        {note}
      </text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 168"
      role="img"
      aria-label="An operator with two inputs. A barrier arrives on the first input, which is then blocked while the second catches up. When the barrier arrives on the second input too, the operator writes its state, forwards the barrier, and unblocks both inputs."
    >
      <text x="14" y="16" fontFamily={MONO} fontSize="7" fill={MUTED}>
        one operator, two inputs, one barrier
      </text>
      {frame(36, '1', '▸', '', 'running', true, false, false)}
      {frame(116, '2', 'held', '', 'waiting', true, false, false)}
      {frame(196, '3', '▸', '▸', 'writes state', true, true, true)}
      {frame(276, '4', '', '', 'flowing', false, false, false)}

      <line x1="14" y1="98" x2="330" y2="98" stroke={MUTED} strokeWidth="0.8" />
      <text x="14" y="116" fontFamily={MONO} fontSize="6.4" fill={INK}>
        the only pause is one input of one operator, for as long as its
      </text>
      <text x="14" y="128" fontFamily={MONO} fontSize="6.4" fill={INK}>
        siblings take to catch up
      </text>
      <text x="14" y="152" fontFamily={MONO} fontSize="6.4" fill={DENIM}>
        no record in transit is stored — the state already reflects them
      </text>
    </svg>
  )
}

/** Ch 23 — the measurement that settles it. Stopping the world costs more the
 *  more often you do it; pushing a marker through costs about the same either
 *  way. Numbers read off Figure 6 (10 nodes, 1 billion records). */
export function SnapshotCostDiagram() {
  const x = (iv: number) => 44 + (iv / 10) * 268
  const y = (s: number) => 122 - ((s - 250) / 560) * 84
  const sync: Array<[number, number]> = [
    [1, 790],
    [2, 560],
    [3, 460],
    [5, 380],
    [10, 330],
  ]
  const abs: Array<[number, number]> = [
    [1, 330],
    [2, 315],
    [3, 305],
    [5, 300],
    [10, 295],
  ]
  const path = (pts: Array<[number, number]>) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0])} ${y(p[1])}`).join(' ')
  /* The series are keyed below the axis rather than annotated in place. Two
     lines that converge at the right leave nowhere inside the plot to put a
     label without something crossing it, and the geometry lint says so. */
  const key = (kx: number, colour: string, label: string) => (
    <>
      <line x1={kx} y1="150" x2={kx + 14} y2="150" stroke={colour} strokeWidth="1.8" />
      <text x={kx + 19} y="152.5" fontFamily={MONO} fontSize="6" fill={colour}>
        {label}
      </text>
    </>
  )
  return (
    <svg
      viewBox="0 0 344 192"
      role="img"
      aria-label="Net runtime against snapshot interval on ten nodes processing a billion records. Stopping the world to snapshot costs far more as snapshots get more frequent; asynchronous barrier snapshotting stays nearly flat at every interval. Values are read off the paper's figure."
    >
      <text x="14" y="14" fontFamily={MONO} fontSize="7" fill={MUTED}>
        net runtime vs. how often you snapshot
      </text>
      <line x1="44" y1="122" x2="322" y2="122" stroke={MUTED} strokeWidth="0.8" />
      <line x1="44" y1="34" x2="44" y2="122" stroke={MUTED} strokeWidth="0.8" />
      <path d={path(sync)} fill="none" stroke={TERRA} strokeWidth="1.8" />
      <path d={path(abs)} fill="none" stroke={DENIM} strokeWidth="1.8" />
      <text x="44" y="134" fontFamily={MONO} fontSize="5.8" fill={MUTED}>
        every 1s
      </text>
      <text x="322" y="134" textAnchor="end" fontFamily={MONO} fontSize="5.8" fill={MUTED}>
        every 10s
      </text>
      {key(14, TERRA, 'stop the world')}
      {key(150, DENIM, 'push a barrier through')}
      <text x="14" y="172" fontFamily={MONO} fontSize="6.2" fill={INK}>
        the flat line runs within a few per cent of no fault tolerance at all
      </text>
      <text x="14" y="186" fontFamily={MONO} fontSize="6.2" fill={MUTED}>
        values read off the paper’s figure, so treat them as shape not decimals
      </text>
    </svg>
  )
}
