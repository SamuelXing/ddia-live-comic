/* The season's act figures — one picture per act, on the book's index page.
   ============================================================================
   These are not eight unrelated diagrams. They are the same world redrawn
   under new pressure, and the SHAPE CHANGE is the argument: one box (prologue)
   → a pyramid with a master on top (I) → a ring with nobody in charge (II) →
   the floor underneath both (III) → a storey added on top (IV) → the whole
   thing tipped on its side with the log at the centre (V) → a fork (VI) → the
   ring growing its organs back (epilogue).

   One fixed colour grammar, so a reader learns it once:
     past  (muted, thin)  — what earlier acts already built; still load-bearing
     new   (denim, thick) — what THIS act adds
     pain  (terra)        — the pressure: what is breaking, or what it cost

   Same layout discipline as diagrams.tsx: mono text is ~0.6em per character,
   so at fontSize 7 a 24-char label needs ~100 viewBox units. Every string here
   was budgeted against its box before being placed.

   Arrowheads are drawn as paths rather than <marker> elements on purpose —
   all eight of these render on one page, and marker ids are document-global. */

import type { ReactElement } from 'react'

const DENIM = '#3f6191'
const TERRA = '#bd5f3d'
const MUTED = '#8a8177'
const MONO = 'JetBrains Mono, monospace'

type Tone = 'past' | 'new' | 'pain'

const T: Record<Tone, { s: string; f: string; w: number }> = {
  past: { s: MUTED, f: '#ffffff', w: 1 },
  new: { s: DENIM, f: '#e8edf5', w: 1.8 },
  pain: { s: TERRA, f: '#f6e9e2', w: 1.8 },
}

/** A labelled box. `sub` is the second, smaller line. */
function B({
  x,
  y,
  w,
  h,
  tone = 'past',
  label,
  sub,
}: {
  x: number
  y: number
  w: number
  h: number
  tone?: Tone
  label: string
  sub?: string
}) {
  const c = T[tone]
  const cx = x + w / 2
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={c.f} stroke={c.s} strokeWidth={c.w} />
      <text
        x={cx}
        y={sub ? y + h / 2 - 1 : y + h / 2 + 2.6}
        textAnchor="middle"
        fontFamily={MONO}
        fontSize="7"
        fill={c.s}
      >
        {label}
      </text>
      {sub && (
        <text x={cx} y={y + h / 2 + 9} textAnchor="middle" fontFamily={MONO} fontSize="5.8" fill={c.s}>
          {sub}
        </text>
      )}
    </g>
  )
}

/** A plain connector — no head. */
function L({ x1, y1, x2, y2, tone = 'past' }: { x1: number; y1: number; x2: number; y2: number; tone?: Tone }) {
  const c = T[tone]
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c.s} strokeWidth={c.w} />
}

/** A connector with an arrowhead, drawn as geometry (see file header). */
function A({
  x1,
  y1,
  x2,
  y2,
  tone = 'past',
  dash,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  tone?: Tone
  dash?: boolean
}) {
  const c = T[tone]
  const a = Math.atan2(y2 - y1, x2 - x1)
  const bx = x2 - Math.cos(a) * 6
  const by = y2 - Math.sin(a) * 6
  const px = -Math.sin(a) * 3.4
  const py = Math.cos(a) * 3.4
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={bx}
        y2={by}
        stroke={c.s}
        strokeWidth={c.w}
        strokeDasharray={dash ? '3 3' : undefined}
      />
      <path d={`M${x2} ${y2} L${bx + px} ${by + py} L${bx - px} ${by - py} z`} fill={c.s} />
    </g>
  )
}

/** A line of type. `at` picks the anchor so callers read as coordinates. */
function C({
  x,
  y,
  tone = 'past',
  size = 6.5,
  mid,
  end,
  children,
}: {
  x: number
  y: number
  tone?: Tone
  size?: number
  mid?: boolean
  end?: boolean
  children: string
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={mid ? 'middle' : end ? 'end' : 'start'}
      fontFamily={MONO}
      fontSize={size}
      fill={T[tone].s}
    >
      {children}
    </text>
  )
}

