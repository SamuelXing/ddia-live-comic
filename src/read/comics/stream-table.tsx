import type { Comic } from '../types'
import { DualityDiagram, CompactionDiagram, WindowDiagram, ReplicationLogDiagram, CdcGapDiagram } from '../diagrams'

export const streamTable: Comic = {
  slug: 'stream-table',
  chapter: 'Chapter 11 · Stream Processing',
  chapterNo: 'Ch 11',
  title: 'Stream–Table Duality',
  dek: 'A table is what is true now. A stream is everything that happened. They look like different things and they are not — each one turns into the other, and noticing that is what makes derived data stop drifting apart.',
  minutes: 6,
  caption:
    'A database table holds **the current value of everything**. A stream carries **every change as it happens**. They feel like opposite kinds of object — one is state, one is motion — but they hold the same information in two shapes. Write down every change and you can rebuild the table. Watch a table closely enough and you get back the stream. Once you see that, a whole category of production bug turns out to have one fix.',
  steps: [
    {
      n: 'Step 01',
      title: 'The two directions',
      accent: 'denim',
      rung: 'Rung 1 · Intuition',
      diagram: <DualityDiagram />,
      body: [
        '**Table → stream.** Every change to a table is an event: `alice.email set to x`, `order 7 created`, `row 12 deleted`. Emit those as they happen and you have a stream. Databases already build this internally — it is the write-ahead log, and it is what replication ships to followers.',
        '**Stream → table.** Start with nothing, apply every event in order, and when you reach the end you are holding the table. Stop halfway and you are holding the table as it was at that moment.',
        'So the table is not the truth with a log attached for safety. **The log is the truth, and the table is a cached answer** to the question "what is the state right now?" — an answer you can always recompute.',
      ],
      callout: {
        kind: 'good',
        big: 'the reframe',
        text: 'The stream is the derivative of the table; the table is the integral of the stream. Neither is more real, but only one of them can be replayed.',
      },
      think: {
        q: 'If the table can always be rebuilt from the log, why keep the table at all?',
        a: 'Because **replay is a scan and reads are lookups**. Rebuilding from the log costs the whole log every time you want one row, which is fine once and absurd per request. The table is a materialized view: it exists purely so that reads are fast, and it earns that by being disposable. That is the actual power of the framing — if the table is a cache rather than the truth, you can drop it, change its schema, add a second one shaped differently for a different query, or rebuild it after a bug, and you have lost nothing. What you must never lose is the log.',
      },
    },
    {
      n: 'Step 02',
      title: 'A log is not a queue, and that is the whole trick',
      accent: 'terra',
      rung: 'Rung 2 · Mechanism',
      diagram: <ReplicationLogDiagram />,
      body: [
        'This only works because of a property most message brokers do **not** have. In a traditional queue, delivering a message consumes it: once the consumer acknowledges, it is gone, and it never existed for anyone who was not listening at the time.',
        'A log keeps everything. Consumers hold an **offset** — a bookmark into the log — and reading does not remove anything. Two consumers read at different speeds without interfering, and a *new* consumer can start from offset zero and see history it was never present for.',
        'That is what makes "stream → table" possible at all. You cannot rebuild state by replaying a queue, because a queue does not have a past.',
      ],
      code: {
        file: 'queue vs log',
        lines: [
          { t: 'queue:  consumer acks -> message deleted', hl: 'bad' },
          { t: '        a new consumer sees only what happens next' },
          { t: '' },
          { t: 'log:    consumer stores an offset, data stays', hl: 'good' },
          { t: '        a new consumer starts at 0 and sees everything' },
        ],
      },
      deeper: {
        summary: 'Why this makes reprocessing a normal operation rather than an incident',
        body: [
          'If a consumer had a bug for the last three days, the fix is: correct the code, reset the offset to three days ago, and let it run forward. The derived view rebuilds itself.',
          'Kreps calls the fully general version of this the **Lambda-free** or **Kappa** approach: instead of maintaining separate batch and streaming code paths that must agree, you run one stream processor and reprocess history through it whenever the logic changes. There is only ever one implementation to be wrong.',
        ],
      },
    },
    {
      n: 'Step 03',
      title: 'Compaction: the log turning back into the table',
      accent: 'denim',
      rung: 'Rung 2 · Mechanism',
      diagram: <CompactionDiagram />,
      body: [
        'The obvious objection is size. If the log keeps everything forever, replaying it eventually takes forever.',
        '**Log compaction** answers this: for each key, keep only the most recent value and discard the superseded ones. What survives is exactly one record per key — which is to say, the table.',
        'The arithmetic is the good part. A topic that has taken a billion updates across ten million distinct users compacts to **ten million records**, because that is how many distinct keys there are. Compacted size is set by your key cardinality, not by your history.',
      ],
      code: {
        file: 'what compaction costs',
        lines: [
          { t: '1,000,000,000 updates across 10,000,000 users' },
          { t: '' },
          { t: 'uncompacted -> 1e9 records, and growing forever', hl: 'bad' },
          { t: 'compacted   -> 1e7 records, one per key', hl: 'good' },
          { t: '' },
          { t: 'replay time = compacted bytes / sequential read rate' },
        ],
      },
      callout: {
        kind: 'good',
        big: 'the consequence',
        text: 'A compacted log is a table you can subscribe to. Rebuilding a cache, an index or a new service is a scan of it, and the capacity page will tell you exactly how long that scan takes.',
      },
    },
    {
      n: 'Step 04',
      title: 'The bug this actually fixes: dual writes',
      accent: 'terra',
      rung: 'Rung 3 · Consequence',
      body: [
        'Here is the shape almost every system reaches eventually. A user updates their profile. The application writes to the database, then writes to the search index, then invalidates the cache. Three writes, from one request handler.',
        'It goes wrong in two independent ways, and both are inevitable rather than unlucky. **The process can die between writes**, leaving the database updated and the index not. And **two concurrent updates can reach the two systems in different orders** — the database ends on value B while the index ends on value A. Neither system is broken. They simply disagree, permanently, and nothing will ever notice.',
        'The duality gives the fix: write **once**, to the log. Let the database, the search index, the cache and the analytics store each be a consumer of that one ordered stream. They may lag, but they lag through the *same sequence*, so they converge on the same answer instead of drifting to different ones.',
      ],
      callout: {
        kind: 'bad',
        big: 'why it is silent',
        text: 'Dual writes do not fail loudly. They produce two systems that are each internally consistent and quietly disagree, usually discovered months later by a customer.',
      },
      think: {
        q: 'The capacity calculator starts recommending "one log, many consumers" the moment two or more systems need every write. Why does two trigger it, and not three or five?',
        a: 'Because **one derived copy can be wired by hand and two cannot**. With a single consumer you can write to the log and let that one system follow it, or even do the second write in the same transaction and cope. With two, you have introduced the possibility of them disagreeing *with each other* — and disagreement between derived views is not detectable from inside either one. Two is where the ordering problem is born, so two is where the fix stops being optional.',
      },
    },
    {
      n: 'Step 05',
      title: 'When the stream never ends, you have to cut time',
      accent: 'terra',
      rung: 'Rung 3 · Consequence',
      diagram: <WindowDiagram />,
      body: [
        'A batch job knows when its input ends and can therefore say "the answer is 47". A stream has no end, so any aggregate needs a **window** — a decision about which slice of time an answer covers.',
        '**Tumbling** windows are fixed and non-overlapping (each minute, separately). **Hopping** windows are fixed and overlapping (the last five minutes, recomputed every minute). **Session** windows have no fixed size at all: the gaps in activity decide the edges, which is how you group one user’s burst of clicks.',
        'And then the genuinely hard part: **event time is not processing time**. An event stamped 10:00:03 may arrive at 10:00:50 because a phone was in a tunnel. Window by arrival and your numbers are wrong but always available; window by event time and your numbers are right but you never know when to publish them, because a straggler may still be coming.',
      ],
      deeper: {
        summary: 'Watermarks: declaring a window closed while admitting you might be wrong',
        body: [
          'A **watermark** is the system asserting "I believe I have seen everything up to time T". When the watermark passes the end of a window, the window is emitted. It is a heuristic, and the tuning is a straight trade: an aggressive watermark publishes fast and drops late data, a conservative one is accurate and slow.',
          'Because it is a heuristic, real pipelines also need a policy for events that arrive after their window closed. Drop them, publish a correction, or route them to a side channel for later — each is a product decision wearing engineering clothes, and pretending it is only a technical one is how dashboards quietly lose data.',
        ],
      },
    },
  ],
  bubbles: [
    { term: 'change data capture', body: 'Turning a database’s writes into a stream by reading its replication log rather than asking the application to publish events. Catches every write, including the ones made by migrations and by hand.' },
    { term: 'log compaction', body: 'Retaining only the most recent value per key and discarding superseded records. Bounds the log by key cardinality instead of by history, and leaves something you can replay into a table.' },
    { term: 'offset', body: 'A consumer’s bookmark into the log. Reading does not consume, so consumers move independently and a new one can start from the beginning.' },
    { term: 'watermark', body: 'An assertion that all events up to a given event time have probably arrived, used to decide when a window may be emitted. A heuristic, so late data needs a policy.' },
    { term: 'dual write', body: 'Writing the same fact to two systems from application code. Fails when the process dies between writes, and when two concurrent updates reach the two systems in different orders.' },
  ],
  inTheWild: {
    points: [
      {
        t: '**Application-level events miss writes; CDC does not.** If the app publishes the event, then every migration, backfill and manual `UPDATE` bypasses the stream. Reading the database’s own replication log catches all of them — at the cost of your stream now being coupled to a schema you did not design for consumers.',
        figure: <CdcGapDiagram />,
      },
      '**"Exactly once" is really effectively once.** Nothing can guarantee a message is delivered precisely one time across a network. What is achievable is that *processing it twice has the same effect as processing it once* — idempotent writes, or atomically committing the output alongside the consumer offset. If a system claims exactly-once, it is claiming one of those two.',
      '**Replay is only possible as far back as your retention.** A seven-day retention means a new consumer can rebuild seven days of history and no more. If the log is meant to be the source of truth, retention is a correctness setting rather than a cost setting — which is why compaction exists.',
      '**Compaction does not bound a key space that keeps growing.** One record per key is only a bound if the number of keys is bounded. Keyed by user, it is. Keyed by session or request id, the compacted log grows forever and you have made a very expensive queue.',
      '**Reprocessing is not free just because it is possible.** Replaying a year of events through a stream processor is a batch job with a different name — the capacity page’s full-scan arithmetic applies unchanged, and it will happily tell you the rebuild takes three days.',
      '**Order is only guaranteed within a partition.** Two events for the same user stay ordered only if they share a partition key. Get that key wrong and your carefully ordered log delivers a delete before the insert it was meant to follow.',
    ],
  },
  tradeoffs: {
    title: 'Where to put the truth',
    rows: [
      { choose: 'The table is the truth', when: 'one system owns the data, nothing else derives from it, and history has no value. The simplest thing that works, and most systems should stay here.' },
      { choose: 'The log is the truth', when: 'two or more systems need every change. Buys convergence instead of drift, and pays for it with a second thing to operate and a retention policy that now matters.' },
      { choose: 'Log-based CDC', when: 'you want the stream without changing the application, and can live with consumers depending on the database schema.' },
      { choose: 'Application events', when: 'you want events that mean something in the domain — `OrderPlaced`, not `row 7 changed` — and control every write path well enough to promise none escape.' },
      { choose: 'Compacted, keyed by an entity', when: 'consumers need current state rather than history. Bounded by key count, replayable, and effectively a table you subscribe to.' },
    ],
  },
  misconception: {
    think: 'A stream is just a queue of messages in flight. Once something is consumed it is gone, so a stream cannot be a source of truth.',
    actually:
      'That describes a **queue**, and it is exactly the property a log gives up. A log keeps its records and hands each consumer an offset instead of deleting on acknowledgement — so consumers move independently, a new consumer can start from the beginning, and history survives being read. Everything in this chapter rests on that one difference: you can rebuild a table by replaying a log, and you cannot rebuild anything by replaying a queue, because a queue has no past to replay.',
  },
  sources: [
    {
      year: '2013',
      title: 'Kreps — The Log: What every software engineer should know about real-time data’s unifying abstraction',
      url: 'https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying-abstraction',
      note: 'The essay that made the duality a design principle: the log as the source of truth, every store a materialized view of it.',
    },
    {
      title: 'Designing Data-Intensive Applications (1st ed.), Ch 11',
      note: 'Change data capture, event sourcing, the dual-write problem, and windowing by event time versus processing time.',
    },
    {
      year: '2015',
      title: 'Akidau et al. — The Dataflow Model (VLDB)',
      url: 'https://research.google/pubs/the-dataflow-model-a-practical-approach-to-balancing-correctness-latency-and-cost-in-massive-scale-unbounded-out-of-order-data-processing/',
      note: 'Windows, watermarks and triggers: the framework for deciding when an unbounded computation may answer.',
    },
  ],
  seenIn: [
    { label: 'Kafka — the log itself, in detail', to: '/ddia/components/kafka', live: true },
    { label: 'Capacity planning — where “one log, many consumers” gets recommended', to: '/calculator/capacity', live: true },
    { label: 'The shuffle — the batch half of the same story', to: '/ddia/read/shuffle', live: true },
    { label: 'Leader & followers — replication as the original changelog', to: '/ddia/read/replication-leader', live: true },
    { label: 'Observability at scale — a pipeline built on exactly this shape', to: '/ddia/sims/observability', live: true },
  ],
  finale: {
    title: 'One ordered story, many readers',
    body: 'The duality is not a clever observation about data structures; it is a way out of a specific and very common mess. The moment a second system needs to know about every change, writing to both from application code guarantees they will eventually disagree — silently, and in a way neither can detect from the inside. Write once to an ordered log and let every store be a view of it, and the systems can lag but they cannot diverge, because they are all reading the same story in the same order. The table stops being the truth and becomes what it always really was: a fast answer you are free to throw away and compute again.',
  },
  next: { slug: 'tail-latency', title: 'Tail Latency' },
}
