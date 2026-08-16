import type { TimelineSpec } from './TimelinePlayer'

/* ============================================================
   Dev-only lint for TimelineSpecs — the same job traceLint does
   for the request traces, against a different set of invariants.

   A trace can be wrong by drawing a line through a box, which is
   ugly. A timeline can be wrong by drawing something that cannot
   happen, which is worse, because the reader will believe it. The
   two that matter:

     - processing time never goes backwards between steps
     - a watermark never goes backwards, ever

   The second is not a drawing rule. It is the defining property of
   a watermark, and the whole of Act II leans on it: once you have
   said "nothing before T is still coming", you may not un-say it.
   A spec that walks one backwards is teaching the opposite of the
   chapter it appears in, and nothing on the page would look wrong.

   Runs when a TimelinePlayer mounts in dev and console.warns each
   violation; timelines.test.ts walks the chapters and runs it in CI.
   ============================================================ */

export function lintTimelineSpec(spec: TimelineSpec): string[] {
  const w: string[] = []
  const eMax = spec.eventAxis.max
  const pMax = spec.procAxis.max
  if (!(eMax > 0)) w.push('eventAxis.max must be positive')
  if (!(pMax > 0)) w.push('procAxis.max must be positive')

  const ids = new Set<string>()
  spec.records.forEach((r) => {
    if (ids.has(r.id)) w.push(`duplicate record id "${r.id}"`)
    ids.add(r.id)
    if (r.event < 0 || r.event > eMax) w.push(`record "${r.id}" sits off the event-time axis (0–${eMax})`)
    if (r.arrived < 0 || r.arrived > pMax) w.push(`record "${r.id}" sits off the processing-time axis (0–${pMax})`)
  })

  const labels = new Set<string>()
  const sorted = [...spec.windows].sort((a, b) => a.from - b.from)
  sorted.forEach((win, i) => {
    if (labels.has(win.label)) w.push(`duplicate window label "${win.label}"`)
    labels.add(win.label)
    if (win.to <= win.from) w.push(`window "${win.label}" ends before it starts`)
    if (win.from < 0 || win.to > eMax) w.push(`window "${win.label}" runs off the event-time axis (0–${eMax})`)
    /* Overlapping windows are legal in the world — sliding and session windows
       both do it — and illegal here, because this player draws them as bands
       and two bands in the same place is a picture nobody can read. A spec
       that needs them needs a different drawing, not a looser lint. */
    if (i > 0 && win.from < sorted[i - 1].to)
      w.push(`windows "${sorted[i - 1].label}" and "${win.label}" overlap — this player draws bands, so they must not`)
  })

  let lastNow = -Infinity
  let lastMark = -Infinity
  let firedSoFar = new Set<string>()
  spec.steps.forEach((s, i) => {
    const at = `step ${i + 1} ("${s.title}")`
    if (s.now < 0 || s.now > pMax) w.push(`${at}: now=${s.now} is off the processing-time axis (0–${pMax})`)
    if (s.now < lastNow) w.push(`${at}: processing time went backwards (${lastNow} → ${s.now})`)
    lastNow = s.now

    if (s.watermark !== undefined) {
      if (s.watermark < 0 || s.watermark > eMax)
        w.push(`${at}: watermark=${s.watermark} is off the event-time axis (0–${eMax})`)
      if (s.watermark < lastMark)
        w.push(`${at}: the watermark went backwards (${lastMark} → ${s.watermark}) — a watermark is a promise, and it cannot be withdrawn`)
      lastMark = Math.max(lastMark, s.watermark)
    }

    ;(s.highlight ?? []).forEach((id) => {
      if (!ids.has(id)) w.push(`${at}: highlights "${id}", which is not a record`)
    })
    ;(s.fired ?? []).forEach((l) => {
      if (!labels.has(l)) w.push(`${at}: fires "${l}", which is not a window`)
    })
    Object.keys(s.panes ?? {}).forEach((l) => {
      if (!labels.has(l)) w.push(`${at}: labels a pane on "${l}", which is not a window`)
      else if (!(s.fired ?? []).includes(l))
        w.push(`${at}: window "${l}" shows a pane badge but is not listed as fired`)
    })
    /* A window that has produced a result cannot go back to not having produced
       one. Dropping a label from `fired` is always an authoring slip. */
    const missing = [...firedSoFar].filter((l) => !(s.fired ?? []).includes(l))
    if (missing.length) w.push(`${at}: window "${missing[0]}" un-fired — a window that emitted a result cannot take it back`)
    firedSoFar = new Set(s.fired ?? [])

    if (s.note && (s.note.event < 0 || s.note.event > eMax || s.note.proc < 0 || s.note.proc > pMax))
      w.push(`${at}: the note is pinned outside the plot`)
  })

  if (spec.steps.length === 0) w.push('a timeline with no steps animates nothing')
  return w
}

export function lintAndReportTimeline(spec: TimelineSpec): void {
  lintTimelineSpec(spec).forEach((m) => console.warn(`[timeline-lint] ${spec.title}: ${m}`))
}
