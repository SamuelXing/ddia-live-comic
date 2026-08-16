import { describe, it, expect } from 'vitest'
import { isValidElement } from 'react'
import type { ReactElement } from 'react'
import { COMICS } from './comics'
import { CHAPTERS } from '../papers/chapters'
import { THREADS } from '../papers/season'
import { SEASONS } from '../papers/book'
import type { DesignItSpec } from '../papers/DesignIt'
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

/* DesignIt runs four of its own fields through rich() — constraints, each
   question, each option's why, and the reveal — and none of them are reachable
   from a Chapter's plain-data fields, because the widget arrives as JSX in
   `step.diagram`. The first version of this sweep missed them, and a nested
   `mono` in one of Dynamo's option answers sat on the page while the test that
   exists to catch exactly that reported all clear. */
function designItProse(): Array<{ where: string; text: string }> {
  const out: Array<{ where: string; text: string }> = []
  for (const ch of CHAPTERS)
    for (const step of ch.steps) {
      if (!isValidElement(step.diagram)) continue
      const spec = (step.diagram as ReactElement<{ spec?: DesignItSpec }>).props?.spec
      if (!spec?.questions) continue
      const where = `designit:${ch.slug}`
      spec.constraints.forEach((c) => out.push({ where, text: c }))
      spec.reveal.body.forEach((b) => out.push({ where, text: b }))
      for (const q of spec.questions) {
        out.push({ where, text: q.q })
        q.options.forEach((o) => out.push({ where, text: o.why }))
      }
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
    add(`comic:${c.slug}`, (c.bubbles ?? []).map((b) => b.body))
    add(`comic:${c.slug}`, (c.sources ?? []).map((s) => s.note))
  }
  for (const c of CHAPTERS) {
    add(`paper:${c.slug}`, [c.dek, c.caption, c.finale.body, ...proseOf(c.steps)])
    add(`paper:${c.slug}`, (c.inTheWild?.points ?? []).map((p) => (typeof p === 'string' ? p : p.t)))
    add(`paper:${c.slug}`, (c.tradeoffs?.rows ?? []).flatMap((r) => [r.choose, r.when]))
    add(`paper:${c.slug}`, [c.misconception?.think, c.misconception?.actually])
    add(`paper:${c.slug}`, (c.bubbles ?? []).map((b) => b.body))
    add(`paper:${c.slug}`, (c.sources ?? []).map((s) => s.note))
  }
  out.push(...designItProse())
  /* Prose that renders through rich() but lives outside the chapter registry,
     which is exactly the prose a sweep forgets: the close's through-lines, and
     each season's own introduction on the contents page. */
  THREADS.forEach((t) => out.push({ where: `season:${t.name}`, text: t.body }))
  SEASONS.forEach((s) => out.push({ where: `season:${s.n}`, text: s.dek }))
  return out
}

describe('prose the inline formatter can actually render', () => {
  const prose = allProse()

  it('finds prose to check', () => {
    // guards against the traversal silently returning nothing
    expect(prose.length).toBeGreaterThan(400)
    // and against the DesignIt arm silently returning nothing, which is how
    // this sweep quietly stopped covering a whole widget the first time
    expect(prose.filter((p) => p.where.startsWith('designit:')).length).toBeGreaterThan(80)
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

  it('never puts one marker inside another, which prints the inner one raw', () => {
    /* The general form of the *** bug above, and the one that actually shipped
       more often. rich() splits once and emits whatever a matched span contains
       as plain text, so `mono` inside **bold** renders the backticks, and a
       [[glossary|term]] inside italics renders the brackets.

       Nothing warns. The source reads exactly as intended and the page shows
       punctuation the author never typed — found by screenshotting the CAP
       interlude and noticing `p2` had grown quote marks.

       An asterisk inside `mono` is deliberately allowed: `SELECT * FROM t` is
       code, and the parser consumes the whole backtick span before it ever
       looks at the star. */
    const SPAN = /\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[\[[^\]]+\]\]/g
    const bad: string[] = []
    for (const { where, text } of prose)
      for (const [span] of text.matchAll(SPAN)) {
        const two = span.startsWith('**') || span.startsWith('[[')
        const inner = two ? span.slice(2, -2) : span.slice(1, -1)
        const forbidden = span.startsWith('`') ? /\*\*|\[\[/ : /`|\[\[|\*\*/
        if (forbidden.test(inner)) bad.push(`${where}: ${span.slice(0, 64)}`)
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
