import { useState } from 'react'
import { rich } from '../read/rich'

/* ============================================================
   DesignIt — the "You are the designer" widget, the papers
   book's signature interaction. The reader gets the constraints
   BEFORE the paper: each decision offers the moves an engineer
   would actually consider, every option answers back honestly
   (terra = dead end, denim = the move), and the reveal — the
   paper as answer key — unlocks only once the reader has found
   the move on every decision. Choosing wrong is not a failure
   state; dead ends are where the learning is, so options stay
   clickable after a verdict.
   ============================================================ */

export interface DesignOption {
  label: string
  verdict: 'dead' | 'move'
  why: string
}

export interface DesignQuestion {
  q: string
  options: DesignOption[]
}

export interface DesignItSpec {
  /** the standing constraints, shown as a mono list above the decisions */
  constraints: string[]
  questions: DesignQuestion[]
  reveal: { title: string; body: string[] }
}

export default function DesignIt({ spec }: { spec: DesignItSpec }) {
  /** which option is currently picked per question */
  const [picked, setPicked] = useState<(number | null)[]>(() => spec.questions.map(() => null))
  /** whether the reader has found the move on each question (sticky) */
  const [found, setFound] = useState<boolean[]>(() => spec.questions.map(() => false))

  const pick = (qi: number, oi: number) => {
    setPicked((p) => p.map((v, i) => (i === qi ? oi : v)))
    if (spec.questions[qi].options[oi].verdict === 'move') setFound((f) => f.map((v, i) => (i === qi ? true : v)))
  }

  const unlocked = found.every(Boolean)

  return (
    <div className="gn-design">
      <div className="gn-design-constraints">
        <div className="cl">Your constraints</div>
        <ul>
          {spec.constraints.map((c, i) => (
            <li key={i}>{rich(c)}</li>
          ))}
        </ul>
      </div>

      {spec.questions.map((q, qi) => {
        const sel = picked[qi]
        const opt = sel != null ? q.options[sel] : null
        return (
          <div className="gn-dq" key={qi}>
            <div className="qn">
              Decision {qi + 1} of {spec.questions.length}
              {found[qi] && <span className="ok"> · solved</span>}
            </div>
            <p className="qq">{rich(q.q)}</p>
            <div className="opts">
              {q.options.map((o, oi) => (
                <button
                  key={oi}
                  type="button"
                  className={
                    'gn-dopt' + (sel === oi ? (o.verdict === 'move' ? ' is-move' : ' is-dead') : '')
                  }
                  onClick={() => pick(qi, oi)}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {opt && (
              <div className={'gn-dwhy ' + (opt.verdict === 'move' ? 'move' : 'dead')}>
                <span className="vt">{opt.verdict === 'move' ? 'The move.' : 'Dead end.'}</span> {rich(opt.why)}
              </div>
            )}
          </div>
        )
      })}

      {unlocked ? (
        <div className="gn-dreveal">
          <div className="rt">{spec.reveal.title}</div>
          {spec.reveal.body.map((p, i) => (
            <p key={i}>{rich(p)}</p>
          ))}
        </div>
      ) : (
        <div className="gn-dlocked">Find the move on every decision to unlock the answer key.</div>
      )}
    </div>
  )
}
