import type { Chapter } from '../types'
import DesignIt from '../DesignIt'
import { FanoutDiagram } from '../diagrams'

/* A half-chapter, and built like one: two decisions rather than three, five
   steps rather than seven, no animated trace. The shuffle is the obvious thing
   to animate here and the DDIA book already animates it (/ddia/read/shuffle),
   so this links there instead of drawing it a second time. What this chapter
   owes the season is the join between Ch 1 and Ch 3 — why a file system that
   only appends needed a compute model that only re-runs. */

export const mapreduce: Chapter = {
  slug: 'mapreduce',
  act: 'Act I · The Web Breaks the Box',
  paperNo: 'Paper 2 · a half-chapter',
  title: 'MapReduce: the Pattern, Not the Product',
  dek: 'The famous part was borrowed from Lisp. The part that mattered was the restriction — and what a framework can do for you once you accept one.',
  minutes: 9,
  paper: {
    title: 'MapReduce: Simplified Data Processing on Large Clusters',
    authors: 'Jeffrey Dean & Sanjay Ghemawat',
    venue: 'OSDI',
    year: '2004',
    url: 'https://static.googleusercontent.com/media/research.google.com/en//archive/mapreduce-osdi04.pdf',
  },
  caption:
    'The crawl is in GFS now. It is enormous, it is spread over a thousand machines, and it is useless until something reads it — count the words, invert the links, sort the URLs, find the pages that mention a phrase. Each of those is about twenty lines of thinking. **Each of them ships as several thousand lines of code**, because before you can count anything you have to split the input, hand pieces out, notice that a machine died, give its piece to somebody else, and collect the results. Every team writes that, and every team gets it wrong in a slightly different place. *You have been asked to write it once.*',
  steps: [
    {
      n: 'Step 01',
      title: 'The twenty lines nobody can find',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'The paper opens with the complaint, not the idea: *“the issues of how to parallelize the computation, distribute the data, and handle failures conspire to **obscure the original simple computation** with large amounts of complex code.”* The real program — the count, the sort, the extraction — is a rounding error inside its own source file.',
        'And at this scale the plumbing is not optional. The paper measured its own August 2004 fleet: **an average of 1.2 worker deaths per job.** Not per week. Per job. So every program that runs for an hour has to survive machines vanishing, which means every programmer is writing failure handling, which means every programmer is writing a slightly different bug.',
        'The tempting fix is a library of helpers — a scheduler here, a retry wrapper there. It does not work, and the reason is worth sitting with: **a general framework cannot recover a task it knows nothing about.** To re-run something safely you must know it is safe to re-run, and arbitrary code offers no such promise. Which turns the whole problem inside out. The question is not *what can the framework do for any program?* It is **what must a program give up before a framework can do anything for it at all?**',
      ],
      code: {
        file: 'wordcount_2003.cc',
        lines: [
          { t: '// the computation', hl: 'good' },
          { t: 'for (word : line) counts[word]++;', hl: 'good' },
          { t: '' },
          { t: '// everything else', hl: 'bad' },
          { t: 'split_input(); assign_workers(); heartbeat();' },
          { t: 'detect_death(); reassign(); dedupe_output();' },
          { t: 'shuffle_by_key(); merge_sorted_runs(); ...' },
          { t: '' },
          { t: '// written again, per program, per team' },
        ],
      },
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'Two decisions, because this is a half-chapter and the paper really only makes two that you could get wrong. It is 2004, GFS from the last chapter is holding the data, and you are being asked for a library that any team can point at a petabyte.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**The input:** already in GFS — 64 MB chunks, three replicas each, spread across the fleet',
              '**The fleet:** ~1,800 machines, and the paper’s own measurement is **1.2 worker deaths per job** — failure during a job is the normal case, not the bad day',
              '**The network:** the scarce resource. Roughly 100–200 Gbps at the root of a two-level tree, shared by everyone',
              '**The users:** engineers who want to write a word count, not a distributed system, and who will route around you if the answer is a framework with a manual',
            ],
            questions: [
              {
                q: 'A machine dies four fifths of the way through a four-hour job. What happens next?',
                options: [
                  {
                    label: 'Checkpoint each task’s state, resume from the last snapshot',
                    verdict: 'dead',
                    why: 'Now every task carries state you must snapshot, ship somewhere durable, and restore — and the framework has to understand what that state *means* to know when a snapshot is coherent. You have made the library responsible for the semantics of code it did not write, which is the thing that cannot be done in general.',
                  },
                  {
                    label: 'Run every task on three machines, take the majority answer',
                    verdict: 'dead',
                    why: 'Three times the cost of every job, forever, to cover a failure that touches a small fraction of tasks. Voting also buys protection against machines that lie, and these machines do not lie — they stop. You would be paying for the wrong failure model.',
                  },
                  {
                    label: 'Re-run that one task, from its input, somewhere else',
                    verdict: 'move',
                    why: 'Free, instant, and needs no state at all — **but only if the task is a pure function of its input slice.** Deterministic, no side effects, no peeking at what other tasks are doing. So the restriction on what you are allowed to write is not the framework being bossy: *it is the price of this line.* Everything else in the paper is bought with the same coin.',
                  },
                  {
                    label: 'Fail the job and let a human restart it',
                    verdict: 'dead',
                    why: 'At 1.2 deaths per job, this is a rule that no long job ever survives. Any design where failure is exceptional has quietly assumed a fleet a hundred times smaller than the one you have.',
                  },
                ],
              },
              {
                q: 'A terabyte sits in GFS and a thousand machines are idle. Where do you run the map tasks?',
                options: [
                  {
                    label: 'Wherever there is a free slot — ship the data to it',
                    verdict: 'dead',
                    why: 'A terabyte across the network for every job, over a tree with 100–200 Gbps at its root, mostly to move bytes *past* machines that already have them on a local disk. The scheduler would be spending the scarcest resource in the building on nothing.',
                  },
                  {
                    label: 'On a machine that already holds a replica of that chunk',
                    verdict: 'move',
                    why: 'The master from Chapter 1 already knows where every chunk lives, so the scheduler asks it and places the task there. Most input is then read from a local disk and **no network bandwidth is spent at all.** The file system’s metadata turns out to be the scheduler’s most valuable input — which is only possible because one machine had all of it.',
                  },
                  {
                    label: 'Load the whole dataset into RAM across the cluster first',
                    verdict: 'dead',
                    why: 'A terabyte of 2004 RAM, and it evaporates with the machine — which decision 1 just established happens during every job. This answer becomes right about a decade later when memory gets cheap and someone works out how to rebuild a lost partition from its lineage; that system is called Spark, and it is this paper with the disk taken out.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You just re-derived §3.1 and §3.4 — and the reason the model is so small',
              body: [
                '**Map and reduce are not the contribution.** Lisp had them in 1959, and the paper says outright that it was *“inspired by the map and reduce primitives present in Lisp and many other functional languages.”* Borrowing a forty-five-year-old idea is not what gets you into OSDI.',
                'The contribution is noticing what the borrowing *buys*. Force a computation into that shape and it becomes deterministic, side-effect-free, and indifferent to where it runs — and the instant that is true, four separate hard problems stop being the programmer’s: parallelism, distribution, fault tolerance, and placement. None of them was solved. They were made **inexpressible**.',
                'That is the trade to carry out of this chapter, because every distributed framework since has made it: **a smaller language buys a bigger runtime.** SQL made it decades earlier and got query planners. Spark made it again and got lineage recovery. The question a framework should be judged on is not what it lets you write — it is what it stops you writing, and what it hands you in exchange.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'The sort in the middle is the job',
      accent: 'denim',
      rung: 'Rung 3 · Where the work actually is',
      body: [
        'Your map and your reduce are the two small functions you wrote. Between them the framework does the only expensive thing in the system: it takes every intermediate pair every mapper produced, **groups them by key**, and hands each reducer one contiguous, sorted slice. Everything you associate with running a big job — the hours, the disk, the network, the mysterious pause where nothing appears to happen — is that regrouping.',
        'The structure has a cost you can compute. Every mapper can produce a key belonging to any reducer, so a job with **M** map tasks and **R** reduce tasks has **M × R** pieces of intermediate state, and the master tracks all of them. The paper gives its own working numbers — M = 200,000, R = 5,000 — which is a billion pieces, at roughly a byte apiece.',
        '**And that is Chapter 1’s wall again, one floor up.** GFS was bounded by one machine holding an entry per chunk; MapReduce is bounded by one machine holding a byte per map-reduce pair. Same shape, same reason, two papers by overlapping authors — because in both, the way you make a thousand machines cooperate cheaply is to let exactly one of them know everything.',
      ],
      diagram: <FanoutDiagram />,
      think: {
        q: 'Reduce cannot start until *every* map has finished. Why not let a reducer begin as soon as it has received something?',
        a: 'Because it has no way to know it has received *everything* for a key. A reducer is handed all the values that share a key, and the last mapper to finish might be holding one more — so starting early risks emitting an answer computed from part of the group. That is what makes this a **barrier**, and the barrier is what makes one slow machine everybody’s problem: a thousand workers sit idle waiting for the last straggler. Backup tasks in the next step are the patch, and the honest description of the fix is that the barrier is still there — it just gets crossed sooner.',
      },
    },
    {
      n: 'Step 04',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 4 · What it gave up',
      body: [
        '**It reads everything, every time.** No index, no schema, nothing pushed down. Asking how many crawled pages mention one phrase means reading the entire crawl — the paper’s own grep scans 10¹⁰ records at a peak of over 30 GB/s and takes about 150 seconds, and *that is the good case*, because the whole thing was going to be read anyway. When it was not going to be read anyway, this is a spectacular way to answer a small question. Chapter 3 exists because serving needed the other shape.',
        '**The barrier makes one slow machine everyone’s problem.** A straggler — a machine with a failing disk, a noisy neighbour, once a bug that silently disabled the processor caches and made a box a hundred times slower — holds up the entire job. The patch is **backup tasks**: near the end, re-run whatever is still in flight and take whichever copy finishes first. It is measurably worth it. Their terabyte sort took **891 seconds** with backups and **1,283 seconds** without: *44% of that job was one machine being slow.*',
        '**Latency has a floor, and it is minutes.** Startup, scheduling, the shuffle, the barrier — a job costs the same overhead whether it processes a petabyte or a paragraph. Nothing interactive is ever going to sit on top of this, which is why Google’s own web index eventually stopped being a MapReduce at all: it moved to incremental updates on Bigtable, and that story is Chapter 10.',
        'What it bought for that price is worth putting beside it. When the authors deliberately killed **200 of 1,746 workers** mid-sort, the job finished in 933 seconds — **5% slower.** No operator was paged, no state was recovered, nothing was resumed. The lost work was simply computed again.',
      ],
      callout: {
        kind: 'bad',
        big: 'READ IT ALL, EVERY TIME',
        text: 'No indexes and no schema, so the cost of a question is the size of the data rather than the size of the answer. Superb when you meant to read all of it; absurd when you wanted one row.',
      },
    },
    {
      n: 'Step 05',
      title: 'What it begat — and where it stands in 2026',
      rung: 'Rung 5 · Descendants',
      body: [
        'Outside Google the paper became **Hadoop MapReduce** (2006), and with it a decade of engineers writing Java `Mapper` and `Reducer` classes by hand. That was the pattern being mistaken for the product, and the database community said so at the time, loudly and mostly correctly — no schema, no indexes, no query optimiser, twenty-five years of storage research ignored. Then **Spark** (2010) kept the execution model, removed the write-to-disk between every stage, and recovered lost partitions by recomputing them from lineage — which is decision 1 of this chapter, applied to memory instead of disk.',
        'Google had already moved on. The indexing system that this paper was written to justify came off MapReduce around 2010, because rebuilding the whole index to reflect a handful of changed pages is exactly the absurdity in the step above. Its replacement processes updates incrementally, on Bigtable, with transactions bolted on by hand — **Chapter 10.**',
        '**2026: almost nobody writes a MapReduce and almost everybody runs one.** Ask a distributed SQL engine for a `GROUP BY` and it partitions the input, applies a pure function per partition, exchanges rows by key, and aggregates — and if a task dies it re-runs that task rather than your query. BigQuery, Spark, Flink, Trino, every dataframe API: the words are gone and the shape is holding the building up.',
        'The idea with the longest life is the one that was never about data at all — **that restricting what a program may do is what buys an automatic runtime.** Every framework that promises to handle failure for you is charging the same price, and it is worth knowing what you are paying before you agree to it.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Map task.',
      body: 'One worker applying your map function to one input split — usually a 64 MB GFS chunk, chosen so the task can run on a machine that already holds it.',
    },
    {
      term: 'Shuffle.',
      body: 'The regrouping between the two halves: every intermediate pair sorted and routed to the reducer that owns its key. Your code is not in it, and nearly all the cost is.',
    },
    {
      term: 'Straggler.',
      body: 'The last task still running while everything else waits. Not usually a broken machine — a slow disk, a noisy neighbour, a bad config.',
    },
    {
      term: 'Backup task.',
      body: 'A duplicate copy of a still-running task, launched near the end of a job. First one to finish wins; the other is discarded. Cheap insurance against a straggler.',
    },
    {
      term: 'Combiner.',
      body: 'A reduce run early, on the mapper, over that mapper’s own output. Legal only when the reduce is associative and commutative — and when it is legal, it can cut what crosses the network by orders of magnitude.',
    },
  ],
  inTheWild: {
    note: '4 ways this bites in production',
    points: [
      '**One hot key is one reducer.** Partitioning is by key, so a key holding a tenth of the data puts a tenth of the job on one machine, and no amount of cluster buys it down. This is the failure everybody meets and nobody predicts; the fixes are all key surgery — salt it, pre-aggregate it, handle it separately — and the DDIA comic on the shuffle draws it properly.',
      '**Non-deterministic map functions quietly break the guarantee.** Re-execution is only safe if a task computes the same thing twice, so a map that reads the clock, calls a service, or iterates a hash map in memory order can produce a result that depends on which attempt won. The paper says so, in a paragraph most readers skip: with non-deterministic operators you get weaker semantics, because two reducers may have read output from two different executions of the same mapper.',
      '**Side effects are outside the contract.** A task that writes to a database rather than returning its output will do it twice when the task is re-run — and it will be re-run, both for failures and for backup tasks. Every "why did we send these emails twice" incident in a batch pipeline is this, rediscovered.',
      '**The small-job tax is brutal.** Fixed overhead per job means a MapReduce over a few megabytes takes about as long as one over a few hundred gigabytes. Whole pipelines have been built around batching work up specifically so the framework’s floor is worth paying, which is the tail wagging the dog.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Accept the restriction',
        when: 'the work genuinely is per-record, the records are independent, and you were going to read all of them. In exchange the framework hands you parallelism, placement and failure recovery without you writing a line of it.',
      },
      {
        choose: 'Refuse it',
        when: 'the answer is small and findable — one row, one key, one range. Reading a petabyte to return a kilobyte is not a slow query, it is the wrong shape of system. That is what the next chapter is for.',
      },
      {
        choose: 'Watch the barrier',
        when: 'you care about *when* the answer arrives rather than how much it cost. Everything here is throughput; the job finishes when the slowest piece finishes, and backup tasks narrow that gap without closing it.',
      },
    ],
  },
  misconception: {
    think: '“Map and reduce came from functional programming, so the paper was really just applying an old Lisp idea to big data.”',
    actually:
      'The borrowing is real and the authors say so — and it is the *least* interesting thing here. In Lisp, map and reduce are a convenience for expressing a loop. In this paper they are a **constraint accepted in order to be paid for it**: because your function is deterministic and touches nothing outside its own slice, the framework may run it anywhere, twice, or not at all, and re-run it after a machine dies without asking you a thing. The idea is not that computations look like map and reduce. It is that **giving up the freedom to write anything is what makes an automatic runtime possible at all** — and that is a trade nobody was making in 1959.',
  },
  sources: [
    {
      year: '2004',
      title: 'MapReduce: Simplified Data Processing on Large Clusters — Dean & Ghemawat (OSDI)',
      url: 'https://static.googleusercontent.com/media/research.google.com/en//archive/mapreduce-osdi04.pdf',
      note: 'Short, and unusually pleasant to read. §3.1 (execution) and §3.4 (locality) are the machine; §3.6 on backup tasks is one page and is the most-borrowed idea in the paper. §5 is worth it for Figure 3 alone — the same sort run three times, once normally, once with backups off, once with 200 workers killed on purpose. Skip §4’s refinements on a first pass, then come back for the combiner.',
    },
    {
      year: '2008',
      title: 'MapReduce: A major step backwards — DeWitt & Stonebraker',
      url: 'https://homes.cs.washington.edu/~billhowe/mapreduce_a_major_step_backwards.html',
      note: 'The database establishment’s reply, and a genuinely useful corrective: no schema, no indexes, no optimiser, ignoring twenty-five years of results. Read it as a critique of the *product*, which is largely right, rather than of the *pattern*, which it misses — and notice how much of what it demanded eventually got built on top anyway.',
    },
    {
      year: '2012',
      title: 'Resilient Distributed Datasets — Zaharia et al. (NSDI)',
      url: 'https://www.usenix.org/system/files/conference/nsdi12/nsdi12-final138.pdf',
      note: 'Spark’s paper, and the direct answer to the third dead end above. Lineage — remembering how a partition was computed so it can be recomputed — is this chapter’s re-execution idea moved into memory. Read §2 and §5.',
    },
  ],
  seenIn: [
    { label: 'The Shuffle — the comic', to: '/ddia/read/shuffle', live: true },
    { label: 'Tail Latency — where backup tasks come from', to: '/ddia/read/tail-latency', live: true },
    { label: 'The File System That Refused to Edit — Ch 1', to: '/papers/gfs', live: true },
    { label: 'The Database GFS Deserved — Ch 3', to: '/papers/bigtable', live: true },
  ],
  finale: {
    title: 'A smaller language, a bigger runtime',
    body: 'Two chapters in, Google can store the web and sweep it. What it still cannot do is *look something up* — this model reads everything to answer anything, and the crawler wants to update one page while a user waits on one row. Both of those want the same thing: a place where a single record has an address. Next, that place gets built, on a file system that will not let anything be edited.',
  },
  next: { title: 'The Database GFS Deserved', slug: 'bigtable' },
}
