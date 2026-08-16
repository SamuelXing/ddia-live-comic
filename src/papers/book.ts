/**
 * Book B — the papers storybook. One constant to rename when the title is
 * finally chosen; everything (nav brand, masthead, document titles) reads it
 * from here.
 *
 * Season 1 table of contents. The reviewed plan (notes/2026-08-11-wide-column-
 * retro.md §11): history as the spine, one forcing event per chapter, papers
 * as answer keys. Chapters ship one at a time; `slug` appears when a chapter
 * goes live, and the index renders the rest as the season's map — the reader
 * should see the shape of the whole story from day one.
 */
export const BOOK = {
  title: 'The Papers That Broke the Database',
  short: 'The Papers',
  season: 'Season 1 · Where Data Lives',
  dek: 'Follow the history of distributed systems, and dig deep into the papers that made it.',
}

export interface TocEntry {
  no: string
  title: string
  paper?: string
  slug?: string
  /** an interlude is a half-chapter — comic-style, no paper to read */
  interlude?: boolean
}

export interface TocAct {
  act: string
  /** key into ACT_FIGURES (src/papers/actDiagrams.tsx) — the act's picture */
  figure: string
  /**
   * The act in a paragraph. Rule for this copy: state the PRESSURE and the
   * SHAPE, never the mechanism. The book's method is that the reader designs
   * the answer before reading the paper, so an act summary that says "and so:
   * vector clocks" has spent the chapter before it starts. Paper names are
   * already in the rows below; techniques are not.
   */
  summary: string
  /** the hinge — the pressure that forces the next act. Sets up the reader. */
  next: string
  entries: TocEntry[]
}

/**
 * How far the season has got, derived rather than typed. Three places carried
 * "1 of 18" by hand and all three were wrong the moment Chapter 1 shipped —
 * the fourth hand-maintained tally in this project to go stale, after the
 * comics count, the ideas count and /ddia/read's own description.
 *
 * Read off the TOC, not off the chapter registry: TOC rows are plain data, so
 * a page can show the count without pulling every chapter's JSX into its
 * bundle. Interludes are half-chapters with no paper and are not counted.
 * `book.test.ts` pins both ends — a slug here must resolve to a real chapter,
 * and a real chapter must appear here.
 */
export const seasonProgress = () => {
  const chapters = TOC.flatMap((a) => a.entries).filter((e) => !e.interlude)
  return { live: chapters.filter((e) => e.slug).length, total: chapters.length }
}

/**
 * Interludes are pages, and they are deliberately *not* chapters. They carry a
 * slug like any other live page, and counting them would make "4 of 18" drift
 * away from a table of contents that plainly numbers eighteen chapters. So both
 * halves of the fraction skip them, and a test pins that — this is the kind of
 * line someone later reads as an off-by-one and helpfully breaks.
 */

/** e.g. "2 of 18 chapters live" */
export const progressLabel = () => {
  const { live, total } = seasonProgress()
  return `${live} of ${total} chapters live`
}