/* ---------------------------------------------------------------- Prologue */
/** The baseline shape every later act is a departure from: one box. */
function ActPrologue() {
  return (
    <svg
      viewBox="0 0 344 152"
      role="img"
      aria-label="A single box labelled one machine, sitting on one disk — the shape of a database before the web."
    >
      <C x={14} y={16} size={7}>
        the answer, for about thirty years
      </C>
      <B x={72} y={30} w={200} h={54} tone="new" label="ONE MACHINE" sub="SQL · B-trees · transactions" />
      <L x1={172} y1={84} x2={172} y2={96} tone="past" />
      <B x={112} y={96} w={120} h={20} label="one disk, one clock" />
      <C x={172} y={140} mid tone="pain">
        every promise in this book is made here first
      </C>
    </svg>
  )
}

/* ------------------------------------------------------------------- Act I */
/** A pyramid: two very different clients over one substrate, master on top. */
function ActI() {
  return (
    <svg
      viewBox="0 0 344 190"
      role="img"
      aria-label="MapReduce and Bigtable sit on GFS, with Chubby above Bigtable — a pyramid in which every component has one master."
    >
      <C x={14} y={22} size={7}>
        one substrate, two very
      </C>
      <C x={14} y={33} size={7}>
        different clients
      </C>

      <B x={196} y={10} w={132} h={28} tone="new" label="Chubby" sub="master election · locks" />
      <L x1={262} y1={38} x2={262} y2={64} tone="new" />

      <B x={16} y={64} w={140} h={34} tone="new" label="MapReduce" sub="sweep all of it" />
      <B x={188} y={64} w={140} h={34} tone="new" label="Bigtable" sub="find one row, now" />

      <L x1={86} y1={98} x2={86} y2={116} tone="new" />
      <L x1={258} y1={98} x2={258} y2={116} tone="new" />
      <L x1={86} y1={116} x2={258} y2={116} tone="new" />
      <L x1={172} y1={116} x2={172} y2={130} tone="new" />

      <B x={32} y={130} w={280} h={34} tone="new" label="GFS" sub="64 MB chunks ×3 — append only, never edit" />

      <C x={172} y={182} mid tone="pain">
        and every one of them answers to a single master
      </C>
    </svg>
  )
}

/* ------------------------------------------------------------------ Act II */
/** Deliberately the opposite picture: the pyramid struck out, a flat ring. */
function ActII() {
  const cx = 240
  const cy = 92
  const r = 54
  const nodes = [0, 1, 2, 3, 4, 5].map((i) => {
    const a = (-90 + i * 60) * (Math.PI / 180)
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }
  })
  return (
    <svg
      viewBox="0 0 344 190"
      role="img"
      aria-label="The layered stack of Act One struck through, beside a ring of peer nodes with no master, one of them dead."
    >
      {/* the shape being rejected, drawn small and dim */}
      <B x={28} y={30} w={64} h={16} label="master" />
      <B x={16} y={54} w={40} h={14} label="" />
      <B x={64} y={54} w={40} h={14} label="" />
      <B x={16} y={76} w={88} h={14} label="GFS" />
      <line x1={12} y1={26} x2={108} y2={94} stroke={TERRA} strokeWidth="2" />
      <C x={16} y={110} size={6}>
        Act I: a master
      </C>
      <C x={16} y={120} size={6}>
        at the top of everything
      </C>

      <A x1={116} y1={70} x2={150} y2={70} tone="new" />

      <C x={cx} y={18} mid tone="new">
        every node takes writes
      </C>
      {nodes.map((n, i) => {
        const m = nodes[(i + 1) % nodes.length]
        return <line key={'e' + i} x1={n.x} y1={n.y} x2={m.x} y2={m.y} stroke={DENIM} strokeWidth="1.6" />
      })}
      {nodes.map((n, i) => (
        <circle
          key={'n' + i}
          cx={n.x}
          cy={n.y}
          r="12"
          fill={i === 2 ? '#f6e9e2' : '#e8edf5'}
          stroke={i === 2 ? TERRA : DENIM}
          strokeWidth="1.8"
        />
      ))}
      {/* the dead one */}
      <line x1={nodes[2].x - 6} y1={nodes[2].y - 6} x2={nodes[2].x + 6} y2={nodes[2].y + 6} stroke={TERRA} strokeWidth="1.8" />
      <line x1={nodes[2].x + 6} y1={nodes[2].y - 6} x2={nodes[2].x - 6} y2={nodes[2].y + 6} stroke={TERRA} strokeWidth="1.8" />
      <C x={cx} y={cy + 3} mid size={6.5}>
        no master
      </C>

      <C x={172} y={180} mid tone="pain">
        two nodes took the same cart. which one is later?
      </C>
    </svg>
  )
}

