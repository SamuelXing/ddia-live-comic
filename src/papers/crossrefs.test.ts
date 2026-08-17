import { describe, expect, it } from 'vitest'
import { TOC } from './book'
import { CHAPTERS } from './chapters'
import type { Chapter } from './types'

/*
 * The prose half of the cross-reference problem.
 *
 * book.test.ts already checks the chapter numbers written into `seenIn`
 * labels, because a label sits next to a link and the link says which chapter
 * is meant. Its comment says the sentences are not checkable, and that was
 * true as far as it went: "Chapter 13's log" has nothing beside it to compare
 * against. An adversarial pass over all 181 prose references found three
 * wrong, and two of them were wrong in a way a machine can see. This is that
 * machine.
 *
 * The third — six sentences in Chapter 23 claiming Chapter 7 covered
 * Chandy-Lamport, which it never mentions — is not caught here and cannot be
 * without a model of what each chapter contains. That one is why the review
 * happened rather than something the review left behind.
 */

const strip = (s: string) => s.replace(/\*\*|\*|`|<[^>]+>|_/g, ' ').replace(/\s+/g, ' ')

function prose(c: Chapter): string[] {
  const out = [c.dek, c.caption, c.finale.body]
  for (const s of c.steps) {
    out.push(...(s.body ?? []), ...(s.deeper?.body ?? []))
    if (s.callout) out.push(s.callout.text)
    if (s.think) out.push(s.think.q, s.think.a)
  }
  for (const b of c.bubbles ?? []) out.push(b.body)
  for (const p of c.inTheWild?.points ?? []) out.push(typeof p === 'string' ? p : p.t)
  if (c.misconception) out.push(c.misconception.think, c.misconception.actually)
  return out.map(strip)
}

/** slug → the number the contents gives it, for the chapters that have one */
const numberOf: Record<string, number> = {}
for (const act of TOC)
  for (const e of act.entries) {
    const m = /^Ch (\d+)$/.exec(e.no)
    if (e.slug && m) numberOf[e.slug] = Number(m[1])
  }

const REF = /\b(?:Chapter|Ch\.?) ?(\d+)/g

describe('the chapter numbers written into sentences', () => {
  it('has both a numbered contents and prose that cites it', () => {
    expect(Object.keys(numberOf).length).toBeGreaterThan(25)
    const refs = CHAPTERS.flatMap((c) => prose(c).flatMap((p) => [...p.matchAll(REF)]))
    expect(refs.length).toBeGreaterThan(100)
  })

  it('never cites a chapter number the contents does not use', () => {
    const highest = Math.max(...Object.values(numberOf))
    const bad: string[] = []
    for (const c of CHAPTERS)
      for (const p of prose(c))
        for (const m of p.matchAll(REF))
          if (Number(m[1]) > highest) bad.push(`${c.slug}: “Chapter ${m[1]}” — the book stops at ${highest}`)
    expect(bad).toEqual([])
  })

  it('never has a chapter refer to itself by number', () => {
    /* Chapter 28's "what this act settled" paragraph ended on "Chapter 28 took
       that seriously enough to build on", which reads as a fourth chapter in a
       three-chapter act — and is the easiest of these to write, because the
       paragraph is summarising the act from outside and the chapter is one of
       the things being summarised. "This chapter" is always available. */
    const bad: string[] = []
    for (const c of CHAPTERS) {
      const self = numberOf[c.slug]
      if (self === undefined) continue
      for (const p of prose(c))
        for (const m of p.matchAll(REF))
          if (Number(m[1]) === self)
            bad.push(`${c.slug} is Ch ${self} and says “${p.slice(Math.max(0, m.index - 40), m.index + 60).trim()}”`)
    }
    expect(bad).toEqual([])
  })

  it('never attaches this book’s numbering to the other book’s comics', () => {
    /* "the hot-spot problem that Chapter 3's partition-key comic spends its
       whole length on" — the partition-key comic is DDIA's Chapter 6, in the
       other book; this book's Chapter 3 is Bigtable, which has no such comic.
       Two numbering schemes, one possessive.

       The comics are linked by title everywhere else precisely because their
       numbers belong to a different contents page, so the rule is simply that
       a number and a comic may not be joined. Thirty-eight lines later the
       same chapter does it correctly: "The DDIA comic on choosing a partition
       key argues this out in full." */
    const bad: string[] = []
    const NEAR = /(?:Chapter|Ch\.?) ?\d+[^.]{0,60}?\bcomics?\b|\bcomics?\b[^.]{0,60}?(?:Chapter|Ch\.?) ?\d+/gi
    for (const c of CHAPTERS)
      for (const p of prose(c)) for (const m of p.matchAll(NEAR)) bad.push(`${c.slug}: “${m[0]}”`)
    expect(bad).toEqual([])
  })
})
