/**
 * The material the season close is built from — the last chapter of the
 * Epilogue, /papers/season-1, plus two things that live elsewhere.
 *
 * ARC and THREADS render inside that chapter (via SeasonBlocks.tsx): the acts
 * as the trade each one made, and the ideas that cross acts without ever
 * owning a chapter. CHAPTER_LINES goes somewhere else entirely — one line
 * under each row of the table of contents, so the map says what a chapter
 * claims and not only what it is called. The forward-look that used to sit at the
 * foot of the contents is gone: Season 2 has its own header there now, which
 * says the same thing in the place a reader is already looking.
 *
 * All of it is plain data keyed by chapter slug, so `season.test.ts` can pin
 * both directions: every live page has a line here, and every line here names
 * a page that exists. The prose is hand-written on purpose — a summary
 * generated from the deks would only repeat the deks.
 */

/** One act, as the move it makes: a wall, a guarantee sold, and the bill. */
export interface ArcRow {
  act: string
  /** the limit that forced it */
  wall: string
  /** the guarantee given up to get past the wall */
  gave: string
  /** what that bought */
  got: string
  /** and what it cost, which is always the next act's problem */
  cost: string
}

/** Season 1's ledger: one move repeated — sell a guarantee, buy it back later. */
export const ARC: ArcRow[] = [
  {
    act: 'Prologue',
    wall: 'Ten million records on a disc that takes fifty milliseconds to answer, and a room of people who will still be writing programs against that data in twenty years.',
    gave: 'Any prospect of the data outgrowing one machine. Every guarantee here is defined in terms of one clock, one memory and one disc.',
    got: 'Ask by describing instead of navigating, an index four seeks deep over two hundred million keys, and changes that either all happen or leave no trace.',
    cost: 'A ceiling — roughly a hundred and fifty transactions a second and a hundred gigabytes. Nobody minded for thirty years, and then somebody wanted a copy of the web.',
  },
  {
    act: 'Act I · The Web Breaks the Box',
    wall: 'More web than fits on any machine you can buy, running on hardware that dies weekly.',
    gave: 'The ability to edit a byte you have already written.',
    got: 'A file system that replicates and appends cheaply, and a database willing to live on it.',
    cost: 'Everything above it has to be append-only too — which is why your database is compacting at three in the morning.',
  },
  {
    act: 'Act II · Availability at Any Cost',
    wall: 'A checkout button that must not refuse a write while some machine in the middle is unreachable.',
    gave: 'The master, and with it the single place that decided what happened first.',
    got: 'A store that never says no, through failures the previous act would have stalled on.',
    cost: 'Two carts and no way to say which is real. The merge became the application’s job.',
  },
  {
    act: 'Act III · Agreement (a flashback)',
    wall: 'Both previous acts were leaning on agreement without ever looking at it.',
    gave: 'The assumption that “before” means anything on machines with separate clocks.',
    got: 'A group of computers settling on one value while some of them are dead and the rest cannot tell which.',
    cost: 'A majority has to be reachable, and every decision costs a round trip to it.',
  },
  {
    act: 'Act IV · Buying the Promises Back',
    wall: 'The index Act I gave up transactions for kept going quietly wrong.',
    gave: 'Latency — twice, in two entirely different currencies.',
    got: 'Transactions across rows, on storage that was never designed to offer them.',
    cost: 'Percolator runs each document through the crawler far slower than the batch it replaced; Spanner waits out its own clock error on every commit.',
  },
  {
    act: 'Act V · The Log Is the Database',
    wall: 'Every derived copy — cache, search index, warehouse — had drifted from every other one.',
    gave: 'The database as the primary artifact.',
    got: 'One ordered record of what happened, and every store as a reader of it at its own lag.',
    cost: 'Nothing is current any more, only less behind — and staleness became a number somebody has to name out loud.',
  },
  {
    act: 'Act VI · The Analytics Divorce',
    wall: '“What did we sell in Ontario last March” reads one field out of every row there is.',
    gave: 'Storing a record’s fields next to each other.',
    got: 'Scans that open two columns out of two hundred and leave the rest shut.',
    cost: 'A second system, a second copy of everything, and a pipeline between them that becomes somebody’s entire job.',
  },
  {
    act: 'Epilogue',
    wall: 'Nobody wanted to operate it. Amazon’s own engineers picked the service that fitted worse.',
    gave: 'The leaderless write — the exact thing Act II had paid so much to get.',
    got: 'A database that hundreds of thousands of strangers run without knowing a word of this book.',
    cost: 'A partition can be unavailable now, and every mechanism above moved behind a wall somebody still has to see through at 3am.',
  },
]

