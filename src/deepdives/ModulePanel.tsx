import { useMemo, useState } from 'react'
import type { InputDef, ModuleContent, ModuleDef, Values } from './types'
import { clampPct, statusFromPct } from './format'

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
      <input
        type="range"
        min={input.min}
        max={input.max}
        step={input.step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <div className="ctl-hint">{input.hint}</div>
    </div>
  )
}

export function Sandbox({ content }: { content: Pick<ModuleContent, 'inputs' | 'compute'> }) {
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

export default function ModulePanel({ module }: { module: ModuleDef }) {
  const variantKeys = module.variants ? Object.keys(module.variants) : []
  const [variantKey, setVariantKey] = useState(variantKeys[0] ?? '')
  const content: ModuleContent | undefined = module.variants
    ? module.variants[variantKey]
    : module.content
  if (!content) return null

  return (
    <section>
      <p className="h-kicker">
        {module.emoji} &nbsp;{module.kicker}
      </p>
      <h1 className="title">{module.title}</h1>
      <p className="lede" dangerouslySetInnerHTML={{ __html: module.lede }} />

      {module.variants && (
        <div style={{ margin: '18px 0 2px' }}>
          <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600, marginRight: 10 }}>
            Compare:
          </span>
          <div className="seg">
            {variantKeys.map((vk) => (
              <button
                key={vk}
                aria-pressed={vk === variantKey}
                onClick={() => setVariantKey(vk)}
              >
                {module.variants![vk].name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div dangerouslySetInnerHTML={{ __html: content.intro }} />

      <h2>Live sandbox — push it until something breaks</h2>
      <Sandbox content={content} />

      <h2>The hard numbers</h2>
      <table className="tbl">
        <thead>
          <tr>
            <th>Limit</th>
            <th>Rough value</th>
            <th>Why it matters</th>
          </tr>
        </thead>
        <tbody>
          {content.limits.map((row) => (
            <tr key={row[0]}>
              <td>{row[0]}</td>
              <td>
                <code>{row[1]}</code>
              </td>
              <td dangerouslySetInnerHTML={{ __html: row[2] }} />
            </tr>
          ))}
        </tbody>
      </table>

      <h2>How it fails at scale</h2>
      <div className="fails">
        {content.fails.map((f) => (
          <div className="fail" key={f[0]}>
            <div className="fn">{f[0]}</div>
            <p className="fd" dangerouslySetInnerHTML={{ __html: f[1] }} />
          </div>
        ))}
      </div>

      <div className="boundary">
        <h3>The scaling ladder — apply in order</h3>
        <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>
          Each rung is cheaper and safer than the one below it. Climb only as far as your load
          forces you to.
        </p>
        <ol className="ladder">
          {content.ladder.map((step, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: step }} />
          ))}
        </ol>
      </div>
    </section>
  )
}
