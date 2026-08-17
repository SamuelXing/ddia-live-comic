import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { TimelyTimestampDiagram, BothShapesDiagram, StalenessDialDiagram } from '../diagrams'
import { naiadTrace } from './naiad-trace'

/* The hard part of this chapter is that Naiad the system is dead and the
   chapter still has to be worth an evening. So it cannot be a tour of the API.

   Two things make it a chapter. The first is the reframe: batch and streaming
   are not two workloads, they are two corners of one grid, and the only reason
   they needed separate engines is that a scalar timestamp cannot say "third
   iteration of the second batch". Give the timestamp a shape and the grid fills
   in. The second is §6.4, which is the first place in this book where somebody
   measures the price of freshness directly — 500-900 ms for the newest answer,
   under 10 ms for one that is a second old. That is the season's whole thesis
   with a number attached, and it should be the thing a reader remembers. */

export const naiad: Chapter = {
  slug: 'naiad',
  act: 'Act I · Nobody Wants to Wait Until Morning',
  paperNo: 'Paper 19',
  title: 'One Engine, Both Shapes',
  dek: 'A loop that never finishes, over input that never stops, answering questions from the middle of it. Three things every system could do two of — and the reason turned out to be what a timestamp is allowed to be.',
  minutes: 18,
  paper: {
    title: 'Naiad: A Timely Dataflow System',
    authors: 'Derek G. Murray, Frank McSherry, Rebecca Isaacs, Michael Isard, Paul Barham, Martín Abadi',
    venue: 'ACM SOSP',
    year: '2013',
    url: 'https://dl.acm.org/doi/10.1145/2517349.2522738',
  },
  caption:
    'Chapter 18 kept the middle of a computation in memory, and the shape of the work did not change: you still gather all the input, run the loop, get an answer, and start over when new records arrive. Now here is an application that breaks it. Tweets are arriving continuously. You want the connected components of the graph of who mentions whom — an iterative computation, and one that should *update* rather than restart. And somebody wants to ask, right now, what the most popular hashtag is in their part of that graph. **Every one of those three demands had a system that served it well in 2013, and no system served all three.** Batch engines iterate and cannot ingest. Stream processors ingest and cannot iterate. You could bolt them together, and people did, and the result had two sets of failure modes and no consistent answer anywhere in the middle. The reason is smaller and stranger than any of that.',
  steps: [
    {
      n: 'Step 01',
      title: 'Three requirements, and the arithmetic that says you get two',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'Write the demands out plainly, because the incompatibility is not obvious until you do. **One:** the input never stops, so the computation must consume records as they land and cannot wait for a final one. **Two:** the computation loops until it converges, and convergence is a property of a *fixed* input. **Three:** somebody may ask for an answer at any moment, and the answer has to be consistent — reflecting some coherent set of the input, never half of one update.',
        'Requirements one and two are the fight. A batch engine gets its correctness from a barrier: every worker finishes iteration *k* before anyone starts *k+1*, and the input is not allowed to change while any of that is happening. A stream processor gets its throughput by having no barrier at all, and pays for it by having no loops — the systems that did offer feedback did it with **weak or no consistency guarantees**, which fails requirement three.',
        'Now the part worth sitting with. Ask *why* the batch engine needs the barrier and the answer is not synchronisation, it is bookkeeping. The engine has to know when the results for a given round are complete, and the only thing it has to reason with is a scalar — a round number, a sequence number, an offset. **A scalar cannot express “the third time round the loop, on the second batch of input.”** So when a message shows up, the engine cannot tell whether it belongs to work it has already declared finished, and its only safe move is to forbid the situation entirely by making everybody wait.',
        'The constraint, then, is not about scheduling or about networks. It is a *representation* problem wearing an engineering problem’s clothes. And representation problems have the nice property that fixing them tends to remove several symptoms at once.',
      ],
      diagram: <BothShapesDiagram />,
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'You want one engine that runs batch, streaming and loops without treating any of them as a special case of the others — and what stands in the way turns out to be a data type rather than a distributed systems problem, which is usually a sign you are near the real idea.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**The application:** a stream of tweets that never ends, an iterative graph computation over it that must update rather than restart, and interactive queries answered from the middle.',
              '**What you may assume:** the working set fits in the cluster’s aggregate RAM. This is a latency system; anything that touches a disk on the critical path has already lost.',
              '**What you may not assume:** that input stops. There is no final record, so “run until convergence, then report” is not available to you.',
              '**What must stay true:** any answer you hand out reflects a coherent set of the input — never half an update, never one worker’s view disagreeing with another’s.',
              '**The scale you are aiming at:** tens of thousands of records a second arriving, iterations that can be as short as a millisecond, and sixty-odd machines.',
            ],
            questions: [
              {
                q: 'Every message needs a logical time so the system can reason about what is finished. What is that time?',
                options: [
                  {
                    label: 'A pair: which batch of input this came from, plus one counter for each loop it is currently inside',
                    verdict: 'move',
                    why: 'This is the whole paper and it fits on one line. A timestamp becomes **a coordinate rather than a position** — not “message 4,001” but “the first time round, on the third batch.” Two consequences follow immediately. It is a **partial** order: `(epoch 3, round 1)` and `(epoch 1, round 4)` are simply not comparable, which is the formal way of saying *they are independent work and may proceed at the same time.* And the counters only ever go up, in a way the graph’s own structure fixes: entering a loop appends a counter, going round increments the innermost one, leaving drops it. **Three vertices in the whole system touch a timestamp, and they compute nothing else.** That is what makes it possible to prove which future times are still reachable.',
                  },
                  {
                    label: 'A monotonically increasing sequence number, assigned as records enter the system',
                    verdict: 'dead',
                    why: 'This is what streaming systems used, and it is exactly what forbids the loop. A feedback edge sends a record *back* — so either its number goes down, and monotonicity is dead along with every completeness argument built on it, or it gets a new number, and the system has lost the fact that this is the same batch of input going round again. **The failure is not that the number is wrong, it is that one number cannot hold two independent facts.** You do not need a bigger counter. You need a second dimension.',
                  },
                  {
                    label: 'Wall-clock time from the machine that produced the record',
                    verdict: 'dead',
                    why: 'Chapter 7 is the long answer and there is a shorter one here: iterating does not take time in any sense the clock knows about. A record going round the loop for the fourth time is not later than one going round for the third, it is *inside the same batch of work*, and a clock has no way to say that. Wall-clock time is a fact about the world; what this system needs is a fact about the computation. **They are different quantities and a great many bugs come from letting one stand in for the other** — which is the subject of the entire next act, from the opposite direction.',
                  },
                  {
                    label: 'A vector clock — one entry per worker, so causality between them is visible',
                    verdict: 'dead',
                    why: 'A reasonable instinct pointed at the wrong question. A vector clock tracks *who knew what before whom*, which is a fact about processes, and here every worker is running the same dataflow graph and their relative order is not what anybody needs to know. The question being asked is “can any message still arrive bearing time t?”, and that is answered by the shape of the graph and the work outstanding in it, **not by the identities of the machines**. Vectors grow with the cluster; this timestamp grows with the loop nesting, which is a number like two.',
                  },
                ],
              },
              {
                q: 'A vertex counting distinct items can emit each new item immediately, but must not emit a count until no more items can arrive for that time. Who tells it, and how?',
                options: [
                  {
                    label: 'Track the outstanding work at each timestamp across the whole cluster, and use the graph structure to prove which times are now unreachable',
                    verdict: 'move',
                    why: 'The vertex asks to be notified at time t and the system guarantees the notification comes only when no message at t or earlier can ever be delivered again. That guarantee is possible for one reason: **every path through the graph either leaves a timestamp alone or advances it**, so from the work currently outstanding you can compute the set of times still reachable. It is a proof, not an estimate. The engineering is in making it cheap — the naive protocol has every worker telling every other worker about every change, and *accumulating updates locally before broadcasting cut the protocol traffic by one to two orders of magnitude*, which was the difference between a working system and a network flood.',
                  },
                  {
                    label: 'Put a barrier at the end of every iteration — nobody proceeds until everybody has finished',
                    verdict: 'dead',
                    why: 'Correct, simple, and it is the batch engine you were trying to escape. A barrier forbids exactly the concurrency the two-part timestamp was invented to permit: iteration four of one batch can no longer overlap the arrival of the next batch, so the streaming half of the requirement dies. And it is expensive in a way that gets worse with scale — the paper measures a bare global barrier at a **median of 753 µs across 64 machines**, which is fine, while the 95th percentile climbs steadily, which is not. *You would be paying the tail latency of the slowest machine, once per iteration, forever.*',
                  },
                  {
                    label: 'Wait a fixed interval after the last message at time t, then assume nothing more is coming',
                    verdict: 'dead',
                    why: 'A guess dressed as a mechanism, and it fails in both directions: too short and you emit a count that a later message contradicts, too long and you have added latency to every answer to protect against something that mostly does not happen. Here the right answer is genuinely available — this is a *closed* system where all the outstanding work is knowable — so guessing is strictly worse. **Hold on to that, because it stops being true in one chapter.** When the records come from phones in tunnels, the outstanding work is not knowable and a timeout is the only thing left, which is why Act II is entirely about choosing that number.',
                  },
                  {
                    label: 'Let the vertex ask the other workers directly whenever it needs to know',
                    verdict: 'dead',
                    why: 'It gives the right answer and the traffic is quadratic in the workers, at a frequency set by how often anybody wants to emit anything — which in a tight iterative computation is *constantly*. There is a deeper problem too. The answer would be stale the moment it arrived, because more work may have been created while the replies were in flight, so you would need a round of agreement rather than a poll. **Completeness has to be pushed as it changes, not pulled when it is wanted.**',
                  },
                ],
              },
              {
                q: 'A worker stalls for 200 ms — a TCP timer, a garbage collection pause, a lock backing off. Iterations here last about a millisecond. What do you do about it?',
                options: [
                  {
                    label: 'Prevent them, one source at a time — because the usual cure is unavailable to you',
                    verdict: 'move',
                    why: 'Start with why the usual cure is gone. Batch systems beat stragglers by **running the work twice** and taking whichever copy finishes, which is safe only because the workers are stateless. Here every vertex holds mutable state, so a duplicate would have to coordinate its updates with the original, and that costs more than the stall. So the paper does something unglamorous and instructive: it hunts them. Nagle’s algorithm off, because a small message in each direction otherwise pairs with delayed acknowledgement for a **200 ms** penalty. Delayed-ack timeout down to **10 ms**. Minimum retransmit timeout from 300 ms to **20 ms**, because progress-tracking traffic arrives at every machine simultaneously and drops packets. Timer granularity to **1 ms**, because the lock primitives sleep on contention and the default quantum is 15.6 ms. Object allocation avoided throughout, so the garbage collector runs less and has less to walk. *Six unrelated fixes and one cause: coordinating every millisecond makes every ordinary delay a correctness-shaped problem.*',
                  },
                  {
                    label: 'Run a backup copy of any task that falls behind, as MapReduce does',
                    verdict: 'dead',
                    why: 'The technique that works in Chapter 2 and Chapter 18 and cannot work here, and the reason is the one thing this engine has that they do not: **the workers keep mutable state between rounds.** Two copies of a stateful vertex are two divergent states, so you would need replicated-state coordination on the hot path to keep them consistent — and that costs more than the stalls you are avoiding. *Stateless is not a limitation of the batch model; it is the property that made its straggler mitigation legal.*',
                  },
                  {
                    label: 'Make the iterations longer so a 200 ms stall is a smaller fraction of each one',
                    verdict: 'dead',
                    why: 'You have deleted the problem by deleting the system. Millisecond iterations are why anybody is here; batching them into hundred-millisecond ones gives back exactly the latency the whole design was built to win, and does it uniformly rather than only when a stall occurs. It is worth knowing that this *is* a real design point, and that a later chapter in this act chooses it deliberately and honestly — but choosing it here means you did not need timely dataflow.',
                  },
                  {
                    label: 'Detect stalled workers and reassign their vertices to healthy machines',
                    verdict: 'dead',
                    why: 'Far too slow for the timescale. Moving a stateful vertex means moving its state, and these stalls last tens of milliseconds — the migration would not finish before the stall did, and you would have paid for it anyway. It also has the reactive flaw Chapter 17 kept running into: by the time the detector is sure, the latency has already been delivered to somebody. **The only intervention faster than a micro-straggler is one that happened before it.**',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived timely dataflow — and, more usefully, the reason the two worlds were ever separate',
              body: [
                '**The model, stated plainly.** A directed graph, cycles allowed, with loops explicitly marked so that every cycle passes through an ingress, a feedback and an egress vertex. Messages carry a timestamp of `(epoch, ⟨loop counters⟩)`. Stateful vertices implement two callbacks — one for a message arriving, one for “you have now seen everything at time t” — and may send only at times greater than or equal to the one they were called with. That last rule is what makes the completeness proof possible, and it is enforced rather than trusted.',
                '**What the reframe buys.** Batch and streaming stop being two workloads and become two corners of one grid: iterations down, input batches across. A batch engine walks one column, a stream processor walks one row, and neither restriction was ever fundamental — both came from a timestamp too small to say where you are. The paper backs the claim by expressing existing frameworks as libraries on top: PageRank in **30 lines**, weakly connected components in **49**, the Pregel model itself as a port. *The evidence for an abstraction is not that it is elegant, it is that the systems you thought you needed become small programs inside it.*',
                '**And the number to carry out of this chapter.** In the application it was built for — 32,000 tweets a second, ten queries a second, an incremental connected-components computation in the middle — asking for the very freshest answer costs **500 to 900 ms**, because a correct answer must wait for the update that makes it correct. Asking for an answer as of one second ago costs **under 10 ms**. Same query, same guarantee, same graph. **One second of age is worth roughly fifty times the latency**, and every chapter after this one is somebody choosing a point on that dial.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'A loop that never stops, over input that never stops',
      accent: 'denim',
      rung: 'Rung 3 · The reveal',
      span: 2,
      body: [
        'This is the application from the paper’s own opening figure, and the honest reason it opens the paper: it is the smallest thing they could describe that no existing system could build.',
        'Step 4 is the mechanism the whole model exists to make possible, steps 5 and 6 are the season’s thesis with a stopwatch on it, and step 7 is what it all costs.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={naiadTrace} />
        </div>
      ),
      think: {
        q: 'If the timestamp is what made this possible, why did the previous chapter’s engine not just adopt it?',
        a: '**Because the timestamp is the cheap half.** What a two-part timestamp buys you is the *ability* to have several rounds of several batches in flight at once. Actually having them in flight means the vertices must keep their state between rounds and mutate it as messages arrive — otherwise every round starts from nothing and you are back to recomputing. And the moment the state is mutable and long-lived, three things the previous chapter relied on stop working. Lineage stops working, because replaying a function no longer reproduces a partition; the state depends on the order and the set of messages that reached that vertex, so recovery has to snapshot rather than replay. Speculative execution stops working, because two copies of a stateful vertex are two different states rather than two computations of the same value. And fine-grained recovery stops working, because there is no longer any unit smaller than the whole computation whose contents you can reconstruct — which is exactly why this system stops every worker in the cluster to take a checkpoint, and why a single dead process sends *everybody* back to it. *So the two designs are not really competing on timestamps at all.* They are on opposite sides of one decision: whether the middle of a computation is a value that can be recomputed or a state that must be preserved. Chapter 18 chose recomputable and got cheap recovery and a fixed input. This chapter chose preserved and got a moving input and expensive recovery. **Neither is a mistake, and no engine has ever had both** — which is worth remembering when a system claims to unify batch and streaming, because the question to ask is always which of those two it picked underneath.',
      },
    },
    {
      n: 'Step 04',
      title: 'What it can actually do, in seconds',
      rung: 'Rung 4 · The measurement',
      body: [
        'Take the batch numbers first, because they are the ones that make people stop arguing. On the ClueWeb09 Category A web graph — **a billion pages and eight billion edges** — earlier published work compared three approaches to the same standard analyses: a parallel database, a general batch processor, and a purpose-built graph store. Approximate shortest paths took the best of those **671,142 seconds**. It takes this system **1,131** — about **600×**, on comparable hardware. Weakly connected components goes from a best of 26,210 s to **268**. PageRank from 68,791 s to **4,656**.',
        'Those gaps are too large to be explained by better code, and the paper explains them structurally: systems that serialise their local state between iterations pay so much per iteration that they are forced to choose algorithms with *few* iterations. Remove the per-iteration cost and a different algorithm becomes available — one that does far less work per round, exchanges far less data, and needs many more rounds. **The speedup is mostly a change of algorithm that the old engines could not afford to run.**',
        'Then the number this act is actually about. The streaming graph application: 32,000 tweets a second, a new query every 100 ms, incremental connected components in the middle. Ask for the freshest answer and everything returns inside a second, but with a sawtooth — queries queue behind the **500–900 ms** of work that updates the component structure, because a correct answer is not available until that work is done. Ask instead for data one second old and most responses come back in **under 10 ms**, with occasional peaks near 100 when the graph computation gets in the way.',
        '**The consistency is identical in both cases.** Nothing was relaxed and no approximation was introduced; the second query is a precise answer about a moment that has finished happening. All that changed is which moment you asked about — and the price of asking about *this* one, rather than one a second ago, is roughly fifty times the wait. *Season 1 traded consistency against availability. This is the trade that replaces it, and here is what it costs in milliseconds.*',
      ],
      code: {
        file: 'what_the_program_is.txt',
        lines: [
          { t: '# the whole application in the trace above, as the paper counts it' },
          { t: '' },
          { t: 'ingest tweets, extract hashtags and mentions       ' },
          { t: 'incremental connected components over the mentions ' },
          { t: 'top hashtag per component                          ' },
          { t: 'join incoming queries against it                   ' },
          { t: '                                     27 lines of code', hl: 'good' },
          { t: '' },
          { t: '# and the batch programs, same system, same library' },
          { t: 'PageRank                             30 lines' },
          { t: 'weakly connected components          49 lines' },
          { t: 'approximate shortest paths           70 lines' },
          { t: 'strongly connected components       161 lines' },
        ],
      },
      diagram: <StalenessDialDiagram />,
      deeper: {
        summary: 'Why a proof about the future is cheaper than asking everybody',
        body: [
          'The notification guarantee — *you will not be told “time t is complete” until it truly is* — sounds like it needs global agreement, and global agreement per iteration would sink a system whose iterations last a millisecond. It does not need agreement, because it is a statement about **reachability in a graph you already have**.',
          'Every worker holds a count of the outstanding work at each timestamp: messages it has not yet delivered, notifications it has not yet fired. From the structure of the dataflow graph you know what any piece of outstanding work could *become* — a record at time t entering a loop becomes t with a counter appended, going round becomes t with the counter incremented, and no vertex is permitted to send at a time earlier than the one it was called with. So the set of timestamps still reachable from the current outstanding work is computable, and any timestamp not in that set is finished. **No worker has to ask another what it thinks. It has to tell the others when its own counts change.**',
          'Which is where the cost actually lives, and it is a nice lesson in what optimising a protocol means. The direct implementation broadcasts every change, and a computation with millisecond rounds generates an enormous number of tiny changes. Accumulating them locally before sending — combining the updates from the workers on one machine, and again at the cluster level — reduced the protocol traffic by **one to two orders of magnitude**. The paper is candid that the local accumulation is the one that mattered and the global one made little difference to running time, and equally candid that the current scheme may limit scalability at larger cluster sizes than they measured.',
        ],
      },
    },
    {
      n: 'Step 05',
      title: 'Primitives, not a programming model',
      rung: 'Rung 5 · The design stance',
      body: [
        'The stance is stated in the paper’s own architecture diagram and it is easy to skim past: the system offers a **low-level graph assembly interface**, and the libraries, the domain-specific languages and the applications are all built on top of it. Two callbacks — a message arrived, and you have seen everything at time t — plus two things a vertex may do — send at a time, ask to be told about a time. That is the whole vocabulary.',
        'The argument for building at that level is that anything higher is a guess about what people want. So instead of shipping a graph API and a streaming API and a batch API, they shipped the primitives and then *demonstrated* the frameworks as libraries: a Pregel port, a distributed all-reduce for machine learning in **300 lines** — about half the size of the hand-written one it replaces, and measurably better on a small cluster. **The claim being made is not “this is expressive”, it is “here are the systems you thought you needed, written inside it and shorter.”**',
        'And it comes with a matching admission about who should use which layer. The same computation appears three ways in the evaluation: PageRank on the Pregel port in **38 lines**, a native version partitioned by source vertex in **30**, and a version using a space-filling curve and specialised low-level vertices in **547**, which is the fastest. Most developers should build on the libraries; the handful of vertices where performance decides the system get written against the raw interface. *An engine that only has one level of abstraction is either too slow for its experts or too hard for everybody else.*',
        'The cost of building at this level is the part worth taking seriously, because it is what the next chapter is about. **Primitives this good put the incremental thinking in the user’s head.** Somebody writing a vertex has to decide, themselves, what may be emitted immediately and what has to wait for a completeness notification — the paper’s own example spends half its lines on exactly that distinction. That is a genuinely hard thing to be right about, it has to be got right in every vertex, and getting it wrong produces a system that is fast and quietly incorrect.',
      ],
      diagram: <TimelyTimestampDiagram />,
    },
    {
      n: 'Step 06',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 6 · What the state costs',
      body: [
        '**Recovery is all-or-nothing, and the paper says so without flinching.** Checkpointing means every process pauses its workers, drains its message queues, and writes the state of every stateful vertex; recovery means every surviving process reverts to the last durable checkpoint and the dead process’s vertices are shared out. Chapter 18 lost one partition and rebuilt one partition. Here one dead process costs the whole cluster whatever has happened since the last checkpoint. The authors’ own summary: the design *favours performance in the common case that there are no failures, at the expense of availability in the event of a failure.*',
        '**And durability is priced, in throughput.** The same streaming computation, on 32 machines: **482,988 records a second** with no fault tolerance at all, **322,439** with a checkpoint every hundred epochs, **273,741** with continuous logging. Roughly **43 percent** of the throughput, gone, to be able to survive a machine. Median latency goes from 40 ms to 40 ms to 85 ms across those three — so the latency cost is modest and the throughput cost is not, which is a genuinely useful shape to know when somebody offers you exactly-once processing.',
        '**Micro-stragglers are the scaling limit, and they are not really bugs.** A bare global barrier costs a **median of 753 µs across 64 machines**, which is excellent — and the 95th percentile deteriorates as machines are added, because the chance that *somebody* hits a garbage collection pause or a dropped packet in a given millisecond grows with the number of somebodies. All the tuning in step 2 reduces it. None of it removes it. **A system that coordinates every millisecond is a system where every ordinary hiccup becomes visible.**',
        '**The working set has to fit in the cluster’s RAM**, which is the same ceiling as the previous chapter and is stated up front rather than discovered. And the batch numbers, spectacular as they are, come with weak-scaling honesty most papers skip: on a graph grown to match the cluster, running time degrades **about 1.44×** going from one machine to sixty-four, and the paper accounts for nearly all of it in one place — the data exchange, which is now going over a wire instead of staying in a process.',
        '**Finally, the largest bill of all, which the paper could not have known it was running up.** This system asks the programmer to reason about when a partial answer is safe to emit. That is the right question, it is unavoidably in the model, and it is hard enough that the next chapter’s entire argument is that most people should never be asked it.',
      ],
      callout: {
        kind: 'bad',
        big: 'NO LINEAGE, NO PARTIAL RECOVERY',
        text: 'Mutable state between rounds is what makes the loop cheap and it is exactly what makes replay impossible. Every technique from the previous chapter — rebuild the lost piece, run the straggler twice — is unavailable here, and the replacement is stopping the world.',
      },
    },
    {
      n: 'Step 07',
      title: 'Where it stands in 2026',
      rung: 'Rung 7 · The system died, the model did not',
      body: [
        '**Naiad the system is gone, and it is worth being blunt about that** rather than pretending otherwise. It was a research prototype in .NET, from a lab that closed, and it never had a production community. If the measure of a paper were adoption this would be a footnote.',
        '**The model went everywhere.** Timely dataflow was reimplemented in Rust by one of the authors and became the substrate for **Differential Dataflow**, which is Chapter 24 and is the strongest form of the *stop recomputing, start updating* argument in this book. The multi-dimensional logical timestamp, the progress-tracking protocol, the explicit loop contexts: all of it survived the language, the company and the system.',
        '**And the ideas leaked sideways into things that never cite it.** Every modern stream processor now has some notion of progress that is not a wall clock and not a sequence number — watermarks in the systems of Act II are a cousin of this, arrived at from the other end. The difference is instructive and it is the hinge into the rest of the season. Here, completeness is **provable**: the system knows all the work outstanding in it, so “no message at time t can arrive again” is a theorem. Change one thing about the world — let the records come from phones that were in a tunnel — and it stops being a theorem and becomes a *bet*, because the outstanding work now includes events that have happened and have not reached you.',
        '**What Act I still has not solved.** Two chapters in, the engine can iterate without restarting and answer questions from the middle. But somebody has to write the vertices, and writing them means deciding, correctly, in every one, what may be emitted early and what must wait — the exact question this chapter’s design deliberately hands to the user. The paper treats that as a feature, and for the people who could do it, it was. The next chapter starts from the observation that most people cannot, and asks whether they should have to.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Timely dataflow.',
      body: 'The model: a dataflow graph with explicit loops, messages carrying multi-dimensional logical timestamps, and vertices that can be told when a timestamp is complete.',
    },
    {
      term: 'Epoch.',
      body: 'The outer part of a timestamp — which batch of input a record belongs to. Assigned by the producer, which also says when a batch is finished.',
    },
    {
      term: 'Loop counter.',
      body: 'The inner part — one per enclosing loop, saying which time round this is. Appended on entry, incremented by the feedback vertex, dropped on exit.',
    },
    {
      term: 'Notification.',
      body: 'A vertex asking to be told that it has seen every message at a given time. The system must not deliver it early, and the whole progress-tracking protocol exists to make that guarantee cheap.',
    },
    {
      term: 'Progress tracking.',
      body: 'The cluster-wide accounting of outstanding work per timestamp, from which the set of still-reachable times is computed. A protocol every worker joins, not a service anybody calls.',
    },
    {
      term: 'Micro-straggler.',
      body: 'A stall of tens of milliseconds — a TCP timer, a collection pause, a contended lock — that is invisible in a batch job and dominant when an iteration lasts a millisecond.',
    },
  ],
  inTheWild: {
    note: '5 ways this bites in production',
    points: [
      '**The completeness decision is per vertex, and getting it wrong is silent.** Emit a partial aggregate early and nothing errors; downstream simply sees a number that is later contradicted. The bug surfaces as “the dashboard disagreed with the report”, weeks later, and the vertex that did it looks perfectly reasonable.',
      '**Everything in this design assumes the input tells the truth about when it is finished.** The producer labels epochs and says when one is closed. If that label is wrong — a source that reconnects, a partition that lags — the completeness proof is proving something about a lie, and the system has no way to notice.',
      '**One slow machine is felt by all of them, immediately.** There is no speculative execution to hide behind and iterations are short, so a garbage collection pause on one worker is a pause in the whole computation. Fleets are tuned rather than scaled to fix this, which is a different operational skill from the one batch clusters taught everybody.',
      '**Fault tolerance here is a mechanism choice, and it is priced.** On the k-exposure job the paper reports **483k tweets a second with no fault tolerance at all, 322k with a checkpoint every hundred epochs, and 274k with continual logging** — so the safest option costs about **a third of the throughput**, and the cheap one still costs a fifth. Note what is not measured: the frequency was set once, at a hundred epochs, so the paper prices the *choice* rather than sweeping the dial. Recovery cost is the other half — a checkpoint every hundred epochs means a crash reprocesses up to a hundred epochs on every machine — and nobody published that curve.',
      '**“It does batch and streaming” gets read as “I need only one system.”** True at the model level and rarely true at the operational one: the batch job that can tolerate a restart and the streaming job that cannot want opposite settings for checkpointing, cluster size and recovery, and running both in one process means the strictest requirement wins everywhere.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'A timestamp with more than one part',
        when: 'your system has two independent notions of progress — a batch and a round, a version and a retry, a tenant and a sequence. **The moment you find yourself encoding two facts in one increasing integer, you have already lost the ability to say they are independent**, and every barrier you add afterwards is paying for that.',
      },
      {
        choose: 'Prove completeness rather than wait for it',
        when: 'you control every source of work in the system. A proof from graph structure is exact and cheap; a timeout is a guess you pay for on every answer. The check is whether anything can create work you cannot currently see — if so, you do not have a proof and should stop pretending.',
      },
      {
        choose: 'Snapshot the world instead of replaying it',
        when: 'the state is mutable and long-lived, so replay would not reproduce it. Accept what comes with that: recovery is global, its cost scales with checkpoint interval rather than with the failure, and speculative execution is off the table.',
      },
      {
        choose: 'Prevent stalls rather than mask them',
        when: 'your unit of work is shorter than the delays you are masking. Backup tasks and failover both take longer than a micro-straggler lasts, so the only intervention fast enough is the one that happened in advance — in the socket options, the allocator and the timer granularity.',
      },
    ],
  },
  misconception: {
    think: '“Naiad unified batch and streaming, so unification is a solved problem.”',
    actually:
      'It unified them **in the programming model**, which is a real achievement and a smaller claim than it sounds. What the two-part timestamp fixes is a representation failure: with a scalar, an engine cannot tell “round four of batch one” from “round one of batch four”, so it forbids the overlap by putting a barrier in, and that barrier is what made batch engines unable to stream. Give the timestamp a second dimension and the overlap becomes expressible, provable and safe. **What it does not do is unify the operational tradeoff underneath.** This engine keeps mutable state in every vertex, which is why the loop is cheap — and mutable state means replay cannot reproduce it, which means recovery is a global checkpoint, which means one dead machine costs everybody. Chapter 18’s engine made the opposite choice and got fine-grained recovery and an input that has to hold still. Every system since has had to pick one of those, and the ones that advertise both are choosing per job and hoping you do not ask. *The model unified. The bill did not.*',
  },
  sources: [
    {
      year: '2013',
      title: 'Naiad: A Timely Dataflow System — Murray, McSherry, Isaacs, Isard, Barham, Abadi (ACM SOSP)',
      url: 'https://dl.acm.org/doi/10.1145/2517349.2522738',
      note: 'Read **§2.1** and **§2.2** slowly and skip nothing — six pages, and the timestamp definition plus the two-callback vertex interface is the entire idea. **§3.5** on micro-stragglers is the most unusual thing in the paper: a list of Nagle’s algorithm, delayed acknowledgements, retransmit timeouts, lock backoff and garbage collection, treated as one design problem. And **§6.4** is four paragraphs that state this season’s thesis with a stopwatch on it.',
    },
    {
      year: '2012',
      title:
        'Resilient Distributed Datasets: A Fault-Tolerant Abstraction for In-Memory Cluster Computing — Zaharia et al. (USENIX NSDI)',
      url: 'https://www.usenix.org/system/files/conference/nsdi12/nsdi12-final138.pdf',
      note: 'Chapter 18, and the other side of the one decision this chapter turns on. Read the two together with a single question in mind: is the middle of a computation a value you can recompute or a state you must preserve? Everything else about both systems — recovery, stragglers, whether the input may move — falls out of that answer.',
    },
    {
      year: '2013',
      title: 'Differential Dataflow — McSherry, Murray, Isaacs, Isard (CIDR)',
      url: 'https://www.cidrdb.org/cidr2013/Papers/CIDR13_Paper111.pdf',
      note: 'The companion paper, by overlapping authors, and where this model actually leads — Chapter 24. It takes the multi-dimensional timestamp seriously enough to compute on *differences* rather than values, so a changed input updates the answer instead of recomputing it. Read the two together and this chapter stops looking like an engine paper and starts looking like the foundation being laid.',
    },
    {
      year: '2015',
      title: 'Lightweight Asynchronous Snapshots for Distributed Dataflows — Carbone, Fóra, Ewen, Haridi, Tzoumas',
      url: 'https://arxiv.org/abs/1506.08603',
      note: 'Chapter 23, and the direct answer to this chapter’s worst bill. Naiad stops every worker to take a consistent checkpoint; this shows how to get one without stopping anything, by pushing markers through the dataflow — which is Chapter 7’s Chandy–Lamport algorithm, finally being used for the thing it was invented for.',
    },
    {
      year: '2017',
      title: 'Timely Dataflow in Rust — Frank McSherry',
      url: 'https://github.com/TimelyDataflow/timely-dataflow',
      note: 'Not a paper: the model, rewritten by one of its authors in a language that was not going to fight it, and still maintained. Worth an hour if the abstraction interested you at all — the examples make the two-callback vertex interface concrete in a way the paper’s pseudocode does not, and it is the thing Differential Dataflow is actually built on.',
    },
  ],
  seenIn: [
    { label: 'The Cost of Starting Over — Ch 18', to: '/papers/spark', live: true },
    { label: 'What “Before” Even Means — Ch 7', to: '/papers/lamport', live: true },
    { label: 'MapReduce: the Pattern, Not the Product — Ch 2', to: '/papers/mapreduce', live: true },
    { label: 'Stream–table duality — the comic', to: '/ddia/read/stream-table', live: true },
  ],
  finale: {
    title: 'A dial nobody had drawn before',
    body: 'The engine that could not exist turned out to be blocked by a data type. Give a timestamp a second dimension and batch and streaming stop being separate worlds — not because anybody was clever about scheduling, but because a scalar could never say which round of which batch a message belonged to, and every barrier in every batch engine was paying for that gap. What the chapter leaves behind is smaller and more useful than the engine: the first honest measurement of what freshness costs. Five hundred milliseconds for the newest answer, ten for one that is a second old, same query and same guarantee. Everything after this is somebody choosing a point on that dial — and the next chapter chooses one deliberately, gives up the loop, and argues that almost nobody should have to write a vertex at all.',
  },
  next: { title: 'The Same Query, Twice a Second', slug: 'structured-streaming' },
}
