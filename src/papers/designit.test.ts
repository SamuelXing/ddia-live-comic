import { describe, it, expect } from 'vitest'
import { isValidElement } from 'react'
import type { ReactElement } from 'react'
import { CHAPTERS } from './chapters'
import type { DesignItSpec } from './DesignIt'

/* DesignIt is the book's signature interaction, and it renders its three fields
   through two different paths: the question and the "why" go through rich(), so
   **bold** and *italic* work — but an option's LABEL is rendered raw, because it
   sits inside a <button> and never touches the parser.

   That asymmetry is invisible while writing a chapter. GFS's third decision
   shipped a label reading `only *what*; the server decides *where*` and rendered
   the asterisks, which looks like a typo rather than a formatting bug and would
   have survived any amount of proofreading the source. Caught by screenshotting
   the widget; kept caught by this. */

function specsIn(): Array<{ where: string; spec: DesignItSpec }> {
  const out: Array<{ where: string; spec: DesignItSpec }> = []
  for (const ch of CHAPTERS)
    for (const step of ch.steps) {
      const d = step.diagram
      if (!isValidElement(d)) continue
      const spec = (d as ReactElement<{ spec?: DesignItSpec }>).props?.spec
      if (spec?.questions) out.push({ where: `${ch.slug} · ${step.n}`, spec })
    }
  return out
}

describe('the you-are-the-designer widget', () => {
  const found = specsIn()

  it('is present in every chapter — one without it is not this book', () => {
    /* Also the anti-vacuity guard: if the traversal ever stops finding specs,
       every check below passes while testing nothing. A half-chapter gets
       fewer decisions, not zero — the interaction is the method. */
    const withOne = new Set(found.map((f) => f.where.split(' · ')[0]))
    const missing = CHAPTERS.map((c) => c.slug).filter((s) => !withOne.has(s))
    expect(missing).toEqual([])
  })

  it('never puts markup in an option label, which renders raw', () => {
    const bad: string[] = []
    for (const { where, spec } of found)
      for (const q of spec.questions)
        for (const o of q.options)
          if (/\*|`|\[\[|<[a-z]/i.test(o.label)) bad.push(`${where}: "${o.label}"`)
    expect(bad).toEqual([])
  })

  it('gives every decision exactly one move, so the reveal is reachable', () => {
    /* Two moves and the reader unlocks the answer key without meeting the
       argument; zero and the widget is a wall with no door. */
    const bad: string[] = []
    for (const { where, spec } of found)
      spec.questions.forEach((q, i) => {
        const moves = q.options.filter((o) => o.verdict === 'move').length
        if (moves !== 1) bad.push(`${where} decision ${i + 1}: ${moves} moves`)
        if (q.options.length < 2) bad.push(`${where} decision ${i + 1}: only one option`)
      })
    expect(bad).toEqual([])
  })

  it('answers every dead end with a reason, not a buzzer', () => {
    // "Dead end." with two words after it teaches nothing; the wrong turns are
    // where most of the chapter's argument actually lives
    const thin: string[] = []
    for (const { where, spec } of found)
      for (const q of spec.questions)
        for (const o of q.options) if (o.why.length < 80) thin.push(`${where}: "${o.label}" — ${o.why.length} chars`)
    expect(thin).toEqual([])
  })
})
