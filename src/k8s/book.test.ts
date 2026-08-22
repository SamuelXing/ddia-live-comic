import { describe, expect, it } from 'vitest'
import { BOOK, TOC, progress, progressLabel, MODE_LABEL } from './book'

/* Book C is a map with nothing behind it yet, which is a state the other two
   books were only ever in briefly. These tests are mostly about that: the map
   has to stay coherent while it is the whole product, and the counter has to
   stay derived, because six hand-typed tallies in this repo have gone stale
   and every one of them was typed at a moment exactly like this. */

describe('the Kubernetes book map', () => {
  it('numbers its chapters straight through, with no gaps or repeats', () => {
    const nos = TOC.flatMap((a) => a.entries)
      .filter((e) => !e.interlude)
      .map((e) => Number(/^Ch (\d+)$/.exec(e.no)![1]))
    expect(nos).toEqual(nos.map((_, i) => i + 1))
  })

  it('says what every chapter reads, because half the book has no paper', () => {
    /* The whole reason this field exists. Act I has an answer key and Acts II
       and III do not, and a reader who assumes every chapter is paper-backed
       will go looking for a citation that was never written. */
    const bare = TOC.flatMap((a) => a.entries).filter((e) => !e.reads || e.reads.length < 4)
    expect(bare).toEqual([])
  })

  it('gives every act a mode with a label to print', () => {
    for (const a of TOC) {
      expect(MODE_LABEL[a.mode], `${a.act} has an unprintable mode`).toBeTruthy()
      expect(a.summary.length, `${a.act} has no summary`).toBeGreaterThan(80)
    }
  })

  it('only claims a paper for the act that has one', () => {
    /* Act I reads three real papers. If a later act is ever switched to
       "papers" mode, that is a claim about sources and it should be a
       deliberate edit rather than a copied line — this fails until somebody
       comes here and changes the expectation on purpose. */
    expect(TOC.filter((a) => a.mode === 'papers').map((a) => a.act)).toEqual(['Act I · The Answer Keys'])
  })

  it('never numbers an interlude', () => {
    /* If an interlude ever gets a "Ch N", the numbering test above starts
       passing for the wrong reason and "Chapter 7" means two things depending
       on whether the reader counts half-chapters. Book B hit this exact
       ambiguity and solved it the same way. */
    const numbered = TOC.flatMap((a) => a.entries).filter((e) => e.interlude && /^Ch \d+$/.test(e.no))
    expect(numbered).toEqual([])
  })

  it('derives the progress label rather than stating it', () => {
    /* Both halves skip interludes, and this test asserting otherwise is how
       the rule got noticed: an interlude is a page, not a chapter, so counting
       it makes the label drift away from a contents page that numbers
       fourteen. Book B has the identical carve-out and the identical comment,
       because somebody later reads this as an off-by-one and helpfully
       "fixes" it. */
    const chapters = TOC.flatMap((a) => a.entries).filter((e) => !e.interlude)
    const { live, total } = progress()
    expect(total).toBe(chapters.length)
    expect(live).toBe(chapters.filter((e) => e.slug).length)
    // the label must contain a number that came from the count, not from a person
    expect(progressLabel()).toContain(String(live === 0 ? total : live))
  })

  it('never gives a chapter the title of the book itself', () => {
    /* Ch 2 was called "Nobody Is In Charge", which is the book. It reads as a
       placeholder even when it is not — and the contents page prints both
       within one screen of each other, so the repeat is the first thing a
       reader sees. The chapter delivers the thesis; it does not need to be
       named after it. */
    const clash = TOC.flatMap((a) => a.entries).filter(
      (e) => e.title.toLowerCase() === BOOK.title.toLowerCase(),
    )
    expect(clash).toEqual([])
  })

  it('has a title and a dek that say what the book is', () => {
    expect(BOOK.title.length).toBeGreaterThan(4)
    expect(BOOK.dek.length).toBeGreaterThan(60)
  })
})

describe('the mode label is a claim about sources, so it has to be true', () => {
  it('gives every mode in use a label', () => {
    /* The interlude shipped as mode "api" for one commit and rendered "READS
       THE API" over a row that reads Terraform — caught by looking at the page
       rather than by any test, because a wrong-but-valid enum value typechecks
       perfectly. This at least stops a mode with no label at all. */
    for (const a of TOC) expect(MODE_LABEL[a.mode], `${a.act}: mode "${a.mode}" has no label`).toBeTruthy()
  })

  it('does not claim an act reads Kubernetes when it reads something else', () => {
    const outside = TOC.flatMap((a) => a.entries.map((e) => ({ act: a.act, mode: a.mode, reads: e.reads })))
      .filter((r) => /terraform|pulumi|ansible|cloudformation/i.test(r.reads))
    expect(outside.length).toBeGreaterThan(0)
    for (const r of outside) expect(r.mode, `${r.act} reads ${r.reads}`).toBe('tool')
  })
})