/**
 * Season 2's ledger, and it is not the same argument. These rows read as a
 * ladder rather than as one move repeated: each act removes one delay between
 * something happening and somebody being able to see it, and every one of them
 * is billed in the same currency — state that has to be kept hot, in four
 * different disguises. The epilogue row is the only one in either season that
 * holds two answers instead of one, because that is what the epilogue does.
 */
export const ARC_S2: ArcRow[] = [
  {
    act: 'Act I · Nobody Wants to Wait Until Morning',
    wall: 'A correct answer that takes six hours, produced again tomorrow for a day that differs by one per cent — and every iterative pass writing the whole intermediate result to disk and reading it back.',
    gave: 'Materialising the middle of the computation.',
    got: 'The intermediate results held in memory, with recovery by keeping the recipe rather than the dish.',
    cost: 'Memory becomes the resource that runs out, and the recipe is a graph that grows until somebody decides where to cut it.',
  },
  {
    act: 'Act II · Time Is Not When It Arrived',
    wall: 'Records turn up late and out of order, and nothing in a stream ever says that was the last one.',
    gave: 'The idea that a result is final.',
    got: 'Answers keyed to when things happened rather than when they arrived, emitted before the input is complete and corrected afterwards.',
    cost: 'Windows held open for data that might still come, and a watermark that is a bet — placed by somebody, in public, on how late is late enough.',
  },
  {
    act: 'Act III · The Answer That Maintains Itself',
    wall: 'Ten thousand dashboards running the same query over data that barely moved, and a cache in front of it whose invalidation nobody gets right.',
    gave: 'Recomputing. The query stops being something you run and becomes something that is running.',
    got: 'Reads that are a lookup into an answer already maintained, updated by the change rather than by the data.',
    cost: 'Every difference kept and indexed instead of folded away, and a maintained view that can outgrow the tables it was derived from.',
  },
  {
    act: 'Act IV · Everybody’s Copy Is Live',
    wall: 'Two people editing one document on a train, with the writes already committed on devices that cannot reach each other.',
    gave: 'The authority. No leader, no quorum, nobody to ask.',
    got: 'Convergence forced by the shape of the data, so a replica alone in a tunnel is correct rather than degraded.',
    cost: 'A change history nobody may truncate, because somebody could reconnect after six months — and semantics that are still a person’s decision, made once when the type is designed.',
  },
  {
    act: 'Epilogue · What You Were Building All Along',
    wall: 'Four acts of parts, wired together by hand. Nobody ever sat down and decided to build a database this way.',
    gave: 'Nothing yet — this is the row where the season stops agreeing with itself.',
    got: 'Two answers. Put a commit log under one storage layer and the parts fit back together; or accept that the parts were never going to merge, and standardise the seam between them.',
    cost: 'A few commits a second and no transaction spanning two tables — or stale reads, work reprocessed after a crash, and no optimiser that can see across the seam.',
  },
]

/** Both ledgers, by season. The close pages read this; the tests walk it. */
export const ARC_BY_SEASON: Record<number, ArcRow[]> = { 1: ARC, 2: ARC_S2 }

/**
 * One line per live page, keyed by slug — the argument, not the summary.
 * Interludes included: they are pages a reader walks through.
 */
