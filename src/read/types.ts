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

export interface Step {
  /** badge text, e.g. "Step 01" or "Detail" */
  n: string
  title: string
  accent?: Accent
  /** paragraphs — each rendered through rich() for **bold** and `mono` */
  body?: string[]
  code?: CodeBlock
  callout?: Callout
  /** an optional inline diagram (SVG); when present the panel spans full width */
  diagram?: ReactNode
  /** force a full-width panel */
  span?: 1 | 2
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
  seenIn: SeenIn[]
  finale: { title: string; body: string }
  next?: { slug: string; title: string }
}
