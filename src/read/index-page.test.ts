import { describe, it, expect } from 'vitest'
import { PARTS, PANEL } from './IndexPage'
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
