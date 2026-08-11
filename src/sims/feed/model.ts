/* ============================================================
   Feed at Scale — domain model.
   Node templates (queueing stations), request types, and the
   six-stage architecture ladder. Pure data: the engine consumes it.
   ============================================================ */

export type ReqType = 'read' | 'post' | 'like' | 'media'

export const REQ: Record<ReqType, { label: string; color: string }> = {
  read: { label: 'read timeline', color: '#3987e5' },
  post: { label: 'post', color: '#e5533b' },
  like: { label: 'like', color: '#e6a72a' },
  media: { label: 'media upload', color: '#37b6c4' },
}

export const FANOUT_COLOR = '#c07fe0'

/* Node shape and roles are the engine's, not this sim's — both sims draw the
   same kinds of station on the same canvas. */
export type { Role, NodeTpl } from '../engine'
import type { NodeTpl } from '../engine'

/* Node templates. kind drives capacity behaviour; slots = instances × slotsPer;
   capacity(units/s) = slots ÷ (serviceMs/1000).
   serviceMs is never below the engine's SUB_MS (25 ms) so one slot completes
   at most one request per sub-step — honest throughput ceilings. */
export const TEMPLATES: Record<string, NodeTpl> = {
  users: { id: 'users', label: 'Users', role: 'src', col: 0 },
  edge: { id: 'edge', label: 'CDN / Edge', kind: 'edge', role: 'edge', col: 1, instances: 1, slotsPer: 200, serviceMs: 25 },
  lb: { id: 'lb', label: 'Load Balancer', kind: 'stateless', role: 'net', col: 2, instances: 1, slotsPer: 400, serviceMs: 25 },
  gw: { id: 'gw', label: 'API Gateway', kind: 'stateless', role: 'web', col: 3, instances: 2, slotsPer: 8, serviceMs: 90, scalable: 'web' },
  svcTL: { id: 'svcTL', label: 'Timeline svc', kind: 'stateless', role: 'svc', col: 4, instances: 2, slotsPer: 8, serviceMs: 40, scalable: 'web' },
  svcPost: { id: 'svcPost', label: 'Post svc', kind: 'stateless', role: 'svc', col: 4, instances: 1, slotsPer: 8, serviceMs: 40, scalable: 'web' },
  svcInt: { id: 'svcInt', label: 'Interaction svc', kind: 'stateless', role: 'svc', col: 4, instances: 1, slotsPer: 8, serviceMs: 40, scalable: 'web' },
  svcMedia: { id: 'svcMedia', label: 'Media svc', kind: 'stateless', role: 'svc', col: 4, instances: 1, slotsPer: 8, serviceMs: 80, scalable: 'web' },
  svcFan: { id: 'svcFan', label: 'Fan-out svc', kind: 'fanout', role: 'svc', col: 4, instances: 1, slotsPer: 6, serviceMs: 40 },
  redis: { id: 'redis', label: 'Redis', kind: 'redis', role: 'cache', col: 5, instances: 1, slotsPer: 15, serviceMs: 25 },
  kafka: { id: 'kafka', label: 'Kafka', kind: 'kafka', role: 'queue', col: 5, instances: 1, slotsPer: 40, serviceMs: 25 },
  pgP: { id: 'pgP', label: 'Postgres primary', kind: 'pgP', role: 'db', col: 5, instances: 1, slotsPer: 12, serviceMs: 100 },
  pgR: { id: 'pgR', label: 'Read replicas', kind: 'pgR', role: 'db', col: 5, instances: 1, slotsPer: 12, serviceMs: 90, scalable: 'replica' },
  s3: { id: 's3', label: 'S3 object store', kind: 's3', role: 'store', col: 6, instances: 1, slotsPer: 400, serviceMs: 60 },
  mono: { id: 'mono', label: 'App + DB + cache\n(one host)', kind: 'mono', role: 'mono', col: 3, instances: 1, slotsPer: 16, serviceMs: 100 },
}

export interface StageControls {
  web?: boolean
  replica?: boolean
  cache?: boolean
  partitions?: boolean
  shards?: boolean
  celeb?: boolean
  regions?: boolean
  repl?: boolean
}

