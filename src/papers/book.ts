/**
 * Book B — the papers storybook. One constant to rename when the title is
 * finally chosen; everything (nav brand, masthead, document titles) reads it
 * from here.
 *
 * Chapters ship one at a time; `slug` appears when a chapter goes live, and the
 * index renders the rest as the map — the reader should see the shape of the
 * whole story from day one, holes included.
 *
 * Seasons are LATER ACTS OF THE SAME BOOK, not new books, which is why chapter
 * numbers run straight on: Season 2 opens at Ch 18. Restarting at Ch 1 would
 * read better on a poster and make "Chapter 5" mean two things — and this book
 * cross-references bare chapter numbers in prose constantly, where a wrong one
 * is invisible to every tool. It has already happened once.
 */
export const BOOK = {
  title: 'The Papers That Broke the Database',
  short: 'The Papers',
  dek: 'Follow the history of distributed systems, and dig deep into the papers that made it.',
}

export interface TocEntry {
  no: string
  title: string
  paper?: string
  slug?: string
  /** an interlude is a half-chapter — comic-style, no paper to read */
  interlude?: boolean
  /**
   * What to print where the paper would go, for a live row that has no paper.
   * Without it the contents label every paperless page "interlude", which is
   * right for the RUM triangle and wrong for the season close.
   */
  note?: string
}

/**
 * A season: a run of acts with one question under them. The label is what a
 * chapter prints above its title, so it has to read as a place in the book
 * rather than as a marketing tier.
 */
export interface Season {
  n: number
  /** e.g. "Season 1 · Where Data Lives" */
  label: string
  /** the season's own question, in a sentence, above its acts on the index */
  dek: string
  acts: TocAct[]
}