export const TOC: TocAct[] = [
  {
    act: 'Prologue',
    figure: 'prologue',
    summary:
      'For about thirty years the answer to almost any data question was one machine running one database, and it was a good answer. The relational model, B-trees underneath it, transactions that either happened or did not. It all fit on one disk, under one clock. Every promise the rest of this book gives up gets made here first.',
    next: 'Next: the web arrives, and it does not fit.',
    entries: [{ no: 'Ch 0', title: 'One Machine Was Enough', paper: 'Codd 1970 · B-trees 1970 · Gray on transactions' }],
  },
  {
    act: 'Act I · The Web Breaks the Box',
    figure: 'i',
    summary:
      'Google has more web than fits on any machine you can buy, and the machines it can afford die weekly. What falls out of that is a file system that replicates well, appends well, and refuses to edit a byte you already wrote. The rest of the act is people working around that refusal. By the end there is a database sitting on a file system that cannot overwrite anything — and the bargain it struck to get there is what your database is doing tonight.',
    next: 'Next: all of it has a master. Amazon is about to call that unacceptable.',
    entries: [
      { no: 'Ch 1', title: 'The File System That Refused to Edit', paper: 'GFS — SOSP 2003', slug: 'gfs' },
      { no: 'Ch 2', title: 'MapReduce: the Pattern, Not the Product', paper: 'OSDI 2004 · a half-chapter', slug: 'mapreduce' },
      { no: 'Ch 3', title: 'The Database GFS Deserved', paper: 'Bigtable — OSDI 2006', slug: 'bigtable' },
      { no: '—', title: 'Interlude: The RUM Triangle', interlude: true, slug: 'rum' },
      { no: 'Ch 4', title: 'The Lock Everyone Was Secretly Holding', paper: 'Chubby — OSDI 2006', slug: 'chubby' },
    ],
  },
  {
    act: 'Act II · Availability at Any Cost',
    figure: 'ii',
    summary:
      'Amazon’s problem is not the size of the web, it is the checkout button. A cart that refuses a write because some machine in the middle is unreachable has already cost real money, and nobody is soothed by an explanation about network partitions. So this act throws out the thing Act I hung its whole hierarchy on: the master. Every node accepts writes, from anyone, during the failure. You get a store that never says no, and no idea which of two conflicting carts is the real one.',
    next: 'Next: two nodes accepted the same cart. Which one happened later? Nobody in this act can say.',
    entries: [
      { no: 'Ch 5', title: 'The Cart That Must Not Close', paper: 'Dynamo — SOSP 2007', slug: 'dynamo' },
      { no: '—', title: 'Interlude: CAP', interlude: true, slug: 'cap' },
      { no: 'Ch 6', title: 'A Marriage of Two Papers', paper: 'Cassandra — 2008' },
    ],
  },
  {
    act: 'Act III · Agreement (a flashback)',
    figure: 'iii',
    summary:
      'We have been leaning on this the whole time without looking at it. Chubby held Bigtable’s master election back in Act I; the ring in Act II came apart at exactly the point where it had no way to agree. So the book goes back to 1978 and asks the embarrassing question underneath both: on machines with separate clocks, what does “before” even mean? Then it watches a group of computers settle on one value while some of them have crashed and the rest cannot tell which.',
    next: 'Next: with agreement in hand, you can start buying back what Act I sold.',
    entries: [
      { no: 'Ch 7', title: 'What "Before" Even Means', paper: 'Time, Clocks — Lamport 1978' },
      { no: 'Ch 8', title: 'Consensus, Twice Told', paper: 'Paxos 1998 · Raft 2014' },
      { no: 'Ch 9', title: 'Consensus as a Service', paper: 'ZooKeeper — USENIX ATC 2010' },
    ],
  },
  {
    act: 'Act IV · Buying the Promises Back',
    figure: 'iv',
    summary:
      'Act I gave up transactions across rows because there was nobody in the building who could coordinate them. Now there is. This act is two attempts at putting the promise back on top of a system that never offered it. The first does it in software, in a client library, on machines nobody upgraded. The second gives up on software and buys hardware — clocks good enough that a database can know how wrong it is and simply wait that long.',
    next: 'Next: both of them are really just being careful about the order writes happened in. What if the order were the database?',
    entries: [
      { no: 'Ch 10', title: 'Transactions, Hand-Rolled', paper: 'Percolator — OSDI 2010' },
      { no: 'Ch 11', title: 'Paying for Time with Hardware', paper: 'Spanner — OSDI 2012' },
    ],
  },
  {
    act: 'Act V · The Log Is the Database',
    figure: 'v',
    summary:
      'Every system so far has a write-ahead log inside it, treated as plumbing — the boring file you replay after a crash. This act turns it around and makes the log the real record. The table, the cache, the search index become readers that have fallen behind by different amounts. Believe that and a cache is a derived copy with a staleness bug, a database is a log with a query engine bolted on the side, and the interesting question stops being where data lives and becomes how far behind it is.',
    next: 'Next: one of those readers does not want one row. It wants one column of a billion rows.',
    entries: [
      { no: 'Ch 12', title: 'The Most Common Derived Copy', paper: 'Scaling Memcache — NSDI 2013' },
      { no: 'Ch 13', title: 'Write Once, Replay Everywhere', paper: 'Kafka 2011 · "The Log" 2013' },
      { no: 'Ch 14', title: 'The Log Made Literal', paper: 'Aurora — SIGMOD 2017' },
    ],
  },
  {
    act: 'Act VI · The Analytics Divorce',
    figure: 'vi',
    summary:
      'Everything up to here has been tuned for finding a record. But another question was always in the building: not “what is in this order” but “what did we sell in Ontario last March”. That one reads a single field out of every row, and every layout in Act I is wrong for it. So the data gets turned ninety degrees, stored by column instead of by row — and the split turns permanent. Two systems, two copies of everything, and a pipeline between them that becomes somebody’s entire job.',
    next: 'Next: twenty years on, the two families that split in Act II start to look like each other again.',
    entries: [
      { no: 'Ch 15', title: 'Reading Sideways', paper: 'C-Store 2005 · Dremel 2010' },
      { no: 'Ch 16', title: 'Elasticity as the Product', paper: 'Snowflake — SIGMOD 2016' },
    ],
  },
  {
    act: 'Epilogue',
    figure: 'epilogue',
    summary:
      'DynamoDB in 2022 shares a name with the 2007 paper and not much else. The ring that was proud of having no leader now runs one per partition group, watches for heat and splits ranges under load, and will sell you a strongly consistent read if you ask. Meanwhile the range-partitioned side spent the same decade growing the availability tricks it once refused. Nobody announced it, but the argument that started in Act II ended in a draw.',
    next: 'That is Season 1. Season 2 is what happens when the data stops sitting still.',
    entries: [{ no: 'Ch 17', title: 'The Retreat', paper: 'DynamoDB — USENIX ATC 2022' }],
  },
]
