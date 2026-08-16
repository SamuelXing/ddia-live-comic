import { describe, expect, it } from 'vitest'
import { SEASONS, progressLabel } from '../papers/book'
// Vite's ?raw, not node:fs — same reason routes.test.ts gives: the app
// tsconfig has no node types, and adding them for one test widens the
// app project's ambient types.
import source from './Bookshelf.tsx?raw'

/* The shelf card is the front door's summary of a whole book, and its meta
   line used to name one season by hand beside a count of every chapter in the
   book. That was true for exactly as long as the book had one season.

   This is the shape of staleness that no type checks and no page complains
   about: a literal that agrees with the data on the day it is written. So the
   guard is blunt — no season's name may appear as a literal on the shelf. */

/** the part of the card that is data, not the comments explaining the rule */
const code = source.replace(/\/\*[\s\S]*?\*\//g, '')

describe('the shelf card summarises the whole book', () => {
  it('found the source to read', () => {
    expect(code).toContain('progressLabel()')
    expect(SEASONS.length).toBeGreaterThan(1)
  })

  it('names no individual season', () => {
    /* Both the full label and its subtitle half — "Season 1 · Where Data
       Lives" was written as two pieces, and either one alone is the same bug. */
    const names = SEASONS.flatMap((s) => [s.label, ...s.label.split(' · ')])
    const hardcoded = names.filter((n) => code.includes(n))
    expect(hardcoded).toEqual([])
  })

  it('reports a count that covers every season', () => {
    const live = SEASONS.flatMap((s) => s.acts)
      .flatMap((a) => a.entries)
      .filter((e) => !e.interlude && e.slug).length
    expect(progressLabel()).toBe(`${live} chapters live`)
    // and the live chapters really do span more than one season
    const perSeason = SEASONS.map(
      (s) => s.acts.flatMap((a) => a.entries).filter((e) => !e.interlude && e.slug).length,
    )
    expect(perSeason.filter((n) => n > 0).length).toBeGreaterThan(1)
  })
})
