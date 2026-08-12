/* ============================================================
   Observability at Scale — domain model.
   A logs/metrics/traces pipeline as a queueing network:
   agents → gateway → buffer → indexer → hot/cold store, plus a
   query path reading it back. Pure data; the engine consumes it.
   Runs on the shared engine in ../engine.ts, which supplies the
   queueing primitives (nodes-as-queues, particles, snapshots);
   this sim's own mechanics — cardinality and federation — live in
   ./engine.ts.
   ============================================================ */

export type ReqType = 'log' | 'metric' | 'trace' | 'query'

export const REQ: Record<ReqType, { label: string; color: string }> = {
  log: { label: 'log line', color: '#3987e5' },
  metric: { label: 'metric', color: '#25b866' },
  trace: { label: 'trace span', color: '#9085e9' },
  query: { label: 'query / dashboard', color: '#e6a72a' },
}

/** Ingest-vs-query split → per-type spawn weights. */
export function typeWeights(queryShare: number): Record<ReqType, number> {
  const q = queryShare
  const ingest = 1 - q
  return {
    log: ingest * 0.6, // logs dominate ingest volume
    metric: ingest * 0.3,
    trace: ingest * 0.1,
    query: q,
  }
}

/* Node shape and roles are the engine's, not this sim's — both sims draw the
   same kinds of station on the same canvas. */
export type { Role, NodeTpl } from '../engine'
import type { NodeTpl } from '../engine'

/* Node templates. slots = instances × slotsPer; capacity(units/s) =
   slots ÷ (serviceMs/1000). serviceMs floors at the engine's 25 ms.
   Role picks the canvas color; kind drives capacity + cost behaviour. */
export const TEMPLATES: Record<string, NodeTpl> = {
  agents: { id: 'agents', label: 'Agents', role: 'src', col: 0 },
  dash: { id: 'dash', label: 'Dashboards', role: 'src', col: 0 },
  gw: { id: 'gw', label: 'Ingest gateway', kind: 'gw', role: 'web', col: 1, instances: 2, slotsPer: 10, serviceMs: 35, scalable: 'web' },
  buffer: { id: 'buffer', label: 'Kafka buffer', kind: 'buffer', role: 'queue', col: 2, instances: 1, slotsPer: 60, serviceMs: 25 },
  idx: { id: 'idx', label: 'Indexer', kind: 'idx', role: 'db', col: 3, instances: 2, slotsPer: 6, serviceMs: 60, scalable: 'web' },
  query: { id: 'query', label: 'Query engine', kind: 'query', role: 'svc', col: 2, instances: 2, slotsPer: 8, serviceMs: 50, scalable: 'web' },
  hot: { id: 'hot', label: 'Hot store (SSD)', kind: 'hot', role: 'cache', col: 4, instances: 1, slotsPer: 16, serviceMs: 30 },
  cold: { id: 'cold', label: 'Cold store (S3)', kind: 'cold', role: 'store', col: 5, instances: 1, slotsPer: 60, serviceMs: 800 },
  mono: { id: 'mono', label: 'One box\n(ingest+index+query)', kind: 'mono', role: 'mono', col: 2, instances: 1, slotsPer: 16, serviceMs: 90 },
}

export interface StageControls {
  ingest?: boolean
  queryShare?: boolean
  indexers?: boolean
  cardinality?: boolean
  tiering?: boolean
  clusters?: boolean
  quota?: boolean
}

/** What goal predicates can see: live node stats + current knob values. */
export interface GoalCtx {
  util: (id: string) => number
  qdepth: (id: string) => number
  dropPct: number
  p95: number
  c: {
    ingest: number
    queryShare: number
    indexers: number
    cardinality: number
    hotShare: number
    retention: number
    clusters: number
    quota: boolean
  }
}

/** A mission objective. Once observed true it stays checked (latched by the page). */
export interface Goal {
  id: string
  label: string
  done: (g: GoalCtx) => boolean
}

export interface StageDef {
  n: number
  title: string
  kicker: string
  desc: string
  nodes: string[]
  /** Indexer instances this stage starts with. */
  idx?: number
  /** Ingest volume (units) this stage opens at, sized for its lesson. */
  ingest0?: number
  controls: StageControls
  routes: (s: { cacheHit: number }) => Partial<Record<ReqType, string[]>>
  goals: Goal[]
  tip: { h: string; p: string }
}

