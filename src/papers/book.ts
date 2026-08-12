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
  entries: TocEntry[]
}

export const TOC: TocAct[] = [
  {
    act: 'Prologue',
    entries: [{ no: 'Ch 0', title: 'One Machine Was Enough', paper: 'Codd 1970 · B-trees 1970 · Gray on transactions' }],
  },
  {
    act: 'Act I · The Web Breaks the Box',
    entries: [
      { no: 'Ch 1', title: 'The File System That Refused to Edit', paper: 'GFS — SOSP 2003' },
      { no: 'Ch 2', title: 'MapReduce: the Pattern, Not the Product', paper: 'OSDI 2004 · a half-chapter' },
      { no: 'Ch 3', title: 'The Database GFS Deserved', paper: 'Bigtable — OSDI 2006', slug: 'bigtable' },
      { no: '—', title: 'Interlude: The RUM Triangle', interlude: true },
      { no: 'Ch 4', title: 'The Lock Everyone Was Secretly Holding', paper: 'Chubby — OSDI 2006' },
    ],
  },
  {
    act: 'Act II · Availability at Any Cost',
    entries: [
      { no: 'Ch 5', title: 'The Cart That Must Not Close', paper: 'Dynamo — SOSP 2007' },
      { no: '—', title: 'Interlude: CAP', interlude: true },
      { no: 'Ch 6', title: 'A Marriage of Two Papers', paper: 'Cassandra — 2008' },
    ],
  },
  {
    act: 'Act III · Agreement (a flashback)',
    entries: [
      { no: 'Ch 7', title: 'What "Before" Even Means', paper: 'Time, Clocks — Lamport 1978' },
      { no: 'Ch 8', title: 'Consensus, Twice Told', paper: 'Paxos 1998 · Raft 2014' },
      { no: 'Ch 9', title: 'Consensus as a Service', paper: 'ZooKeeper — USENIX ATC 2010' },
    ],
  },
  {
    act: 'Act IV · Buying the Promises Back',
    entries: [
      { no: 'Ch 10', title: 'Transactions, Hand-Rolled', paper: 'Percolator — OSDI 2010' },
      { no: 'Ch 11', title: 'Paying for Time with Hardware', paper: 'Spanner — OSDI 2012' },
    ],
  },
  {
    act: 'Act V · The Log Is the Database',
    entries: [
      { no: 'Ch 12', title: 'The Most Common Derived Copy', paper: 'Scaling Memcache — NSDI 2013' },
      { no: 'Ch 13', title: 'Write Once, Replay Everywhere', paper: 'Kafka 2011 · "The Log" 2013' },
      { no: 'Ch 14', title: 'The Log Made Literal', paper: 'Aurora — SIGMOD 2017' },
    ],
  },
  {
    act: 'Act VI · The Analytics Divorce',
    entries: [
      { no: 'Ch 15', title: 'Reading Sideways', paper: 'C-Store 2005 · Dremel 2010' },
      { no: 'Ch 16', title: 'Elasticity as the Product', paper: 'Snowflake — SIGMOD 2016' },
    ],
  },
  {
    act: 'Epilogue',
    entries: [{ no: 'Ch 17', title: 'The Retreat', paper: 'DynamoDB — USENIX ATC 2022' }],
  },
]