export const CHAPTER_LINES: Record<string, string> = {
  prologue: 'Three ideas from around 1970 that the whole book spends — describe rather than navigate, index wide enough to beat the disc, and all-or-nothing.',
  gfs: 'A file system that refuses to edit, and a decade of systems built around the refusal.',
  mapreduce: 'The part worth keeping is not the API. It is that computation moves to the data, and that failure is handled by doing the work again.',
  bigtable: 'A sorted map with no joins — and the bargain your database is still making tonight: writes go to memory and a log, reads pay for it later.',
  rum: 'Read, update, memory. Every access method minimises two of them and sends you the bill for the third.',
  chubby: 'Nobody wanted a lock service. They wanted a name, a config file and an election, and this is where all three quietly went.',
  dynamo: 'Removing the master removed a wait, not a question. Somebody still has to say which cart is the real one.',
  cap: 'The theorem everybody cites and almost nobody states correctly, and the much smaller thing it actually forbids.',
  cassandra: 'Dynamo’s ring carrying Bigtable’s column model — two papers married, and the most-deployed system in the book.',
  lamport: 'Before you can order events you have to say what order means, and on separate clocks the honest answer is only a partial one.',
  consensus: 'The same algorithm told twice, and the second telling won because people could follow it.',
  zookeeper: 'Consensus as something you call rather than something you implement, and the small API that made it usable.',
  percolator: 'Transactions across rows, hand-rolled in a client library, on a storage system nobody was allowed to change.',
  spanner: 'Buy clocks good enough to know how wrong they are, then wait that long. Uncertainty stopped being hidden and started being paid for.',
  memcache: 'A cache is a replica with no replication protocol, which is why invalidation is the hard part and always was.',
  kafka: 'Stop treating the log as plumbing. It is the record, and the database is one of the things reading it.',
  aurora: 'Ship the redo log and nothing else, and let the storage tier work out for itself what the pages should say.',
  columnar: 'Turn the data ninety degrees and a scan gets cheap — until you ask for dozens of fields, and then it stops being cheap.',
  snowflake: 'Compute that owns nothing can be made for one job and destroyed after it, which turned wall-clock time into something you buy.',
  dynamodb: 'Fifteen years on, the retreat — and the discovery that the arguments the field was having were not the ones the operators were having.',
  'season-1': 'The whole season on one page: the three moves every act makes, and the ideas that cross all of them without owning a chapter.',
  spark: 'Nobody made memory reliable. They made reliability cheap enough to stop caring — by storing the recipe instead of the dish.',
  naiad: 'Batch and streaming were never two workloads. They were two corners of one grid, kept apart by a timestamp too small to say where you are.',
  'structured-streaming': 'Write the query you would have written for a finished table, and let the planner work out the incremental version — because almost nobody gets that right by hand.',
  millwheel: 'Nothing in a stream says “that was the last one.” So compute it — the oldest unfinished work anywhere behind you — and accept that the answer is a bet.',
  'three-times': 'Three clocks, and only one of them lets you compute the same answer twice from the same input. That is why event time is not a preference.',
  dataflow: 'Never rely on completeness. Split the decision into where data is grouped, when you speak, and what a later answer does to an earlier one.',
  'flink-snapshots': 'A thirty-year-old algorithm with its expensive half deleted — because in a dataflow graph, what is on the wires is a consequence rather than a fact.',
  differential: 'Incremental computation stops at loops because versions were modelled as a line. Index them by a partial order and one edge leaving a day of Twitter costs 67 differences.',
  noria: 'Compile every query into one running graph, so writes update the answers and reads are lookups. The state does not fit, so keep only what somebody asked for.',
  dbsp: 'Forty years of one algorithm per class of query, replaced by five mechanical steps — and semi-naive evaluation falls out of them as a corollary nobody designed.',
  crdt: 'Chapter 5 handed the merge function to the application and it was wrong in public. Make the data type such that no reconciliation is expressible, and it cannot be.',
  'local-first': 'The server holds the primary copy, so an edit that has not reached it did not happen. Swap that, and six properties you gave up for collaboration come back.',
  delta: 'Half of one company’s support escalations were people asking how to undo a crashed job. Demote the data objects to candidates and let a log say which of them count.',
  unbundling: 'Nobody is going to ship the one database, because the workloads want different layouts. So standardise the seam between the systems instead of merging them.',
  'season-2': 'Four acts, four ways of shortening the delay, and one bill under all of them — plus an ending the season does not resolve, because the field has not.',
}

