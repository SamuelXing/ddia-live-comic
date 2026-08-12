/**
 * Route metadata — the single source for per-page <title>, description and
 * link-preview tags.
 *
 * This lives in plain .mjs, not TypeScript, because two very different things
 * need it: the running app (via Vite) and a post-build Node script that patches
 * the emitted HTML. A .ts module holding JSX-importing comics could not be read
 * by the second without a compile step.
 *
 * Comic titles are therefore duplicated from the comic files. `routes.test.ts`
 * asserts every entry still matches the comic it describes, so the duplication
 * cannot silently drift — which is the only reason it is acceptable.
 *
 * Descriptions are WRITTEN FOR A LINK PREVIEW, not copied from the page. A
 * preview has one or two lines to say why the link is worth a click; the page's
 * own opening sentence is usually the wrong shape for that.
 */

export const SITE_TITLE = 'systems comic'
export const SITE_DESC =
  'Live technical books — a comic about distributed systems, a story book about the papers behind it, more on the way. Read the idea, then push on it until it breaks.'

/** path → { title, desc }. `title` omits the site suffix; the emitter adds it. */
export const ROUTES = {
  '/': { title: null, desc: SITE_DESC },

  '/ddia': {
    title: 'DDIA, as a live comic',
    desc: 'The arcane ideas of distributed systems, drawn as comics — then pushed until they break, in deep-dives you can drag and traces that animate.',
  },

  '/ddia/read': {
    title: 'Read the ideas',
    desc: 'Eleven ideas from Designing Data-Intensive Applications, each drawn as a six-panel comic built around one misconception it exists to kill.',
  },
  '/ddia/read/tail-latency': {
    title: 'Tail Latency',
    desc: 'The average is nobody’s experience. Why 1% of requests becomes 63% of them under fan-out, and why the cache does nothing for your p99.',
  },
  '/ddia/read/storage': {
    title: 'B-trees vs LSM-trees',
    desc: 'Every database puts a key down and gets it back. The two ways of doing that on a real disk, and what each one costs you.',
  },
  '/ddia/read/replication-leader': {
    title: 'Leader & Followers',
    desc: 'One writer, many readers — the replication scheme almost everything uses, and the sharp edges that show up on failover.',
  },
  '/ddia/read/replication-lag': {
    title: 'Replication Lag',
    desc: 'Async replication is fast, and it means your followers live in the past. Read-your-writes, monotonic reads, and why each guarantee is harder than it sounds.',
  },
  '/ddia/read/replication-quorum': {
    title: 'Leaderless & Quorums',
    desc: 'No node is the boss. W + R > N buys you a fresh read — and not one thing about which of two concurrent writes is right.',
  },
  '/ddia/read/partitioning': {
    title: 'Consistent Hashing',
    desc: 'Split a dataset across many machines, then add one more. Move ~1/N of the keys instead of ~80% — and see where a balanced ring still tips over.',
  },
  '/ddia/read/partition-key': {
    title: 'Choosing the Partition Key',
    desc: 'Hash the key and range scans have to ask every machine. Sort by it and today’s partition takes every write. The choice decides which questions stay cheap — and you cannot take it back.',
  },
  '/ddia/read/transactions': {
    title: 'Isolation Levels',
    desc: 'Dirty reads, write skew and phantoms, frame by frame — and why the level names in the standard cannot be trusted.',
  },
  '/ddia/read/distributed-troubles': {
    title: 'Why It’s Hard',
    desc: 'Unreliable clocks, unreliable timeouts, and how a perfectly healthy server gets declared dead by everybody else.',
  },
  '/ddia/read/consensus': {
    title: 'Raft, Illustrated',
    desc: 'Leader election and a replicated log that survives a split vote — and what consensus actually costs on every write.',
  },
  '/ddia/read/shuffle': {
    title: 'The Shuffle',
    desc: 'A batch job is mostly not computation — it is the sort in the middle. And one hot key makes the size of your cluster irrelevant.',
  },
  '/ddia/read/stream-table': {
    title: 'Stream–Table Duality',
    desc: 'A table is what is true now; a log is everything that happened. A log is not a queue, and that is the entire trick.',
  },

  /* Book B — the papers storybook. Chapter entries are duplicated from the
     chapter files, same deal as the comics: previews need them, and a test
     keeps them honest. */
  '/papers': {
    title: 'The Papers That Broke the Database',
    desc: 'Follow the history of distributed systems, and dig deep into the papers that made it.',
  },
  '/papers/bigtable': {
    title: 'The Database GFS Deserved',
    desc: 'Google has to store the web on a file system that can’t edit a byte. Design your way out first — then see how close you got to the LSM tree.',
  },

  '/ddia/components': {
    title: 'Component deep-dives',
    desc: 'Six pieces of infrastructure taken apart: animated request traces, a hardware envelope you can drag, failure cascades, and the papers behind each one.',
  },
  '/ddia/components/kafka': {
    title: 'Kafka, taken apart',
    desc: 'The distributed log. One append-only file followed from producer to disk, the partition ceiling, and the cascade when a consumer group falls behind.',
  },
  '/ddia/components/postgres': {
    title: 'Postgres, taken apart',
    desc: 'One UPDATE from SQL text through planner, buffer pool and WAL; MVCC and vacuum; the commit-durability wall that cores cannot buy past.',
  },
  '/ddia/components/redis': {
    title: 'Redis, taken apart',
    desc: 'One command through a single-threaded event loop, fork-and-copy-on-write persistence, and the whale key that takes a shard down.',
  },
  '/ddia/components/rabbitmq': {
    title: 'RabbitMQ, taken apart',
    desc: 'Publish through exchange, binding and prefetch to an ack — plus the memory watermark, and the freeze one slow consumer can cause.',
  },
  '/ddia/components/web': {
    title: 'The web tier, taken apart',
    desc: 'A request through four queues nobody instruments, the autoscaler as a control loop with minutes of dead time, and the retry storm as a metastable failure.',
  },
  '/ddia/components/s3': {
    title: 'S3 and object storage, taken apart',
    desc: 'A GET from signature to first byte, durable-first ordering, erasure coding, and the day your key naming turns into a shard key.',
  },

  '/calculator/capacity': {
    title: 'Capacity calculator',
    desc: 'Put in a workload, get out machine counts — every number a division printed beside it, against eight ceilings derived from measured hardware constants.',
  },
  '/calculator/latency': {
    title: 'The latency budget',
    desc: 'State a p99 target and watch it get spent: physics floors, hops add, utilization multiplies, fan-out amplifies the tail. Including what will not help.',
  },

  '/ddia/apps': {
    title: 'Application simulations',
    desc: 'Whole applications you push until they break: requests as particles, queues that stack up, and a ladder of fixes that each unlock the next wall.',
  },
  '/ddia/apps/feed': {
    title: 'Feed at Scale — simulation',
    desc: 'A social feed from one box to six stages of scale. Push traffic until it breaks, then fix it: replicas, cache, fan-out, shards, regions.',
  },
  '/ddia/apps/observability': {
    title: 'Observability at Scale — simulation',
    desc: 'Logs, metrics and traces from a million agents. Buffer the firehose, scale the index tier, and hit the cardinality wall that sharding cannot climb.',
  },
}

/* The simulations moved twice — /sims/x, then /ddia/sims/x, now /ddia/apps/x.
   The generated mirror below only knows the /ddia prefix rule, so the middle
   spelling is written down here; it then gets its own /sims/x twin for free. */
ROUTES['/ddia/sims'] = ROUTES['/ddia/apps']
ROUTES['/ddia/sims/feed'] = ROUTES['/ddia/apps/feed']
ROUTES['/ddia/sims/observability'] = ROUTES['/ddia/apps/observability']

/* Legacy aliases: every /ddia/* page once lived at the same path without the
   prefix, and those URLs are in shared links and search results forever. The
   app redirects them; this mirror keeps their emitted link previews correct.
   Generated, so a new DDIA page can never forget its legacy twin. */
for (const [path, entry] of Object.entries(ROUTES)) {
  const m = path.match(/^\/ddia(\/.+)$/)
  if (m) ROUTES[m[1]] = entry
}

/** Full document title for a route entry. */
export function fullTitle(entry) {
  return entry?.title ? `${entry.title} · ${SITE_TITLE}` : `${SITE_TITLE} — books with working parts`
}
