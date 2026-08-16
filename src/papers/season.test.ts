import { describe, expect, it } from 'vitest'
import { TOC } from './book'
import { CHAPTER_BY_SLUG } from './chapters'
import { ARC, CHAPTER_LINES, THREADS } from './season'

/* The season close is hand-written prose keyed by slug, which is the exact
   shape that rots: a chapter ships and the summary silently omits it, or a
   chapter is renamed and a line points at nothing. The page itself cannot
   complain — a missing line renders as an empty <em>, and a dead slug renders
   as a link the reader discovers is broken.

   So both directions are pinned here. Nothing in this file checks the writing;
   it checks that the writing covers the book and only the book. */

const livePages = TOC.flatMap((a) => a.entries)
  .map((e) => e.slug)
  .filter((s): s is string => !!s && !!CHAPTER_BY_SLUG[s])

describe('the season close covers the season', () => {
  it('found the live pages to check', () => {
    expect(livePages.length).toBeGreaterThan(15)
  })

  it('gives every live page a line', () => {
    const missing = livePages.filter((s) => !CHAPTER_LINES[s])
    expect(missing).toEqual([])
  })

  it('writes no line for a page that does not exist', () => {
    /* The other direction: a chapter renamed or dropped leaves its line behind,
       and the page would list a title nobody can reach. */
    const orphaned = Object.keys(CHAPTER_LINES).filter((s) => !livePages.includes(s))
    expect(orphaned).toEqual([])
  })

  it('makes every line a sentence rather than a label', () => {
    const tooShort = Object.entries(CHAPTER_LINES)
      .filter(([, line]) => line.length < 60)
      .map(([s]) => s)
    expect(tooShort).toEqual([])
  })
})

describe('the through-lines', () => {
  it('names at least two chapters each — one is not a thread', () => {
    const thin = THREADS.filter((t) => t.chapters.length < 2).map((t) => t.name)
    expect(thin).toEqual([])
  })

  it('points only at chapters that exist', () => {
    const bad = THREADS.flatMap((t) =>
      t.chapters.filter((s) => !CHAPTER_BY_SLUG[s]).map((s) => `${t.name} → ${s}`),
    )
    expect(bad).toEqual([])
  })

  it('lists each thread’s chapters in reading order', () => {
    /* A thread is an argument that develops across the book, so its links have
       to read forwards. Out of order they look like a tag cloud. */
    const wrong = THREADS.filter((t) => {
      const ix = t.chapters.map((s) => livePages.indexOf(s))
      return ix.some((n, i) => i > 0 && n <= ix[i - 1])
    }).map((t) => t.name)
    expect(wrong).toEqual([])
  })
})

describe('the arc', () => {
  it('covers every act that has a live chapter, in the book’s order', () => {
    const actsWithChapters = TOC.filter((a) =>
      a.entries.some((e) => e.slug && CHAPTER_BY_SLUG[e.slug]),
    ).map((a) => a.act)
    expect(ARC.map((r) => r.act)).toEqual(actsWithChapters)
  })

  it('gives every act all four cells', () => {
    const holes = ARC.filter((r) => !r.wall || !r.gave || !r.got || !r.cost).map((r) => r.act)
    expect(holes).toEqual([])
  })
})
