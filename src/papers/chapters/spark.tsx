import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { WhereTheTimeWentDiagram, LineageNotDataDiagram, MemoryCliffDiagram } from '../diagrams'
import { sparkTrace } from './spark-trace'

/* Season 2 opens where Chapter 2 stopped complaining. MapReduce's bargain was
   that failure is handled by doing the work again, and the price of that was a
   round trip through replicated storage between every pair of stages — fine for
   one pass over the web, absurd for the tenth pass over the same 100 GB.

   The trap this chapter has to avoid is being about speed. "In-memory is faster
   than disk" is not a paper, it is a fact everyone already had in 2011, and the
   reason nobody had shipped it is the interesting part: memory was believed to
   be un-recoverable without replicating it, and replication over a network
   slower than RAM costs more than the recompute it saves. So the chapter's
   payload is the reframe — lineage is a replication strategy that stores no
   data — and the restriction that buys it, which is that you may only write in
   bulk. Every step should be serving that, not the benchmark table. */

export const spark: Chapter = {
  slug: 'spark',
  act: 'Act I · Nobody Wants to Wait Until Morning',
  paperNo: 'Paper 18',
  title: 'The Cost of Starting Over',
  dek: 'The job is correct and it runs for six hours, and nine tenths of that is spent reading back what it wrote a moment ago. Keeping it in memory was obvious. Making the memory survive a dead machine was not.',
  minutes: 17,
  paper: {
    title: 'Resilient Distributed Datasets: A Fault-Tolerant Abstraction for In-Memory Cluster Computing',
    authors:
      'Matei Zaharia, Mosharaf Chowdhury, Tathagata Das, Ankur Dave, Justin Ma, Murphy McCauley, Michael J. Franklin, Scott Shenker, Ion Stoica',
    venue: 'USENIX NSDI',
    year: '2012',
    url: 'https://www.usenix.org/system/files/conference/nsdi12/nsdi12-final138.pdf',
  },
  caption:
    'Season 1 asked where data lives. Every answer assumed the data sits still and a query comes to visit it. **This season is about the delay between something happening and somebody being able to see it**, and it starts with the crudest delay there is: a job that reruns from the beginning. Chapter 2 gave you MapReduce and the bargain underneath it — a machine can die and nobody has to care, because the work is simply done again. Run ten iterations of PageRank on that engine and here is what you get: nine of them begin by reading back from a replicated file system exactly what the previous one just finished writing. Everybody could see it. The fix looks obvious — *keep it in memory* — and for four years nobody shipped it, because of a question with no good answer.',
  steps: [
    {
      n: 'Step 01',
      title: 'The obvious fix that nobody could afford',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'Start with where the time actually goes, because the number is worse than the argument. The authors ran one pass of logistic regression over **256 MB** on a single machine and took it apart. Reading the records back as text cost **15.4 seconds**. About **2 s** of that was getting bytes out of HDFS even when the file was already in memory on the same box; about **7 s** was parsing the text; about **3 s** was turning the parsed bytes into Java objects. The regression itself — the part anybody wanted — was roughly **3 s**. *Four fifths of the work was undoing the file format.*',
        'And it happens every iteration, on data the process had in exactly the right shape a moment earlier. Add the fixed cost of the framework: a **no-op** Hadoop job, doing literally nothing, took at least **25 seconds** to set up tasks and clean up after them. Ten iterations means ten of those.',
        'So keep the intermediate results in memory. Everyone knew that. Pregel kept graph state in memory; HaLoop kept a loop’s data in memory. What neither offered was a general answer, and here is the question that stopped one: **a machine holding part of your working set dies. Where does that part come from?** For every in-memory abstraction on offer in 2011 — distributed shared memory, key-value stores, Piccolo — the answer was to keep a second copy or a log of every update, and both mean copying large volumes across a network *whose bandwidth is far below RAM’s*. You would be paying the cost you were trying to avoid, continuously, as insurance.',
        'That is the real constraint, and it is not about speed at all. **The question is not how to make memory fast, it is how to make memory survivable at a price you would actually pay.**',
      ],
      diagram: <WhereTheTimeWentDiagram />,
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'Three decisions, and they are not independent — the answer to the first one only works if you have already made the sacrifice in the second. That is the shape of this paper, and it is why it is a paper rather than a benchmark.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**What you have:** a cluster of commodity machines, a replicated file system, and Chapter 2’s engine. Machines fail often enough that recovery is a design input, not an incident.',
              '**The workload:** algorithms that pass over the same data tens of times — PageRank, k-means, logistic regression — and an analyst who wants to ask several ad-hoc questions of the same subset.',
              '**What is slow:** the round trip. Between any two jobs the only channel is the file system, and every trip through it re-serialises, re-parses and re-replicates data that was already in the right shape.',
              '**The hardware fact you cannot argue with:** network bandwidth is far below memory bandwidth, and it is shared by everyone on the cluster.',
              '**What you must not lose:** the property that made batch worth having — a machine can die mid-job and the answer still comes out, without a human being woken up.',
            ],
            questions: [
              {
                q: 'You keep the intermediate results in RAM across jobs. A machine dies and its share of them is gone. Where does that share come from?',
                options: [
                  {
                    label: 'Keep the recipe, not the copy — remember which operations produced this dataset, and re-run them for the missing pieces only',
                    verdict: 'move',
                    why: 'This is **lineage**, and the reframe worth carrying out of this chapter is that *it is a replication strategy that stores no data.* You are still buying durability, and you are buying it by writing down how the bytes were made rather than the bytes. The size difference is not a percentage. In the paper’s own jobs the lineage graphs were **under 10 KB** against a working set of **100 GB** — small enough to hold everywhere, for every dataset, permanently, and never think about it again. Recovery gets better too, not just cheaper: only the lost partitions are recomputed, they are recomputed **in parallel on the surviving machines**, and nothing that was already correct is touched.',
                  },
                  {
                    label: 'Replicate the in-memory data across machines, the way the file system replicates blocks',
                    verdict: 'dead',
                    why: 'The arithmetic kills it before the engineering starts. You need twice the RAM — the scarcest resource on the box, and the entire reason you are here — and you have to push the copy over a network *far slower than the memory you are protecting*. You would pay that on every write, forever, against a failure that might never come. And you would be paying it for data that is, by construction, **derived**: it can be made again from something you already have durably. Insuring a thing you can recreate is the definition of a bad policy.',
                  },
                  {
                    label: 'Log every update to the shared state, so any machine’s memory can be replayed',
                    verdict: 'dead',
                    why: 'This is what fine-grained abstractions have to do, and it is the same bill in different clothing. If the program may write to any location, then the log has one entry per write — so for a bulk computation the log approaches the size of the data, and it crosses the network too. Notice what is actually being paid for: the *freedom* to write anywhere. Nobody in this workload uses that freedom; every one of these algorithms applies the same function to every record. **You are being charged for generality you are not spending.**',
                  },
                  {
                    label: 'Checkpoint the whole in-memory state to stable storage every few iterations',
                    verdict: 'dead',
                    why: 'Not wrong — it comes back later in the chapter as a deliberate option — but it cannot be *the* mechanism. It is the round trip you came here to delete, only less often, and it recovers at the wrong granularity: one machine dies and everybody rolls back to the last checkpoint, so a failure costs the whole cluster several iterations rather than costing one machine one partition. *Its cost is paid by everyone, all the time, in proportion to how safe you want to be.*',
                  },
                ],
              },
              {
                q: 'Lineage only works if replaying it produces the same bytes. What do you have to take away from the programmer to make that true?',
                options: [
                  {
                    label: 'Let them build datasets only by applying one function to a whole collection at once — and make the result read-only',
                    verdict: 'move',
                    why: 'This is the sacrifice, and it is the reason the first answer is affordable rather than merely clever. **Coarse-grained** means one entry in the lineage graph per *operation*, not per record — a `map` over a billion rows is one node in the graph. **Read-only** means there is no version question at recovery time: the same inputs and the same function give the same partition, so recomputing is not a rollback and needs no coordination with anyone. It also hands you two things nobody asked for. A slow machine can have its task run twice speculatively, because two copies of a deterministic task cannot interfere. And the scheduler is free to place work next to the data it reads, since the work is described rather than in progress.',
                  },
                  {
                    label: 'Nothing — keep arbitrary reads and writes and just log the writes efficiently',
                    verdict: 'dead',
                    why: 'You have re-asked the previous question and got the previous answer. Fine-grained writes force fine-grained recovery, whose cost scales with the *data* rather than the *program*, and that is precisely the trade lineage exists to escape. The paper is careful about this and so should you be: the two are one decision, not two. **You do not get cheap recovery and an unrestricted programming model, and every system that has claimed both was hiding a checkpoint somewhere.**',
                  },
                  {
                    label: 'Keep the model general but require every function to be registered and declared deterministic',
                    verdict: 'dead',
                    why: 'Determinism is necessary and it is not sufficient. Even with perfectly deterministic functions, a model that permits a write to *one* location means the recovery unit is that location, so you are back to a log the size of your updates. The restriction that does the work is not about the functions, it is about **what a write may touch** — and it must be a whole partition, not a cell.',
                  },
                  {
                    label: 'Also restrict reads, so nothing can depend on data it does not own',
                    verdict: 'dead',
                    why: 'You have given up more than you needed and bought nothing with it. Reads can stay as fine-grained as you like — an application is welcome to treat one of these datasets as a large read-only lookup table — because a read creates no new state and therefore nothing to recover. *Only the writes need to be coarse.* Giving up more than the mechanism requires is how an abstraction ends up expressive enough for one benchmark and nothing else.',
                  },
                ],
              },
              {
                q: 'The lineage graph is not one shape. A `map` and a `join` fail very differently. What distinction do you build the scheduler on?',
                options: [
                  {
                    label: 'Whether each parent piece feeds at most one child piece, or many — narrow against wide',
                    verdict: 'move',
                    why: 'One distinction, and it decides both of the things you care about. **Execution:** a run of narrow dependencies can be pipelined inside a single machine with no exchange, so the job is cut into stages exactly at the wide ones. **Recovery:** a lost partition with narrow parents needs one parent partition back, which is cheap and parallel. A lost partition with wide parents may have drawn from *any* partition of its parent — so a single dead machine can cost you a slice of everything upstream, and the rebuild may reach all the way to the input. That is the entire reason checkpointing survives in this design as an option you exercise deliberately, on exactly the datasets with long chains of wide dependencies.',
                  },
                  {
                    label: 'Whether the operation shuffles data across the network',
                    verdict: 'dead',
                    why: 'Nearly right, and it is the *consequence* rather than the cause — which matters because it gets a real case backwards. A `join` between two datasets that are already partitioned the same way needs **no** shuffle: each machine has both sides of its keys already. Define your rule by network traffic and you have to special-case that; define it by the dependency structure and it falls out, and the same rule also tells you what a failure costs. *The one that predicts two things is the one to build on.*',
                  },
                  {
                    label: 'Whether the operation is expensive — profile it and cut stages where the cost is',
                    verdict: 'dead',
                    why: 'A scheduler needs to plan before it has run anything, and cost is not knowable then. Worse, it is not stable: the same operation is cheap when the data is co-located and ruinous when it is not. Structure is available at graph-construction time and never lies, which is why this system asks each dataset only for its partitions, its parents, its preferred locations and how to compute one piece — five questions, from which most transformations fall out **in under twenty lines** apiece.',
                  },
                  {
                    label: 'Whether the programmer asked for the result to be kept in memory',
                    verdict: 'dead',
                    why: 'That is a genuine input and it answers a different question. Persistence decides what is *available* — the scheduler will happily short-circuit a parent whose partitions are already cached. It says nothing about what a failure costs or where a stage boundary belongs, and the two get confused constantly in practice: people cache aggressively and are astonished when one dead machine still costs them ten minutes. **Caching changes the good case. The dependency shape decides the bad one.**',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived the RDD — and the sacrifice that pays for it',
              body: [
                '**The abstraction, stated plainly.** A read-only collection of records, split into partitions, that can only be built by a deterministic operation on stable storage or on another such collection. It is not required to exist: it knows enough about how it was derived to make any of its partitions again. Users add two things on top — *persist*, which asks for the result to be kept in memory, and *partitionBy*, which asks for a placement. Everything else in the system is scheduling.',
                '**The trade, in one sentence.** You give up writing to a location; you get recovery whose cost is proportional to the size of your program rather than the size of your data. Everything the paper does well follows from that ratio. And it comes with an honest limit the authors state themselves: this is a bad fit for applications that make asynchronous fine-grained updates to shared state — a web application’s storage, an incremental crawler. *For those, they say, use a system that logs updates and checkpoints data.* One of which you already read, in Chapter 10, keeping an index fresh one document at a time.',
                '**And here is what to carry forward, because it is not the speed.** Every system in Season 1 answered the question *where should this data live?* This one answers a different question: **what is the cheapest thing you can store that lets you not store the data?** The answer was the derivation, and once you have seen that, you start noticing how often the expensive artifact is recoverable from a small one. Chapter 13 said the log is the record and every store is a reader of it — the same instinct, aimed at durability instead of at freshness.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'Ten iterations, and a machine that does not survive them',
      accent: 'denim',
      rung: 'Rung 3 · The reveal',
      span: 2,
      body: [
        'Hold Chapter 2’s picture next to this one. There, the arrow between every pair of stages went through a replicated file system, and the reason it did was that the file system was the only thing that could be trusted to still be there. Here it is touched once.',
        'Step 5 is the failure that was supposed to make this impossible, step 6 is the answer, and step 7 is the case where the answer is not enough.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={sparkTrace} />
        </div>
      ),
      think: {
        q: 'Chapter 2 said MapReduce handles failure by doing the work again. This chapter says the same thing. What actually changed?',
        a: '**The unit, and who pays.** In MapReduce the recomputable unit is a task, and the thing that makes a task recomputable is that its input is sitting durably in a file system — which is why the output of every stage had to go back to that file system before the next stage could start. The durability was not a side effect of the design; it *was* the design. Recovery worked because nothing was ever only in memory. So the cost of being able to recover was paid on the happy path, on every stage, by every job, whether or not anything ever failed. Here the recomputable unit is a partition, and what makes it recomputable is a description of its derivation rather than a durable copy of its contents. That moves the cost off the happy path almost entirely: you pay a few kilobytes of bookkeeping instead of a hundred gigabytes of I/O, and you pay the real cost — recomputation — only when a machine actually dies, and only for the pieces that died. *The bargain did not change. The collateral did.* And it is worth noticing what stayed the same, because it is the load-bearing part of both papers: the work is deterministic, so doing it again is always safe. Every technique in this chapter rests on that one property, and the moment a computation stops being deterministic, none of it holds — which is exactly why the next chapter, which does keep mutable state, cannot recover this way and has to stop the world instead.',
      },
    },
    {
      n: 'Step 04',
      title: 'The numbers, and which of them is the real one',
      rung: 'Rung 4 · The measurement',
      body: [
        'The headline is **up to 20× faster than Hadoop**, and it is the least interesting number in the paper. Here is the one that matters. On a hundred machines, running logistic regression over 100 GB, the *first* iteration takes **46 s** against Hadoop’s **80 s** — a difference that is mostly framework startup. Later iterations take **3 s** against Hadoop’s **76 s**. *The speedup is not in the computation. It is entirely in not doing the reading again.*',
        'Which is why the second number is the useful check on the first. For k-means, which does far more arithmetic per byte, the same comparison is only **1.9× to 3.2×**. Same engine, same cluster, same trick — and the trick is worth an order of magnitude when the job is I/O-shaped and almost nothing when the job is compute-shaped. **A benchmark that does not say which shape it is measuring is not telling you anything.**',
        'Then the failure. Ten iterations of k-means on **75 machines**, 400 tasks over 100 GB. Normal iterations take **58 s**. One machine is killed at the start of the sixth; that iteration takes **80 s**, and the seventh is back to **58 s**. Twenty-two seconds, once, for a dead machine — against a checkpoint-based scheme that would have rerun several iterations and would have needed the 100 GB working set replicated across the network in the first place. *The lineage that made this possible was under 10 KB.*',
        'And the one from outside the lab, which is the one to quote at people. A video company had an analytics report running as a series of Hive queries on Hadoop: **200 GB compressed, twenty hours**. The queries all filtered the same subset and then aggregated it different ways, so on Hadoop each grouping was a separate job re-reading everything. Loaded once into memory instead, the report took **thirty minutes on two machines** using **96 GB of RAM**. Forty times faster, on less than a twentieth of the hardware — because the thing being deleted was never computation.',
      ],
      code: {
        file: 'pagerank.scala',
        lines: [
          { t: '// the links never change. say so once, and pay for it once.' },
          { t: 'val links = spark.textFile(...).map(...).persist()', hl: 'good' },
          { t: 'var ranks = // (url, rank) pairs' },
          { t: '' },
          { t: 'for (i <- 1 to ITERATIONS) {' },
          { t: '  val contribs = links.join(ranks).flatMap {' },
          { t: '    (url, (links, rank)) =>' },
          { t: '      links.map(dest => (dest, rank / links.size))' },
          { t: '  }' },
          { t: '  ranks = contribs.reduceByKey((x, y) => x + y)' },
          { t: '                  .mapValues(sum => a/N + (1-a)*sum)' },
          { t: '}' },
          { t: '' },
          { t: '# 54 GB Wikipedia dump, ~4M articles, 10 iterations, 30 machines' },
          { t: '# Hadoop                                              171 s' },
          { t: '# the loop above                                       72 s' },
          { t: '# ... plus .partitionBy() on links                     23 s', hl: 'good' },
        ],
      },
      diagram: <LineageNotDataDiagram />,
      deeper: {
        summary: 'Why one extra line was worth more than the whole in-memory trick',
        body: [
          'Look at the last two rows of that block. Keeping the links in memory took PageRank from **171 s to 72 s**. Adding `partitionBy` — which changes no logic at all — took it from 72 s to **23 s**. The layout decision was worth more than the memory decision.',
          'The reason is in the loop. Every iteration joins `links` against `ranks`, and a join needs both sides of a key on the same machine. If the two are partitioned differently, that means shuffling one of them across the network *every iteration*, forever, on data that has not changed since the first one. Hash-partition `links` by URL once, ask `ranks` to inherit that partitioner, and the join becomes local: each machine already holds both halves of every key it owns, so the exchange disappears from the loop entirely.',
          'This is Chapter 3’s argument for sorting a table by key — keep the things that get read together physically together — arriving from the opposite direction, and it generalises past this paper: **in a loop, a layout decision is paid once and a data movement decision is paid every time round.** It is also the strongest evidence for the design of the abstraction itself. Specialised graph systems achieved consistent partitioning across iterations by building it into the framework; here it is one method call, because the model was expressive enough to say it.',
        ],
      },
    },
    {
      n: 'Step 05',
      title: 'Restriction as a feature',
      rung: 'Rung 5 · The design stance',
      body: [
        'The stance worth stealing is not *keep things in memory*. It is this: **when a general mechanism is too expensive, look for the freedom you are being charged for and are not spending.** Distributed shared memory lets a program write to any location. These workloads never do — they apply the same function to every record — and yet every one of them was paying for the possibility, in the currency of replication. Take the freedom away and the bill collapses.',
        'What makes it a design stance rather than a trick is how much falls out of the same restriction. Because writes are coarse, the lineage is small. Because the results are read-only, recovery needs no coordination and a straggler’s task can simply be run twice. Because a dataset is described rather than materialised, the scheduler knows where its inputs are and can send the work to them. **One sacrifice, four dividends** — and the test of whether a restriction is a good one is exactly that: whether the things you did not ask for start working too.',
        'The generality claim is the part that persuaded people, and it is worth being precise about because it is easy to overstate. The authors did not argue that the model can express anything. They argued that it can express the *systems that had been proposed as separate frameworks* — and then implemented Pregel and HaLoop on top of it as libraries of about **200 lines each**, placement optimisations included. That is a specific and checkable claim, and it is the strongest form the argument could take: not *this is expressive*, but *here are the four systems you thought you needed, as small programs.*',
        'The interface underneath it is deliberately tiny. Ask a dataset five things — its partitions, its parents, where each partition would be fastest to read, how to compute one partition from its parents’ pieces, and whether it is hash- or range-partitioned — and that is enough for the scheduler to plan every transformation without knowing what any of them mean. Most operations are implemented **in under twenty lines**, and users who had never read the scheduler added new ones. *An abstraction that outsiders can extend is a different claim from one that merely works.*',
      ],
      diagram: <MemoryCliffDiagram />,
    },
    {
      n: 'Step 06',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 6 · What the memory costs',
      body: [
        '**The working set has to fit, and “degrades gracefully” has a slope.** With all of the data in RAM an iteration takes **11.5 s**. Take a quarter of it away and it takes **29.7 s** — the last quarter of the memory is worth 2.6× on its own. At half, **40.7 s**; at none, **68.8 s**. The degradation really is smooth and it really is monotonic, and the shape of it means the difference between a job that fits and a job that nearly fits is not a nearly-identical job. It is a different budget.',
        '**Lineage is not free forever, and the fix is the thing you escaped.** Every iteration adds a link, and in a loop like PageRank each one is a wide dependency, so a failure deep into a long run can force a rebuild reaching back toward the input. The answer is to checkpoint some versions to stable storage — and in this paper the system does not decide that for you. It gives you a flag and leaves the judgement to the programmer, which means the recovery characteristics of your job are a thing you are expected to reason about by hand.',
        '**The shuffle still goes to disk.** In-memory is a description of what happens *between* jobs, not inside one. At a wide dependency the intermediate records are materialised on the machines holding the parent partitions, exactly as MapReduce materialises map output, and for exactly the same reason: it makes recovery simple. The most expensive step in most real jobs is the one the headline does not cover.',
        '**And the authors draw the boundary themselves, which is rarer than it should be.** §2.4 says this model is a poor fit for applications making asynchronous fine-grained updates to shared state — a storage system behind a web application, an incremental crawler — and points at systems that log updates and checkpoint data instead. One of those is Percolator, from Chapter 10, whose whole existence is the same problem answered the other way. *Two papers, two years apart, agreeing about where the line is and standing on opposite sides of it.*',
      ],
      callout: {
        kind: 'bad',
        big: 'THE FIRST PASS IS NOT FASTER',
        text: 'Every number in this chapter is about reuse. A job that reads its input once, does one thing to it and writes the answer gets nothing here — and a surprising amount of production work is exactly that shape.',
      },
    },
    {
      n: 'Step 07',
      title: 'Where it stands in 2026',
      rung: 'Rung 7 · What survived',
      body: [
        '**The system won and the API lost, which is the ordinary outcome for a good idea.** Almost nobody writing Spark today writes an RDD. They write a DataFrame or a SQL query, which is compiled, optimised and code-generated before anything touches a partition — and that layer is Chapter 20’s subject, because it is what made the next argument in this act possible. The RDD is still down there as the execution substrate. It stopped being the thing you hold.',
        '**Lineage, on the other hand, is now furniture.** Recompute-don’t-replicate turns up wherever a derived artifact is expensive and its recipe is cheap: build systems, feature stores, the whole vocabulary of data lineage in warehouses, and the transformation tools that keep a graph of how each table was made so they can rebuild one without rebuilding all of them. The word travelled further than the paper did, and it usually arrives without the sacrifice attached — which is the thing to check when somebody says it. *Lineage buys you cheap recovery only if replay is deterministic and the write granularity is coarse. Neither is free, and a system that claims the benefit without either is checkpointing somewhere you have not looked.*',
        '**The wound this chapter closes and the one it opens.** It closed the round trip: the middle of a computation can now live in memory and still survive a dead machine. What it did not touch is the shape of the job. The input still has to hold still while you work on it — you load a dataset, iterate over it, get an answer, and if new records arrive you run the whole thing again. The word for that is still *batch*, and it is now a batch that takes minutes rather than hours.',
        'Which is a good place for somebody to ask the obvious question. If the middle of the computation can stay in memory between iterations, why can it not stay in memory between *inputs* — so that new records join a computation already in progress rather than starting a new one? That is a different engine, and the next chapter is the paper that tried to build both out of the same parts.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'RDD.',
      body: 'A read-only collection of records, split into partitions, that knows how it was derived. Not necessarily materialised — it can rebuild any partition from its parents on demand.',
    },
    {
      term: 'Lineage.',
      body: 'The graph of transformations that produced a dataset. Kilobytes, not gigabytes, which is what makes recomputing cheaper than replicating.',
    },
    {
      term: 'Narrow dependency.',
      body: 'Each parent partition feeds at most one child partition. Pipelines inside one machine; a lost child needs one parent back.',
    },
    {
      term: 'Wide dependency.',
      body: 'A child partition may draw from every parent partition. Forces an exchange across the network, ends a stage, and makes a single machine’s death potentially expensive.',
    },
    {
      term: 'Stage.',
      body: 'A run of narrow transformations executed as one set of tasks. Stage boundaries sit exactly at the wide dependencies, or wherever a cached partition lets the plan stop early.',
    },
    {
      term: 'Action.',
      body: 'The operation that actually makes something happen — count, collect, save. Everything before it was only a description.',
    },
    {
      term: 'Persist.',
      body: 'The programmer saying which datasets will be reused. Without it a dataset is recomputed each time it is needed, which is correct and slow.',
    },
  ],
  inTheWild: {
    note: '5 ways this bites in production',
    points: [
      '**Somebody forgets to persist, and the job silently does the work twice.** Nothing errors, nothing warns, and the plan is technically correct — a dataset used by two actions is derived twice unless you said otherwise. It usually surfaces as a job that is exactly twice as slow as expected, months after it was written.',
      '**The shuffle is where the job dies, and it is the part the pitch never mentions.** Skewed keys put one reducer on one machine holding a hundred times its share, and the whole stage waits for it. Every trick in this chapter is about the stages between shuffles; none of them help inside one.',
      '**A long chain with no checkpoint turns one dead machine into a very long afternoon.** The failure is rare enough that people stop thinking about it and the chain is long enough that recovery reaches most of the way to the input. The flag exists; remembering to use it is a human process, which is to say it does not happen.',
      '**Memory pressure is invisible until it is not.** Partitions get evicted, recomputed, evicted again, and the symptom is a job that got slower with no code change — because somebody else’s data grew and the cache stopped fitting. The degradation curve is smooth, which makes it hard to notice and easy to misattribute.',
      '**People cite the 20× and are then disappointed.** It was measured on the most I/O-bound workload in the paper, and the same paper reports 1.9× on a compute-bound one. The honest version of the claim is that this removes reading, and how much that is worth depends entirely on how much of your time was reading.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Store the derivation, not the data',
        when: 'the artifact is expensive, recoverable, and derived from something you already hold durably. The check is whether replay is deterministic — **if it is not, you do not have lineage, you have a hopeful comment** — and whether the recipe is orders of magnitude smaller than the result.',
      },
      {
        choose: 'Restrict the write granularity on purpose',
        when: 'you want recovery whose cost scales with the program rather than the data. Look for the freedom your workload is being charged for and never uses; taking it away is usually cheaper than optimising around it.',
      },
      {
        choose: 'Fix the layout instead of the movement',
        when: 'something is inside a loop. A partitioning decision is paid once and a data exchange is paid every time round, so the boring line that co-locates two datasets routinely beats the clever one that moves them faster.',
      },
      {
        choose: 'Checkpoint anyway, deliberately',
        when: 'the dependency chain is long and made of wide dependencies. Lineage is the mechanism and stable storage is the circuit breaker; treating them as alternatives is how a recovery ends up taking longer than the original job.',
      },
    ],
  },
  misconception: {
    think: '“Spark is fast because it keeps data in memory instead of on disk.”',
    actually:
      'That sentence is true and it explains nothing, because keeping data in memory was never the hard part — every engineer in 2011 knew RAM was faster than a disk, and several systems already did it for specific shapes of job. **The contribution is the fault-tolerance story, not the storage story.** What stopped a general in-memory engine from existing was that the known ways to make distributed memory survivable — replicate it, or log every update to it — both cost more than the disk traffic they were replacing, because they move comparable volumes of data across a network far slower than memory. This paper’s move is to make the recovery unit a *description* instead of a *copy*: remember the operations that built a partition, and rebuild only what was lost, in parallel, on machines that are still alive. That is what makes memory affordable to rely on. And the price is the part usually left out — you may no longer write to a location, only transform a whole collection at once, and if you break determinism the whole scheme quietly stops working. *In-memory is the symptom. Coarse-grained deterministic transformation is the design.*',
  },
  sources: [
    {
      year: '2012',
      title:
        'Resilient Distributed Datasets: A Fault-Tolerant Abstraction for In-Memory Cluster Computing — Zaharia et al. (USENIX NSDI)',
      url: 'https://www.usenix.org/system/files/conference/nsdi12/nsdi12-final138.pdf',
      note: 'Read **§2.3** first — the comparison table against distributed shared memory is the argument of the whole paper on one page, and it is about recovery rather than speed. Then **§4** for narrow versus wide dependencies, which is the idea that keeps paying. **§2.4** is four sentences long and is the most honest thing in it: the authors telling you what their abstraction is bad at, and naming the systems to use instead.',
    },
    {
      year: '2004',
      title: 'MapReduce: Simplified Data Processing on Large Clusters — Dean & Ghemawat (OSDI)',
      url: 'https://static.googleusercontent.com/media/research.google.com/en//archive/mapreduce-osdi04.pdf',
      note: 'Chapter 2, and the paper this one is arguing with. Read them together and notice that the disagreement is narrow: both say failure is handled by doing the work again, and both are right. They differ only on what has to be sitting durably for that to be possible — and the entire performance gap comes out of that one question.',
    },
    {
      year: '2010',
      title: 'Pregel: A System for Large-Scale Graph Processing — Malewicz et al. (SIGMOD)',
      url: 'https://15799.courses.cs.cmu.edu/fall2013/static/papers/p135-malewicz.pdf',
      note: 'The specialised system that solved one shape of this problem first, and the one whose model this paper reimplements as a 200-line library to make its generality argument. Read it to see what a purpose-built answer looks like — the vertex-centric model is genuinely nicer for graphs, and that is the cost of generality stated fairly.',
    },
    {
      year: '2016',
      title: 'Apache Spark: A Unified Engine for Big Data Processing — Zaharia et al. (CACM)',
      url: 'https://dl.acm.org/doi/10.1145/2934664',
      note: 'The four-years-later retrospective, and the honest place to see what the community actually did with this. Useful mostly for the admission that the composability of the libraries — SQL, streaming, machine learning over one engine — turned out to matter more to users than the in-memory performance that got all the press.',
    },
    {
      year: '2015',
      title: 'Making Sense of Performance in Data Analytics Frameworks — Ousterhout et al. (USENIX NSDI)',
      url: 'https://www.usenix.org/system/files/conference/nsdi15/nsdi15-paper-ousterhout.pdf',
      note: 'The paper that measured whether any of this is true, on real Spark workloads, and found that network and disk were often *not* the bottleneck people assumed — CPU frequently was. Read it directly after this chapter. It is the best available lesson in how a correct paper about one workload becomes a folk belief about all of them.',
    },
  ],
  seenIn: [
    { label: 'MapReduce: the Pattern, Not the Product — Ch 2', to: '/papers/mapreduce', live: true },
    { label: 'Transactions, Hand-Rolled — Ch 10', to: '/papers/percolator', live: true },
    { label: 'Write Once, Replay Everywhere — Ch 13', to: '/papers/kafka', live: true },
    { label: 'The Shuffle — the comic', to: '/ddia/read/shuffle', live: true },
  ],
  finale: {
    title: 'Cheap enough to keep everywhere',
    body: 'The round trip is gone, and the way it went is worth more than the speed it bought. Nobody made memory reliable; they made reliability cheap enough to stop caring, by storing the recipe instead of the dish. That only works because of a sacrifice most summaries leave out — you may no longer write to a location, only transform a whole collection at once, and every dividend in the chapter falls out of that one restriction. What has not changed is the shape of the work. The input still holds still, you still start the computation when you have all of it, and new records still mean starting again. The next paper asks why the state should ever be torn down at all.',
  },
  next: { title: 'One Engine, Both Shapes', slug: 'naiad' },
}
