/* The sandbox widget: sliders on the left, tiles + meters + verdict on the
   right, shared by chapter 5 of every flagship deep-dive. It renders a
   SandboxContent and knows nothing about the system being modelled — all the
   arithmetic arrives as a pure `compute` from that page's scaleout.ts. */
import { useMemo, useState } from 'react'
import type { InputDef, SandboxContent, Values } from './types'
import { clampPct, statusFromPct } from './format'
import { LadderSlider } from './ladder'

function SliderCtl({
  input,
  value,
  onChange,
}: {
  input: InputDef
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="ctl">
      <div className="ctl-top">
        <span className="ctl-label">{input.label}</span>
        <span className="ctl-val">{input.fmt(value)}</span>
      </div>
      <LadderSlider steps={input.steps} value={value} onChange={onChange} ariaLabel={input.label} />
      <div className="ctl-hint">{input.hint}</div>
    </div>
  )
}

export function Sandbox({ content }: { content: SandboxContent }) {
  const defaults = useMemo(() => {
    const d: Values = {}
    content.inputs.forEach((i) => (d[i.id] = i.val))
    return d
  }, [content])
  const [values, setValues] = useState<Values>(defaults)
  // reset when the content (variant) changes
  const [prev, setPrev] = useState(content)
  if (prev !== content) {
    setPrev(content)
    setValues(defaults)
  }

  const r = content.compute(values)

  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="sandbox">
        <div className="sb-controls">
          <p className="sb-title">Inputs — drag to explore</p>
          {content.inputs.map((inp) => (
            <SliderCtl
              key={inp.id}
              input={inp}
              value={values[inp.id] ?? inp.val}
              onChange={(v) => setValues((s) => ({ ...s, [inp.id]: v }))}
            />
          ))}
        </div>
        <div className="sb-out">
          <p className="sb-title">What happens</p>
          <div className="tiles">
            {r.tiles.map((t) => (
              <div className="tile" key={t.k}>
                <div className="k">{t.k}</div>
                <div className="v">{t.v}</div>
                <div className="u">{t.u}</div>
              </div>
            ))}
          </div>
          <div>
            {r.meters.map((m) => {
              const pct = clampPct(m.pct)
              const st = m.invert
                ? m.pct >= 75
                  ? 'crit'
                  : m.pct >= 40
                    ? 'warn'
                    : 'good'
                : statusFromPct(m.pct)
              return (
                <div className="meter" key={m.label}>
                  <div className="meter-top">
                    <span className="meter-label">{m.label}</span>
                    <span className={`meter-num st-${st}`}>{m.valTxt}</span>
                  </div>
                  <div className="meter-bar">
                    <div className={`meter-fill fill-${st}`} style={{ width: pct + '%' }} />
                  </div>
                  <div className="meter-detail">{m.detail}</div>
                </div>
              )
            })}
          </div>
          <div className={`verdict v-${r.verdict.s}`}>
            <span className="vi">{r.verdict.s === 'good' ? '✓' : r.verdict.s === 'warn' ? '▲' : '✕'}</span>
            <span dangerouslySetInnerHTML={{ __html: r.verdict.t }} />
          </div>
        </div>
      </div>
    </div>
  )
}
