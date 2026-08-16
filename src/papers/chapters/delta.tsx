import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import {
  ThreeSystemsDiagram,
  PartitionListingDiagram,
  DeltaTableDiagram,
  ZOrderDiagram,
} from '../diagrams'
import { deltaTrace } from './delta-trace'

/* The first of the two endings, and the one that has to go first because it
   sounds conclusive. Its argument is a substitution: the pipeline you have
   been drawing since Act VI of Season 1 has three storage systems in it, and
   here is one that does the job of all three.

   The trap to avoid is writing a Databricks brochure. Two things keep it
   honest and both come from the paper. The measurements are against a named
   competitor and the paper reports the configuration, so they can be argued
   with. And §7 is a real limitations section — one table, a few commits a
   second, no secondary indexes — which happens to name exactly the boundary
   where Chapter 30 starts.

   The other thing this chapter must do is not re-teach Chapter 13. The log
   here is a different object doing a different job: a commit log for one
   table, not a shared bus. Where they meet is worth one sentence and no more,
   because the epilogue's whole point is that they are the same primitive with
   the boundary drawn in different places, and that belongs to the last figure
   of the last chapter rather than to this one. */

export const delta: Chapter = {
  slug: 'delta',
  act: 'Epilogue · What You Were Building All Along',
  paperNo: 'Paper 29',
  title: 'Sewing It Back Together',
  dek: 'Season 1 split analytics off from the database and left a pipeline in the gap. Season 2 added a third system to it. This is somebody proposing that the split was never the point — and paying for it in a currency the earlier chapters would recognise.',
  minutes: 16,
  paper: {
    title: 'Delta Lake: High-Performance ACID Table Storage over Cloud Object Stores',
    authors: 'Michael Armbrust, Tathagata Das, Liwen Sun, Burak Yavuz, Shixiong Zhu, et al.',
    venue: 'PVLDB 13(12) · Databricks, CWI, Berkeley, Stanford',
    year: '2020',
    url: 'https://www.vldb.org/pvldb/vol13/p3411-armbrust.pdf',
  },
  caption:
    'Draw the pipeline you have been assembling. Records land somewhere cheap. A job cleans them and writes them somewhere else. A warehouse holds the copy the analysts query, and a second one holds the copy the other team’s analysts query because the first one is busy. Somewhere on the left there is a message queue, because Season 2 happened and somebody wanted the numbers before morning. **That is four copies of the same records, and an ingest job feeding each one, and a person whose job is that they keep running.** Everybody draws this diagram and nobody defends it — it is what you get by adding one reasonable system at a time. This paper starts from an unreasonable question instead: *what if the cheap place at the far left could just be the table?*',
  steps: [
    {
      n: 'Step 01',
      title: 'The cheapest storage on earth cannot hold a table',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'Cloud object stores are the reason the pipeline has a cheap left-hand side. You store a petabyte and run a cluster over it for two hours, and the two bills are unrelated — which is Chapter 16’s separation, arriving as a default rather than as a product feature. So of course people put their tables there, as directories of Parquet objects, partitioned into subdirectories by date. That is the standard layout and it has been since Hive.',
        'It is also **not a table**, and the gap shows up in two unrelated places. The first is correctness: an object store is a key-value store with no atomicity across keys. A query that deletes one user’s records from forty objects rewrites them one at a time, and every reader in between sees a partial result. Crash in the middle and the table is not rolled back — *there is nothing that could roll it back*. The second is speed: finding which objects are in a large table means listing them, and S3’s LIST returns a thousand keys per call at tens to hundreds of milliseconds, so listing a table with millions of objects takes minutes before any data is read.',
        'The receipt for this is the most persuasive sentence in the paper and it is buried in the introduction. In the first years of the Databricks cloud service, **around half of all support escalations were data corruption, consistency or performance problems caused by cloud storage strategies** — undoing a crashed update, or speeding up a query that reads tens of thousands of objects. That is not a benchmark. That is a company reporting what its customers actually rang up about.',
        '*And notice how the field had already answered this.* Snowflake, in Chapter 16, solved it by keeping the truth about which objects form a table in its own strongly consistent service, and treating the object store as a block device. It works — and it means a service must always be running, every read goes through it, and your data is reachable only through one vendor’s engine. The paper’s starting position is that this price is higher than it looks, and that it can be avoided.',
      ],
      diagram: <ThreeSystemsDiagram />,
      deeper: {
        summary: 'How slow listing actually is, measured',
        body: [
          'The paper puts a number on the listing problem by running one query — sum every record in a table of 33 million rows — against tables that differ only in how many partitions they are cut into. Every system gets sixteen nodes. The table is small on purpose: the only thing being measured is the cost of working out which objects to read.',
          'The result is the reason metadata gets centralised. Hive needs over an hour at ten thousand partitions, which is what you get from partitioning by date and one other column. Presto needs over an hour at a hundred thousand. Databricks reading plain Parquet manages 450 seconds at that size, mostly because it was optimised to fire LIST requests in parallel across the whole cluster — an impressive amount of work to make a bad question fast.',
          '**Delta answers at a million partitions in 108 seconds, and in 17 with the log cached on local SSD.** The comparison is unfair in Delta’s favour by a factor of ten in table size and it is still the right comparison, because it is the size real tables reach: the paper notes that petabyte-scale tables in production hold hundreds of millions of objects.',
        ],
        figure: <PartitionListingDiagram />,
      },
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'Three decisions. The first is the one everything else hangs off, and the third is where the honest limits of the whole approach get set.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**What you have:** an object store. Read a byte range cheaply, replace a whole object atomically, list keys in lexicographic order slowly. No atomicity across two keys, and in 2020, no guarantee that a LIST shows you an object you just wrote.',
              '**What you want:** a table. Atomic updates spanning many objects, readers who never see half of one, and a way to find the relevant objects that does not involve listing all of them.',
              '**What you will not accept:** a service that has to be running for the table to exist. That is the thing separating this from Chapter 16, and giving it up costs you direct high-bandwidth reads and the ability to open your data with somebody else’s engine.',
              '**Who is writing:** a handful of large jobs, not thousands of small transactions. Transactions are big and rare. This is an analytics workload and you may design for it.',
            ],
            questions: [
              {
                q: 'The store has no atomicity across keys. Where does the truth about which objects form the table live?',
                options: [
                  {
                    label: 'In a log of add and remove actions, written into the same directory as numbered objects',
                    verdict: 'move',
                    why: 'The whole design is this. The Parquet objects stop being the table and become **candidates**; the table is whatever the log says is currently added and not removed. Adding forty objects and removing forty others becomes one write of one small JSON object, so atomicity across many keys is bought with atomicity across one — which the store does have. Three consequences worth seeing immediately. A crashed job leaves objects nobody references, which is litter rather than corruption. The log is a history, so an earlier version of the table is still fully described by an earlier prefix of it, and *time travel is not a feature that was added — it is a thing you have to work to prevent.* And because the log records what changed, a reader can tail it, which is how one table serves a streaming consumer and a batch one.',
                  },
                  {
                    label: 'In a strongly consistent metadata service beside the store, which is asked before any read',
                    verdict: 'dead',
                    why: 'This is Chapter 16’s answer and it is genuinely good — the paper says so, and the reason to reject it here is a constraint rather than a flaw. Every I/O now contacts a service that must be highly available, which is a cost and a thing to operate. Reads through an external engine stream through that service’s frontend instead of coming straight from the store, which is slower for exactly the large scans this workload is made of. And the metadata is proprietary, so the table can only be opened by the engine that owns it, which for a team running Spark, a warehouse and two ML frameworks over the same bytes is the expensive part.',
                  },
                  {
                    label: 'In a transactional database used as a metastore, tracking the files for each table',
                    verdict: 'dead',
                    why: 'Hive ACID does exactly this and it is instructive to see where it stops. The metastore is an OLTP database holding a row per partition, and it becomes the bottleneck at the table sizes that motivate the whole exercise — millions of partitions is a workload nobody would deliberately put in MySQL. You have also reintroduced the always-running service from the previous option without getting its consistency benefits, and you now operate a database in order to store a directory listing.',
                  },
                  {
                    label: 'Write the new version into a fresh directory and swap the directory name atomically',
                    verdict: 'dead',
                    why: 'The instinct is right and the primitive does not exist. Object stores model keys after filesystem paths and are not filesystems: **there is no cheap rename of an object or a "directory"**, because a directory is a prefix rather than a thing. Renaming means copying every object, which for a table where one row changed is absurd. This works on HDFS, which is precisely why the layout inherited from Hive works on HDFS and breaks in the cloud.',
                  },
                ],
              },
              {
                q: 'Replaying every log record since the table was created gets slow. How does a reader stay cheap?',
                options: [
                  {
                    label: 'Periodically compact the log into a checkpoint, and keep a pointer to the most recent one',
                    verdict: 'move',
                    why: 'Two objects, and both matter. The **checkpoint** is the log so far with the redundancy squeezed out — an object added and later removed leaves nothing, repeated metadata changes leave the last one — written in Parquet, which means the metadata for a million-object table is itself a columnar file you can run a filter over. The **pointer** is a tiny object naming the latest checkpoint, which is what turns "find the current state" into one read at a known key followed by a short list. Log ids are zero-padded so that the list is lexicographic and starts exactly where the checkpoint ended. Clients write a checkpoint every ten transactions by default, and if one fails to, nothing breaks — a reader falls back to an older checkpoint and reads a few more records.',
                  },
                  {
                    label: 'Garbage-collect old log records once their changes are reflected in the current state',
                    verdict: 'dead',
                    why: 'It keeps reads cheap and it throws away the reason to have a log. Every version of the table is a prefix of this thing; delete the early records and you have deleted time travel, rollback of yesterday’s bad job, the audit trail, and the ability to tell a data scientist which version of the table trained the model. It also does not help as much as it looks: you still have to read whatever remains, in JSON, one record at a time. **The problem was the format and the entry point, not the length.**',
                  },
                  {
                    label: 'Have readers cache the table state in memory and refresh it periodically',
                    verdict: 'dead',
                    why: 'Fine as an optimisation and useless as the answer, because it does nothing for the cold case — and in this workload the cold case is the common one. A cluster is launched to run a query and destroyed afterwards; that is the point of separating compute from storage. A cache that helps only the second query is a cache that helps only the sessions that were already fast.',
                  },
                  {
                    label: 'Skip the log for planning and read the statistics from each Parquet file’s footer',
                    verdict: 'dead',
                    why: 'This is what everybody was already doing, and it is the specific thing the design replaces. Parquet footers carry min and max per column, which is real and useful information — on a local filesystem, reading one costs a few milliseconds. On an object store each footer is a separate high-latency request, so **the data-skipping check can take longer than the query it was meant to accelerate.** Hoisting those statistics into the checkpoint is what makes them affordable: one read of one columnar file instead of a hundred thousand round trips.',
                  },
                ],
              },
              {
                q: 'Two jobs commit at the same moment. What arbitrates?',
                options: [
                  {
                    label: 'Nothing — both write their data objects, then race to create the next log number, and the loser retries',
                    verdict: 'move',
                    why: 'Optimistic concurrency, and it fits because you designed for the workload rather than for the general case. Writers put their Parquet objects down first, where nobody can see them, then attempt to create record *r+1* **only if it does not already exist**. One succeeds and one fails, and the loser can often keep the objects it just wrote and commit them as *r+2*. Serializability follows from something almost embarrassingly simple: only one client can create each id, so the committed transactions form a serial order by number. *And the price is stated in the same breath* — the commit rate is bounded by how fast the store does one conditional create, so a table sustains a few transactions per second, which is fine for jobs that batch thousands of rows and hopeless for anything shaped like OLTP.',
                  },
                  {
                    label: 'A lock service that writers acquire before committing',
                    verdict: 'dead',
                    why: 'Correct, well understood, and it is the always-running service you rejected in the first question — now on the write path for every job. Chapter 9 is a whole chapter about how much work it is to run one of these properly. It is also solving a problem you mostly do not have: with transactions this large and this rare, conflicts are uncommon, and paying a coordination round trip on every commit to avoid an occasional retry is the wrong trade. **Pessimistic control earns its keep when contention is high, and here it is low by construction.**',
                  },
                  {
                    label: 'Let both writes land and reconcile the two versions afterwards',
                    verdict: 'dead',
                    why: 'Chapter 5 asked who writes the merge function and Chapter 27 answered it for data types whose merge is forced by their shape. A table under arbitrary SQL is not one of those. *Two jobs that each deleted a different user and rewrote overlapping objects have no least upper bound* — the merge would have to know what the queries meant. Losing a commit and retrying is a smaller, more honest answer than inventing semantics for a collision.',
                  },
                  {
                    label: 'Serialise commits through a single writer process per table',
                    verdict: 'dead',
                    why: 'Uncomfortably close to what actually shipped, which is why it is worth walking through. It works, and it means one Spark driver owns the table — so two teams cannot write to it from two clusters, and the "many independent clients coordinating through the object store" property is gone. The open-source connector really does fall back to this for writes through one driver. **The gap between what the design promises and what one particular cloud made possible is the subject of Step 05.**',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived Delta Lake — and the whole thing is two kinds of object',
              body: [
                '**The log is the table.** Numbered JSON records of `add` and `remove` actions, in a `_delta_log` subdirectory beside ordinary Parquet objects. The objects are readable by anything; the log decides which of them count. Every property the paper advertises is downstream of that one sentence.',
                '**Checkpoints and a pointer make reads cheap.** The log compacted into Parquet every ten commits, plus a tiny object naming the latest one, so the reader does a small read at a known key and a short lexicographic list rather than an open-ended search. Statistics ride along in the `add` records, which turns query planning into a filter over one columnar file.',
                '**Optimistic concurrency, because the workload allows it.** Write the data objects first where nobody can see them, then create the next log number if it does not exist. Serializability comes free from the numbering. A few commits a second, and the paper says so rather than burying it.',
                '**And what falls out of it, unbidden.** Time travel and rollback, because old versions are prefixes. `MERGE`, `UPDATE` and `DELETE` for GDPR work, because rewriting a set of objects is now atomic. Streaming ingest, because a writer can commit small objects often and a compaction job can replace them later without readers noticing. Caching, because every object named in the log is immutable and therefore safe to keep on local SSD. *None of these were designed. They are consequences of having transactions at all, which is why the paper is about the log and not about the features.*',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'A commit, and the read that has to survive it',
      accent: 'denim',
      rung: 'Rung 3 · The answer',
      span: 2,
      body: [
        'The protocol is short enough to hold in your head, and it is worth watching in order because the ordering is the correctness argument. A writer puts its objects down while they are invisible, and makes them visible with one atomic create. A reader starts at the pointer, never at the data.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={deltaTrace} />
        </div>
      ),
      deeper: {
        summary: 'What the log actually contains',
        body: [
          'Six kinds of action, and the interesting thing is how few there are. `metaData` sets the schema and partition columns. `add` and `remove` change which objects are in the table, with `add` carrying the row count and per-column min, max and null counts, and `remove` carrying a timestamp so the object can be physically deleted later — after readers on older snapshots have had time to finish. `protocol` raises the format version so an old client knows to refuse. `commitInfo` records who did it, which is the audit log.',
          'The sixth is the one nobody expects and it is the reason streaming works. An application may write its **own** action into the same log record: a `txn` with an application id and a version. A Structured Streaming job puts its input offset there, so the fact that a batch was added to the table and the fact that the job had consumed up to offset *n* become **one atomic write**. That is where exactly-once ingestion comes from — not from a protocol, but from the observation that if the data and the bookmark commit together, there is no window in which they can disagree.',
          'There is also a flag worth knowing about: `dataChange`, set to false when a commit only rearranges existing rows or adds statistics. A compaction job that merges a thousand small objects into ten large ones marks its commit this way, and streaming consumers tailing the log skip it. **Without that flag, every consumer would see the entire table re-emitted every time somebody tidied it up.**',
        ],
        figure: <DeltaTableDiagram />,
      },
    },
    {
      n: 'Step 04',
      title: 'What a transaction buys that has nothing to do with transactions',
      rung: 'Rung 4 · The consequences',
      body: [
        'Once membership is decided by a log rather than by what happens to be on disk, a class of things becomes possible that a data lake could not previously attempt. The most useful is the least glamorous: **you can rearrange the data underneath a running query.** A background job rewrites a thousand small objects as ten large ones and commits the swap atomically, and every reader either sees the old set or the new one. Nothing pauses.',
        'That unlocks the layout question, which is where the largest speedups in the paper come from. Sorting a table by a column makes queries on *that* column fast and does nothing for any other — with a table of network flows sorted by source IP, a filter on source IP skips 99 per cent of the objects and a filter on destination port skips none of them. **A sort order is a decision about which query is allowed to be fast.** Z-ordering interleaves the bits of several columns so that objects are compact in every dimension at once, which is worse for the favoured column and enormously better for the rest: 44 to 67 per cent skipped per field instead of 99 and three zeroes.',
        'And the numbers get better as tables get bigger, which is the opposite of the usual direction. Each object covers a shorter stretch of the curve, so its min and max bracket a narrower range of every column. On a real 500 TB table of network flows at one of the customers in the paper, multi-attribute queries skipped **93 per cent** of the data.',
        '*The through line here is worth naming.* Chapter 15 argued that layout is the whole game for analytics, and left you with a layout chosen once at load time. What the transaction log adds is not a better layout — it is **the ability to change your mind about the layout later**, on a live table, without a maintenance window. That is closer to what a database does for you than anything else in this chapter.',
      ],
      diagram: <ZOrderDiagram />,
      callout: {
        kind: 'good',
        big: '93% OF A 500 TB TABLE, SKIPPED',
        text: 'Not from a faster engine — from knowing which objects cannot contain the answer, and being allowed to reorganise them while people are querying.',
      },
    },
    {
      n: 'Step 05',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 5 · What it costs',
      body: [
        '**A few transactions per second, per table.** The commit is one conditional create against an object store, which takes tens to hundreds of milliseconds, and optimistic concurrency means a high write rate turns into a pile of retries. The paper is direct that this has been enough for its workloads — streaming jobs batch many objects into one commit — and equally direct about what it rules out. *Every OLTP system in Season 1 is outside this envelope by three orders of magnitude.*',
        '**One table at a time.** Each table has its own log, so there is no transaction spanning two of them. For a warehouse built out of joined fact and dimension tables that is a real limitation, and the paper’s own suggestion — put several tables in one log — trades it for more contention on the single object everyone is racing to create.',
        '**Seconds, not milliseconds.** Streaming latency is bounded by object-store operations, so this is not the machinery of Act II. The paper says a few seconds was acceptable for the workloads it targets, which is true and is also the honest boundary: **Chapter 21’s hundred-millisecond record and this are not the same business.**',
        '**And on the biggest cloud, the promise needed an asterisk.** The design’s headline is that no server has to be running for a table to exist — and in 2020 S3 had no atomic put-if-absent, so Databricks ran a lightweight coordination service to hand out log ids. Google Cloud Storage and Azure had the primitive and needed nothing; the open-source Spark connector, without that service, could only guarantee unique ids among writers sharing one driver process. *The serverless design worked everywhere except the store the paper opens by naming.*',
      ],
      callout: {
        kind: 'bad',
        big: 'THE SEAM MOVED, IT DID NOT VANISH',
        text: 'One storage layer instead of four, and now a commit rate of a few per second, no transaction across two tables, seconds of latency, and one cloud where the no-server claim required a server.',
      },
    },
    {
      n: 'Step 06',
      title: 'The ground moved under it — and where it stands in 2026',
      rung: 'Rung 6 · Descendants',
      body: [
        '**Two of the paper’s foundations were removed by the cloud provider, within four years.** Section 2.2 spends a page on eventual consistency — that a LIST after a PUT might not show the object — and in December 2020, months after publication, S3 began delivering strong read-after-write consistency for reads and lists alike. Then in August 2024 S3 added conditional writes: an `If-None-Match` header on PutObject, which is put-if-absent, which is the exact primitive the coordination service existed to fake. AWS’s own announcement says it removes the need for client-side consensus mechanisms. **The asterisk in Step 05 was retired by a feature release.**',
        'It is worth sitting with what that does and does not change. The design survived, because the log was never a workaround for weak consistency — it was the answer to *atomicity across many objects*, which no amount of read-after-write gives you. What went away was the scaffolding. That is the good version of a paper ageing: the load-bearing idea holds and the compensations for a particular year’s cloud fall off.',
        '**The format won and then had company.** The paper names Hudi and Iceberg as concurrent work in one paragraph, which reads oddly now, because the following five years were largely a contest between the three of them. Iceberg took the same core idea — a manifest of which files are in the table — and became the neutral option that no single vendor owned, which turned out to matter more than any feature comparison. Databricks bought Tabular, the company founded by Iceberg’s creators, in 2024, and both formats now spend effort on interoperating rather than on winning. **The argument that settled was never about the log; it was about who owns the specification.**',
        '*And "lakehouse" became a category, which is the outcome a systems paper least expects.* The claim the word carries is the one this chapter has been making: that the reason there were two systems was a missing guarantee rather than a difference of kind, and that supplying the guarantee lets the split close. Whether it has actually closed depends on which workload you ask about. For ETL and BI over large tables, largely yes. For anything that wants a millisecond or a transaction across two tables, the warehouse and the OLTP database are both still there, doing the jobs this cannot.',
      ],
    },
    {
      n: 'Step 07',
      title: 'And the other half of the argument',
      accent: 'terra',
      rung: 'Rung 7 · The objection',
      body: [
        'Read the last two paragraphs again and a shape appears that the paper does not draw attention to. The thing that reunified batch, streaming and interactive storage is **an ordered log of changes, kept in the open, that anybody may replay from any point.** Time travel is replaying a prefix. Streaming ingest is tailing it. Exactly-once is committing a bookmark inside the same record as the data. Audit is reading it.',
        'That is the same sentence Season 1 spent an entire act on, and it is why this chapter cannot be the ending on its own. If the log is what made one storage system able to do three jobs, an obvious question follows: **why stop at storage?** A search index, a cache, an OLAP engine and a feature store all want different layouts and none of them is going to be talked out of it — the reason there are many systems is that the workloads genuinely differ, not that nobody thought to merge them.',
        '*So there is a second reading of everything in this chapter, and it inverts the conclusion.* Perhaps the achievement is not that four systems became one. Perhaps it is that the log turned out to be a good enough interface that the number of systems stopped mattering. The next chapter is two people who took that view five years earlier, at a company drowning in point-to-point pipelines, and who argue — with Unix as the precedent — that the right response to a heap of specialised tools is not to merge them but to standardise the pipe between them.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Lakehouse.',
      body: 'A data lake with the management functions of a warehouse — transactions, versioning, upserts — supplied by a table format rather than by a separate system. The word is the paper’s.',
    },
    {
      term: 'Checkpoint.',
      body: 'The log so far, compacted and written as Parquet, so that finding the current set of objects is one columnar read rather than a replay. Written every ten commits by default; losing one costs performance and nothing else.',
    },
    {
      term: 'Data skipping.',
      body: 'Not reading an object because its recorded minimum and maximum say it cannot contain a matching row. Cheap once the statistics are in the log, and ruinous when they are in a hundred thousand Parquet footers.',
    },
    {
      term: 'Z-ordering.',
      body: 'Interleaving the bits of several columns so that nearby records are nearby in all of them at once. Gives up the one fast column a sort order buys, in exchange for every column being usable.',
    },
  ],
  inTheWild: {
    note: '4 things to take from this even if you never run a lakehouse',
    points: [
      '**Count the copies in your pipeline and ask what each one buys.** The paper’s Figure 1 is four copies of the same records, and the honest answer for most of them is "a guarantee the previous system could not give". When the guarantee arrives somewhere cheaper, the copy is just cost.',
      '**A pointer to a known key beats a search, every time.** The single largest win here is replacing "list everything and work out what is current" with "read one small object that says". That trick is not about tables — it applies anywhere you are enumerating to find state.',
      '**Optimistic concurrency is a statement about your workload.** It is the right answer when transactions are large and collisions are rare, and the wrong one the moment either stops being true. Delta can say a few commits a second is fine because it knows who is writing.',
      '**Write the data before you make it visible.** Objects with GUID names that no log record mentions are invisible, so a crashed job leaves litter instead of damage. That ordering — durable first, referenced second — is the same move Chapter 1 made with append-only files and Chapter 3 made with an SSTable.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'A log of changes over a snapshot of state',
        when: 'more than one thing needs to know what the current state is. A snapshot answers one question; a log answers that one plus every historical version, and lets a consumer follow along without polling.',
      },
      {
        choose: 'Metadata in the same store as the data',
        when: 'the alternative is a service that must be running for the data to be readable. You give up low-latency commits and you keep the property that anybody’s engine can open the table.',
      },
      {
        choose: 'Statistics where the planner will look, not where the data is',
        when: 'the storage has high per-request latency. Min and max in a Parquet footer are free on a local disk and prohibitively expensive across a hundred thousand objects in the cloud.',
      },
      {
        choose: 'Design the concurrency control for the transaction size you have',
        when: 'you know your writers. Optimistic control here is not a compromise, it is a fit — and the same choice under OLTP traffic would be a disaster.',
      },
    ],
  },
  misconception: {
    think: '“Delta Lake is a file format.”',
    actually:
      'It is a **protocol**, and the files are ordinary. The data objects are plain Parquet, written by whatever wrote them, readable by anything that reads Parquet — that was a deliberate choice so that connectors would be cheap and no engine could be locked out. What Delta adds is a directory called `_delta_log` containing numbered JSON records that say which objects are currently part of the table, plus periodic Parquet checkpoints of those records and a small file naming the latest checkpoint. **The objects are candidates; the log decides.** Everything people associate with the name follows from that split. Time travel exists because an earlier version of the table is an earlier prefix of the log. Atomic multi-object updates exist because forty additions and forty removals are one write of one small object. Streaming ingest exists because a consumer can tail the log. Local SSD caching is safe because anything the log names is immutable. And the concurrency control is nothing more than *create the next number only if it does not exist* — which is why the whole thing needs no server, and why it commits a few times a second rather than a few thousand. Reading it as a format misses that the interesting content is a set of rules about what clients do, not a layout on disk.',
  },
  sources: [
    {
      year: '2020',
      title: 'Delta Lake: High-Performance ACID Table Storage over Cloud Object Stores — Armbrust et al. (PVLDB 13(12))',
      url: 'https://www.vldb.org/pvldb/vol13/p3411-armbrust.pdf',
      note: 'Fourteen readable pages. **§2 is the part to read even if you skip the rest** — it is the clearest short account anywhere of what an object store is and is not, and why the layout everybody inherited from Hive breaks on one. §3.1.2 lists the log actions, which is the whole format. And read §7, which is a genuine limitations section: one table per log, a few transactions per second, no secondary indexes.',
    },
    {
      year: '2021',
      title: 'Lakehouse: A New Generation of Open Platforms that Unify Data Warehousing and Advanced Analytics — Zaharia, Ghodsi, Xin & Armbrust (CIDR)',
      url: 'https://www.cidrdb.org/cidr2021/papers/cidr2021_paper17.pdf',
      note: 'The argument the storage layer was built for, made explicitly and a year later. Read this one for the claim and the Delta paper for the mechanism — and notice that the case rests on a prediction about where machine learning wants its data, which is the part that has aged most and is worth arguing with.',
    },
    {
      year: '2020',
      title: 'Amazon S3 now delivers strong read-after-write consistency automatically for all applications — AWS',
      url: 'https://aws.amazon.com/about-aws/whats-new/2020/12/amazon-s3-now-delivers-strong-read-after-write-consistency-automatically-for-all-applications/',
      note: 'Four paragraphs, and they retire most of §2.2 of the paper. Published in December 2020, a few months after the Delta paper described S3’s eventual consistency as a design constraint. Worth reading beside it as a reminder that a systems paper is partly a photograph of what the infrastructure could do that year.',
    },
    {
      year: '2024',
      title: 'Amazon S3 now supports conditional writes — AWS',
      url: 'https://aws.amazon.com/about-aws/whats-new/2024/08/amazon-s3-conditional-writes',
      note: 'The other retirement, and the more consequential one: `If-None-Match` on PutObject is exactly the put-if-absent that §3.2.2 said S3 lacked, and the announcement says so in the language of the paper — it removes the need for client-side consensus mechanisms. The coordination service Databricks ran to hand out log ids stopped being necessary.',
    },
    {
      year: '2005',
      title: 'C-Store: A Column-oriented DBMS — Stonebraker et al. (VLDB)',
      url: 'https://web.stanford.edu/class/cs245/readings/c-store.pdf',
      note: 'Chapter 15, and the reason this chapter has a divorce to undo. Read §1 beside Delta’s Figure 1: the split it argues for is the same split that fifteen years later shows up as four copies and an ingest job per copy.',
    },
    {
      year: '2016',
      title: 'The Snowflake Elastic Data Warehouse — Dageville et al. (SIGMOD)',
      url: 'https://homepages.cwi.nl/~boncz/lsde/papers/p215-dageville-snowflake.pdf',
      note: 'Chapter 16, and the option the first design decision rejects by name. The metadata service Delta refuses to run is the thing that makes Snowflake fast and closed, and reading the two designs together is the clearest way to see what a proprietary catalogue actually buys and costs.',
    },
  ],
  seenIn: [
    { label: 'Reading Sideways — Ch 15', to: '/papers/columnar', live: true },
    { label: 'Elasticity as the Product — Ch 16', to: '/papers/snowflake', live: true },
    { label: 'Write Once, Replay Everywhere — Ch 13', to: '/papers/kafka', live: true },
    { label: 'The Same Query, Twice a Second — Ch 20', to: '/papers/structured-streaming', live: true },
  ],
  finale: {
    title: 'Atomicity was the whole thing keeping them apart',
    body: 'A cloud object store is the cheapest place to keep a large table and it is a key-value store, so writing forty objects is forty separate events and a crash halfway leaves wreckage — which is why half of one company’s support escalations for three years were people asking how to undo a failed job. Delta Lake answers it by demoting the data: the Parquet objects become candidates, and a log of numbered JSON records in the same directory says which of them are currently in the table. Adding forty and removing forty becomes one atomic create of one small object, and serializability comes from nothing more than only one client being able to create each number. Checkpoints compact that log into Parquet so a reader does a single read at a known key instead of listing a million objects; the statistics ride along, so planning is a filter over one file rather than a hundred thousand footer requests. Everything else — time travel, GDPR deletes, streaming ingest, reorganising the layout under a running query, 93 per cent of a 500 TB table skipped — is a consequence of having transactions at all. The bill is a few commits a second, one table per log, seconds rather than milliseconds, and a design that needed a small coordination service on the one cloud it was named after. And underneath the whole thing sits an ordered log of changes that anybody can replay, which is a sentence this book has written before.',
  },
  next: { title: 'The Database, With the Lid Off', slug: 'unbundling' },
}
