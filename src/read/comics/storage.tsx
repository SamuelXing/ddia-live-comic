import type { Comic } from '../types'
import { AppendScanDiagram, BTreeDiagram, LsmFlowDiagram, AmplificationDiagram } from '../diagrams'

export const storage: Comic = {
  slug: 'storage',
  chapter: 'Chapter 3 · Storage & Retrieval',
  chapterNo: 'Ch 3',
  title: 'B-trees vs LSM-trees',
  dek: 'Every database does two things: put a key, get it back. How it arranges bytes on disk to make both fast splits the world into two families.',
  minutes: 5,
  caption:
    'Strip a database to its core and it’s a key-value store: `put(k, v)` and `get(k)`. The **fastest possible write** is to append to a log — but then a `get` means scanning everything. So you build an **index**, and the shape of that index is the single biggest decision an engine makes. There are two grand answers.',
  steps: [
    {
      n: 'Step 01',
      title: 'Append is fast; finding is slow',
      rung: 'Rung 1 · Intuition',
      diagram: <AppendScanDiagram />,
      body: [
        'Writing to the end of a file is the fastest thing a disk does — sequential, no seeking. But to `get(k)` you’d scan the whole log. An **index** is the extra structure you maintain on writes to make reads fast — and every index is a **write-time cost paid for read-time speed**.',
        'The two families make opposite bets on where to pay.',
      ],
    },
    {
      n: 'Step 02',
      title: 'B-tree: update in place',
      accent: 'denim',
      rung: 'Rung 2 · Mechanism',
      diagram: <BTreeDiagram />,
      body: [
        'A **B-tree** stores keys sorted, in fixed-size [[page|A fixed-size block (often 4–8 KB) that is the unit of disk I/O and caching. The B-tree is a tree of pages; you read and write whole pages at a time.]]s arranged as a shallow, wide tree. A lookup walks a handful of pages from root to leaf — **very fast, predictable reads**.',
        'A write finds the right leaf page and **modifies it in place**; if the page is full it **splits**. This is the workhorse behind Postgres, MyS/InnoDB, and most relational databases.',
      ],
    },
    {
      n: 'Step 03',
      title: 'LSM-tree: buffer, flush, compact',
      accent: 'denim',
      rung: 'Rung 2 · Mechanism',
      diagram: <LsmFlowDiagram />,
      body: [
        'An **LSM-tree** takes the opposite bet. Writes land in an in-memory **memtable** (sorted); when it fills, it’s flushed to disk as an immutable, sorted **SSTable**. Reads check the memtable, then SSTables newest-first.',
        'Files never change once written, so a background **compaction** merges them, drops overwritten keys, and keeps the count down. Behind Cassandra, RocksDB, and most write-heavy stores.',
      ],
      deeper: {
        summary: 'Why LSM reads aren’t slow: bloom filters.',
        body: [
          'A naïve LSM read might touch many SSTables. The fix is a **bloom filter** per SSTable — a tiny probabilistic bitset that answers “is key K *definitely not* here?” with no disk I/O. Most SSTables are skipped instantly, so a read usually touches the memtable plus one or two files. Compaction strategy (size-tiered vs leveled) then trades write amplification against read/space amplification.',
        ],
      },
    },
    {
      n: 'Step 04',
      title: 'The tradeoff has a name',
      accent: 'terra',
      rung: 'Rung 1 · Intuition',
      diagram: <AmplificationDiagram />,
      body: [
        'Neither wins outright — it’s **amplification**. A B-tree does more **write** work (it writes each change twice: once to the WAL, once to the page) and can leave pages partly empty. An LSM does less write work up front but pays it back in **compaction**, and a read may check several files.',
        'Rule of thumb: **B-tree for read-heavy** transactional work; **LSM for write-heavy** ingest. Same `put`/`get` interface, opposite disk bargain.',
      ],
      callout: {
        kind: 'bad',
        big: 'amplification',
        text: 'Write, read, and space amplification are the three dials. Every engine picks a point on that triangle — there is no free storage engine.',
      },
      think: {
        q: 'You’re ingesting millions of sensor readings a second and almost never read them back. You reach for a B-tree because it’s the default. What’s going to hurt?',
        a: '**One write becomes many writes to disk.** A B-tree edits a page in place — and to survive a crash it first writes the whole change to a log, *then* the page itself, and a full page has to split into two. At millions of writes a second, that pile-up (**write amplification**) is what melts the disk. An LSM just appends to memory and flushes in big sorted batches, doing the rearranging later in the background — far less disk work per write. Write-heavy, read-rarely is the exact workload it was built for.',
      },
    },
  ],
  bubbles: [
    { term: 'SSTable.', body: 'A Sorted String Table: an immutable, key-sorted file. LSM flushes and compacts these.' },
    { term: 'Compaction.', body: 'Merging SSTables in the background, dropping overwritten keys to bound file count.' },
    { term: 'Write amplification.', body: 'Bytes written to disk per byte of logical data — the cost LSM pays in compaction.' },
  ],
  inTheWild: {
    note: '4 ways the clean tradeoff gets messy on a real disk',
    points: [
      'An LSM does its cleanup — **compaction** — in the background, but that cleanup reads and rewrites gigabytes while your app is also trying to work. On a busy night you get sudden latency spikes not because a query is slow, but because compaction is hogging the disk *right then*.',
      'A B-tree deletes a row by marking space free *inside* a page, not by shrinking the file. Delete a lot and the file stays big, full of holes — your 10 GB of live data can sit inside a 40 GB file until you rebuild the index.',
      'An LSM delete doesn’t erase anything either — it writes a little “deleted” marker (a **tombstone**). Until compaction runs, the dead key still costs disk space *and* read time. Delete a million keys and reads can actually get **slower** for a while.',
      '“Use an LSM for writes” hides a dozen dials — how hard to compact, how big the memory buffer, how many levels. Set them wrong and you either burn the disk rewriting constantly or let files pile up until reads crawl. RocksDB’s famously huge config exists for exactly this.',
    ],
  },
  tradeoffs: {
    title: 'which storage engine for this workload?',
    rows: [
      { choose: 'Reach for a B-tree', when: 'reads dominate and you need steady, predictable latency — **an app’s main database, transactions**. (Postgres, MySQL/InnoDB)' },
      { choose: 'Reach for an LSM', when: 'writes pour in far faster than reads — **logs, metrics, event ingest, time-series**. (Cassandra, RocksDB)' },
      { choose: 'Go columnar', when: 'you scan huge ranges for analytics, not single rows — **dashboards, reporting**. (ClickHouse, Parquet)' },
      { choose: 'Just use the default', when: 'you’re unsure and load is modest — the engine your database ships with is tuned for the common case. **Measure before you switch.**' },
    ],
  },
  misconception: {
    think: '“LSM-trees are just the newer, better B-tree.”',
    actually:
      'Actually — neither dominates. LSM wins write throughput and space, but adds compaction CPU and can raise read/latency variance; B-trees give steadier, lower-latency reads and simpler transactions. It’s a **workload choice**, not a generational upgrade.',
  },
  sources: [
    {
      year: '1996',
      title: 'The Log-Structured Merge-Tree (LSM-Tree) — O’Neil et al.',
      url: 'https://www.cs.umb.edu/~poneil/lsmtree.pdf',
      note: 'The original LSM design: trading random writes for sequential ones.',
    },
    {
      year: '2006',
      title: 'Bigtable: A Distributed Storage System for Structured Data — Google',
      url: 'https://research.google/pubs/pub27898/',
      note: 'SSTables + memtables + compaction in production; the ancestor of most LSM stores.',
    },
  ],
  seenIn: [
    { label: 'Postgres — B-tree & heap', to: '/components/postgres', live: true },
    { label: 'Cassandra — LSM', note: 'roadmap' },
    { label: 'ClickHouse — columnar', note: 'roadmap' },
  ],
  finale: {
    title: 'See a B-tree engine up close',
    body: 'The Postgres deep-dive walks an UPDATE through the buffer pool and WAL — the B-tree half of this story, running at production scale.',
  },
  next: { slug: 'replication-leader', title: 'Leader & Followers' },
}
