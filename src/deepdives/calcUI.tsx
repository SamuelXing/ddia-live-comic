import type { ReactNode } from 'react'
import type { Inp, Opt } from './calcModel'

/* ============================================================
   The controls both calculators are built from.

   Extracted when the latency budget arrived rather than copied: a
   second implementation of a slider that snaps to a ladder is a
   second place for the thumb to disagree with the label.
   ============================================================ */

export function Picker({ options, value, onPick }: { options: Opt[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="picker">
      {options.map((o) => (
        <button key={o.id} className={'pick' + (o.id === value ? ' on' : '')} onClick={() => onPick(o.id)} title={o.info}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Info({ text }: { text?: string }) {
  if (!text) return null
  return (
    <span className="info" tabIndex={0} role="note" aria-label={text}>
      i<span className="info-tip">{text}</span>
    </span>
  )
}

/** A number this page computed, carrying the arithmetic that produced it.
 *  Given `ceil`, it also becomes a jump to the row of "what one machine can do"
 *  it was measured against — so "8.7%" answers "8.7% of what?" with a click
 *  instead of a paragraph. Denim, because a computed number is something the
 *  page built. */
export function Num<C extends string>({ children, how, ceil, jump }: { children: ReactNode; how?: string; ceil?: C; jump?: (c: C) => void }) {
  if (ceil && jump)
    return (
      <button
        type="button"
        className="num num-ref"
        onClick={() => jump(ceil)}
        title={(how ? how + ' — ' : '') + 'jump to the ceiling this is measured against'}
      >
        {children}
      </button>
    )
  return (
    <b className="num" title={how}>
      {children}
    </b>
  )
}

export function Slider({ inp, value, set }: { inp: Inp; value: number; set: (n: number) => void }) {
  let i = inp.steps.indexOf(value)
  if (i < 0) i = inp.steps.reduce((best, s, k) => (Math.abs(s - value) < Math.abs(inp.steps[best] - value) ? k : best), 0)
  return (
    <input
      type="range"
      min={0}
      max={inp.steps.length - 1}
      step={1}
      value={i}
      onChange={(e) => set(inp.steps[parseInt(e.target.value)])}
    />
  )
}

export function Ctl({ label, info, hint, children, val }: { label: ReactNode; info?: string; hint: string; children: ReactNode; val?: string }) {
  return (
    <div className="ctl">
      <div className="ctl-top">
        <span className="ctl-label">
          {label}
          <Info text={info} />
        </span>
        {val && <span className="ctl-val">{val}</span>}
      </div>
      {children}
      <div className="ctl-hint">{hint}</div>
    </div>
  )
}

