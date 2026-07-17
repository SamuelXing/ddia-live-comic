# Scale Lab

An interactive systems-design lab: understand how backends scale by **watching it happen**.

Two pillars:

1. **Component Deep-Dives** (`/components`) — one interactive tour per building block (web tier,
   Kafka/RabbitMQ, Redis, Postgres, S3). Drag sliders, find each tier's real wall, and size a full
   system with the end-to-end capacity calculator.
2. **Application Simulations** (`/sims/*`) — whole apps rendered as live 2D simulations.
   Requests are particles flowing through a real queueing model; push traffic until queues back up
   and nodes glow red, then climb the architecture ladder from a single box to a global,
   multi-region deployment.

## Quick start

```bash
npm install
npm run dev        # dev server at http://localhost:5173
```

Other scripts:

```bash
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build locally
npm run typecheck  # TypeScript only
```

## Stack

- **Vite + React 18 + TypeScript** (strict mode)
- **react-router** — `/`, `/components`, `/sims/feed`
- **Custom CSS design system** — tokens in `src/styles/tokens.css`, no CSS framework
- **Canvas rendering** — the simulation draws with raw 2D canvas; React owns the HUD and controls

## Project layout

```
src/
├── main.tsx, App.tsx          # router shell
├── styles/                    # design tokens + per-page scoped stylesheets
├── components/                # shared chrome (nav, footer, hero/thumb canvases)
├── pages/                     # Home (hub), ComponentsPage, NotFound
├── deepdives/
│   ├── types.ts               # typed contract for a deep-dive module
│   ├── format.ts              # number/byte formatting helpers
│   ├── ModulePanel.tsx        # generic renderer (sandbox, limits, failure modes, ladder)
│   ├── Calculator.tsx         # end-to-end capacity calculator
│   └── modules/               # one data module per component (web, messaging, redis, …)
└── sims/
    ├── registry.ts            # the app-simulation gallery (add new sims here)
    └── feed/
        ├── model.ts           # node templates, request types, 6-stage ladder (pure data)
        ├── engine.ts          # discrete-event queueing engine + canvas renderer
        └── FeedSimPage.tsx    # React page: HUD, ladder, controls
```

## How the simulation stays honest

Every node is a queueing station: `capacity = slots ÷ serviceTime`, with a fixed 25 ms sim
resolution so a slot completes at most one request per sub-step. Arrivals beyond capacity queue
up visibly; queues beyond a bound drop (backpressure); fan-out work is internal and surfaces as
consumer lag rather than user-facing errors. The meters (p50/p95, drop %, per-node utilization)
are measured from the event loop, not scripted.

## Adding a new app simulation

1. Create `src/sims/<name>/` with a `model.ts` (topology + stages) and a page component —
   reuse `FeedEngine` patterns or generalize the engine.
2. Add a route in `src/App.tsx`.
3. Register the card in `src/sims/registry.ts` (flip its status to `live`).

Roadmap: E-commerce Checkout (next), Food Delivery (FTGO), Chat/Messaging, Video Streaming.

## A note on the numbers

All limits are order-of-magnitude engineering rules of thumb, useful for building intuition.
Verify against your own load tests before committing production capacity.
