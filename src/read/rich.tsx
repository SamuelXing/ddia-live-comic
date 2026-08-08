import { Fragment, type ReactNode } from 'react'
import { GlossaryTerm } from './Glossary'

/** Minimal inline formatter: **bold**, *italic*, `mono`, and [[term|definition]]
 *  glossary popovers. Keeps comic copy as plain strings (portable, could be JSON)
 *  while still allowing emphasis and depth. Note: **bold** must precede *italic*. */
export function rich(s: string): ReactNode {
  const out: ReactNode[] = []
  const parts = s.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[\[[^\]]+\]\])/g)
  parts.forEach((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      out.push(<b key={i}>{p.slice(2, -2)}</b>)
    } else if (p.startsWith('[[') && p.endsWith(']]')) {
      const [term, def] = p.slice(2, -2).split('|')
      out.push(<GlossaryTerm key={i} term={term} def={def ?? ''} />)
    } else if (p.startsWith('*') && p.endsWith('*')) {
      out.push(<em key={i}>{p.slice(1, -1)}</em>)
    } else if (p.startsWith('`') && p.endsWith('`')) {
      out.push(
        <span className="mono" key={i}>
          {p.slice(1, -1)}
        </span>,
      )
    } else if (p) {
      out.push(<Fragment key={i}>{p}</Fragment>)
    }
  })
  return out
}
