import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { ElasticityDiagram, SharedDataDiagram } from '../diagrams'
import { snowflakeTrace } from './snowflake-trace'

/* Closes Act VI. The trap in this chapter is writing a product page: the
   system is a commercial success and the paper is written by its authors, so
   the temptation is to relay the feature list.

   The defence is the lessons-learned section, which contains the genuinely
   surprising claim — core query performance was almost never what users cared
   about, because elastic compute could buy speed with money. That reframes the
   whole thing: the product was not the engine, it was that a knob existed at
   all. Everything else in the chapter should serve that argument. */

export const snowflake: Chapter = {
  slug: 'snowflake',
  act: 'Act VI · The Analytics Divorce',
  paperNo: 'Paper 16',
  title: 'Elasticity as the Product',
  dek: 'Build the analytical half again, for a world where machines are rented by the second — and find out that the thing customers are buying is not the query engine.',
  minutes: 17,
  paper: {
    title: 'The Snowflake Elastic Data Warehouse',
    authors: 'Benoit Dageville, Thierry Cruanes, Marcin Zukowski, Vadim Antonov, Artin Avanes, Jon Bock, Martin Hentschel, Allison W. Lee, Ashish Motivala et al.',
    venue: 'ACM SIGMOD',
    year: '2016',
    url: 'https://homepages.cwi.nl/~boncz/lsde/papers/p215-dageville-snowflake.pdf',
  },
  caption:
    'Chapter 15 established the layout and the split: analytics gets its own system, its own copy of the data, and a pipeline in between. Every warehouse built on that insight for twenty years used the same architecture underneath — **shared-nothing**, where each machine owns the rows on its own disks. It is a genuinely good design, and it makes one assumption that stopped being true. It assumes **the set of machines is fixed.** In a datacenter you own, that is nearly free. In one you rent by the second, where nodes fail routinely and you would like to hand some back at midnight, it is the constraint that governs everything.',
  steps: [
    {
      n: 'Step 01',
      title: 'What shared-nothing assumes, and what the cloud does about it',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'Shared-nothing won the warehouse for good reasons. **Each node owns the rows on its local disks**, so a star-schema join broadcasts a small dimension table and everything else is local; there is no contention for shared structures and no need for exotic hardware. Every node has the same job and the same shape, which makes the software clean. This is the architecture, and the paper is not arguing it was wrong.',
        'It couples compute to storage, though, and the paper names three places that hurts. **Heterogeneous workloads:** the machine that is right for bulk loading — heavy I/O, light CPU — is wrong for complex queries, so a fixed configuration is a compromise both jobs pay for. **Membership changes:** add, remove or lose a node and large amounts of data must be reshuffled *by the same machines that are supposed to be answering queries*. **Online upgrade:** a rolling upgrade is possible in principle and very hard when everything is tightly coupled and expected to be homogeneous.',
        'On your own hardware you absorb all three, because there is nothing to be done about it — the pool of nodes is small and fixed, upgrades are rare, and so are failures and resizes. **In the cloud every one of those premises inverts.** There are dozens of node types available for the asking. Node failures are frequent, and performance varies dramatically *even between machines of the same type*. And the paper puts the consequence sharply: **membership changes are not an exception, they are the norm.**',
        'Then the data changed too. The old warehouse assumed data arriving from systems inside the company — ERP, CRM, transactional databases — predictable in structure, volume and rate. The new data is application logs, mobile events, sensors and web APIs: **external, fast-moving, and frequently schema-less.** A design whose whole method is deep ETL pipelines and physical tuning is at odds with data that does not hold still.',
      ],
      code: {
        file: 'what_changed.txt',
        lines: [
          { t: 'on your own hardware:' },
          { t: '  fixed pool of nodes    · resize is rare' },
          { t: '  failures are incidents · upgrades are events' },
          { t: '  data arrives from inside the company' },
          { t: '' },
          { t: 'on rented hardware:' },
          { t: '  dozens of node types available now' },
          { t: '  failures are weather, not incidents', hl: 'bad' },
          { t: '  membership change is the normal case', hl: 'bad' },
          { t: '  data arrives as JSON from strangers' },
          { t: '' },
          { t: '# same workload. every premise inverted.' },
        ],
      },
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'Three questions. The first is the architectural break; the second is what the storage system forces on you; and the third is how you get the performance back after giving away the thing that made shared-nothing fast.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**The platform:** rented machines. Many types, frequent failures, and performance that varies between identical instances.',
              '**The workload:** analytical, and lumpy — a nightly load that wants many machines for two hours, dashboards that want a few all day, and long quiet periods.',
              '**The storage available:** an object store. Extremely durable, cheap, high latency, and it can only write whole objects — no appends, and the size must be declared up front.',
              '**The users:** they are buying a service. No machines to provision, no DBAs to hire, and the design goal is that there are **no tuning knobs at all**.',
              '**The data:** relational, plus a large and growing share of schema-less JSON that nobody wants to model in advance.',
            ],
            questions: [
              {
                q: 'Shared-nothing is the state of the art for warehouses. What is wrong with it here?',
                options: [
                  {
                    label: 'Nothing — use it, and add replication for the failures',
                    verdict: 'dead',
                    why: 'Replication softens node loss and does nothing about the other two problems. **Resizing still means reshuffling data with the machines that are answering queries**, so elasticity is throttled by exactly the resource you were trying to add. And an upgrade eventually touches every node, which is very hard when every node is stateful, tightly coupled and assumed identical.',
                  },
                  {
                    label: 'Separate storage from compute: data in an object store, compute as disposable clusters',
                    verdict: 'move',
                    why: 'Break the coupling and every one of those problems changes category. **Resizing moves no data**, because compute owns none. Failures become rescheduling rather than repair. Different workloads can run on differently-sized clusters over the same tables, with no copies. And upgrades stop being a rolling data migration. *You have traded local disk latency for the ability to change your mind about the hardware*, and the rest of the design is about paying that back.',
                  },
                  {
                    label: 'Shared-disk over a fast networked filesystem',
                    verdict: 'dead',
                    why: 'The right instinct with the wrong economics — and it is the architecture shared-nothing beat in the first place, because the shared storage becomes a bandwidth and contention bottleneck and usually needs specialised hardware. An object store is different in kind: massively parallel, effectively unlimited, and cheap, at the cost of high per-request latency. **The latency is the thing you must engineer around, and it is a better problem than contention.**',
                  },
                  {
                    label: 'Build your own storage service on HDFS or similar',
                    verdict: 'dead',
                    why: 'Seriously considered and rejected, and the reasoning is worth copying. **Its usability, availability and durability guarantees were hard to beat** — so the energy went into caching and skew resilience in the compute layer instead of into re-implementing a storage system. Building the layer below you is nearly always available and nearly always the more expensive answer.',
                  },
                ],
              },
              {
                q: 'Your storage rewrites whole objects, cannot append, and answers in tens of milliseconds. What does that do to your table format?',
                options: [
                  {
                    label: 'Keep mutable pages and write them back on change',
                    verdict: 'dead',
                    why: 'You cannot: a whole object must be rewritten to change a byte of it, and its size declared up front. Even if you could, rewriting a large file to update one row is exactly the write amplification Chapter 14 spent a chapter removing. **The storage API is not a detail here — it is a constraint with the force of physics**, and the format has to be designed from it.',
                  },
                  {
                    label: 'Large immutable files, columns grouped inside them, read by byte range',
                    verdict: 'move',
                    why: 'Files are written once and never modified. Inside each, values are grouped by column and compressed — the **hybrid columnar** layout, rather than one file per column — with a header giving each column’s offset. Because the object store *will* serve a byte range, a query fetches the header and only the columns it wants. And immutability pays again immediately: a table version becomes **a set of files**, which gives snapshot isolation, and then time travel, undrop and zero-copy cloning fall out of the same mechanism.',
                  },
                  {
                    label: 'Use the object store as a backup and keep the working set on local disks',
                    verdict: 'dead',
                    why: 'Then the local disks are authoritative and you have re-coupled compute to storage, with all three problems back. It also spends local SSD on replicating the entire dataset, most of which is cold — when the same disk is far more valuable holding **only the hot subset and the temporary spill**, which is what the winning answer does.',
                  },
                  {
                    label: 'Small files, so that rewriting one is cheap',
                    verdict: 'dead',
                    why: 'Every request to an object store carries fixed latency and real CPU overhead, so many small objects turn one scan into thousands of high-latency calls. This is the single most common way a lakehouse gets slow, and the remedy — background compaction — is an ongoing job somebody has to own. **Large immutable files plus range reads gets both properties**; small files gets neither.',
                  },
                ],
              },
              {
                q: 'Compute now owns nothing, so every query could re-download everything. How do you get the speed back?',
                options: [
                  {
                    label: 'Pin each file to a node permanently',
                    verdict: 'dead',
                    why: 'Congratulations, you have rebuilt shared-nothing. Now a resize or a failure means reassigning ownership and moving data again, which is the property you gave up local disks to escape. **The cache must be an optimisation the system can lose at any moment**, or it is not a cache — it is the storage layer wearing a disguise.',
                  },
                  {
                    label: 'Cache on local disk, assign files by consistent hashing, and rebalance lazily',
                    verdict: 'move',
                    why: 'Each worker keeps an LRU cache of the file headers and columns it has read, and the optimizer routes a given file to the same worker each time by **hashing its name** — so caches actually hit instead of every node holding a bit of everything. And the hashing is **lazy**: when the cluster resizes or a node dies, nothing is shuffled. Assignments simply change, and the caches drift into their new shape over the following queries. *Nothing has to move, because nothing was owned.*',
                  },
                  {
                    label: 'No cache — the object store is fast enough in aggregate',
                    verdict: 'dead',
                    why: 'Aggregate bandwidth is not the problem; per-request latency and CPU overhead are, especially over HTTPS. Analytical queries touch the same files repeatedly across a session, and paying full remote cost every time is the difference between a warehouse and a batch job. The paper is explicit that once caches are warm, performance **approaches or exceeds** a pure shared-nothing system.',
                  },
                  {
                    label: 'Cache, and rebalance eagerly whenever membership changes',
                    verdict: 'dead',
                    why: 'You have reintroduced the original problem in miniature: a membership change now triggers a burst of data movement, using the nodes that are meant to be running queries, at exactly the moment the cluster is already degraded. **Lazy is not laziness here** — it is a refusal to spend the scarce resource on restoring an optimisation that will restore itself.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived Snowflake — and the lesson the authors say surprised them',
              body: [
                '**Three layers, and only two of them hold anything.** Object storage holds the tables. Virtual warehouses are pure compute — created, resized and destroyed on demand, with no effect on the database, and the paper actively encourages shutting them all down when nobody is querying. Cloud services holds the metadata, optimizer, transactions and access control, and is the only stateful part besides the storage. *Each individual query runs on exactly one warehouse*, so workloads cannot interfere with each other even though they share every byte.',
                '**Immutability is spent four times over.** Files are written once, so a table version is a set of files, so snapshot isolation is bookkeeping rather than locking. Keep the removed files for up to **90 days** and you have time travel — read the table as of five minutes ago, or before a specific statement id. Keep the same list and you have `UNDROP`. Copy the list rather than the bytes and **cloning a multi-terabyte table is instant and free.**',
                '**And here is the finding, from the lessons-learned section.** Core query performance turned out to be *almost never* what users cared about — because **elastic compute can buy speed with money.** A load taking 15 hours on 4 nodes takes about 2 hours on 32, at roughly the same number of node-hours. Same bill, different afternoon. The authors report that today the system has **exactly one tuning parameter: how much performance you want and are willing to pay for.** The product was not the engine. It was that a knob existed at all.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'Two clusters, one copy, nothing that has to move',
      accent: 'denim',
      rung: 'Rung 3 · The reveal',
      span: 2,
      body: [
        'Watch what the arrows do *not* do. The warehouses never talk to each other, never own a file, and can be destroyed mid-query without the database noticing. Everything durable is on the right; everything that knows anything is on the left; the middle is rented.',
        'Step 5 has the detail worth stealing, and step 6 is one design decision being spent four times.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={snowflakeTrace} />
        </div>
      ),
      think: {
        q: 'Aurora, in Chapter 14, also separated compute from storage. Why is this a different architecture rather than the same idea for analytics?',
        a: '**Because of what the storage tier knows.** Aurora’s storage is bespoke and *smart*: it understands redo records, applies them, materialises pages, gossips with its peers, and holds a quorum. That intelligence is what lets a single writer avoid consensus and recover in ten seconds — and it is also why you can only get Aurora from the company that built the storage service. Snowflake’s storage is **deliberately stupid**: a commodity object store that knows nothing about tables, columns or transactions and offers PUT, GET and DELETE. Every ounce of intelligence lives above it, in the compute layer and the services layer, which is why the paper can say in passing that any blob store would do. The consequences follow from that split. Aurora is one writer and up to fifteen readers against one volume — a database made elastic in its reading. Snowflake is any number of independent clusters against a shared, immutable file set, none of which owns anything — **compute made genuinely disposable**, which is only affordable because analytical work is read-mostly and can be redone. *Two systems reached “separate storage from compute” from opposite directions, and the one that put the cleverness in storage got fast recovery, while the one that kept storage dumb got elasticity.* Neither is the better answer; they are answers to different questions, and knowing which question you have is the actual skill.',
      },
    },
    {
      n: 'Step 04',
      title: 'The number that reframes the whole system',
      rung: 'Rung 4 · The measurement',
      body: [
        'The paper puts this in a single aside and then calls virtual-warehouse elasticity **one of the biggest benefits and differentiators of the whole architecture**, which is a strong claim for a paragraph without a graph. Here it is: *a data load which takes 15 hours on a system with 4 nodes might take only 2 hours with 32.*',
        'Do the arithmetic, because that is where it stops being a performance note and becomes an argument about products. Four nodes for fifteen hours is 60 node-hours. Thirty-two nodes for two hours is 64. **You pay by the node-hour, so those cost about the same** — and one of them finishes before lunch. *Wall-clock time became something you can buy, at roughly a flat exchange rate, and that is not a property any on-premise warehouse could offer at any price.*',
        'Which makes sense of the finding in the lessons-learned section that would otherwise be strange coming from database authors. **Core performance was almost never an issue for their users** — not because the engine is uninteresting (it is columnar, vectorised and push-based, and they say plainly that being able to use 1,000 nodes is worth little if someone else does it with 10) but because **when a query is too slow, the answer is a bigger warehouse, and the bill barely moves.**',
        'The rest of the elasticity story is the same trick pointed at operations. Because compute owns nothing, **two versions of the service run side by side** — two sets of cloud services against one metadata store, with warehouses of different versions *sharing the same worker nodes and their caches*, so an upgrade does not even cost a cold cache. They shipped **weekly** on that basis and could downgrade in a hurry when something was wrong. And the availability picture falls out of the same shape: storage and services span availability zones, while a warehouse deliberately does not, because network throughput within a zone is much better — if a worker dies, **the query fails and is transparently re-executed**, possibly with a node from a standby pool.',
      ],
      diagram: <ElasticityDiagram />,
    },
    {
      n: 'Step 05',
      title: 'No knobs, on purpose',
      rung: 'Rung 5 · The design stance',
      body: [
        'The most unusual thing about this paper is a constraint the authors imposed on themselves: **no physical design, no tuning, no storage grooming on the part of users.** That is a strange goal for a database, and it explains several decisions that look arbitrary until you see what they are avoiding.',
        '**No indexes.** They rely on random access, which is wrong for object storage and compressed files; they inflate data volume and load time; and — decisively — **the user has to decide they should exist.** Instead, min/max metadata per column per file eliminates files a predicate cannot match. It needs no user input, it scales, it costs almost nothing to maintain, and it suits sequential scanning. *A worse mechanism that nobody has to think about beat a better one that needs an expert.*',
        '**No schema for semi-structured data.** Rather than making users model their JSON, the system analyses the documents in each file, infers which typed paths are common, and **pulls those out into ordinary compressed columns** — so schema-less data gets columnar storage and pruning without anyone declaring anything. The authors say they hoped this would be useful and were **surprised by the speed of adoption**: they had found organisations using Hadoop for two things, storing JSON and converting it into something a database could load, and this replaced both.',
        '**And no cluster sizing in the traditional sense.** Warehouses come in T-shirt sizes rather than node counts, which lets the service change what a size means underneath without changing anybody’s mental model. Put it together with everything above and you reach the sentence from the lessons section: **the system has one tuning parameter, and it is how much performance you want to pay for.**',
      ],
      diagram: <SharedDataDiagram />,
      deeper: {
        summary: 'Why “no knobs” is a harder engineering constraint than it sounds, and what it forces',
        body: [
          'Every tuning knob is a decision the system has declined to make, handed to somebody with less information about the internals and more information about the workload. Removing the knob means the system must make the decision — which means it must be **right often enough that nobody misses the knob**, and must degrade gracefully when it is wrong.',
          'That constraint is what selects for the mechanisms in this chapter. Min/max pruning over indexes, because pruning needs no declaration. LRU caching oblivious to individual queries, because a query-aware policy would need hints. Lazy consistent hashing, because eager rebalancing would need a policy about when. File stealing, because static work assignment would need to know the machines are equal, and in a rented datacenter they are not.',
          'It also forces the operational posture. If users cannot tune, then every performance regression is **the vendor’s problem**, which is only survivable if you can ship a fix quickly — hence weekly upgrades, continuous downgrade testing, and a single production version. *The no-knobs promise and the online-upgrade machinery are the same decision seen from two ends*, and neither works without the other.',
        ],
      },
    },
    {
      n: 'Step 06',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 6 · What renting costs',
      body: [
        '**Cold is genuinely cold.** All the performance claims assume warm caches. A new warehouse, a resized one, or one that has not run this query before reads from the object store at object-store latency, and the first runs are visibly slower. **Elasticity and cache warmth are in direct tension** — the more freely you create and destroy clusters, the less often anything is warm.',
        '**Isolation is bought with duplication of compute.** Worker nodes are not shared between warehouses, which is what makes performance isolation strong and also means idle capacity in one cluster cannot help a busy one. The paper flags worker sharing as future work for precisely this reason: it would raise utilisation, at the cost of the isolation that was the selling point.',
        '**A failure mid-query costs the whole query.** Warehouses live inside one availability zone for network throughput, and partial retries are not performed — a node failure means the query is re-executed from the start. The paper is candid that **very large, long-running queries are an area of concern**, which is exactly where re-execution hurts most.',
        '**Time travel is storage you are paying for.** Retaining removed files for up to 90 days is what makes time travel, undrop and cloning work, and it means a table that is rewritten frequently keeps many versions of itself on a meter. This is a good trade and it is not a free feature.',
        '**And the one knob is a money knob.** “Make it faster” and “spend more” became the same action, which is wonderful for the user experience and does something to organisations that the paper does not discuss: **the cost of a badly written query is now a line item rather than a slow afternoon**, and somebody has to notice. The FinOps industry that grew up around cloud data warehouses is the bill for the knob being that easy to turn.',
      ],
      callout: {
        kind: 'bad',
        big: 'THE WARM CACHE IS DOING THE WORK',
        text: 'Performance approaches shared-nothing once caches are warm — and elasticity is the practice of creating and destroying the machines that hold them. The more freely you resize, the more often you pay object-store latency.',
      },
    },
    {
      n: 'Step 07',
      title: 'What it begat — and where it stands in 2026',
      rung: 'Rung 7 · Descendants',
      body: [
        '**Separated storage and compute became the definition of a cloud data platform.** BigQuery had arrived there from the Dremel side; Databricks built the lakehouse on the same split; Redshift added RA3 nodes and then Serverless to retrofit it. **The argument is over, and the interesting part is that it was won by an architecture whose storage layer is deliberately unintelligent.**',
        '**The immutable-file-set idea became the open table formats.** Iceberg, Delta Lake and Hudi are all versions of *a table is a list of immutable files, and a commit swaps the list* — which gives them snapshot isolation, time travel and cheap cloning by the same route as this paper. The difference is that the metadata is now an open specification rather than a vendor’s service, which is where the competition has moved.',
        '**The zero-copy sharing idea turned into a market.** If a table is a list of files and compute is disposable, then letting another organisation query your data means granting access to a list — no export, no copy, no pipeline. That became data sharing and then data marketplaces, and it is the part of the architecture that had the least to do with databases and the most to do with the business.',
        '**2026 status: the split is assumed, and the arguments are about the metadata layer and the bill.** Who owns the catalog, whether the table format is open, whether compute can be brought to somebody else’s storage — and, increasingly, whether the elasticity that made wall-clock time cheap has made compute spending impossible to reason about. *The engineering question of Act VI was answered. The one it created is an accounting question.*',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Virtual warehouse.',
      body: 'A cluster of compute nodes, sized by T-shirt rather than node count, created and destroyed on demand. It owns no data and can be shut down without effect.',
    },
    {
      term: 'Multi-cluster shared data.',
      body: 'Many independent compute clusters over one shared, immutable file set. Isolation without copies, which is what data marts existed to provide.',
    },
    {
      term: 'Pruning.',
      body: 'Skipping a file because the min and max of a column in it cannot satisfy the predicate. An index that requires no decision from anybody.',
    },
    {
      term: 'File stealing.',
      body: 'An idle worker taking ownership of an unprocessed file from a busy peer — and downloading it from storage, not from the peer it just helped.',
    },
    {
      term: 'Time travel.',
      body: 'Reading a table as of an earlier moment, because the files a write removed are retained for up to 90 days rather than deleted.',
    },
    {
      term: 'Zero-copy clone.',
      body: 'Duplicating a table by copying its list of files rather than its bytes. Instant at any size, and it costs nothing until something is written.',
    },
  ],
  inTheWild: {
    note: '5 ways this bites in production',
    points: [
      '**The first query after a resize is slow, and nobody expects it.** Caches are per node and the cluster just changed shape. Benchmarks run on warm clusters and production runs on whatever exists at 6am, so the numbers in the design doc and the numbers in the dashboard never match.',
      '**Somebody leaves a large warehouse running.** Auto-suspend is a setting, and settings have defaults, and a cluster sized for the nightly load spends the weekend idle and billed. The elasticity that makes speed cheap makes forgetting expensive.',
      '**A long query dies on a node failure and starts again from the beginning.** There are no partial retries, so the longer the query the worse the exposure — and the queries most likely to be long are the ones least likely to have been broken into steps.',
      '**Small files accumulate from streaming ingestion.** Frequent micro-batches produce many small objects, per-request overhead swamps the scan, and pruning gets worse because each file’s min/max range covers less. Compaction becomes a background job somebody owns forever.',
      '**Time travel retention quietly doubles storage.** A table rewritten daily with 90-day retention keeps ninety versions of itself. The feature is excellent and the invoice is real, and the two facts usually meet in a quarterly review.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Separate storage from compute',
        when: 'the machines are rented and the workload is lumpy. It converts resizing, failover and upgrade from data-movement problems into scheduling problems, and scheduling problems are much easier. **On fixed hardware with a steady workload, shared-nothing is still the better answer.**',
      },
      {
        choose: 'Make the files immutable',
        when: 'you want snapshot isolation, time travel, cheap clones and safe concurrent readers. One decision buys all four, because a version becomes a list rather than a state. The price is compaction and retained storage, and both are ongoing.',
      },
      {
        choose: 'Remove the knob rather than document it',
        when: 'the system has more information than the user does — cache policy, work assignment, file layout. A slightly worse mechanism nobody has to think about beats a better one that needs an expert. **But you now own every regression**, which only works if you can ship fixes quickly.',
      },
      {
        choose: 'Buy the wall-clock time',
        when: 'you pay per node-hour and the work parallelises. Doubling the cluster to halve the runtime is close to free, and treating that as a routine move rather than an escalation is the actual shift this chapter is about.',
      },
    ],
  },
  misconception: {
    think: '“Snowflake won because it was faster.”',
    actually:
      'Its own authors say the opposite, in the lessons-learned section: **core performance turned out to be almost never an issue for their users.** Not because the engine is weak — it is columnar, vectorised and push-based, and they are explicit that using 1,000 nodes is worth little if somebody else does the job with 10 — but because **when a query is too slow, the fix is a bigger warehouse, and the bill barely changes.** A load taking 15 hours on 4 nodes takes about 2 on 32, and you pay by the node-hour, so those cost roughly the same. Wall-clock time became purchasable at a flat rate, which no on-premise warehouse could offer at any price. Everything distinctive follows from that rather than from speed: workloads get their own clusters instead of their own copies, so data marts stop being necessary; clusters shut down when idle, so quiet periods cost nothing; upgrades happen weekly with two versions running side by side because no cluster owns anything worth preserving. And the design goal underneath all of it is the one that reads oddly for a database paper — **no physical design, no tuning, no grooming** — which is why there are no indexes, why the cache policy is plain LRU, and why the system ended up with, in their words, exactly one tuning parameter: how much performance you want and are willing to pay for.',
  },
  sources: [
    {
      year: '2016',
      title: 'The Snowflake Elastic Data Warehouse — Dageville, Cruanes, Zukowski et al. (SIGMOD)',
      url: 'https://homepages.cwi.nl/~boncz/lsde/papers/p215-dageville-snowflake.pdf',
      note: 'Read **§2** first — it is three paragraphs on why shared-nothing does not fit rented hardware, and it is the clearest statement of the argument anywhere. Then **§3.2.2** for caching, lazy consistent hashing and file stealing, which is the most transferable engineering in the paper. **§6, Lessons Learned**, contains the claim the chapter is built on and is unusually candid for a paper written by a vendor about its own product.',
    },
    {
      year: '2020',
      title: 'Building An Elastic Query Engine on Disaggregated Storage — Vuppalapati et al. (USENIX NSDI)',
      url: 'https://www.usenix.org/system/files/nsdi20-paper-vuppalapati.pdf',
      note: 'Snowflake again, four years later, with **statistics from 70 million queries** — the empirical companion to the 2016 design paper. It is the better read if you want to know what these workloads actually look like: how skewed query sizes are, how much of the data is read repeatedly, and how badly a fixed cluster would have fit. Also the source of the ephemeral-storage-tier argument.',
    },
    {
      year: '2017',
      title: 'Amazon Aurora: Design Considerations for High Throughput Cloud-Native Relational Databases — Verbitski et al. (SIGMOD)',
      url: 'https://pages.cs.wisc.edu/~yxy/cs764-f20/papers/aurora-sigmod-17.pdf',
      note: 'Chapter 14 here, and the instructive contrast. Both papers separate compute from storage in the same year-ish and reach opposite conclusions about how clever the storage tier should be. Read them back to back and the trade is plain: a smart storage tier bought Aurora ten-second recovery and a single writer; a dumb one bought Snowflake genuinely disposable compute.',
    },
    {
      year: '2021',
      title: 'Lakehouse: A New Generation of Open Platforms that Unify Data Warehousing and Advanced Analytics — Armbrust et al. (CIDR)',
      url: 'https://www.cidrdb.org/cidr2021/papers/cidr2021_paper17.pdf',
      note: 'Where the argument went next. If a table is a list of immutable files in an object store, the interesting question becomes who owns that list — and this is the case for it being an open specification rather than a vendor service. Read it as the direct sequel to this chapter, and note how much of the mechanism is identical.',
    },
  ],
  seenIn: [
    { label: 'Reading Sideways — Ch 15', to: '/papers/columnar', live: true },
    { label: 'The Log Made Literal — Ch 14', to: '/papers/aurora', live: true },
    { label: 'The Most Common Derived Copy — Ch 12', to: '/papers/memcache', live: true },
    { label: 'S3 — the deep dive', to: '/ddia/components/s3', live: true },
  ],
  finale: {
    title: 'Act VI closes: the layout was the easy part',
    body: 'Two chapters, and they answer different halves of the same divorce. Chapter 15 was about the layout — one field of every row rather than every field of one row, which is a genuinely different problem needing a genuinely different database, and the split it created is still with us. This chapter rebuilt the analytical half for machines you rent, and the surprise is where the value landed. Not in the engine, which is good and which the authors say users rarely noticed, but in the fact that compute owns nothing: so clusters can be created for one job and destroyed after it, so two workloads share every byte without sharing a machine, so wall-clock time is something you buy at a flat rate. Next: the epilogue, and an argument this book started in Act II. Amazon threw away the master to keep the checkout button alive, and fifteen years later the system that carries its name runs a leader per partition group, splits ranges when they get hot, and will sell you a strongly consistent read. Nobody announced it. The argument ended in a draw.',
  },
  next: { title: 'The Retreat', unwritten: true },
}
