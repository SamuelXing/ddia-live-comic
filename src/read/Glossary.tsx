import { useState } from 'react'

/** An inline glossary term: dotted underline, tap to reveal its definition in a
 *  popover below — depth without cluttering the sentence. */
export function GlossaryTerm({ term, def }: { term: string; def: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="gn-gloss">
      <button type="button" className="gn-gloss-t" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {term}
      </button>
      {open && (
        <span className="gn-gloss-pop" role="note">
          <b>{term}.</b> {def}
        </span>
      )}
    </span>
  )
}
