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