/** What goal predicates can see: live node stats + current knob values. */
export interface GoalCtx {
  util: (id: string) => number
  qdepth: (id: string) => number
  dropPct: number
  regions: number
  regionsAlive: number
  c: {
    traffic: number
    writeShare: number
    cacheHit: number
    web: number
    replicas: number
    partitions: number
    pgShards: number
    redisShards: number
    celeb: boolean
    regions: number
    repl: number
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
  /** Web-tier instances this stage starts with (later stages assume web already scaled). */
  web?: number
  map?: boolean
  controls: StageControls
  routes: (s: { cacheHit: number }) => Partial<Record<ReqType, string[]>>
  goals: Goal[]
  tip: { h: string; p: string; try: string }
}

export const STAGES: StageDef[] = [
  {
    n: 1,
    title: 'Single box',
    kicker: 'Vertical scaling',
    desc: 'Everything — web app, database, cache — on one machine. Push the traffic up and watch one shared pool of slots saturate and take down every request type at once.',
    nodes: ['users', 'mono'],
    controls: { celeb: false },
    routes: () => ({
      read: ['users', 'mono'],
      post: ['users', 'mono'],
      like: ['users', 'mono'],
      media: ['users', 'mono'],
    }),
    goals: [
      { id: 'push', label: 'Push traffic past 10k req/s', done: (g) => g.c.traffic >= 170 },
      { id: 'sat', label: 'Saturate the box (≥ 95% busy)', done: (g) => g.util('mono') >= 0.95 },
      { id: 'drop', label: 'Watch requests start dropping', done: (g) => g.dropPct >= 2 },
    ],
    tip: {
      h: 'The vertical wall',
      p: 'One host means shared fate: reads, writes and uploads all compete for the same CPU. You can only make the box bigger, and there is a biggest box. It is also a single point of failure — hit “Fail a node”.',
      try: 'Raise <b>traffic</b> until the box glows red, then note you have no knob left except a bigger box.',
    },
  },
  {
    n: 2,
    title: 'Split & load-balance',
    kicker: 'Horizontal web tier',
    desc: 'Break the monolith into services behind a load balancer and clone the stateless web tier. Reads AND writes still hit the single Postgres primary — so watch the database become the bottleneck the web tier can’t fix.',
    nodes: ['users', 'lb', 'gw', 'svcTL', 'svcPost', 'svcInt', 'pgP'],
    web: 2,
    controls: { web: true },
    routes: () => ({
      read: ['users', 'lb', 'gw', 'svcTL', 'pgP'],
      post: ['users', 'lb', 'gw', 'svcPost', 'pgP'],
      like: ['users', 'lb', 'gw', 'svcInt', 'pgP'],
      media: ['users', 'lb', 'gw', 'svcInt', 'pgP'],
    }),
    goals: [
      { id: 'maxweb', label: 'Max out web instances (16+)', done: (g) => g.c.web >= 16 },
      { id: 'wall', label: 'Postgres pegged ≥ 90% while the gateway idles under 50%', done: (g) => g.util('pgP') >= 0.9 && g.util('gw') <= 0.5 },
    ],
    tip: {
      h: 'Cloning the web tier stops helping',
      p: 'Adding API-gateway instances scales compute linearly — but every request still funnels into one Postgres primary. Once the DB is the bottleneck, more web instances just pile up in its queue.',
      try: 'Crank <b>web instances</b> to max. The gateway goes green while <b>Postgres</b> stays red — proof the wall moved to the database.',
    },
  },
  {
    n: 3,
    title: 'Cache + read replicas',
    kicker: 'Scale the read path',
    desc: 'Reads are ~80% of a feed. Put a Redis timeline cache in front and stream to Postgres read replicas. Now reads scale out — but every write still funnels to the one primary, and cloning the web tier fans out DB connections.',
    nodes: ['users', 'lb', 'gw', 'svcTL', 'svcPost', 'svcInt', 'redis', 'pgR', 'pgP'],
    web: 4,
    controls: { web: true, replica: true, cache: true },
    routes: (s) => ({
      read:
        Math.random() < s.cacheHit
          ? ['users', 'lb', 'gw', 'svcTL', 'redis']
          : ['users', 'lb', 'gw', 'svcTL', 'redis', 'pgR'],
      post: ['users', 'lb', 'gw', 'svcPost', 'pgP'],
      like: ['users', 'lb', 'gw', 'svcInt', 'redis', 'pgP'],
      media: ['users', 'lb', 'gw', 'svcInt', 'pgP'],
    }),
    goals: [
      { id: 'starve', label: 'Starve the cache (hit rate ≤ 60%)', done: (g) => g.c.cacheHit <= 60 },
      { id: 'absorb', label: 'Replicas absorb the misses (≥ 55% busy)', done: (g) => g.util('pgR') >= 0.55 },
      { id: 'writes', label: 'Writes to 40%+ — the primary reddens anyway', done: (g) => g.c.writeShare >= 40 && g.util('pgP') >= 0.85 },
    ],
    tip: {
      h: 'Reads scale, writes don’t',
      p: 'Cache hits never touch the DB; misses hit a replica. Reads now scale with cache-hit-rate and replica count. But posts and likes still write to the single primary — that path is untouched.',
      try: 'Lower <b>cache hit rate</b> to send reads to the DB, or raise <b>writes</b> (post/like share) to push the primary toward its wall.',
    },
  },
  {
    n: 4,
    title: 'Event-driven fan-out',
    kicker: 'Kafka + async timelines',
    desc: 'A post publishes an event to Kafka; a fan-out service consumes it and writes the post into each follower’s cached timeline. This absorbs spikes and pre-computes reads — but consumer parallelism is capped by partition count, and a celebrity post fans out to millions.',
    nodes: ['users', 'lb', 'gw', 'svcTL', 'svcPost', 'svcInt', 'kafka', 'svcFan', 'redis', 'pgP'],
    web: 6,
    controls: { web: true, cache: true, partitions: true, celeb: true },
    routes: () => ({
      read: ['users', 'lb', 'gw', 'svcTL', 'redis'],
      post: ['users', 'lb', 'gw', 'svcPost', 'pgP', 'kafka'], // kafka spawns fan-out
      like: ['users', 'lb', 'gw', 'svcInt', 'redis', 'pgP'],
      media: ['users', 'lb', 'gw', 'svcInt', 'redis'],
    }),
    goals: [
      { id: 'celeb', label: 'Turn on celebrity posts', done: (g) => g.c.celeb },
      { id: 'erupt', label: 'Fan-out lag erupts past 40', done: (g) => g.qdepth('svcFan') > 40 },
      { id: 'drain', label: 'Drain it: 32+ partitions, lag back under 10', done: (g) => g.c.partitions >= 32 && g.qdepth('svcFan') < 10 },
    ],
    tip: {
      h: 'Fan-out & the celebrity problem',
      p: 'Each post explodes into many timeline writes. Too few Kafka partitions caps the fan-out service and lag piles up. A celebrity’s post fans out to a huge audience at once — a burst no partition count fully tames.',
      try: 'Turn on <b>celebrity posts</b> and watch the fan-out queue erupt. Then raise <b>Kafka partitions</b> to add consumer parallelism and drain it.',
    },
  },
  {
    n: 5,
    title: 'Shard the write path',
    kicker: 'Horizontal writes',
    desc: 'The last single-node wall is the write primary. Shard Postgres by user_id and run Redis as a cluster, and writes finally scale out across nodes. The costs: cross-shard queries get expensive, and a single hot key still lands on one shard.',
    nodes: ['users', 'lb', 'gw', 'svcTL', 'svcPost', 'svcInt', 'kafka', 'svcFan', 'redis', 'pgP'],
    web: 8,
    controls: { web: true, cache: true, partitions: true, shards: true, celeb: true },
    routes: () => ({
      read: ['users', 'lb', 'gw', 'svcTL', 'redis'],
      post: ['users', 'lb', 'gw', 'svcPost', 'pgP', 'kafka'],
      like: ['users', 'lb', 'gw', 'svcInt', 'redis', 'pgP'],
      media: ['users', 'lb', 'gw', 'svcInt', 'redis'],
    }),
    goals: [
      { id: 'shard', label: 'Shard Postgres ×4 or more', done: (g) => g.c.pgShards >= 4 },
      { id: 'hold', label: 'Push traffic past 15k — the write path holds', done: (g) => g.c.traffic >= 250 && g.c.pgShards >= 4 && g.util('pgP') <= 0.8 },
      { id: 'hotkey', label: 'Celebrity on: the hot shard still spikes', done: (g) => g.c.celeb && (g.util('redis') >= 0.75 || g.util('pgP') >= 0.75) },
    ],
    tip: {
      h: 'Writes scale — with caveats',
      p: 'Sharding multiplies write capacity by spreading user_ids across primaries. But a viral post is one key on one shard: the hot-key problem sharding can’t divide. And any query spanning shards loses single-node transactions.',
      try: 'Raise <b>DB shards</b> and <b>Redis shards</b> to clear the write bottleneck. Then enable <b>celebrity posts</b> — the hot shard still reddens.',
    },
  },
  {
    n: 6,
    title: 'Go global',
    kicker: 'Multi-region + CAP',
    desc: 'Replicate the whole stack into regions worldwide. Geo-routing sends each user to their nearest region; writes replicate across oceans with real lag, so a write in one region isn’t instantly visible in another. Kill a region and watch traffic reroute.',
    nodes: [],
    map: true,
    controls: { regions: true, repl: true },
    routes: () => ({}),
    goals: [
      { id: 'lag', label: 'Stretch replication lag past 60', done: (g) => g.c.repl >= 60 },
      { id: 'fail', label: 'Fail a region — users reroute', done: (g) => g.regionsAlive < g.regions },
      { id: 'five', label: 'Run all 5 regions', done: (g) => g.c.regions >= 5 },
    ],
    tip: {
      h: 'The speed of light is the limit',
      p: 'Now the wall is physics: cross-region replication takes tens to hundreds of ms, so regions are eventually-consistent. You trade strong consistency for latency and availability — the CAP theorem, made visible.',
      try: 'Raise <b>replication lag</b> and watch the propagation pulses stretch across the map. Hit <b>Fail a node</b> to drop a region and see users reroute.',
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
  traffic: number
  writeShare: number // percent
  cacheHit: number // percent
  web: number
  replicas: number
  partitions: number
  pgShards: number
  redisShards: number
  celeb: boolean
  regions: number
  repl: number // percent
}

export function defaultsFor(stageIdx: number, prev?: Controls): Controls {
  const st = STAGES[stageIdx]
  return {
    traffic: prev?.traffic ?? 48,
    writeShare: prev?.writeShare ?? 18,
    cacheHit: prev?.cacheHit ?? 85,
    web: st.web ?? 2,
    replicas: 2,
    partitions: 8,
    pgShards: 1,
    redisShards: 1,
    celeb: false,
    regions: 3,
    repl: 12,
  }
}
