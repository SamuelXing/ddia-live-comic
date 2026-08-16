import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { IncrementalizeDiagram, OutputModeDiagram, FreshnessPriceDiagram } from '../diagrams'
import { structuredStreamingTrace } from './structured-streaming-trace'

/* The act closes on the industrial question rather than an engine question:
   who has to understand incremental processing? Chapter 19 answered "the
   person writing the vertex", which is honest and is why almost nobody could
   use it. This paper's claim is that the user should write the query they'd
   write against a finished table, and the planner should incrementalise it.

   Two things stop this being an API tour. First, the semantics — the result
   table is DEFINED as the query over the prefix received so far, and the
   output mode is a separate decision — which is what makes rollback a text
   editing job. Second, the run-once trigger: customers running a "streaming"
   job once every few hours purely for the bookkeeping, up to 10x cheaper.
   That is the act's ladder turned all the way back to batch, on purpose, and
   it is the right note to end Act I on. */

export const structuredStreaming: Chapter = {
  slug: 'structured-streaming',
  act: 'Act I · Nobody Wants to Wait Until Morning',
  paperNo: 'Paper 20',
  title: 'The Same Query, Twice a Second',
  dek: 'Two chapters of engines, and the hard part turned out to be who has to understand them. The argument here is that you should write the query you would have written for a finished table, and the system should work out the rest.',
  minutes: 17,
  paper: {
    title: 'Structured Streaming: A Declarative API for Real-Time Applications in Apache Spark',
    authors:
      'Michael Armbrust, Tathagata Das, Joseph Torres, Burak Yavuz, Shixiong Zhu, Reynold Xin, Ali Ghodsi, Ion Stoica, Matei Zaharia',
    venue: 'ACM SIGMOD',
    year: '2018',
    url: 'https://dl.acm.org/doi/10.1145/3183713.3190664',
  },
  caption:
    'Here are two facts about the same organisation, from the paper itself. A team of **twenty people took over six months** to build a security platform on the standard tools — a streaming pipeline feeding tables that analysts could query, with alerts running off the same data. A team of **five rebuilt it in two weeks**, and the new one was more capable. Nothing about the hardware changed and nothing about the algorithms changed. What changed was that nobody had to be an expert in incremental processing any more. That is this chapter’s subject, and it is a less glamorous one than the previous two — but the previous two produced engines that could do remarkable things and required you to understand exactly when a partial answer is safe to emit. *Most people cannot do that reliably. The interesting question is whether they should have to.*',
  steps: [
    {
      n: 'Step 01',
      title: 'Four complaints, and only one of them is about streaming',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'The authors had shipped a streaming system already and went and asked people what was wrong with theirs and with everyone else’s. The list is worth reading in order, because only the first item is the one anybody expects.',
        '**The APIs make you write the physical plan.** Some complexity is genuine — you do have to decide what to emit before all the relevant data has arrived. But the rest is imposed: these APIs ask you to specify a windowing mode, a triggering mode and a refinement mode *per aggregation operator*, which is to say they ask you to incrementalise the query by hand. And the failure is silent. Put an operator that expects deltas after one that emits accumulated totals and you get wrong numbers with no error anywhere.',
        '**The streaming job is never the whole application.** It feeds tables that people query interactively, and those updates need to be atomic or analysts see half a result. It joins against static data that somebody else’s batch job produced, and now you have a consistency question spanning two systems. And sooner or later somebody needs to run the same logic over last year to backfill a fix — *in a different system, rewritten, which is a second implementation of your business logic and it will diverge.*',
        '**Operating it is the largest problem and it is barely studied.** Failures, yes, but also: the code is wrong and needs updating without losing position; load grows so the job needs rescaling; a node gets slow rather than dying; and somebody has to be able to see the backlog. **And the fourth complaint is simply money** — these things run 24/7, so an application that is idle at night wastes its cluster at night, and computing a result continuously can genuinely cost more than recomputing it periodically.',
        'Read that list again and notice how little of it is about latency. *Three of the four are about the streaming job’s relationship with everything around it*, which is what happens when a technology stops being a research topic and starts being on call.',
      ],
      diagram: <IncrementalizeDiagram />,
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'Three decisions, and none of them is an algorithm. That is the point of the chapter: at this stage of a technology the remaining hard problems are about who has to understand what.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**What you already have:** a batch engine with a query optimiser and a code generator, and a streaming engine of your own that people find hard to use. You are allowed to change the API and you would rather not build a third engine.',
              '**Who is writing the queries:** analysts and application developers, not the six people in your company who can reason about incremental computation correctly.',
              '**What the job has to live with:** a larger application around it — interactive queries on its output, joins against static tables, and the same logic occasionally run over last year.',
              '**What operators will ask of you:** update the code without losing position, roll back when the output was wrong, rescale with load, survive a slow node as well as a dead one.',
              '**What it costs:** these run around the clock. Some of them are low-volume, and their owners are paying for machines that are idle most of the time.',
            ],
            questions: [
              {
                q: 'Somebody wants a running count of clicks per country. What do they write, and what does the system do with it?',
                options: [
                  {
                    label: 'They write the query they would write against a finished table, and the planner turns it into an incremental one',
                    verdict: 'move',
                    why: 'And the load-bearing part is the *semantics* you can then state, which fit in a sentence: **the result is defined as the query applied to the prefix of the input received so far.** Not "the query applied to a window", not "whatever the operators have emitted" — a definition that mentions no operators at all. Three things follow that are hard to get any other way. The reader can predict the output from a batch query they already understand. Rows in the result always reflect the same prefix, so two consumers never see mutually inconsistent halves. And *a point in the input has a meaning*, which is the entire foundation of the rollback story later in this chapter. **The incrementalisation is a compiler problem, and compiler problems are the ones you get to solve once.**',
                  },
                  {
                    label: 'They build a graph of physical operators, annotating each aggregation with when it fires and whether it emits deltas or totals',
                    verdict: 'dead',
                    why: 'This is the powerful, widely-adopted answer, and its problem is not that it is wrong — it is that it makes every user of the system an expert in incremental processing whether or not their query needed one. The composition failure is the sharp end: an operator expecting deltas placed after one emitting accumulated results gives unexpected output, and **nothing on either side of that seam can detect it**. Compare it to the alternative honestly, though. This is strictly more expressive, and if you need a shape the incrementaliser does not support you will want it — which is why the answer above also ships escape-hatch operators that let you write custom stateful logic *inside* the same semantics.',
                  },
                  {
                    label: 'Give them a streaming SQL dialect — familiar syntax, streaming keywords, a separate engine underneath',
                    verdict: 'dead',
                    why: 'It fixes the surface and leaves the second complaint entirely alone. The moment somebody needs to backfill a year, or join against a table a batch job produced, or test the logic offline, they are writing it a second time in a different dialect against a different engine — **and now the streaming answer and the batch answer are two implementations of one intent, which will diverge.** The failure is not that the syntax differs. It is that a query and its own backfill are no longer the same object, so nothing can guarantee they compute the same thing.',
                  },
                  {
                    label: 'Keep the operator API but relax exactly-once, and document the delivery semantics clearly',
                    verdict: 'dead',
                    why: 'Well-documented at-least-once still means the application has to make every downstream effect idempotent, deduplicate by hand, and reason about what a retry does to an aggregate. That is not a documented semantic; that is *the user designing and implementing a consistency model*, per application, in business-logic code, with no tests that could tell them they got it wrong. The paper’s framing is the right one: complexity does not vanish when you refuse to handle it, **it relocates to somebody less equipped to handle it.**',
                  },
                ],
              },
              {
                q: 'A field stopped parsing on Tuesday and has been written as NULL ever since. Nothing crashed. How does an operator fix this?',
                options: [
                  {
                    label: 'Keep a log of which input each epoch consumed, in a format a person can read, and let them restart from the epoch where it started',
                    verdict: 'move',
                    why: 'This is the answer that the semantics in the previous question paid for. Because an epoch is recorded as *a range of offsets in each source* — a prefix of the input, named durably before any work happens — a position in the log is a position in the data, exactly. So an administrator can find Tuesday, delete the output written from there, fix the function and restart, and what recomputes is precisely the records that produced the bad rows. They chose **JSON on purpose** so this can be done by hand at three in the morning. It has one dependency on the outside world, and it is a real one: the message bus must still be holding Tuesday. *Typical retention of a few weeks is what makes this a procedure rather than a wish.*',
                  },
                  {
                    label: 'Reprocess everything from the beginning of the stream into a fresh output',
                    verdict: 'dead',
                    why: 'It is correct and it is a rebuild rather than a repair — hours or days of compute for a three-day mistake, and it grows every month. But the disqualifying part is subtler. Without a record of which input produced which output, you cannot tell which of the *existing* rows were poisoned, so you cannot delete only those; you have to replace everything and cut over. **The expensive thing is not the recomputation, it is not knowing where the damage stops.**',
                  },
                  {
                    label: 'Run a nightly batch job over the same data that recomputes the truth and corrects the stream’s output',
                    verdict: 'dead',
                    why: 'This is the Lambda architecture, it was standard practice for years, and it is two implementations of one piece of business logic maintained by people under different deadlines. Chapter 13 already established what happens to derived copies that are supposed to agree and are computed by different code: they drift, and the drift is discovered by a customer. It also does not fix this bug — the parse function is wrong in the batch version too, because somebody copied it across.',
                  },
                  {
                    label: 'Snapshot the operator state often, so you can restore the system to how it was on Monday',
                    verdict: 'dead',
                    why: 'You are storing the wrong half. A state snapshot tells you what the operators believed at some moment; it does not tell you **which input records produced it**, and that is the thing you need in order to know what to replay and what to delete. Notice that this design keeps a state store too — but the state store is an optimisation to avoid replaying from the start, and the log is what makes recovery meaningful. *Get those two backwards and you can restore a system to a state you cannot explain.*',
                  },
                ],
              },
              {
                q: 'Some users want a two-second answer and cheap recovery; others want ten milliseconds. What does the API commit to?',
                options: [
                  {
                    label: 'Nothing — say nothing about execution, so the same query can run as microbatches or as long-lived operators',
                    verdict: 'move',
                    why: 'The best decision in the design is one that was *not* made, and the authors know it because they had made it before: their earlier streaming API had operators defined in terms of processing time, which leaked microbatching into the programming model and meant a program could not be moved to a different kind of engine. Here the semantics are about prefixes of input, which is true of any execution strategy — so continuous execution is just a much larger number of triggers, and **nobody rewrites anything to move between them.** It is also what makes the last rung possible: trigger *once*, and the streaming job is a batch job, with the same log and the same guarantees.',
                  },
                  {
                    label: 'Commit to microbatching — it gives you per-task recovery, backup tasks for stragglers, and rescaling for free',
                    verdict: 'dead',
                    why: 'All of those benefits are real and this is the default execution mode for exactly that reason: work divided into small independent tasks can be rebalanced, rerun individually, duplicated when slow, and scheduled onto a machine that appeared a minute ago. What makes it wrong as an *API commitment* is the floor. Launching a graph of tasks costs something, so the minimum latency is a few hundred milliseconds however small the batch — fine for most work, disqualifying for the case where a transformation sits between two other streaming jobs and adds its latency to all of them.',
                  },
                  {
                    label: 'Commit to long-lived continuous operators — lower latency, and it is what real streaming systems do',
                    verdict: 'dead',
                    why: 'You would buy the latency with everything the batch scheduler was giving you: a dead node now means restarting a long-running task rather than rerunning a small one, slow nodes have no backup copies, load cannot be rebalanced between operators that own fixed partitions, and rescaling means reconfiguring a topology. The paper ships this mode and is straight about the cost — in its first release it handled only map-like work with no shuffles, and it recovers from node failure while offering **no protection against stragglers or load imbalance at all.**',
                  },
                  {
                    label: 'Offer both, as two APIs, and let people choose the one that fits',
                    verdict: 'dead',
                    why: 'And you have recreated the second complaint inside your own product. The moment the low-latency job and the backfill are written against different APIs, they are two programs, and the guarantee that they compute the same thing is a code review rather than a property. **The whole value of not committing is that there is one program.** Two APIs is committing twice.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived Structured Streaming — and, more usefully, what the last two chapters left undone',
              body: [
                '**The model, stated plainly.** Input sources give a partially ordered set of records. The user writes a query as if over a table. The system guarantees output consistent with running that query over *a prefix of the input in every source*, and those prefixes only grow — the paper calls this **prefix consistency**. Triggers say when to compute; the output mode says how to write the result down. The result table itself is defined without reference to either, which is exactly why the two can vary independently and why the same query can run as a batch job.',
                '**What that buys, in the paper’s own numbers.** On the standard streaming benchmark it reaches **65 million records a second** on a five-machine cluster — about **twice** Apache Flink and **ninety times** Kafka Streams — and none of that comes from streaming cleverness. It comes from the query being a relational plan, so the batch engine’s optimiser, compact binary representation and runtime code generation apply to it unchanged. *That is the second dividend of writing a query instead of an operator graph, and nobody expects it: declarative was faster.*',
                '**And the rung nobody predicted.** Customers started running streaming jobs with a **run-once trigger** — one epoch every few hours, then exit — because what they wanted was the offset tracking and the exactly-once commit, not the servers. It saved **up to ten times** the cost for low-volume work. Read that as the closing argument of this act: freshness is a dial with money on it, batch is one setting of that dial rather than a different technology, and *the useful thing to build is not a fast system but one where moving the dial costs nothing.*',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'One epoch, and the two failures that matter',
      accent: 'denim',
      rung: 'Rung 3 · The reveal',
      span: 2,
      body: [
        'Watch step 1 carefully, because everything else in the trace is a consequence of it: before any work happens, the range of input this epoch will consume is written down durably.',
        'Steps 5 and 6 are the pair worth comparing — a machine dying, which every paper covers, and a query that was quietly wrong for three days, which almost none of them do.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={structuredStreamingTrace} />
        </div>
      ),
      think: {
        q: 'This gives up the loop that Chapter 19 spent its whole design making possible. Is that a step backwards?',
        a: '**For iterative computation, yes, and the paper does not pretend otherwise.** Nothing here will maintain connected components over a graph that keeps changing; that needs feedback in the dataflow and a timestamp that can say which round you are on, and this system has neither. If your problem is iterative, the previous chapter is still the better answer, which is why the model from it is still alive and shows up again in Act III. *But notice what was traded and for what.* Dropping the loop means the dataflow is acyclic, and acyclic means each epoch is an ordinary directed graph of independent tasks — which is what makes a dead machine cost one task instead of the whole cluster, lets a slow task be duplicated, lets a new machine be used by the next epoch without any reconfiguration, and lets the whole thing run on a batch engine that already had an optimiser and a code generator. Every operational property in this chapter comes out of that one restriction. And there is a second thing being traded that is easier to miss: **the previous chapter puts the incremental reasoning in the programmer, and this one puts it in the planner.** Those are not the same kind of decision. The first can be right for the small number of people able to do it and unusable for everyone else; the second is a ceiling on what can be expressed and a floor under what can be got wrong. This act contains both answers on purpose. The honest summary is that they are aimed at different people, and the number of people in the second group is much larger — which is why one of these systems is in every cloud and the other is a paper you should still read.',
      },
    },
    {
      n: 'Step 04',
      title: 'What it costs, in records and in dollars',
      rung: 'Rung 4 · The measurement',
      body: [
        'Start with the one that surprises people. On the Yahoo! streaming benchmark — read ad clicks, join against a campaign table, count by campaign over ten-second event-time windows — with five machines and forty cores: **Kafka Streams 700,000 records a second, Apache Flink 33 million, this 65 million.** Roughly **2×** Flink and **90×** Kafka Streams. Scaling is close to linear: **11.5 million** records a second on one machine, **225 million** on twenty.',
        'The query in that benchmark is written entirely in the dataframe API with no user code in it, and that is the whole explanation. Because the query is a relational plan rather than a graph of operators, the batch engine’s optimiser rewrites it, its compact binary representation avoids materialising objects, and its code generator emits the inner loop. **None of the performance came from streaming work.** Systems built on per-record operator calls cannot reach for any of that, and this is the second dividend of the decision in step 2 — declarative was chosen for usability and it was also faster.',
        'Then the number that closes the act. Customers ran their streaming jobs with a **run-once trigger**: process one epoch, commit, exit, come back in a few hours. They did it because what they actually wanted from a streaming engine was the position tracking and the exactly-once commit — *virtually every ETL job needs to know how far it has got and what has been saved reliably*, and that is genuinely hard to write by hand. Running the servers around the clock was not part of what they wanted, and skipping it saved **up to ten times** the cost.',
        'And the low-latency end, for completeness: continuous processing mode reaches **under 10 ms** at about half of microbatching’s maximum throughput. So the whole ladder is one API. Hours, for a tenth of the money. Seconds, with a batch engine’s recovery. Ten milliseconds, with most of that recovery given up. *Nobody rewrites anything to move between them, and that is a more useful property than any single point on the curve.*',
      ],
      code: {
        file: 'the_whole_query.py',
        lines: [
          { t: '# the streaming version' },
          { t: 'spark.readStream.format("kafka").load()' },
          { t: '  .where("action = \'click\'")' },
          { t: '  .groupBy("country")' },
          { t: '  .count()' },
          { t: '  .writeStream.trigger("1 second").start()', hl: 'good' },
          { t: '' },
          { t: '# the backfill over last year, same logic, same file' },
          { t: 'spark.read.parquet("s3://logs/2025")' },
          { t: '  .where("action = \'click\'")' },
          { t: '  .groupBy("country")' },
          { t: '  .count()' },
          { t: '' },
          { t: '# and the one that costs a tenth as much' },
          { t: '  .writeStream.trigger(once=True).start()', hl: 'good' },
        ],
      },
      diagram: <OutputModeDiagram />,
      deeper: {
        summary: 'The combination the system refuses, and why the refusal is the feature',
        body: [
          'Ask for a running count grouped by country and write it to an append-only sink, and the query is rejected before it starts. The reason is exact: **the system can never know it has stopped receiving records for a given country**, so the count for any country may change at any point in the future — and append mode promises rows are never revised. The two cannot both be true, so one of them is refused.',
          'It is worth sitting with how many systems would instead have run it. The counts would have been appended as they were computed, the sink would accumulate several rows per country with different values, and downstream somebody would eventually work out that you have to take the last one — a convention, held in a person’s head, load-bearing and undocumented.',
          'The refusal is only possible because of the decision in step 2. The result table is defined by the query alone, so the planner can reason about whether a row could ever change, independently of how the table is being written down. In a design where the user annotates each operator with its output mode, there is nothing to compare against: **the user has already told the system what to do, and the system has no separate notion of what is true.** *A system that can tell you no is one that knew what you meant.*',
        ],
      },
    },
    {
      n: 'Step 05',
      title: 'Design for the operator, not the benchmark',
      rung: 'Rung 5 · The design stance',
      body: [
        'The stance is stated once and then applied everywhere: aim for semantics and a fault-tolerance model that are **easy to understand**, so that operators can form an accurate mental model of what the system is doing and what any given action will do to it. That sounds like a platitude until you notice which features it produced, because none of them are features anybody requests in an evaluation.',
        '**Code updates as an ordinary event.** A user-defined function crashes on a record, so that epoch fails; fix the function, restart, and it continues from where it stopped, because position lives in the log rather than in the process. Stateful functions can be updated too, as long as the state keeps its shape, and the log and state formats are kept binary-compatible across framework upgrades — so patching the engine is not a migration either.',
        '**Rollback as a text-editing job**, which is step 2’s second question and the clearest example of the stance. The log is JSON because a human will read it in an incident. And it interacts with the rest of the design in a way that is worth noticing: because the same code runs as a batch job and because the system rescales, an administrator can catch up on a temporarily larger cluster and then shrink it. *The recovery procedure gets to use the elasticity that the streaming job usually does not need.*',
        '**Adaptive batching**, which is a strange thing to find in a latency section. When a job falls behind — a link between datacentres went down, or a cluster was offline for an upgrade — the engine automatically runs *longer* epochs to catch up, approaching batch throughput, and returns to short ones once it is level. Latency was already lost; spending more of it to recover faster is the correct trade, and it is the difference between an upgrade being routine and an upgrade being an outage. **The insight is that a system which cannot be safely restarted will not be safely upgraded, and then it will not be patched.**',
      ],
      diagram: <FreshnessPriceDiagram />,
    },
    {
      n: 'Step 06',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 6 · What the ceiling costs',
      body: [
        '**Microbatching has a floor and it is not negotiable.** Launching a graph of tasks costs something, so epochs are a few hundred milliseconds to a few seconds. The paper argues, fairly, that this is on the same timescale as most data collection and alerting — and then ships a second execution mode, which tells you how often the argument lost. Continuous mode in its first release handled only map-like work with **no shuffles**, so nothing that aggregates or joins across partitions could use it.',
        '**And continuous mode gives up most of what made microbatching operationally pleasant.** It recovers from node failures by relaunching a long-running task, and it offers **no protection against stragglers or load imbalance**. Rescaling at runtime is limited. Everything you liked about small independent tasks was coming from the small independent tasks.',
        '**The requirements are pushed outward, and they are strong ones.** Sources must be replayable by offset; sinks must be idempotent so a rewrite after failure is harmless. Kafka and Kinesis were built for the first. The second is the one that bites in practice, because a great many real sinks — a REST API, a system that emails somebody, a warehouse without transactional loads — cannot offer it, and then none of the guarantees in this chapter hold end to end. The paper notes that S3 provides no way to atomically commit writes from several nodes and that they built a transactional layer over it, *which is a large amount of engineering to make one sink meet the requirement.*',
        '**Expressiveness is genuinely capped, and it is capped by design.** If a computation does not fit what the incrementaliser supports, you get the escape hatch — custom stateful operators — and that is deliberately less powerful than writing your own vertex. This chapter’s whole trade is a ceiling on what can be expressed in exchange for a floor under what can be got wrong. **A loop is above the ceiling.** The previous chapter’s iterative graph computation cannot be written here at all.',
        '**And the cost question does not have a happy answer.** The paper says it plainly: even with rescaling, it may be more expensive to compute a result continuously than to run a periodic batch job. Throughput was chosen as the metric to optimise, not latency, and the reasoning is worth carrying — data from phones and sensors has usually already spent time in transit, so *milliseconds at the engine are often being spent to shave a delay you did not control anyway.*',
      ],
      callout: {
        kind: 'bad',
        big: 'THE SINK MUST BE IDEMPOTENT',
        text: 'Everything in this chapter assumes a failed epoch can be rewritten harmlessly. Where the sink is a REST call, an email, or a warehouse without transactional loads, exactly-once is a property of the paper and not of your pipeline — and nothing will tell you.',
      },
    },
    {
      n: 'Step 07',
      title: 'Where it stands in 2026 — and what Act I settled',
      rung: 'Rung 7 · The end of the act',
      body: [
        '**The API won, comprehensively.** Structured Streaming is how streaming is written in Spark, the earlier API is gone, and the argument it was making — *write the query, let the planner incrementalise it* — is now the default position rather than the contested one. Flink’s Table API and its SQL layer are the same claim from the other side of the fight, and the streaming SQL that appears in every warehouse product is downstream of it. **Nobody serious ships an operator-graph API as the primary interface any more.**',
        '**The run-once trigger turned out to be the most quietly influential thing in the paper.** A streaming engine used as a bookkeeper for a batch job — offsets, exactly-once commits, no servers between runs — is now an entire product category. The whole modern habit of *incremental batch*, where a job runs every fifteen minutes and knows precisely what it has and has not consumed, is this idea with a scheduler bolted on.',
        '**What this act has settled.** Three chapters ago the middle of a computation had to go through a replicated file system between every stage. Now it can stay in memory and survive a dead machine; the input no longer has to hold still while you work on it; and the query can be written by somebody who has never thought about incremental computation. The delay came down from hours to seconds, and each rung was bought with something specific — a restriction on writes, a global checkpoint, a ceiling on what you can express.',
        '**And here is the assumption that all three chapters have been quietly making.** Every one of them treats the order records arrive in as the order things happened in. It is a completely reasonable assumption when the input is a file you already have, and it survived the move to a stream because the streams in this act came out of a message bus in a datacentre. Now put the source in someone’s pocket. A purchase happens at 09:14 on a phone in a tunnel, and reaches you at 13:40 — long after you computed the morning’s total, published it, and told everyone it was final. *Nothing in this act has a way to be right about that*, and the next one is about what it costs to be.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Prefix consistency.',
      body: 'The guarantee that output always matches the query run over some prefix of every input source, and that those prefixes only grow. The definition mentions no operators, which is what makes it something a user can reason with.',
    },
    {
      term: 'Epoch.',
      body: 'A range of offsets in each source, written to the log before any work runs. The unit of commit, of recovery and of rollback.',
    },
    {
      term: 'Trigger.',
      body: 'When to compute the next epoch. Every second, continuously, or exactly once — the last of which turns the streaming job into a batch job with no change to the query.',
    },
    {
      term: 'Output mode.',
      body: 'How the result table reaches the sink: the whole table, only new rows, or only the keys that changed. Chosen separately from what the result table means.',
    },
    {
      term: 'Watermark.',
      body: 'A user-set threshold saying how late data may be, expressed as a delay behind the largest event time seen. It bounds how much state must be kept and when append-mode output may be written — and Act II is about how you choose that number.',
    },
    {
      term: 'State store.',
      body: 'Where operators checkpoint running aggregates, asynchronously and with an epoch number attached. An optimisation to avoid replaying from the start; the log is what makes recovery meaningful.',
    },
  ],
  inTheWild: {
    note: '5 ways this bites in production',
    points: [
      '**The sink is where exactly-once quietly stops being true.** The engine holds up its end and then writes to something that cannot be rewritten harmlessly — a REST endpoint, a notification, a load into a warehouse with no transaction. Nothing warns you, and the duplicates appear only after a failure, which is the worst moment to discover an assumption.',
      '**Somebody sets a generous watermark to avoid dropping late data, and the state grows without limit.** The threshold is what lets old windows be forgotten. Raise it to be safe and you have committed to remembering more, per key, forever — and the job dies of memory weeks later, in a way that looks nothing like a windowing bug.',
      '**A rejected query reads as a missing feature.** Append mode with a grouped aggregate is refused, correctly, and the developer’s first reaction is that the system cannot do something obvious. The refusal is the planner telling you the combination has no meaning; the useful response is to change the output mode, and the common response is to work around it.',
      '**Rollback depends on retention you do not own.** The procedure works because Kafka is still holding Tuesday. Somebody tunes retention down for cost, and the recovery story silently shortens with it — discovered during the incident it was meant to handle.',
      '**Continuous mode gets chosen for the latency number and not for what it gives up.** No shuffles, no straggler mitigation, limited rescaling. Teams reach for it because ten milliseconds sounds better than two seconds, on a pipeline whose data spent four seconds getting to the datacentre.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'A declarative interface over a physical one',
        when: 'the transformation from what-you-mean to how-it-runs is hard and error-prone, and the errors are silent. You are buying a ceiling on expressiveness and selling a floor under mistakes — and you often get the optimiser for free, which is the part nobody predicts.',
      },
      {
        choose: 'Define the answer without reference to how it is written down',
        when: 'you want the system to be able to refuse an impossible combination. If the user’s specification *is* the plan, there is nothing left to check it against, and every bad combination becomes a runtime surprise.',
      },
      {
        choose: 'Log what you consumed, not what you believed',
        when: 'you will one day need to undo. State snapshots restore a belief you cannot explain; a record of which input produced which output tells you where the damage starts and stops. Keep it in a format a person can read at 3am, because that is when it is read.',
      },
      {
        choose: 'Leave the execution strategy out of the API',
        when: 'different users of the same logic want different latencies. The value is not any single point on the curve — it is that moving along it, including all the way to a batch job, requires no rewrite and therefore cannot introduce a difference in behaviour.',
      },
    ],
  },
  misconception: {
    think: '“Microbatching is a compromise — real streaming systems process one record at a time.”',
    actually:
      'It is a compromise, and the interesting part is which way the trade points, because it is not the way the slogan implies. Processing an epoch as a graph of small independent tasks is what buys **per-task failure recovery** rather than rolling the whole topology back, **backup copies of slow tasks**, **rebalancing across nodes**, and **rescaling** that requires no reconfiguration — every one of which the long-lived-operator design gives up, and the paper says so about its own continuous mode, which protects against node failure and offers nothing against stragglers or load imbalance. Then there is throughput, where the folk belief is exactly backwards: on the standard benchmark this reaches around **65 million records a second** against Flink’s 33 million, because the query is a relational plan and inherits an optimiser, a compact binary format and a code generator that per-record operator systems cannot use. **What microbatching genuinely costs is the latency floor** — a few hundred milliseconds to launch the tasks — and if you need ten milliseconds it is the wrong tool, which is why the continuous mode exists. *The right question is never which one is real streaming. It is whether your latency requirement is below the floor, and how much operational machinery you are prepared to give up to get under it.*',
  },
  sources: [
    {
      year: '2018',
      title:
        'Structured Streaming: A Declarative API for Real-Time Applications in Apache Spark — Armbrust et al. (ACM SIGMOD)',
      url: 'https://dl.acm.org/doi/10.1145/3183713.3190664',
      note: 'Read **§2** first and read it as a field report rather than a motivation section — four complaints gathered from users of five different systems, and only one of them is about the API. **§4.2** is the semantics in one page and is the whole paper. Then **§7** and **§8.1**, which are the parts almost no streaming paper contains: how you update code, how you roll back, and what happened when twenty people over six months were replaced by five over two weeks.',
    },
    {
      year: '2015',
      title:
        'The Dataflow Model: A Practical Approach to Balancing Correctness, Latency, and Cost in Massive-Scale, Unbounded, Out-of-Order Data Processing — Akidau et al. (VLDB)',
      url: 'https://research.google/pubs/pub43864/',
      note: 'The system this chapter argues with, and Chapter 22 — read it next, because the disagreement is narrow and both sides are right. Dataflow’s windowing, triggering and refinement model is more expressive and asks every user to understand incremental processing; this paper takes the expressiveness down and the accessibility up. Neither is a refutation of the other.',
    },
    {
      year: '2013',
      title: 'Discretized Streams: Fault-Tolerant Streaming Computation at Scale — Zaharia et al. (SOSP)',
      url: 'https://dl.acm.org/doi/10.1145/2517349.2522737',
      note: 'The earlier system by mostly the same people, and the one whose mistakes §2 is politely describing. Worth reading for the microbatch execution model itself, which survives underneath Structured Streaming — and for the API that leaked processing time into the programming model, which is precisely the thing the later design refuses to do.',
    },
    {
      year: '2015',
      title: 'Apache Flink: Stream and Batch Processing in a Single Engine — Carbone et al. (IEEE Data Eng. Bull.)',
      url: 'https://asterios.katsifodimos.com/assets/publications/flink-deb.pdf',
      note: 'The other half of the industry, and the fair comparison to make. Flink came at unification from the streaming side rather than the batch side, and its snapshotting is genuinely more elegant than stopping the world — which is Chapter 23. Read this and the chapter above together and the benchmark numbers stop being the interesting part.',
    },
    {
      year: '2015',
      title: 'Questioning the Lambda Architecture — Jay Kreps',
      url: 'https://www.oreilly.com/radar/questioning-the-lambda-architecture/',
      note: 'Not a paper, and the clearest statement of the problem this chapter’s API solves. The argument is that maintaining a batch implementation and a streaming implementation of the same logic is the actual cost, not the infrastructure — and that the fix is to make replaying history and processing live data the same code path. Written three years before this system shipped it.',
    },
  ],
  seenIn: [
    { label: 'One Engine, Both Shapes — Ch 19', to: '/papers/naiad', live: true },
    { label: 'The Cost of Starting Over — Ch 18', to: '/papers/spark', live: true },
    { label: 'Write Once, Replay Everywhere — Ch 13', to: '/papers/kafka', live: true },
    { label: 'Stream–table duality — the comic', to: '/ddia/read/stream-table', live: true },
  ],
  finale: {
    title: 'The dial, and the assumption underneath it',
    body: 'Act I set out to get from hours to seconds and it did, in three moves with three prices: keep the middle in memory and give up writing to a location; keep the state hot and give up partial recovery; keep the query declarative and give up the loop. What this last chapter adds is the thing that makes the whole ladder usable — one program, one log, one set of guarantees, and a trigger that moves you from ten milliseconds to once a quarter of a day without a rewrite. It is worth noticing that the cheapest rung and the freshest rung are the same code. What none of these chapters has questioned is that the order records arrive in is the order things happened in. That has been true because the inputs were files, or a message bus in a datacentre. It stops being true the moment the source is a phone, and the next act is about the gap between when something happened and when you heard about it.',
  },
  next: { title: 'One Record at a Time, Forever', slug: 'millwheel' },
}
