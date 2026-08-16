import type { Comic } from '../types'
import { ShuffleDiagram, BroadcastJoinDiagram, SkewDiagram, AmplificationDiagram, NullSkewDiagram } from '../diagrams'

export const shuffle: Comic = {
  slug: 'shuffle',
  chapter: 'Chapter 10 · Batch Processing',
  chapterNo: 'Ch 10',
  title: 'The Shuffle',
  dek: 'A batch job is mostly not computation. It is the sort in the middle — moving every record with the same key to the same machine — and almost everything that makes a job slow, or fast, is a decision about that sort.',
  minutes: 6,
  caption:
    'Map and reduce are the parts with names, and they are the easy parts. Between them sits an unnamed step that does the actual work: **every record with the same key has to end up on the same machine**, and the records start out scattered across every input file on every node. That step is the **shuffle** — an all-to-all sort across the network — and it is where a batch job spends its time, its disk and its bad luck.',
  steps: [
    {
      n: 'Step 01',
      title: 'Why there has to be a shuffle at all',
      accent: 'terra',
      rung: 'Rung 1 · Intuition',
      diagram: <ShuffleDiagram />,
      body: [
        'You want to count events per user. A mapper reads one chunk of the input and emits `(user, 1)` — but the events for user `alice` are in *every* chunk, because nobody sorted the logs by user before writing them.',
        'So before any reducer can count anything, every `alice` record scattered across the cluster has to be gathered onto one machine. With `M` mappers and `R` reducers that is **M × R transfers**, all at once, all across the network.',
        'This is why the framework sorts by key rather than hashing into memory: sorted runs can be merged in bounded memory and spilled to disk when they do not fit. **The shuffle is a distributed sort**, and the reduce step is just a walk over the result.',
      ],
      callout: {
        kind: 'bad',
        big: 'the real cost',
        text: 'Map and reduce are usually cheap and embarrassingly parallel. The shuffle is neither: it is network-bound, disk-bound, and it is the only part that cannot start until the mappers are mostly done.',
      },
      think: {
        q: 'If the shuffle is so expensive, why not just hash every record straight into an in-memory hash table on the right machine and skip the sorting?',
        a: 'That is precisely what a **hash aggregation** does, and frameworks use it whenever they can. The catch is memory: a hash table only works if the keys for one machine fit in RAM. Sorting works no matter how much data you have, because a sort can **spill to disk** and merge sorted runs back in bounded memory. So the choice is not sort-versus-hash on principle — it is "do I know this fits?" Hash when you know, sort when you cannot promise it, which at batch scale is most of the time.',
      },
    },
    {
      n: 'Step 02',
      title: 'The join is the shuffle, wearing a hat',
      accent: 'denim',
      rung: 'Rung 2 · Mechanism',
      body: [
        'A join asks the same question as a group-by: put everything with this key in one place. The standard answer is a **sort-merge join** — shuffle both sides by the join key, sort each, then walk the two sorted streams together. It works for any data of any size, and it pays the full shuffle for both sides.',
        'The interesting strategies are the ones that **avoid the shuffle**, and each one buys that by knowing something extra about the data.',
      ],
      code: {
        file: 'three ways to join',
        lines: [
          { t: 'sort-merge     shuffle BOTH sides, sort, walk together' },
          { t: '               works always. costs everything.' },
          { t: '' },
          { t: 'broadcast      one side fits in memory -> copy it everywhere', hl: 'good' },
          { t: '               the big side never moves. no shuffle.' },
          { t: '' },
          { t: 'partitioned    both sides ALREADY bucketed by the join key', hl: 'good' },
          { t: '               join bucket-to-bucket. no shuffle.' },
        ],
      },
      deeper: {
        summary: 'Why the broadcast join is the one query planners fight over',
        body: [
          'A broadcast join turns an `O(big + small)` network cost into `O(small × workers)`. When the small side is a dimension table of a few megabytes and the big side is a terabyte of facts, that is the difference between minutes and hours.',
          'It also explains the classic production failure: the planner estimates the small side at 8 MB, broadcasts it, and the real value is 8 GB — so every worker tries to hold 8 GB and the job dies all at once rather than merely running slowly. Bad statistics do not degrade a broadcast join; they detonate it.',
        ],
      },
    },
    {
      n: 'Fix 01',
      title: 'Broadcast: make the big side stand still',
      accent: 'denim',
      rung: 'Rung 2 · Mechanism',
      diagram: <BroadcastJoinDiagram />,
      body: [
        'If one side of the join is small enough to fit in a worker\'s memory, ship a copy of it to **every** worker and let each one join its local slice of the big table against the in-memory copy.',
        'Nothing about the large table moves. There is no sort, no spill, no all-to-all. The entire cost is sending the small side `W` times, which for a few megabytes across a few hundred workers is nothing at all.',
      ],
      callout: {
        kind: 'good',
        big: 'the trade',
        text: 'You are spending memory on every worker to buy back the network. That is almost always a good trade — right up until the "small" side is not small, and then it is the worst one available.',
      },
    },
    {
      n: 'Step 03',
      title: 'One hot key, and the cluster stops mattering',
      accent: 'terra',
      rung: 'Rung 3 · Consequence',
      diagram: <SkewDiagram />,
      body: [
        'Records are assigned to reducers by hashing the key — which balances beautifully when keys are roughly equally common, and not at all when they are not. A celebrity user, a `NULL` join key, a default value, one enormous tenant: all of them land every record on **one** reducer.',
        'The arithmetic is brutal. With 1,000 reducers and a perfectly even spread, each does 0.1% of the work. Let one key hold 10% of the rows and its reducer does 10% — **a hundred times the average** — while 999 machines sit finished and idle waiting for it.',
        'Adding machines does not help. The job cannot end before its slowest task, so the runtime is now set by one key on one machine, no matter how large the cluster is.',
      ],
      code: {
        file: 'why the cluster stopped helping',
        lines: [
          { t: '1,000 reducers, even spread -> each does   0.1% of rows' },
          { t: 'one key holds 10% of rows   -> that one does 10%', hl: 'bad' },
          { t: '' },
          { t: '   100x the average task, and the job waits for it', hl: 'bad' },
          { t: '   doubling the cluster changes nothing at all' },
        ],
      },
      think: {
        q: 'This "the job cannot finish before its slowest part" shape — where else on this site have you met it?',
        a: 'It is **Amdahl\'s law**, and it is the same sentence in three costumes. In [[tail latency|One slow backend decides a fan-out request: the answer waits for the slowest of them.]] the request waits for the slowest backend. In the capacity calculator, fixing the binding ceiling only buys you the distance to the next one. Here, the job waits for the slowest reducer. Each time the lesson is the same: **the part you did not fix sets the limit**, so the useful question is never "how fast is the fast path" but "what is the slow one, and how far away is the next one".',
      },
    },
    {
      n: 'Fix 02',
      title: 'Salting: split the hot key on purpose',
      accent: 'denim',
      rung: 'Rung 2 · Mechanism',
      diagram: <AmplificationDiagram />,
      body: [
        'If one key is too big for one reducer, stop insisting it goes to one reducer. Append a small random number to the hot key — `alice#0` through `alice#9` — so its records spread across ten reducers instead of one, then run a second, tiny job to combine the ten partial results.',
        'You have traded one pass over skewed data for two passes over balanced data, which is a bargain when the skew factor is 100.',
        'The other half of the fix is a **combiner**: aggregate on the map side before the shuffle, so a mapper emitting a million `alice` records sends one partial count instead of a million records. That does not fix a skewed *join*, but for a skewed group-by it removes most of the problem before the network ever sees it.',
      ],
      callout: {
        kind: 'good',
        big: 'the tell',
        text: 'If 999 tasks finish in two minutes and one runs for three hours, do not tune the cluster. Find the key.',
      },
    },
    {
      n: 'Step 04',
      title: 'Materializing, and why the successor engines are faster',
      accent: 'terra',
      rung: 'Rung 3 · Consequence',
      body: [
        'Classic MapReduce writes the output of every stage to the distributed filesystem before the next stage starts — **materializing** the intermediate state, replicated to three machines. A ten-stage pipeline therefore writes and re-reads the whole dataset ten times.',
        'The dataflow engines that replaced it — Spark, Tez, Flink — keep intermediate results in memory and hand them straight to the next operator, skipping the write, the replication and the read. That is most of the order-of-magnitude speedup people attribute to "in-memory processing".',
        'It is not free. Materialized state means a failed stage restarts from the last file on disk; pipelined state means the framework must **recompute** whatever was lost, which is why these engines track lineage — the recipe for rebuilding any partition from its inputs. You did not remove the cost of failure. You moved it from every run to only the runs that fail.',
      ],
      deeper: {
        summary: 'Why sorting still shows up in engines that avoid MapReduce',
        body: [
          'Even engines that pipeline aggressively fall back to a sort-based shuffle when the data for one partition exceeds memory — because that is the only strategy with a bounded memory footprint. The sort never went away; it became the fallback rather than the default.',
          'This is the same trade as the storage chapter: hash structures are faster when they fit, sorted structures are the ones that still work when they do not.',
        ],
      },
    },
  ],
  bubbles: [
    { term: 'shuffle', body: 'The all-to-all step between map and reduce that brings every record with the same key onto the same machine. Implemented as a distributed sort so it can spill to disk rather than requiring the keys to fit in memory.' },
    { term: 'skew', body: 'One key far more common than the others, so one reducer receives far more data. The job cannot end before that task ends, which makes the cluster size irrelevant.' },
    { term: 'combiner', body: 'A partial reduce run on the map side before the shuffle, so a mapper sends one aggregate instead of a million rows. Only valid when the reduce is associative and commutative — a sum, not a median.' },
    { term: 'materialization', body: 'Writing a stage’s output to durable storage before the next stage reads it. Costs a full write and read per stage; buys the ability to restart a failed stage without recomputing its inputs.' },
  ],
  inTheWild: {
    points: [
      {
        t: '**Skew is usually a NULL or a default.** The most common hot key in production is not a celebrity — it is `NULL`, `""`, `0`, or `unknown`, which every unmatched row shares. Filter those out before the join and a great many "mysteriously slow" jobs become fast.',
        figure: <NullSkewDiagram />,
      },
      '**The broadcast threshold is a guess about data you have not read.** Planners decide to broadcast from table statistics, and statistics go stale. When they are wrong the job does not slow down, it runs every worker out of memory simultaneously.',
      '**Small files destroy the map side.** A mapper is scheduled per input split; ten thousand tiny files means ten thousand tasks whose startup cost dwarfs their work. Compaction of the input is often a bigger win than anything you do to the query.',
      '**Speculative execution hides skew rather than fixing it.** Frameworks re-launch slow tasks on other machines and take the first to finish, which rescues a genuinely unlucky machine — but a task that is slow because it holds 10% of the rows will be exactly as slow on its replacement, and you have now done the work twice.',
      '**A sorted output is not a free byproduct.** The shuffle sorts by the *partitioning* key, not by whatever you want the output ordered by, and a global ordering across reducers needs its own pass with a range partitioner and a sample of the key distribution.',
    ],
  },
  tradeoffs: {
    title: 'Choosing the join',
    rows: [
      { choose: 'Broadcast hash join', when: 'one side comfortably fits in a worker’s memory, and you trust the statistic that says so. The cheapest join there is.' },
      { choose: 'Partitioned (bucketed) join', when: 'both sides are already stored partitioned by the join key. Free at query time, paid for once at write time.' },
      { choose: 'Sort-merge join', when: 'both sides are large and neither is pre-partitioned. Always works, always costs the full shuffle.' },
      { choose: 'Salt the key, then re-aggregate', when: 'one key dominates. Two balanced passes beat one skewed pass whenever the skew factor is large.' },
      { choose: 'A combiner', when: 'the aggregation is associative and commutative. Removes the volume before the network sees it — and is not available for medians or exact distinct counts.' },
    ],
  },
  misconception: {
    think: 'Batch jobs are slow because they process so much data. Add machines and they get faster.',
    actually:
      'Batch jobs are usually slow because of **movement and imbalance**, not volume. The map and reduce phases parallelise almost perfectly — they are the part adding machines helps. The shuffle is network-bound, and skew makes the job as slow as its single worst task no matter how many machines are watching it finish. That is why the effective fixes are all about *not moving data* (broadcast, pre-partitioning, combiners) or *balancing it* (salting), and why doubling a cluster against a skewed job changes nothing at all.',
  },
  sources: [
    {
      year: '2004',
      title: 'Dean & Ghemawat — MapReduce: Simplified Data Processing on Large Clusters',
      url: 'https://research.google/pubs/mapreduce-simplified-data-processing-on-large-clusters/',
      note: 'The original: the shuffle as a distributed sort, combiners, and speculative execution for stragglers.',
    },
    {
      title: 'Designing Data-Intensive Applications (1st ed.), Ch 10',
      note: 'Reduce-side vs map-side joins, handling skew, and materialization versus dataflow engines.',
    },
    {
      year: '2012',
      title: 'Zaharia et al. — Resilient Distributed Datasets (NSDI)',
      url: 'https://www.usenix.org/system/files/conference/nsdi12/nsdi12-final138.pdf',
      note: 'Lineage: how an engine can skip materializing intermediate state and still recover from failure.',
    },
  ],
  seenIn: [
    { label: 'Kafka — the log these pipelines usually read from', to: '/ddia/components/kafka', live: true },
    { label: 'Consistent hashing — the partitioning the shuffle depends on', to: '/ddia/read/partitioning', live: true },
    { label: 'Tail latency — the same "slowest part decides" arithmetic', to: '/ddia/read/tail-latency', live: true },
    { label: 'Capacity planning — where a full scan costs what it costs', to: '/calculator/capacity', live: true },
  ],
  finale: {
    title: 'The computation was never the problem',
    body: 'Everything expensive in a batch job happens between the two named steps. The shuffle moves every record with a shared key onto one machine, and every worthwhile optimisation is a way of moving less: broadcast the small side so the big one stands still, pre-partition so the sort already happened, aggregate on the map side so the network sees one row instead of a million. And when a job is inexplicably slow, the answer is almost never the cluster — it is one key, on one machine, that the other nine hundred and ninety-nine are waiting for.',
  },
  next: { slug: 'stream-table', title: 'Stream–Table Duality' },
}
