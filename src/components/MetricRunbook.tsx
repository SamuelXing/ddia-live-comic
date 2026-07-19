import { useState } from 'react'

/* Scannable "3am pager" runbook cards. Each opens to reveal the
   full spike → means → breaks → causes → response runbook.
   Reused by every flagship deep-dive (Kafka, Postgres, …). */

export type Severity = 'page' | 'watch'

export interface MetricCard {
  metric: string
  /** The metric's source name — JMX bean, catalog view, etc. */
  jmx: string
  severity: Severity
  healthy: string
  means: string
  breaks: string
  causes: string[]
  /** Ordered response — what an engineer does, cheapest/safest first. */
  respond: string[]
  /** Optional cross-reference to another chapter. */
  tie?: string
}

function Card({ card, open, onToggle }: { card: MetricCard; open: boolean; onToggle: () => void }) {
  return (
    <div className={`rb-card sev-${card.severity} ${open ? 'open' : ''}`}>
      <button className="rb-head" onClick={onToggle} aria-expanded={open}>
        <span className={`rb-sev sev-${card.severity}`}>{card.severity === 'page' ? 'PAGE' : 'WATCH'}</span>
        <span className="rb-metric">{card.metric}</span>
        <code className="rb-jmx">{card.jmx}</code>
        <span className="rb-chev">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="rb-body">
          <div className="rb-row">
            <span className="rb-k good">Healthy</span>
            <span className="rb-v">{card.healthy}</span>
          </div>
          <div className="rb-row">
            <span className="rb-k warn">A spike means</span>
            <span className="rb-v" dangerouslySetInnerHTML={{ __html: card.means }} />
          </div>
          <div className="rb-row">
            <span className="rb-k danger">What breaks</span>
            <span className="rb-v" dangerouslySetInnerHTML={{ __html: card.breaks }} />
          </div>
          <div className="rb-cols">
            <div className="rb-col">
              <div className="rb-col-t">
                Likely causes <span>common → rare</span>
              </div>
              <ol className="rb-list">
                {card.causes.map((c, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: c }} />
                ))}
              </ol>
            </div>
            <div className="rb-col do-col">
              <div className="rb-col-t accent">
                What you do <span>safest first</span>
              </div>
              <ol className="rb-list do">
                {card.respond.map((c, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: c }} />
                ))}
              </ol>
            </div>
          </div>
          {card.tie && <div className="rb-tie">{card.tie}</div>}
        </div>
      )}
    </div>
  )
}

export default function MetricRunbook({ cards }: { cards: MetricCard[] }) {
  const [openSet, setOpenSet] = useState<Set<string>>(new Set())
  const allOpen = openSet.size === cards.length

  const toggle = (name: string) =>
    setOpenSet((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  return (
    <div className="runbook">
      <div className="rb-toolbar">
        <span className="rb-legend">
          <span className="rb-sev sev-page">PAGE</span> wake someone up
          <span className="rb-sev sev-watch" style={{ marginLeft: 14 }}>
            WATCH
          </span>{' '}
          dashboard &amp; alert threshold
        </span>
        <button
          className="rb-expand"
          onClick={() => setOpenSet(allOpen ? new Set() : new Set(cards.map((c) => c.metric)))}
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>
      {cards.map((c) => (
        <Card key={c.metric} card={c} open={openSet.has(c.metric)} onToggle={() => toggle(c.metric)} />
      ))}
    </div>
  )
}
