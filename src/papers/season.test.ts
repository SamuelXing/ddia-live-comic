import { describe, expect, it } from 'vitest'
import { SEASONS, TOC } from './book'
import { CHAPTER_BY_SLUG } from './chapters'
import { ARC_BY_SEASON, CHAPTER_LINES, THREADS_BY_SEASON } from './season'

/* Every season gets a close of its own, so everything below walks both
   ledgers instead of one. The scoping that used to be a comment — "ARC is
   season 1's" — is now the key of the map, which means adding a season 3
   ledger gets it checked without anybody remembering to widen a test. */
const THREADS = Object.values(THREADS_BY_SEASON).flat()

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
  it.each(Object.keys(ARC_BY_SEASON).map(Number))(
    'season %i covers every act that has a live chapter, in the book’s order',
    (n) => {
      /* Acts that read a paper — the close is an act with a live page in it and
         has no row in its own ledger, which is the correct amount of recursion.

         Per season, because a ledger belongs to the close page it renders on.
         Comparing the whole of ARC against the whole of TOC failed the moment
         any season-2 chapter shipped, which read as "the close is out of date"
         when the truth was that a later season was being written. */
      const season = SEASONS.find((s) => s.n === n)!
      const actsWithPapers = season.acts
        .filter((a) => a.entries.some((e) => e.slug && CHAPTER_BY_SLUG[e.slug]?.paper))
        .map((a) => a.act)
      expect(ARC_BY_SEASON[n].map((r) => r.act)).toEqual(actsWithPapers)
    },
  )

  it('gives every act all four cells', () => {
    const holes = Object.values(ARC_BY_SEASON)
      .flat()
      .filter((r) => !r.wall || !r.gave || !r.got || !r.cost)
      .map((r) => r.act)
    expect(holes).toEqual([])
  })

  /* Which seasons have a close page live. Derived rather than listed, so a
     season 3 close would be picked up the day it ships. */
  const seasonsWithAClose = SEASONS.filter((s) =>
    s.acts.some((a) => a.act.startsWith('The Close') && a.entries.some((e) => e.slug && CHAPTER_BY_SLUG[e.slug])),
  ).map((s) => s.n)

  it('found the close pages to check', () => {
    /* Without this the next assertion passes loudest when the search above is
       broken — an empty list has no missing ledgers. */
    expect(seasonsWithAClose).toEqual([1, 2])
  })

  it('gives every season with a close page both of its ledgers', () => {
    /* The quiet failure: ARC_BY_SEASON[n] is undefined for a season whose
       close page has shipped, and ArcTable throws at render time on a page
       that every data-only test says is fine. */
    const missing = seasonsWithAClose.filter((n) => !ARC_BY_SEASON[n] || !THREADS_BY_SEASON[n])
    expect(missing).toEqual([])
  })
})