export interface TocAct {
  act: string
  /**
   * Key into ACT_FIGURES (src/papers/actDiagrams.tsx) — the act's picture.
   * Optional, and absent on The Close: the opener block exists to set up an
   * act's pressure before you read it, and the close has no pressure to set
   * up. It reads the other acts. Giving it a figure and a hinge line dressed
   * a summary as a seventh instalment.
   */
  figure?: string
  /**
   * The act in a paragraph. Rule for this copy: state the PRESSURE and the
   * SHAPE, never the mechanism. The book's method is that the reader designs
   * the answer before reading the paper, so an act summary that says "and so:
   * vector clocks" has spent the chapter before it starts. Paper names are
   * already in the rows below; techniques are not.
   */
  summary?: string
  /** the hinge — the pressure that forces the next act. Sets up the reader. */
  next?: string
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
 * The same count for one season, so the shelf can list them separately. The
 * rule lives here rather than at the call site because it has one subtlety —
 * interludes are pages and are not chapters — and a second copy of that rule
 * somewhere else is a second place for it to drift.
 */
export const progressOf = (s: Season) => {
  const chapters = s.acts.flatMap((a) => a.entries).filter((e) => !e.interlude)
  return { live: chapters.filter((e) => e.slug).length, total: chapters.length }
}

/**
 * Interludes are pages, and they are deliberately *not* chapters. They carry a
 * slug like any other live page, and counting them would make "4 of 18" drift
 * away from a table of contents that plainly numbers eighteen chapters. So both
 * halves of the fraction skip them, and a test pins that — this is the kind of
 * line someone later reads as an off-by-one and helpfully breaks.
 */

/**
 * "17 chapters live" — deliberately no longer a fraction.
 *
 * It used to read "17 of 18", which is arithmetically right and reads as an
 * off-by-one to everybody, because the chapters are numbered from Ch 0 and the
 * last one is Ch 17. A reader counts the highest number they can see and finds
 * the total one larger. The fraction was answering a question nobody asked; the
 * useful facts are how much there is to read, and what is still missing — so
 * those are now two separate labels that say what they mean.
 */
export const progressLabel = () => `${seasonProgress().live} chapters live`

/**
 * The other half of that pair: what is still missing. Kept as its own label
 * for the reason above — "23 of 31" invites arithmetic and reads as an
 * off-by-one; two plain statements do not.
 */
export const remainingLabel = () => {
  const { live, total } = seasonProgress()
  return `${total - live} still to write`
}


const SEASON_1_ACTS: TocAct[] = [
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
      { no: 'Ch 6', title: 'A Marriage of Two Papers', paper: 'Cassandra — LADIS 2009', slug: 'cassandra' },
    ],
  },
  {
    act: 'Act III · Agreement (a flashback)',
    figure: 'iii',
    summary:
      'We have been leaning on this the whole time without looking at it. Chubby held Bigtable’s master election back in Act I; the ring in Act II came apart at exactly the point where it had no way to agree. So the book goes back to 1978 and asks the embarrassing question underneath both: on machines with separate clocks, what does “before” even mean? Then it watches a group of computers settle on one value while some of them have crashed and the rest cannot tell which.',
    next: 'Next: with agreement in hand, you can start buying back what Act I sold.',
    entries: [
      { no: 'Ch 7', title: 'What “Before” Even Means', paper: 'Time, Clocks — Lamport 1978', slug: 'lamport' },
      { no: 'Ch 8', title: 'Consensus, Twice Told', paper: 'Paxos 1998 · Raft 2014', slug: 'consensus' },
      { no: 'Ch 9', title: 'Consensus as a Service', paper: 'ZooKeeper — USENIX ATC 2010', slug: 'zookeeper' },
    ],
  },
  {
    act: 'Act IV · Buying the Promises Back',
    figure: 'iv',
    summary:
      'Act I gave up transactions across rows because there was nobody in the building who could coordinate them. Now there is. This act is two attempts at putting the promise back on top of a system that never offered it. The first does it in software, in a client library, on machines nobody upgraded. The second gives up on software and buys hardware — clocks good enough that a database can know how wrong it is and simply wait that long.',
    next: 'Next: both of them are really just being careful about the order writes happened in. What if the order were the database?',
    entries: [
      { no: 'Ch 10', title: 'Transactions, Hand-Rolled', paper: 'Percolator — OSDI 2010', slug: 'percolator' },
      { no: 'Ch 11', title: 'Paying for Time with Hardware', paper: 'Spanner — OSDI 2012', slug: 'spanner' },
    ],
  },
  {
    act: 'Act V · The Log Is the Database',
    figure: 'v',
    summary:
      'Every system so far has a write-ahead log inside it, treated as plumbing — the boring file you replay after a crash. This act turns it around and makes the log the real record. The table, the cache, the search index become readers that have fallen behind by different amounts. Believe that and a cache is a derived copy with a staleness bug, a database is a log with a query engine bolted on the side, and the interesting question stops being where data lives and becomes how far behind it is.',
    next: 'Next: one of those readers does not want one row. It wants one column of a billion rows.',
    entries: [
      { no: 'Ch 12', title: 'The Most Common Derived Copy', paper: 'Scaling Memcache — NSDI 2013', slug: 'memcache' },
      { no: 'Ch 13', title: 'Write Once, Replay Everywhere', paper: 'Kafka 2011 · "The Log" 2013', slug: 'kafka' },
      { no: 'Ch 14', title: 'The Log Made Literal', paper: 'Aurora — SIGMOD 2017', slug: 'aurora' },
    ],
  },
  {
    act: 'Act VI · The Analytics Divorce',
    figure: 'vi',
    summary:
      'Everything up to here has been tuned for finding a record. But another question was always in the building: not “what is in this order” but “what did we sell in Ontario last March”. That one reads a single field out of every row, and every layout in Act I is wrong for it. So the data gets turned ninety degrees, stored by column instead of by row — and the split turns permanent. Two systems, two copies of everything, and a pipeline between them that becomes somebody’s entire job.',
    next: 'Next: twenty years on, the two families that split in Act II start to look like each other again.',
    entries: [
      { no: 'Ch 15', title: 'Reading Sideways', paper: 'C-Store 2005 · Dremel 2010', slug: 'columnar' },
      { no: 'Ch 16', title: 'Elasticity as the Product', paper: 'Snowflake — SIGMOD 2016', slug: 'snowflake' },
    ],
  },
  {
    act: 'Epilogue',
    figure: 'epilogue',
    summary:
      'DynamoDB in 2022 shares a name with the 2007 paper and not much else. The ring that was proud of having no leader now runs one per partition group, watches for heat and splits ranges under load, and will sell you a strongly consistent read if you ask. Meanwhile the range-partitioned side spent the same decade growing the availability tricks it once refused. Nobody announced it, but the argument that started in Act II ended in a draw.',
    next: 'That is Season 1. Season 2 is what happens when the data stops sitting still.',
    entries: [{ no: 'Ch 17', title: 'The Retreat', paper: 'DynamoDB — USENIX ATC 2022', slug: 'dynamodb' }],
  },
  {
    act: 'The Close',
    entries: [
      {
        no: '—',
        title: 'The Season, in One Page',
        interlude: true,
        note: 'the close · no new paper',
        slug: 'season-1',
      },
    ],
  },
]

