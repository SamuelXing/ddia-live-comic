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
  /** force a full-width panel */
  span?: 1 | 2
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
  /** a misconception callout, rendered after the steps */
  misconception?: Misconception
  /** primary sources rail */
  sources?: Source[]
  seenIn: SeenIn[]
  finale: { title: string; body: string }
  next?: { slug: string; title: string }
}
