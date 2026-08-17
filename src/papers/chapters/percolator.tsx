import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { SnapshotIsolationDiagram, CrawlRateDiagram } from '../diagrams'
import { percolatorTrace } from './percolator-trace'

/* Opens Act IV. The act's job is to put back what Act I gave away, and this is
   the attempt made under the harshest possible constraint: you may not change
   the storage system. Everything interesting in Percolator follows from that
   one restriction — locks as columns, the primary lock as the commit point,
   the client as coordinator, cleanup done lazily by strangers.

   Deliberately NOT framed as "distributed transactions, explained". The reader
   has met two-phase commit in the comics. What is new here is where you put the
   coordinator when there isn't one, and that is what the DesignIt pushes on. */

export const percolator: Chapter = {
  slug: 'percolator',
  act: 'Act IV · Buying the Promises Back',
  paperNo: 'Paper 10',
  title: 'Transactions, Hand-Rolled',
  dek: 'You need a transaction across five rows. The store gives you one row and will not be changed. Build the rest in a library — and work out where the commit point can possibly live.',
  minutes: 17,
  paper: {
    title: 'Large-scale Incremental Processing Using Distributed Transactions and Notifications',
    authors: 'Daniel Peng & Frank Dabek',
    venue: 'OSDI',
    year: '2010',
    url: 'https://www.usenix.org/legacy/event/osdi10/tech/full_papers/Peng.pdf',
  },
  caption:
    'Chapter 3 built a database on a file system that could not edit a byte, and the price it quoted was clear: **atomic updates to one row, and nothing across rows.** Nine chapters later that bill is still unpaid, and it is now being paid by the search index. Google recrawls a slice of the web, and to fold that slice in it re-runs a hundred MapReduces over the *whole* repository — because a link from a new page changes an old one. A document takes **two to three days** to reach the index. The obvious fix is to update documents one at a time, which needs transactions across rows, which nothing here has. And you cannot add them to Bigtable: it belongs to everybody.',
  steps: [
    {
      n: 'Step 01',
      title: 'The gap nothing in the building fills',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'Look at the shape of the problem before the shape of the answer. The repository is **tens of petabytes across thousands of machines**, taking **billions of updates a day**. That rules out a database — not a particular database, the category. The paper says so in the abstract and it is not being rhetorical.',
        'MapReduce is the other option and it is the one they were using. It fails for a different reason: **it has no way to touch a small part of anything.** Re-index a thousand new pages and you re-read every page you already had, because you cannot know which old page one of the new links points at without looking. Latency is set by the size of the repository, not the size of the change, which is a strange sentence and a fatal one.',
        'So the requirement is: random access into a multi-petabyte store, many machines mutating it at once, and enough consistency that a programmer can write `if there is no canonical URL for this hash, make me the canonical one` and have it be true afterwards. Without transactions an ill-timed crash leaves a document row pointing at a duplicates entry that does not exist, permanently, in a repository nobody rebuilds any more.',
        'And here is the constraint that makes the chapter. **Bigtable cannot be modified.** It is Act I’s product, it is shared by every team at Google, and its single-row atomicity is a promise a hundred other systems already depend on. Whatever gets built has to be built *on top*, by a library, out of the one atomic operation that already exists.',
      ],
      code: {
        file: 'what_you_are_given.txt',
        lines: [
          { t: 'bigtable.StartRowTransaction(row)' },
          { t: '  read  / write / erase  — any columns' },
          { t: '  commit()               — all or nothing' },
          { t: '' },
          { t: '# ... for exactly one row.' },
          { t: '' },
          { t: 'across two rows:', hl: 'bad' },
          { t: '  nothing. no api. no plan to add one.', hl: 'bad' },
          { t: '' },
          { t: '# and you may not change the storage system,' },
          { t: '# because everybody else is standing on it.' },
        ],
      },
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'You are not allowed to add a server, so the whole design turns on one question asked twice over: where does the state of a transaction live? Answer it and the rest falls out almost mechanically.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**The store:** Bigtable. Atomic read-modify-write on **one row**. Multiple versions per cell, indexed by timestamp — that part you may use freely.',
              '**The rule:** you may not modify Bigtable. Every other team is standing on it.',
              '**The scale:** thousands of machines running your code, billions of updates a day, and any of those machines may die mid-transaction.',
              '**The budget:** this is an indexing pipeline, not a checkout. Seconds are fine. Tens of seconds, occasionally, are survivable.',
              '**The requirement:** straight-line code that touches several rows, and either all of it happened or none of it did.',
            ],
            questions: [
              {
                q: 'You need atomicity across rows and you have it across one. Where do the locks live?',
                options: [
                  {
                    label: 'Build a lock server for them',
                    verdict: 'dead',
                    why: 'Now price it. Locks must survive machine failure, so it must be persistent. Thousands of machines will ask at once, so it must be distributed and load-balanced. It cannot be a single point of failure, so it must be replicated. **You have just specified Bigtable**, and you are going to operate a second one. The paper works through exactly this list and arrives at the obvious conclusion.',
                  },
                  {
                    label: 'Keep them in memory in the client that holds them',
                    verdict: 'dead',
                    why: 'The cheapest answer and the one that quietly loses data. If a lock can disappear between the two phases of commit — and a machine dying makes it disappear — then two transactions that conflicted can both commit, and the invariant they were protecting is silently gone. There is no repair pass for this because nothing knows it happened.',
                  },
                  {
                    label: 'Put them in Chapter 4’s lock service',
                    verdict: 'dead',
                    why: 'Wrong scale in both directions. Chubby is built for coarse-grained locks held for hours — who is the master, which cell is primary — and its whole design assumes few clients holding few locks. This wants **millions of fine-grained locks a second**, one per cell being written, held for milliseconds. It would be like using the fire alarm to time an egg.',
                  },
                  {
                    label: 'Store them as extra columns, in the same row as the data',
                    verdict: 'move',
                    why: 'The move that makes everything else possible. A Percolator column `c` becomes three Bigtable columns — `c:data`, `c:lock`, `c:write` — so **checking for a conflict and taking the lock happen inside one Bigtable row transaction**, which is precisely the one atomic operation you were handed. And the locks inherit replication, durability, load balancing and failure recovery from the store, for nothing. You did not build a lock service; you noticed you already had one.',
                  },
                ],
              },
              {
                q: 'Two-phase commit needs a coordinator that outlives the crash. Your coordinator is a client process on a machine nobody is watching. What survives it?',
                options: [
                  {
                    label: 'A coordinator service that durably logs each decision',
                    verdict: 'dead',
                    why: 'The textbook answer, and it re-introduces the thing you were avoiding: a central, durable, replicated log of billions of transactions a day that every worker must reach. It also becomes the availability floor of the whole system — when it wobbles, nothing anywhere can commit. **The scale is what rules it out, not the elegance.**',
                  },
                  {
                    label: 'Nominate one of the transaction’s own cells as primary; its lock is the commit point',
                    verdict: 'move',
                    why: 'Pick any one of the cells you are writing and call its lock the **primary**. Every other lock in the transaction stores that cell’s address. Committing means replacing the primary lock with a write record — one row transaction. Cleaning up an abandoned transaction means erasing the primary lock — also one row transaction, on the same row. **So they race, and Bigtable decides, and exactly one wins.** The commit record is not held by a coordinator; it is a column in your own data.',
                  },
                  {
                    label: 'Time the locks out and roll them back',
                    verdict: 'dead',
                    why: 'Chapter 7 already said why: you cannot distinguish a dead worker from a slow one. Roll back a transaction that has already committed its primary and you have deleted a write somebody was told succeeded. A timeout is a fine *hint* that cleanup is worth attempting — and Percolator does use one — but it cannot be the thing that decides the outcome.',
                  },
                  {
                    label: 'Leave the locks and have an operator or a sweeper clear them',
                    verdict: 'dead',
                    why: 'A stranded lock blocks every future reader of that cell, so this converts one dead machine into a growing set of permanently unreadable rows. And a sweeper that clears locks without checking the primary is the timeout answer with extra steps and worse timing.',
                  },
                ],
              },
              {
                q: 'You are about to charge every read for the privilege of being consistent. What isolation do you actually promise?',
                options: [
                  {
                    label: 'Serializable — the guarantee people assume they have',
                    verdict: 'dead',
                    why: 'Serializability needs read locks, which means **every read becomes a write**: a lock taken, a lock released, both as Bigtable row transactions. On a system already spending around fifty Bigtable operations per document, you have roughly doubled the bill to buy an anomaly-free guarantee for a pipeline that mostly does not have the anomaly. Correct, and unaffordable here.',
                  },
                  {
                    label: 'Snapshot isolation — read at a start stamp, write at a commit stamp',
                    verdict: 'move',
                    why: 'Every transaction reads from a fixed snapshot of the past, so **a read is one Bigtable lookup at a timestamp and takes no locks at all**. Writes are checked for write-write conflicts at commit and one of the pair aborts. The multi-version storage this needs is already there — Bigtable has always kept cells by timestamp, and Chapter 3 built it that way for compaction, not for this. **The honest cost is write skew**, and the paper states it in one sentence rather than burying it.',
                  },
                  {
                    label: 'Read committed — cheaper still',
                    verdict: 'dead',
                    why: 'It removes the property the whole exercise is for. Under read committed a transaction can see one row before another transaction and the other row after it, so an invariant spanning two rows can look broken to a program that is checking it. The indexing invariants — a hash maps to exactly one canonical URL, links follow duplicates — are exactly that shape.',
                  },
                  {
                    label: 'No isolation; let the observers converge',
                    verdict: 'dead',
                    why: 'A defensible answer, and it means you should not build this. The paper says so directly: if the computation does not have strong consistency requirements, **Bigtable is already sufficient** and you should use it. Percolator is worth its considerable cost only when a programmer genuinely cannot reason about the repository without transactions.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived Percolator — and the strangest thing about it is what is missing',
              body: [
                '**There is no server.** No transaction manager, no lock manager, no coordinator process, nothing to deploy or page anybody about. Percolator is a C++ library that clients link, and a five-row transaction’s atomicity rests entirely on the atomicity of one Bigtable row. The only central component that survived is the timestamp oracle, and it is one machine handing out about **two million stamps a second** because workers batch their requests.',
                '**The commit point is a column.** Not a log entry, not a decision held by a coordinator — a lock in a row of your own data, and the act of erasing it. Whoever wants to know whether a transaction committed goes and reads that cell, and the answer is the same for everybody because Bigtable made that row transaction atomic. *Cleanup and commit are the same race, run through the same door.*',
                '**And crashed transactions are cleaned up by strangers, eventually.** No sweeper, no monitor. The next transaction that trips over an abandoned lock inspects the primary and finishes the job — rolling forward if the primary committed, rolling back if it did not. That is why the paper can say the latency budget is what makes the design work: **a conflicting transaction can be delayed by tens of seconds**, and for a web index that is simply fine.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'Seven dollars, and the row that decides everything',
      accent: 'denim',
      rung: 'Rung 3 · The reveal',
      span: 2,
      body: [
        'The paper’s own example, animated: move $7 from Bob to Joe, across two rows, on a store that will only touch one. Watch for step 4 — it is one write to one row, and it is the moment the entire transfer becomes true.',
        'Steps 6 and 7 are the failures, and they are why the primary exists. Nothing in this picture is in charge, and the outcome is never ambiguous.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={percolatorTrace} />
        </div>
      ),
      think: {
        q: 'Step 4 commits the primary and step 5 tidies up Joe. Suppose the client dies in between, and *no other transaction ever touches Joe’s row again*. Has money been lost?',
        a: 'No — and working out why is the point of the design. Joe’s row still holds the new balance at stamp 7 and a lock pointing at `Bob.bal`, with no write record. **A reader is not entitled to skip past that lock**, so it can never see the stale $2; it must resolve the lock first, and resolving it means reading the primary, which says committed, which means rolling forward and *then* reading $9. So the transfer is not lost, it is **latent** — the work of making it visible has simply been deferred to whoever next cares. This is the deep move in the paper: the state of a transaction is not held anywhere central and it is not held in the participants either. **It is held in one designated cell, and everyone else derives the answer from it on demand.** The cost of that elegance is real and shows up in the next section: the reader who does the resolving pays for it, and pays in seconds.',
      },
    },
    {
      n: 'Step 04',
      title: 'What you get, and where it stops',
      rung: 'Rung 4 · The measurement',
      body: [
        'Two numbers describe the whole trade. On a single tablet server with everything cached, **reads cost 0.94× what raw Bigtable reads cost** — essentially free, because a Percolator read is one lookup that also glances at the metadata columns. **Writes cost 0.23×**, which is to say a factor of four: 31,003 raw writes a second becomes 7,232. The four is not mysterious. A write must read the row to check for conflicts, write the lock, and later write the record and erase the lock, and *the read is the expensive part of that list.*',
        'Against MapReduce, in the regime real systems live in, the win is absurd. At a **1% crawl rate** a document waits about **thirty minutes** to be clustered under MapReduce — twenty minutes to push the whole repository through three passes, plus ten waiting for the previous run to finish — and about **two seconds** under Percolator. That is roughly **a thousand times**, and *the ratio grows with the repository*, because one side pays for the update and the other pays for everything.',
        'In production the numbers are less dramatic and more convincing. The indexing system went from **a hundred MapReduces to ten observers**, median document latency improved by **over 100×**, and the average age of a document appearing in a search result fell by **nearly half** — which is the only number in the paper a user could have noticed. The document collection got **three times larger**, limited by disk rather than by how long a full pass takes.',
        'And now the figure, which is the part worth memorising, because it tells you when this is the **wrong** tool. Percolator’s latency is flat as the crawl rate climbs — and then at **40% of the repository per hour it saturates**, stops keeping up, and queues without bound. MapReduce sails past 100%. *There is a crossover, it is arithmetic, and it is not close to the middle:* random lookups per update against streaming everything from disk. Below the crossover, incremental wins by three orders of magnitude. Above it, incremental does not merely lose, it fails.',
      ],
      diagram: <CrawlRateDiagram />,
    },
    {
      n: 'Step 05',
      title: 'What snapshot isolation actually promises',
      rung: 'Rung 5 · The small print',
      body: [
        'Worth being precise, because this is the guarantee most often assumed to be serializability and it is not. A transaction reads at its start stamp and writes at its commit stamp. **What it sees was settled the instant it began**, and no write that commits during its life can appear underneath it. Two transactions that write the same cell conflict and one aborts.',
        'What it does *not* prevent is **write skew**. Two transactions read the same snapshot, each checks a condition across a set of rows, each finds it satisfied, and each writes a *different* row. No cell is written twice, so nothing conflicts, so both commit — and the condition they both checked is now false. The classic shape is two on-call engineers each confirming the other is still on duty before signing off.',
        'The reason to accept this is stated plainly in the paper: **the main advantage of snapshot isolation over a serializable protocol is more efficient reads.** Any timestamp is a consistent snapshot, so reading a cell is a lookup and nothing more — no locks taken, no locks released, no coordination with anybody. On a system doing around fifty Bigtable operations per document, that is the difference between viable and not.',
      ],
      diagram: <SnapshotIsolationDiagram />,
    },
    {
      n: 'Step 06',
      title: 'The bill for building a database out of a library',
      accent: 'terra',
      rung: 'Rung 6 · What the layering costs',
      body: [
        '**Roughly thirty times the CPU per transaction.** The synthetic TPC-E-like benchmark does 11,200 transactions a second on **15,000 cores**; the commercial record-holder at the time did 3,183 on a single 64-core machine. Scaling is beautifully linear from 11 cores to 15,000 — you can always buy more — but the paper does not dress up what each transaction costs. In a database, mutating a row is a function call and a log flush. Here it is RPCs to Bigtable, which logs to three GFS chunkservers, which later compact and re-replicate the same bytes.',
        '**Latency is measured in seconds, and the tail is in minutes.** Average transaction latency on that benchmark is **2 to 5 seconds**. Outliers run to several minutes, from exponential backoff on conflicts and from tablets being briefly unavailable. There is **no global deadlock detector** — it was left out deliberately, because a central one is a scaling limit — so conflicting transactions just back off and retry and take as long as they take.',
        '**Cleanup is lazy, and “lazy” has a number.** A transaction that trips over a lock left by a dead worker may be delayed by **tens of seconds** before it dares clean it up, because deciding somebody is dead requires a liveness token in Chubby *and* a wall-clock stamp in the lock that has gone stale. The paper is explicit that this would be unacceptable in an OLTP system and is fine for indexing. **That single sentence is the load-bearing assumption of the whole design.**',
        '**And it costs about twice the machines.** Caffeine used roughly **2× the resources** of the batch system it replaced to process the same crawl rate. The paper’s defence is good: spend 2× on the old system and you could double the index or halve the latency, not both. But it is still 2×, and it is the honest price of processing one document at a time instead of a billion at once.',
      ],
      callout: {
        kind: 'bad',
        big: 'A WRITE COSTS FOUR WRITES',
        text: 'Read the row for conflicts, write the lock, write the record, erase the lock. 31,003 raw Bigtable writes a second becomes 7,232 — and the read at the front is the expensive one.',
      },
    },
    {
      n: 'Step 07',
      title: 'What it begat — and where it stands in 2026',
      rung: 'Rung 7 · Descendants',
      body: [
        '**The protocol outlived the system.** Percolator itself was internal and specific, but its commit protocol — locks stored beside the data, one primary lock as the commit point, snapshot isolation from a central timestamp allocator — became the standard recipe for putting transactions on a distributed key-value store. **TiDB implements it almost literally**, primary lock and all, with a Placement Driver in the timestamp oracle’s seat. So does TiKV underneath it.',
        '**The other half of the paper is the half people forget.** Percolator also shipped **observers**: code that runs when a column changes, with the guarantee that at most one observer transaction commits per change, and notifications collapsing when a cell is written many times. That is a trigger system, and it is what turned a transaction library into an incremental pipeline. Watch how it maps onto Act V — an observer is a consumer of a change stream, and *the whole indexing system is a chain of them.*',
        '**And the timestamp oracle is the piece everyone has to solve again.** One machine, strictly increasing numbers, two million a second. It works because a datacenter is small enough for a round trip to be cheap, and it is precisely what does not survive contact with a database spread across continents — which is the next chapter, and the reason that chapter ends up buying hardware.',
        '**2026 status: this is now the default way transactions are added to a store that did not have them.** Distributed SQL engines layered over key-value shards, transactional metadata layers over object storage, the newer table formats in the lakehouse world — all of them are doing some version of *put the intent next to the data, designate one place as the truth, resolve stragglers lazily.* The names differ. The primary lock does not.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Prewrite.',
      body: 'Phase one: check the cell for conflicts and take the lock, in a single Bigtable row transaction. The data is written too, at the start stamp, where no reader will accept it yet.',
    },
    {
      term: 'Primary lock.',
      body: 'One arbitrarily chosen cell of the transaction whose lock is the commit point. Every other lock stores its address, so anyone can ask it what happened.',
    },
    {
      term: 'Write record.',
      body: 'A marker in `c:write` at the commit stamp, pointing at the start stamp where the data lives. Its presence is what makes a value visible to readers.',
    },
    {
      term: 'Roll forward.',
      body: 'Finishing somebody else’s committed transaction: replace their stranded lock with the write record they never got to write.',
    },
    {
      term: 'Snapshot isolation.',
      body: 'Read from a fixed instant in the past, write at a later one, abort on write-write conflicts. Not serializable — it permits write skew.',
    },
    {
      term: 'Observer.',
      body: 'A function registered against a column, run when that column changes. At most one observer transaction commits per change; repeated writes may collapse into one run.',
    },
  ],
  inTheWild: {
    note: '5 ways this bites in production',
    points: [
      '**Write skew arrives dressed as a bug in your code.** Two transactions read the same snapshot, check the same invariant, write different rows, and both commit. Nothing conflicted, nothing retried, no error was raised, and the invariant is gone. It is invisible in testing because it needs concurrency, and it is invisible in logs because nothing went wrong.',
      '**One hot cell serialises everything behind it.** The paper hit this in its own benchmark: a broker row updated every five seconds by a hundred customers conflicted endlessly. The fix is to stop writing the hot cell — push increments to a side table and aggregate them later — and it is the fix in every system with this commit protocol.',
      '**A stranded lock is a reader’s problem, not the writer’s.** The machine that died feels nothing. The cost lands on whichever unlucky transaction reads that cell next, which waits tens of seconds and then does somebody else’s cleanup. Tail latency in these systems is often somebody else’s crash.',
      '**The timestamp allocator is the single machine nobody drew on the diagram.** It is fine until it is not: it is a round trip on every transaction, twice, and its failure stops every commit everywhere. Batching hides the load beautifully and hides the dependency just as well.',
      '**And people use it above the crossover.** Incremental processing is a thousand times better below a certain update rate and catastrophically worse above it. Teams adopt it at 2% of the corpus per hour, grow into 40%, and discover the queue does not degrade gracefully — it just stops draining.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Put the intent beside the data',
        when: 'you need atomicity the store does not offer and you cannot change the store. Locks as columns inherit its replication, durability and failover for free, and the check-and-lock collapses into the one atomic operation you already have.',
      },
      {
        choose: 'Designate one place as the truth',
        when: 'a multi-party operation needs a commit point and you have nowhere central to put one. Nominate a participant, have every other participant point at it, and let the store’s own atomicity settle the race between committing and cleaning up.',
      },
      {
        choose: 'Take snapshot isolation on purpose',
        when: 'reads dominate and the anomaly you would be buying protection against is write skew across rows nobody writes together. **Take it on purpose and write down where it can bite** — the failure is that teams get it by default and believe they have serializability.',
      },
      {
        choose: 'Stay with batch',
        when: 'the update rate is a large fraction of the corpus. Below the crossover incremental wins by orders of magnitude; above it, streaming from disk beats random lookups and no amount of tuning changes that. Work out where your crossover is before you migrate, not after.',
      },
    ],
  },
  misconception: {
    think: '“Percolator added transactions to Bigtable.”',
    actually:
      'Bigtable was not touched. Percolator is a **client library** — the transactional machinery runs inside the same process as the application code, and the storage system remains exactly as ignorant of transactions as it was in Chapter 3. That is not a detail, it is the design: there is no transaction manager to deploy, no lock service to operate, and **no component anywhere that knows a five-row transaction exists**. The atomicity of the whole thing is bought with the atomicity of one row — the primary’s — because committing and cleaning up are both writes to that row, and Bigtable will only let one of them through. What Percolator *did* add to Bigtable was small and unglamorous: conditional mutations, to collapse a read-modify-write into one RPC. The lesson generalises past this paper. **When you cannot change the layer below, look for the strongest atomic operation it already gives you and build the commit point out of that** — and then be honest that everything you did not build has to be paid for somewhere else, which here is tens of seconds of cleanup latency and four write operations per write.',
  },
  sources: [
    {
      year: '2010',
      title: 'Large-scale Incremental Processing Using Distributed Transactions and Notifications — Peng & Dabek (OSDI)',
      url: 'https://www.usenix.org/legacy/event/osdi10/tech/full_papers/Peng.pdf',
      note: 'Read **§2.2 with Figure 4 beside it** — the five-panel Bob-and-Joe transfer is the clearest picture of a distributed commit protocol in any paper here, and Figure 6’s pseudocode is short enough to read line by line. Then **§2.5**, which is an unusually candid accounting of what the layering costs. Skip §4 unless you want the 2010 view of where parallel databases were going.',
    },
    {
      year: '2010',
      title: 'Our new search index: Caffeine — Google Official Blog',
      url: 'https://googleblog.blogspot.com/2010/06/our-new-search-index-caffeine.html',
      note: 'The product announcement for the system this paper describes, published a few months before the paper. Useful as a reality check: the user-facing claim is “50% fresher results”, which is the same number as the paper’s halved average document age, arrived at from the other side.',
    },
    {
      year: '2006',
      title: 'Bigtable: A Distributed Storage System for Structured Data — Chang et al. (OSDI)',
      url: 'https://static.googleusercontent.com/media/research.google.com/en//archive/bigtable-osdi06.pdf',
      note: 'Chapter 3 here, and the thing this paper is built on top of without permission to change. Re-read §2 on the data model: the timestamp dimension that Percolator uses for snapshot isolation was put there for compaction and garbage collection, years before anybody wanted versions for concurrency control.',
    },
    {
      year: '1995',
      title: 'A Critique of ANSI SQL Isolation Levels — Berenson, Bernstein, Gray, Jim, O’Neil & O’Neil (SIGMOD)',
      url: 'https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/tr-95-51.pdf',
      note: 'Where snapshot isolation is defined and where write skew gets its name. Worth an evening on its own: it is the paper that showed the ANSI isolation levels were specified in terms of phenomena that do not actually pin down the levels, and every argument you will ever have about `REPEATABLE READ` traces back to it.',
    },
  ],
  seenIn: [
    { label: 'The Database GFS Deserved — Ch 3', to: '/papers/bigtable', live: true },
    { label: 'MapReduce: the Pattern, Not the Product — Ch 2', to: '/papers/mapreduce', live: true },
    { label: 'The Lock Everyone Was Secretly Holding — Ch 4', to: '/papers/chubby', live: true },
    { label: 'Transactions — the comic', to: '/ddia/read/transactions', live: true },
  ],
  finale: {
    title: 'The promise came back, and the store never found out',
    body: 'Act I sold cross-row transactions to buy a database that fit on a file system with no edits. This chapter bought them back without renegotiating: locks parked beside the data, one cell nominated as the commit point, cleanup left to whoever comes next, and a store that is still exactly as ignorant as it was in Chapter 3. The price is a factor of four on writes, thirty on CPU, and a latency budget measured in seconds — affordable because a web index is patient. Next: the same promise, wanted by a database that is not patient, spread across continents where a single timestamp machine cannot follow. The answer is to stop pretending clocks are right and start measuring how wrong they are.',
  },
  next: { title: 'Paying for Time with Hardware', slug: 'spanner' },
}