const SEASON_2_ACTS: TocAct[] = [
  {
    act: 'Act I · Nobody Wants to Wait Until Morning',
    figure: 's2i',
    summary:
      'The batch job is correct and it takes six hours, and it takes six hours again tomorrow for a day that differs by one per cent. Worse, anything iterative — and most useful analysis is iterative — writes the whole intermediate result to disk and reads it back on every pass, because the only thing the machinery trusts is a file. This act is about keeping the middle of the computation in memory without giving up the one property that made batch worth having: that a machine can die and nobody has to care.',
    next: 'Next: the answers arrive in seconds now, and some of the events they were counting arrive after them.',
    entries: [
      { no: 'Ch 18', title: 'The Cost of Starting Over', paper: 'Spark / RDDs — NSDI 2012', slug: 'spark' },
      { no: 'Ch 19', title: 'One Engine, Both Shapes', paper: 'Naiad — SOSP 2013', slug: 'naiad' },
      { no: 'Ch 20', title: 'The Same Query, Twice a Second', paper: 'Structured Streaming — SIGMOD 2018', slug: 'structured-streaming' },
    ],
  },
  {
    act: 'Act II · Time Is Not When It Arrived',
    figure: 's2ii',
    summary:
      'A phone was in a tunnel. The purchase happened at 09:14 and reaches you at 13:40, long after you published the total for the morning and told everyone it was final. Every system so far has quietly assumed that the order things arrive in is the order they happened in, and at this speed that assumption stops being harmless. The act is about the gap between those two clocks: how long you wait for stragglers, what you promise before they arrive, and what you owe anyone you already answered.',
    next: 'Next: the answer is a few seconds old, and somebody asks why it is recomputed at all.',
    entries: [
      { no: 'Ch 21', title: 'One Record at a Time, Forever', paper: 'MillWheel — VLDB 2013', slug: 'millwheel' },
      { no: '—', title: 'Interlude: The Three Times', interlude: true, slug: 'three-times' },
      { no: 'Ch 22', title: 'When It Happened, and When You Heard', paper: 'The Dataflow Model — VLDB 2015', slug: 'dataflow' },
      { no: 'Ch 23', title: 'A Photograph of a Moving System', paper: 'Flink snapshots — 2015', slug: 'flink-snapshots' },
    ],
  },
  {
    act: 'Act III · The Answer That Maintains Itself',
    figure: 's2iii',
    summary:
      'Ten thousand people load the same dashboard and the same query runs ten thousand times over data that barely moved. The whole industry answers this with caches and a prayer about invalidation, which Chapter 12 already showed is the hard part. This act takes the other road: treat a change as the thing being computed, so the result is updated rather than recomputed, and reads become a lookup into an answer that was already maintained for you.',
    next: 'Next: all of it assumes there is a network. Not everyone has one.',
    entries: [
      { no: 'Ch 24', title: 'Change as the Unit of Work', paper: 'Differential Dataflow — CIDR 2013', slug: 'differential' },
      { no: 'Ch 25', title: 'The Read Path as a Graph', paper: 'Noria — OSDI 2018', slug: 'noria' },
      { no: 'Ch 26', title: 'Incremental by Construction', paper: 'DBSP — VLDB 2023', slug: 'dbsp' },
    ],
  },
  {
    act: 'Act IV · Everybody’s Copy Is Live',
    figure: 's2iv',
    summary:
      'Two people edit the same document on a train with no signal. Nothing in this book so far can help: there is no quorum to reach, no leader to ask, and the writes are already committed on the devices that made them. Chapter 5 asked who writes the merge function and handed the question to the application. This act answers it properly — pick data types whose merge is forced by the shape of the data, and convergence stops being anybody’s judgement call.',
    next: 'Next: look at what you have assembled across four acts, and notice what it is.',
    entries: [
      { no: 'Ch 27', title: 'Who Writes the Merge Function', paper: 'CRDTs — SSS 2011', slug: 'crdt' },
      { no: 'Ch 28', title: 'The Network Is Optional', paper: 'Local-First — Onward! 2019 · a half-chapter', slug: 'local-first' },
    ],
  },
  {
    act: 'Epilogue · What You Were Building All Along',
    figure: 's2epi',
    summary:
      'Two endings that pull in opposite directions, which is the honest state of the argument. One puts a single storage layer under batch, streaming and interactive queries, and quietly undoes the split Act VI spent a whole act creating. The other says the pieces were never meant to be reassembled at all — that a log, an index, a cache and a query engine, wired together by hand, are a database with the lid off, and that you have been building one for four acts without being told.',
    next: 'Then the season on one page. After that, nothing anybody has decided yet.',
    entries: [
      { no: 'Ch 29', title: 'Sewing It Back Together', paper: 'Delta Lake — VLDB 2020', slug: 'delta' },
      {
        no: 'Ch 30',
        title: 'The Database, With the Lid Off',
        paper: 'Kafka, Samza & the Unix Philosophy — 2015',
        slug: 'unbundling',
      },
    ],
  },
  {
    /* Same shape as Season 1's close, and unwritten on purpose while the
       epilogue lands — the season's argument ends on a disagreement, and a
       one-page summary of a disagreement is a harder page than it looks.

       Named with the season on it because act names are unique across the
       whole TOC — a chapter's masthead is looked up by act, so two acts
       called "The Close" would put a Season 2 page under Season 1's heading,
       which is the bug book.test.ts refuses to let back in. */
    act: 'The Close · Season 2',
    entries: [
      {
        no: '—',
        title: 'The Season, in One Page',
        interlude: true,
        note: 'the close · no new paper',
      },
    ],
  },
]

