# Widget vocabulary — tiles, meters, verdicts, runbooks, bigfacts

All CSS already exists in `deepdives.css` / `flagship.css`. Compose; don't
fork.

## Sandbox (`Sandbox` from ModulePanel + `types.ts`)

- `InputDef`: 5–6 sliders max; every slider has a `hint` that teaches, not
  describes ("The master knob: caps consumer parallelism AND spreads
  throughput", not "number of partitions").
- `compute(values) → ComputeResult` is a **pure exported function** — this is
  the composer-ready contract. Tiles (≤4), meters (≤3 in a Sandbox), verdict.
- Meters: `pct` drives color at 75% (warn) / 100% (crit); `invert: true` for
  "low is bad" (e.g. % cached). `detail` states the formula or consequence in
  one line.
- Verdict: exactly one of `good | warn | crit`; text is 1–3 sentences, bold
  claim first, and always names the *move* ("Add consumers AND partitions"),
  not just the state. Cover the interesting failure orderings — check which
  condition fires first at slider extremes.

## Hardware envelope (per-system component)

Pattern from Kafka/Postgres `HardwareEnvelope.tsx`: 4 instance `SHAPES`
(buttons, `.hw-shapes`) + workload sliders → resource rows (each with a
`why` stating its formula) → `worst = max(used/cap)` verdict with
per-resource advice text → one non-meter info row carrying the page's
signature insight (page-cache window / checkpoint burst). Keep the model
honest and order-of-magnitude; comment the formulas at the top of the file.

## MetricRunbook (`MetricCard[]`)

- 6–9 cards; severity `page` (wake someone) vs `watch` (dashboard+threshold).
  Roughly half and half.
- `jmx` holds the real metric source (JMX bean, `pg_stat_*` view) — never a
  made-up name.
- `healthy` / `means` / `breaks` / `causes` (common → rare) / `respond`
  (safest first). `respond` items are imperative and specific enough to type.
- `tie` links back to the chapter where the mechanism was taught — every card
  should close a loop with ch.2/3/5 where possible.

## Bigfacts & sources

- `.bigfacts`: 4–5 tiles, `bf-v` (the number) / `bf-k` (what it counts) /
  `bf-s` (the qualifier). Only published, citable figures; derived values ok
  if the derivation is obvious (480 / 96 = 5).
- `.src` cards: kicker (`s-k`) + linked title + one-sentence pitch.

## Boundary / ladder

`.boundary` box with `ol.ladder`: 5–6 rungs, strictly ordered
cheapest-and-safest first, each rung bold-verb-first with the reason attached.
