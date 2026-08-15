import { describe, expect, it } from 'vitest'
import { TOC, seasonProgress, progressLabel } from './book'
import { ACT_FIGURES } from './actDiagrams'
import { CHAPTER_BY_SLUG } from './chapters'

/* The act openers are split across two files — prose in book.ts (plain data,
   no JSX) and pictures in actDiagrams.tsx — joined by a string key. That join
   is exactly the kind of thing that rots silently: an act renders with a hole
   where its figure should be and nothing complains. These tests are the
   complaint. */

describe('the season table of contents', () => {
  it('gives every act a figure, a summary and a hinge into the next one', () => {
    for (const act of TOC) {
      expect(act.figure, `${act.act} has no figure key`).toBeTruthy()
      expect(act.summary.length, `${act.act} summary looks empty`).toBeGreaterThan(80)
      expect(act.next.length, `${act.act} has no hinge line`).toBeGreaterThan(20)
    }
  })

  it('resolves every figure key, and leaves no figure unused', () => {
    const used = TOC.map((a) => a.figure).sort()
    for (const key of used) expect(ACT_FIGURES[key], `no figure named "${key}"`).toBeTypeOf('function')
    expect(Object.keys(ACT_FIGURES).sort()).toEqual(used)
  })

  it('only links TOC rows to chapters that actually exist', () => {
    for (const act of TOC)
      for (const e of act.entries)
        if (e.slug) expect(CHAPTER_BY_SLUG[e.slug], `${e.no} points at a missing chapter`).toBeTruthy()
  })

  it('lists every chapter that exists — the other direction', () => {
    /* The half nobody thinks to check: a chapter can be written, registered and
       routed while its TOC row still has no slug, so the season map shows it as
       unwritten and nothing links to it. The page would look finished from the
       chapter and unfinished from the index. */
    const linked = new Set(TOC.flatMap((a) => a.entries).map((e) => e.slug).filter(Boolean))
    const orphaned = Object.keys(CHAPTER_BY_SLUG).filter((s) => !linked.has(s))
    expect(orphaned).toEqual([])
  })
})

describe('the season’s progress counter', () => {
  /* "1 of 18" was typed by hand in three places and all three were stale the
     moment Chapter 1 shipped. The count is derived now; these pin it. */
  it('counts the chapters that are live, not the rows that exist', () => {
    expect(seasonProgress().live).toBe(Object.keys(CHAPTER_BY_SLUG).length)
  })

  it('counts chapters, not interludes, in the total', () => {
    const rows = TOC.flatMap((a) => a.entries)
    expect(seasonProgress().total).toBe(rows.length - rows.filter((e) => e.interlude).length)
    expect(rows.some((e) => e.interlude)).toBe(true) // or the line above proves nothing
  })

  it('reads as a sentence, with both numbers in it', () => {
    const { live, total } = seasonProgress()
    expect(progressLabel()).toBe(`${live} of ${total} chapters live`)
    expect(live).toBeGreaterThan(0)
    expect(total).toBeGreaterThan(live)
  })
})
