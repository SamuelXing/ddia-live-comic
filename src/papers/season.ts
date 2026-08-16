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

export const ARC: ArcRow[] = [
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
 * One line per live page, keyed by slug — the argument, not the summary.
 * Interludes included: they are pages a reader walks through.
 */
export const CHAPTER_LINES: Record<string, string> = {
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