/* ----------------------------------------------------------------- Act III */
/** A flashback: the layer that was under everything, finally looked at. */
function ActIII() {
  return (
    <svg
      viewBox="0 0 344 176"
      role="img"
      aria-label="Bigtable, Dynamo and Cassandra resting on a newly drawn layer labelled agreement."
    >
      <C x={14} y={14} size={6.5}>
        everything you have read so far
      </C>
      <B x={14} y={22} w={96} h={26} label="Bigtable" />
      <B x={124} y={22} w={96} h={26} label="Dynamo" />
      <B x={234} y={22} w={96} h={26} label="Cassandra" />

      <A x1={62} y1={50} x2={62} y2={78} tone="new" dash />
      <A x1={172} y1={50} x2={172} y2={78} tone="new" dash />
      <A x1={282} y1={50} x2={282} y2={78} tone="new" dash />

      <B x={14} y={82} w={316} h={44} tone="new" label="AGREEMENT" sub="happened-before · Paxos · Raft · ZooKeeper" />

      <C x={172} y={148} mid tone="pain">
        Chubby was already standing on this back in Act I
      </C>
      <C x={172} y={164} mid size={6}>
        a flashback — this floor is older than everything above it
      </C>
    </svg>
  )
}

/* ------------------------------------------------------------------ Act IV */
/** A storey added on top — and a box of hardware standing outside the stack. */
function ActIV() {
  return (
    <svg
      viewBox="0 0 344 186"
      role="img"
      aria-label="A transactions layer added above Bigtable and GFS, with an external TrueTime box of GPS and atomic clocks feeding it."
    >
      <C x={14} y={16} tone="pain">
        Act I gave up atomicity across rows
      </C>

      <B x={24} y={26} w={190} h={36} tone="new" label="TRANSACTIONS" sub="Percolator · Spanner" />
      <L x1={119} y1={62} x2={119} y2={74} tone="new" />
      <B x={24} y={74} w={190} h={30} label="Bigtable" />
      <L x1={119} y1={104} x2={119} y2={112} />
      <B x={24} y={112} w={190} h={26} label="GFS" />

      <B x={236} y={40} w={96} h={44} tone="new" label="TrueTime" sub="GPS + atomic clocks" />
      <A x1={236} y1={58} x2={216} y2={46} tone="new" dash />

      <C x={172} y={166} mid tone="pain">
        one bought it with a client library, the other with hardware
      </C>
    </svg>
  )
}

