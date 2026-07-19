# Palette — the closed set

Source of truth: `VIZ` in [src/styles/viz.ts](../../../../src/styles/viz.ts).
Validated with the dataviz palette checker against the dark surface
(`#0d0f14`): lightness band, chroma floor, contrast, CVD separation. The CVD
floor-band overlap is legal **only because every node carries a direct text
label** (secondary encoding) — which is why free-floating color-only encodings
are banned.

| token | hex | role |
|---|---|---|
| `VIZ.blue` | `#3987e5` | client, stateless, web tier, app |
| `VIZ.amber` | `#c98500` | machinery: brokers, parsers, planners, queues, indexes-as-structures |
| `VIZ.red` | `#e5533b` | hot, critical, danger, vacuum, purgatory, root causes |
| `VIZ.violet` | `#9085e9` | data at rest/in flight: DB, WAL, replication, row versions |
| `VIZ.green` | `#1aa46e` | caches, buffer pools, object storage, "good" |
| `VIZ.cyan` | `#0f9fc2` | edge, CDN |

Rules:

- Map concepts to **roles**, then use the role's color. A new system gets no
  new color; it gets a mapping (e.g. Postgres: executor = machinery = amber,
  WAL = replication = violet, shared buffers = cache = green).
- Keep hexes in sync with the role tokens in `tokens.css` (same values).
- Canvas surfaces/ink also come from `VIZ` (`surface`, `nodeFillTop/Bottom`,
  `ink*`) — use `nodeGradient()` for node fills, never flat fills.
- Status colors in DOM widgets use the CSS vars `--good` / `--warn` /
  `--crit`, not VIZ hexes.
- If a genuinely new role appears, add it to `viz.ts` + `tokens.css` together
  and re-run the palette validator — do not inline it.
