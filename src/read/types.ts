import type { ReactNode } from 'react'

/** One panel accent. Meaning is fixed across the whole product:
 *  terra = the gap / the pain / start-here · denim = the built / the fix / live. */
export type Accent = 'ink' | 'terra' | 'denim'

export interface CodeLine {
  t: string
  /** highlight the line as the good (denim) or bad (terra) path */
  hl?: 'good' | 'bad'
}
export interface CodeBlock {
  file: string
  lines: CodeLine[]
}

export interface Callout {
  kind: 'good' | 'bad'
  big: string
  text: string
}

/** A collapsible "▸ Go deeper" aside — the mechanism/proof for readers who want it.
 *  Skimmers never see it; it stays folded by default. */
export interface Deeper {
  /** badge label, defaults to "Go deeper" */
  tag?: string
  /** the teaser shown on the closed summary line */
  summary: string
  body?: string[]
  code?: CodeBlock
  /** a figure for the mechanism being explained. Same rule as a wild point's:
   *  only where the drawing does work the sentence cannot. */
  figure?: ReactNode
}

/** A Socratic prompt: pose a genuine question, hide the answer so the reader
 *  actually reasons before revealing it. Makes them think, not memorize. */
export interface Think {
  q: string
  a: string
}

export interface Step {
  /** badge text, e.g. "Step 01" or "Detail" */
  n: string
  title: string
  accent?: Accent
  /** a quiet "you are here" ladder tag, e.g. "Rung 1 · Intuition" */
  rung?: string
  /** paragraphs — each rendered through rich() for **bold**, *italic*, `mono`,
   *  and [[term|definition]] glossary popovers */
  body?: string[]
  code?: CodeBlock
  callout?: Callout
  /** an optional inline diagram (SVG); when present the panel spans full width */
  diagram?: ReactNode
  /** a collapsible depth aside for this step */
  deeper?: Deeper
  /** a "think it through" prompt attached to this step */
  think?: Think
  /** force a full-width panel */
  span?: 1 | 2
}

/** "In the wild" — where the clean idea gets complicated in production: the
 *  variance, the failure modes, the caveats textbooks skip. The point is to make
 *  the reader confront that the model is the easy 20%. */
/** One in-the-wild bullet. A bare string stays legal — most bullets are prose
 *  and should stay prose — but a bullet describing something that happens *in
 *  sequence* or *across nodes* can carry its own figure, which text alone
 *  makes the reader assemble in their head. */
export interface WildPoint {
  t: string
  /** draw this only when the drawing does work the sentence cannot. A figure
   *  per bullet would turn the section into a gallery and bury the two or
   *  three that actually matter. */
  figure?: ReactNode
}

export interface InTheWild {
  /** defaults to "where the clean idea gets complicated" */
  note?: string
  points: (string | WildPoint)[]
}

/** A real decision framework — the axes engineers actually weigh, and when to
 *  reach for which option. Turns "I know the idea" into "I can make the call." */
export interface Tradeoffs {
  /** defaults to "The call" */
  title?: string
  rows: { choose: string; when: string }[]
}

/** "You might think… — Actually…" — names the wrong model to make the right one stick. */
export interface Misconception {
  think: string
  actually: string
}

/** A primary source, cited at the point of use — the "dive infinitely deep" hatch. */
export interface Source {
  year?: string
  title: string
  url?: string
  note?: string
}

export interface Bubble {
  term: string
  body: string
}

/** where this idea shows up for real — the down-links into Layers 2 & 3 */
export interface SeenIn {
  label: string
  to?: string
  live?: boolean
  note?: string
}

export interface Comic {
  slug: string
  /** e.g. "Chapter 6 · Partitioning" */
  chapter: string
  /** short badge, e.g. "Ch 6" */
  chapterNo: string
  title: string
  dek: string
  minutes: number
  /** the opening narration box */
  caption: string
  steps: Step[]
  bubbles?: Bubble[]
  /** production complications — the messy 80% the clean model skips */
  inTheWild?: InTheWild
  /** a decision framework — when to reach for which option */
  tradeoffs?: Tradeoffs
  /** a misconception callout, rendered after the steps */
  misconception?: Misconception
  /** primary sources rail */
  sources?: Source[]
  seenIn: SeenIn[]
  finale: { title: string; body: string }
  next?: { slug: string; title: string }
}
