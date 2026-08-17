import { describe, it, expect } from 'vitest'
import { PARTS, PANEL } from './IndexPage'
import indexPageSource from './IndexPage.tsx?raw'
import comicSource from './Comic.tsx?raw'
import { COMICS } from './comics'

/* The index is the only way most readers find a comic, and it is hand-listed:
   a new comic is live at its URL long before anything makes it appear here.
   That failed quietly once — comic #12 shipped with a card that said "in the
   sketchbook", the placeholder for a comic that does not exist yet, sitting
   next to a working link. Nothing was broken enough to notice. */

const IDEAS = PARTS.flatMap((p) => p.ideas)

describe('the index lists what the site actually has', () => {
  it('every comic has a card', () => {
    const listed = IDEAS.map((i) => i.slug).filter(Boolean).sort()
    expect(listed).toEqual(COMICS.map((c) => c.slug).sort())
  })

  it('every card links to a comic that exists', () => {
    const slugs = new Set(COMICS.map((c) => c.slug))
    expect(IDEAS.filter((i) => i.slug && !slugs.has(i.slug)).map((i) => i.title)).toEqual([])
  })

  it('every card names the comic it opens', () => {
    const byslug = new Map(COMICS.map((c) => [c.slug, c]))
    const wrong = IDEAS.filter((i) => i.slug && byslug.get(i.slug)!.title !== i.title).map(
      (i) => `${i.slug}: card says "${i.title}", comic says "${byslug.get(i.slug!)!.title}"`,
    )
    expect(wrong).toEqual([])
  })
})

describe('every live card is drawn', () => {
  it('has a panel, so none falls back to the coming-soon placeholder', () => {
    const bare = IDEAS.filter((i) => i.slug && !PANEL[i.slug]).map((i) => i.slug)
    expect(bare).toEqual([])
  })

  it('draws no panel for an idea that is not on the page', () => {
    const listed = new Set(IDEAS.map((i) => i.slug))
    expect(Object.keys(PANEL).filter((s) => !listed.has(s))).toEqual([])
  })
})

describe('the page says whose book it is before it says anything else', () => {
  /* This page is what a shared link opens — more than the site's own home —
     and for a long time the only thing above the twelve cards was "inspired by
     DDIA, 1st edition", while "unofficial" and "not affiliated" waited in the
     footer. That ordering is the whole problem: a reader who bounces has met
     the site and not the disclaimer.

     So the test is about POSITION, not presence. Presence was already true and
     was not enough. The masthead is everything up to </header>, which is what
     a visitor sees before scrolling on any screen this thing renders on. */
  /* Comments are stripped first, and finding that out was the test working:
     the "inspired by" check failed on the comment explaining why "inspired by"
     had been removed. A comment is not shipped, so a test reading raw source
     is asking a slightly different question from the one it means. */
  const rendered = indexPageSource.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  const masthead = rendered.slice(rendered.indexOf('gn-mast'), rendered.indexOf('</header>'))

  it('finds a masthead to check', () => {
    // without this the slice could be empty and every assertion below vacuous
    expect(masthead.length).toBeGreaterThan(200)
    expect(masthead).toContain('</h1>')
  })

  it('names the author, the book, and that this is neither', () => {
    for (const required of ['unofficial', 'Designing Data-Intensive', 'Martin Kleppmann', 'Not affiliated'])
      expect(masthead, `masthead does not say “${required}”`).toContain(required)
  })

  it('says which edition the chapter numbers follow', () => {
    /* The 2nd edition renumbers, so a chapter number with no edition beside it
       is a wrong chapter number for half the people reading. */
    expect(masthead).toMatch(/1st edition/)
  })

  it('says as much on a comic page, which is the one people link to', () => {
    /* /ddia/read/<slug> renders no SiteFooter, so before this the entire
       attribution on a comic was the kicker and one line at the very bottom,
       and the kicker said "Inspired by". The masthead there is a reading page
       and cannot carry three clauses without pushing the comic down, so it
       carries the word that answers the question — and the sentence sits at
       the foot, where a reader arrives having read the thing. */
    const comic = comicSource.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    const comicMast = comic.slice(comic.indexOf('gn-mast'), comic.indexOf('</header>'))
    expect(comicMast).toMatch(/Unofficial/i)
    for (const required of ['unofficial companion', 'Designing Data-Intensive', 'Martin Kleppmann', 'Not affiliated'])
      expect(comic, `a comic page never says “${required}”`).toContain(required)
  })

  it('does not hedge with “inspired by”', () => {
    /* The phrasing this replaced. It is not false, which is what made it
       survive so long — it just declines to answer the question a reader is
       actually asking, which is whether Kleppmann had anything to do with it. */
    expect(rendered).not.toMatch(/inspired by/i)
    expect(comicSource.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')).not.toMatch(/inspired by/i)
  })
})
