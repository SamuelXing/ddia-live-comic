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
    desc: 'The arcane ideas of distributed systems, each drawn as a short comic built around one misconception it exists to kill.',
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
  '/papers/gfs': {
    title: 'The File System That Refused to Edit',
    desc: 'Google’s machines die weekly and its files outgrew every disk. Design the file system that falls out of that — then read the 2003 paper and see how close you got.',
  },
  '/papers/mapreduce': {
    title: 'MapReduce: the Pattern, Not the Product',
    desc: 'The famous half was borrowed from Lisp. The half that mattered was the restriction — work out what a program must give up before a framework can recover it for you.',
  },
  '/papers/rum': {
    title: 'Interlude: The RUM Triangle',
    desc: 'Reads, updates, space — hold two down and the third goes up. The axis every storage argument in this book runs along, named once so the rest can stop re-arguing it.',
  },
  '/papers/chubby': {
    title: 'The Lock Everyone Was Secretly Holding',
    desc: 'Every system in Act I has one master and none of the papers say who appoints it. Work out who does — then find out why the contribution was the packaging, not the algorithm.',
  },
  '/papers/consensus': {
    title: 'Consensus, Twice Told',
    desc: 'One algorithm, two papers, sixteen years apart. The first was correct and nobody could implement it — so the second optimised for something almost no algorithms paper measures.',
  },
  '/papers/zookeeper': {
    title: 'Consensus as a Service',
    desc: 'Almost nobody should implement consensus. Here is how everybody gets it anyway — and the three places this design deliberately disagrees with Chubby.',
  },
  '/papers/lamport': {
    title: 'What “Before” Even Means',
    desc: 'Two machines, two events, no shared clock — and the 1978 paper that defines “happened before” by declining to answer the question you asked.',
  },
  '/papers/cassandra': {
    title: 'A Marriage of Two Papers',
    desc: 'Take Dynamo’s ring and Bigtable’s storage engine and you have Cassandra. What it refused to take — and why a mechanism that was right one chapter ago is unaffordable here.',
  },
  '/papers/cap': {
    title: 'Interlude: CAP',
    desc: 'The most cited result in distributed systems, and the one most often quoted wrong. The proof is a paragraph — and the question it forgets to ask is the one you live in.',
  },
  '/papers/dynamo': {
    title: 'The Cart That Must Not Close',
    desc: 'Amazon will not let a shopping cart refuse a write, so the master goes. Design the store that falls out of that — then find out who has to decide which of two carts is real.',
  },
  '/papers/percolator': {
    title: 'Transactions, Hand-Rolled',
    desc: 'You need a transaction across five rows. The store gives you one row and will not be changed. Work out where the commit point can possibly live — then read the 2010 paper.',
  },
  '/papers/spanner': {
    title: 'Paying for Time with Hardware',
    desc: 'Chapter 7 proved you cannot observe a global order of events. This paper agrees, then buys one — with a clock that admits how wrong it is, and a database willing to wait that long.',
  },
  '/papers/memcache': {
    title: 'The Most Common Derived Copy',
    desc: 'You have a cache. It is a replica of your database with no replication protocol — work out what keeps it honest, then find out where the answer actually comes from.',
  },
  '/papers/kafka': {
    title: 'Write Once, Replay Everywhere',
    desc: 'A modest 2011 paper about a fast message queue, and a 2013 blog post that reframed the same system as the abstraction underneath everything else.',
  },
  '/papers/aurora': {
    title: 'The Log Made Literal',
    desc: 'Stop writing pages entirely, ship only the redo log, and let the storage tier work out what the pages should say. The paper’s own section heading: “The Log Is the Database.”',
  },
  '/papers/columnar': {
    title: 'Reading Sideways',
    desc: 'Every layout in this book was built to find a record. Now somebody wants one field out of a billion of them — which means turning the data ninety degrees and rebuilding the database around it.',
  },
  '/papers/snowflake': {
    title: 'Elasticity as the Product',
    desc: 'Build the analytical half again for a world where machines are rented by the second — and find out that the thing customers are buying is not the query engine.',
  },
  '/papers/season/2': {
    title: 'Season 2 · When the Data Stops Sitting Still',
    desc: 'The delay between something happening and somebody being able to see it — and what each way of shortening it costs. Thirteen papers on data in motion.',
  },
  '/papers/season-1': {
    title: 'The Season, in One Page',
    desc: 'Seventeen papers, and the same three moves under all of them. What the acts add up to, and the ideas that cross every one of them without getting a chapter of their own.',
  },
  '/papers/dynamodb': {
    title: 'The Retreat',
    desc: 'The same building, the same name, and almost none of the same architecture. What Amazon walked back after a decade of running it \u2014 and the thing that turned out to matter more than any of it.',
  },
  '/papers/bigtable': {
    title: 'The Database GFS Deserved',
    desc: 'Google has to store the web on a file system that can’t edit a byte. Design your way out first — then see how close you got to the LSM tree.',
  },

  '/papers/spark': {
    title: 'The Cost of Starting Over',
    desc: 'The job is correct and it runs for six hours, and nine tenths of that is reading back what it just wrote. Keeping it in memory was obvious \u2014 making the memory survive a dead machine was not.',
  },

  '/papers/naiad': {
    title: 'One Engine, Both Shapes',
    desc: 'A loop that never finishes, over input that never stops, answering questions from the middle of it. No system could do all three \u2014 and the reason was what a timestamp is allowed to be.',
  },

  '/papers/structured-streaming': {
    title: 'The Same Query, Twice a Second',
    desc: 'Two chapters of engines, and the hard part turned out to be who has to understand them. Write the query you would have written for a finished table, and let the planner do the rest.',
  },

  '/papers/millwheel': {
    title: 'One Record at a Time, Forever',
    desc: 'A search happened at 09:14 and reached you at 13:40. Here is the system that stopped treating arrival order as event order, and worked out what it costs to know you have everything.',
  },

  '/papers/three-times': {
    title: 'Interlude: The Three Times',
    desc: 'Event time, processing time, ingestion time. Picking the wrong one gives answers that are not wrong so much as about something else \u2014 and only one of them can be computed twice.',
  },
  '/papers/dataflow': {
    title: 'When It Happened, and When You Heard',
    desc: 'The same authors, two years on, opening with a sentence that contradicts their own previous paper: never rely on any notion of completeness. What replaced it is the vocabulary this field now uses.',
  },
  '/papers/flink-snapshots': {
    title: 'A Photograph of a Moving System',
    desc: 'Three chapters of machinery, all of it state, and a machine about to die holding it. The answer is a marker walking the graph \u2014 a thirty-year-old algorithm with its most expensive part removed.',
  },

  '/papers/differential': {
    title: 'Change as the Unit of Work',
    desc: 'Incremental computation has stopped at loops since the eighties, and not for want of engineering: versions were modelled as a line. Index them by a partial order instead.',
  },
  '/papers/noria': {
    title: 'The Read Path as a Graph',
    desc: 'Nearly every request is a read, answered by running the same query over data that has not moved. What a backend looks like if the queries are left running instead.',
  },
  '/papers/dbsp': {
    title: 'Incremental by Construction',
    desc: 'Forty years of incremental view maintenance produced one algorithm per class of query. This one produces a procedure \u2014 and machine-checks the whole theory in five thousand lines.',
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

/* ---------------------------------------------------------------------------
   Social cards.

   A legacy alias points at the SAME entry object as its /ddia twin, so identity
   already knows which paths are one page — no second list to keep in step. One
   card per distinct object; both scripts derive the filename from here so the
   renderer and the emitter cannot disagree about what a page's picture is.
   --------------------------------------------------------------------------- */

/** A route's card filename, without extension. `/` is `home`. */
export function cardName(path) {
  return path === '/' ? 'home' : path.replace(/^\//, '').replace(/\//g, '-')
}

const CARD_OF = new Map()
{
  const paths = new Map()
  for (const [path, entry] of Object.entries(ROUTES)) {
    if (!paths.has(entry)) paths.set(entry, [])
    paths.get(entry).push(path)
  }
  for (const [entry, ps] of paths) {
    // longest path wins: `/ddia/read/x` names the file, its legacy `/read/x`
    // twin borrows it, so moving a page does not orphan its card
    const canonical = [...ps].sort((a, b) => b.length - a.length)[0]
    for (const p of ps) CARD_OF.set(p, cardName(canonical))
    void entry
  }
}

/** The card a route shares, by entry identity. */
export function cardFor(path) {
  return CARD_OF.get(path)
}

/** Every distinct card, as [name, entry, canonicalPath]. */
export function cards() {
  const seen = new Map()
  for (const [path, entry] of Object.entries(ROUTES)) {
    const name = CARD_OF.get(path)
    if (!seen.has(name)) seen.set(name, { name, entry, path })
    else if (path.length > seen.get(name).path.length) seen.set(name, { name, entry, path })
  }
  return [...seen.values()]
}

/** Full document title for a route entry. */
export function fullTitle(entry) {
  return entry?.title ? `${entry.title} · ${SITE_TITLE}` : `${SITE_TITLE} — books with working parts`
}