/* ------------------------------------------------------------------- Act V */
/** The stack tipped on its side: the log at the centre, everything a reader. */
function ActV() {
  return (
    <svg
      viewBox="0 0 344 180"
      role="img"
      aria-label="A cache, an index and a table all drawn as readers derived from a central append-only log."
    >
      <C x={172} y={14} mid tone="new">
        everything above is a view of the log
      </C>
      <B x={22} y={22} w={88} h={26} label="the cache" />
      <B x={128} y={22} w={88} h={26} label="the index" />
      <B x={234} y={22} w={88} h={26} label="the table" />

      <A x1={66} y1={86} x2={66} y2={50} tone="new" dash />
      <A x1={172} y1={86} x2={172} y2={50} tone="new" dash />
      <A x1={278} y1={86} x2={278} y2={50} tone="new" dash />

      <B x={22} y={88} w={300} h={30} tone="new" label="THE LOG" sub="append only · ordered · never edited" />

      <L x1={22} y1={132} x2={322} y2={132} />
      <C x={22} y={144} size={6}>
        offset 0
      </C>
      <C x={322} y={144} end size={6}>
        now
      </C>

      <C x={172} y={168} mid tone="pain">
        and every reader above can be behind
      </C>
    </svg>
  )
}

/* ------------------------------------------------------------------ Act VI */
/** The fork: the same table read two ways, and the split becomes permanent. */
function ActVI() {
  return (
    <svg
      viewBox="0 0 344 180"
      role="img"
      aria-label="One table forking into a row-oriented layout for serving and a column-oriented layout for analysis."
    >
      <C x={172} y={14} mid size={6.5}>
        one table, two questions
      </C>
      <rect x={136} y={20} width={72} height={36} fill="#fff" stroke={MUTED} strokeWidth="1" />
      <line x1={160} y1={20} x2={160} y2={56} stroke={MUTED} strokeWidth="0.8" />
      <line x1={184} y1={20} x2={184} y2={56} stroke={MUTED} strokeWidth="0.8" />
      <line x1={136} y1={32} x2={208} y2={32} stroke={MUTED} strokeWidth="0.8" />
      <line x1={136} y1={44} x2={208} y2={44} stroke={MUTED} strokeWidth="0.8" />

      <A x1={150} y1={58} x2={92} y2={80} />
      <A x1={194} y1={58} x2={252} y2={80} tone="new" />

      <B x={14} y={84} w={144} h={42} label="by row" sub="give me this order" />
      <B x={186} y={84} w={144} h={42} tone="new" label="by column" sub="sum one field of 10⁹ rows" />

      <C x={172} y={152} mid tone="pain">
        same bytes, ninety degrees apart — so you keep both
      </C>
      <C x={172} y={168} mid size={6}>
        and a pipeline in between, forever
      </C>
    </svg>
  )
}

/* ---------------------------------------------------------------- Epilogue */
/** The ring of Act II, growing back the organs it was proud of removing. */
function ActEpilogue() {
  const cx = 86
  const cy = 84
  const r = 44
  const nodes = [0, 1, 2, 3, 4, 5].map((i) => {
    const a = (-90 + i * 60) * (Math.PI / 180)
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }
  })
  return (
    <svg
      viewBox="0 0 344 180"
      role="img"
      aria-label="The leaderless ring of Act Two, with a leader per shard, heat-based splitting and a control plane added back onto it."
    >
      <C x={cx} y={18} mid size={6.5}>
        the ring of Act II
      </C>
      {nodes.map((n, i) => {
        const m = nodes[(i + 1) % nodes.length]
        return <line key={'e' + i} x1={n.x} y1={n.y} x2={m.x} y2={m.y} stroke={MUTED} strokeWidth="1" />
      })}
      {nodes.map((n, i) => (
        <circle key={'n' + i} cx={n.x} cy={n.y} r="10" fill="#fff" stroke={MUTED} strokeWidth="1" />
      ))}

      <A x1={142} y1={84} x2={174} y2={84} tone="new" />

      <C x={257} y={22} mid tone="new">
        what it grew back
      </C>
      <B x={182} y={30} w={150} h={26} tone="new" label="a leader per shard" />
      <B x={182} y={64} w={150} h={26} tone="new" label="heat-based splitting" />
      <B x={182} y={98} w={150} h={26} tone="new" label="a control plane" />

      <C x={172} y={162} mid tone="pain">
        and the other family went leaderless. call it a draw.
      </C>
    </svg>
  )
}

