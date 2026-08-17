import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import {
  PipeVsTopicDiagram,
  ChangelogDiagram,
  UnbundledDiagram,
  TwoEndingsDiagram,
} from '../diagrams'
import { unbundlingTrace } from './unbundling-trace'

/* The last chapter of the season, and the one with the hardest job: it has to
   argue against the chapter before it without either of them losing.

   The trap is that Chapter 13 already read Kafka. So this is emphatically not
   a Kafka chapter. Chapter 13's subject was the log as a primary record — the
   duality, the offsets, the stateless broker. This one takes that as given and
   asks the architectural question the 2015 paper actually poses: given many
   specialised stores that will not merge, what is the interface between them,
   and what does choosing a log as that interface cost you? Samza is the part
   Chapter 13 never touched and it carries most of the weight here, because
   local state plus a changelog is where the argument stops being a slogan.

   The other job is the ending. The season closes on a disagreement rather than
   a resolution, and the last figure has to hold both positions without a
   thumb on the scale — the honest state of the argument in 2026 is that both
   shipped and both are in production, which is not a cop-out, it is the
   result. */

export const unbundling: Chapter = {
  slug: 'unbundling',
  act: 'Epilogue · What You Were Building All Along',
  paperNo: 'Paper 30',
  title: 'The Database, With the Lid Off',
  dek: 'The previous chapter put four storage systems back under one lid. This one, written five years earlier, says the pieces were never going to fit — and that the useful thing to standardise is not the system but the seam between systems.',
  minutes: 16,
  paper: {
    title: 'Kafka, Samza and the Unix Philosophy of Distributed Data',
    authors: 'Martin Kleppmann & Jay Kreps',
    venue: 'IEEE Data Engineering Bulletin 38(4):4–14 · Cambridge, Confluent',
    year: '2015',
    url: 'https://martin.kleppmann.com/papers/kafka-debull15.pdf',
  },
  caption:
    'Here is a claim that sounds like arrogance and is closer to an apology. **You have spent two seasons building a database and nobody told you.** A log that is the record of what happened. Copies of it in other shapes, each behind by a different amount. Answers kept up to date as changes arrive. A cache that fills on demand. Indexes that make one access pattern fast at the cost of another. Those are not systems you assembled around a database — *they are the parts of one*, taken out of the box and spread across a datacentre, with the wiring between them left as an exercise. This paper says that is not a failure to be corrected. It says it is the correct response to a fact the previous chapter has to work around: **different workloads want genuinely different storage, and no single product is going to serve all of them well.**',
  steps: [
    {
      n: 'Step 01',
      title: 'Nobody is going to write the one database',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'Start where the paper starts, which is not with logs. A large personalised service — people you may know, jobs you might like, search ranking, spam detection, the counter that tells you who viewed your profile — is a pile of feedback loops over user behaviour, and each one wants its data in a different shape. Full-text search wants an inverted index. The analytics team wants columns. The thing serving the ranking wants a key-value store on an SSD next to the process. Somebody wants a sparse matrix and somebody else wants pre-aggregated cubes.',
        '**Most databases specialise in doing one of those well, because one is hard enough.** So developers do the only available thing: they run several systems and move data between them. And the systems were not built for that — they were built to have excellent semantics *inside* their own boundary, and their integration story is whatever got retrofitted. Change data capture, in 2015, was a thing you built out of a replication protocol somebody had not intended for you.',
        'The requirement that falls out has three parts and only one of them is technical. **System scalability** — hundreds of millions of users, millions of requests a second — is the easy one to state. **Operational robustness** means one slow or dead component does not take the rest with it. And **organisational scalability** means a thousand engineers can work on this without a meeting: the paper puts this in the same list as throughput, deliberately, because at LinkedIn’s size it was the binding constraint. *A design that requires two teams to coordinate before either can ship is a design that does not scale, and no benchmark will tell you.*',
        'And there was already a system that got all three right, which is the awkward part. **A workflow of batch jobs chained by directory name.** Its properties read like a list of things nobody thinks to ask for: any number of jobs can read the same directory without disturbing each other or the producer; every input and output can be inspected by an ad-hoc debugging job; the directory name is a contract between teams; jobs can be in different languages on different schedules; you can trace where any dataset came from and who consumes it; and *if the forty-sixth job in a chain of fifty fails, you fix it and restart at the forty-sixth.* The only problem with batch is the clock. Results are hours or a day old.',
      ],
      diagram: <UnbundledDiagram />,
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'Three decisions. The first is what the seam between systems is; the second is where a stateful operator keeps what it knows; the third is the one people get wrong, because the correct answer looks like negligence.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**What you are keeping:** every property of a batch workflow — many independent readers, ad-hoc inspection, a name as the contract between teams, restart from the failed stage, no producer harmed by a slow consumer.',
              '**What you are removing:** the hours. Results should be visible in seconds, which means intermediate results cannot be complete files that one job finishes before the next begins.',
              '**What you may not assume:** that the systems downstream are yours. A search index, an analytics store and three teams’ services all want the same events, in different shapes, on different schedules.',
              '**Who is writing this:** a thousand engineers who do not know each other. Any design requiring two of them to agree before either ships is disqualified, however elegant.',
            ],
            questions: [
              {
                q: 'The intermediate files have to go. What connects one processing stage to the next?',
                options: [
                  {
                    label: 'A named, replicated, partitioned log that consumers read at their own position',
                    verdict: 'move',
                    why: 'It is the batch workflow with the barrier removed. The **name** does what the directory name did — it is a contract two teams can write down, and neither job knows the other exists. The **log** keeps the properties a pipe gives up: many consumers at different positions, none of them affecting each other; a crashed consumer that restarts where it left off; and an ad-hoc debugging consumer nobody planned for. And because messages are appended rather than delivered, adding a reader costs the producer nothing. *The move is recognising that "incrementally passing output to input" and "a durable named artefact" were never actually in tension* — they only appeared to be because files are written all at once and pipes are not stored.',
                  },
                  {
                    label: 'A Unix pipe, or its distributed equivalent — a direct connection between the two stages',
                    verdict: 'dead',
                    why: 'It is the right instinct and the paper names exactly where it fails, in two places. A pipe **connects one output to one input**, so the moment a second team wants the same stream you are back to a fan-out somebody has to build. And a pipe **cannot be repaired**: if either process dies, the data in flight is gone and there is no position to restart from. Those are precisely the two columns the batch workflow had. What you want is a pipe that is also a file, which is a strange object until you notice that an append-only log on disk is one.',
                  },
                  {
                    label: 'The framework’s own network protocol between operators, as most stream processors do',
                    verdict: 'dead',
                    why: 'This is what nearly everything else in Season 2 does, and rejecting it is the least obvious decision in the paper. A private transport is faster and it makes the intermediate result **invisible and unshareable**: only the framework can see it, only jobs in the same topology can consume it, and a debugging consumer cannot attach. You have optimised the hop between two operators and deleted the property that let a fourth team build something you never anticipated. *The paper’s bet is that in a large organisation the second thing is worth more than the first.*',
                  },
                  {
                    label: 'A shared database that stages write to and read from',
                    verdict: 'dead',
                    why: 'The most common answer in practice and the one that fails on all three of the original requirements at once. Readers now poll, so they either miss changes between polls or hammer the database. There is no ordering anyone can agree on and no position to restart from. Every consumer’s load lands on one system, so a slow analytics query hurts a live service — **the coupling you were trying to remove, with a schema migration attached.** And a table holds the current value, so a consumer that arrives late cannot reconstruct what happened; Chapter 13 made this point about snapshots and it is the same point.',
                  },
                ],
              },
              {
                q: 'A join or an aggregation needs state. Where does the operator keep it?',
                options: [
                  {
                    label: 'In an embedded store on local disk, with every write also appended to a compacted log',
                    verdict: 'move',
                    why: 'Two halves and each fixes the other’s problem. **Local** means reads and writes never leave the process, which is what makes the throughput possible at all. **Logged** means the state survives losing the disk: replay the changelog and the store comes back. Compaction keeps that log roughly the size of the state rather than the size of the history, since only the latest value per key is retained. Then the part that is genuinely elegant: *the changelog is also a stream*, so a job that maintains a table of counts has, by the act of making itself durable, published those counts for anybody downstream — no separate output topic and no second copy. **Recovery and consumption are the same operation**, which is why the recovery path works, since it is exercised constantly.',
                  },
                  {
                    label: 'In an external database, queried once per message',
                    verdict: 'dead',
                    why: 'The obvious answer and the paper is blunt about it: the round-trip time becomes the bottleneck, and a stream fast enough to be interesting will overload the database. Think about the ratio. One network round trip is hundreds of microseconds at best; a local embedded store answers in single-digit. At a million messages a second the difference is not a percentage, it is whether the job exists. And you have re-coupled a stream processor to a shared system, so a rebalance in the stream job becomes an incident for whoever else uses that database.',
                  },
                  {
                    label: 'Replicate the state to standby nodes so a failover has a warm copy',
                    verdict: 'dead',
                    why: 'It works, and it is a second replication protocol to build, test and operate — with its own failure modes, its own split-brain question, and its own leader election. You already have a replicated log with all of that solved, sitting in the middle of the architecture, and you are about to run something in parallel with it. **The state is a table and tables are derivable from logs**, so use the log you have. Warm standbys are a latency optimisation on top, not a foundation.',
                  },
                  {
                    label: 'Keep it in memory and checkpoint the whole thing periodically',
                    verdict: 'dead',
                    why: 'Chapter 23’s answer, and it is genuinely good in its own setting — this is a real fork in the road rather than a wrong turn. The difference is what a snapshot is for. A periodic global snapshot restores a whole job to a consistent instant, which is exactly right when the state is the framework’s business and nobody outside needs it. A per-key changelog gives up the global instant and gets something else: **the state is legible from outside the job**, as an ordinary topic another team can subscribe to. One design optimises for the job’s own recovery, the other for the state being useful to people who did not write the job.',
                  },
                ],
              },
              {
                q: 'A consumer falls behind the producer. What should the system do?',
                options: [
                  {
                    label: 'Nothing — let it fall behind, and let the log on disk be the buffer',
                    verdict: 'move',
                    why: 'The refusal is deliberate and it is the paper’s clearest statement of what it values. **Kafka does not provide backpressure**: the producer and every other consumer keep running at full speed while the slow one drifts. Since every message is already on disk, buffering the laggard costs nothing extra. The result is the operational robustness requirement, discharged — *one broken process cannot slow down anybody else*, which in a company where a thousand engineers deploy independently is worth more than tidiness. The catch is real and worth stating in the same breath: the buffer is not infinite. It is the retention period, usually days or weeks, so what you actually have is a deadline. **The number that matters is not retention, it is retention minus how far behind you are** — that is how long you have to fix it before data is genuinely gone.',
                  },
                  {
                    label: 'Apply backpressure — slow the producer until the consumer catches up',
                    verdict: 'dead',
                    why: 'The standard answer in stream processing, and here it inverts the goal. Backpressure is a mechanism for propagating one component’s problem to everybody upstream, which is correct inside a single job where all the operators fail together anyway. Across an organisation it means the batch job somebody wrote badly on Tuesday can throttle the live event pipeline. **You have turned an isolated failure into a shared one**, in the name of not wasting disk that was going to be written anyway.',
                  },
                  {
                    label: 'Drop messages for the slow consumer, so it catches up to live',
                    verdict: 'dead',
                    why: 'What push-based log aggregators did, and it is what forces the choice this design refuses to make. Once you may drop, the consumer can no longer be a database replica, a search index or a recovery mechanism — every one of those needs *all* the records, in order, or it silently diverges. This is the single decision that separates a messaging system from a system of record, and taking it would cost you the changelog, the derived stores and the ability to rebuild anything.',
                  },
                  {
                    label: 'Have the broker track each consumer and hold messages until everyone acknowledges',
                    verdict: 'dead',
                    why: 'A queue, and Chapter 13 took this apart already: per-consumer state on the broker means it pays for every subscriber, can never free anything until the slowest one is finished, and turns adding a reader into a capacity decision. The version that matters here is organisational. A system where one team adding a consumer changes another team’s retention is a system that requires a meeting, and **the requirement was that no meeting is required.**',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived the unbundled database — and gave it a Unix accent',
              body: [
                '**The seam is a named, replicated log.** It keeps the batch workflow’s properties — many readers, ad-hoc inspection, a name as a contract, restart from a position — at the latency of a pipe. Kafka does one thing and refuses the rest: only an appending write and a sequential read from an offset, no random-access index, which is why it goes as fast as it does. The paper quotes the Unix maxim for this and it fits: *make each program do one thing well.*',
                '**Operators keep state locally and log it.** An embedded key-value store for speed, a compacted changelog for durability — and that changelog is itself a stream, so the state is publishable rather than trapped. Chapter 12’s "cache the database" and Chapter 25’s "maintained view" are both this shape: a derived thing that a log can rebuild.',
                '**No backpressure, on purpose.** The disk is the buffer, the slow consumer is its own problem, and the deadline is retention minus lag. This is the operational-robustness requirement paid for in disk.',
                '**And what it adds up to is the second Unix maxim.** *Expect the output of every program to become the input to another, as yet unknown, program.* Every derived store — the search index, the columnar copy, the cache, the feature store — is a consumer that reads the same records in the same order and builds whatever it needs. Because the order is the same for everyone, the views are consistent with each other **without any of them talking to the others**, which is state machine replication from Chapter 7 pointed at an entire company’s infrastructure. The paper’s summary is one line: *the truth is in the log, and a database is a cached subset of the log.*',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'The part that makes it real: state that outlives the process',
      accent: 'denim',
      rung: 'Rung 3 · The answer',
      span: 2,
      body: [
        'The composition argument is easy to agree with and easy to dismiss as a slogan. What makes it a design is the state handling, because that is where every other attempt at this has quietly reintroduced a shared database. Watch a job keep counts, lose the machine holding them, and come back correct — without a peer, a standby, or anything that had to be running.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={unbundlingTrace} />
        </div>
      ),
      deeper: {
        summary: 'Why the join is the case that decides it',
        body: [
          'Aggregation is the gentle example. The one that forces the design is joining a stream of events against a table — clickstream events against user profiles, say, so that downstream consumers get the profile embedded rather than having to look it up.',
          'The naive implementation queries the profile database once per event, and it is the single most common way a stream pipeline takes down a production database. The paper says so plainly: the round trip becomes the bottleneck, and this approach can easily overload the external database. The traffic is not the application’s traffic — it is the *event rate*, which at LinkedIn was several orders of magnitude larger.',
          '**The alternative is to stop querying the table and start subscribing to it.** Extract the profile database as a log-compacted stream via change data capture: a snapshot of every profile as of some point, then an update message whenever one changes. The join task consumes that stream into its own local store, exactly the way it recovers its own state, and then looks up profiles in-process at memory speed. *The table has become a stream and then a local replica of a table again*, which is Chapter 13’s duality doing actual work rather than being an observation.',
          'The constraint this imposes is worth knowing because it will bite you. Both inputs must be partitioned the same way, by the same key, into the same number of partitions, so that partition *k* of each arrives at the same task. Joining on a second, different key means a second stage that repartitions — the same multi-stage shape a MapReduce workflow has, for the same reason. **Co-partitioning is not an implementation detail; it is the thing you plan the pipeline around**, and it is Chapter 6’s partition key showing up for the third time in this book.',
        ],
        figure: <ChangelogDiagram />,
      },
    },
    {
      n: 'Step 04',
      title: 'Unix, and the two places the analogy breaks',
      rung: 'Rung 4 · The argument',
      body: [
        'The paper asks its own hardest question in §4.3, and the fact that it asks is why the analogy is worth taking seriously. Unix tools are famous for short, ad-hoc, experimental work — a pipeline you type once and never again. Databases are what people build things on that must run for a decade. *If the goal is stream-processing applications that run reliably for years, is Unix really a good role model?*',
        'The answer given is narrow and honest. The database tradition offers clean semantics and a declarative language, and that has been an enormous success — and it has not worked for this class of application, because statistical machine learning and information retrieval do not decompose into relational operators. Add to that the storage problem from Step 01, and you get the position: not that relational databases are wrong, but that **in the absence of one system that does everything, composition is the situation you are in whether or not you have a philosophy about it.** All the philosophy adds is that you should standardise the joint.',
        'And the analogy breaks in two named places, which the paper does not paper over. A Unix pipe joins **exactly one** writer to one reader; a topic has any number of consumers who cannot disturb each other. And a pipe **cannot be repaired** — kill either end and the data in flight is gone — where a consumer resumes from a stored offset. Both differences run the same way: the topic keeps what the *batch workflow* had, not what the pipe had. The Unix inheritance is the composability, not the mechanism.',
        '*So the strong version of the claim is architectural rather than aesthetic.* If the log is the record and every store is a consumer of it, then a database is not a thing you have — it is a shape you can see: storage engine, replication, indexes, materialised views and a query planner, each running as its own service, wired by a log instead of by function calls inside one process. **You did not fail to buy a database. You built one with the lid off, and you can see all the parts.**',
      ],
      diagram: <PipeVsTopicDiagram />,
      callout: {
        kind: 'good',
        big: 'THE TRUTH IS IN THE LOG',
        text: 'And a database is a cached subset of it. Every derived store reads the same records in the same order, so they agree without ever consulting each other — Chapter 7’s state machine replication, aimed at a whole company.',
      },
    },
    {
      n: 'Step 05',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 5 · What it costs',
      body: [
        '**Reads are stale, structurally.** Write to the log, then read from a store maintained by consuming that log, and you may get the old value. This is not a defect to be fixed — it is the same decoupling that stops a slow consumer hurting anybody, so removing it removes the benefit. The paper notes linearizable structures can be built over a totally ordered log if you need them, which is true and is a different system than the one you were just admiring.',
        '**Crashes reprocess.** A restarted job resumes from its last checkpointed offset, so everything between that checkpoint and the crash is processed twice. For an idempotent operation that is invisible; for the counter in the paper’s own worked example it means the counts come out *slightly wrong*, and the paper says so about its own figure. Exactly-once is listed as work in progress — the transactional protocol landed in Kafka afterwards, which is worth knowing when reading the 2015 text.',
        '**Ordering is per partition and nowhere else.** Total order within a partition, no ordering guarantee across them, which is exactly what buys the linear scaling. So the partition key decides what can be ordered together and what can be parallelised, it is as painful to change as a primary key, and Chapter 6 already told you that.',
        '**And it is a lot of machinery to hold in your head.** The programming model is one message at a time, which the paper calls flexible and also harder to use, more error-prone, and less amenable to automatic optimisation than a declarative language. That is the honest summary of the whole approach, not just the API: **you have taken the lid off a database, and now you are responsible for the parts.** Nobody optimises across your five systems. Nobody enforces a constraint that spans them. Nobody hands you a query plan.',
      ],
      callout: {
        kind: 'bad',
        big: 'YOU ARE NOW THE QUERY PLANNER',
        text: 'Stale reads by design, duplicate processing after a crash, ordering only within a partition, and no optimiser that can see across the systems you wired together. The lid was doing work.',
      },
    },
    {
      n: 'Step 06',
      title: 'Where it stands in 2026',
      rung: 'Rung 6 · Descendants',
      body: [
        '**The paper predicted its own successor in a footnote and was right.** It mentions an effort underway to add Kafka Streams, notes the difference is that Samza required YARN, and says the two can be regarded as equivalent for its purposes. That is what happened: Kafka Streams became the default way to do this, Flink took the heavier end, and Samza itself faded. *The architecture outlived the framework it was argued through*, which is the outcome a philosophy paper should want and rarely gets.',
        '**Exactly-once stopped being future work.** The transactional protocol the limitations section points at shipped, so the duplicate-processing caveat is now a configuration rather than a fact of life — at a throughput cost, and only within the Kafka ecosystem. It is the single largest change between the paper and the present, and it removes the caveat most often used to dismiss the approach.',
        '**And the declarative layer arrived from every direction.** The paper’s last limitation is that one message at a time is error-prone and hard to optimise, with a SQL interface listed as in progress. Streaming SQL is now ordinary — Flink SQL, ksqlDB, Materialize, and the whole of Act III. Which means the two halves of Season 2 met: **the composition argument supplied the wiring, and the incremental-view-maintenance work supplied a language that compiles into it.**',
        '*What has not changed is the disagreement.* Both endings shipped. Companies run lakehouses and companies run event-driven architectures over a log, and plenty run both, with a Kafka topic feeding a Delta or Iceberg table which is then queried by something else entirely. The honest 2026 position is not that one won — it is that **the question turned out to be about where you want your seams, and that is a question about your organisation as much as your data.** Which is what a paper that lists organisational scalability beside throughput was saying in the first place.',
      ],
      diagram: <TwoEndingsDiagram />,
    },
    {
      n: 'Step 07',
      title: 'What the season was about',
      rung: 'Rung 7 · The close',
      body: [
        'Season 2 asked one question in four acts: **how long after something happens can somebody see it, and what does each way of shortening that cost?** Act I got from hours to minutes by keeping the middle of a computation in memory and finding a way to recover it that did not require writing it down. Act II got from minutes to seconds and paid for it with the discovery that the time an event happened and the time it arrived are different numbers, and that most of the difficulty in stream processing is that gap. Act III got to *now*, by treating the change as the unit of work so an answer is updated rather than recomputed. Act IV got to before the network, by making convergence a property of the data rather than a protocol.',
        'And every one of those rungs was paid for in the same currency. Memory that is resident and cannot be spilled. State that has to be kept because a late record might still arrive. Indexes that keep every difference because a later version may need a different subset. A change history that cannot be truncated because somebody may reconnect after six months. *Freshness is bought with state you have to keep hot*, over and over, in four different disguises.',
        '**Then the epilogue asked what you had built by doing all that, and got two answers.** One says the pieces are a database that got taken apart by accident, and the accident is fixable — put a transaction log under the storage and the parts fit back together. The other says they are a database that was taken apart on purpose, because the workloads genuinely differ, and the useful move is to standardise the joint rather than reassemble the machine. Both are in production. Both are right about the thing they measured.',
        '*And they agree about the mechanism completely.* One ordered log of changes that anybody may replay from any point — a `_delta_log` directory of numbered JSON objects, or a partitioned topic on a broker. Season 1 named an act after that idea in 2011 and this is where it lands: **not as a component you install, but as the thing the argument is conducted in.** Whichever ending you prefer, the log is underneath it, and that is the least surprising and most durable result in this book.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Organisational scalability.',
      body: 'Whether a thousand engineers can work on the system without excessive coordination. Listed beside throughput in the paper’s requirements, and the constraint that decides most of its design choices.',
    },
    {
      term: 'Changelog.',
      body: 'The stream of every change to an operator’s local state, appended to a compacted topic. Durability, output, and the input to the next stage, all being the same object.',
    },
    {
      term: 'Co-partitioning.',
      body: 'Both sides of a join partitioned by the same key into the same number of partitions, so matching records land on the same task. Joining on a second key needs a second stage.',
    },
    {
      term: 'Backpressure.',
      body: 'Slowing a producer because a consumer cannot keep up. Deliberately absent here — the on-disk log absorbs it, so one slow reader is nobody else’s problem until retention runs out.',
    },
  ],
  inTheWild: {
    note: '4 things to take from this whatever you end up running',
    points: [
      '**Ask what the interface between your systems is, and whether it has a name.** If the answer is "a nightly job Priya wrote", you have a coupling with nobody responsible for it. A named stream or a named dataset is a contract; a script is a rumour.',
      '**Local state plus a log beats a shared database, whenever the read rate is the event rate.** The moment a per-message lookup crosses into a shared system, the event rate becomes that system’s traffic, and event rates are much larger than the traffic anybody sized it for.',
      '**Absence of backpressure is a choice with a deadline attached.** Letting a consumer fall behind is the right default for independent teams, and it converts a hard failure into a soft one that expires. Know your retention minus your lag; that number is how long you have.',
      '**"Do one thing well" is a claim about interfaces, not about size.** Kafka goes fast because it supports only an append and a sequential read from an offset — the indexes and caches everyone needs get built by consumers, in the shape each of them wants.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'A durable named stream over a direct connection',
        when: 'more than one thing might ever want the data — which is nearly always, and you rarely know who in advance. The direct connection is faster and it deletes the option of a consumer you have not met.',
      },
      {
        choose: 'Embedded local state over a shared store',
        when: 'the operator reads per message. Then make it durable with a log rather than a replication protocol, and the log is publishable, which the replication protocol would not have been.',
      },
      {
        choose: 'Isolation over efficiency between teams',
        when: 'the teams deploy independently. Buffering a slow consumer on disk wastes storage; propagating its slowness upstream wastes everybody’s week.',
      },
      {
        choose: 'Composition when the workloads genuinely differ, unification when they do not',
        when: 'deciding between this chapter and the last. Four copies of one dataset because atomicity was missing is waste. A search index and a columnar store existing separately is not — those are different jobs.',
      },
    ],
  },
  misconception: {
    think: '“Unbundling the database means running more systems than you need.”',
    actually:
      'The count is not the claim. This design does not add a search index, a cache and a columnar store to your architecture — **those were already there**, because a full-text query, a per-request lookup and a scan of one column across a billion rows want genuinely different layouts, and no single product serves all three well. What was also already there, and is the actual target, is the *tangle between them*: a change-capture daemon here, a nightly export there, a queue somebody added, each pair of systems joined by its own bespoke pipeline that one person understands. **The proposal is to replace every one of those pipelines with the same seam.** Each store becomes a consumer that reads the same records in the same order and builds whatever index it needs, so the number of integrations drops from one per pair of systems to one per system, and — because everyone sees the same order — the derived copies stay consistent with each other without any of them talking. That also changes what a derived store *is*: it stops being a thing you migrate and starts being a thing you can delete and rebuild, which is why adding a fifth consumer is a deploy rather than a project. The honest cost is not extra systems. It is that nothing optimises across the seam, nothing enforces a constraint that spans it, and every read on the far side is a little bit stale — *you took the lid off, and the lid was doing work.*',
  },
  sources: [
    {
      year: '2015',
      title: 'Kafka, Samza and the Unix Philosophy of Distributed Data — Kleppmann & Kreps (IEEE Data Engineering Bulletin 38(4))',
      url: 'https://martin.kleppmann.com/papers/kafka-debull15.pdf',
      note: 'Eleven pages and the most readable thing in this bibliography. **§1.2 is the part to read even if you skip the rest** — the list of properties a batch workflow has that nobody thinks to ask for, which is the specification the whole design is written against. §4.3 asks whether Unix is really a good role model for software meant to run for a decade, and answers it narrowly rather than triumphally. §4.4 is a short, complete limitations section.',
    },
    {
      year: '2014',
      title: 'I Heart Logs — Jay Kreps (O’Reilly)',
      url: 'https://www.oreilly.com/library/view/i-heart-logs/9781491909379/',
      note: 'Sixty pages, and the long-form version of the claim this chapter is built on. Worth it if the log-as-record framing landed and you want it argued properly rather than in a section — though Chapter 13’s 2013 post covers the same ground free, so read this one only if you want the book.',
    },
    {
      year: '2015',
      title: 'Immutability Changes Everything — Pat Helland (CIDR)',
      url: 'https://www.cidrdb.org/cidr2015/Papers/CIDR15_Paper16.pdf',
      note: 'The source of the line this paper quotes — that the truth is in the log and a database is a cached subset of it — and much more besides. Helland’s argument is that cheap storage made append-only the default at every layer at once, from SSDs up to datacentre architecture. Read it for the range: it is the same observation as this chapter, taken much wider.',
    },
    {
      year: '1978',
      title: 'UNIX Time-Sharing System: Foreword — McIlroy, Pinson & Tague (Bell System Technical Journal)',
      url: 'https://archive.org/details/bstj57-6-1899',
      note: 'The origin of both maxims the paper leans on — make each program do one thing well, and expect the output of every program to become the input to another, as yet unknown, program. Three pages. Worth reading in the original to see how much of it is about *organisational* pressure inside Bell Labs, which is exactly the argument this paper is making forty years later.',
    },
    {
      year: '2013',
      title: 'Tango: Distributed Data Structures over a Shared Log — Balakrishnan et al. (SOSP)',
      url: 'https://sigops.org/s/conferences/sosp/2013/papers/p325-balakrishnan.pdf',
      note: 'The citation the limitations section points at when it says linearizable structures can be built over a totally ordered log. The interesting part is how directly it contradicts the relaxed reading of this chapter: given one shared log, you can have real transactions across separate data structures. **If you want to argue against unbundling from inside its own premises, start here.**',
    },
    {
      year: '2020',
      title: 'Delta Lake: High-Performance ACID Table Storage over Cloud Object Stores — Armbrust et al. (PVLDB 13(12))',
      url: 'https://www.vldb.org/pvldb/vol13/p3411-armbrust.pdf',
      note: 'The other ending, five years later, and the reason to read them as a pair. Same primitive, opposite conclusion about where the system boundary goes — and the most useful exercise in this epilogue is deciding which of the two is describing your own architecture, because one of them is.',
    },
  ],
  seenIn: [
    { label: 'Write Once, Replay Everywhere — Ch 13', to: '/papers/kafka', live: true },
    { label: 'Sewing It Back Together — Ch 29', to: '/papers/delta', live: true },
    { label: 'A Photograph of a Moving System — Ch 23', to: '/papers/flink-snapshots', live: true },
    { label: 'The Most Common Derived Copy — Ch 12', to: '/papers/memcache', live: true },
  ],
  finale: {
    title: 'You built a database with the lid off',
    body: 'The premise is a refusal: nobody is going to ship the one database, because a full-text search, a scan of one column across a billion rows and a per-request key lookup want different layouts, and each is hard enough on its own. So you will run several systems, and the only real question is what joins them. The answer proposed is the thing a chain of batch jobs already had — a named artefact any number of readers can consume without disturbing each other, that a debugging consumer can attach to, that a crashed reader can resume from — delivered at the latency of a pipe rather than of a nightly job. Operators keep state in an embedded store on local disk so reads never leave the process, and make it durable by appending every write to a compacted log, which turns out to also be the output, which is why there is no separate one. Nothing applies backpressure: the disk is the buffer, a slow consumer is its own problem, and the deadline is retention minus lag. What you get is state machine replication aimed at a company — every derived store reads the same records in the same order, so they agree without consulting each other. What you pay is that reads are stale, crashes reprocess, ordering exists only within a partition, and nothing optimises across the seam. The lid was doing work. This is the argument that you should be able to see the parts anyway.',
  },
  next: { title: 'The Season, in One Page', slug: 'season-2' },
}
