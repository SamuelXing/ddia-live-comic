import { describe, expect, it } from 'vitest'
import { BOOK, TOC, progress, progressLabel, MODE_LABEL } from './book'

/* Book C is a map with nothing behind it yet, which is a state the other two
   books were only ever in briefly. These tests are mostly about that: the map
   has to stay coherent while it is the whole product, and the counter has to
   stay derived, because six hand-typed tallies in this repo have gone stale
   and every one of them was typed at a moment exactly like this. */

describe('the Kubernetes book map', () => {
  it('numbers its chapters straight through, with no gaps or repeats', () => {
    const nos = TOC.flatMap((a) => a.entries).map((e) => Number(/^Ch (\d+)$/.exec(e.no)![1]))
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

  it('derives the progress label rather than stating it', () => {
    const { live, total } = progress()
    expect(total).toBe(TOC.flatMap((a) => a.entries).length)
    expect(live).toBe(TOC.flatMap((a) => a.entries).filter((e) => e.slug).length)
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