/** Not an act opener — the close chapter uses this one directly, which is why
 *  it is exported and absent from ACT_FIGURES.
 *
 *  A contact sheet of the eight shapes the book has drawn, small, in the order
 *  they were drawn, with the loop that connects them. The only figure in this
 *  file that argues about the other figures: the shapes are not eight answers
 *  to eight questions, they are seven answers to one, and the cost of each is
 *  the wall the next one hit. */
export function SeasonShapes() {
  const cell = (i: number) => 10 + i * 42
  const mark = (i: number, g: ReactElement) => <g key={i}>{g}</g>
  const st = { stroke: MUTED, strokeWidth: 1, fill: '#ffffff' }
  const roman = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'E']
  return (
    <svg
      viewBox="0 0 344 180"
      role="img"
      aria-label="The eight shapes the season has drawn, side by side and small: one box, a pyramid, a ring, a floor beneath, a storey above, a log on its side, a fork, and the ring with its organs grown back. A dashed loop runs from the last back to the first."
    >
      <C x={12} y={18} size={6.5}>
        the same world, redrawn eight times
      </C>
      {roman.map((r, i) => (
        <text key={r} x={cell(i) + 16} y={38} textAnchor="middle" fontFamily={MONO} fontSize="6" fill={MUTED}>
          {r}
        </text>
      ))}

      {/* 0 — one machine */}
      {mark(0, <rect x={cell(0) + 6} y={56} width={20} height={12} {...st} />)}
      {/* I — a pyramid with a master on top */}
      {mark(
        1,
        <>
          <rect x={cell(1) + 10} y={46} width={12} height={8} {...st} />
          <rect x={cell(1) + 2} y={62} width={12} height={8} {...st} />
          <rect x={cell(1) + 18} y={62} width={12} height={8} {...st} />
          <line x1={cell(1) + 16} y1={54} x2={cell(1) + 8} y2={62} stroke={MUTED} strokeWidth="0.8" />
          <line x1={cell(1) + 16} y1={54} x2={cell(1) + 24} y2={62} stroke={MUTED} strokeWidth="0.8" />
        </>,
      )}
      {/* II — a ring with nobody in charge */}
      {mark(
        2,
        <>
          {[0, 1, 2, 3, 4].map((k) => {
            const a = (-90 + k * 72) * (Math.PI / 180)
            return (
              <circle key={k} cx={cell(2) + 16 + Math.cos(a) * 11} cy={62 + Math.sin(a) * 11} r="3.4" {...st} />
            )
          })}
        </>,
      )}
      {/* III — the floor underneath both */}
      {mark(
        3,
        <>
          <rect x={cell(3) + 3} y={48} width={11} height={8} {...st} />
          <rect x={cell(3) + 18} y={48} width={11} height={8} {...st} />
          <rect x={cell(3) + 3} y={64} width={26} height={7} {...st} />
        </>,
      )}
      {/* IV — a storey added on top */}
      {mark(
        4,
        <>
          <rect x={cell(4) + 5} y={46} width={22} height={7} {...st} />
          <rect x={cell(4) + 5} y={56} width={22} height={7} {...st} />
          <rect x={cell(4) + 5} y={66} width={22} height={7} {...st} />
        </>,
      )}
      {/* V — the log on its side, with readers hanging off it */}
      {mark(
        5,
        <>
          <rect x={cell(5) + 2} y={60} width={28} height={7} {...st} />
          {[0, 1, 2].map((k) => (
            <line key={k} x1={cell(5) + 8 + k * 9} y1={60} x2={cell(5) + 8 + k * 9} y2={50} stroke={MUTED} strokeWidth="0.8" />
          ))}
        </>,
      )}
      {/* VI — the fork */}
      {mark(
        6,
        <>
          <line x1={cell(6) + 3} y1={62} x2={cell(6) + 16} y2={62} stroke={MUTED} strokeWidth="1" />
          <line x1={cell(6) + 16} y1={62} x2={cell(6) + 29} y2={50} stroke={MUTED} strokeWidth="1" />
          <line x1={cell(6) + 16} y1={62} x2={cell(6) + 29} y2={74} stroke={MUTED} strokeWidth="1" />
        </>,
      )}
      {/* E — the ring with its organs back */}
      {mark(
        7,
        <>
          {[0, 1, 2, 3, 4].map((k) => {
            const a = (-90 + k * 72) * (Math.PI / 180)
            return (
              <circle
                key={k}
                cx={cell(7) + 16 + Math.cos(a) * 11}
                cy={62 + Math.sin(a) * 11}
                r="3.4"
                fill={k === 0 ? DENIM : '#ffffff'}
                stroke={k === 0 ? DENIM : MUTED}
                strokeWidth={k === 0 ? 1.8 : 1}
              />
            )
          })}
        </>,
      )}

      <path d="M330 82 L330 96 L14 96 L14 84" fill="none" stroke={TERRA} strokeWidth="1.2" strokeDasharray="3 3" />
      <path d="M14 80 L11 86 L17 86 Z" fill={TERRA} />
      <C x={172} y={112} mid tone="pain">
        the bill for one act is the wall the next one hit
      </C>
      <L x1={12} y1={126} x2={332} y2={126} />
      <C x={12} y={142}>
        so these are not eight answers to eight questions
      </C>
      <C x={12} y={158} size={6.2}>
        they are seven answers to one, and the question is which guarantee to sell
      </C>
    </svg>
  )
}