/**
 * The book, in seasons. Both are visible from day one for the same reason the
 * unwritten chapters are: the shape of the argument is the thing worth seeing
 * first, and a map with holes in it is more honest than no map.
 */
export const SEASONS: Season[] = [
  {
    n: 1,
    label: 'Season 1 · Where Data Lives',
    dek: 'Seventeen papers on where the bytes sit, how many copies of them exist, and who is allowed to decide what happened. It starts with a company that cannot fit its data on one machine and ends with one that could not fit its database in its engineers’ heads — and in between, the same move over and over: **hit a wall, give up a guarantee to get past it, then spend a decade buying it back in a currency you can afford.**',
    acts: SEASON_1_ACTS,
  },
  {
    n: 2,
    label: 'Season 2 · When the Data Stops Sitting Still',
    dek: 'Season 1 asked where data lives, and every answer assumed the data is at rest and a query comes to visit it. **This one turns that around: the query holds still and the data moves through it.** The thing being traded stops being consistency against availability and becomes *freshness* — against cost, against being right about events that arrive late, against how much state you are willing to keep hot. Most of the machinery is already in this book. It gets pointed the other way.',
    acts: SEASON_2_ACTS,
  },
]

/** Every act in the book, in reading order. What most callers want. */
export const TOC: TocAct[] = SEASONS.flatMap((s) => s.acts)

/**
 * Where a season's contents page lives. Season 1 keeps the bare `/papers`
 * because it is the book's front door — it is in the nav, on the shelf card,
 * in social cards and in cross-links from chapters, and redirecting it away to
 * make the URLs symmetrical would be tidiness paid for by every one of those.
 * `routes.test.ts` pins these against the route table.
 */
export const seasonPath = (n: number) => (n === 1 ? '/papers' : `/papers/season/${n}`)

/** Which season an act belongs to. Act names are unique across the book, and
 *  `book.test.ts` keeps them that way — this lookup is why. */
export const seasonOfAct = (act: string): Season | undefined =>
  SEASONS.find((s) => s.acts.some((a) => a.act === act))

/**
 * Which season a chapter belongs to, by slug. Read off the TOC and not off the
 * chapter registry, deliberately: the nav asks this on every page, and the
 * registry imports every chapter's JSX. TOC rows are plain data.
 */
export const seasonOfSlug = (slug: string): Season | undefined =>
  SEASONS.find((s) => s.acts.some((a) => a.entries.some((e) => e.slug === slug)))

/**
 * Where "← All chapters" points from a given path under /papers.
 *
 * It used to be the literal `/papers`, which is Season 1's contents — so
 * finishing a Season 2 chapter walked you back into the wrong season's table
 * of contents, and the only clue was that the acts were unfamiliar. The season
 * is a property of the chapter you are reading, so it is read off the slug.
 *
 * Null on a season's own contents page: the brand is already the way up there,
 * and a link across to the other season would be a sideways jump wearing an
 * upward label. The season tabs are what crosses between them.
 */
export const chaptersBackPath = (path: string): string | null => {
  if (!path.startsWith('/papers')) return null
  const p = path.replace(/\/$/, '')
  /* `/papers/season/` with the slash, not the bare prefix. Season 1's close
     page is the chapter `season-1`, so a prefix test on "/papers/season"
     swallows it and leaves that page with no way back at all — which is
     exactly what it did, until the test below said so. */
  if (p === '/papers' || p === '/papers/season' || p.startsWith('/papers/season/')) return null
  return seasonPath(seasonOfSlug(p.slice('/papers/'.length))?.n ?? 1)
}
