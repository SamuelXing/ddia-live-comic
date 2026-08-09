# Scale Lab — Roadmap

A living list of where the project is headed. Ordered roughly by sequence, not priority.

## Now / in progress

- **Component deep-dives** — flagship, 9-chapter treatment per infra component.
  - ✅ Kafka (flagship template: abstraction → anatomy w/ animated traces → hardware
    envelope → scale up/out → ops runbook + failure cascade → large-cluster reference → papers)
  - ✅ Postgres (UPDATE trace through parser/planner/executor/buffer pool/WAL, MVCC +
    vacuum lifecycle trace, PG hardware envelope, read/write-asymmetry sandbox, pager
    runbook + idle-transaction cascade, Notion sharding reference + fleet trace)
  - ✅ Redis (event-loop trace, fork/COW persistence trace, one-core hardware envelope,
    hot-key shard sandbox, whale-key cascade + runbook, Redis Cluster fleet trace —
    first page built from the `scalelab-design` skill)
  - ✅ RabbitMQ (publish→exchange→queue→ack trace, BEAM/watermark anatomy trace,
    per-node envelope with the alarm line, two-ceiling scale-out sandbox,
    slow-consumer-freeze cascade + runbook, production-estate trace with the
    Kafka handoff)
  - Next: Web-tier / S3 upgraded to the flagship template.
- ✅ **The comic diagrams are live — where the idea is about time.** Five of the 33
  panels move, because what they explain is a process: replication lag (writes
  crossing a gap that never closes, stale plate breathing), the LSM write path
  (memtable fills → flushes → compaction lands the merged file), a Raft election
  (votes arriving in sequence, then the majority beat), a timeout (heartbeats
  missing → "A is dead" → the zombie wakes, one 6s clock), and the partition
  stampede (keys in flight). The other twenty-eight stay still on purpose —
  motion on a structural drawing explains nothing the still frame didn't.
  Only `transform`, `opacity` and `stroke-dashoffset` are animated: none of them
  change what `getBBox()`/`getPointAtLength()` report, so `npm run check:diagrams`
  still measures shipping geometry (verified green with animations running). Every
  declaration is gated on `prefers-reduced-motion: no-preference`, and the
  reduced-motion render was checked **byte-identical** to the pre-animation
  diagrams. Reserved class prefix: `gn-an-*`.
- ✅ **Order-of-magnitude sliders everywhere.** Every sandbox on the site now snaps
  to a 1-2-5 ladder like the capacity calculator — no more "557k/s" implying a
  measurement, and no more "2,175.8 MB/s" claiming six significant figures built on
  a shrug. Derived readouts round to two significant figures (`fmt.sig`, `fmt.mbs`).
  Shared ladders + slider live in `src/deepdives/ladder.tsx`; `InputDef.min/max/step`
  became `InputDef.steps`. Not everything is a ladder — a count that is small and
  exact (3 brokers, RF 2, RAM in powers of two) is a *choice*, not an estimate, so it
  keeps every value. `inputs.test.ts` enforces two rules across all six sandboxes:
  every default sits on a rung (an off-ladder default renders the thumb on the
  nearest rung while the label prints the stored value — the panel contradicts itself
  before you touch it), and every ladder climbs.
- ✅ **Component math reconciled with the calculator.** Two real inconsistencies.
  Redis assumed 5 µs per command (~194k ops/s at 512 B) — above the top of the
  published unpipelined range; it now uses the calculator's 10 µs, which
  `redis-benchmark`'s 72k–180k supports. Postgres modelled no fsync wall at all, so a
  96-core box implied 80k TPS on CPU alone; it now carries a **commit durability**
  meter derived exactly as the calculator does (8 commits per fsync ÷ 300 µs ≈
  27k/s) — the ceiling cores cannot buy past, because a commit waits on the disk, not
  the CPU. Kafka's "~10 MB/s per partition" is relabelled as the operational
  guideline it is (recovery and rebalance time), not a disk limit: a partition is a
  sequential append and the disk streams GB/s.
