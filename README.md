# systems comic

**I asked an AI to write tech books. These are the books.**

**[Read them →](https://systemscomic.com)**

Not blog posts and not a chatbot — finished books with working parts. A comic about distributed
systems, a story book about the papers behind it, and a calculator they share. Every idea is
drawn, then given a control you can drag until the idea breaks.

![systems comic](public/og/home.png)

## What's on the shelf

| | | |
|---|---|---|
| **[DDIA, as a live comic](https://systemscomic.com/ddia)** | complete, growing | Replication, partitioning, consensus — twelve short comics, each built around one misconception it exists to kill. Then met again inside Kafka, Postgres, Redis, RabbitMQ, the web tier and S3, in nine-chapter deep-dives with animated traces and a hardware envelope you can overload. Plus two whole applications you push until they break. |
| **[The Papers That Broke the Database](https://systemscomic.com/papers)** | being written | The history of distributed systems through the papers that made it. One chapter live of eighteen; the season's map is on the page. |
| **[The calculator](https://systemscomic.com/calculator)** | shared instrument | Put in a workload, get machine counts back — and check every number against the division that produced it. |

## Why it isn't slop

**No model decides anything.** The calculator ranks storage options on closed-form arithmetic over
four decomposed dimensions — data model, storage engine, distribution, atomicity scope — and shows
you the *sensitivity*, not just the estimate. Pin a worse choice and it re-derives what that costs.

**Every number shows its work.** Click a figure in a verdict and it flashes the row it came from.
The prose is generated from the same arithmetic that produced the answer, so it cannot drift from
it.

**Constants are labelled MEASURED or ASSUMED**, and derived rather than asserted where possible —
fibre's 200 km/ms is `c ÷ n` with the refractive index shown, rounded down on purpose.

**Published figures only.** Real operator numbers with a link: Notion's 480 logical shards, Stack
Overflow's day of counters, S3's 2013→2025 growth. Ratios are arithmetic on those figures.

**Sliders snap to a 1-2-5 ladder.** A continuous slider invites "557k/s", which reads as a
measurement when it is a shrug.

## How it stays honest

The interesting part of a project written this way is what stops it lying. Roughly 230 tests, and
the ones that earn their keep check the *artifact*, not the intention:

- **`npm run check:diagrams`** renders every comic in headless Chrome and measures real `getBBox()`
  values — text out of frame, overlaps, labels struck through by a line.
- **`sandboxes.test.ts`** drags every slider to both extremes and asserts no rendered string says
  `NaN` or `Infinity`. It found a divide-by-zero on its first run.
- **`reach.test.ts`** — every recommendation must be reachable *and* avoidable. A card that always
  fires is not advice.
- **`fold.test.ts`, `presets.test.ts`, `citations.test.ts`** — an assumption the answer rests on
  can't be hidden, the guided tour has to visit every store it can reach, and a claim about what
  someone runs in production has to carry a link.
- **the build itself fails** if a route has no social card, or if an emitted page's tags don't
  match the route table.

Every new guard gets broken on purpose before it's trusted — twice now, a test written to catch a
bug passed against the bug.

All limits are order-of-magnitude rules of thumb, useful for intuition. Verify against your own
load tests before committing production capacity.

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # typecheck + build + per-route HTML
npm test               # the suite
npm run check:diagrams # geometry lint (needs the dev server + Chrome)
npm run og             # re-render social cards after editing scripts/routes.mjs
```

## Credits & disclaimer

Book one is an unofficial companion to ***Designing Data-Intensive Applications*, 1st edition, by
Martin Kleppmann** — chapter numbers follow that edition, since the 2nd renumbers. **Unofficial and
not affiliated** with the author or O'Reilly. Read the book; this is a lens on it, not a
replacement. Primary sources are linked at the point of use throughout.

## License

Code is MIT (see [LICENSE](LICENSE)).

The written and illustrated content — comics, prose, diagrams and runbooks — is © Samuel Xing, all
rights reserved. Quote it with attribution; please ask before republishing wholesale.

---

If this was useful, a ⭐ is the whole compensation plan.