export const STAGES: StageDef[] = [
  {
    n: 1,
    ingest0: 48,
    title: 'Single box',
    kicker: 'Shared fate',
    desc: 'One box does everything — receive, parse, index, store, and serve queries. Push the ingest firehose up and watch a query slow to a crawl behind the indexing load: ingest and search share one pool of CPU.',
    nodes: ['agents', 'dash', 'mono'],
    controls: { ingest: true, queryShare: true },
    routes: () => ({
      log: ['agents', 'mono'],
      metric: ['agents', 'mono'],
      trace: ['agents', 'mono'],
      query: ['dash', 'mono'],
    }),
    goals: [
      { id: 'push', label: 'Push ingest past 10k events/s', done: (g) => g.c.ingest >= 170 },
      { id: 'sat', label: 'Saturate the box (≥ 95% busy)', done: (g) => g.util('mono') >= 0.95 },
      { id: 'drop', label: 'Watch events start dropping', done: (g) => g.dropPct >= 2 },
    ],
    tip: {
      h: 'Ingest and query fight for the same CPU',
      p: 'A single instance means indexing a log storm and running a dashboard query compete for one machine. Ingest almost always wins, and searches time out exactly when you most need them — during the incident driving the log storm.',
    },
  },
  {
    n: 2,
    ingest0: 110,
    title: 'Buffer the firehose',
    kicker: 'Kafka as shock absorber',
    desc: 'Put a Kafka buffer between agents and the indexer, and split the query engine onto its own tier. Now an ingest spike parks in the buffer and drains instead of dropping data or melting the indexer — and queries keep running while it does.',
    nodes: ['agents', 'gw', 'buffer', 'idx', 'hot', 'dash', 'query'],
    idx: 2,
    controls: { ingest: true, queryShare: true },
    routes: () => ({
      log: ['agents', 'gw', 'buffer', 'idx', 'hot'],
      metric: ['agents', 'gw', 'buffer', 'idx', 'hot'],
      trace: ['agents', 'gw', 'buffer', 'idx', 'hot'],
      query: ['dash', 'query', 'hot'],
    }),
    goals: [
      { id: 'storm', label: 'Trigger a log storm (⚡ button)', done: (g) => g.c.ingest >= 280 },
      { id: 'absorb', label: 'Buffer soaks it up — depth climbs past 30', done: (g) => g.qdepth('buffer') > 30 },
      { id: 'noloss', label: 'Query stays fast (p95 under 500 ms)', done: (g) => g.p95 < 500 && g.qdepth('buffer') > 15 },
    ],
    tip: {
      h: 'The buffer decouples produce from consume',
      p: 'Agents write to Kafka at whatever rate the incident produces; the indexer reads at its own steady pace. The spike becomes queue depth, not dropped data — the same shock-absorber role Kafka plays everywhere. Queries hit their own tier, untouched by the ingest surge.',
    },
  },
  {
    n: 3,
    ingest0: 160,
    title: 'Scale the index tier',
    kicker: 'Scatter-gather',
    desc: 'Indexing is the expensive step — parse every field, build the inverted index. Add indexer shards and the ingest firehose spreads across them; a query scatter-gathers across all shards and merges. Reads and writes both scale out here.',
    nodes: ['agents', 'gw', 'buffer', 'idx', 'hot', 'dash', 'query'],
    idx: 2,
    controls: { ingest: true, queryShare: true, indexers: true },
    routes: () => ({
      log: ['agents', 'gw', 'buffer', 'idx', 'hot'],
      metric: ['agents', 'gw', 'buffer', 'idx', 'hot'],
      trace: ['agents', 'gw', 'buffer', 'idx', 'hot'],
      query: ['dash', 'query', 'hot'],
    }),
    goals: [
      { id: 'load', label: 'Push ingest past 15k events/s', done: (g) => g.c.ingest >= 250 },
      { id: 'shard', label: 'Add indexer shards (6+)', done: (g) => g.c.indexers >= 6 },
      { id: 'cool', label: 'Indexers back under 70% busy', done: (g) => g.c.indexers >= 6 && g.util('idx') <= 0.7 },
    ],
    tip: {
      h: 'Indexing scales horizontally — until it doesn’t',
      p: 'More shards means more parallel parsing and a wider scatter-gather. Ingest throughput climbs almost linearly with indexer count. This is the comfortable regime — and the next stage is the wall that horizontal scaling cannot climb.',
    },
  },
  {
    n: 4,
    ingest0: 260,
    title: 'Cardinality explosion',
    kicker: 'The wall you can’t scale past',
    desc: 'Someone adds a high-cardinality label — user_id, request_id, a raw URL — as an indexed field. Every distinct value is a new index term; the index balloons, per-event work explodes, and queries crawl. Watch adding shards fail to help, then fix it at the source.',
    nodes: ['agents', 'gw', 'buffer', 'idx', 'hot', 'dash', 'query'],
    idx: 6,
    controls: { ingest: true, indexers: true, cardinality: true },
    routes: () => ({
      log: ['agents', 'gw', 'buffer', 'idx', 'hot'],
      metric: ['agents', 'gw', 'buffer', 'idx', 'hot'],
      trace: ['agents', 'gw', 'buffer', 'idx', 'hot'],
      query: ['dash', 'query', 'hot'],
    }),
    goals: [
      { id: 'explode', label: 'Crank cardinality past 60%', done: (g) => g.c.cardinality >= 60 },
      { id: 'trap', label: 'Indexer pegged even at 10+ shards', done: (g) => g.c.cardinality >= 60 && g.c.indexers >= 10 && g.util('idx') >= 0.85 },
      /* The `indexers >= 10` clause is not decoration. Without it this goal is
         satisfied the instant the stage opens — it starts at cardinality 0 and
         six shards that are not yet pegged — so the payoff box of a
         break-it-then-fix-it mission arrived pre-ticked. Requiring the shard
         count from `trap` also makes the lesson sharper: you keep the 10 shards
         that did not help, change only the label, and watch it recover. One
         variable moves. */
      { id: 'fix', label: 'Drop the label (cardinality ≤ 20%) at 10+ shards — it recovers', done: (g) => g.c.cardinality <= 20 && g.c.indexers >= 10 && g.util('idx') <= 0.7 },
    ],
    tip: {
      h: 'Cardinality is a data-model problem, not a capacity one',
      p: 'High-cardinality labels multiply index size and per-event cost. Doubling shards halves throughput-per-shard but the total work still explodes — you cannot buy your way out. The fix lives in the pipeline: drop the label, hash it, or move it to a trace you sample. This is the observability version of the hot key.',
    },
  },
  {
    n: 5,
    ingest0: 200,
    title: 'Tier the storage',
    kicker: 'Retention economics',
    desc: 'You can’t keep everything on SSD forever. Recent data lives in a hot tier (fast, expensive); older data ages to cheap object storage (slow to query). The retention slider sets where the line falls — and it’s a direct trade of query latency against monthly bill.',
    nodes: ['agents', 'gw', 'buffer', 'idx', 'hot', 'cold', 'dash', 'query'],
    idx: 6,
    controls: { ingest: true, tiering: true },
    routes: (s) => ({
      log: ['agents', 'gw', 'buffer', 'idx', 'hot'],
      metric: ['agents', 'gw', 'buffer', 'idx', 'hot'],
      trace: ['agents', 'gw', 'buffer', 'idx', 'hot'],
      // s.cacheHit carries "hot share": that fraction of queries hit the fast tier
      query: Math.random() < s.cacheHit ? ['dash', 'query', 'hot'] : ['dash', 'query', 'cold'],
    }),
    goals: [
      { id: 'cold', label: 'Shrink the hot window (hot share ≤ 40%)', done: (g) => g.c.hotShare <= 40 },
      { id: 'slow', label: 'Feel the cold-query tax (p95 over 700 ms)', done: (g) => g.c.hotShare <= 40 && g.p95 > 700 },
      { id: 'balance', label: 'Trim retention to cut the bill (≤ 30 days)', done: (g) => g.c.retention <= 30 },
    ],
    tip: {
      h: 'Hot is fast and dear; cold is cheap and slow',
      p: 'Queries over the hot tier return in milliseconds; queries that reach object storage scan far more, far slower. Retention length and hot-window size are the two dials, and both are really the same dial: how much are you willing to pay to keep old data instantly searchable? Ingest volume × retention is the bill.',
    },
  },
  {
    n: 6,
    ingest0: 160,
    title: 'Federate & meter',
    kicker: 'Multi-tenant bulkheads',
    desc: 'One shared cluster means one team’s log storm is everyone’s outage. Split into per-team clusters and put an ingest quota in front of each. Now a runaway logger fills its own quota and gets throttled — the blast radius stops at the team that caused it.',
    nodes: ['agents', 'gw', 'buffer', 'idx', 'hot', 'dash', 'query'],
    idx: 6,
    controls: { ingest: true, clusters: true, quota: true },
    routes: () => ({
      log: ['agents', 'gw', 'buffer', 'idx', 'hot'],
      metric: ['agents', 'gw', 'buffer', 'idx', 'hot'],
      trace: ['agents', 'gw', 'buffer', 'idx', 'hot'],
      query: ['dash', 'query', 'hot'],
    }),
    goals: [
      { id: 'fed', label: 'Federate into 3+ clusters', done: (g) => g.c.clusters >= 3 },
      { id: 'quota', label: 'Turn on per-team ingest quotas', done: (g) => g.c.quota },
      { id: 'contain', label: 'Storm at 20k+ stays contained (drops under 3%)', done: (g) => g.c.quota && g.c.clusters >= 3 && g.c.ingest >= 340 && g.dropPct < 3 },
    ],
    tip: {
      h: 'Quotas convert a shared outage into a local one',
      p: 'Without metering, ingest is a commons: the noisiest team consumes the capacity everyone paid for, and the memory/disk pressure freezes the whole cluster. Per-team quotas (and separate clusters for the big tenants) are the bulkhead — the same lesson as RabbitMQ vhosts and Kafka multi-cluster federation.',
    },
  },
]