- ✅ **`scalelab-design` skill** (`.claude/skills/scalelab-design/`) — codifies the
  hard-won UI/animation patterns (validated palette, label shrink-to-fit, edge-port +
  waypoint routing, runbook/tile/meter/trace styles, nine-chapter template + wiring
  checklist). The "nothing overlaps a label" invariant is now *enforced*: a dev-mode
  trace lint (`src/components/traceLint.ts`) console-warns any particle route that
  cuts through a node, any overlapping/off-canvas node, or unknown ids.

## App simulations (gallery)

- ✅ Social Feed (`/sims/feed`) — local → global, fan-out, hot keys, sharding.
  Reworked as a **guided mission lab**: capped/centered topology, per-stage goal
  checklists that latch as you trigger each lesson, KPI strip, bottleneck auto-tag,
  and an honest latency model (queue+service only — travel animation no longer
  counted, which had been drowning the queueing signal).
- ✅ Observability at Scale (`/sims/observability`) — logs/metrics/traces pipeline as a
  mission lab: single box → Kafka buffer → scale the index tier → **cardinality explosion**
  (the wall horizontal scaling can't climb) → hot/cold storage tiering with a live cost
  estimate → federate + per-team quotas. Reuses the Feed engine with observability hooks
  (cardinality inflates index/query cost; clusters multiply index capacity). Pairs with a
  planned **ClickHouse** flagship deep-dive (the storage box's spec sheet).
- E-commerce checkout — inventory contention, flash sales, sagas.
- Food delivery (FTGO) — choreographed multi-service sagas.
- Chat / messaging — websockets, connection scaling, ordering.
- Video streaming — transcode queue, CDN, object storage.

## New-domain components (paper-driven)

Cassandra · DynamoDB · Flink · etcd/Raft · ClickHouse · MotherDuck/DuckDB · Ray ·
Spark · inference engines (vLLM) · "Inside a web server" (concurrency models + TechEmpower).

## Ship it

- **Deploy** — static Vite build → Vercel/Netlify/Cloudflare/Pages (needs an SPA
  rewrite rule so deep links like `/components/kafka` survive a hard refresh).
- **Support / sponsor** — a Support section with a sponsor QR (GitHub Sponsors / Ko-fi).

---

## ★ North star (phase 3): the Topology Composer

**Idea.** A sandbox where users drag in infra components (web tier, LB, Redis, Postgres,
Kafka, S3, …), wire them together, define traffic, and watch their *own* architecture
scale and break. The deep-dives teach each block in isolation; the app sims show fixed
compositions; the composer is the synthesis — "build whatever you want and watch it break."

**Why it's the north star.** It's an *evolution of the Feed engine*, not a rewrite:
nodes-as-queues, particles, metrics, and the edge-port + waypoint routing are already
built. The component deep-dives are already the capacity "spec sheets" for each box.

**The hard part (design around this, don't fight it): traffic semantics.** A blank canvas
of boxes has no notion of what a "request" *does*. The make-or-break design decisions:

1. **Typed components with typed ports.** A web tier *emits* DB queries + cache ops +
   events; a DB *accepts* queries; a cache *accepts* ops and branches on hit/miss.
   Connections are type-validated, so "what flows" is well-defined and nonsense wiring
   is impossible.
2. **User-defined request flows.** The user clicks a path to define a request type
   (like our route arrays, authored in the UI). The existing engine handles the rest.
3. **Frame it as bottleneck-finding, not prediction.** "Push traffic, see which box
   reddens first, and what fixes it" stays honest with rough per-component math.
   "Predict your exact p99" is fragile queueing-network math — avoid promising it.
4. **Start from "fork a template," not blank canvas.** Let users open the Feed /
   e-commerce topology and modify it (insert a cache, add a replica, split a service).
   Lower risk, same thrill; blank canvas comes later.

**New work required:** the typed-port model, the flow editor, and auto-layout/routing for
arbitrary user graphs (elkjs / dagre for layout).

**Sequencing:** build this only *after* the component library is rich enough to be worth
composing and the design patterns are locked into the skill. Building it on a library of
three boxes wastes the idea. Until then: **make every new component a clean, typed,
self-describing module so it's "composer-ready" from day one.**
