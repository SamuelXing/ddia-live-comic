import { describe, it, expect } from 'vitest'
import { COMICS } from './comics'
import { CHAPTERS } from '../papers/chapters'
import type { Step } from './types'

/* `rich()` is a deliberately minimal formatter — **bold**, *italic*, `mono`,
   [[term|definition]] — and it splits on `**` before `*`. That means nesting
   does not work and does not fail loudly either: `*the RUM **conjecture***`
   renders the asterisks as literal characters, which reads as a typo rather
   than a formatting bug and survives any amount of proofreading the source.

   It shipped once, in the RUM interlude, and was caught by looking at a
   screenshot. This is the cheaper way to catch it. */

function proseOf(steps: Step[]): string[] {
  const out: string[] = []
  for (const s of steps) {
    out.push(s.title, ...(s.body ?? []))
    if (s.think) out.push(s.think.q, s.think.a)
    if (s.deeper) out.push(s.deeper.summary, ...(s.deeper.body ?? []))
    if (s.callout) out.push(s.callout.text)
  }
  return out
}

function allProse(): Array<{ where: string; text: string }> {
  const out: Array<{ where: string; text: string }> = []
  const add = (where: string, texts: (string | undefined)[]) =>
    texts.forEach((t) => t && out.push({ where, text: t }))

  for (const c of COMICS) {
    add(`comic:${c.slug}`, [c.dek, c.caption, c.finale.body, ...proseOf(c.steps)])
    add(`comic:${c.slug}`, (c.inTheWild?.points ?? []).map((p) => (typeof p === 'string' ? p : p.t)))
    add(`comic:${c.slug}`, (c.tradeoffs?.rows ?? []).flatMap((r) => [r.choose, r.when]))
    add(`comic:${c.slug}`, [c.misconception?.think, c.misconception?.actually])
  }
  for (const c of CHAPTERS) {
    add(`paper:${c.slug}`, [c.dek, c.caption, c.finale.body, ...proseOf(c.steps)])
    add(`paper:${c.slug}`, (c.inTheWild?.points ?? []).map((p) => (typeof p === 'string' ? p : p.t)))
    add(`paper:${c.slug}`, (c.tradeoffs?.rows ?? []).flatMap((r) => [r.choose, r.when]))
    add(`paper:${c.slug}`, [c.misconception?.think, c.misconception?.actually])
    add(`paper:${c.slug}`, (c.bubbles ?? []).map((b) => b.body))
  }
  return out
}

describe('prose the inline formatter can actually render', () => {
  const prose = allProse()

  it('finds prose to check', () => {
    // guards against the traversal silently returning nothing
    expect(prose.length).toBeGreaterThan(400)
  })

  it('never nests emphasis, which renders the asterisks literally', () => {
    const bad = prose.filter(({ text }) => /\*\*\*/.test(text)).map((p) => `${p.where}: ${p.text.slice(0, 70)}…`)
    expect(bad).toEqual([])
  })

  it('closes every bold and italic marker it opens', () => {
    /* An odd count means a stray marker, which rich() leaves on the page. Bold
       is counted first and removed, exactly as the parser does it, so the
       italic count is what is left over. */
    const bad: string[] = []
    for (const { where, text } of prose) {
      const bolds = (text.match(/\*\*/g) ?? []).length
      if (bolds % 2) bad.push(`${where}: odd ** count — ${text.slice(0, 70)}…`)
      const italics = (text.replace(/\*\*/g, '').match(/\*/g) ?? []).length
      if (italics % 2) bad.push(`${where}: odd * count — ${text.slice(0, 70)}…`)
    }
    expect(bad).toEqual([])
  })

  it('closes every mono span and glossary term', () => {
    const bad: string[] = []
    for (const { where, text } of prose) {
      if (((text.match(/`/g) ?? []).length) % 2) bad.push(`${where}: unclosed backtick`)
      const open = (text.match(/\[\[/g) ?? []).length
      const close = (text.match(/\]\]/g) ?? []).length
      if (open !== close) bad.push(`${where}: ${open} [[ against ${close} ]]`)
    }
    expect(bad).toEqual([])
  })
})
