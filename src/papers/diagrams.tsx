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
