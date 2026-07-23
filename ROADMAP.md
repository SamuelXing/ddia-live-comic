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
  - Next: Web-tier / RabbitMQ / S3 upgraded to the flagship template.
- ✅ **`scalelab-design` skill** (`.claude/skills/scalelab-design/`) — codifies the
  hard-won UI/animation patterns (validated palette, label shrink-to-fit, edge-port +
  waypoint routing, runbook/tile/meter/trace styles, nine-chapter template + wiring
  checklist). The "nothing overlaps a label" invariant is now *enforced*: a dev-mode
  trace lint (`src/components/traceLint.ts`) console-warns any particle route that
  cuts through a node, any overlapping/off-canvas node, or unknown ids.

## App simulations (gallery)

- ✅ Social Feed (`/sims/feed`) — local → global, fan-out, hot keys, sharding.
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
