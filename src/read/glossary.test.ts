import { describe, it, expect } from 'vitest'
import { COMICS } from './comics'

/* A comic that uses a term the reader has not met yet is the failure this file
   exists to catch. It is invisible to the author, who knows every term, and it
   is exactly what the first comprehension audit found by hand: the quorum comic
   leaned on `linearizability` three times while Ch 9 held the only definition.
   Sweeping by hand once fixes today; a test fixes it for every comic added
   after today.

   Two things count as defining a term: a `bubbles` entry, and an inline
   [[term|definition]] gloss. Both render a definition next to the word. */

/** Everything the reader can see as prose, with the definitions themselves
 *  removed — a gloss body may legitimately mention terms from later chapters
 *  while explaining one, and a bubble's own headword is not a "use". */
function prose(c: (typeof COMICS)[number]): string {
  const parts: string[] = [c.caption ?? '', c.dek ?? '', c.finale?.body ?? '']
  c.steps.forEach((s) => {
    parts.push(s.title, ...(s.body ?? []))
    if (s.think) parts.push(s.think.q, s.think.a)
    if (s.callout) parts.push(s.callout.text)
    if (s.deeper) parts.push(...(s.deeper.body ?? []))
  })
  c.inTheWild?.points.forEach((p) => parts.push(typeof p === 'string' ? p : p.t))
  c.tradeoffs?.rows.forEach((r) => parts.push(r.choose, r.when))
  if (c.misconception) parts.push(c.misconception.think, c.misconception.actually)
  // drop gloss bodies, keeping the headword — [[term|body]] -> term
  return parts.join(' \n ').replace(/\[\[([^|\]]+)\|[^\]]*\]\]/g, '$1')
}

/** term -> index of the earliest comic that defines it */
const definedAt = new Map<string, number>()
COMICS.forEach((c, i) => {
  const add = (t: string) => {
    const k = t.trim().replace(/\.$/, '').toLowerCase()
    if (!definedAt.has(k)) definedAt.set(k, i)
  }
  c.bubbles?.forEach((b) => add(b.term))
  const all = prose(c)
  for (const m of all.matchAll(/\[\[([^|\]]+)\|/g)) add(m[1])
  // the inline glosses were already stripped by prose(), so read the raw source
  // of the comic object instead: JSON.stringify reaches every string field.
  for (const m of JSON.stringify(c).matchAll(/\[\[([^|\]]+)\\?\|/g)) add(m[1])
})

/* Judged acceptable, with the reason. A forward reference is not automatically
   a bug — a comic that *describes* a thing and then names it has already taught
   it, which is better pedagogy than a gloss. Anything not on this list has to
   be fixed or argued onto it. */
const ALLOWED: Record<string, string> = {
  'split brain':
    'replication-leader describes two leaders taking writes in full, then names it in the same breath — described-then-named needs no gloss.',
  timeout:
    'replication-leader spends a whole bullet on how long to wait before declaring the leader dead, which is the definition.',
  'tail latency':
    'the term is the subject of comic #1; the Ch 10 gloss is a reminder for readers arriving there directly, not the first definition.',
}

describe('no comic leans on a term the reader has not met', () => {
  it('every term is defined no later than the comic that first uses it', () => {
    const offenders: string[] = []
    definedAt.forEach((di, term) => {
      // short words collide with ordinary English ("term", "page", "skew")
      if (term.length < 5 || ALLOWED[term]) return
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      COMICS.slice(0, di).forEach((earlier) => {
        if (re.test(prose(earlier)))
          offenders.push(`"${term}" is used in ${earlier.slug} but not defined until ${COMICS[di].slug}`)
      })
    })
    expect(offenders).toEqual([])
  })

  it('the allow-list stays honest — every entry is still a real forward reference', () => {
    /* An exemption that no longer applies is worse than no exemption: it hides
       the next real one behind a name somebody already decided was fine. */
    Object.keys(ALLOWED).forEach((term) => {
      const di = definedAt.get(term)
      expect(di, `${term} is on the allow-list but nothing defines it`).toBeDefined()
      const re = new RegExp(`\\b${term}\\b`, 'i')
      const used = COMICS.slice(0, di).some((c) => re.test(prose(c)))
      expect(used, `${term} is on the allow-list but is no longer used early — drop the entry`).toBe(true)
    })
  })
})
