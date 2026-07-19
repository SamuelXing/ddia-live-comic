---
name: scalelab-design
description: Scale Lab's design system for deep-dive pages and canvas visualizations. Use BEFORE building or editing any component page (flagship or classic), TracePlayer trace, sandbox/meter widget, runbook, or canvas drawing — it carries the validated palette, trace-geometry rules, the nine-chapter flagship template, and the wiring checklist. Triggers: new deep-dive, flagship upgrade, TraceSpec, trace animation, sandbox, hardware envelope, runbook, catalog entry.
---

# Scale Lab design system

Every page here was built to one standard: **explain the system the way you'd
want it explained, and let the reader push on it until it breaks.** The Kafka
and Postgres flagship pages are the reference implementations — when in doubt,
open them and copy the pattern, not just the vibe.

## Non-negotiable invariants

1. **The palette is closed.** All canvas/viz colors come from `VIZ` in
   [src/styles/viz.ts](../../../src/styles/viz.ts) — six categorical colors
   validated against the dark surface. Never invent a hex. Colors carry role
   semantics (blue = client/stateless, amber = machinery, green = cache/store,
   violet = data/replication, red = hot/critical/vacuum). Full table and rules:
   [references/palette.md](references/palette.md).
2. **Nothing overlaps a label.** No particle route may cut through a node it
   isn't connected to; no node may overlap another or leave the canvas. This is
   *enforced*: TracePlayer runs `traceLint` in dev and `console.warn`s every
   violation as `[trace-lint] …`. Building a trace means iterating until the
   dev console is silent. Geometry rules and the routing recipe:
   [references/trace-geometry.md](references/trace-geometry.md).
3. **Labels shrink, never clip.** Canvas text uses the `fitFont` pattern
   (shrink font until it fits the box, floor at ~8.5px). TracePlayer does this
   for you; any new canvas component must too.
4. **Reuse the widget vocabulary.** Tiles, meters (75%/100% warn/crit
   thresholds), verdict boxes, runbook cards, bigfacts, the boundary/ladder box
   — all exist with settled CSS. A new page composes them; it does not invent
   parallel ones. Specs: [references/widgets.md](references/widgets.md).
5. **Authored HTML only.** `dangerouslySetInnerHTML` is used for our own
   authored prose strings (traces, verdicts, cards) — never for anything
   user-derived.
6. **Composer-ready modules.** Every new component's math lives in plain
   exported functions/data (`computeX(values) → ComputeResult`, `TraceSpec`
   objects) — typed, self-describing, importable — so the future Topology
   Composer can consume them. No math inside JSX.

## Building a flagship deep-dive

Follow [references/flagship-template.md](references/flagship-template.md):
the nine-chapter structure, the file layout under `src/deepdives/<key>/`,
the content-quality bar per chapter, and the wiring checklist (route +
catalog + classic-module retirement). Budget honestly: the traces are ~half
the total effort, and their geometry is most of that.

## Voice

- Lead every chapter with the *idea*, then the mechanism, then the numbers.
- Bold the load-bearing claims; italicize the reframing ones.
- Name failure modes vividly ("the forgotten transaction", "the 3am plan
  flip") — a name makes a failure memorable.
- Cross-reference chapters explicitly ("the cascade from Chapter 6") — the
  page should feel like one argument, not nine articles.
- Every hard number gets a primary source, linked at the point of use or in
  a `fl-src-note`. Chapter 9 links only sources worth a reader's evening.

## Verifying a page

1. `npm run build` — typecheck + production build must pass.
2. `npm run dev`, open the page, check the console: zero `[trace-lint]`
   warnings, zero errors.
3. Screenshot every trace mid-animation and *look at it* (headless Chrome via
   playwright-core works; see the session scratchpad pattern). Watch for:
   particles resting on labels, sub-text clipping, zone labels colliding with
   routes along the top channel.
4. Drag every slider to both extremes — meters must clamp, verdicts must
   stay coherent (no NaN, no "0 shards").