/* ---------------------------------------------------------------------------
   Season 2. The world changes: Season 1 drew TOPOLOGY, because its question was
   where the bytes sit. Season 2's question is how old the answer is, so the
   recurring shape is a TIME AXIS with an event at one end and somebody reading
   the answer at the other — and each act shortens the distance between them.

   Same colour grammar, so the reader does not have to learn a second one.
   --------------------------------------------------------------------------- */

/** Act I — the job that reruns from zero, and the disk it goes back to on every
 *  pass. The pain is the loop, not the length. */
function ActS2I() {
  return (
    <svg
      viewBox="0 0 344 180"
      role="img"
      aria-label="A batch job drawn as a long bar that restarts from the beginning every night, with each iteration writing to disk and reading it back. Below it, the same work with the intermediate result held in memory instead."
    >
      <C x={12} y={16}>
        the six-hour job, every night
      </C>
      <rect x={12} y={26} width={300} height={16} fill="#ffffff" stroke={MUTED} strokeWidth={1} />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <line x1={12 + (i + 1) * 50} y1={26} x2={12 + (i + 1) * 50} y2={42} stroke={MUTED} strokeWidth={0.8} />
          <A x1={12 + (i + 1) * 50} y1={48} x2={12 + (i + 1) * 50} y2={58} tone="pain" />
        </g>
      ))}
      <rect x={12} y={58} width={300} height={12} fill={T.pain.f} stroke={TERRA} strokeWidth={1.2} />
      <C x={162} y={67} mid tone="pain" size={6}>
        every pass goes back to disk
      </C>
      <A x1={312} y1={90} x2={16} y2={90} tone="pain" dash />
      <C x={162} y={104} mid tone="pain" size={6}>
        and tomorrow it starts from nothing again
      </C>

      <C x={12} y={128} tone="new">
        keep the middle in memory
      </C>
      <rect x={12} y={136} width={300} height={16} fill={T.new.f} stroke={DENIM} strokeWidth={1.8} />
      <C x={162} y={147} mid tone="new" size={6}>
        and remember how to rebuild it instead of copying it
      </C>
      <C x={12} y={170} size={6}>
        the answer arrives in minutes, and a dead machine still costs nothing
      </C>
    </svg>
  )
}

/** Act II — the two clocks. One axis is when it happened, the other is when you
 *  found out, and the gap between them is the whole act. */
