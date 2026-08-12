import { describe, expect, it } from 'vitest'
import { TOC } from './book'
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
})
