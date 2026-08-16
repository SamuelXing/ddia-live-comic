import type { Step, Bubble, InTheWild, Tradeoffs, Misconception, Source, SeenIn } from '../read/types'

/** The paper a chapter reads — rendered as a citation card under the masthead,
 *  because the whole premise of the book is that the paper is checkable. */
export interface PaperRef {
  title: string
  authors: string
  venue: string
  year: string
  url: string
}

/**
 * One chapter of the papers book. Deliberately the same vocabulary as a Comic
 * (steps, bubbles, in-the-wild, tradeoffs, sources) — the skin and the panel
 * anatomy are shared — plus the fields a paper-reading chapter needs: the
 * citation, the act it belongs to, and a next-teaser that may be unwritten.
 *
 * The eight beats of the chapter template map onto this shape:
 *   cold open → caption · you-are-the-designer → a step with a DesignIt diagram
 *   the reveal → a step with a TracePlayer figure · the price → a terra step
 *   receipts → sources with notes · descendants + 2026 status → closing steps
 *   distillation → finale
 */
export interface Chapter {
  slug: string
  /** e.g. "Act I · The Web Breaks the Box" */
  act: string
  /** short badge, e.g. "Paper 3" */
  paperNo: string
  title: string
  dek: string
  minutes: number
  /**
   * The paper this chapter reads, rendered as a citation card under the
   * masthead. **Absent on an interlude** — a half-chapter with no answer key,
   * which exists to name a pattern the chapters around it keep using rather
   * than to re-derive one paper. One fact, not two: nothing carries a separate
   * `interlude` flag that could disagree with this, and `book.test.ts` checks
   * it against the TOC's own marker.
   */
  paper?: PaperRef
  /** the opening narration box — the cold open */
  caption: string
  steps: Step[]
  bubbles?: Bubble[]
  inTheWild?: InTheWild
  tradeoffs?: Tradeoffs
  misconception?: Misconception
  /** primary sources, each note doubling as the re-reading guide:
   *  which sections of the original are worth the reader's evening */
  sources?: Source[]
  seenIn: SeenIn[]
  finale: { title: string; body: string }
  /** the next chapter — usually unwritten while the season is being drawn */
  next?: { title: string; slug?: string; unwritten?: boolean }
}