/** An idea that crosses acts without ever getting a chapter of its own. */
export interface Thread {
  name: string
  body: string
  /** chapter slugs where it surfaces, in reading order */
  chapters: string[]
}

export const THREADS: Thread[] = [
  {
    name: 'The log is the real artifact',
    body: 'It arrives as plumbing — the boring file you replay after a crash — and by the end of the book it is the primary record. GFS made appending the cheap operation. Bigtable puts every write in a log before it touches a table. ZooKeeper’s entire protocol is an agreed order of updates. Kafka says the log is the database and everything else is a reader. Aurora ships the log and nothing else across the network. And DynamoDB checks its live data against a replica rebuilt from the log going back to the table’s first day. Nothing in this book ever got faster by writing less of it.',
    chapters: ['gfs', 'bigtable', 'zookeeper', 'kafka', 'aurora', 'dynamodb'],
  },
  {
    name: 'Granularity decides whether a failure is an outage',
    body: 'Every serious system here is willing to have a leader, and not one of them has a leader. Bigtable splits tables into tablets; Spanner runs a Paxos group per shard; Aurora cuts its volume into ten-gigabyte segments; DynamoDB runs millions of replication groups in a Region. The election is not the load-bearing decision — the size of the unit is. Choose it small enough and losing one is a partial outage; choose it large and you have rebuilt the master you spent an act escaping.',
    chapters: ['bigtable', 'spanner', 'aurora', 'dynamodb'],
  },
  {
    name: 'Every cache is a replica with no replication protocol',
    body: 'Say it that way and the hard parts stop being surprising. Invalidation is not a detail, it is the replication protocol you declined to write. Facebook’s memcache tier needed a whole invalidation pipeline read off MySQL’s commit log. Snowflake’s local SSD cache is where all its performance claims actually live, and elasticity is the practice of destroying the machines that hold it. And DynamoDB found the sharpest version: a cache with a 99.75 percent hit rate had quietly become the only reason the store behind it was survivable.',
    chapters: ['memcache', 'snowflake', 'dynamodb'],
  },
  {
    name: 'Immutability gets spent more than once',
    body: 'Write a file once and never change it, and you have not bought one property, you have bought four. A version of the data becomes a list of files rather than a state, so snapshot isolation is bookkeeping instead of locking; readers never block writers; reading the past is free; and copying a table copies a list. GFS, the SSTable, Percolator’s multi-version rows and Snowflake’s file sets are the same decision in four costumes. The bill is compaction, and compaction is always somebody’s job.',
    chapters: ['gfs', 'bigtable', 'percolator', 'snowflake'],
  },
  {
    name: 'Somebody still has to decide',
    body: 'This is the sentence the book keeps returning to. Take out the coordinator and you have removed a wait, not the question it was answering. Dynamo hands you both carts and asks you to merge them. Percolator picks one lock to be the primary and makes it the commit point. Spanner buys hardware precise enough that the decision can be made by waiting. The decision never disappears — it moves, and what changes is who makes it and how late they are allowed to be.',
    chapters: ['dynamo', 'cap', 'percolator', 'spanner'],
  },
  {
    name: 'What you hide becomes your problem',
    body: 'The last two chapters are the same argument seen from opposite ends. Snowflake removes the tuning knobs, so the system has to make those decisions well enough that nobody misses them — and every regression is now the vendor’s. DynamoDB hid partitions as an internal detail, and then partition boundaries decided whether a customer’s application worked, which could not be explained without exposing the thing that was promised not to exist. Less asked of the user is more of their problem owned by you. There is no version where the difficulty simply goes away.',
    chapters: ['snowflake', 'dynamodb'],
  },
]

/**
 * Season 2's through-lines. Same rule as season 1's — an idea that surfaces in
 * act after act without being any one paper's contribution — and deliberately
 * no overlap with the list above, even where a season 1 thread does resurface.
 * "The log is the real artifact" comes back hard in the epilogue, and it is
 * already written; repeating it here would make this list look longer than it
 * is.
 */
