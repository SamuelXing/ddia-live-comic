import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { MergeChoiceDiagram, SemilatticeDiagram, AddWinsDiagram, NotSequentialDiagram } from '../diagrams'
import { crdtTrace } from './crdt-trace'

/* The act opener, and the most direct callback in the book: this paper cites
   the Amazon shopping cart by name as the thing an ad-hoc approach does to
   you, which is Chapter 5's own failure mode quoted back at it seventeen
   chapters later. The chapter should lean on that hard rather than treat
   CRDTs as a fresh subject.

   The spine is the merge function, not the algebra. Chapter 5 handed the
   question to the application; this answers it by making convergence a
   property of the type. So the DesignIt spends decision 1 on WHERE the
   decision lives and decision 2 on the shape that forces it — and decision 3
   on the thing most summaries skip, which is that convergence and semantics
   are separate problems and only one of them is solved here.

   Deliberately NOT covered in depth: the directed-graph CRDT of §5, which is
   the paper's largest worked example. It is good and it is a design study
   rather than an idea, and the chapter already has a worked example in the
   set. It gets a Go-deeper, because the arc/vertex race is the clearest
   demonstration anywhere that invariants ACROSS objects are the thing this
   whole approach cannot give you. */

export const crdt: Chapter = {
  slug: 'crdt',
  act: 'Act IV · Everybody’s Copy Is Live',
  paperNo: 'Paper 27',
  title: 'Who Writes the Merge Function',
  dek: 'Chapter 5 built a store that never refuses a write, discovered that two copies of a cart could disagree, and handed the reconciliation to the application. This is that question answered — by making the data type such that there is nothing left to reconcile.',
  minutes: 16,
  paper: {
    title: 'Conflict-free Replicated Data Types',
    authors: 'Marc Shapiro, Nuno Preguiça, Carlos Baquero, Marek Zawirski',
    venue: 'SSS (INRIA · Nova Lisboa · Minho · UPMC · LIP6)',
    year: '2011',
    url: 'https://www.lip6.fr/Marc.Shapiro/papers/2011/CRDTs_SSS-2011.pdf',
  },
  caption:
    'Two people edit the same document on a train with no signal, and nothing in this book so far can help. There is no quorum to reach and no leader to ask, and — the part that rules out everything in Act III of Season 1 — **the writes have already happened.** They are committed on the devices that made them, by people who have gone back to typing. This is not a new problem. Chapter 5 met it in 2007, built a store that would accept a write during any failure, and found that the price was two versions of the same shopping cart with no way to say which was right. Its answer was to hand both to the application and let it decide. That answer is why deleted items came back into carts, and *this paper cites that failure by name* as what ad-hoc reconciliation does to you. The question it asks is not how to merge better. **It is whether the merge has to be anybody’s decision at all.**',
  steps: [
    {
      n: 'Step 01',
      title: 'The question Chapter 5 asked and gave back',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'Recall exactly where that chapter left things. A write goes to whichever replicas are reachable. A partition heals. Now two replicas hold different values for the same key, each perfectly legitimate, neither newer in any meaningful sense — because "newer" across machines is the thing Chapter 7 spent a paper showing does not exist. The store cannot pick, so it returns both, and **the application writes a merge function.**',
        'For a shopping cart the obvious merge is to union the two carts, which is why the anomaly is the one everybody remembers: an item you deleted comes back, because a replica that never saw the deletion still has the item and union keeps everything. That is not a bug in the union; the union is doing exactly what it was told. **The bug is that a merge function was a thing somebody had to invent, per data type, under time pressure, and be right about.**',
        'Two more properties make it worse than it looks. The merge has to be correct for *every* pair of states that can ever arise, which is a much larger set than anybody tests. And when it is wrong the failure is silent — the replicas agree on a value that nobody meant, and there is no divergence to detect because they converged perfectly well on the wrong thing.',
        'So the constraint. **You want a replica to accept writes with no coordination whatsoever, and you want the copies to end up the same, and you do not want a human to have written the rule that makes them the same.** The first two together are why the third is hard: with no coordination, updates arrive in different orders at different replicas, some more than once, and the rule has to be indifferent to all of it.',
      ],
      diagram: <MergeChoiceDiagram />,
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'Locate the problem, then find the shape that dissolves it. What is left after that is the question separating people who have used these from people who have read about them.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**What you must not do:** coordinate. No quorum, no leader, no round trip before an update takes effect. An update completes locally, immediately, always.',
              '**What the network may do:** anything short of never recovering. Drop messages, duplicate them, reorder them, partition for an hour. Assume it eventually delivers, and assume nothing else.',
              '**How bad failure gets:** up to every replica but one is crashed, permanently. The survivor must still accept writes and still be correct.',
              '**What convergence has to mean:** replicas that have seen the same updates hold the same value. Not "agree after somebody arbitrates" — the arbitration is what you are removing.',
              '**And the thing you are trying to delete:** the application-supplied merge function. If your answer still has one, you have moved the problem rather than solved it.',
            ],
            questions: [
              {
                q: 'Two replicas have diverged. Something has to decide what the reconciled value is. Where do you put that decision?',
                options: [
                  {
                    label: 'In the data type, chosen once when the type is designed — so that no reconciliation is possible after the fact',
                    verdict: 'move',
                    why: 'The move is that **the decision moves from run time to design time, and from the application to the type.** Instead of "here are two states, work out what they mean together", the type is built so that only one merged value is expressible. Notice the second-order effect, which is what makes it worth a paper: once merge cannot go wrong, the *channel* stops mattering. Ordering, duplication and batching are all incapable of affecting the result, so the enormous machinery for making delivery well-behaved — which is most of what Act III of Season 1 is about — has nothing left to protect. **The correctness argument is discharged by the shape of the data rather than by the behaviour of the network**, and that is a much better place to keep it.',
                  },
                  {
                    label: 'In the application, but with a good library of merge helpers to make it less error-prone',
                    verdict: 'dead',
                    why: 'This is Chapter 5 with better documentation, and it fails in the same place. The problem was never that merge functions are hard to *write*; the union for a shopping cart is one line. The problem is that a merge function must be correct for every pair of states reachable by any interleaving of any updates, which is a set nobody enumerates and no test suite covers. **A helper makes the common case easier and leaves the case that bites you exactly where it was.** And the failure stays silent, because the replicas still converge — on a value nobody meant.',
                  },
                  {
                    label: 'Detect the conflict, roll back the losing update, and re-apply it on top of the winner',
                    verdict: 'dead',
                    why: 'Real systems do this and the paper names it as waste. Two costs, and the second is fatal here. You executed work and threw it away — the update "took effect" and then un-took-effect, which any user who saw it will remember. And **deciding consistently who lost requires consensus**, so you have reintroduced the coordination this design exists to avoid, at the worst possible moment: during recovery from the partition that caused the conflict. *An approach whose failure path needs agreement is not available to a system whose whole premise is not agreeing.*',
                  },
                  {
                    label: 'Timestamp everything and let the last write win',
                    verdict: 'dead',
                    why: 'Genuinely convergent, genuinely used, and worth knowing precisely why it is a different answer rather than a wrong one. It converges because a total order on timestamps makes the outcome a function of the data — that much is fine, and the technique dates to 1976. What it costs is stated plainly in the paper: **it loses concurrent updates.** Two people typed; one of them is gone, and nothing anywhere records that there was a second edit. That is the correct answer for a register whose value is genuinely one thing, and it is silent data loss for a set, a counter, or a document. *It is a data type, not a strategy* — which is exactly the reframing the accepted answer is asking for.',
                  },
                ],
              },
              {
                q: 'You are designing a type whose merge cannot go wrong. What property would give you that?',
                options: [
                  {
                    label: 'Make the states a partial order in which any two have a least upper bound, and define merge as that bound',
                    verdict: 'move',
                    why: 'A least upper bound is **commutative, idempotent and associative** — and those three are not a wish list, they follow from the definition of "smallest thing above both". Which means: order of arrival cannot matter, a message arriving twice cannot matter, and how messages are grouped cannot matter. Add one more condition — that an update only ever moves the state *up* the order, never down — and convergence is a theorem rather than a hope. There is a second, equivalent formulation for when shipping whole states is too expensive: send the operations instead and require that **concurrent operations commute**, with the channel delivering in causal order. The paper proves the two are interchangeable, each able to emulate the other, which is the sort of result that tells you the concept is real and the two styles are implementation choices.',
                  },
                  {
                    label: 'Make every operation idempotent, so duplicates are harmless',
                    verdict: 'dead',
                    why: 'Necessary and not sufficient, and it is the half most people stop at. Idempotence handles the message that arrives twice; it says nothing about the two messages that arrive in different orders at different replicas. Both properties are needed and they are independent — which is exactly why "make it idempotent" is such a common piece of distributed-systems advice and such a common source of systems that still diverge. **The lattice gives you both at once**, because it does not add rules to operations; it constrains what states can exist.',
                  },
                  {
                    label: 'Attach a vector clock to every value and merge by dominance',
                    verdict: 'dead',
                    why: 'This is Chapter 5’s machinery, and it is worth seeing exactly how far it gets. Vector clocks tell you *whether* two versions are concurrent, which is real and useful information, and it is where they stop — when the answer is "concurrent", you are back to a human deciding what that means. The paper notes the lovely detail that a vector clock **is itself one of these types**: a vector of counters, ordered pointwise, merged by taking the maximum per entry. So the tool Chapter 5 used to *detect* the problem turns out to be the smallest example of the thing that *dissolves* it.',
                  },
                  {
                    label: 'Keep a totally-ordered log of every operation and have every replica replay it',
                    verdict: 'dead',
                    why: 'Correct, and it is Chapter 13 — and agreeing on one order is precisely consensus, which is unavailable to a replica alone in a tunnel. There is a real and subtler point underneath. A total order does not merely cost coordination; it **destroys the information that two updates were concurrent**, which for a set or a document is information the answer depends on. This is Chapter 24’s argument in a different costume: a line is the wrong index when two things genuinely did not happen in an order.',
                  },
                ],
              },
              {
                q: 'One replica adds an element while another concurrently removes the same element. Your type converges. What does it converge to?',
                options: [
                  {
                    label: 'Whatever you decided when you designed the type — and the maths does not decide it for you',
                    verdict: 'move',
                    why: 'This is the honest half and it is the thing most summaries of this paper leave out. Add-wins converges. Remove-wins converges. Highest-identifier-wins converges. Resetting to a marker value converges. **All four satisfy the theorem**, and picking among them is a semantic decision about what the data means, made by a person. So what actually changed? The decision moved from *every collision, in application code, at run time* to *once, when the type was designed* — where it can be stated, documented, tested and reasoned about. That is a large improvement and it is not the elimination of judgement. Note also what the choice implies mechanically: add-wins needs the remove to carry which instances it saw, so the type is storing **more than its value** to make the semantics come out, which is where the next step’s bill comes from.',
                  },
                  {
                    label: 'To the removal — a delete should be final, that is what delete means',
                    verdict: 'dead',
                    why: 'A defensible choice and not a derivable one, which is the whole point. Consider what it does: an element added *after* a concurrent removal stays deleted forever, because the removal outranks additions it never saw. For a to-do list that is somebody’s new task silently vanishing. The opposite convention has the mirror-image flaw — an item you deleted comes back, which is Chapter 5’s anomaly returning under better management. **Neither is right in general, and a framework that picks one for you silently has made a product decision on your behalf.**',
                  },
                  {
                    label: 'To an error, so the application can resolve it properly',
                    verdict: 'dead',
                    why: 'This is the reflex, and it puts you back at the start of the chapter. "Ask the application" is Chapter 5, and it fails here for an extra reason: the merge may be happening on a device whose user is asleep, in the background, hours after both edits, with nobody to ask and no meaningful way to ask them. **Deferring a decision is only possible when somebody is available to make it later**, and the premise of this whole act is that nobody is.',
                  },
                  {
                    label: 'It does not matter — concurrent add and remove of the same element is a rare edge case',
                    verdict: 'dead',
                    why: 'It is rare and it is also the *only* case where a choice exists, which makes it the entire semantic content of the type. Concurrent updates to different elements merge with no ambiguity at all; every decision anybody makes in this design space is about this one situation. **The rare case is not the edge of the design, it is the design** — and a rare event over a large user base is a Tuesday.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived CRDTs — and the guarantee is stronger than the one it replaces',
              body: [
                '**The definitions.** Strong eventual consistency is ordinary eventual consistency plus one clause: correct replicas that have delivered the same updates *have* equivalent state. Not "eventually reach" — have. That single word is the difference between a promise about the future and a property of the present, and it is what removes arbitration, rollback and the window in which two replicas are visibly wrong about each other.',
                '**The two sufficient conditions, and their equivalence.** State-based: the payload values form a join semilattice, merge computes the least upper bound, and updates only move state upward. Operation-based: concurrent operations commute, and the channel delivers in causal order — which is a standard facility that does *not* require consensus. Either gives strong eventual consistency, and the paper proves each can emulate the other, so the choice between them is about whether shipping states or shipping operations is cheaper for your data.',
                '**What this buys that consensus cannot.** A replica remains available for reads and writes regardless of network conditions, and the guarantee survives **n−1 simultaneous crashes** — every replica but one, permanently. No protocol in Act III of Season 1 survives that; a majority-based system stops at half. And it is reached **without solving consensus at all**, which is the sentence to sit with, because the previous seventeen chapters treat agreement as the thing you must eventually pay for.',
                '**And what it does not buy.** Convergence, not correctness — you get agreement on a value, and whether that value is the one anybody wanted is a design decision the theorem is silent about. No invariants that span objects: a rule like "this arc’s endpoints must both exist" cannot be maintained, because the two replicas that would violate it never speak before doing so. *Everything the rest of this chapter costs follows from those two sentences.*',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'A tunnel, two edits, and no negotiation',
      accent: 'denim',
      rung: 'Rung 3 · The reveal',
      span: 2,
      body: [
        'Watch for the symmetry: there is no master side of this picture and no arrow that only points one way, which is the first time that has been true in this book. Step 4 is why the channel is allowed to be terrible, step 6 is the guarantee that beats consensus, and step 7 is the part that is still a human decision.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={crdtTrace} />
        </div>
      ),
      think: {
        q: 'This tolerates every replica but one crashing, and never runs a consensus protocol. Why is that not a refutation of everything Act III of Season 1 said?',
        a: '**Because it answers a different question, and the giveaway is that its converged states include some that no sequential execution could ever produce.** Here is the paper’s own example. Replica one does `add(e)` then `remove(e′)`. Concurrently, replica two does `add(e′)` then `remove(e)`. Under add-wins semantics they merge and the final state contains *both* e and e′ — nothing was removed. Now try to explain that with a single ordering of those four operations: whichever ordering you choose, one of the removals comes last, and its element is gone. **The state is reachable here and unreachable in any sequence**, so this is not "sequential consistency, relaxed". It is off to the side of the comparison people reach for. Which tells you what was actually given up, and it is not ordering — it is *the ability to ask a question whose answer depends on more than one object.* Consensus buys you the right to say "at most one of these two seats is booked", or "this account never goes negative", or "an arc exists only if both its endpoints do". Every one of those is a statement about a combination, and to enforce it something must observe the combination before allowing a write. Two replicas in separate tunnels will never observe it, so no data type can save you: they will each locally do something reasonable and the merge will faithfully converge on a state that breaks the rule. That is why the paper is careful to talk about *convergence* rather than correctness, and why it lists global invariants as future work rather than as a solved case. **So the two results do not compete; they partition the problem.** If your invariant lives inside one object and the type can express it, you can have availability under total failure and pay nothing. If it spans objects, you need agreement, and agreement costs a majority being reachable. *The engineering skill is telling which of your invariants is which* — and the common, expensive mistake is assuming an application needs the second kind throughout when in fact it needs it in two places and could have the first everywhere else.',
      },
    },
    {
      n: 'Step 04',
      title: 'What the guarantee actually costs',
      rung: 'Rung 4 · The measurement',
      body: [
        'There is no evaluation section in this paper — it is a theory paper at a conference on stabilisation, six pages of definitions and theorems plus a worked design. What it offers instead of numbers is a bill you can read off the constructions, and the bill is metadata.',
        '**A set that supports both adding and removing has to remember removals.** The simplest construction keeps two grow-only sets, one of things added and one of things removed, and answers a lookup by subtracting. Nothing is ever deleted from either — the removed-set is a set of *tombstones* — and so the memory a set occupies is proportional to everything that has ever been in it rather than to what is in it now. **A collection that has churned a million times through ten items costs a million.**',
        '**Getting the semantics you want costs more than the value.** Add-wins requires each addition to carry a unique tag and each removal to name the specific tags it observed, so that an addition concurrent with a removal survives — the removal only kills the instances it actually saw. That is the mechanism behind the semantic choice in the previous step, and it means the type stores *provenance*, not just contents.',
        '**And garbage collecting it needs everybody.** The classical scheme discards an entry once every process has certainly seen it, which is decidable from vector clocks — and is only live when no process is crashed. So the property that makes the whole design remarkable, surviving n−1 failures, is precisely the property that stops you reclaiming space: **one participant who never comes back is one participant whose acknowledgement never arrives.** The paper is comfortable with this because a stalled collector does not make the data wrong, only large. That is the correct engineering judgement and it is also the thing that shows up in production as a document that has become slow.',
      ],
      code: {
        file: 'set.txt',
        lines: [
          { t: '# a set with add and remove, built from two sets that only grow' },
          { t: '' },
          { t: 'payload   A : added   R : removed      # both grow-only' },
          { t: 'lookup(e) = e in A  and  e not in R' },
          { t: 'add(e)      A := A + {(e, unique-tag)}', hl: 'good' },
          { t: 'remove(e)   R := R + (the tags for e that I can see)', hl: 'good' },
          { t: 'merge       A := A union A′   R := R union R′' },
          { t: '' },
          { t: '# union is the least upper bound, so merge is commutative,' },
          { t: '# idempotent and associative — the channel cannot affect it.' },
          { t: '#' },
          { t: '# and R never shrinks. that is the bill: memory tracks' },
          { t: '# everything that was ever in the set, not what is in it.' },
        ],
      },
      diagram: <NotSequentialDiagram />,
      deeper: {
        summary: 'The graph, where the honesty is',
        body: [
          'The paper’s largest worked example is a directed graph, motivated by a thought experiment about a web crawler maintaining the link structure of the web while pages are being crawled in parallel. It is worth reading not for the design but for one paragraph in it, which is the most candid thing in the paper.',
          'A graph has an invariant across objects: an arc’s endpoints must exist. Now consider one replica adding an arc into a vertex while another concurrently removes that vertex. The paper lays out the three options and the reasoning is the useful part. **Give precedence to the removal**, and arcs to the departed vertex are hidden — easy, and it silently discards work somebody did. **Give precedence to the arc**, and the removed vertex must be resurrected — which means an explicit deletion can be undone by an operation that never knew about it. **Delay the removal** until concurrent additions have been applied, which requires synchronisation and therefore gives up the entire premise.',
          'The paper picks the first and says plainly: *there is no perfect choice.* That sentence is the boundary of the whole approach, stated by its authors, in the middle of their own showcase example. An invariant that spans two objects cannot be maintained by two replicas that never speak — not because the machinery is immature, but because neither one can observe the thing the invariant is about.',
          '*The general lesson is worth more than the graph.* **When a technique cannot enforce a constraint, the choices left are all about which kind of surprise your users get** — vanished work, resurrected deletions, or a system that stopped being available. Reading the three options next to each other is the fastest way to develop an instinct for which of your own invariants can survive out here and which cannot.',
        ],
      },
    },
    {
      n: 'Step 05',
      title: 'Move the guarantee into the type',
      rung: 'Rung 5 · The design stance',
      body: [
        'The stance is a general move and it is not about replication: **when correctness depends on a rule somebody has to follow, try to find a representation in which the rule cannot be broken.** The rule here was "reconcile these two states sensibly", it was enforced by application code, and it was violated in production by one of the most-read papers in this book. The fix was not to make the rule easier to follow. It was to choose data types where no reconciliation is expressible, so the rule has nothing to be violated in.',
        'Notice the leverage that buys downstream, because it is larger than it first appears. Once merge is commutative, idempotent and associative, **the delivery channel is released from every obligation it had.** No ordering, no exactly-once, no acknowledgements that must be tracked — deliver eventually, by any means, in any order, as many times as you like. Half the machinery of the preceding twenty-six chapters exists to make delivery well-behaved, and here it is simply not needed. *A constraint moved into the data model paid for itself in a completely different subsystem*, which is the signature of having found the right place to put it.',
        'The stance also explains why this is presented as *theory* rather than as a system. The contribution is a pair of sufficient conditions and a proof that they are equivalent, and the value of that is not any one data type — it is that anybody can now check their own design against a two-line criterion instead of arguing about scenarios. The paper is explicit that ad-hoc approaches were the state of the art and that the literature offered little guidance; **what it supplies is the guidance, and the data types are demonstrations that the guidance is usable.**',
        'And it is candid about its own edges in the conclusion, which is worth noticing. The class of computations expressible this way is named as an open question. So are global invariants, which it hopes to approach with probabilistic or heuristic techniques rather than claiming to have solved. *Naming the boundary of your own result is how a definition becomes something other people can build on*, and the ten years after this paper are what that looks like.',
      ],
      diagram: <SemilatticeDiagram />,
    },
    {
      n: 'Step 06',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 6 · What convergence costs',
      body: [
        '**Metadata outlives data, and it is the practical objection.** Tombstones, unique tags per addition, and the causal information a removal needs are all storage that tracks history rather than contents. Garbage collection exists and needs every participant to check in, so the failure tolerance that makes this remarkable is exactly what stops the collector running. The visible symptom is not incorrectness; it is a shared document that has quietly become expensive.',
        '**Convergence is not correctness, and the gap is where the surprises live.** Every option for concurrent add-and-remove converges. The type has to pick one, that pick is a semantic claim about your application, and a library that picked for you has made a product decision you did not review. **The failure mode changed shape rather than disappearing** — from replicas that disagree, which is detectable, to replicas that agree on something nobody intended, which is not.',
        '**No invariants across objects.** Anything of the form "these two things must hold together" — an arc and its endpoints, a balance that must not go negative, a seat booked at most once — is unavailable, and no cleverer data type fixes it, because the two replicas that break the rule never observe each other before doing so. The paper’s own graph example says *there is no perfect choice* out loud.',
        '**And the operation-based style still needs the channel to behave.** Commutativity of concurrent operations is enough only when delivery is reliable, exactly-once and causally ordered. That is a standard facility and it does not need consensus, and it is also not free: somebody implements it, it holds messages until their dependencies arrive, and it is one more thing between an update and the replica that wanted it. *The state-based style avoids that entirely and pays by shipping whole states*, which is why real systems mix the two.',
      ],
      callout: {
        kind: 'bad',
        big: 'THEY WILL AGREE. NOBODY PROMISED YOU WOULD LIKE IT.',
        text: 'Strong eventual consistency is a theorem about replicas holding the same value. Which value that is remains a design decision, made once when the type is chosen — and made by somebody, whether or not that somebody was you.',
      },
      diagram: <AddWinsDiagram />,
    },
    {
      n: 'Step 07',
      title: 'Where it stands in 2026',
      rung: 'Rung 7 · Descendants',
      body: [
        '**These are in production and mostly where you cannot see them.** They sit under collaborative editors, distributed caches and databases that replicate across regions, and the reason they spread is the one this chapter opened with: they let a system be available during a partition without making somebody write a merge function. The research that followed went after exactly the bill above — sequence types with efficient text handling, schemes that shrink or remove tombstones, and JSON-shaped types that compose the primitives into whole documents.',
        '**And there is a comparison worth carrying, because the alternative is older and still around.** Collaborative editing had a technique since 1989 — transform an incoming operation against the concurrent ones already applied, so it lands in the right place. It works, it shipped in real products, and this paper notes the awkward result that most published decentralised versions of it were **shown to be incorrect.** *Designing for commutativity from the start is cleaner and simpler* is the paper’s claim, and the strongest evidence for it is how difficult the alternative turned out to be to get right.',
        '**What is still open is what the paper said was open.** Which computations can be expressed this way. Which invariants can be maintained. Whether anything can be done about the ones that cannot, short of coordinating. Fifteen years on, the shape of the answer is *coordinate rarely and locally, for the few constraints that need it, and use these everywhere else* — which is a design instinct rather than a theorem.',
        '*And here is what this chapter changes about the book.* Every previous chapter kept the authority somewhere — a master, a leader, a quorum, a log, a graph of operators on somebody’s machines. This one puts a complete, authoritative copy on every device and makes agreement a property of the data rather than an achievement of the network. **The next chapter asks what software would look like if you actually built on that**, and finds that the interesting problems stop being distributed-systems problems.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Strong eventual consistency.',
      body: 'Replicas that have delivered the same updates *have* the same state. The word doing the work is not “eventual” — it is that no arbitration happens in between.',
    },
    {
      term: 'Join semilattice.',
      body: 'A partial order where any two elements have a least upper bound. Merge is that bound, which makes it commutative, idempotent and associative for free.',
    },
    {
      term: 'Tombstone.',
      body: 'A record that something was removed, kept forever because a replica that never saw the removal would otherwise re-add it. The main storage cost of the whole approach.',
    },
    {
      term: 'Commutativity.',
      body: 'The op-based condition: concurrent operations produce the same state in either order. Needs causal delivery, which is standard and does not need consensus.',
    },
    {
      term: 'Global invariant.',
      body: 'A rule spanning more than one object. Not maintainable here, because the replicas that would break it never observe each other first. The boundary of the technique.',
    },
  ],
  inTheWild: {
    note: '5 things to know before you reach for one',
    points: [
      '**Metadata is the cost, and it grows with history.** Ask what the type stores per removed element and how it is ever reclaimed. "Tombstones are garbage collected" usually means "when every replica has checked in", which is a promise about a set of machines that includes the laptop somebody stopped using.',
      '**Find out which concurrent-update policy your library picked.** Add-wins and remove-wins are both defensible and produce opposite user-visible behaviour on the same edit. This is a product decision, it is frequently made in a library’s default, and it is rarely in the README.',
      '**They do not give you invariants across objects.** If the requirement is "at most one booking for this seat" or "the balance never goes negative", no data type gets you there. Coordinate for that one rule and use these for everything else.',
      '**Last-writer-wins is one of these, and its cost is a whole update.** It converges honestly. It also silently discards concurrent edits with nothing recording that a second edit existed — which is right for a register and quiet data loss for a document.',
      '**The two styles have different infrastructure bills.** State-based ships whole states and asks nothing of the channel. Op-based ships operations and needs reliable causal delivery, which somebody has to build and operate. Most real systems end up mixing them.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Make the rule unbreakable rather than easier to follow',
        when: 'correctness depends on somebody applying a rule correctly every time. Look for a representation in which violating it is not expressible — and notice that this usually pays off somewhere other than where you spent it.',
      },
      {
        choose: 'Commutative, idempotent, associative — all three, or none of them help',
        when: 'you are relying on a delivery channel behaving. Get all three and the channel is released from ordering, deduplication and batching at once. Get only idempotence, which is the common advice, and you still diverge.',
      },
      {
        choose: 'Separate "will they agree" from "will you like what they agree on"',
        when: 'evaluating anything that promises automatic conflict resolution. The first is a theorem somebody can prove; the second is a design decision somebody made, and only one of them is usually in the documentation.',
      },
      {
        choose: 'Sort your invariants by how many objects they span',
        when: 'deciding how much coordination a system needs. The single-object ones can have availability under total failure for free; the ones that span objects need agreement. Most applications assume they need the second kind everywhere and need it in two places.',
      },
    ],
  },
  misconception: {
    think: '“CRDTs resolve conflicts automatically, so you never lose data.”',
    actually:
      'They make conflicts **inexpressible**, which is a different thing, and the second half of that sentence is false in a way that matters. Convergence is guaranteed: replicas that have seen the same updates hold the same value, without arbitration, without rollback, and while tolerating every replica but one being permanently dead. What is *not* guaranteed is that the agreed value is the one anybody wanted. One replica adds an element while another concurrently removes it: add-wins converges, remove-wins converges, highest-identifier-wins converges, and resetting to a marker converges. **All four satisfy the theorem**, they produce opposite user-visible behaviour on the same edit, and choosing among them is a semantic decision a person makes when the type is designed. So the merge function did not disappear — it moved, from application code written under time pressure per collision, to a decision made once and encoded in the type, where it can be documented and tested. That is a real improvement and it is not the elimination of judgement. And last-writer-wins is one of these, fully convergent, which is the cleanest illustration: it drops concurrent updates on the floor with nothing recording that a second edit ever happened. *The failure mode moved from replicas that disagree, which is detectable, to replicas that agree on something nobody meant, which is not.*',
  },
  sources: [
    {
      year: '2011',
      title: 'Conflict-free Replicated Data Types — Shapiro, Preguiça, Baquero, Zawirski (SSS)',
      url: 'https://www.lip6.fr/Marc.Shapiro/papers/2011/CRDTs_SSS-2011.pdf',
      note: 'Six pages of actual content and **§2.2 to §2.4 is the whole idea** — the definition of strong eventual consistency and the two sufficient conditions, in about two pages. Then **§3.3**, which is short and is the one people skip: the proof that a converged state can be one no sequential execution could produce. That is what stops this being "eventual consistency, tidied up".',
    },
    {
      year: '2011',
      title: 'A comprehensive study of Convergent and Commutative Replicated Data Types — Shapiro, Preguiça, Baquero, Zawirski (INRIA RR-7506)',
      url: 'https://inria.hal.science/inria-00555588',
      note: 'The companion report, and the one to actually keep: a catalogue of designs — counters, several sets with different concurrent semantics, registers, graphs, sequences — each with its payload, its operations and its argument. If you are choosing a type rather than learning the idea, start here and read the set variants side by side to see the semantic choice made four different ways.',
    },
    {
      year: '2007',
      title: 'Dynamo: Amazon’s Highly Available Key-value Store — DeCandia et al. (SOSP)',
      url: 'https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf',
      note: 'Chapter 5, and the paper this one is arguing with — cited by name in its introduction as the example of what ad-hoc reconciliation costs. Re-read §4.4 on the shopping cart directly before this chapter and the contribution stops being abstract: that is the merge function, written by hand, doing exactly what it was told.',
    },
    {
      year: '2009',
      title: 'A Commutative Replicated Data Type for Cooperative Editing — Preguiça, Marquès, Shapiro, Leția (ICDCS)',
      url: 'https://doi.org/10.1109/ICDCS.2009.20',
      note: 'Treedoc, where the idea came from — a sequence type for collaborative text, published two years before the general theory was written down. Worth reading as evidence for how this kind of result actually arrives: somebody builds a specific hard thing, then works out afterwards what class it belongs to.',
    },
    {
      year: '1989',
      title: 'Concurrency Control in Groupware Systems — Ellis & Gibbs (SIGMOD)',
      url: 'https://dl.acm.org/doi/10.1145/67544.66963',
      note: 'Operational transformation, the older answer to the same problem: apply locally, then transform incoming operations against the concurrent ones already applied. It shipped in real products, and the paper above notes that most published decentralised versions were later shown to be incorrect — which is the strongest available argument for designing around commutativity instead.',
    },
  ],
  seenIn: [
    { label: 'The Cart That Must Not Close — Ch 5', to: '/papers/dynamo', live: true },
    { label: 'What “Before” Even Means — Ch 7', to: '/papers/lamport', live: true },
    { label: 'Interlude: CAP', to: '/papers/cap', live: true },
    { label: 'Change as the Unit of Work — Ch 24', to: '/papers/differential', live: true },
  ],
  finale: {
    title: 'The merge function moved; it did not vanish',
    body: 'Chapter 5 built a store that accepts a write during any failure and discovered the price: two versions of a cart, no way to say which is right, and a merge function the application had to write and be correct about for every pair of states that could ever arise. It was wrong once, publicly, and deleted items came back. The answer here is to stop making reconciliation expressible. Choose data types whose states form a lattice and whose merge is the least upper bound, and merge becomes commutative, idempotent and associative — so the order updates arrive in, whether they arrive twice, and how they are batched are all incapable of affecting the result. The channel is released from every obligation, replicas that have seen the same updates hold the same value with no arbitration in between, and the whole thing survives every replica but one dying, without ever running a consensus protocol. What it costs is metadata that tracks history rather than contents, a collector that only runs when everybody is alive, and the fact that convergence is not correctness: concurrent add and remove has four convergent answers, and which one your type picks is a decision somebody made. Above all it costs invariants that span more than one object, which no data type can give you, because the replicas that break them never meet first.',
  },
  next: { title: 'The Network Is Optional', slug: 'local-first' },
}
