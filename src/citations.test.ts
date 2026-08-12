import { describe, it, expect } from 'vitest'
import { STORES } from './deepdives/calcModel'
import { COMICS } from './read/comics'

/* "Every hard number gets a primary source" is the standard this project set
   itself, and nothing enforced it. The check that matters is the cheap one: a
   claim about what someone runs in production, with no link beside it, is
   indistinguishable from something half-remembered — which is exactly what the
   site says it is not.

   These tests do not verify that a URL is reachable (a network call in a unit
   suite is a flake generator, and X's blog 403s any non-browser client anyway).
   They verify the things that go wrong silently: a claim with no citation, a
   malformed or duplicated link, a source with nothing to say. */

const httpsUrl = /^https:\/\/[^\s"']+$/

describe('the calculator cites what it claims', () => {
  it('every store that says what someone runs, links to who said it', () => {
    const uncited = STORES.filter((s) => s.wild && !(s.sources?.length ?? 0)).map((s) => s.short)
    expect(uncited).toEqual([])
  })

  it('every link is a well-formed https URL with a label', () => {
    const bad: string[] = []
    STORES.forEach((s) =>
      (s.sources ?? []).forEach((src) => {
        if (!httpsUrl.test(src.href)) bad.push(`${s.short}: ${src.href}`)
        if (!src.label?.trim()) bad.push(`${s.short}: source with no label`)
      }),
    )
    expect(bad).toEqual([])
  })

  it('does not cite the same page twice on one store', () => {
    const dupes: string[] = []
    STORES.forEach((s) => {
      const hrefs = (s.sources ?? []).map((x) => x.href)
      if (new Set(hrefs).size !== hrefs.length) dupes.push(s.short)
    })
    expect(dupes).toEqual([])
  })

  it('keeps the wide-column card honest about Twitter', () => {
    /* Pinned because it is the claim most likely to be "corrected" back to the
       thing everybody assumes. Twitter does not run Cassandra for tweets — it
       tried in 2010, cancelled, and later built Manhattan, whose key shape is
       this store's. If that sentence ever gets simplified, this fails. */
    const wide = STORES.find((s) => s.id === 'wide')!
    expect(wide.wild).toContain('Manhattan')
    expect(wide.wild).toMatch(/sorted local key/)
    // and the timeline is not the tweet store, which is the whole point
    expect(wide.wild).toMatch(/timeline/i)
    const hrefs = (wide.sources ?? []).map((s) => s.href).join(' ')
    expect(hrefs).toMatch(/manhattan/i)
    expect(hrefs).toMatch(/infoq|timelines/i)
  })
})

describe('the comics cite what they claim', () => {
  it('every source has a title, and any URL it carries is well-formed https', () => {
    const bad: string[] = []
    COMICS.forEach((c) =>
      (c.sources ?? []).forEach((s) => {
        if (!s.title?.trim()) bad.push(`${c.slug}: source with no title`)
        if (s.url && !httpsUrl.test(s.url)) bad.push(`${c.slug}: ${s.url}`)
      }),
    )
    expect(bad).toEqual([])
  })

  it('does not cite the same page twice in one comic', () => {
    const dupes: string[] = []
    COMICS.forEach((c) => {
      const urls = (c.sources ?? []).map((s) => s.url).filter(Boolean)
      if (new Set(urls).size !== urls.length) dupes.push(c.slug)
    })
    expect(dupes).toEqual([])
  })

  it('says why each source is worth an evening, not just that it exists', () => {
    // a bare link is a reading list; the note is what makes it a citation
    const noteless = COMICS.flatMap((c) =>
      (c.sources ?? []).filter((s) => s.url && !s.note?.trim()).map((s) => `${c.slug}: ${s.title}`),
    )
    expect(noteless).toEqual([])
  })

  it('backs the partition-key comic’s “three names, one idea” with three names', () => {
    const pk = COMICS.find((c) => c.slug === 'partition-key')!
    const body = pk.steps.flatMap((s) => s.body).join(' ')
    ;['clustering column', 'sort key', 'local key'].forEach((name) =>
      expect(body.toLowerCase()).toContain(name),
    )
    // the third one is the claim that needs a source; the other two are vendor docs
    expect((pk.sources ?? []).some((s) => /manhattan/i.test(s.url ?? ''))).toBe(true)
  })
})
