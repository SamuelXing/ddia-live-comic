import { describe, it, expect } from 'vitest'
import { isValidElement, Children } from 'react'
import type { ReactNode, ReactElement } from 'react'
import { lintTraceSpec } from '../../components/traceLint'
import { CHAPTERS } from './index'
import type { TraceSpec } from '../../components/TracePlayer'

/* The trace lint runs in dev and console.warns, which only helps somebody who
   happens to have the console open on the right page. This runs it in CI.

   It walks the chapters rather than importing each trace by name. The named
   list this replaced was a fourth thing to remember when adding a chapter, and
   the one whose omission is silent — a forgotten import does not fail a build,
   it just quietly stops checking one page's geometry. */

function tracesIn(node: ReactNode, out: TraceSpec[]): void {
  if (!isValidElement(node)) return
  const props = (node as ReactElement<{ spec?: TraceSpec; children?: ReactNode }>).props
  // a TraceSpec, not a DesignItSpec: both live on a `spec` prop
  if (props?.spec && Array.isArray((props.spec as TraceSpec).zones)) out.push(props.spec)
  Children.forEach(props?.children, (child) => tracesIn(child, out))
}

describe('trace geometry', () => {
  const found: Array<{ where: string; spec: TraceSpec }> = []
  for (const ch of CHAPTERS)
    for (const step of ch.steps) {
      const specs: TraceSpec[] = []
      tracesIn(step.diagram, specs)
      specs.forEach((spec) => found.push({ where: `${ch.slug} · ${step.n}`, spec }))
    }

  it('finds the traces to lint', () => {
    // without this the suite passes loudest when the walk is broken
    expect(found.length).toBeGreaterThanOrEqual(4)
  })

  it.each(found.map((f) => [f.where, f.spec] as const))('%s passes lint', (_where, spec) => {
    expect(lintTraceSpec(spec)).toEqual([])
  })

  it('gives every trace step the full column width', () => {
    /* A trace needs BOTH `span: 2` on the step and a `.gn-figure` wrapper
       around the player, and neither one alone is enough — .gn-diagram is a
       two-column grid that only collapses when it has a .gn-design, a
       .gn-figure or a .pb-close child, so a trace handed to it bare lands in
       the 280–340px sidebar meant for small SVGs. The canvas then draws at
       about a hundred pixels with every label on top of the last.

       Nothing else catches it. Typecheck passes, trace lint passes (the
       geometry is fine — it is the container that is wrong), and no error is
       logged. The only signal is looking at the page, which is exactly the
       check that gets skipped. Both epilogue chapters were written this way
       and got as far as a screenshot before anybody noticed. */
    const wrongContainer = CHAPTERS.flatMap((ch) =>
      ch.steps.flatMap((step) => {
        const specs: TraceSpec[] = []
        tracesIn(step.diagram, specs)
        if (!specs.length) return []
        const where = `${ch.slug} · ${step.n}`
        const wrapper = isValidElement(step.diagram)
          ? (step.diagram.props as { className?: string })?.className
          : undefined
        const faults: string[] = []
        if (step.span !== 2) faults.push(`${where}: missing span: 2`)
        if (wrapper !== 'gn-figure') faults.push(`${where}: not wrapped in .gn-figure`)
        return faults
      }),
    )
    expect(wrongContainer).toEqual([])
  })
})
