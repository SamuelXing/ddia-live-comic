import type { Chapter } from '../types'
import TimelinePlayer from '../../components/TimelinePlayer'
import DesignIt from '../DesignIt'
import { WatermarkDefinitionDiagram, ExactlyOnceLedgerDiagram, GuaranteePriceDiagram } from '../diagrams'
import { millwheelTimeline } from './millwheel-timeline'

/* Act II opens by naming the assumption Act I never questioned: that the order
   records arrive in is the order things happened in. Everything in this act
   follows from dropping it.

   The trap is treating this as "MillWheel invented watermarks", which is both
   contestable and boring. The chapter is really about two things the paper
   does that no earlier system in this book does. First, it defines
   completeness as a computed property of the pipeline — the oldest unfinished
   work anywhere behind you — rather than a clock reading or a timeout. Second,
   it is honest that the property is a bound and the bound is sometimes wrong,
   and it puts a number on how often: about 0.001% of records arrive behind it,
   and Zeitgeist drops them and counts the drops. That number is the act's
   thesis stated as an operational fact rather than a philosophy. */

export const millwheel: Chapter = {
  slug: 'millwheel',
  act: 'Act II · Time Is Not When It Arrived',
  paperNo: 'Paper 21',
  title: 'One Record at a Time, Forever',
  dek: 'A search happened at 09:14 and reached you at 13:40. Every engine so far treated the order records arrive in as the order things happened in — and here is the system that stopped, and worked out what it costs to know when you have everything.',
  minutes: 18,
  paper: {
    title: 'MillWheel: Fault-Tolerant Stream Processing at Internet Scale',
    authors:
      'Tyler Akidau, Alex Balikov, Kaya Bekiroğlu, Slava Chernyak, Josh Haberman, Reuven Lax, Sam McVeety, Daniel Mills, Paul Nordstrom, Sam Whittle',
    venue: 'VLDB',
    year: '2013',
    url: 'https://research.google.com/pubs/archive/41378.pdf',
  },
  caption:
    'Act I got the delay from hours down to seconds, and every rung of it rested on an assumption nobody said out loud: **that the order records arrive in is the order things happened in.** It was a fair assumption. The input was a file you already had, or a message bus in the same datacentre. Now move the source into somebody’s pocket. A search is typed on a phone that goes into a tunnel; it happened at 10:59:04 and it reaches you at 10:59:14, ten seconds after you published the count for that second and told everyone it was final. *Nothing in the last three chapters can be right about that,* and the useful question is not how to make the delay go away — you do not own the tunnel — but how a system can ever know that it has seen everything. This is the paper that made that a computed quantity instead of a hopeful timeout.',
  steps: [
    {
      n: 'Step 01',
      title: 'No record ever says “I am the last one”',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'Take the example the paper opens with, because it is small enough to hold and hard enough to matter. **Zeitgeist** watches Google searches and reports which terms are *spiking* or *dipping* right now. Count searches per second per term, compare each second against what a model predicted, and shout when the two disagree.',
        'The spike half is easy and the reason is worth noticing: if the observed traffic already exceeds the prediction, **late data can only make the spike bigger**. You can report it immediately and no future record will make you wrong. *A dip is the opposite.* Traffic looks low for the 10:59:04 bucket — but that is exactly what a bucket looks like when the records are merely slow, so reporting a dip early means reporting an outage that is not happening. To be right about a dip you have to know you have everything.',
        'And nothing in the data tells you. Records arrive out of order for reasons that are nobody’s fault — different routes, different retries, a phone with no signal for four minutes — and **no record is marked as the last one for its second**. There is no end-of-file in a stream. The obvious fix, waiting a fixed time, is not a mechanism but a guess, and the guess has to be wrong in one of two directions: too short and you publish incomplete counts, too long and you have added that delay to every answer you ever give, to protect against something that usually does not happen.',
        'So the constraint is this. **Completeness is a real property of the pipeline and nothing in the record stream exposes it.** Either the system computes it, or every user of the system invents a timeout and gets it wrong privately.',
      ],
      diagram: <WatermarkDefinitionDiagram />,
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'Three decisions. The first is the one the act is named for; the second is what happens when the first one is wrong, which it will be; the third is the price of never processing a record twice.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**The application:** count searches per second per term, and report when a term’s traffic drops well below what a model predicted. A dip is only meaningful once you have all the data for that second.',
              '**What arrives:** (key, value, timestamp) triples, where the timestamp is when the search happened and is chosen by the person sending it. Records arrive out of order, continuously, forever.',
              '**Where they come from:** injectors reading external systems you do not control. How much work is still pending out there is an *estimate*, not a fact.',
              '**What users write:** arbitrary code, which will not be idempotent, and which they should not have to make idempotent.',
              '**What you must not do:** stop. There is no final record, no end of input, and no moment at which the pipeline gets to start over.',
            ],
            questions: [
              {
                q: 'You need to know when a one-second bucket is complete. Nothing in the stream says so. Where does the answer come from?',
                options: [
                  {
                    label: 'Compute it: the oldest unfinished work anywhere behind you, taken together with the same number from everything upstream',
                    verdict: 'move',
                    why: 'This is the **low watermark**, and the two things that make it work are both in that sentence. It is computed from *pending work* — records in flight, records stored, records waiting to be delivered, timers not yet fired — so it is a fact about the pipeline rather than a reading off a clock. And it is **recursive**: a stage takes the minimum of its own oldest work and the watermarks of everything that feeds it, which is what lets a bound at the front of a pipeline mean something at the back of it. What you get is a claim with a shape: *nothing older than this is still coming.* One more property is not optional but essential — **it only ever moves forward.** A watermark that could retreat would be useless, because everything downstream has already acted on it.',
                  },
                  {
                    label: 'Wait a fixed slack after each bucket closes — say thirty seconds — then publish',
                    verdict: 'dead',
                    why: 'Not a mechanism, a guess, and one that is wrong in both directions at once. Too short and you publish counts that later records contradict. Too long and **you have added that delay to every answer forever**, including the overwhelming majority of buckets where nothing was late at all. And it does not compose: a three-stage pipeline needs the guess made three times, each stage padding for the one before, so the slack multiplies down the graph while nobody can say what the total is. *The reason this option is worth taking seriously is that almost every system built before this one did exactly this, and most of them never wrote the number down.*',
                  },
                  {
                    label: 'Track it per key — each search term knows when its own second is complete',
                    verdict: 'dead',
                    why: 'Tempting, because everything else in this design is per key: state is per key, code runs per key, processing is serialised per key. But completeness is precisely the thing that is *not* per key, because the reason a record is late has nothing to do with its key — it is a tunnel, a retry, a slow shard. A term with no traffic for ten minutes would have a watermark racing ahead of reality, and a term whose records all took the slow path would hold nothing back for anybody else. **The bound has to cover all the work, because any of it might turn out to be yours.**',
                  },
                  {
                    label: 'Use the largest event timestamp you have seen so far — that is how far the data has got',
                    verdict: 'dead',
                    why: 'This is the useful wrong answer, because it is genuinely close and the gap is the whole idea. The largest timestamp *seen* tells you about the records that have already arrived; it says nothing about the ones still in flight, which are exactly the population you are trying to reason about. A single fast record from far in the future would slam the bound forward and orphan everything behind it. **The quantity you need is a minimum over what is unfinished, not a maximum over what is done** — and later systems do use a max-based heuristic, deliberately, with a delay subtracted from it and their eyes open.',
                  },
                ],
              },
              {
                q: 'The watermark said nothing older than 10:59:06 was still coming, and a record from 10:59:04 has just landed. What do you do?',
                options: [
                  {
                    label: 'Accept that this will happen, pick a policy per pipeline, and put a number on how often it does',
                    verdict: 'move',
                    why: 'The bound is seeded by injectors measuring pending work in systems they do not own, so it is an estimate and a small rate of late records is *expected*, not exceptional. What the paper does that matters is refuse to hide it. Zeitgeist **drops late records and keeps a count of what it dropped** — empirically about **0.001%** — and other pipelines instead go back and correct an aggregate they already published. Those are different answers to a question about obligation, not about mechanics: *what do you owe somebody you have already given a number to?* Naming it as a policy makes it somebody’s decision. Leaving it undefined makes it an incident.',
                  },
                  {
                    label: 'Move the watermark back to 10:59:04 so the bound is honest again',
                    verdict: 'dead',
                    why: 'The one thing you may never do, and it is worth being precise about why. Downstream stages have already *acted* on the old value — timers fired, buckets published, resources released. A watermark is not a measurement you are refining, it is **a promise other components have already spent.** Withdrawing it does not restore correctness; it creates a system where no stage can ever safely act on the bound, which is the same as not having one. Monotonicity is what makes the number usable, and this design guarantees it even in the face of late data.',
                  },
                  {
                    label: 'Hold every bucket open indefinitely, so a late record can always be folded in',
                    verdict: 'dead',
                    why: 'Correct, and you have quietly deleted the product. Nothing is ever published, so the dip detector never reports a dip; and the state grows without bound, because every one-second bucket that has ever existed must be kept for a record that will probably never come. The real question was never whether to close a window — it is *when*, and what happens after. **You cannot buy your way out of this with memory.**',
                  },
                  {
                    label: 'Let the record through and update the count, but do not tell anyone downstream it changed',
                    verdict: 'dead',
                    why: 'The worst option here, and the most commonly shipped, because it looks like the cautious one. Now two components hold different numbers for the same second and neither of them is flagged: the dashboard that read the first answer disagrees with the store that took the correction, and there is no event anywhere marking the disagreement. **A silently amended answer is worse than a wrong one**, because a wrong one can be found.',
                  },
                ],
              },
              {
                q: 'Users write arbitrary, non-idempotent code, and delivery must be retried. How do you stop a retry from double-counting?',
                options: [
                  {
                    label: 'Give every record a unique id and commit that id in the same atomic write as the state it changed',
                    verdict: 'move',
                    why: 'One write, holding two facts that must never disagree: *the count is now 7* and *record #4813 is the reason.* Because they commit together, there is no window in which a machine can die having applied one and not the other, and a retry of #4813 is recognised and discarded. Two things make it affordable. A **Bloom filter** of seen fingerprints answers "provably never seen this" without touching the store, so the common path stays cheap. And the ids are garbage collected once every internal sender has finished retrying — within minutes, except for injectors that deliver late data, where collection is delayed by a slack of a few hours. **The guarantee is a ledger entry, not a protocol**, and that is why arbitrary user code can sit inside it.',
                  },
                  {
                    label: 'Require users to write idempotent computations, and document it clearly',
                    verdict: 'dead',
                    why: 'You have moved a hard distributed-systems problem into every application, where it will be solved separately, incorrectly, and invisibly. *And notice which applications need it most:* a billing pipeline is exactly the code that cannot tolerate double-counting and exactly the code whose author has the least appetite for writing a deduplication scheme. The design goal here is explicitly to take non-idempotent user code and run it as if it were idempotent, and every system that has instead asked its users for idempotence has ended up with a fleet of half-right implementations.',
                  },
                  {
                    label: 'Send the record downstream first, then persist the state — it is one fewer thing on the critical path',
                    verdict: 'dead',
                    why: 'This *is* an option the system offers — it is called a weak production, and it is off by default for a reason worth understanding. Emit a window count, crash before the state is saved, come back, take one more record and emit a *different* count for the same logical window, and now the downstream consumer has two records that are bit-wise distinct and logically the same, and needs conflict-resolution logic to survive it. It also couples every stage to its successor’s acknowledgement, so latency compounds down the pipeline: at a pessimistic 1% chance of a machine failing in a given minute, a five-deep pipeline has nearly a **5%** chance of waiting on a failure every minute.',
                  },
                  {
                    label: 'Wrap the state update in a database transaction — that is what transactions are for',
                    verdict: 'dead',
                    why: 'Necessary, insufficient, and the failure is beautiful. Work moves between machines for load balancing, so a **zombie** worker can have a transaction still in flight when its replacement starts. The replacement scans for pending timers, the delayed transaction *then* commits, and the new owner is holding an in-memory view that is missing a timer nobody will ever fire — with no error anywhere. Transactions protect the store; they do not protect the caches you built from the store. The fix is a **sequencer** attached to every write, invalidated when work moves, so only the current owner of a key range can write at all.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived MillWheel — and, more usefully, the thing the next chapter is about',
              body: [
                '**The system, stated plainly.** A graph of user computations exchanging (key, value, timestamp) triples. Code runs scoped to one key, serialised per key and parallel across keys, with a per-key persistent store behind it. **Timers** fire on either the wall clock or the watermark, in increasing time order, journaled so they survive a machine dying. Delivery is exactly-once by committing the record’s id with the state it changed, and a replicated master hands lexicographic key ranges to machines and moves them under load.',
                '**The idea to carry.** Completeness became **a computed property of the pipeline** rather than a timeout in somebody’s application. That is what makes it composable — a bound at the front means something at the back, because the definition is recursive — and it is why a user can write *wait for the watermark* instead of *sleep for thirty seconds and hope*. Everything else in this act is built on top of that one move.',
                '**And the crack that the rest of the act widens.** The bound is an estimate, so it is sometimes wrong, and the paper says so and measures it: about **0.001%** of records arrive behind it. Once you accept that, one number is doing a job it cannot do alone — it is being asked to say both *when may I emit* and *when may I forget*, and those want different answers. *A dip detector wants to be sure. A dashboard wants to be fast. A billing system wants to be corrected later.* Splitting that single decision into separate ones is the next chapter, and it is why an act that could have been one paper is four.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'Two clocks, drawn against each other',
      accent: 'denim',
      rung: 'Rung 3 · The reveal',
      span: 2,
      body: [
        'This is a different instrument from the rest of the book, and it exists because the boxes-and-arrows traces of Season 1 cannot show what this act is about. A record that happened at :04 and arrived at :14 is not a hop between components. **It is a distance between two clocks**, so here are both of them: when it happened across, when you heard down.',
        'Everything below the sweep line has not reached you yet. Step 4 is the watermark arriving, step 6 is the moment it turns out to have been wrong, and step 7 is the choice that leaves.',
      ],
      diagram: (
        <div className="gn-figure">
          <TimelinePlayer spec={millwheelTimeline} />
        </div>
      ),
      think: {
        q: 'Chapter 19’s engine also knew when a time was complete, and it was a proof rather than an estimate. What changed?',
        a: '**The boundary of the system moved, and the proof was on the wrong side of it.** Timely dataflow can prove completeness because it knows about every piece of outstanding work — every message in flight, every notification not yet delivered — since all of it is inside the cluster, created by the cluster, and accounted for by a protocol every worker participates in. "No message at time t can arrive again" is a theorem about a closed world. Now put the source in a phone. The outstanding work includes a search that has been typed and has not left the handset, and there is no protocol you can run that will tell you about it, because the thing holding it is not participating in anything. This paper is honest about exactly where that honesty runs out: watermark values are *seeded by injectors*, injectors measure pending work in external systems, and that measurement is an estimate. So the same quantity that was a theorem becomes a **bet** — well-informed, computed from real pending work rather than guessed, monotonic so it can be relied on, and still capable of being wrong about 0.001% of the time. *Notice that this is not a weaker implementation of the same idea.* It is the same idea meeting a world that has an outside, and everything that follows in this act — how long you wait, what you publish before you are sure, what you owe the people you already answered — exists because the bet cannot be turned back into a theorem. The engineering question stops being "how do I know?" and becomes "what do I do about the times I did not?"',
      },
    },
    {
      n: 'Step 04',
      title: 'What the guarantees cost, measured',
      rung: 'Rung 4 · The measurement',
      body: [
        'Start with the latency, because the two numbers make a point no argument would. A single-stage pipeline on **200 CPUs**, doing the many-to-many shuffle between differently-keyed stages that is roughly the worst case for delivery: **median 3.6 ms, 95th percentile 30 ms** — with exactly-once and checkpoint-before-send *switched off*. Turn both on and the median becomes **33.7 ms** and the 95th **93.8 ms**.',
        '**About nine times the median, to never process a record twice.** That is the price of the ledger in step 2’s third question, and it is why the paper makes it a switch rather than a principle. A stateless filter is already idempotent and should turn it off; a billing pipeline should not. *A system that offers one setting here has decided on your behalf which of those you are.*',
        'Then the number that matters more for this act. The watermark’s lag behind real time is what bounds how fresh any windowed answer can be, and it accumulates down a pipeline because the bound is recursive. Three stages on 200 CPUs: the first stage’s watermark ran **1.8 s** behind real time, and each subsequent stage added **less than 200 ms**. So the shape is a large fixed cost at the injector and a small increment per hop — meaning **the cost of knowing is paid mostly at the edge**, where you are estimating what the outside world still owes you, and the depth of your graph is comparatively cheap.',
        'And the scaling result that is easy to skim past. Running the same latency test from **20 CPUs to 2,000**, median latency stays roughly flat while the 99th percentile gets significantly worse, though still around 100 ms. The authors say plainly why: more machines mean more opportunities for something to go wrong. *That is the same argument Chapter 19 made about micro-stragglers, reached from a different direction* — coordinate often enough and the tail becomes the number you actually live with.',
      ],
      code: {
        file: 'zeitgeist.cc',
        lines: [
          { t: '// count the bucket, and arrange to be told when it is done' },
          { t: 'void Windower::ProcessRecord(Record input) {' },
          { t: '  WindowState state(MutablePersistentState());' },
          { t: '  state.UpdateBucketCount(input.timestamp());' },
          { t: '  SetTimer(WindowID(input.timestamp()),' },
          { t: '           WindowBoundary(input.timestamp()));', hl: 'good' },
          { t: '}' },
          { t: '' },
          { t: '// the watermark passed the boundary. publish.' },
          { t: 'void Windower::ProcessTimer(Timer timer) {' },
          { t: '  Record r = WindowCount(timer.tag(),' },
          { t: '                 MutablePersistentState());' },
          { t: '  r.SetTimestamp(timer.timestamp());' },
          { t: '  ProduceRecord(r, "windows");' },
          { t: '}' },
          { t: '' },
          { t: '# the user never wrote a timeout, a retry, or a dedup check' },
        ],
      },
      diagram: <GuaranteePriceDiagram />,
      deeper: {
        summary: 'The zombie that a transaction cannot stop',
        body: [
          'Work moves between machines constantly here — that is the point of a replicated master handing out key intervals — and moving work is where the subtlest bug in the paper lives.',
          'Worker **B** is processing a key range and issues a transaction to write a timer. The transaction is delayed on the wire. Meanwhile B is declared gone and **B-prime** takes over the range, and its first act is to scan the store for pending timers so it can build an in-memory heap of them. The scan completes. *Then* B’s delayed transaction commits. B-prime now holds an in-memory view that is missing a timer which exists in the store, and nothing anywhere is in an error state — the transaction succeeded, the scan succeeded, and the timer is simply orphaned, possibly forever, delaying whatever it was going to do.',
          'The reason a transaction cannot help is that **the transaction protects the store and the bug is in the cache built from the store.** Any system that reads durable state into memory once and then trusts it has this shape of hole, and the hole opens exactly when ownership changes, which is exactly when a system is already under stress.',
          'The fix is a **sequencer** attached to every write — a lease, in effect — which the store checks before committing, and which a new owner invalidates before it starts. So B’s delayed write is rejected rather than applied, and the in-memory view stays true. *It is the same mechanism as the Chubby lock generation number from Chapter 4, doing the same job: making a stale writer’s late arrival detectable by the thing it is arriving at.*',
        ],
      },
    },
    {
      n: 'Step 05',
      title: 'Make the framework absorb the hard part',
      rung: 'Rung 5 · The design stance',
      body: [
        'The stance is stated as a goal and then honoured everywhere: **take non-idempotent user code and run it as if it were idempotent.** Read the example computations in the paper and notice what is missing from them. No deduplication. No retry logic. No timeout constant. No locking, even though records for a key arrive concurrently from several senders. The user writes *update the count* and *when the bucket is done, publish it*, and every hard thing is underneath.',
        'What makes that more than a slogan is that the guarantees are stated as one sentence a user can hold: all internal updates resulting from record processing are atomically checkpointed per key, and records are delivered exactly once. Then, immediately, the boundary: **this guarantee does not extend to external systems.** *A guarantee with a stated edge is worth more than a broader one with a fuzzy edge*, because the first tells you where your own work begins.',
        'The same instinct shows up in a place that looks like an implementation detail and is not. This design checkpoints constantly, so it hammers the storage layer, and reads there cost more than writes. The usual answer is the store’s own LRU cache — and the usual access pattern here is *hostile* to LRU, because data is buffered until a window closes and then read, which makes **the most recently written row the one least likely to be wanted soon.** So the framework keeps its own cache, using knowledge the storage layer does not have, and cuts CPU use across workers and storage by a **factor of two**. The transferable idea is not the cache. It is that a general-purpose eviction policy is a guess about access patterns, and the layer that *knows* the pattern should not defer to the layer that does not.',
        'And it extends to the watermark itself. Because a global authority is computing them anyway, you can ask it for a cheaper one: strip the outliers and offer a **99% low watermark**, tracking the progress of 99% of record timestamps rather than all of them. A consumer that wants approximate results sooner can wait on that instead and stop waiting for stragglers. *One mechanism, two prices* — and the reader who noticed that a dip detector and a dashboard want different answers has just watched the first crack appear.',
      ],
      diagram: <ExactlyOnceLedgerDiagram />,
    },
    {
      n: 'Step 06',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 6 · What certainty costs',
      body: [
        '**Nine times the median latency, and you may switch it off.** 3.6 ms becomes 33.7 ms with exactly-once and strong productions on. The honest reading is not that the guarantees are expensive but that they are *unevenly* worth it — the same pipeline contains a stateless filter that needs none of it and an aggregate that cannot live without it, and someone has to decide per computation. **A switch is a decision delegated, and delegated decisions are the ones that go stale** when the person who set them leaves.',
        '**The watermark lags, and freshness is bounded by that lag.** 1.8 s at the first stage, under 200 ms per stage after. That is a good result and it is still a floor: no windowed answer in this pipeline can be fresher than the bound that tells you the window is finished, and the bound is dominated by the injector’s guess about the outside world. *You cannot engineer your way past the front door.*',
        '**Late records are dropped, and the count of them is the only reason you know.** About 0.001% for Zeitgeist. That number is tiny and it is not zero, and which 0.001% it is depends entirely on who had bad signal — so the loss is not random with respect to anything you care about. The alternative, correcting published aggregates, means every downstream consumer must accept a revision, and most of the systems anybody plugs into this cannot.',
        '**Hot keys are the failure mode the architecture cannot absorb.** Everything here parallelises across keys and serialises within one, so a pipeline where 90% of the traffic carries a single key is a pipeline running on one machine. The paper says so. It is the same shape as Chapter 17’s single hot item — the mechanism that saves you is a division, and the most extreme skew is precisely the case that cannot be divided.',
        '**And a long, uninterruptible operation inside a computation breaks load balancing.** Work moves between machines constantly; a monolithic step that resists checkpointing forces the balancer to either kill it and waste the work or wait and risk overloading the machine. *The system’s stability depends on being able to move work at any moment, which is a constraint on the code you are allowed to write inside it.*',
      ],
      callout: {
        kind: 'bad',
        big: 'THE BOUND IS AN ESTIMATE',
        text: 'Watermarks are seeded by injectors measuring pending work in systems they do not control. Everything downstream treats the number as a promise, and it was always a well-informed bet — which is why the rest of this act is about what to do on the days it loses.',
      },
    },
    {
      n: 'Step 07',
      title: 'Where it stands in 2026 — and the question it left open',
      rung: 'Rung 7 · One number, two jobs',
      body: [
        '**The system became something else, and the vocabulary became everyone’s.** MillWheel was folded into what Google eventually shipped as Cloud Dataflow, and from there into the model in the next chapter and the open-source project that followed it. But the words are the legacy: *watermark*, *event time*, *timer on the watermark* are now standard in every serious stream processor, and they came from here.',
        '**The strongest single idea is the one people re-derive badly.** Completeness as a *computed* property — the oldest unfinished work anywhere behind you, defined recursively so it composes down a graph — is what separates this from a timeout. Most homegrown pipelines still use a timeout, and the tell is that nobody can say what the total slack of the pipeline is, because each stage padded for the one before and nobody added it up.',
        '**And here is what one paper could not settle.** The watermark is doing two jobs that want different answers. It says *when may I emit a result*, and it says *when may I forget the state*. A dip detector wants to be sure and will wait; a dashboard wants a number now and will accept a revision; a billing system wants to be corrected later and can never simply drop. This design offers one bound, a timer that fires on it, and a choice between dropping late records or correcting by hand — which is a real answer, and it makes every one of those pipelines a bespoke piece of engineering.',
        'Two chapters ago somebody had to decide, per vertex, when a partial answer was safe to emit. Here they have to decide, per pipeline, what to do when the bound was wrong. **It is the same burden moved by one layer**, and it is still an expert’s burden. The next chapter is the same authors, two years later, taking that single decision apart into three that can be answered separately — and it is the most useful thing in this book on the subject.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Event time.',
      body: 'When the thing happened, according to whoever produced the record. A property of the world, and the only timestamp that stays true no matter how the record travels.',
    },
    {
      term: 'Processing time.',
      body: 'When your system saw it. A property of your infrastructure, and the number every engine in Act I was quietly using instead.',
    },
    {
      term: 'Low watermark.',
      body: 'The oldest unfinished work anywhere behind a computation, taken together with the watermarks of everything upstream. A claim that nothing older is still coming, and it only moves forward.',
    },
    {
      term: 'Injector.',
      body: 'Where records enter from an external system, and where the watermark is seeded. It estimates pending work out in a world it does not control, which is where the bound stops being exact.',
    },
    {
      term: 'Timer.',
      body: 'A per-key hook set for a wall time or a watermark value. Fires in increasing time order, journaled so it survives a restart, and delivered exactly once like a record.',
    },
    {
      term: 'Strong production.',
      body: 'Checkpointing a record before sending it, in the same atomic write as the state change. Off by default it is called a weak production, and then a crash between the two makes two records for one logical window.',
    },
    {
      term: 'Sequencer.',
      body: 'A token on every write that the store validates, invalidated when a key range changes owner. It stops a zombie worker’s delayed write from landing behind its replacement’s back.',
    },
  ],
  inTheWild: {
    note: '5 ways this bites in production',
    points: [
      '**Somebody sets the event timestamp to the time of ingestion, and the whole model quietly becomes decorative.** The field is user-assigned, so nothing stops it. Watermarks then track your own pipeline rather than the world, late data becomes invisible instead of counted, and every dashboard looks perfect.',
      '**The dropped-record counter exists and nobody alerts on it.** 0.001% is a fine number until an upstream change makes it 4% for one region, and the only place that shows is a metric nobody put on a dashboard because the number had always been boring.',
      '**Watermark lag becomes the SLA, and it is set by the slowest injector.** Teams optimise their own stages and find the freshness barely moves, because the bound is dominated by an estimate made at the edge about a system they do not own.',
      '**One key gets 90% of the traffic and the cluster stops mattering.** Processing is serialised per key by design, so the pipeline is running on one machine and the CPU graph for the rest of the fleet looks healthy while the backlog grows.',
      '**Exactly-once is switched off for latency and nobody records why.** It is the right call for a stateless filter and catastrophic for an aggregate; the setting outlives the person who reasoned about it, and the computation downstream of it changes shape a year later.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Compute completeness, do not wait for it',
        when: 'anything downstream needs to know it has everything. A bound derived from outstanding work composes across stages and can be reported; a timeout does neither, and **a pipeline of timeouts has a total slack nobody can state.**',
      },
      {
        choose: 'Make the bound monotonic, even when that makes it wrong',
        when: 'other components will act on it. Once a consumer has fired a timer or published a number, a retreating bound cannot un-spend that — so a bound that can go backwards is one nobody can safely use at all.',
      },
      {
        choose: 'Commit the receipt with the change',
        when: 'retries are unavoidable and the work is not idempotent. One atomic write holding both the effect and the id that caused it removes the window a crash would otherwise open — and a Bloom filter keeps the common path off the disk.',
      },
      {
        choose: 'Cache where the access pattern is known',
        when: 'the layer underneath is guessing. Write-then-read-much-later is hostile to LRU, so the component that knows the pattern should hold the cache. Here that was worth a factor of two across workers and storage together.',
      },
    ],
  },
  misconception: {
    think: '“A watermark is the current time, minus how late data usually is.”',
    actually:
      'That describes a *heuristic* watermark, which is a real and widely deployed thing, and it is not what this paper defines. Here the low watermark is **the oldest unfinished work anywhere behind you** — the oldest record in flight, stored or pending delivery, minimised with the same quantity from every upstream stage. Three consequences follow that the subtract-a-constant version does not have. It is a fact computed from the pipeline’s actual contents rather than a reading off a clock, so a backlog *holds it back* instead of letting it march on and orphan everything. It is **recursive**, so a bound established at the front of a graph still means something five stages later, and the paper measures the cost of that: under 200 ms added per hop. And because it is a minimum over pending work, a single record from far in the future cannot drag it forward, which is exactly the failure of the max-based version. Where the two meet is at the edge: the bound is seeded by injectors estimating pending work in systems nobody controls, so it can still be wrong — about 0.001% of records arrived behind it in the paper’s own deployment. *The difference is not accuracy, it is what happens when you are behind.* A clock-minus-delta watermark keeps moving while your pipeline drowns. This one waits.',
  },
  sources: [
    {
      year: '2013',
      title: 'MillWheel: Fault-Tolerant Stream Processing at Internet Scale — Akidau et al. (VLDB)',
      url: 'https://research.google.com/pubs/archive/41378.pdf',
      note: 'Read **§4.5** first — one page, and it is the definition everything else in this act rests on. Then **§6.1**, which is the clearest short account anywhere of how exactly-once is actually built, including why weak productions couple a pipeline’s stages together. **§6.2** contains the zombie-writer figure, which is worth the detour: a bug that no transaction can prevent, explained in four paragraphs.',
    },
    {
      year: '2015',
      title:
        'The Dataflow Model: A Practical Approach to Balancing Correctness, Latency, and Cost in Massive-Scale, Unbounded, Out-of-Order Data Processing — Akidau et al. (VLDB)',
      url: 'https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf',
      note: 'Chapter 22, by overlapping authors two years later, and the direct sequel. Read them in order. This paper gives you one bound doing two jobs; that one separates *what result* from *when to emit* from *how to combine*, and the separation is the reason the vocabulary of this field settled the way it did.',
    },
    {
      year: '2013',
      title: 'Naiad: A Timely Dataflow System — Murray et al. (ACM SOSP)',
      url: 'https://dl.acm.org/doi/10.1145/2517349.2522738',
      note: 'Chapter 19, published the same year, solving the same problem in a world with no outside. Its completeness is a theorem because every piece of outstanding work is inside the cluster; this one’s is a bet because the work includes a search that has not left somebody’s phone. Reading them together is the cleanest way to see that the difference is the boundary, not the algorithm.',
    },
    {
      year: '2008',
      title: 'Out-of-Order Processing: A New Architecture for High-Performance Stream Systems — Li, Tucker, Tufte, Papadimos, Maier, Terwilliger (VLDB)',
      url: 'https://www.vldb.org/pvldb/vol1/1453890.pdf',
      note: 'The prior art this paper cites for its central authority, and five years earlier. Worth reading to see how much of the vocabulary was already there in the database-research literature before the internet-scale systems arrived, and how little of it had escaped into practice.',
    },
    {
      year: '2015',
      title: 'Streaming 101: The world beyond batch — Tyler Akidau',
      url: 'https://www.oreilly.com/radar/the-world-beyond-batch-streaming-101/',
      note: 'Not a paper, and the best explanation of event time versus processing time ever written for people who have to ship something. By the first author of both this chapter’s paper and the next one’s. If any part of this act does not click, read this and then come back.',
    },
  ],
  seenIn: [
    { label: 'The Same Query, Twice a Second — Ch 20', to: '/papers/structured-streaming', live: true },
    { label: 'One Engine, Both Shapes — Ch 19', to: '/papers/naiad', live: true },
    { label: 'The Lock Everyone Was Secretly Holding — Ch 4', to: '/papers/chubby', live: true },
    { label: 'What “Before” Even Means — Ch 7', to: '/papers/lamport', live: true },
  ],
  finale: {
    title: 'A bet you can compute',
    body: 'The question this act opens with has no answer inside the data: nothing in a stream says “that was the last one for 10:59:04.” What this paper does is refuse to answer it with a timeout, and instead compute it — the oldest unfinished work anywhere behind you, defined so that it composes down a pipeline, and guaranteed to move only forward so that everything downstream can spend it. That turns completeness from a constant somebody typed into a property of the system, and it is why every stream processor you will ever use has the word watermark in it. What it does not do is make the bound true. It is seeded at the edge by an estimate about a world nobody owns, so about one record in a hundred thousand arrives behind it, and the system’s honesty is that it counts them. One number is now carrying two jobs — when to emit, and when to forget — and they want different answers.',
  },
  next: { title: 'Interlude: The Three Times', slug: 'three-times' },
}
