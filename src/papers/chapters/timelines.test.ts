import { describe, it, expect } from 'vitest'
import { isValidElement, Children } from 'react'
import type { ReactNode, ReactElement } from 'react'
import { lintTimelineSpec } from '../../components/timelineLint'
import { CHAPTERS } from './index'
import type { TimelineSpec } from '../../components/TimelinePlayer'

/* The same arrangement as traces.test.ts, for the other instrument. The lint
   runs in dev and console.warns, which only helps somebody who happens to have
   the console open on the right page; this runs it in CI.

   It walks the chapters rather than importing each spec by name, for the
   reason that list was removed from the trace test: a named list is a fourth
   thing to remember when adding a chapter, and the one whose omission is
   silent. A forgotten import does not fail a build — it quietly stops checking
   one page.

   The distinction from the trace walk is which shape gets picked up. Both
   players take a `spec` prop; a TraceSpec has `zones`, a TimelineSpec has
   `eventAxis`. Neither has the other's, so the two walks cannot claim each
   other's specs and quietly report zero problems. */

function timelinesIn(node: ReactNode, out: TimelineSpec[]): void {
  if (!isValidElement(node)) return
  const props = (node as ReactElement<{ spec?: TimelineSpec; children?: ReactNode }>).props
  if (props?.spec && (props.spec as TimelineSpec).eventAxis) out.push(props.spec)
  Children.forEach(props?.children, (child) => timelinesIn(child, out))
}

describe('timeline geometry and semantics', () => {
  const found: Array<{ where: string; spec: TimelineSpec }> = []
  for (const ch of CHAPTERS)
    for (const step of ch.steps) {
      const specs: TimelineSpec[] = []
      timelinesIn(step.diagram, specs)
      specs.forEach((spec) => found.push({ where: `${ch.slug} · ${step.n}`, spec }))
    }

  it('finds the timelines to lint', () => {
    // without this the suite passes loudest when the walk is broken
    expect(found.length).toBeGreaterThanOrEqual(2)
  })

  it.each(found.map((f) => [f.where, f.spec] as const))('%s passes lint', (_where, spec) => {
    expect(lintTimelineSpec(spec)).toEqual([])
  })
})
