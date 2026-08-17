import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { ColumnLayoutDiagram, RepetitionLevelDiagram } from '../diagrams'
import { columnarTrace } from './columnar-trace'

/* Opens Act VI, and reads two papers five years apart. Unlike Chapters 8 and
   13, this is NOT the same idea told twice — it is one idea carried into two
   different worlds, and the second world is the one that mattered. C-Store
   argues a whole DBMS should be rebuilt read-optimised, on one machine, for
   tidy relational tables. Dremel takes column striping to nested records on
   thousands of machines, which is the data companies actually have.

   The chapter has to resist becoming a compression tutorial. The point is the
   question — one field of every row, rather than every field of one row — and
   the fact that answering it well splits the industry in two. */

export const columnar: Chapter = {
  slug: 'columnar',
  act: 'Act VI · The Analytics Divorce',
  paperNo: 'Paper 15 · two worlds',
  title: 'Reading Sideways',
  dek: 'Every layout in this book was built to find a record. Now somebody wants one field out of a billion of them — and answering that well means turning the data ninety degrees and rebuilding the database around it.',
  minutes: 18,
  paper: {
    title: 'C-Store: A Column-oriented DBMS',
    authors: 'Mike Stonebraker, Daniel J. Abadi, Adam Batkin, Xuedong Chen, Mitch Cherniack, Miguel Ferreira, Edmond Lau, Amerson Lin, Sam Madden, Elizabeth O’Neil, Pat O’Neil, Alex Rasin, Nga Tran & Stan Zdonik',
    venue: 'VLDB',
    year: '2005',
    url: 'https://web.stanford.edu/class/cs245/readings/c-store.pdf',
  },
  caption:
    'Fifteen chapters, and every one of them has been optimising the same question: **give me this record.** GFS chunks it, Bigtable keys it by row, Dynamo hashes it, Spanner locks it, Aurora ships the redo that changed it. But another question was in the building the whole time, asked by different people with different job titles — not *what is in this order* but **what did we sell in Ontario last March.** That one reads a single field out of every row in the table, and every layout in this book is wrong for it. Answering it properly turns out to require a different database, and the split becomes permanent.',
  steps: [
    {
      n: 'Step 01',
      title: 'The question the whole book has been ignoring',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'Start with why a row store is a row store, because it is not an accident. **Put a record’s fields next to each other and one disk write persists the whole record** — insert, update and read of a single row are all one seek. That is exactly right for the workload the first fourteen chapters were about, and the 2005 paper has a name for it: a row store is a **write-optimised** system.',
        'Now ask an analytical question. *Total sales by country, over five years.* It touches two fields out of two hundred, and it touches **every row in the table**. An index does not help — an index takes you to rows, and you were going to visit all of them anyway; scanning 30% of a table through an index is slower than reading the table. Precomputing does not help either, because the defining feature of this workload is that **you do not know the question in advance.** That is what ad-hoc means.',
        'So the layout is the problem. Every page you read carries two hundred fields and you wanted two, which means **ninety-nine percent of the bytes crossing the I/O path are being discarded on arrival.** No amount of caching or faster disks changes that ratio; it is structural.',
        'And there is a second constraint that only shows up at Google’s end of the scale, which the 2010 paper is about. **Real data is not a tidy table.** It is nested records — protocol buffers, JSON, logs with repeated and optional fields — and normalising all of that into flat relations before you can analyse it is prohibitive at web scale. A columnar layout that only works on flat tables solves the problem for the data warehouse and not for the data.',
      ],
      code: {
        file: 'two_questions.txt',
        lines: [
          { t: 'SELECT * FROM orders WHERE id = 40317' },
          { t: '  → one record, all its fields' },
          { t: '  → row layout: one seek. perfect.', hl: 'good' },
          { t: '' },
          { t: 'SELECT country, SUM(amount)' },
          { t: '  FROM orders GROUP BY country' },
          { t: '  → all records, two of their fields' },
          { t: '  → row layout: read everything,', hl: 'bad' },
          { t: '    discard 99% of it.', hl: 'bad' },
          { t: '' },
          { t: '# same data. same database.' },
          { t: '# opposite optimal layouts.' },
        ],
      },
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'Turning the data ninety degrees is the part you can guess. What decides whether this survives a real schema, rather than the four-column one in the tutorial, is the decision at the end — and most attempts die on the one before it.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**The workload:** ad-hoc analytical queries. A handful of fields, most or all of the rows, and the question is not known in advance.',
              '**The updates:** periodic bulk loads and a steady trickle of corrections. Nothing like OLTP, but not read-only either — warehouses must fix bad data.',
              '**The data:** at the warehouse end, wide flat tables. At the web end, deeply nested records with repeated and optional fields, and schemas with thousands of fields of which a given record uses a hundred.',
              '**The hardware:** commodity machines, private disks. Sequential reads are cheap, seeks are not, and CPU is increasingly cheaper than I/O.',
              '**The scale:** the second paper’s tables run to a trillion records and a hundred terabytes, spread over thousands of nodes that fail and straggle.',
            ],
            questions: [
              {
                q: 'Your query reads two fields of every row. Where do you put the bytes?',
                options: [
                  {
                    label: 'Keep rows, and add indexes on the two fields',
                    verdict: 'dead',
                    why: 'An index answers *which rows*, and this query wants all of them. Following an index into a row store still fetches whole rows, one seek at a time, and past a few percent selectivity that is slower than simply scanning. Indexes are a write-optimised structure solving a lookup problem; **you have a scan problem, and no index makes a scan read less of each row.**',
                  },
                  {
                    label: 'Keep rows, and precompute the aggregates people ask for',
                    verdict: 'dead',
                    why: 'Cubes and materialised views are a bet on which questions get asked, and the whole character of this workload is that the next question is unknown. You also now maintain every rollup on every load, and the combinatorics get away from you fast. This is a genuinely good technique for a *fixed* dashboard and it does not answer the case that matters.',
                  },
                  {
                    label: 'Store each field contiguously, and read only the fields asked for',
                    verdict: 'move',
                    why: 'Turn the table ninety degrees. Now a query reads exactly the stripes it names and **never touches the other 198**, so the I/O drops by the ratio of fields you wanted to fields that exist. Two further wins follow for free: a stripe is all one type and often near-sorted, so it **compresses far harder** than a mixed page — and the executor can be written to work on the compressed form rather than decompressing first.',
                  },
                  {
                    label: 'Keep rows, but compress the pages harder',
                    verdict: 'dead',
                    why: 'It attacks the bytes and not the ratio. A compressed page still contains two hundred fields, of which you want two, so you have reduced the transfer and kept the waste — and you have added decompression CPU on data you are about to discard. Compression is a real part of the answer, but it works far better *after* the layout change, because a column of like-typed values compresses in ways a mixed row never can.',
                  },
                ],
              },
              {
                q: 'You now have one file per column. A single-row insert has become two hundred writes. What do you do about updates?',
                options: [
                  {
                    label: 'Update the column files in place',
                    verdict: 'dead',
                    why: 'The reason columns are fast is that they are packed, compressed and stored in sort order — and all three properties are hostile to modification. Inserting one value in sorted position means rewriting the run around it, in two hundred files, for one row. **The layout that made reads cheap made writes structurally expensive**, and pretending otherwise gets you the worst of both.',
                  },
                  {
                    label: 'Two stores in one system — a small writeable one, a large read-optimised one, and a mover between them',
                    verdict: 'move',
                    why: 'Writes land in a **small write-optimised store**; the bulk lives in a **read-optimised column store**; a **tuple mover** migrates batches from one to the other, and queries read both. Deletes are marked and purged later, updates are a delete plus an insert. If that shape feels familiar it should — it is the LSM tree from Chapter 3, and C-Store says so, citing the same paper. *The same trick keeps solving the same problem: batch the expensive rearrangement and get out of the write path.*',
                  },
                  {
                    label: 'Make it read-only and reload the whole thing nightly',
                    verdict: 'dead',
                    why: 'Defensible in 1995 and not later. Warehouses need online updates to correct errors, and the push toward real-time reporting only shortens the tolerance for a nightly window. It also means the freshest data is always the least available, which is usually backwards — the last hour is what people ask about.',
                  },
                  {
                    label: 'Run a row store for writes and a separate column store for reads',
                    verdict: 'dead',
                    why: 'This is the honest booby prize, because it is what the industry actually did — and it is the subject of this act’s title. Two systems, two copies of everything, and a pipeline between them that becomes somebody’s whole job. **Naming it as a dead end here is a bit unfair**, since for twenty years it was the practical answer; the point is that it is a *deployment* answer, not a design one, and it moves the cost rather than removing it.',
                  },
                ],
              },
              {
                q: 'Your records are nested — repeated fields, optional fields, fields inside fields. How do you stripe *that* by column without losing the structure?',
                options: [
                  {
                    label: 'Normalise into flat relations first, then stripe those',
                    verdict: 'dead',
                    why: 'The textbook answer, and at web scale the cost is prohibitive — you are joining and recombining every record before you can ask anything, on data measured in petabytes. It also requires the full schema up front, when a real schema here has thousands of fields and any given record populates a hundred of them. **The transformation costs more than the query.**',
                  },
                  {
                    label: 'Store each top-level field as a blob and parse it at query time',
                    verdict: 'dead',
                    why: 'You have kept the container and thrown away the benefit. Parsing is expensive — the measurements show it can roughly double retrieval time on its own — and a blob containing a whole subtree still forces you to read fields you did not want. The unit of storage has to be **the leaf field**, or the layout is not doing its job.',
                  },
                  {
                    label: 'Give every value two small integers that say where in the nesting it sat',
                    verdict: 'move',
                    why: 'A **repetition level** — at which repeated field in the path did this value repeat — and a **definition level** — how many of the optional ancestors were actually present. Two integers, packed into as few bits as the schema allows, and together they encode the record structure **losslessly**, so any subset of fields can be read and the records rebuilt with a small state machine. NULLs need not be stored at all: a definition level below the maximum *is* the NULL.',
                  },
                  {
                    label: 'Keep a separate index of paths alongside the values',
                    verdict: 'dead',
                    why: 'Closer, and it puts the structural information in the wrong place. A side index has to be consulted, joined against and kept in step with the values, which reintroduces random access to a design whose entire appeal is sequential scanning. **Putting the two levels inline with each value keeps the read one pass**, and they cost bits rather than bytes.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived C-Store and Dremel — and the second one is why any of this reached your data',
              body: [
                '**C-Store’s claim is that this is not a feature, it is a different database.** Not a column-oriented storage option bolted onto a row store, but a system where the executor, the optimizer, the compression and the redundancy scheme are all rebuilt around reading. It stores overlapping **projections** — the same column kept several times in different sort orders — and treats those copies as both the index structure and the high-availability scheme. The measured result on a seven-query benchmark, in the same storage budget: **164× the commercial row store and 21× the commercial column store**, in 40% of the row store’s space.',
                '**Dremel’s claim is that columnar works on the data companies actually have.** Not star schemas — protocol buffers, thousands of fields, repeated and optional at several levels. The repetition and definition levels are the contribution, and they are what let the format escape the warehouse. *Every columnar format you have used descends from this*: Parquet is the direct externalisation of the idea, and ORC and Arrow live in the same family.',
                '**And the second contribution is the tree.** A cheap scan is still a scan; what makes it interactive is borrowing the **serving tree** from web search — push the query down, rewrite it at each level, merge partial aggregates on the way up. Column striping bought an order of magnitude over reading records; the tree bought the next one. **Together: hours to minutes to seconds**, on the same trillion-row table.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'Two stripes, a tree, and 198 files that stay shut',
      accent: 'denim',
      rung: 'Rung 3 · The reveal',
      span: 2,
      body: [
        'The columns nobody asked for are drawn in this trace on purpose. They are the argument: the whole gain is in what never gets opened, and a diagram that omitted them would be hiding it.',
        'Step 5 is the measurement people forget — the tree’s depth only matters when the *result* is large. And step 7 is the honest limit.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={columnarTrace} />
        </div>
      ),
      think: {
        q: 'A columnar layout reads a fraction of the bytes. So why is it not simply better, everywhere, including for your application database?',
        a: 'Because the win is proportional to **the fraction of fields you skip**, and it is paid for with everything a record-oriented layout does well. Fetching one whole row now means touching every stripe and reassembling the record from pieces — the measurements show assembly and parsing can each roughly double the time — so the crossover arrives sooner than people expect, **often at dozens of fields.** Writing one row means touching every stripe too, which is why C-Store needed a second, write-optimised store and a mover between them, and why nobody serves a checkout page from a column store. There is a cleaner way to see it, and this book already named it: **the RUM triangle from the Act I interlude.** A column store minimises read overhead for a certain query shape and pays in update overhead; a row store does the reverse; and neither can escape, because the trade is in the layout rather than the implementation. The practical takeaway is the same one Chapter 10 gave for incremental processing: **find the crossover before migrating, not after.** Two fields of two hundred is a rout. Most of the fields, one row at a time, is a layout you are paying for and not using.',
      },
    },
    {
      n: 'Step 04',
      title: 'What turning the data buys',
      rung: 'Rung 4 · The measurement',
      body: [
        '**C-Store, 2005, on one 3 GHz machine against two commercial systems, all given the same storage budget.** Seven TPC-H-style queries over 60 million line items. C-Store averaged **164× the row store and 21× the column store** — and the space numbers are the part worth pausing on. C-Store used **1.99 GB where the row store needed 4.48 GB**, despite C-Store storing redundant copies of columns and the row store storing none. Compression on like-typed values plus no padding to word boundaries beats not replicating at all.',
        'The paper is careful about its own claim, and so should you be: give the row store unconstrained space and the gap narrows to **6.4×**, at six times the disk. *A benchmark that fixes the storage budget is measuring something different from one that does not*, and this one says so explicitly.',
        '**Dremel, 2010, at the other end of the scale.** Counting terms in one field of an 85-billion-record table: MapReduce over records took **hours**; the same MapReduce over columnar data took **minutes**; Dremel took **seconds**. Two order-of-magnitude steps, and they came from different places — the first from the layout, the second from the serving tree. Reading 0.5 TB of columnar data instead of 87 TB of records is the whole of the first step.',
        '**And it scales the way you would hope and rarely get.** A top-20 query over a trillion-row table ran on 1,000 through 4,000 nodes: total CPU time stayed almost constant at about **300,000 seconds**, while the wall-clock time fell near-linearly. *A bigger system was not less efficient — it was the same efficiency, delivered sooner*, which is the property that makes interactive analysis over petabytes possible at all. In a typical month, most queries finished **under 10 seconds**.',
      ],
      diagram: <ColumnLayoutDiagram />,
    },
    {
      n: 'Step 05',
      title: 'The two integers that made it work on real data',
      rung: 'Rung 5 · The mechanism',
      body: [
        'This is the part of the Dremel paper people skim, and it is the part that put columnar storage into everything. **A stripe of values loses the shape of the record it came from.** Two language codes sitting next to each other: two languages in one document, or one language in each of two documents? The values cannot say.',
        'So each value carries a **repetition level** — *at which repeated field in this field’s path did the value repeat* — where 0 always means a new record has started. And a **definition level** — *how many of the optional or repeated ancestors were actually present*. The second one is what lets NULLs disappear from storage entirely: a definition level below the maximum for that path **is** the NULL, and it also says at which level the record stopped existing.',
        'Read the figure a row at a time and the encoding stops being mysterious. Then note the engineering around it: levels are packed into as few bits as the schema requires, they are omitted where they cannot vary, and reassembly is a **finite state machine over the levels** — one whose states are exactly the fields you asked for, so reading a subset builds a smaller, cheaper machine.',
        'And notice what this buys beyond storage. Because the levels travel with the values, **a query can aggregate within a record without ever reassembling it.** Dremel counts records where the sum of one deeply nested repeated field exceeds the sum of another, reading **13 GB out of a 70 TB table in 15 seconds** — a query that on record-oriented storage would have been unaffordable to ask.',
      ],
      diagram: <RepetitionLevelDiagram />,
    },
    {
      n: 'Step 06',
      title: 'The bill — and the divorce',
      accent: 'terra',
      rung: 'Rung 6 · What the split costs',
      body: [
        '**Single-row work becomes expensive in exactly the way single-field work used to be.** Fetching a whole record means reading every stripe and rebuilding it; writing one means touching every stripe. That is not a tuning problem, it is the layout, and it is why C-Store needed a write store, a read store and a mover — three components where a row store had one.',
        '**Loading is now a real system.** Data arrives from the transactional side and has to be sorted, encoded, compressed, striped and written, often into several projections in different sort orders. C-Store’s answer to availability is to keep **overlapping projections in different sort orders** and call the redundancy K-safety, which is elegant and means the load does more work than the row count suggests.',
        '**Freshness becomes a negotiation.** The transactional system has the truth as of now; the analytical copy has it as of the last load. Every question about “why does the dashboard disagree with the admin page” traces back to this gap, and the gap is a design parameter nobody wrote down. *Chapter 12 made this measurable for caches; almost nobody does it for warehouses.*',
        '**And the divorce turns out to be permanent.** Two systems, two copies of all the data, two teams, and a pipeline between them that becomes a full-time job and the most common source of wrong numbers in a company. **The whole “modern data stack” — ingestion, transformation, orchestration, observability — is an industry that exists to service this one architectural split.** It was the right call: the layouts genuinely are opposite. But it is worth seeing clearly what the right call cost.',
      ],
      callout: {
        kind: 'bad',
        big: 'THE CROSSOVER IS AT DOZENS OF FIELDS',
        text: 'Retrieval time grows linearly with the number of columns read, and record assembly and parsing can each roughly double it. Two of two hundred is a rout; most of them, one row at a time, is a layout you are paying for and not using.',
      },
    },
    {
      n: 'Step 07',
      title: 'What it begat — and where it stands in 2026',
      rung: 'Rung 7 · Descendants',
      body: [
        '**C-Store became Vertica**, and the argument it was making — that analytics deserves a purpose-built engine rather than a mode of an OLTP database — won so completely that it is invisible. Every serious analytical system since is columnar, vectorised and compression-aware: Redshift, BigQuery, ClickHouse, DuckDB, Snowflake. Even the row stores gave in, adding columnar indexes and column-store engines for exactly this workload.',
        '**Dremel became Parquet, and Parquet became the substrate.** The repetition and definition levels are in the Parquet spec essentially unchanged, which means they are in your data lake right now, under Spark and Trino and DuckDB and every lakehouse table format. Dremel itself became **BigQuery**. *The 2010 paper is the most quietly load-bearing document in this act* — not because of the system, but because of the format.',
        '**And then the divorce started to heal, slowly.** DuckDB put a serious column store inside a single process, so analytics stopped requiring a cluster at all. Arrow made a shared in-memory columnar representation that tools pass between themselves without re-encoding. HTAP systems and column-store indexes try to serve both workloads from one engine. **The RUM triangle has not moved** — the trade is still real — but the number of copies you need to make it has been falling.',
        '**2026 status: columnar is the default for anything analytical, and the interesting arguments moved up a layer.** Nobody debates the layout any more. The live questions are about the table format on top of the files — who owns the metadata, how do you get transactions over object storage, how do you avoid rewriting a petabyte to change one row — which is the next chapter’s territory, and the reason it is about elasticity rather than speed.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Column stripe.',
      body: 'All values of one field, stored contiguously. The unit that makes a scan read only what the query named.',
    },
    {
      term: 'Projection.',
      body: 'C-Store’s unit of storage: a group of columns sorted on the same key. The same column can appear in several, sorted differently.',
    },
    {
      term: 'Tuple mover.',
      body: 'The component that batches rows from the write-optimised store into the read-optimised one. An LSM tree wearing a different hat.',
    },
    {
      term: 'Repetition level.',
      body: 'Which repeated field in a value’s path the value repeated at. Zero means a new record starts here.',
    },
    {
      term: 'Definition level.',
      body: 'How many optional or repeated ancestors were actually present. Below the maximum, it encodes a NULL and where the record stopped.',
    },
    {
      term: 'Serving tree.',
      body: 'A query pushed down through levels of servers, rewritten at each, with partial aggregates merged on the way back up. Borrowed from web search.',
    },
  ],
  inTheWild: {
    note: '5 ways this bites in production',
    points: [
      '**Somebody selects every column.** It reads every stripe and reassembles every record — the exact workload the layout is worst at — and then the team concludes the warehouse is slow. The fix is a habit, and the habit has to be taught, because in a row store the same query genuinely did not matter.',
      '**Point lookups migrate onto the analytical system.** A dashboard needs one row, then an application does, then something latency-sensitive does. Each step is reasonable, and the endpoint is an OLTP workload on a store whose write path is a batch loader.',
      '**Small files eat the gains.** Streaming ingestion produces thousands of tiny stripes, and per-file overhead swamps the scan advantage. Compaction becomes a permanent background job that somebody has to own, and it is the single most common operational complaint in a lakehouse.',
      '**Nested data gets flattened defensively.** A team that does not trust repetition and definition levels normalises everything into flat tables first, and rebuilds the joins at query time. It works, and it is the cost the 2010 paper existed to remove.',
      '**The two copies disagree and nobody can say why.** The dashboard and the admin page show different numbers, and the answer is somewhere in a pipeline with three hops and no freshness metric. **The gap between the systems is a design parameter, and it is almost never written down.**',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Go columnar',
        when: 'queries read a small fraction of the fields and a large fraction of the rows, and the questions are not known in advance. That combination is the whole case, and when it holds the win is measured in orders of magnitude rather than percentages.',
      },
      {
        choose: 'Stay row-oriented',
        when: 'you fetch or modify whole records. The crossover is at dozens of fields read, and it arrives sooner still if you have to write. **Being able to state where your crossover is beats having an opinion about layouts.**',
      },
      {
        choose: 'Batch the rearrangement',
        when: 'the layout that makes reads fast makes writes expensive. A small write-optimised store plus a mover into the read-optimised one is the same answer as the LSM tree in Chapter 3, and it keeps showing up because the problem keeps recurring.',
      },
      {
        choose: 'Keep the structure inline',
        when: 'your data is nested and you are tempted to normalise it first. Two integers per value cost bits and preserve everything; a normalisation step costs a pipeline and a schema you have to keep right.',
      },
    ],
  },
  misconception: {
    think: '“A column store is a row store that compresses better.”',
    actually:
      'Compression is a *consequence*, not the mechanism. The mechanism is that a query reads only the fields it names, so the I/O falls by the ratio of fields wanted to fields that exist — two of two hundred is a hundredfold reduction before a single byte is compressed. Compression then piles on top, and it works far better here for a structural reason: **a stripe is all one type and often near-sorted**, which is a much friendlier input than a page carrying two hundred mixed fields. But the deeper reason it is not a storage option is what the layout does to the rest of the system. C-Store’s argument is that once you turn the data, the executor has to change — it should work on the compressed representation rather than decompressing first — and so does the optimizer, and so does the redundancy scheme, which becomes overlapping copies of columns in different sort orders that serve as both index and replica. That is why the paper describes a *different DBMS* rather than a feature, and why its measured result is 164× rather than 3×. And it is why the split became permanent: this is not a knob on your transactional database, it is a second system with opposite trade-offs, and the pipeline between them is the price of admission.',
  },
  sources: [
    {
      year: '2005',
      title: 'C-Store: A Column-oriented DBMS — Stonebraker, Abadi, Madden, O’Neil, Zdonik et al. (VLDB)',
      url: 'https://web.stanford.edu/class/cs245/readings/c-store.pdf',
      note: 'Read **§1 and §2** for the write-optimised versus read-optimised framing, which is the cleanest statement of the argument anywhere, and **§9** for the benchmark — noting that its most interesting number is about space rather than speed. The projections idea in §2 is the part that did not survive intact into modern systems, and it is worth understanding why: it asks you to know your sort orders in advance.',
    },
    {
      year: '2010',
      title: 'Dremel: Interactive Analysis of Web-Scale Datasets — Melnik, Gubarev, Long, Romer, Shivakumar, Tolton & Vassilakis (VLDB)',
      url: 'https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/36632.pdf',
      note: 'The most quietly influential paper in this act, because **§4 is the Parquet format**. Read §4.1 slowly with Figure 3 beside it until the repetition and definition levels click — it takes twenty minutes and it explains a file format you almost certainly already have. Then §6 for the serving tree, and §7 for the crossover measurement that tells you when *not* to do any of this.',
    },
    {
      year: '2013',
      title: 'The Design and Implementation of Modern Column-Oriented Database Systems — Abadi, Boncz, Harizopoulos, Idreos & Madden',
      url: 'https://www.cs.umd.edu/~abadi/papers/abadi-column-stores.pdf',
      note: 'The survey to read after the two papers, by several of the people who wrote them. It separates what actually makes column stores fast — late materialisation, operating directly on compressed data, vectorised execution, block iteration — from what people assume does. If you only read one thing on this topic after this chapter, read this instead of a vendor blog.',
    },
    {
      year: '2001',
      title: 'Weaving Relations for Cache Performance — Ailamaki, DeWitt, Hill & Skounakis (VLDB)',
      url: 'https://www.vldb.org/conf/2001/P169.pdf',
      note: 'Where the hybrid layout comes from — PAX, which groups values by column *within* a page rather than across the whole table. Worth reading because it is the layout that actually won: Parquet row groups, Snowflake’s table files and ORC stripes are all this idea, and the next chapter runs on it.',
    },
  ],
  seenIn: [
    { label: 'Interlude: The RUM Triangle', to: '/papers/rum', live: true },
    { label: 'The Database GFS Deserved — Ch 3', to: '/papers/bigtable', live: true },
    { label: 'MapReduce: the Pattern, Not the Product — Ch 2', to: '/papers/mapreduce', live: true },
    { label: 'Storage engines — the comic', to: '/ddia/read/storage', live: true },
  ],
  finale: {
    title: 'The data turned ninety degrees, and the industry split in half',
    body: 'Five years and several orders of magnitude separate these two papers, and they arrive at the same instruction: stop storing records and start storing fields. C-Store argued that doing it properly means a different database — different executor, different optimizer, different redundancy — and produced a 164× benchmark to prove the point. Dremel made it work on nested records, which is what put the format under every analytical tool you use, and added a serving tree to turn a cheap scan into an interactive answer. What neither paper says out loud is what the split cost: two systems, two copies of everything, and a pipeline between them that is now an industry. Next: somebody builds the analytical half again, for a world where you rent machines by the hour — and discovers that the thing customers are actually buying is not the query engine.',
  },
  next: { title: 'Elasticity as the Product', slug: 'snowflake' },
}
