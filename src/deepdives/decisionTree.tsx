/* HOW THE STORE GETS PICKED — the model's decision procedure, as a tree.
   ============================================================================
   The shape is the argument. Six nodes hang off one trunk, and the trunk only
   continues because the node above it did NOT settle the answer — which is why
   the split, the last fork, decides so many real workloads: by the time a
   reader's eye reaches it, the throughput arithmetic has already tied.

   Deliberately general. No preset's figures appear: a worked example belongs
   beside the workload that produced it, and a procedure that only reads
   correctly with one workload's numbers substituted in is not a procedure.

   Colour grammar is the book's, unchanged:
     ink    — a question the model asks
     muted  — a step that transforms rather than decides (nothing leaves here)
     terra  — where a store falls out
     denim  — where the tree produces an answer

   Layout discipline from actDiagrams.tsx: mono text is ~0.6em per character,
   so every string below was budgeted against its box before being placed —
   the trunk's 300 units hold 43 characters at fontSize 11, and 55 at 8.5.
   Arrowheads are paths, not <marker> elements: marker ids are document-global
   and this page already renders other figures. */

import type { ReactElement } from 'react'

const INK = '#1a1a1a'
const DENIM = '#3f6191'
const TERRA = '#bd5f3d'
const MUTED = '#8a8177'
const MONO = 'JetBrains Mono, ui-monospace, monospace'
const DISPLAY = 'Playfair Display, Georgia, serif'

type Tone = 'ask' | 'flow' | 'out' | 'win'

const T: Record<Tone, { s: string; f: string; w: number; t: string; shadow: boolean }> = {
  ask: { s: INK, f: '#fffdf8', w: 2, t: INK, shadow: true },
  flow: { s: MUTED, f: '#ffffff', w: 1.2, t: '#4a453d', shadow: false },
  out: { s: TERRA, f: '#f6e9e2', w: 2, t: '#97462a', shadow: true },
  win: { s: DENIM, f: '#e8edf5', w: 2, t: '#29456c', shadow: true },
}

/** A node. `sub` is the smaller second line — the criteria, or the consequence. */
function N({
  x, y, w, h, tone, label, sub,
}: {
  x: number; y: number; w: number; h: number; tone: Tone; label: string; sub?: string
}) {
  const c = T[tone]
  const cx = x + w / 2
  return (
    <g>
      {c.shadow && <rect x={x + 3} y={y + 3} width={w} height={h} fill={INK} />}
      <rect x={x} y={y} width={w} height={h} fill={c.f} stroke={c.s} strokeWidth={c.w} />
      <text
        x={cx} y={sub ? y + h / 2 - 3 : y + h / 2 + 4} textAnchor="middle"
        fontFamily={DISPLAY} fontSize={13} fill={c.t}
      >
        {label}
      </text>
      {sub && (
        <text x={cx} y={y + h / 2 + 13} textAnchor="middle" fontFamily={MONO} fontSize={8.5} fill={MUTED}>
          {sub}
        </text>
      )}
    </g>
  )
}

/** An edge, with its answer written on it. Arrowhead drawn as geometry. */
function E({
  x1, y1, x2, y2, label, at,
}: {
  x1: number; y1: number; x2: number; y2: number; label?: string; at?: 'right' | 'above'
}) {
  const down = y2 > y1
  const head = down
    ? `M ${x2 - 4} ${y2 - 7} L ${x2 + 4} ${y2 - 7} L ${x2} ${y2} Z`
    : x2 < x1
      ? `M ${x2 + 7} ${y2 - 4} L ${x2 + 7} ${y2 + 4} L ${x2} ${y2} Z`
      : `M ${x2 - 7} ${y2 - 4} L ${x2 - 7} ${y2 + 4} L ${x2} ${y2} Z`
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={1.6} />
      <path d={head} fill={INK} />
      {label && (
        <text
          x={at === 'right' ? x1 + 8 : (x1 + x2) / 2}
          y={at === 'right' ? (y1 + y2) / 2 + 3 : y1 - 6}
          textAnchor={at === 'right' ? 'start' : 'middle'}
          fontFamily={MONO} fontSize={8.5} fontWeight={700} fill={MUTED}
        >
          {label}
        </text>
      )}
    </g>
  )
}

export function StoreDecisionTree(): ReactElement {
  return (
    <svg viewBox="0 0 672 512" width="100%" role="img" aria-label="How the calculator picks a store, as a decision tree">
      <title>How the store gets picked</title>

      <N x={186} y={6} w={300} h={28} tone="flow" label="Every store on the table" />
      <E x1={336} y1={34} x2={336} y2={62} />

      {/* 1 — the promise filter. The only gate a requirement can shut. */}
      <N x={186} y={62} w={300} h={44} tone="ask"
         label="Can it keep the promise?"
         sub="atomicity · durability · read shape · fits one machine" />
      <N x={6} y={64} w={150} h={40} tone="out" label="Ruled out" sub="no number un-rules it" />
      <E x1={186} y1={84} x2={156} y2={84} label="NO" />
      <E x1={336} y1={106} x2={336} y2={140} label="YES" at="right" />

      {/* 2, 3 — nothing leaves; the number everyone is judged on changes. */}
      <N x={186} y={140} w={300} h={44} tone="flow"
         label="What load actually reaches it"
         sub="misses, not reads · sustained, not peak · pointer rows" />
      <E x1={336} y1={184} x2={336} y2={218} />

      <N x={186} y={218} w={300} h={44} tone="flow"
         label="Which wall does it hit first"
         sub="read pressure · write stream · insert seeks" />
      <E x1={336} y1={262} x2={336} y2={296} />

      {/* 4 — the only place throughput is allowed to decide. */}
      <N x={186} y={296} w={300} h={44} tone="ask"
         label="Is one wall clearly the lowest?"
         sub="more than 5% below every other survivor" />
      <N x={516} y={298} w={150} h={40} tone="win" label="It wins" sub="throughput decided it" />
      <E x1={486} y1={318} x2={516} y2={318} label="YES" />
      <E x1={336} y1={340} x2={336} y2={376} label="NO — a tie" at="right" />

      {/* 5 — and when it has not decided, this is what is left. */}
      <N x={186} y={376} w={300} h={44} tone="ask"
         label="Is anything actually straining?"
         sub="a wall past 25%, or the simplest tie past 8 shards" />
      <N x={6} y={378} w={150} h={40} tone="win" label="The simplest machine" sub="one primary, not a ring" />
      <E x1={186} y1={398} x2={156} y2={398} label="NO" />
      <E x1={336} y1={420} x2={336} y2={456} label="YES" at="right" />

      <N x={186} y={456} w={300} h={44} tone="win"
         label="Fewest pieces wins"
         sub="who runs the split, not which engine is faster" />
    </svg>
  )
}