function ActS2II() {
  const x0 = 46
  const y0 = 128
  const x1 = 250
  const y1 = 34
  const pt = (ex: number, py: number, tone: Tone) => (
    <circle cx={ex} cy={py} r="3.6" fill={T[tone].f} stroke={T[tone].s} strokeWidth={1.4} />
  )
  return (
    <svg
      viewBox="0 0 344 180"
      role="img"
      aria-label="Two axes: when an event happened, against when it arrived. Most records sit near the diagonal, but one sat in a tunnel and lands hours late, after the window that should have counted it was already closed and reported."
    >
      <C x={12} y={16}>
        the two clocks nobody separated
      </C>
      <line x1={x0} y1={y1} x2={x0} y2={y0} stroke={MUTED} strokeWidth={1} />
      <line x1={x0} y1={y0} x2={x1 + 40} y2={y0} stroke={MUTED} strokeWidth={1} />
      <C x={12} y={y1 - 6} size={5.8}>
        when you heard about it
      </C>
      <C x={x1 + 44} y={y0 + 12} end size={5.8}>
        when it happened
      </C>

      <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={MUTED} strokeWidth={0.8} strokeDasharray="3 3" />
      {pt(96, 108, 'past')}
      {pt(132, 88, 'past')}
      {pt(178, 66, 'past')}
      {pt(214, 50, 'past')}
      <C x={228} y={80} size={5.8}>
        most arrive
      </C>
      <C x={228} y={90} size={5.8}>
        about when
      </C>
      <C x={228} y={100} size={5.8}>
        they happened
      </C>

      {pt(110, 44, 'pain')}
      <A x1={110} y1={104} x2={110} y2={52} tone="pain" dash />
      <C x={116} y={40} tone="pain" size={5.8}>
        this one was in a tunnel
      </C>

      <line x1={x0} y1={62} x2={x1 + 40} y2={62} stroke={DENIM} strokeWidth={1.4} />
      <C x={x1 + 44} y={60} end tone="new" size={5.8}>
        you already answered
      </C>
      <C x={12} y={158} tone="pain" size={6.2}>
        it belongs in a total you published two hours ago
      </C>
      <C x={12} y={172} size={6}>
        so: how long do you wait, and what do you owe the people you told
      </C>
    </svg>
  )
}

/** Act III — the same query run ten thousand times over data that barely moved,
 *  against one answer kept up to date by the changes themselves. */
function ActS2III() {
  return (
    <svg
      viewBox="0 0 344 180"
      role="img"
      aria-label="On top, the same query recomputed from the whole dataset for every reader. Below, one maintained answer that each change updates in place, so a read is a lookup."
    >
      <C x={12} y={16}>
        ten thousand readers, one dashboard
      </C>
      <B x={12} y={26} w={70} h={28} label="the data" sub="barely moved" />
      {[0, 1, 2].map((i) => (
        <A key={i} x1={84} y1={32 + i * 8} x2={126} y2={32 + i * 8} tone="pain" />
      ))}
      <B x={128} y={26} w={92} h={28} tone="pain" label="the same query" sub="run again. and again." />
      {[0, 1, 2].map((i) => (
        <A key={i} x1={222} y1={32 + i * 8} x2={262} y2={32 + i * 8} tone="pain" />
      ))}
      <B x={264} y={26} w={66} h={28} label="an answer" sub="seconds old" />
      <C x={12} y={70} tone="pain" size={6}>
        all of that work happened because somebody looked
      </C>

      <L x1={12} y1={86} x2={332} y2={86} />

      <C x={12} y={104} tone="new">
        or: compute the change, not the answer
      </C>
      <B x={12} y={114} w={70} h={26} label="a change" sub="one row moved" />
      <A x1={84} y1={127} x2={126} y2={127} tone="new" />
      <B x={128} y={114} w={92} h={26} tone="new" label="update in place" sub="only what moved" />
      <A x1={222} y1={127} x2={262} y2={127} tone="new" />
      <B x={264} y={114} w={66} h={26} tone="new" label="already there" />
      <C x={12} y={158} size={6}>
        now a read is a lookup, and nobody pays for the ten thousandth one
      </C>
      <C x={12} y={172} tone="pain" size={6}>
        the price is that the state has to be kept, and kept correct
      </C>
    </svg>
  )
}