export const THREADS_S2: Thread[] = [
  {
    name: 'Freshness is bought with state you keep hot',
    body: 'Four acts, four mechanisms, one bill. Spark keeps the middle of the computation resident and recovers by replaying the recipe. The windowing work holds a window open for arrivals that may never come. Differential dataflow keeps every difference indexed by version instead of folding it away, and measured its own index at a few per cent on top of the data — resident, deserialized, and not spillable. The convergent types keep a change history nobody may truncate because a collaborator might return after six months. Every rung down the ladder is paid for in memory that cannot be spilled, and it is worth noticing that not one of these papers frames it that way.',
    chapters: ['spark', 'dataflow', 'differential', 'local-first'],
  },
  {
    name: 'Nothing ever says that was the last one',
    body: 'A batch job knows its input is complete because somebody closed the file. Nothing else in this season does. MillWheel computes the oldest unfinished work anywhere behind it and calls that the answer, while being explicit that it is a bet. The Dataflow model gives up on completeness as a concept and splits the question into three — where data is grouped, when you speak, and what a later answer does to an earlier one. Flink’s snapshots work because in a dataflow graph what is on the wires is a consequence rather than a fact. **The advances in this season are mostly better ways of being honest about not knowing**, not better ways of knowing.',
    chapters: ['millwheel', 'dataflow', 'flink-snapshots'],
  },
  {
    name: 'Recovery by replay, not by copying',
    body: 'Ask any of these systems what happens when a machine dies and the answer is the same: read something back. Spark stores the lineage rather than the data and recomputes the lost partition. Flink takes a snapshot without stopping anything and restarts from it. A Samza task rebuilds its local store by replaying its own compacted changelog. Delta Lake’s reader reconstructs the current table from a checkpoint plus the records after it. The shared premise is that **history is cheaper to keep than state is to protect** — and the systems that got this wrong are the ones that ended up running a second replication protocol beside the one they already had.',
    chapters: ['spark', 'flink-snapshots', 'delta', 'unbundling'],
  },
  {
    name: 'Correctness stopped meaning one answer',
    body: 'Season 1 argued about which answer was right. Season 2 mostly stops asking. The Dataflow model emits a result and then refines it, so a consumer has to know whether a later answer replaces the earlier one or adds to it. Convergent data types guarantee that replicas agree and say nothing about what they should agree on — concurrent add and remove has four convergent answers and picking one is a person’s job. A stream processor that restarts from a checkpoint processes some messages twice, and a non-idempotent counter comes out slightly wrong. *In each case the honest move was to name what is being promised instead of widening the word "correct" until it covered it.*',
    chapters: ['dataflow', 'crdt', 'unbundling'],
  },
  {
    name: 'The machine is built first, and the language arrives later',
    body: 'It happens three times here and nobody comments on it. Structured Streaming exists because writing the incremental version of a query by hand is a thing almost nobody gets right, so you write the batch query and let the planner do it. DBSP arrives a decade into incremental view maintenance and supplies the procedure that forty years of one-algorithm-per-query-class never produced. And the Kafka paper’s own limitations section says the one-message-at-a-time model is error-prone and hard to optimise, with a declarative interface listed as work in progress. **The declarative layer is not the beginning of a field, it is a late symptom of one** — and its arrival is the clearest sign the machinery underneath has stopped moving.',
    chapters: ['structured-streaming', 'dbsp', 'unbundling'],
  },
  {
    name: 'The partition key is still deciding everything',
    body: 'Chapter 6 said the partition key is a schema decision you cannot take back, and Season 2 keeps proving it in new places. MillWheel’s key is the unit of state and of ordering, so it fixes what may be aggregated together. Noria shards its operator graph, and a query whose key does not match the sharding pays for a shuffle on every write. Samza requires both sides of a join to be partitioned the same way into the same number of partitions, and joining on a second key means a whole extra stage. Two decades and four architectures later, **the earliest and least reversible decision is still the same one.**',
    chapters: ['millwheel', 'noria', 'unbundling'],
  },
]

/** Both lists, by season — same shape as ARC_BY_SEASON, and walked by the tests. */
export const THREADS_BY_SEASON: Record<number, Thread[]> = { 1: THREADS, 2: THREADS_S2 }
