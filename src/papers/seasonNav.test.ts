import { describe, expect, it } from 'vitest'
import { SEASONS, chaptersBackPath, seasonOfSlug, seasonPath } from './book'
// Vite's ?raw, not node:fs — the app tsconfig has no node types.
import indexSource from './IndexPage.tsx?raw'
import navSource from '../components/SiteNav.tsx?raw'

/* Two bugs, one cause: the seasons were split onto separate contents pages and
   two things carried on assuming there was only one of them.

   Both were invisible to the type checker and to every existing test, because
   neither is a wrong value — one is a hardcoded URL that happened to be right
   while the book had a single season, and the other is a dependency array that
   is correct for a component only ever mounted once. */

describe('"← All chapters" goes back to the season you are actually in', () => {
  it('sends a chapter to its own season', () => {
    /* Every live chapter, not a sample — the point of the bug was that one
       season's chapters all pointed at the other season's contents. */
    const live = SEASONS.flatMap((s) =>
      s.acts.flatMap((a) => a.entries.filter((e) => e.slug).map((e) => [e.slug as string, s.n] as const)),
    )
    expect(live.length).toBeGreaterThan(0)
    const wrong = live.filter(([slug, n]) => chaptersBackPath(`/papers/${slug}`) !== seasonPath(n))
    expect(wrong).toEqual([])
  })

  it('really does have chapters in more than one season', () => {
    /* The premise. If this ever stops being true the test above passes for a
       trivial reason, and this line is the note saying so. */
    const perSeason = SEASONS.map((s) => s.acts.flatMap((a) => a.entries).filter((e) => e.slug).length)
    expect(perSeason.filter((n) => n > 0).length).toBeGreaterThan(1)
  })

  it('offers no way "up" from a season\'s own contents page', () => {
    /* The brand is already the way up there, and a link across to the other
       season would be a sideways jump wearing an upward label. */
    SEASONS.forEach((s) => expect(chaptersBackPath(seasonPath(s.n))).toBeNull())
    expect(chaptersBackPath('/papers/season/1')).toBeNull()
  })

  it('is a computed destination in the nav, not a literal', () => {
    /* The brand beside it legitimately points at the book's front door, so the
       check is scoped to the link that carries this label — that is the one
       that was wrong, and a literal there is the whole bug. */
    const code = navSource.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).toContain('chaptersBackPath(')
    const link = code.slice(code.indexOf('← All chapters') - 200, code.indexOf('← All chapters'))
    expect(link).toContain('to={')
    expect(link).not.toContain('to="')
  })

  it('treats the season close as the chapter it is', () => {
    /* `/papers/season-1` is Season 1's closing page and starts with the same
       letters as `/papers/season/2`. Matching the index on a bare prefix ate
       it, and that page lost its way back entirely. */
    expect(chaptersBackPath('/papers/season-1')).toBe('/papers')
  })

  it('resolves a slug to its season', () => {
    expect(seasonOfSlug('gfs')?.n).toBe(1)
    expect(seasonOfSlug('spark')?.n).toBe(2)
    expect(seasonOfSlug('not-a-chapter')).toBeUndefined()
  })
})

describe('the season contents page reveals its panels on every visit', () => {
  /* Both seasons are one component with a different prop, so React reuses the
     instance across /papers → /papers/season/2: nothing unmounts, nothing
     remounts, and a mount-only effect runs once ever. Season 2's act panels
     were new DOM that the IntersectionObserver had never seen, so they stayed
     at opacity 0 and the page rendered a masthead above a blank space until
     you reloaded it. The two chapter views key theirs on the slug already. */
  const code = indexSource.replace(/\/\*[\s\S]*?\*\//g, '')

  it('found the observer to check', () => {
    expect(code).toContain('IntersectionObserver')
    expect(code).toContain('[data-obs]')
  })

  it('keys the observer on the season rather than on mount', () => {
    /* Located from the observer's own query rather than by position in the
       file. Taking "the last dep array" happened to work and pointed at
       whichever effect was written last — a sabotage aimed at the observer
       landed on the document-title effect above it and this test still passed,
       which is the failure mode a guard is supposed to not have. */
    const after = code.slice(code.indexOf('[data-obs]'))
    const deps = after.match(/\n\s*\}, \[([^\]]*)\]\)/)
    expect(deps).not.toBeNull()
    expect(deps![1]).toContain('season')
  })
})
