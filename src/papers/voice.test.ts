import { describe, expect, it } from 'vitest'
import { CHAPTERS } from './chapters'
import type { Chapter } from './types'
import type { Step } from '../read/types'

/*
 * The book-scale half of the house voice rule.
 *
 * Every chapter has been read against the rule on its own, and that catches
 * sentence-level tells and structurally cannot catch the ones that only exist
 * across chapters: the same opening move on six pages, the same closing beat
 * on four in a row, one sentence appearing verbatim in two acts. Nobody
 * reading a diff notices; a reader going front to back notices immediately,
 * and repetition is most of what makes long-form read as generated.
 *
 * So this file compares chapters against each other rather than against a
 * standard. It found, when it was written: twenty-one chapters opening their
 * DesignIt block with a bare count and an ordinal list ("Three decisions. The
 * first is… the third is…"), four consecutive finales opening on "Two/Three
 * <plural>, one <singular>", two chapters carrying the identical sentence "The
 * first is the one everything else hangs off", and four saying "unusual for
 * this book" about four different things.
 *
 * These thresholds are deliberately loose. The aim is not to forbid a shape —
 * a book with a method will repeat, and should — it is to fail when a shape
 * has stopped being a choice.
 */

const strip = (s: string) => s.replace(/\*\*|\*|`|<[^>]+>|_/g, ' ').replace(/\s+/g, ' ').trim()

/** The words a construction is recognised by: numbers flattened, so "Three
 *  decisions" and "Two decisions" are the same move, which is the point. */
const opener = (s: string, n = 5) =>
  strip(s)
    .toLowerCase()
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fifteen|seventeen)\b/g, '#')
    .replace(/\b\d+\b/g, '#')
    .replace(/[^a-z#’' ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, n)
    .join(' ')

const designIt = (c: Chapter): Step | undefined => c.steps.find((s) => s.title === 'You are the designer')

/** Prose a reader reads, excluding the bibliography — a citation repeated
 *  across chapters is correct, and would drown everything else. */
function prose(c: Chapter): string {
  const out: string[] = [c.dek, c.caption, c.finale.body]
  for (const s of c.steps) {
    /* step TITLES are excluded: the eight-beat template is meant to be
       legible, so "The bill" on twenty-four pages is a landmark, not a tell */
    out.push(...(s.body ?? []), ...(s.deeper?.body ?? []))
    if (s.callout) out.push(s.callout.text)
    if (s.think) out.push(s.think.q, s.think.a)
  }
  for (const b of c.bubbles ?? []) out.push(b.body)
  for (const p of c.inTheWild?.points ?? []) out.push(typeof p === 'string' ? p : p.t)
  for (const r of c.tradeoffs?.rows ?? []) out.push(r.choose, r.when)
  if (c.misconception) out.push(c.misconception.think, c.misconception.actually)
  return strip(out.join(' '))
}

describe('the book does not repeat itself across chapters', () => {
  it('opens the designer block a different way each time', () => {
    /* The formula that ran for twenty chapters: a count, a full stop, and then
       the first is / the second is / the third is. It reads as structure being
       performed rather than as anything about this chapter's decisions — and a
       semicolon-balanced triple is the exact shape the house rule names. */
    const seen = new Map<string, string[]>()
    for (const c of CHAPTERS) {
      const b = designIt(c)?.body?.[0]
      if (!b) continue
      const k = opener(b)
      if (!seen.has(k)) seen.set(k, [])
      seen.get(k)!.push(c.slug)
    }
    const repeated = [...seen.entries()]
      .filter(([, v]) => v.length > 1)
      .map(([k, v]) => `“${k}…” — ${v.join(', ')}`)
    expect(repeated).toEqual([])
  })

  it('does not enumerate the decisions in the lead-in at all', () => {
    /* Stronger than the check above and the reason it exists: varying the
       first five words while keeping "the first is X, the second is Y, the
       third is Z" changes nothing a reader would notice. The DesignIt panel
       numbers the questions itself, so the sentence introducing them is free
       to say something only this chapter could say. */
    const enumerating = CHAPTERS.filter((c) => {
      const b = designIt(c)?.body?.[0]
      if (!b) return false
      const t = strip(b).toLowerCase()
      return /\bthe (first|second|third) is\b/.test(t) && /\bthe (second|third) is\b/.test(t)
    }).map((c) => c.slug)
    expect(enumerating).toEqual([])
  })

  it('introduces the decisions by subject, not by position', () => {
    /* The trap on the way out of the last check, walked into on the first
       attempt: I replaced "Three decisions. The first is…" with "The opening
       question is…" in eleven chapters, which is the same sentence with a
       different label on it. The house rule has a name for that — concrete
       words inside the same architecture — and it is the failure mode the
       book's own dek took four passes to escape.

       A lead-in that says where a question sits in a list tells the reader
       nothing; the panel below already numbers them. One that names what the
       chapter is about does. Two chapters keep a positional phrase because
       they use it to say something ("only two, which is honest for an
       eight-page paper"), and that is the headroom.

       The rule is about where the positional phrase sits, not whether it
       appears: "Most engineers get the first one wrong, usually in
       production" is a claim about a decision and mentions its position on
       the way past. "The opening question has four wrong-looking answers" is
       the position doing all the work. A threshold would have papered over
       the difference; leading with it is the thing to forbid. */
    const positional = CHAPTERS.filter((c) => {
      const b = designIt(c)?.body?.[0]
      if (!b) return false
      const firstSentence = strip(b).split(/(?<=[.?!:—])\s/)[0]
      return /^(the )?(opening|first|second|third|last) (question|move|decision|one|answer)\b/i.test(firstSentence)
    }).map((c) => c.slug)
    expect(positional).toEqual([])
  })

  it('opens each finale a different way', () => {
    const seen = new Map<string, string[]>()
    for (const c of CHAPTERS) {
      const k = opener(c.finale.body, 4)
      if (!seen.has(k)) seen.set(k, [])
      seen.get(k)!.push(c.slug)
    }
    const repeated = [...seen.entries()]
      .filter(([, v]) => v.length > 1)
      .map(([k, v]) => `“${k}…” — ${v.join(', ')}`)
    expect(repeated).toEqual([])
  })

  it('opens each caption a different way', () => {
    const seen = new Map<string, string[]>()
    for (const c of CHAPTERS) {
      const k = opener(c.caption, 5)
      if (!seen.has(k)) seen.set(k, [])
      seen.get(k)!.push(c.slug)
    }
    const repeated = [...seen.entries()]
      .filter(([, v]) => v.length > 1)
      .map(([k, v]) => `“${k}…” — ${v.join(', ')}`)
    expect(repeated).toEqual([])
  })

  it('never says the same nine words twice in two chapters', () => {
    /* Verbatim reuse, which is the tell nobody catches by reading one file:
       "The first is the one everything else hangs off" appeared in Chapter 19
       and Chapter 29, written eleven chapters apart, identical. Nine words is
       long enough that a shared technical phrase does not trip it and short
       enough to catch a recycled sentence. */
    const N = 9
    const where = new Map<string, Set<string>>()
    for (const c of CHAPTERS) {
      const w = prose(c).toLowerCase().replace(/[^a-z0-9’' ]/g, ' ').split(/\s+/).filter(Boolean)
      for (let i = 0; i + N <= w.length; i++) {
        const g = w.slice(i, i + N).join(' ')
        if (!where.has(g)) where.set(g, new Set())
        where.get(g)!.add(c.slug)
      }
    }
    const dupes = [...where.entries()].filter(([, v]) => v.size > 1)
    /* collapse overlapping windows of one repeated sentence into one report */
    const reported: string[] = []
    for (const [g, v] of dupes.sort((a, b) => b[0].length - a[0].length))
      if (!reported.some((r) => r.includes(g.slice(0, 40)))) reported.push(`“${g}” — ${[...v].sort().join(', ')}`)
    expect(reported).toEqual([])
  })

  it('does not tally its way into most of the finales', () => {
    /* Eleven of thirty-five finales opened on a bare count — "Two chapters,
       one demand", "Three chapters, and the hole is properly filled", "Two
       documents, one system" — and four of the act closers used it in a row,
       which is where it stops being a summary and starts being a tic. A few
       are load-bearing: "Three clocks" is what that chapter is about. The
       limit is set where it reads as a choice. */
    const TALLY =
      /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|seventeen|\d+) (chapters?|papers?|acts?|documents?|answers?|things?|clocks?|questions?|decisions?|systems?|seasons?)\b/i
    const counting = CHAPTERS.filter((c) => TALLY.test(strip(c.finale.body))).map((c) => c.slug)
    expect(counting.length).toBeLessThanOrEqual(4)
  })

  it('never tells the reader which way to look for a figure', () => {
    /* "The measured result is the figure below" was true for as long as the
       drawing sat under the prose, and became a lie the afternoon the figure
       moved up to follow the opening paragraph. One sentence in thirty-six
       chapters, and nothing could have caught it: it typechecks, it lints, it
       reads fine in a diff.

       The prose does not get to know where the CSS put the picture. There is
       exactly one figure in a panel, so "the figure" always names it — and a
       chapter that needs more precision than that should say what the figure
       shows rather than where it is. */
    const directional = CHAPTERS.flatMap((c) => {
      const m = prose(c).match(
        /* "below" on its own is not the tell — the book says "what sits below"
           about a dataflow graph and "almost nothing below" about the rest of
           a chapter, and both are about the material, not the layout. The
           thing to forbid is a direction attached to a figure. */
        /\b(figure|diagram|drawing|picture|trace)\s+(below|above)\b|\b(below|above)[,:]?\s+(is|are)\s+(the\s+)?(figure|diagram|drawing|picture|trace)\b/gi,
      )
      return m ? m.map((hit) => `${c.slug}: “${hit}”`) : []
    })
    expect(directional).toEqual([])
  })

  it('reserves “unusual for this book” for something that is', () => {
    /* Said about four different papers in the same season, which is the
       self-describing framing the house rule bans: it tells the reader the
       chapter is remarkable instead of being remarkable. */
    const claims = CHAPTERS.filter((c) => /unusual(ly)? for (this|the) book/i.test(prose(c))).map((c) => c.slug)
    expect(claims.length).toBeLessThanOrEqual(1)
  })
})
