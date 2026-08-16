import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { FlattenDiagram, TabletSplitDiagram } from '../diagrams'
import { bigtableWriteTrace } from './bigtable-trace'

export const bigtable: Chapter = {
  slug: 'bigtable',
  act: 'Act I · The Web Breaks the Box',
  paperNo: 'Paper 3',
  title: 'The Database GFS Deserved',
  dek: 'Google needs to store the web on a file system that cannot edit a byte. The engine that falls out of that constraint is now inside half the databases you use.',
  minutes: 14,
  paper: {
    title: 'Bigtable: A Distributed Storage System for Structured Data',
    authors: 'Chang, Dean, Ghemawat, Hsieh, Wallach, Burrows, Chandra, Fikes & Gruber',
    venue: 'OSDI',
    year: '2006',
    url: 'https://static.googleusercontent.com/media/research.google.com/en//archive/bigtable-osdi06.pdf',
  },
  caption:
    'It is 2004 and Google holds a copy of the web. Crawlers rewrite millions of pages a day; MapReduce wants to sweep them back **in order**; serving wants one row **in milliseconds**. And the only durable storage in the building is GFS — a file system whose files can be created, appended to, read, and deleted, but **never edited**. Every database you could buy in 2004 is built on the one operation GFS refuses to offer. *You have been handed the job of building the one it deserves.*',
  steps: [
    {
      n: 'Step 01',
      title: 'The brief no bought database survives',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'Strip the problem to what must be true. **Petabytes** of structured data. **Random reads by key** for serving. **Ordered scans** for MapReduce. Running on thousands of commodity machines whose disks die daily — which is why GFS already replicates every file three ways.',
        'Now the trap: a conventional database is a **B-tree**, and a B-tree updates pages *in place* — write the record, seek to the page, overwrite it. GFS has no trustworthy in-place write. Its whole design — 64 MB chunks, three replicas, one metadata master — works *because* files are effectively immutable once written. The engine every vendor sells assumes an operation the file system refuses.',
        'So the usual question — *which database should we run?* — is dead on arrival. The real question is stranger: **what storage engine can exist at all** on a file system that only appends?',
      ],
      code: {
        file: 'gfs_api.txt',
        lines: [
          { t: 'Create(path)' },
          { t: 'Read(offset, length)        # random reads: fine' },
          { t: 'RecordAppend(data) -> off   # atomic, at-least-once', hl: 'good' },
          { t: 'Delete(path)' },
          { t: '' },
          { t: 'Write(offset, data)         # exists; concurrent use leaves', hl: 'bad' },
          { t: '                            # replicas "consistent but undefined"' },
        ],
      },
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'Set the scene properly before you touch anything. It is 2004. You have **GFS** (last chapter) holding files across thousands of machines, and **MapReduce** (the half-chapter before this) sweeping them. What you do *not* have is anywhere to put **structured** data: every database on the market wants a file system it can edit in place, assumes one big machine, and tops out orders of magnitude below the web.',
        'The system you must design serves two masters at once. **Serving** asks for one row by key — *the current copy of this URL, in milliseconds*, because a user is waiting behind it. **Analysis** asks for ordered sweeps — *everything under `com.cnn.`, in key order* — because MapReduce eats contiguous ranges. Hundreds of terabytes are already there; the crawl behind them never stops; and other teams — Analytics, Earth, Finance — are queued up behind the crawl with structured data of their own.',
        'Before the paper answers, you answer. Three decisions, the same rules Google faced. Wrong turns are cheap here — they were the expensive part in 2004.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**Scale:** billions of rows keyed by URL, hundreds of terabytes and growing — no single machine, however expensive, is in the running',
              '**Writes never stop:** crawlers rewrite millions of pages a day, every day — ingest is the workload, not an event',
              '**Two read shapes, both mandatory:** *fetch this URL now* (serving — a user is waiting, milliseconds matter) and *sweep everything under `com.cnn.` in order* (MapReduce — throughput matters)',
              '**The fleet:** thousands of cheap machines; disks die daily, so anything durable must already be replicated — which is exactly the job GFS does',
              '**The catch:** GFS files are created, appended to, read, deleted — **never edited.** Every engine you could buy is built on the operation it refuses',
            ],
            questions: [
              {
                q: 'A crawler hands you a fresh copy of `com.cnn.www`. The old copy sits somewhere inside a 2 TB file. What do you do with the write?',
                options: [
                  {
                    label: 'Find the old record, overwrite it',
                    verdict: 'dead',
                    why: 'That is an in-place edit — **the operation GFS does not trustworthily have**. And even on a friendlier file system, one random write per crawled page is one disk seek per page; the crawl outruns the disks by orders of magnitude.',
                  },
                  {
                    label: 'Append the new value to a log, sort it out later',
                    verdict: 'move',
                    why: 'One sequential `RecordAppend`, replicated ×3 as it lands — the exact operation GFS is built for. The old copy is now stale garbage you have promised to deal with *later*. Decision 3 is where "later" sends the bill.',
                  },
                  {
                    label: 'Give every page its own little file',
                    verdict: 'dead',
                    why: 'Tempting — no edits, just replace the file. But now the **file system is your index**, and GFS is the worst possible one for the job: a single master holds every file’s metadata *in RAM*, and a chunk is 64 MB. Billions of 40 KB pages means billions of catalog entries guarding a rounding error of real bytes. The instinct outlived GFS, though: its modern form is **one SQL table per chat room**, and it dies the same way — the partition key moves out of the data and into the catalog, and the catalog is the one structure you cannot shard.',
                  },
                  {
                    label: 'Hold it all in RAM, checkpoint occasionally',
                    verdict: 'dead',
                    why: 'Petabytes, at 2004 RAM prices. Memory has a seat in this design — but as a *buffer*, not as the home.',
                  },
                ],
              },
              {
                q: 'Appending made writes cheap — and reads chaos: the latest value of any row is wherever it happened to land. How do reads find anything?',
                options: [
                  {
                    label: 'Scan the log backwards until the key turns up',
                    verdict: 'dead',
                    why: 'A read now costs a pass over everything appended since that key last changed. Serving one URL should cost about one disk read — not an archaeology dig.',
                  },
                  {
                    label: 'Keep an index of every key’s position in RAM',
                    verdict: 'dead',
                    why: 'Billions of keys: the index outgrows RAM, and every append moves data, so the index churns as fast as the table. You would be building a second database just to find the first.',
                  },
                  {
                    label: 'Buffer writes sorted in RAM; flush as sorted, immutable files',
                    verdict: 'move',
                    why: 'Sorting is the whole trick. Order is cheap to keep in RAM, and a flushed file is then internally sorted — a key is a binary search, and *a range is a contiguous run*. The files never change after creation, which is precisely the deal GFS offers.',
                  },
                ],
              },
              {
                q: 'Months pass. Every flush added a file. A row’s versions are now smeared across 300 sorted files, and each read checks all of them. Now what?',
                options: [
                  {
                    label: 'Accept it — add RAM and cache harder',
                    verdict: 'dead',
                    why: 'The file count grows without bound, so worst-case read cost grows without bound. A cache flatters the median; every miss still pays the 300-file toll.',
                  },
                  {
                    label: 'Merge sorted files into fewer, bigger sorted files, in the background',
                    verdict: 'move',
                    why: 'Merging N sorted files is one streaming pass: sequential reads in, one sequential write out — again the only I/O GFS respects. Stale versions and deleted rows fall out in the merge. The cost of cheap writes gets paid *in bulk, off the critical path*.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You just re-derived the LSM tree — and §5.3 of the paper',
              body: [
                'Buffer sorted in RAM (the paper calls it the **memtable**), flush as immutable sorted files (**SSTables**), merge behind the scenes (**compaction**). That structure is the *log-structured merge tree*, published by O’Neil et al. in **1996** — a decade before Bigtable, waiting for a file system that would force someone to need it.',
                'Which is this chapter’s thesis in one line: **Bigtable did not choose the LSM tree — GFS chose it.** “Immutable sorted files plus merges” is the only storage engine an append-only file system can host. The design fell out of the constraint; that is why the industry has re-derived it every time the constraint has reappeared since.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'The write path, animated',
      accent: 'denim',
      rung: 'Rung 3 · The reveal',
      span: 2,
      body: [
        'Here is the machine the paper actually shipped — your three decisions, plus the parts you did not have to invent: where durability comes from before the flush, and what happens when the server holding the memtable dies. **Watch the last step twice.** It is the whole argument for putting the log in GFS instead of on a local disk.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={bigtableWriteTrace} />
        </div>
      ),
    },
    {
      n: 'Step 04',
      title: 'One sorted map, four coordinates',
      rung: 'Rung 4 · The data model',
      body: [
        'The paper’s famous first sentence: Bigtable is *“a sparse, distributed, persistent multi-dimensional sorted map.”* Not tables and columns — **one giant map**, addressed by `(row, column family, qualifier, timestamp) → bytes`.',
        'The grid people draw is a rendering. The truth is that map **flattened**: every non-empty cell becomes one entry, keys concatenated in a fixed order, the whole thing sorted. Empty cells never produce an entry — *that* is what “sparse” means, and why a row with three million columns costs only what it actually stores.',
        'And the concatenation order **is** the physics: shared prefix = physically adjacent. Everything under one row is a contiguous slice; a whole domain (keys are reversed — `com.cnn.www` — precisely for this) is a contiguous slice; a cell’s versions sit together, newest first. **Choosing what leads the key is choosing which queries are sequential.** The sort key is the most consequential schema decision in this world — a rule that will outlive Bigtable by decades.',
      ],
      diagram: <FlattenDiagram />,
      think: {
        q: 'Row keys are stored reversed: `com.cnn.www`, not `www.cnn.com`. What breaks if you store them the natural way round?',
        a: 'Sorting happens on the leading characters — so `www.cnn.com` and `money.cnn.com` land a world apart (one under `w`, one under `m`), and *“everything under cnn.com”* stops being a contiguous range. Reversing puts the domain first, turning the aggregation you actually query into a shared prefix. General form: **make the unit you scan into the prefix of the key.** The same instinct — s3 key naming, Cassandra partition keys — is doing the same job today.',
      },
    },
    {
      n: 'Step 05',
      title: 'Tablets — partitions the system discovers',
      rung: 'Rung 5 · Distribution',
      body: [
        'The sorted keyspace is cut into contiguous ranges called **tablets** — around a hundred per server. Here is the part that will separate Bigtable’s descendants into two families: the cut points are **not declared by the schema**. The system finds them. A tablet grows past its threshold and the master splits it; a server dies and its tablets are handed to others.',
        'Both moves are nearly free, for one reason: **the bytes never move.** SSTables and the log live in GFS; a tablet is really just an entry in a METADATA table saying “this key range → this server.” Splitting edits metadata. Reassignment edits metadata. The trace’s final step — a machine death becoming a scheduling event — is this same fact wearing a different hat.',
        'Hold on to the alternative Bigtable *didn’t* take: hash the key to place it. Hashing spreads load beautifully and **destroys the sorted order** — no more contiguous domains, no more MapReduce range sweeps. Bigtable’s workload needed the scans, so it kept the order and accepted the hot spots. *Three chapters from now, a shopping cart makes the opposite call* — and the wide-column world splits in two.',
      ],
      diagram: <TabletSplitDiagram />,
      deeper: {
        summary: 'The one hot spot auto-splitting cannot fix: monotonically increasing keys.',
        body: [
          'Imagine ten filing cabinets, one per month, each with its own clerk. Every document that arrives is dated **today** — so every document goes to the newest cabinet, and one clerk drowns while nine sit idle. Split the busy cabinet in two and the heat does not divide: tomorrow’s documents all belong to the *newer* half. **You cannot split a moving frontier.**',
          'That is exactly what happens when row keys are timestamps, sequence numbers, or anything else that only ever grows: every write lands in the final tablet, and a hundred-machine cluster ingests at the speed of one. Nobody’s key is written twice — the hot thing is not a key but a *position*: “just past the maximum.” The standard fixes all reshape the key by hand: lead with something non-monotonic (`sensor_id ⊕ time`), or salt the front with a few hash bits — buying spread at the cost of the very scans you kept range partitioning for. There is no free option; there is only knowing which query you are sacrificing.',
        ],
      },
    },
    {
      n: 'Step 06',
      title: 'The price on the sticker',
      accent: 'terra',
      rung: 'Rung 6 · What it gave up',
      body: [
        'Every design in this book pays for what it gets. Read Bigtable’s bill before you admire the machine.',
        '**Atomicity ends at one row.** A row’s cells live contiguously inside one tablet, so updating them together is free — and that is where the promise stops. No transaction touches two rows, ever. This is not an oversight; a cross-row transaction needs a coordinator, and this design *has no one who could play the part*. Google will spend two more papers buying the promise back — hand-rolled 2PC on top of Bigtable (Percolator, Ch 10), then clocks and Paxos (Spanner, Ch 11).',
        '**Queries the key does not serve, do not exist.** No joins, no secondary indexes: “every page linking to cnn.com” is easy, “every page written in French” is a full scan. In a sorted map, *dimensions left out of the key are queries you surrendered.*',
        '**And the hot spots are yours.** Range partitioning keeps key adjacency, so it keeps load adjacency too — see the drawer above. The system splits what grows; *you* design keys so that what grows can be split.',
      ],
      callout: {
        kind: 'bad',
        big: 'ATOMIC = ONE ROW',
        text: 'The scope of every promise in this system is one row in one tablet. Everything wider is the application’s problem — for now (Ch 10, Ch 11).',
      },
    },
    {
      n: 'Step 07',
      title: 'What it begat — and where it stands in 2026',
      rung: 'Rung 7 · Descendants',
      body: [
        'By publication the system already ran under **more than sixty Google products** — web indexing, Google Analytics, Google Earth, Google Finance among them — which is the quiet flex of the paper: it is a report, not a proposal. Percolator (2010) built transactions on it; Megastore (2011) built replication on it; both roads lead to Spanner.',
        'Outside the walls it split into two family lines. **HBase** (2008) cloned the whole architecture — master, range-partitioned tablets, HDFS underneath. **Cassandra** (2008) took only the data model and LSM engine, and bolted them onto Dynamo’s masterless ring — one paper’s model, the other’s distribution, and the proof that this chapter’s four design choices really are independent axes. And in 2011, two of the paper’s authors distilled the tablet engine into a little library called **LevelDB** — which Facebook forked into **RocksDB** — which is now the storage engine inside CockroachDB’s lineage, TiKV, MyRocks, and a hundred other systems. *The engine outgrew the database that carried it.*',
        '**2026 status: alive on every branch.** Cloud Bigtable sells the original as a managed product; HBase carries the Hadoop world; the LSM engine is close to the default for write-heavy storage everywhere. The ideas aged so well that the sharpest 2026 critique is the one this book ends on: the leaderless cousins have spent a decade quietly re-growing Bigtable’s organs — heat-based splitting, range mechanics, coordinators (the Epilogue tells that story).',
      ],
    },
  ],
  bubbles: [
    { term: 'SSTable.', body: 'An immutable file of sorted key→value entries with an index at its tail. Written once in a stream, then only ever read or deleted.' },
    { term: 'Memtable.', body: 'The sorted in-RAM buffer that absorbs writes between flushes. Rebuilt from the commit log after a crash.' },
    { term: 'Tablet.', body: 'A contiguous range of the sorted keyspace — the unit of assignment and splitting. Metadata, not bytes: its files live in GFS.' },
    { term: 'Tombstone.', body: 'A delete, recorded as an append. The data it shadows only physically disappears at compaction.' },
  ],
  inTheWild: {
    note: '5 ways this design bites in production',
    points: [
      'Use timestamps or sequence numbers as row keys and **every write lands in the last tablet** — a hundred-node cluster ingesting at the speed of one. This is the most documented anti-pattern in HBase’s history, and its fixes (salting, key reversal) all sacrifice a scan to buy the spread.',
      'Deletes are appends, so a mass delete makes reads *slower*: a scan must wade through millions of **tombstones** to find its first live row, until a major compaction finally clears them. Wide-column operators learn to fear the phrase “we deleted a lot of data yesterday.”',
      'Compaction is the loan repayment, and under sustained ingest **the repayment can fall behind the borrowing** — file counts climb, read amplification climbs with them, and engines eventually stall writes on purpose to let compaction catch up. Sizing compaction is sizing the database.',
      'Tablets split *between* rows, never through one — so one enormous row (a celebrity page’s inbound anchors, one entity’s entire history) is an **unsplittable hot spot** no rebalancer can help. The model’s freedom (“a row can have millions of columns”) is also its trap.',
      'Old cell versions linger past their configured GC until a major compaction actually runs — so disk usage and scan cost can sit well above what the retention policy suggests. *The policy is a promise; compaction is the payment.*',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Take the LSM deal',
        when: 'writes dominate and never stop — ingest, messages, feeds, telemetry. You repay it on reads (checking several files — *read amplification*) and in background compaction.',
      },
      {
        choose: 'Keep the B-tree',
        when: 'reads dominate and point lookups need tight, predictable latency. The toll is on writes instead — WAL, page, indexes, roughly **×3 per logical write**.',
      },
      {
        choose: 'Reach for the wide-column shape',
        when: 'your access pattern is “everything under one key, in order” — a channel’s messages, a device’s readings. Then the **sort key is your most consequential schema decision**; design it before the data exists.',
      },
      {
        choose: 'Walk away',
        when: 'you need invariants across rows — money moving between accounts, stock reserved with an order. Atomicity here ends at one row, and no amount of throughput arithmetic overrules a missing promise **(Ch 10 and Ch 11 are how Google bought it back)**.',
      },
    ],
  },
  misconception: {
    think: '“Wide-column store” means it stores data by column, like ClickHouse or BigQuery.',
    actually:
      'Nearly the opposite. Bigtable keeps a **row’s cells together**, sorted under the row key — it is a *row* store whose columns are unbounded and dynamically named (“wide”). A column-oriented engine shreds each column into its own file so aggregates read one column of *every* row — superb for analytics, terrible at fetching one record. Same word “column,” two different machines; the analytics branch gets its own act (Ch 15).',
  },
  sources: [
    {
      year: '2006',
      title: 'Bigtable: A Distributed Storage System for Structured Data (OSDI)',
      url: 'https://static.googleusercontent.com/media/research.google.com/en//archive/bigtable-osdi06.pdf',
      note: 'Read §2 (the data model, worth every page) and §5.3–5.4 (tablet serving, compactions) — that is the whole machine. Skim §6’s refinements; §7’s numbers are period hardware.',
    },
    {
      year: '2003',
      title: 'The Google File System (SOSP)',
      url: 'https://static.googleusercontent.com/media/research.google.com/en//archive/gfs-sosp2003.pdf',
      note: 'Read §2.3–2.7: the interface and consistency model — the constraint this entire chapter grows from. Chapter 1 of this book reads it in full.',
      // Ch 1 is live; the seenIn rail above links to it.
    },
    {
      year: '1996',
      title: 'The Log-Structured Merge-Tree — O’Neil, Cheng, Gawlick & O’Neil',
      url: 'https://www.cs.umb.edu/~poneil/lsmtree.pdf',
      note: 'The idea, a decade early. Read §1–2 for the structure; the cost model assumes 1996 disks, and the idea aged far better than the arithmetic.',
    },
  ],
  seenIn: [
    { label: 'The File System That Refused to Edit — Ch 1', to: '/papers/gfs', live: true },
    { label: 'MapReduce: the Pattern, Not the Product — Ch 2', to: '/papers/mapreduce', live: true },
    { label: 'The Lock Everyone Was Secretly Holding — Ch 4', to: '/papers/chubby', live: true },
    { label: 'B-trees vs LSM-trees — the comic', to: '/ddia/read/storage', live: true },
    { label: 'Choosing the Partition Key — the comic', to: '/ddia/read/partition-key', live: true },
    { label: 'The wide-column ring, priced out — capacity calculator', to: '/calculator/capacity', live: true },
    { label: 'Cassandra deep-dive', note: 'roadmap' },
  ],
  finale: {
    title: 'The file system chose the engine',
    body: 'Everything in this chapter unwinds from one refusal: GFS would not edit a byte. Immutable sorted files, background merges, metadata-only splits, crash recovery as a replay — each is that refusal, answered. Next, a different company meets a different refusal: Amazon’s cart must accept writes **while the network is failing** — and gives up the very thing Bigtable kept.',
  },
  next: { title: 'The Lock Everyone Was Secretly Holding', slug: 'chubby' },
}
