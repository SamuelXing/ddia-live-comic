import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { WorkPerIterationDiagram, VersionLatticeDiagram, KeptNotConsolidatedDiagram } from '../diagrams'
import { differentialTrace } from './differential-trace'

/* The act opener, and the paper this book has been circling for two acts
   without saying so. It is twelve pages, it is a CIDR paper rather than a
   full systems paper, and its prototype is the system Chapter 19 already
   covered — which is the structural joke worth landing rather than hiding:
   Naiad appears twice in this season because timely dataflow is the engine
   and differential computation is what somebody wanted the engine for.

   The chapter's spine is one question and it is not "how does this work". It
   is: why can no earlier system update an iterative computation? The answer
   is a property of total orders, it takes three sentences, and once a reader
   has it the rest of the paper is consequences. So the DesignIt spends its
   first decision entirely on that and its second on the memory bill.

   Deliberately NOT covered: the operator update pseudocode in §3.4, which is
   genuinely hard and whose difficulty is the honest reason this technique
   took a decade to reach anybody. It gets named in the price step and left
   there. A chapter that walks Algorithm 1 line by line teaches a reader to
   implement something they will not implement. */

export const differential: Chapter = {
  slug: 'differential',
  act: 'Act III · The Answer That Maintains Itself',
  paperNo: 'Paper 24',
  title: 'Change as the Unit of Work',
  dek: 'Every chapter so far has re-run a query — over a smaller batch, a window, a pane, but re-run. This one asks what a system would look like if the change itself were the thing being computed, and finds that the obstacle is not engineering. It is that time was a line.',
  minutes: 16,
  paper: {
    title: 'Differential dataflow',
    authors: 'Frank McSherry, Derek G. Murray, Rebecca Isaacs, Michael Isard',
    venue: 'CIDR (Microsoft Research, Silicon Valley)',
    year: '2013',
    url: 'https://www.cidrdb.org/cidr2013/Papers/CIDR13_Paper111.pdf',
  },
  caption:
    'Ten thousand people open the same dashboard and the same query runs ten thousand times over data that moved by one per cent. Act II got the delay down to seconds and taught the answers to cope with records that show up in the wrong order, and every chapter of it did the same underlying thing: **took a query and ran it again**, on a smaller input. This act asks the question nobody in the book has asked yet — why is an answer computed at all, rather than maintained? The obvious reply is that this is what a cache is for, and Chapter 12 already showed where that ends: the cache is easy and the invalidation is somebody’s whole job. So the alternative is to make the *change* the thing you compute with. It works immediately for simple queries, it has worked since the eighties, and it falls apart the moment the query contains a loop — which is most of the analysis anybody actually wants. **This paper is twelve pages about why**, and the obstacle turns out not to be a missing mechanism.',
  steps: [
    {
      n: 'Step 01',
      title: 'The graph moved by one edge, so why did everything run again',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'Take a concrete job: the connected components of the graph formed by @mentions on Twitter over the last twenty-four hours, kept current as tweets arrive. Each node starts labelled with its own id, then repeatedly takes the smallest label in its neighbourhood; run that to a fixed point and every node carries the smallest id in its component. It is a join, a union and a minimum, in a loop.',
        'There are four ways to execute it and the gaps between them are not small. **Recompute everything each iteration** — which is what Chapter 2’s engine and Chapter 18’s engine both do, because nothing survives between rounds — and the work per iteration is a flat line. **Keep the labels between iterations** and pass only what changed, and the work decays exponentially once labels start settling; total work drops to under half. **Introduce the labels in order**, smallest first, so a large label meets a small one immediately and stops travelling, and you are down to about a tenth of that again — *roughly 4% of the from-scratch version.*',
        'All three of those are ways of running the loop faster. Now change the input. One edge is deleted, because the window slid by a second and a tweet fell out the back. **Every one of those three has to start over.** Not because they are badly written; because a label was propagated across an edge that no longer exists, and undoing that may promote a different label at a node three hops away, and none of them kept the information needed to work out which.',
        'That is the constraint, and it is worth stating in the general form. **A system can be incremental in its input, or it can iterate, and until this paper nobody could do both.** Databases had incremental view maintenance for thirty years and it stopped at recursion. Iterative engines had loops and started from scratch whenever the input moved. The two capabilities everybody wanted together were, for a reason nobody had named, mutually exclusive.',
      ],
      diagram: <WorkPerIterationDiagram />,
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'One of these is the paper and the other is the bill it runs up. Take your time over the first: its wrong answers are not merely worse than the right one, they are *impossible*, and seeing why takes a minute.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**What you are computing:** a loop. A body function applied over and over to a collection until it stops changing — connected components, reachability, shortest paths, anything recursive.',
              '**What keeps happening:** the input changes underneath you. A window slides, an edge is added, an edge is *removed*. Removal is not a detail: it is what breaks everything that already exists.',
              '**What you have already:** the incremental trick. Keep the previous value, apply a difference to it, produce a difference out. It works, it is decades old, and it is why the loop is cheap after the eighth iteration.',
              '**What you want:** to spend work proportional to how much actually changed, and to have that hold when the change is to the input *and* the computation is a loop, at the same time.',
              '**What you must not do:** ask the user to write the incremental version of their own loop body. That has been tried; it is where every earlier system put the difficulty, and it is why nobody used them.',
            ],
            questions: [
              {
                q: 'Your collection changes for two unrelated reasons — a new round of input arrived, and the loop went round again. You already have a difference for each. How do you keep track of which version is which?',
                options: [
                  {
                    label: 'Label each version with a pair — (round, iteration) — and accept that pairs are only partially ordered',
                    verdict: 'move',
                    why: 'This is the paper, and it is one sentence long. Version (0,1) is iteration 1 of the old input; (1,0) is iteration 0 of the new one. **Neither comes before the other**, and that is not a gap in the design, it is the whole design. Because neither precedes the other, neither has to subtract the other’s work out — so the correction at (1,1) can be taken with respect to *both* at once, and it is often empty. Notice what has actually been generalised: incremental computation always assumed versions form a sequence, and nobody wrote that assumption down because a sequence is what time looks like. **Chapter 7 made exactly this move**, twenty-five chapters ago, for exactly this reason — events on separate machines are not on a line either, and pretending they are throws away the fact that they were independent.',
                  },
                  {
                    label: 'Use one counter and increment it on every change, whatever caused it',
                    verdict: 'dead',
                    why: 'The natural answer, and the one every incremental system already made. A total order means version 5 has exactly one predecessor, version 4, so a difference must be taken against whatever happened to come last. If the last thing was “the loop went round”, the correction for “new input arrived” has to unpick the loop’s work before it can do its own — despite the two having nothing to do with each other. **You cannot use differences for iteration and for input updates simultaneously**, and the reason is not implementation difficulty. It is that a line has one direction and there are two things going on. Every system in the related-work section has this shape, which is why the paper’s contribution can be stated as a change of index type.',
                  },
                  {
                    label: 'Run a separate copy of the loop per round of input, and diff the answers',
                    verdict: 'dead',
                    why: 'Correct, and it is the thing being replaced. Each copy pays full price for its own iteration, so the cost is the number of rounds times the cost of the whole computation, and “incremental” has become a word describing the output rather than the work. It also loses the one property that makes this worth doing: *the second loop cannot reuse the first loop’s conclusions*, even though for most nodes the answer did not move at all. If you are going to run the loop again, there was never anything to discuss.',
                  },
                  {
                    label: 'Keep a dependency record for each derived row — every input row it came from — and invalidate transitively',
                    verdict: 'dead',
                    why: 'This is a real algorithm and it is in the related work by name. It is correct and its cost is the problem: storing, with every derived fact, the full set of facts used to derive it, which for a graph computation is a large fraction of the graph, per node, per iteration. The alternative in that family over-estimates instead — it invalidates a superset, does a great deal of work undoing things, and in the worst case concludes that starting from scratch would have been faster. **Both are paying to reconstruct a relationship the loop already knew and threw away**, which is a hint that the fix belongs in how versions are indexed rather than in extra bookkeeping on top.',
                  },
                ],
              },
              {
                q: 'You have computed a difference and folded it into the collection. What do you do with the difference itself?',
                options: [
                  {
                    label: 'Keep it, in an index keyed by version — never fold it away',
                    verdict: 'move',
                    why: 'The second half, and it is what makes the first half usable. If differences are consolidated into a current value and dropped, then there is only one starting point available and the partial order has nothing to be partial about. Keeping them means any version can be assembled from *whichever subset of differences actually precedes it* — which is precisely what "no total order" was supposed to buy. The number people expect to be terrible: on a full day of the Twitter mention graph, the entire retained index came to **1.5% more than the set of labels alone**, which is the state an ordinary incremental system keeps anyway. That is the sentence that turns this from an elegant idea into something you could deploy, and it is why it is in the motivation section rather than the evaluation.',
                  },
                  {
                    label: 'Fold it into the current collection and discard it, like every incremental system does',
                    verdict: 'dead',
                    why: 'Then the pair-of-integers version is decoration. The point of saying (0,1) and (1,0) are unordered was that a later version could start from either — but if both have been folded into one running value, there is exactly one thing to start from and you are back to a sequence with extra syntax. **The two halves of this design are not independent choices**; the partial order is what makes keeping the differences worthwhile, and keeping the differences is what makes the partial order mean anything.',
                  },
                  {
                    label: 'Keep them, but write them to disk — memory is the scarce thing',
                    verdict: 'dead',
                    why: 'The access pattern kills it. These are not scanned in bulk; an operator reaches for a handful of differences for one key at one version, thousands of times a second, and the whole promise is a response in tens of milliseconds. The prototype keeps its indexes **deserialized in memory** specifically so that a small update can be reacted to in microseconds, and calls that out as a break from how big-data systems were built — those assume there is always plenty of work to amortise a fetch over. *Once you have removed almost all the work, the overheads you never noticed are the system.*',
                  },
                  {
                    label: 'Keep only the last few versions and recompute anything older on demand',
                    verdict: 'dead',
                    why: 'Sensible-sounding, and it aims at the wrong axis. The differences you need are not the *recent* ones — they are the ones that precede the version being computed in the partial order, which for the iteration axis means early iterations that have long stopped changing. Evicting by recency evicts exactly the stable, cheap, frequently-reused parts. There **is** a real answer in this neighbourhood and the paper names it: once no further updates can arrive for versions before some point, everything up to it can be consolidated into the equivalent of a checkpoint. Note the condition — it is about what can still arrive, not about age.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived differential computation — and why it had to wait for someone to notice a line',
              body: [
                '**The model, in full.** Collections are versioned by elements of a partial order rather than a sequence. Each difference is retained, indexed by key then version then row, instead of being consolidated into a current value. A version’s collection is the sum of every difference at or below it in the order, so a new difference is taken with respect to *all* of its predecessors together — and when several are unordered with each other, none of them has to subtract out the others’ work. Nest a loop inside a loop and you get a four-dimensional order; the user writes neither the pairs nor the arithmetic.',
                '**Why this is a generalisation and not an alternative.** Take the partial order to be the integers and you have ordinary incremental computation, exactly. Take it to be the product of input-round and loop-iteration and you have incremental iteration, which nobody had. Take the lexicographic order on (priority, iteration) and you get prioritised evaluation — introduce the smallest labels first so the big ones die on contact — for free, from the same machinery. Compose those and you have all three at once. **The user picks a query; the system picks the order.**',
                '**And the honest cost, which is not memory.** The update rule for a general operator is genuinely hairy: a new difference at version τ can force output differences at versions *after* τ that had no input difference at all, and the operator has to work out which. There is pseudocode, it reconstructs collections at multiple versions, and in the worst case it rebuilds the whole thing and calls the user’s function on it. Most useful operators avoid that — a join distributes, a count only needs the running weight — but *this is the part that made the idea hard to build*, and it is why a paper from 2013 took another decade to turn up in products.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'One edge disappears, and almost nothing happens',
      accent: 'denim',
      rung: 'Rung 3 · The reveal',
      span: 2,
      body: [
        'The loop, with the input changing under it. Step 3 is the case every earlier system fails, step 4 is the pair of integers, and step 6 is the one worth waiting for: iterations that do no work at all, and a system with no convergence test in it anywhere.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={differentialTrace} />
        </div>
      ),
      think: {
        q: 'Why does a total order on versions actually prevent incremental iteration? Not “make it slow” — prevent it.',
        a: '**Because a difference is defined relative to a predecessor, and a total order lets a version have exactly one.** Work through it concretely. Your collection has a value after round 0 of input, iteration 1 of the loop; call it A. It has another value after round 1 of input, iteration 0; call it B. Now you need the value after round 1, iteration 1 — the corner. In a total order you had to decide, when they were produced, whether A came before B or B came before A. Say A came first. Then B’s difference was already defined as "what changed relative to A", so it silently contains the *undoing* of one iteration of the loop as well as the effect of the new input, mashed together, with no way to separate them. And the corner’s difference must be taken against B, which means it starts from a value that has an iteration of loop work baked in that it did not want. Every difference in the system is contaminated by whichever unrelated thing happened to be sequenced before it. **The information that two changes were independent existed and the index destroyed it.** Under the product order neither A nor B precedes the other, so B’s difference is purely the input change, A’s is purely the iteration, and the corner is the small correction that reconciles them both — often literally zero, which is why several iterations in the paper’s own figure do nothing. Now the part worth carrying away, because it is not about streaming. *The choice of index type is a modelling decision that decides what your system can express, and a sequence is the default nobody examines* — it is what a log is, what a version number is, what a timestamp is, and it is right up until two things are genuinely concurrent. **Chapter 7 is the same observation about events on separate machines**, and Chapter 5 paid for ignoring it with a merge function it had to hand back to the application. Here the price of a line is not a wrong answer; it is a whole category of computation that cannot be updated at all.',
      },
    },
    {
      n: 'Step 04',
      title: 'Two orders of magnitude, and then three more',
      rung: 'Rung 4 · The measurement',
      body: [
        'The evaluation is small — this is a CIDR paper, which is a venue for ideas rather than finished systems, and it says so. What it measures is the right thing.',
        'The connected-components job, on a twenty-four-hour window of the Twitter mention graph, using eight cores of a 48-core machine. Sliding the window by **one second** produces **67 differences** to process, which the paper notes is typical across the whole trace, and several iterations require no work at all. That is **0.003%** of the work a full prioritised re-evaluation would do. In wall-clock time the update lands in **24.4 ms**, against **7.1 s** and **36.4 s** for the from-scratch computations it is compared with.',
        'Notice that 24.4 ms is a much smaller win than 0.003% would predict, and the paper says so plainly rather than quoting the ratio it prefers. The reason is that once you have deleted almost all of the work, **the per-iteration overheads become the cost** — scheduling, dispatch, the loop machinery itself. *That is the shape of every mature optimisation*: you stop being bound by the thing you fixed, and what is left is the floor you did not know you had.',
        'The second experiment is more useful for calibration because it is a fair fight on somebody else’s benchmark. On the ClueWeb Category B web graph, on the same 16-machine cluster an earlier study used, against a parallel data warehouse, a batch dataflow engine and a specialised in-memory graph store: PageRank in **1,404 s** against 8,970 / 4,513 / 90,942. Weakly connected components in **130 s** against 4,207 / 3,844 / 1,976. Strongly connected components in **234 s** against 475 / 446 / 1,073 — and there the comparison is not like for like in the paper’s own favour, because **every other system trims the graph and then runs single-threaded**, while this one expresses the whole thing as a doubly nested fixed point and distributes it. *None of those runs uses incrementality at all.* They are batch numbers from a system built for updates, which is the honest way to report them.',
      ],
      code: {
        file: 'components.cs',
        lines: [
          { t: '// the entire program — and it is incrementally maintained' },
          { t: '// without a word in it about differences or versions' },
          { t: '' },
          { t: 'edges.Select(x => new Node(x.src, x.src))' },
          { t: '     .FixedPoint(x => LocalMin(x, edges));', hl: 'good' },
          { t: '' },
          { t: 'LocalMin(nodes, edges) =' },
          { t: '    nodes.Join(edges, n => n.src, e => e.src,' },
          { t: '               (n, e) => new Node(e.dst, n.label))' },
          { t: '         .Concat(nodes)' },
          { t: '         .Min(n => n.src, n => n.label);' },
          { t: '' },
          { t: '// nest that inside another FixedPoint and you have' },
          { t: '// strongly connected components: 58 vertices of dataflow,' },
          { t: '// a four-dimensional order, and nobody typed a coordinate' },
        ],
      },
      diagram: <VersionLatticeDiagram />,
      deeper: {
        summary: 'What actually happens when a difference arrives',
        body: [
          'Worth reading once, because it is where the difficulty lives and every summary of this paper skips it. An operator has processed some history and a new difference turns up at version τ. The obvious expectation is that it produces one output difference, also at τ. That expectation is wrong, and the way it is wrong is the reason this took work.',
          'A new difference at τ can force output differences at versions **strictly after τ that had no input difference of their own.** The intuition: version (1,3) was computed against a set of predecessors that did not include τ=(1,0) because it did not exist yet; now it does, and the reconciliation for (1,3) is no longer correct. The operator must find every version that needs fixing. The paper bounds the set — it is the least upper bounds of τ with each version that already carries a non-zero difference — which is finite and usually small, but it is not one, and it is not local.',
          'The generic implementation therefore reconstructs the input collections at each affected version, calls the user’s function twice — once with the update, once without — and subtracts. **That is the opposite of incremental**, and it is the fallback for an operator the system knows nothing about. It is made bearable by two things. Data-parallelism: the work is confined to the keys appearing in the incoming difference, which is normally a handful. And specialisation: a join distributes, so it can combine a new difference against the other side’s index directly; a count keeps only the running weight per key rather than the rows; a minimum has to keep everything, because retracting the smallest element promotes the second smallest and you have to know what that was.',
          '*The habit here outlasts the mechanism.* A model this expressive needs a correct universal implementation and a fast path for the cases people actually use — and the honest way to present one is to give the slow general rule first and then say which operators escape it. **A paper that only shows you the fast path is telling you about a special case and calling it a system.**',
        ],
      },
    },
    {
      n: 'Step 05',
      title: 'Change the index type, not the algorithm',
      rung: 'Rung 5 · The design stance',
      body: [
        'The stance is unusually clean and it is not "we made incremental computation better". It is: **find the assumption your field wrote into a data type without noticing, and relax it.** Every incremental system indexed versions with a sequence. Nobody argued for a sequence; it is simply what time looks like, so it was never a decision that could be revisited. Replacing it with a partial order left the rest of the theory intact and unlocked a capability that had been sitting behind it for thirty years.',
        'And look at what falls out of one change. Incremental computation is the special case where the order is the integers. Prioritised evaluation — introduce small labels before big ones, so the big ones stop travelling on contact — is the special case where it is lexicographic. Nested loops are the product of several. **None of those needed a new mechanism**; they needed a different order, chosen by the system, from a query in which the user wrote neither.',
        'The second half of the stance is the one that costs money and it is stated just as plainly: **retain every difference, indexed, in memory.** That is a direct inversion of how the systems in Act I were built, where the whole art was streaming through data you could not afford to keep. It is affordable here for a reason specific to the workload — differences over a converging computation are tiny compared with the collection — and the paper proves the point with a measurement rather than an argument: 1.5% over the labels themselves.',
        '*And it is candid about being early.* This is a CIDR paper: an idea, a prototype, and a claim that the idea deserves study. The evaluation is a handful of graphs, the operator implementation is admitted to be complex, and the consolidation mechanism that keeps memory bounded is mentioned and explicitly left out of scope. **The gap between this and something you could run a business on is the next two chapters**, and it is roughly ten years wide.',
      ],
      diagram: <KeptNotConsolidatedDiagram />,
    },
    {
      n: 'Step 06',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 6 · What the index costs',
      body: [
        '**Everything is resident, and that is not negotiable.** Difference traces are held deserialized in memory, indexed three deep, because the promise is a reaction in microseconds and a fetch from disk is not that. The 1.5% figure is real and it is a ratio over a *converging* computation — the differences are small precisely because the loop is settling down. Run something whose intermediate results churn instead, and the same design keeps every version of the churn.',
        '**The operator logic is hard enough to be a barrier.** A general operator must find every version its new difference could disturb, reconstruct collections at each, and evaluate the user’s function twice per version. Most common operators have a fast path and the ones that do not are the ones you were going to reach for anyway — a minimum has to keep its full input, because retracting the smallest element means promoting the runner-up. *This is the honest reason a 2013 idea took a decade to become something an engineer could use.*',
        '**The prioritised trick trades parallelism for work.** Introducing labels smallest-first is what buys the tenfold saving, and it is inherently sequential — priority p+1 cannot start until p has converged. The paper mitigates it by batching priorities logarithmically, which is a knob, and a knob is something somebody has to be right about.',
        '**And it is a model, not a product.** There is no fault tolerance story here, no elasticity, no persistence, no query language beyond an extension to a .NET one. The prototype is Chapter 19’s system, so it inherits that chapter’s recovery — stop the world — and that chapter’s costs. **What this paper contributes is a way of thinking about work**, and it is the next two chapters that ask what it takes to put it behind a web application and to stop hand-writing it.',
      ],
      callout: {
        kind: 'bad',
        big: 'KEEPS EVERY DIFFERENCE, FOREVER, IN RAM',
        text: 'The reuse comes from never consolidating. On a converging graph computation that costs 1.5% over the answer itself; on a workload whose middle keeps churning it costs whatever the churn costs, and the only relief is knowing that no more updates can arrive for old versions.',
      },
    },
    {
      n: 'Step 07',
      title: 'Where it stands in 2026',
      rung: 'Rung 7 · Descendants',
      body: [
        '**The idea outlived its prototype completely.** The system in this paper is a research artefact from a lab that no longer exists. Differential dataflow was rewritten in Rust by its first author as a library on top of timely dataflow, and that library is the engine underneath **Materialize**, a commercial streaming database that takes ordinary SQL views and maintains them — which is the shape this paper predicted and did not build.',
        '**And the next two chapters are both arguments with it.** Chapter 25 benchmarks against it directly, wins above four machines, and the reason it wins is instructive: this design tracks progress by coordinating between workers so that a version’s output can be exposed atomically, and that coordination gets more expensive as the cluster grows. **The partial order that makes the model powerful is a thing the runtime has to agree about.** Chapter 26 takes the other complaint — that using this well means assembling an incremental computation by hand out of incremental operators — and asks whether the incremental version could be derived from the ordinary one by a compiler.',
        '**The unfinished business is stated in the paper and is still live.** It ends by saying the technique deserves further study and could enhance other forms of incremental computation, which is the sort of closing sentence that usually means nothing. Here it turned out to be an accurate prediction of the next ten years, and Chapter 26’s authors include this one’s first author.',
        '*What this chapter changes about the rest of the book.* Every system before Act III answers a read by computing something. From here the question is which of your answers should be **standing** — already computed, updated by writes, read with a lookup — and the interesting engineering is no longer how fast a query runs. It is how much of your data a maintained answer costs to keep, who is allowed to read it while it is being maintained, and what happens to the answers nobody asked for. **The next chapter is what happens when you point this at a web application and discover the state does not fit.**',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Difference.',
      body: 'What changed, as a first-class value with its own version. Rows can carry a negative count, so a removal is an ordinary difference and not a special case.',
    },
    {
      term: 'Partial order.',
      body: 'An ordering where two things may simply be unrelated. Versions here are tuples — round of input, iteration of the loop — and unrelated is the useful case.',
    },
    {
      term: 'Difference trace.',
      body: 'Every difference an operator has ever seen, kept and indexed by key, version and row. What lets a version be assembled from exactly the predecessors that matter to it.',
    },
    {
      term: 'Fixed point.',
      body: 'Run the loop body until nothing changes. Here there is no convergence test: no differences means converged, because a loop with nothing to say produces nothing.',
    },
    {
      term: 'Prioritised iteration.',
      body: 'Introducing records into the loop in an order chosen to reduce work — small labels first, so large ones die on contact. A lexicographic order, and nothing else.',
    },
  ],
  inTheWild: {
    note: '4 things this changes about how you think',
    points: [
      '**Most "incremental" systems are incremental in one axis only.** The question to ask a tool is not whether it updates incrementally, but whether it does so while the computation iterates. Almost none do, and the ones that do not will quietly re-run everything when your input moves.',
      '**A deletion is the test case.** Additions are easy and every system handles them; retracting something already propagated is where designs separate. If a demo only ever inserts, the hard half has not been shown to you.',
      '**Memory is proportional to churn, not to data.** The comforting 1.5% comes from a computation that converges. Anything whose intermediate results keep moving keeps every version of that movement, and there is no eviction policy that helps, because the useful differences are the old stable ones.',
      '**"No convergence test" is a real property, not a slogan.** Progress is the absence of outstanding differences, so an iteration with nothing to do costs nothing and the system stops when it is done. Every engine that polls for a fixed point pays for the check even when the answer has not moved.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Index by a partial order when two things change independently',
        when: 'you find yourself sequencing events that have nothing to do with each other. A total order is the default nobody examines, and it silently forces every change to be defined relative to whatever happened to come before it.',
      },
      {
        choose: 'Keep the deltas rather than fold them in',
        when: 'later work might want a different starting point than the latest one. Folding is cheaper right up to the moment somebody needs the ingredients back, and then it is impossible rather than expensive.',
      },
      {
        choose: 'Generalise the index type, not the algorithm',
        when: 'a capability seems to require a new mechanism. Ask which type in your model is carrying an unexamined assumption — a sequence, a single timestamp, a boolean — and what becomes expressible if you widen it.',
      },
      {
        choose: 'Report the ratio and the wall clock',
        when: 'an optimisation is enormous. Removing 99.997% of the work bought a 300× speedup, not a 30,000× one, because the overheads became the cost — and a paper that only quotes the first number is describing a benchmark rather than a system.',
      },
    ],
  },
  misconception: {
    think: '“Differential dataflow is incremental view maintenance with better engineering.”',
    actually:
      'It is a **different index type**, and everything else follows. Incremental view maintenance has existed since the eighties and is genuinely good at what it does; the reason it stops at recursive queries is not that nobody optimised it hard enough. It is that incremental computation models versions as a *sequence*, and a sequence gives every version exactly one predecessor — so a difference must be defined relative to whatever happened to come last. When two unrelated things are changing your collection, the loop going round and the input moving underneath, one of them gets sequenced first and every subsequent difference silently contains the job of unpicking it. The information that the two were independent existed, and the index destroyed it. Replace the sequence with a partial order and version (0,1) and (1,0) are simply unrelated: neither has to subtract out the other, the correction at the corner is small and frequently empty, and *the same machinery now expresses incremental, prioritised and nested-iterative evaluation as three choices of order rather than three systems.* The measurement that makes it real is not the speedup — it is that retaining every difference cost 1.5% more than the answer alone. **The contribution is one relaxed assumption**, which is why the paper is twelve pages long and why nothing before it could do this at any price.',
  },
  sources: [
    {
      year: '2013',
      title: 'Differential dataflow — McSherry, Murray, Isaacs, Isard (CIDR)',
      url: 'https://www.cidrdb.org/cidr2013/Papers/CIDR13_Paper111.pdf',
      note: 'Twelve pages, and **§2 is the one to read** — four lines on a chart and the argument is made before any mechanism appears. Then **§3.2**, which is two paragraphs and contains the entire idea. Skip §3.4 on a first pass and come back to it when you want to know why this was hard; it is where the difficulty actually lives, and reading it early makes a simple idea look complicated.',
    },
    {
      year: '2013',
      title: 'Naiad: A Timely Dataflow System — Murray, McSherry, Isaacs, Isard, Barham, Abadi (SOSP)',
      url: 'https://dl.acm.org/doi/10.1145/2517349.2522738',
      note: 'Chapter 19, and the same system from the other end — this paper is the model, that one is the engine that runs it. Read them as a pair and the season’s structure becomes visible: timely dataflow was built to make this possible, and the book met it first as an answer to a completely different question.',
    },
    {
      year: '2015',
      title: 'Differential Dataflow in Rust — Frank McSherry',
      url: 'https://github.com/TimelyDataflow/differential-dataflow',
      note: 'What the idea grew into, by its first author, and the thing you would actually use. The repository’s own documentation is unusually good at explaining *why* rather than how, and the accompanying blog posts are the best available writing on where incremental computation costs you.',
    },
    {
      year: '1993',
      title: 'Maintaining Views Incrementally — Gupta, Mumick, Subrahmanian (SIGMOD)',
      url: 'https://dl.acm.org/doi/10.1145/170035.170066',
      note: 'The classical result this generalises, and the DRed algorithm the related work names. Worth an hour precisely because it is good: read how carefully it handles deletion and you understand why deletion in a recursive query was considered the hard problem, and what the partial order removes.',
    },
    {
      year: '2011',
      title: 'PrIter: A Distributed Framework for Prioritized Iterative Computations — Zhang, Gao, Gao, Wang (SOCC)',
      url: 'https://dl.acm.org/doi/10.1145/2038916.2038929',
      note: 'Where the prioritisation idea comes from, as its own system with its own machinery. Read it beside §3.3 of the paper above to watch a whole framework become a choice of ordering — which is the clearest possible demonstration of what the generalisation is worth.',
    },
  ],
  seenIn: [
    { label: 'One Engine, Both Shapes — Ch 19', to: '/papers/naiad', live: true },
    { label: 'What “Before” Even Means — Ch 7', to: '/papers/lamport', live: true },
    { label: 'The Cost of Starting Over — Ch 18', to: '/papers/spark', live: true },
    { label: 'The Most Common Derived Copy — Ch 12', to: '/papers/memcache', live: true },
  ],
  finale: {
    title: 'A line was the assumption',
    body: 'Incremental computation is decades old and stops at loops, and the reason is not that it needed better engineering. Versions were modelled as a sequence, a sequence gives each version exactly one predecessor, and so a difference always had to be defined relative to whatever happened to come last — which meant that when the input changed and the loop turned, one of them was sequenced first and every later difference carried the job of unpicking it. Index versions with a partial order instead and the two stop interfering: neither precedes the other, so neither has to subtract the other out, and the reconciliation is small or empty. Keep every difference rather than folding it away, because otherwise there is only ever one place to start from. On a day of Twitter mentions that costs 1.5% more memory than the answer, and one further second of tweets updates the component structure of the whole graph with sixty-seven differences in twenty-four milliseconds. What it does not do is survive a machine dying, fit behind a web application, or spare you from assembling the computation by hand — which is the rest of this act.',
  },
  next: { title: 'The Read Path as a Graph', slug: 'noria' },
}