/* ---------------------------------------------------------------
   Control state, moved out of the page component because it is model
   rather than view: stage defaults and the cost estimate are pure
   functions of the mission definition, and nothing could test them
   while they sat in a React file next to a canvas.
   --------------------------------------------------------------- */

export interface Controls {
  ingest: number // traffic units
  queryShare: number // percent
  indexers: number
  cardinality: number // percent
  hotShare: number // percent
  retention: number // days
  clusters: number
  quota: boolean
}

export function defaultsFor(stageIdx: number, prev?: Controls): Controls {
  const st = STAGES[stageIdx]
  return {
    ingest: prev?.ingest ?? 48,
    queryShare: prev?.queryShare ?? 15,
    indexers: st.idx ?? 2,
    cardinality: 0,
    hotShare: 85,
    retention: 90,
    clusters: 1,
    quota: false,
  }
}

/* ------------------------------------------------------------------
   The monthly bill.

   Every constant here is ASSUMED — a plausible order of magnitude, not a
   quote, and unlike the physics elsewhere on this site a price list stops
   being true the day a vendor changes it. So they are named and dated
   rather than buried inline, and the page says "assumed" out loud.

   The durable part is not the dollars, it is the SHAPE: hot storage is
   roughly 10x cold, so the retention slider and the hot-share slider move
   the bill far more than the ingest rate does once you are past a few
   weeks. That ratio survives repricing; the absolute numbers will not.
   ------------------------------------------------------------------ */
