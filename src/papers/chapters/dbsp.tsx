import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import {
  IntegrateDifferentiateDiagram,
  ChainRuleDiagram,
  ZSetDiagram,
  OperatorCostDiagram,
} from '../diagrams'
import { dbspTrace } from './dbsp-trace'

/* The act's closer, and the only theory paper in the book. That is the risk
   and it is also the reason it earns a chapter: the previous two chapters
   both END on the same complaint — somebody has to construct the incremental
   computation — and this one answers it with a procedure rather than another
   system.

   The danger is writing a chapter about a definition. So the spine is not
   "here is DBSP", it is: incremental view maintenance has produced one paper
   per class of query for forty years, which is the signature of a field with
   no general method, and here is what the general method turns out to be.
   The proof that it is a method rather than a framework is that semi-naive
   Datalog evaluation falls out of it as a corollary — a known algorithm,
   re-derived, not re-implemented.

   Deliberately NOT covered: the nested-stream construction in §6, which is
   the most impressive part of the paper and cannot be explained honestly in a
   panel. It gets one accurate paragraph in the reveal and a pointer, because
   half an explanation of a two-dimensional time domain is worse than an
   honest signpost to §6 itself. */

export const dbsp: Chapter = {
  slug: 'dbsp',
  act: 'Act III · The Answer That Maintains Itself',
  paperNo: 'Paper 26',
  title: 'Incremental by Construction',
  dek: 'Two chapters have shown that maintaining an answer beats recomputing it, and in both of them a person had to work out what the incremental version was. Forty years of that produced one paper per class of query. This one produces a procedure — and proves it in a theorem prover.',
  minutes: 16,
  paper: {
    title: 'DBSP: Automatic Incremental View Maintenance for Rich Query Languages',
    authors: 'Mihai Budiu, Tej Chajed, Frank McSherry, Leonid Ryzhyk, Val Tannen',
    venue: 'PVLDB 16(7) · VMware Research, Materialize, Penn',
    year: '2023',
    url: 'https://www.vldb.org/pvldb/vol16/p1601-budiu.pdf',
  },
  caption:
    'Look at the shape of this field before you look at the paper. Incremental view maintenance has been studied since the 1980s, and the literature is a long list of results of the form *here is an algorithm for this class of query*: select-project-join, then aggregation, then recursive Datalog with its own counting scheme, then acyclic conjunctive queries, then queries with correlated aggregates, then foreign-key joins. Each is real work, each has its own proof, and **each stops at the edge of its class.** Chapter 24 widened what could be maintained and left the operator implementations as hand-written special cases; Chapter 25 compiled SQL into a graph and hand-wrote every operator in it, each with its own argument for why it is correct. That is what a field looks like when it has no general method — and the tell is not that the papers are hard. It is that adding one operator to any of these systems inherits **nothing** from the theory behind the others.',
  steps: [
    {
      n: 'Step 01',
      title: 'Forty years of one paper per class of query',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'The standard approach has a standard shape. Given a query *Q*, find a **delta query** — another query ΔQ satisfying `Q(d + Δd) = Q(d) + ΔQ(d, Δd)` — so that a change to the input can be turned into a change to the output without re-reading everything. It works, it is correct, and finding ΔQ is a research contribution *per family of Q.*',
        'Which is why the literature reads as it does. There is a classic algorithm for recursive queries that maintains a count of derivations per fact, and its problem is over-deletion: it can invalidate a superset of what actually died and then work hard to put things back, occasionally concluding that starting over would have been quicker. There is another that stores, with each derived fact, the full set of facts used to derive it — correct, and the state is prohibitive. There are systems for acyclic conjunctive queries, for correlated aggregates, for foreign-key joins. **Each is a good answer to a question somebody had to pose first.**',
        'And the constraint that falls out is not about performance at all. It is that **there is no procedure.** You cannot hand a system an arbitrary query and get its incremental version out, so every one of these techniques arrives as a system with a fixed vocabulary, and extending the vocabulary means going back to the theory. The two chapters before this both end on it: one leaves you assembling incremental operators by hand, the other compiles the SQL it knows how to compile.',
        '*Notice what would count as a real answer here.* Not a faster system. A **method** — something mechanical, that takes any query in the language and returns its incremental version, with no heuristics and no cases, and whose correctness is argued once rather than per query. That is a stronger claim than any of the systems above make, and it is the claim this paper makes.',
      ],
      diagram: <OperatorCostDiagram />,
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'Three decisions, and this one is unusual for the book: the moves are not engineering choices, they are decisions about what to *model* things as. Which is the point — the previous two chapters made every engineering choice available and still could not produce a procedure.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**What you want:** a mechanical procedure. Any query in the language goes in, its incremental version comes out. No heuristics, no cost model, no per-query cleverness, no list of supported shapes.',
              '**What the language has to cover:** the full relational algebra including set difference, multisets, nested relations, aggregation, unnest, windows, and recursion — because a method that stops at joins is another entry in the list above.',
              '**What "incremental" has to mean:** changes in, changes out. Not "recompute cheaply" — the input is a stream of deltas and the output is a stream of deltas, so results can be composed and forwarded.',
              '**What you may not require:** that anybody hand-writes a delta rule. That is the thing being replaced.',
              '**And one you get to choose:** what a change *is*. This is not fixed by the problem, and it is where the whole thing is won or lost.',
            ],
            questions: [
              {
                q: 'Every prior approach defines incrementality as a property of a query — a partial derivative of Q with respect to its inputs. What would you define it on instead?',
                options: [
                  {
                    label: 'On streams. Model the database as a stream of snapshots, define add-up-the-changes and take-the-difference as operators on streams, and let the incremental version be the composition of all three.',
                    verdict: 'move',
                    why: 'The whole paper turns on this, and it is worth seeing why it is not a restatement. Define **I**, which adds up a stream of changes into a stream of snapshots, and **D**, which subtracts each snapshot from the one before to give the changes back. They are exact inverses — nothing about databases yet, this holds for any values you can add and subtract. Then the incremental version of *any* query is just `D ∘ Q ∘ I`: turn the changes into snapshots, run the ordinary query, turn the answers back into changes. **This is always well-defined**, for every Q, with no cleverness, because it never asks what Q *is*. The old definition needs a derivative of the query and a derivative of a query might not exist; this one needs only derivatives of streams as functions of time, and those always exist once the values form a group. Note what has been paid: as written, this is a definition and a terrible implementation — the `I` in the middle rebuilds the entire database at every step. Everything after this is optimisation, and optimisation is a much easier problem than existence.',
                  },
                  {
                    label: 'On queries, as before, but derive the delta rules automatically with a term-rewriting system',
                    verdict: 'dead',
                    why: 'Reasonable, and it is roughly what the more advanced systems in the related work do. The problem is that it inherits the shape it was meant to escape: rewriting needs a rule per operator, so a new operator means new rules and a new proof, and rules for *composing* the results interact in ways somebody has to check. You have automated the application of the theory without generalising the theory. **The tell is that adding an operator is still a research task**, which was the original complaint.',
                  },
                  {
                    label: 'Define it operationally — an incremental version is any implementation that produces the same answers with less work',
                    verdict: 'dead',
                    why: 'This is the definition everyone is using implicitly, and it is why the field looks the way it does. It has no algebra in it: from "produces the same answers with less work" you cannot derive anything, you can only *verify* a candidate somebody else invented. Every property that makes the accepted answer useful — that incrementalizing a composition is the composition of the incrementalized parts, that the transformation is invertible, that linear things are their own incremental version — is a statement about a *definition*, and you cannot state any of them about this one.',
                  },
                  {
                    label: 'Consider only single changes — one row inserted, one row deleted — and handle batches by repetition',
                    verdict: 'dead',
                    why: 'This is the classical definition, and the restriction is exactly what blocks the interesting case. Generalising to streams is what makes recursion work: inside a fixed-point loop the *iterations* form a stream too, so a single model covers "the database changed" and "the loop went round" — which is the thing Chapter 24 needed a partial order for. Restrict to one change at a time and the loop is outside your model and has to be handled by some other machinery, which is where you came in.',
                  },
                ],
              },
              {
                q: 'Your operators need to add and subtract collections. Relations are sets, and sets have no subtraction. What do you change?',
                options: [
                  {
                    label: 'Give every row an integer weight, allowed to be negative — so a deletion is a row with weight −1 and applying a change is addition',
                    verdict: 'move',
                    why: 'A table becomes a map from rows to integers. A set is one where every weight is 1; a bag is one where they are all positive; **a change is one where an inserted row has weight +1 and a deleted row has weight −1.** Applying a change is now literally addition, and insertions and deletions stop being different operations — which is the concession that makes everything else legal, because the theory needs values that form a commutative group and this is the standard way to make relations into one. Chapter 22 sent retractions downstream and made "does the consumer accept a correction" a policy the pipeline author chose; Chapter 25 wrote negative updates by hand into every operator. **Here it is not a feature, it is the only thing there is.** The cost is one honest wrinkle: SQL wants sets, so after arithmetic that can push a weight to 2 or −1 you need an operator that forces weights back to 1 — and that operator is not linear, which is where the interesting proof goes.',
                  },
                  {
                    label: 'Keep sets, and represent a change as a pair — the rows added and the rows removed',
                    verdict: 'dead',
                    why: 'The obvious encoding and it does work, at the cost of everything you were building toward. Every operator now has to handle two collections and say how they interact, composition means reasoning about four cases instead of one, and there is no addition — so `I` and `D` cannot be defined, the inverse property does not hold, and the algebra you were about to lean on has nothing to stand on. *The pair is the same information;* what it lacks is the structure, and the structure is the entire product.',
                  },
                  {
                    label: 'Use multisets — counts are natural numbers, which is nearly a group',
                    verdict: 'dead',
                    why: 'Nearly, and the gap is the whole point. Natural numbers have addition and no inverse, so you can express an insertion and not a deletion, which is precisely the half of the problem that is hard. Everything in this act — retracting a label whose edge disappeared, evicting an entry, correcting a window — is about *removal*. Allowing the weights to go negative is not a generalisation for its own sake; it is what admits the case the field has been struggling with since the eighties.',
                  },
                  {
                    label: 'Version each row and treat a deletion as a new version with a tombstone',
                    verdict: 'dead',
                    why: 'This is how a storage engine does it and it is right for a storage engine — Chapter 3 lives on it. It does not help here because a tombstone is a *fact about a row*, not a value you can add: two changes to the same row still have to be reconciled by logic somebody writes, and the reconciliation is the thing you are trying to derive rather than write. **Storage-layer thinking solves the durability problem and leaves the algebra untouched**, and it is the algebra that produces the procedure.',
                  },
                ],
              },
              {
                q: 'You have a definition that is always correct and hopelessly slow, since it rebuilds the database at every step. What property would turn it into an algorithm?',
                options: [
                  {
                    label: 'That incrementalizing a composition equals composing the incrementalized parts',
                    verdict: 'move',
                    why: 'The chain rule, `(Q1 ∘ Q2)Δ = Q1Δ ∘ Q2Δ`, and it is the load-bearing result. It means the expensive wrapper can be pushed *inward* through a query plan, one operator at a time, until it lands on individual operators and is replaced by each operator’s own incremental form — where the rebuilding disappears, because most operators do not need it. **The procedure is now a compiler pass**: walk the plan, rewrite each node, done. Deterministic, syntax-directed, and its running time is proportional to the number of operators. And it composes with the other properties in the same list: a linear operator is *identical* to its own incremental version, so filter and project simply lose their wrappers and store nothing at all. The same rule holds around a **loop**, which is the part that should be surprising and is the reason recursion is not a separate chapter of this paper.',
                  },
                  {
                    label: 'That the transformation is invertible, so you can recover the original query',
                    verdict: 'dead',
                    why: 'True, and it is in the paper’s list of properties — but it buys you nothing operationally. Knowing you can get Q back from QΔ does not tell you how to evaluate QΔ cheaply. This is a good example of a genuine theorem that is not the useful one: the property you need is the one that lets you **decompose** the problem, and invertibility says the whole thing is recoverable, which is the opposite direction.',
                  },
                  {
                    label: 'A cost model, so a planner can choose the cheapest incremental plan',
                    verdict: 'dead',
                    why: 'And notice the paper explicitly does *not* do this, for a reason worth carrying. A normal planner uses statistics to pick a plan for data it can see. An incremental plan has to be chosen **before any data has arrived** and will then run for every future update — and it cannot be swapped later without reconstructing all the state it has accumulated. So the honest design is to take whatever plan an ordinary planner produced and incrementalize *that*, mechanically, producing a plan "similar" to the input one. **A heuristic-free transformation is the feature**, not a gap.',
                  },
                  {
                    label: 'Special-case the expensive operators — join, aggregation, duplicate elimination — with hand-written rules',
                    verdict: 'dead',
                    why: 'This is the field you are trying to leave, arriving through the back door. It also gets the direction of the difficulty wrong: with the chain rule in hand, the per-operator work is a short list of theorems proved *once* — linear operators are their own incremental version, bilinear ones expand to a fixed three-term formula, and duplicate elimination has a small rule of its own. Those are consequences of the algebra rather than inventions, which is why a new operator inherits the theory instead of needing its own paper.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived DBSP — a language with four operators, and semi-naive evaluation as a corollary',
              body: [
                '**The whole language.** Streams of values from a commutative group. Lifting, which applies an ordinary function pointwise to a stream. Delay by one step. Fixed points of things that only look at the past. That is it — four operators — and integration and differentiation are *built* from them rather than assumed. Relations enter through Z-sets, rows with integer weights, which is the standard way to make tables into a group.',
                '**The procedure, in five steps.** Translate the query plan into a circuit. Remove the duplicate-elimination operators that provably cannot change the answer. Lift the whole circuit so it computes on streams. Wrap it in integrate and differentiate — correct and slow. Then apply the chain rule recursively until the wrapper has been pushed onto individual operators, where linear ones absorb it entirely, bilinear ones expand to a known formula, and the rest use their own small rules. **Deterministic, and its cost is proportional to the size of the query.**',
                '**And the result that shows it is a method rather than a framework.** Build the circuit for a recursive query, and the inner part of it is already sandwiched between an integrate and a differentiate — so the same chain rule applies, and rewriting by it produces exactly **semi-naive evaluation**, the standard Datalog algorithm from the textbooks. The paper does not implement semi-naive evaluation; it *derives* it, and observes that this constitutes a proof of its correctness. Apply the transformation a second time, to a circuit that already contains a loop, and you get a recursive query that maintains itself as its input changes — using streams of streams, which is the part worth reading §6 for rather than reading about.',
                '**One more thing, unusual enough to note.** Every theorem, proposition and example in the paper is machine-checked in the Lean proof assistant, in about 5,000 lines. Not the implementation — the theory. *A field with forty years of per-class algorithms now has one general algorithm with a mechanised proof*, and the paper is candid that the implementation is not the verified part.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'A row is deleted, and nobody wrote the circuit',
      accent: 'denim',
      rung: 'Rung 3 · The reveal',
      span: 2,
      body: [
        'The circuit the five steps produce for the paper’s own example, with a deletion walking through it. Step 3 is why filters cost nothing, step 5 is the operator that should have been expensive and is not, and step 7 is the loop — where the same rule, applied twice, produces something nobody had to design.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={dbspTrace} />
        </div>
      ),
      think: {
        q: 'The paper derives semi-naive evaluation rather than implementing it. Why is that worth more than a benchmark?',
        a: '**Because it is the difference between a framework and a method, and it is the only kind of evidence that tells them apart.** Semi-naive evaluation is a known algorithm — it is how you evaluate recursive Datalog without redoing work, it is in the textbooks, and it was invented by people thinking specifically about Datalog. Here nobody thinks about Datalog. You build the circuit for a recursive query in the obvious way: run the body, feed the output back with a delay, stop when nothing new comes out. Then you notice the inner part of that circuit is *already* wrapped in an integrate and a differentiate, because that is just what a loop looks like in this model. So the chain rule applies — the same chain rule used for ordinary queries, no new theory — and rewriting by it hands you semi-naive evaluation. Now think about what that demonstrates. If the paper had implemented semi-naive evaluation, that would be an engineering claim: *our system supports recursion.* Deriving it is a claim about the model: **the model was general enough to contain an algorithm its authors did not put there.** Anybody can build a framework whose capabilities are the ones they enumerated. The test of a genuine abstraction is whether it produces results that were not designed in — and a known algorithm falling out is exactly that test, because you can check the answer against a textbook. As a bonus you get a proof for free: since the derivation is mechanical and the rules are proved correct, this constitutes a correctness proof of semi-naive evaluation, which is a stronger statement than "our implementation passes its tests." *The general lesson is a test to apply to abstractions you are offered, including your own.* **Ask what it generates that nobody designed.** An abstraction whose capabilities are exactly its feature list has organised your work; one that keeps handing back things you recognise from elsewhere has actually found the structure. And the second kind is what lets a new operator inherit the theory instead of needing its own paper — which is the concrete thing this act has been missing for two chapters.',
      },
    },
    {
      n: 'Step 04',
      title: 'What each operator costs, and the one that should have been expensive',
      rung: 'Rung 4 · The measurement',
      body: [
        'This is a theory paper, so the "measurement" is a complexity argument rather than a graph — and it is more useful than a graph, because it tells you what to expect from a query you have not run yet. The standing assumption is the one every incremental system makes: the change is much smaller than the database.',
        '**Linear operators cost the change and store nothing.** Filter, project, addition, negation. For anything linear the incremental version *is* the operator — the derivation produces no wrapper at all — so these do not appear in the rewritten circuit in any special form. Not "a small amount of state": the space complexity is zero.',
        '**Bilinear operators cost the database times the change.** Joins and products are linear in each side separately, which does not collapse, so both accumulated sides are kept and the incremental form expands to a fixed formula — new-left against all-right, all-left against new-right, new against new. That is a factor of **database ÷ change** better than re-running the query, and that ratio is the entire business case for incremental maintenance. The state is the two relations.',
        '**And then duplicate elimination, which is neither, and is cheap anyway.** This is the good result. Forcing weights back to 1 is not linear — it needs the current set to know whether a row is present — so the naive incremental version costs the whole database, and this operator is where several earlier approaches run aground. It costs the *change* instead, and the reason is one sentence: a row can only appear in the output if its weight **crossed zero**, and only rows in the input change can have crossed anything. So the output is bounded by the input change no matter how large the database is. The state is the full set, but the work is not.',
        '*The honest row is the fourth one.* Aggregates like minimum and maximum are not linear and have no such trick, because retracting the smallest element means promoting the runner-up and you must have kept it. Done naively that is the whole database per update. The paper does not pretend otherwise; it points at a known sliding-window aggregation scheme that brings it to logarithmic, implementable as a custom operator — **which is the modularity claim being cashed**: a hand-optimised operator drops into the same framework and inherits the incrementalization theory rather than needing its own.',
      ],
      code: {
        file: 'incrementalize.txt',
        lines: [
          { t: '# the entire algorithm. it is five steps and it always terminates.' },
          { t: '' },
          { t: '1. translate the query plan into a circuit' },
          { t: '2. delete the distinct operators that provably cannot matter' },
          { t: '3. lift the circuit, so it computes on streams' },
          { t: '4. wrap it: changes -> integrate -> Q -> differentiate -> changes' },
          { t: '5. push the wrapper inward with the chain rule, until it lands', hl: 'good' },
          { t: '   on single operators and disappears into each one' },
          { t: '' },
          { t: '# no statistics. no cost model. no heuristics. no special cases.' },
          { t: '# running time proportional to the number of operators.' },
          { t: '# run it on a circuit that already has a loop in it and you get' },
          { t: '# a recursive query that maintains itself.' },
        ],
      },
      diagram: <IntegrateDifferentiateDiagram />,
      deeper: {
        summary: 'Why the incremental plan cannot be changed once it is running',
        body: [
          'A short section of the paper with a large operational consequence, and the kind of thing that only becomes obvious after you have deployed one of these.',
          'An ordinary query planner works with an enormous advantage: the data already exists. It has statistics, it can estimate selectivity, and if it picks badly the next query can pick differently. An incremental planner has neither. **The plan must be chosen before any data has arrived**, and it will then execute for every future update to the database — so the usual justification for cost-based planning, that you can measure and adapt, does not apply.',
          'Worse, you cannot simply swap it later. An incremental circuit **carries state** — the accumulated sides of every join, the set behind every duplicate elimination, the contents of every delay. A new plan starts with all of that empty, and its state is a function of the entire history of updates. So installing a new plan is not a deployment, it is a reconstruction. The paper gives the recipe, and it is deliberately unglamorous: feed the entire current database in as one enormous change. That is correct, it terminates, and it costs what it costs.',
          '*Sit with the consequence.* A plan choice made once, before launch, with no statistics, that you are committed to. It is a genuinely harder optimisation problem than ad-hoc query planning and the paper says so rather than claiming to have solved it. **Which reframes the heuristic-free transformation as a virtue rather than a shortcut**: if you cannot re-plan, a transformation that always produces a plan "similar" to the one you fed it is a great deal more predictable than one that makes clever choices you cannot revisit.',
        ],
      },
    },
    {
      n: 'Step 05',
      title: 'Find the structure the values already have',
      rung: 'Rung 5 · The design stance',
      body: [
        'The stance is a method for finding methods: **when a field has one paper per case, look for a structure the values already carry that nobody has used.** Here it is that relations, encoded with integer weights, form a commutative group — a fact from the database theory literature, sitting there for years. Once you have it, streams of relations are a group, differentiation and integration are well-defined on them, they are exact inverses, and the definition of incremental computation writes itself. **Nothing was invented; something was noticed.**',
        'The second move is one this book has now seen three times and it is worth naming. **Get a definition that is obviously correct and hopelessly slow, then make it fast with algebra.** `D ∘ Q ∘ I` is unarguable and it rebuilds the database at every step. The chain rule turns that into a compiler pass. *Existence first, efficiency second*, and the order matters — the previous forty years worked the other way round, starting from efficient rules for particular queries and never arriving at a general definition.',
        'Then the honest limitation, which the paper puts in its related-work section rather than hiding: **you have to find a group structure to embed your computation in.** For relations that is settled. For sorted collections, or tree-shaped data like JSON documents, it is not obvious how, and the paper says so plainly and asks the question rather than waving at it. It also compares itself fairly to the alternative general approach — which needs creativity to choose the right notion of derivative, where this needs creativity to choose the right group — and that is a real trade rather than a win.',
        'And the verification is part of the stance, not decoration. Every theorem in the paper is machine-checked in Lean, in about 5,000 lines, and the paper attributes the modest size to the simplicity of the model itself. *That is the argument for simplicity, made in the only currency that settles it.* **Four operators is not minimalism as taste**; it is what makes the whole theory checkable by a machine, and it is why extending the language with a new operator is a small local obligation instead of a new paper.',
      ],
      diagram: <ChainRuleDiagram />,
    },
    {
      n: 'Step 06',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 6 · What the algebra costs',
      body: [
        '**Somebody has to find the group.** The method applies to values you can add and subtract, and finding that structure is easy for relations and unclear for the things people increasingly store — ordered collections, nested documents, anything tree-shaped. The paper names this as its main limitation and does not have an answer. *The generality is real and it is generality over a class you have to earn your way into.*',
        '**The state did not go away, it got named.** Linear operators store nothing, which is genuinely free. Everything else stores what it always stored: a join keeps both sides, duplicate elimination keeps the whole set, integration and differentiation each keep a copy of the database. **Knowing exactly which operators cost space is worth a great deal and is not the same as saving any**, and a query plan full of joins and distincts has the memory profile you would have feared before reading this.',
        '**Recursion caches every iteration.** Maintaining a recursive query incrementally means keeping the stream of changes the fixed-point loop produced last time, so it can be adjusted rather than recomputed — which means space proportional to the *number of iterations*, not just the data. It is bearable because useful recursions converge quickly, and it is a real multiplier that scales with something most people never think to measure.',
        '**And the plan is a one-way door.** Chosen before any data exists, without statistics, committed to for every future update, and replaceable only by feeding the entire database back through as one change. This is a harder planning problem than the ordinary kind, it is unsolved, and the paper is straightforward about that.',
        '*One thing this chapter cannot tell you*, and it matters: **whether it is fast.** The paper is explicit that its scope is the theory and defers system evaluation to future work — the benchmarks live in the repository. So the correct reading of it is "here is a general method with proved complexity bounds and a machine-checked theory", and not "here is a system that beats the two before it." Those are different claims and it makes the one it can support.',
      ],
      callout: {
        kind: 'bad',
        big: 'A GENERAL METHOD, OVER A CLASS YOU MUST EARN INTO',
        text: 'Every result here needs values that form a commutative group. Relations do, once rows carry weights. Sorted collections and tree-shaped documents may too, and nobody has shown how — so the generality is genuine and its boundary is a research question, stated as one.',
      },
      diagram: <ZSetDiagram />,
    },
    {
      n: 'Step 07',
      title: 'Where it stands in 2026 — and what Act III settled',
      rung: 'Rung 7 · The end of the act',
      body: [
        '**The theory shipped as a product faster than theory usually does.** The implementation is a Rust library and a SQL compiler built on a standard query-planning framework, and the compiler passes all **7 million** of the SQL Logic Tests — a claim that is checkable, unusual, and much more informative than a benchmark, because it says the front end handles real SQL with its nulls, its three-valued logic and its multiset semantics rather than a tasteful subset. It became Feldera; and one of this paper’s authors wrote Chapter 24.',
        '**And the two chapters before it are now positioned rather than superseded.** Chapter 24 is more expressive in one specific way — its time values can be arbitrary lattices, where this uses linear time plus nesting — and this paper says so. What this adds is the *procedure*: there, you assemble an incremental computation from incremental operators yourself; here, an ordinary query is transformed into one mechanically. Chapter 25 remains the answer to a different question, which is what to do when the state does not fit and the reader is waiting.',
        '**What this act settled.** Three chapters ago every system in this book answered a read by computing something. Now: a change can be the unit of work, and indexing versions by a partial order is what lets that survive a loop. An answer can be maintained rather than invalidated, and bounding its state by demand rather than by age is what makes that fit on a machine. And the incremental version of a query does not have to be invented — it can be derived, by five mechanical steps, from a definition that is obviously correct and made fast by algebra. **The question stopped being how fast your query runs and became which of your answers should already exist.**',
        '**And here is the assumption the whole act leaves standing.** Every design in it — the difference index, the maintained view, the circuit — sits on machines that can reach each other. The answer is maintained *somewhere*, and you go to it. Two people editing the same document on a train have no somewhere: no quorum to reach, no leader to ask, and writes already committed on the devices that made them. *Chapter 5 met this in Act II of Season 1, asked who writes the merge function, and handed the question to the application.* The next act answers it properly.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Z-set.',
      body: 'A table where every row carries an integer weight, possibly negative. A set has all weights 1; a change has +1 for an insertion and −1 for a deletion. Applying a change is addition.',
    },
    {
      term: 'Integration and differentiation.',
      body: 'Add up a stream of changes to get snapshots; subtract consecutive snapshots to get changes back. Exact inverses, defined for anything you can add and subtract.',
    },
    {
      term: 'The chain rule.',
      body: 'Incrementalizing a composition equals composing the incrementalized parts. Why the transformation is a compiler pass instead of a research project per query.',
    },
    {
      term: 'Linear operator.',
      body: 'One that distributes over addition — filter, project, sum. Its incremental version is itself, it costs the change, and it stores nothing at all.',
    },
    {
      term: 'distinct.',
      body: 'Forces weights back to 1, so a Z-set becomes a set. Not linear, and incrementally cheap anyway: only a row whose weight crossed zero can appear in the output.',
    },
  ],
  inTheWild: {
    note: '4 things to take from this even if you never use it',
    points: [
      '**"One paper per case" is a diagnosis.** When a field publishes an algorithm per subclass of a problem, the missing thing is usually a structure on the values rather than a cleverer algorithm. Ask what the values already are before asking what to do with them.',
      '**A deletion is not an operation, it is a negative.** Most systems treat insert and delete as separate code paths with separate bugs. Making removal an ordinary value with a sign collapses two paths into one, and it is why every hard case in this act — retraction, eviction, correction — stops being a special case.',
      '**Correct-and-slow first, then algebra.** A definition that obviously works and obviously cannot ship is a much better starting point than an optimisation you cannot prove. You can make a correct definition fast; you cannot make a fast heuristic correct.',
      '**Judge an abstraction by what it generates that you did not design.** Semi-naive evaluation falling out of this model is stronger evidence than any benchmark, because it is checkable against a textbook. Applied to your own designs, it is an uncomfortable and very fast test.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'A definition you can compute with, not one you can only verify against',
        when: 'you are formalising something. "Produces the same answers with less work" cannot be manipulated; `D ∘ Q ∘ I` can, and every useful property here is a consequence of being able to manipulate it.',
      },
      {
        choose: 'Make removal a value rather than an operation',
        when: 'a system has separate paths for adding and taking away. Weights that can go negative make "apply a change" into addition, which is what lets one rule cover both.',
      },
      {
        choose: 'A mechanical transformation over a clever planner',
        when: 'the decision cannot be revisited later. An incremental plan is chosen before data exists and carries state that would have to be rebuilt to replace it — predictability is worth more than a better guess.',
      },
      {
        choose: 'Prove the theory, not the implementation',
        when: 'you have a choice about where to spend verification effort. Five thousand lines checked the whole model here; the implementation is tested. Both are honest, and only one of those two obligations grows with every release.',
      },
    ],
  },
  misconception: {
    think: '“DBSP is another incremental view maintenance system, with a theory section attached.”',
    actually:
      'It is a **procedure**, and that is a different kind of claim from anything else in this act. Incremental view maintenance has been studied since the 1980s and the literature is a list of algorithms, one per class of query — select-project-join, then aggregation, then recursive Datalog, then acyclic conjunctive queries, then correlated aggregates — each correct, each with its own proof, each stopping at the edge of its class. The two chapters before this are in the same tradition: one leaves you assembling an incremental computation by hand out of incremental operators, the other compiles SQL into a graph whose operators were each written and argued for individually. **Add an operator to any of them and you inherit nothing.** What this paper produces is a transformation: any query in the language goes in, its incremental version comes out, by five deterministic steps with no heuristics, no statistics and no cost model, in time proportional to the size of the query. The evidence that it is a method and not a framework is not a benchmark — it is that **semi-naive evaluation, the standard Datalog algorithm from the textbooks, falls out of it as a corollary.** Nobody put it there; the model was general enough to contain it, which also constitutes a proof of its correctness. And the price is stated rather than hidden: it applies to values that form a commutative group, relations qualify once rows carry integer weights, *and whether your sorted collections or your JSON documents qualify is an open question the paper asks out loud.*',
  },
  sources: [
    {
      year: '2023',
      title: 'DBSP: Automatic Incremental View Maintenance for Rich Query Languages — Budiu, Chajed, McSherry, Ryzhyk, Tannen (VLDB)',
      url: 'https://www.vldb.org/pvldb/vol16/p1601-budiu.pdf',
      note: '**§3 is the paper** and it is four pages — the definition, the chain rule, and the properties that follow. **§4.5** works the whole algorithm on one concrete SQL query, circuit by circuit, and is the fastest way to believe it. Save **§6** for a second sitting: nested streams are the most impressive part and the least summarisable, and skimming them makes a clean idea look forbidding.',
    },
    {
      year: '2022',
      title: 'DBSP: Automatic Incremental View Maintenance for Rich Query Languages — the extended version (arXiv)',
      url: 'https://arxiv.org/abs/2203.16684',
      note: 'Where the proofs the conference paper omits actually live, along with worked examples of computations on nested streams and the general multi-input case. Read it if §6 left you unconvinced — it has the room to show the two-dimensional time domain rather than assert it.',
    },
    {
      year: '2013',
      title: 'Differential dataflow — McSherry, Murray, Isaacs, Isard (CIDR)',
      url: 'https://www.cidrdb.org/cidr2013/Papers/CIDR13_Paper111.pdf',
      note: 'Chapter 24, by an overlapping author, and the honest comparison is in §9 of the paper above: that model is more expressive about time — arbitrary lattices rather than linear time plus nesting — and offers no general transformation. Read the two side by side for a rare thing in this literature: a paper explaining precisely what the alternative does better.',
    },
    {
      year: '2011',
      title: 'Reconcilable Differences — Green, Ives, Tannen (Theory of Computing Systems)',
      url: 'https://web.cs.ucdavis.edu/~green/papers/tocs11_differences.pdf',
      note: 'Where Z-sets come from, by a co-author of the paper above. This is the fact the whole method rests on — that relations with integer weights form a group — sitting in the literature years before anyone built incremental computation on top of it. Worth reading as a case study in what a "noticed, not invented" contribution looks like from the other side.',
    },
    {
      year: '2015',
      title: 'General Incremental Sliding-Window Aggregation — Tangwongsan, Hirzel, Schneider, Wu (VLDB)',
      url: 'https://www.vldb.org/pvldb/vol8/p702-tangwongsan.pdf',
      note: 'The scheme the paper points at for the operators its algebra does not make cheap — minimum, maximum, anything needing the runner-up after a retraction. Read it to see the modularity claim cashed: a specialised operator drops into the framework and inherits the incrementalization theory rather than needing its own.',
    },
  ],
  seenIn: [
    { label: 'Change as the Unit of Work — Ch 24', to: '/papers/differential', live: true },
    { label: 'The Read Path as a Graph — Ch 25', to: '/papers/noria', live: true },
    { label: 'When It Happened, and When You Heard — Ch 22', to: '/papers/dataflow', live: true },
    { label: 'Interlude: The RUM Triangle', to: '/papers/rum', live: true },
  ],
  finale: {
    title: 'Noticed, not invented',
    body: 'For forty years incremental view maintenance produced one algorithm per class of query, each correct, each with its own proof, each stopping at the edge of its class — which is what a field looks like when it has no general method. The method turns out to rest on a fact that was already in the literature: relations, with rows carrying integer weights that may be negative, form a group. Once they do, a database is a stream, adding up changes and taking differences are exact inverses, and the incremental version of any query at all is take the differences, run the query, take the differences again — obviously correct and hopelessly slow. Then one algebraic property, that incrementalizing a composition is composing the incrementalized parts, turns that definition into a compiler pass with no heuristics in it. The proof that this is a method rather than a framework is that semi-naive evaluation drops out as a corollary, and the theory is machine-checked in five thousand lines. What it costs is that somebody must find the group, which is settled for tables and open for documents. And Act III is finished: a change can be the unit of work, an answer can stand rather than be rebuilt, and the incremental version of a query no longer has to be somebody’s idea. All of it assumes the machines can reach each other.',
  },
  next: { title: 'Who Writes the Merge Function', unwritten: true },
}