/** Act IV — two devices, both writing, and deliberately no line between them.
 *  The missing line is the figure. */
function ActS2IV() {
  return (
    <svg
      viewBox="0 0 344 180"
      role="img"
      aria-label="Two devices editing the same document with no network between them, both accepting writes. Later the two versions meet and merge without anyone deciding which one won."
    >
      <C x={12} y={16}>
        same document, no signal
      </C>
      <B x={22} y={30} w={104} h={34} label="a laptop on a train" sub="writing anyway" />
      <B x={218} y={30} w={104} h={34} label="a phone in a café" sub="writing anyway" />
      <line x1={130} y1={47} x2={214} y2={47} stroke={TERRA} strokeWidth={1.2} strokeDasharray="4 4" />
      <line x1={165} y1={38} x2={179} y2={56} stroke={TERRA} strokeWidth={1.8} />
      <line x1={179} y1={38} x2={165} y2={56} stroke={TERRA} strokeWidth={1.8} />
      <C x={172} y={74} mid tone="pain" size={6}>
        no quorum to reach, no leader to ask
      </C>
      <C x={172} y={86} mid tone="pain" size={6}>
        and both writes are already committed
      </C>

      <A x1={74} y1={100} x2={150} y2={124} tone="new" />
      <A x1={270} y1={100} x2={194} y2={124} tone="new" />
      <B x={116} y={126} w={112} h={30} tone="new" label="they merge" sub="and nobody chose" />
      <C x={12} y={172} size={6}>
        pick types whose merge is forced, and convergence stops being a judgement call
      </C>
    </svg>
  )
}

/** Epilogue — the four jobs, drawn apart, with the box that was always around
 *  them drawn last. */
function ActS2Epi() {
  return (
    <svg
      viewBox="0 0 344 180"
      role="img"
      aria-label="A log, an index, a cache and a query engine drawn as four separate systems wired together by hand, with a dashed outline drawn around all four labelled: this is a database."
    >
      <C x={12} y={16}>
        four things you wired together yourself
      </C>
      <B x={26} y={40} w={64} h={26} label="a log" sub="what happened" />
      <B x={104} y={40} w={64} h={26} label="an index" sub="to look it up" />
      <B x={182} y={40} w={64} h={26} label="a cache" sub="to keep it hot" />
      <B x={260} y={40} w={64} h={26} label="a query" sub="to ask things" />
      {[0, 1, 2].map((i) => (
        <L key={i} x1={90 + i * 78} y1={53} x2={104 + i * 78} y2={53} />
      ))}

      <rect
        x={16}
        y={30}
        width={314}
        height={48}
        fill="none"
        stroke={DENIM}
        strokeWidth={1.8}
        strokeDasharray="5 4"
      />
      <C x={173} y={94} mid tone="new">
        that is a database
      </C>
      <L x1={12} y1={110} x2={332} y2={110} />
      <C x={12} y={128} size={6.2}>
        one ending says put a single storage layer under all of it again
      </C>
      <C x={12} y={144} size={6.2}>
        the other says it was never meant to be one box in the first place
      </C>
      <C x={12} y={166} tone="pain" size={6}>
        both are live arguments, and this book does not get to settle them
      </C>
    </svg>
  )
}

/** Act key (from `TOC`) → its figure. Kept as a lookup rather than a field on
 *  TOC itself because book.ts is plain data with no JSX. A test asserts the
 *  two stay in step. */
export const ACT_FIGURES: Record<string, () => ReactElement> = {
  prologue: ActPrologue,
  i: ActI,
  ii: ActII,
  iii: ActIII,
  iv: ActIV,
  v: ActV,
  vi: ActVI,
  epilogue: ActEpilogue,
  s2i: ActS2I,
  s2ii: ActS2II,
  s2iii: ActS2III,
  s2iv: ActS2IV,
  s2epi: ActS2Epi,
}