export const COST = {
  /** what one event costs to store, before any indexing overhead */
  bytesPerEvent: 500,
  /** $/GB ingested — the shape of managed log pricing, not a quote */
  ingestPerGB: 0.1,
  /** $/GB-month on SSD-backed hot storage */
  hotPerGBMo: 0.03,
  /** $/GB-month on object storage. ~10x cheaper: the whole point of tiering */
  coldPerGBMo: 0.003,
  /** when these were last eyeballed against public list prices */
  asOf: '2026-08',
} as const

/** Rough monthly bill, in DOLLARS. Ingest + tiered storage. */
export function estCostUSD(eventsPerSec: number, retention: number, hotShare: number): number {
  const gbPerDay = (eventsPerSec * 86400 * COST.bytesPerEvent) / 1e9
  const ingestMo = gbPerDay * 30 * COST.ingestPerGB
  const stored = gbPerDay * retention // retention is in days
  const hotGB = (stored * hotShare) / 100
  const coldGB = stored - hotGB
  return ingestMo + hotGB * COST.hotPerGBMo + coldGB * COST.coldPerGBMo
}

/** Dollars, at whatever magnitude they land — `$664`, `$12k`, `$1.2M`. */
export function fmtUSD(dollars: number): string {
  if (dollars >= 1e6) return '$' + (dollars / 1e6).toFixed(1) + 'M'
  if (dollars >= 1e4) return '$' + Math.round(dollars / 1e3) + 'k'
  if (dollars >= 1e3) return '$' + (dollars / 1e3).toFixed(1) + 'k'
  return '$' + Math.round(dollars)
}
