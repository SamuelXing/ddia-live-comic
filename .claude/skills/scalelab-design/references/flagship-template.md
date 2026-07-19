# The flagship deep-dive template

Reference implementations: [kafka/](../../../../src/deepdives/kafka/) and
[postgres/](../../../../src/deepdives/postgres/). A flagship page is the
nine-chapter treatment; "classic" pages are the older sandbox-only format
awaiting upgrade.

## File layout

```
src/deepdives/<key>/
  <Key>Page.tsx        # chapter assembly (CHAPTERS, LIMITS, FAILS, Ch, JSX)
  traces.ts            # anatomy TraceSpecs + (usually) the ch.7 fleet trace
  ops.ts               # METRICS: MetricCard[] + the cascade TraceSpec
  scaleout.ts          # ch.5 sandbox: InputDef[] + compute() → ComputeResult
  HardwareEnvelope.tsx # ch.3 envelope widget (system-specific model)
```

Shared machinery you never rebuild: `TracePlayer`, `MetricRunbook`
(owns the `MetricCard` type), `Sandbox` from `ModulePanel`, `deepdives.css` +
`flagship.css` classes, `fmt` from `format.ts`.

## The nine chapters

1. **The core abstraction** — the one or two design bets everything falls out
   of. End with a `.note` connecting to another page's big idea if real.
2. **Anatomy** — two TracePlayer traces: the hot path end-to-end, then the
   system's strangest/deepest mechanism. Close with "the background cast"
   prose whose members reappear by name in ch.6.
3. **The hardware envelope** — the envelope widget: instance shapes ×
   workload sliders → per-resource meters, worst-binding verdict, one
   info-row insight (page-cache window, checkpoint burst). Cite the baseline
   figures in a `fl-src-note`.
4. **Scaling up** — what each hardware axis buys, mapped back to the anatomy;
   then the *structural* diminishing returns (single append path, single WAL
   stream, blast radius).
5. **Scaling out** — the `Sandbox` with the system's defining scaling math,
   then the `.boundary` box with the ordered scaling ladder (cheapest first).
6. **Operations: the pager view** — the cascade TraceSpec (one root cause →
   multi-alert incident, "read it backwards" finale) + `MetricRunbook` with
   6–9 cards + a `.note` on operating mindset.
7. **What a large deployment looks like** — real published numbers in
   `.bigfacts` tiles + either an interactive (ClusterZoom) or a fleet-topology
   TraceSpec. Sources linked. Never invent figures.
8. **Boundaries & failures** — LIMITS table (`[limit, rough value, why]`) +
   FAILS grid (`[vivid name, scenario + the move]`), ~7–8 each.
9. **Primary sources** — 5 `.src` cards with kicker labels (The paper / The
   book / The docs / The war story / The adversarial read), each with one
   sentence on *why this one is worth reading*.

## Wiring checklist

- [ ] Route in [App.tsx](../../../../src/App.tsx) **above** the
  `/components/:key` catch-all.
- [ ] [catalog.ts](../../../../src/deepdives/catalog.ts): status →
  `'flagship'`, desc rewritten to enumerate the page's actual contents.
- [ ] If upgrading a classic: delete `modules/<key>.ts`, remove from
  `CLASSIC_MODULES` (check imports first).
- [ ] ROADMAP.md: move the item to ✅ with a one-line scope summary.
- [ ] Verify per SKILL.md §Verifying (build, trace-lint silence, screenshots,
  slider extremes).
