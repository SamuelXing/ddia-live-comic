import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { ThreeBackendsDiagram, PartialNotWindowedDiagram, StateBillDiagram } from '../diagrams'
import { noriaTrace } from './noria-trace'

/* The act's middle chapter, and the one that pays off Chapter 12 rather than
   Chapter 24. Worth being clear about that in the writing: a reader arriving
   from the previous chapter expects "differential dataflow, productionised",
   and this is not that. Its ancestor is the memcache chapter — the argument
   is with the two-tier stack, and differential dataflow is the thing it
   benchmarks against and beats above four machines.

   The chapter's spine is the state problem. Maintaining every answer to every
   query is obviously correct and obviously impossible, and every previous
   dataflow system bounded the state by TIME, which is the wrong axis for a
   website: nobody wants last week's story to be unanswerable, they want it to
   be slow. Partial state bounds by demand instead, and the whole difficulty
   is that a request now travels UP the graph against the flow of updates.

   The correctness invariants (§4.1) are the best part of the paper and the
   easiest to make boring. They are in a Go-deeper rather than a step, stated
   as the four things that must not happen rather than as set algebra. */

export const noria: Chapter = {
  slug: 'noria',
  act: 'Act III · The Answer That Maintains Itself',
  paperNo: 'Paper 25',
  title: 'The Read Path as a Graph',
  dek: 'Nearly every request your application serves is a read, and you answer it by running the same query over data that has not moved. Here is what a backend looks like if the queries are left running instead — and what stops that being obviously impossible.',
  minutes: 17,
  paper: {
    title: 'Noria: dynamic, partially-stateful data-flow for high-performance web applications',
    authors: 'Jon Gjengset, Malte Schwarzkopf, Jonathan Behrens, Lara Timbó Araújo, Martin Ek, Eddie Kohler, M. Frans Kaashoek, Robert Morris',
    venue: 'OSDI (MIT CSAIL · NTNU · Harvard)',
    year: '2018',
    url: 'https://www.usenix.org/conference/osdi18/presentation/gjengset',
  },
  caption:
    'Look at what a web application actually does. Across a month of traffic from two real sites, **88% to 97% of queries are reads**, and on one of them reads consumed 88% of all query execution time. So developers do the obvious thing and stop computing them: the news aggregator in this paper keeps each story’s vote count in a column of the stories table, because counting the votes on every page load is absurd. That one decision then leaks into everything — every vote must update the derived column, the schema is denormalised, a transaction appears to stop two votes colliding, and the transaction exists *only because of the optimisation.* Bolt a cache in front and it is worse, not better: now the application invalidates entries, refills them on a miss, and stampedes when a popular key expires. **Chapter 12 lived in that world and called invalidation the hard part.** This paper asks the question underneath it — if the answer is going to be precomputed anyway, why is the application the thing precomputing it?',
  steps: [
    {
      n: 'Step 01',
      title: 'Both of the ways you already do this put the work on the read',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'A page view arrives and needs a list of stories with their vote counts. **The database way**: join, group, count, sort, on every request, for every reader, over rows that have not changed since the last time anybody asked. It is correct and it is why the hand-optimised setup in this paper saturates sixteen cores at a thousand page views a second. Remove the developers’ manual precomputation and the same database manages **twenty**.',
        '**The cache way**: keep the computed answer in memcached and look there first. Now the application owns a second job it did not want. It must invalidate the right entries on every write, which means knowing which cached answers a given row participates in — a mapping that lives in nobody’s head and no schema. It must fill on a miss, which means the query is still there, just fired less often and now under whatever load caused the miss. And popular keys produce a **thundering herd**: an entry expires, a hundred requests miss simultaneously, and a hundred identical expensive queries hit the database at once.',
        'Reach for a stream processor and you meet the third wall. Those systems maintain results incrementally and are good at it, but they bound their state by **windowing** it — keeping only the most recent records — because otherwise it grows forever. That is a fine answer for a dashboard of the last hour and the wrong shape entirely for a website, where somebody is going to open a story from last March and expect it to load. *Windowed state does not make old data slow. It makes it unanswerable.*',
        'So the constraint. **You want the read to be a lookup and you cannot afford to keep every answer.** Precomputing everything is what makes reads cheap; a real application’s queries multiplied by their parameters is far more state than the data itself; and the two existing ways to bound that state — invalidate by hand, or forget by age — are the two things this design is trying to get away from.',
      ],
      diagram: <ThreeBackendsDiagram />,
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'Nearly every request a web application serves is a read. What follows is what happens if you stop answering them one at a time — and most of the paper’s eight pages of mechanism go on the last decision here, which is where a good idea turns into a correctness problem.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**The workload:** roughly nine reads for every write, read latency is what a user feels, and the queries are known in advance — an application has a fixed set of them, with parameters.',
              '**What you may assume:** eventual consistency is acceptable. Every one of these applications already accepted it the moment it put a cache in front of the database.',
              '**What you may not assume:** that state fits. Keeping every answer to every query fully materialised is many times the size of the data, and it is the reason nobody had built this.',
              '**What must keep working:** old data. A story from last March has to be readable. Slowly is fine; not at all is not.',
              '**And the thing that will bite you:** the queries change. Applications ship new features weekly, and a backend that needs a restart or a rebuild to add a query is a backend nobody adopts.',
            ],
            questions: [
              {
                q: 'You have decided the answers should be maintained rather than computed. Where does the maintenance live?',
                options: [
                  {
                    label: 'Compile every query into one shared data-flow graph, with base tables as roots and the views the application reads as leaves',
                    verdict: 'move',
                    why: 'One graph, not one per query, and the sharing is a real contribution rather than a detail — if two queries contain the same join, the graph contains it once, so state and processing are shared across queries that overlap. A write enters at a base table and travels down as a **delta**, not a row: the count operator emits "this key changed by one" rather than recounting anything, and a deletion travels the same edges carrying a negative sign. Notice what has disappeared. **There is no invalidation logic anywhere**, because nothing is ever invalidated — an entry is either updated by the write that affected it or it is not there. The thing Chapter 12 handed to the application has stopped existing rather than moving.',
                  },
                  {
                    label: 'Keep the cache, but have the database push invalidations into it instead of the application',
                    verdict: 'dead',
                    why: 'This is a real product category and it moves the problem without solving it. Whoever computes the invalidations still needs to know which cached answers a given row participates in, and that is exactly the mapping nobody can maintain — now it lives in the database instead of the application, where it is harder to inspect. Worse, invalidation is the wrong primitive: it throws an answer away so that somebody else recomputes it later, under load, all at once. **An update knows what changed and an invalidation has forgotten**, which is why the herd exists.',
                  },
                  {
                    label: 'Have the application write to both the tables and the derived values, in a transaction',
                    verdict: 'dead',
                    why: 'The baseline this paper measures, and it works — which is the interesting part. The cost is not correctness, it is that the optimisation colonises the design: the schema is denormalised, every write path knows about every derived value, a missed update is a wrong number that nothing detects, and a transaction appears whose only job is to stop two votes colliding on a counter. In this paper’s own application the transaction exists **solely because hotness is precomputed**; move the computation into the graph and the write-write conflict it was protecting against does not occur.',
                  },
                  {
                    label: 'Materialised views in the database — this is what they are for',
                    verdict: 'dead',
                    why: 'The closest honest answer, and the paper benchmarks a commercial database’s materialised views rather than dismissing them. Two things go wrong. Support is narrow — real systems restrict what a maintainable view may contain — and, decisively, **views must usually be rebuilt when they change**, which for a web application that ships a new query on Tuesday is an outage. The measured version also suffers on writes under a skewed workload for the same reason the hand-optimised database does: everybody is voting on the same popular story, and the maintenance contends on that row.',
                  },
                ],
              },
              {
                q: 'Keeping every answer needs many times the size of your data. How do you bound the state without making old data unanswerable?',
                options: [
                  {
                    label: 'Keep only the entries somebody has actually asked for, and derive a missing one on demand by querying upstream',
                    verdict: 'move',
                    why: 'This is **partial state**, and it is the paper. The bound is *demand* rather than *age*, which is the right axis for a website: the entry that is missing is not old, it is unpopular, and a request for it is slow rather than impossible. An operator starts **fully evicted** and fills up as it is read, so nothing is ever computed because it might be wanted. When something missing is needed, the operator sends an **upquery** — a request for one key, travelling *up* the graph, recursing further up if its ancestors are missing it too, in the worst case to the base tables. The response flows forward along the ordinary edges and fills the hole, and updates keep it current from then on. Partial materialisation is decades old in databases; what is new is making it work in a concurrent data-flow where updates are in flight while the request travels.',
                  },
                  {
                    label: 'Window the state — keep the last N records or the last week',
                    verdict: 'dead',
                    why: 'What every existing streaming system does, and precisely the thing that makes them unusable here. It bounds memory by time, which means the bound is a policy about *what questions can be answered at all* — and nobody chose that policy on the merits; it was inherited from the memory limit. A reader opening a story from last March gets nothing. **The failure is silent and total rather than slow**, and there is no amount of tuning that converts it into a latency problem.',
                  },
                  {
                    label: 'Evict by least-recently-used, and recompute the whole view when something is missing',
                    verdict: 'dead',
                    why: 'The eviction half is fine — this design’s own eviction is randomised and the paper admits that is a weakness. The recompute half is the error. Rebuilding an entire view because one key is missing does work proportional to the view, on the read path, at exactly the moment a user is waiting; and for a popular key several readers will trigger it at once. **That is the thundering herd, rebuilt inside the system that was supposed to abolish it.** The unit of repair has to be the key that is missing, which is what makes an upquery a query for one key rather than a refresh.',
                  },
                  {
                    label: 'Spill the cold state to disk and page it back in',
                    verdict: 'dead',
                    why: 'It solves memory and leaves the real problem untouched. State that has been paged out is still *stale* — the updates that arrived while it was on disk either had to be applied to it, in which case you did not save any work, or did not, in which case it is wrong and nothing says so. The insight that makes eviction safe here is different in kind: **a missing entry can simply be derived again from upstream**, so an operator is allowed to drop updates for things it is not holding, which is where the write-side saving comes from. Storage was never the difficulty.',
                  },
                ],
              },
              {
                q: 'An upquery is travelling up the graph while ordinary updates are travelling down it. What goes wrong?',
                options: [
                  {
                    label: 'A response is a snapshot and an update is a delta, and applying them in the wrong order corrupts the state permanently',
                    verdict: 'move',
                    why: 'And nothing detects it. The upquery response says "the count is 8"; a concurrent update says "add one". Apply them in the wrong order and you have 8 forever while the truth is 9 — no exception, no checksum, no repair, just a number that is quietly wrong until somebody evicts it by luck. **Ordinary updates commute and upquery responses do not**, and the whole of §4 is about that. The fix is narrower than you would guess: a join’s upquery is confined to a chain of operators processed by a *single thread*, so no update can be in flight past the ancestor while the request runs. It costs parallelism and it costs duplicated state — each chain containing a join may need its own copy of what it queries into — which is a real price honestly paid rather than argued away.',
                  },
                  {
                    label: 'Nothing much — the operators are deterministic, so any order gives the same answer',
                    verdict: 'dead',
                    why: 'Determinism is necessary and nowhere near sufficient. Commutativity is what you need, and it is exactly what an upquery response lacks: a snapshot overwrites, a delta adjusts, and "overwrite with a value computed before that delta arrived" loses the delta. The design does rely on operators being deterministic functions of their state and inputs, and it also has to **order updates totally per entry** and ensure downstream consumers see them in that order — three separate properties, and the one people forget is the one that bites.',
                  },
                  {
                    label: 'Block updates while an upquery is in flight',
                    verdict: 'dead',
                    why: 'Correct, and it converts a read miss into a write stall across the whole graph — while upqueries may recurse several levels and are the *slow* path by construction. It also gets worse under exactly the conditions you care about, because a cold working set means many misses. The design deliberately keeps processing updates on other operator chains during an upquery; the exclusion is scoped to the single chain that needs it, which is the difference between a bounded cost and a global one.',
                  },
                  {
                    label: 'Let the racing update land, then repair the entry afterwards from upstream',
                    verdict: 'dead',
                    why: 'To repair it you must first detect it, and detection is the thing you do not have — a state entry is a count, not a log of what produced it, so nothing distinguishes 8-when-it-should-be-9 from 8. You could make detection possible by keeping the provenance of every entry, and now each entry carries the set of records that derived it, which is more state than the answer and is the trap Chapter 24’s related work walked into. **When corruption is undetectable, the only workable move is to make it impossible**, which is why this is an ordering argument rather than a repair mechanism.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived partially-stateful data-flow — and the four things it must never do',
              body: [
                '**The model.** One data-flow graph for all of the application’s queries, sharing operators wherever they overlap. Writes enter at base tables and stream down as deltas that may be negative. Operators keep **partial** state — only what has been asked for — and start empty. A read of something missing sends an upquery upward, recursing if necessary; the response comes forward along the ordinary path and populates the entry, after which updates keep it current. Eviction notices travel *downward*, because an operator that has dropped an entry will start dropping updates for it, so everything downstream that depended on it must drop its own or go quietly stale.',
                '**The four invariants**, which are the actual contribution and worth reading in the paper rather than anywhere else. No entry may be missing an update that is not either in flight toward it or about to be evicted. No entry may contain a duplicated or spurious update. Anything downstream of an evicted entry must itself be evicted. And if writes stop, everything converges to what the query would have returned against the base tables. *Every mechanism in §4 exists to hold one of those four under concurrency.*',
                '**And the part that makes it a product rather than a paper.** Because partial operators start empty, adding a query is nearly free: the new operators are created evicted, they populate on demand from real reads, and existing state is reused wherever the new query overlaps an old one. The measured transition is **immediate**, against **25 seconds of stopped writes** with reuse and partial state turned off. In a separate analysis of query and schema changes from two real applications, **over 95% could be applied live.** The thing that bounds memory and the thing that lets the schema evolve are the same mechanism, which is the sort of coincidence that indicates a design has found its joint.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'A vote goes down the graph; a miss goes back up it',
      accent: 'denim',
      rung: 'Rung 3 · The reveal',
      span: 2,
      body: [
        'Watch the direction change. Steps 2 and 3 are updates flowing down and are the easy half; steps 5 and 6 are a request travelling *up* the same edges, which is the idea, and the sentence about snapshots not commuting with deltas is where the eight pages of mechanism come from.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={noriaTrace} />
        </div>
      ),
      think: {
        q: 'Partial state and windowed state both bound memory. Why is one of them a footnote and the other a paper?',
        a: '**Because they bound along different axes, and only one of those axes is a property of the question being asked.** Windowing bounds by *time*: keep the last hour, the last week, the last ten thousand records. The appeal is that it is trivially implementable — you always know what to drop next, and you can compute the bound in advance. The cost is that it silently decides which questions your system is capable of answering, and that decision was never made on the merits. Nobody sat down and concluded that a story older than a week should be unreadable; it fell out of a memory limit. So the failure is total rather than graduated: the answer is not slow, it is absent, and no amount of tuning turns one into the other. Partial state bounds by *demand*: keep what somebody asked for. Now the bound tracks the working set, which is the thing that actually determines whether a cache helps, and it adapts on its own — when an old story goes viral, reading it brings it into the working set, and it stays until it stops being read. And the failure mode is a slow request rather than a missing answer, which is a thing an engineer can reason about with a latency budget. But here is the part that makes it a paper and not a configuration flag: **you can only bound by demand if you can reconstruct what you dropped**, and reconstructing it means a request that travels *upstream, against the flow of updates, through a concurrent system that has not stopped.* That is where the difficulty is. An upquery response is a snapshot of somebody’s state; ordinary updates are deltas; the two do not commute; and applying them in the wrong order leaves a permanently wrong number that nothing detects. Windowing needs no invariants because dropping the past is safe when the past is unreachable by construction. *The general shape is worth keeping.* **A limit expressed in the units of the problem — what is being asked for — is almost always better than one expressed in the units of the machine — how much fits.** The first adapts to load you did not predict; the second turns a resource constraint into a product decision, and does it silently.',
      },
    },
    {
      n: 'Step 04',
      title: 'What it actually costs to keep every answer standing',
      rung: 'Rung 4 · The measurement',
      body: [
        'The headline first, and then the number that matters more. Serving a real application’s workload on a single sixteen-core machine, against a hand-optimised MySQL-family database with the developers’ own precomputation in place: **1,000 page views a second becomes 5,000**, at sub-100 ms 95th-percentile latency. Running the *same* hand-optimised queries it is 2.3×; the rest of the gain comes from deleting the hand optimisation and writing the aggregation into the query, which normalises the schema, reduces write load and compacts the graph. **The version with less application code in it is the faster one**, which is not how performance work usually goes.',
        'On a single representative query the gap widens and the shape of it is instructive. Under a skewed workload with 95% reads it reaches **14M requests a second** with four shards — beating a demand-filled cache in front of the database, beating a commercial database’s materialised views, and beating an **unrealistic cache-only setup** that stores no stories, no individual votes, cannot prevent double voting, and exists purely as an estimate of the floor. It wins there because the popular key is the contended one: everybody votes on the same story, so the database and the materialised view fight over that row and the cache stampedes on its invalidation, while lock-free double-buffered views have nothing to contend on. Level the workload to uniform and the advantage narrows to 5M against the database’s 3M, which is the honest way round to report it.',
        '**The state bill is the number I would take away.** The graph for the full application has **235 operators, 60 of them stateful**. Forced fully materialised it needs **789 MB** — eight times the 137 MB of base tables, and the reason everyone assumed this was impractical. With partial state, 35 of those 60 can be partial; the state that cannot be evicted **even in principle** is **73 MB, nine per cent of the total**. The other 91% is a cache that can be thrown away and re-derived. The working set that keeps reads fast is 525 MB, about 3.8× the base tables, and at ten times the data it is 2.6 GB of 7 GB — *roughly 3× the tables, which is a number an operator can budget for.*',
        'Two comparisons close it out. Against a system that compiles view definitions to native code, single-threaded, this loses on raw write throughput — **240k writes a second against 520k** with state fully populated — and uses **6.2 GB against 17 GB**, 36% of the memory, while also supporting concurrent reads, parallelism and query changes, none of which the faster system has. And with state fully *evicted* it does **1M writes a second**, because an update that lands on something nobody is holding is dropped without further work. **Evicting state makes writes faster**, which is the clearest possible statement of what partial state is buying.',
      ],
      code: {
        file: 'lobsters.sql',
        lines: [
          { t: '-- what the application asks for. that is the whole interface.' },
          { t: '' },
          { t: 'CREATE INTERNAL VIEW VoteCount AS' },
          { t: '  SELECT story_id, COUNT(*) AS vcount' },
          { t: '  FROM votes GROUP BY story_id;' },
          { t: '' },
          { t: 'CREATE VIEW StoriesWithVC AS' },
          { t: '  SELECT id, author, title, url, vcount' },
          { t: '  FROM stories' },
          { t: '  JOIN VoteCount ON VoteCount.story_id = stories.id' },
          { t: '  WHERE stories.id = ?;', hl: 'good' },
          { t: '' },
          { t: '-- the ? is the point: a parameterised query becomes a view' },
          { t: '-- you look up by key. no cache, no invalidation, no column' },
          { t: '-- on stories holding a count somebody has to remember to bump.' },
        ],
      },
      diagram: <StateBillDiagram />,
      deeper: {
        summary: 'The four invariants, and the one nobody expects',
        body: [
          'The correctness argument is the best part of this paper and the easiest to skim past, because it is written as set algebra. It is worth having in plain form, because three of the four are obvious and the fourth is the one that shapes the system.',
          '**Nothing is missing an update.** If an entry exists, then every update that should have reached it either has, or is in flight toward it, or an eviction notice for it is on its way. **Nothing is duplicated or spurious.** The records reflected in an entry are a subset of the records that should be. **If writes stop, the answer becomes right.** Eventually every entry either holds exactly what the query would return, or is evicted. Those three are what anybody would write down.',
          '**And then: descendant eviction.** If an entry is evicted, everything downstream that depends on it through a key lookup must *also* be evicted, or have a notice in flight. The reason is a consequence of an optimisation rather than of caching. Operators **drop updates that land on evicted entries** — that is where the write-side saving comes from, and it is why fully-evicted state gives four times the write throughput. But dropping an update means everything downstream never hears about it. So a downstream entry that stayed would be permanently, silently stale: not missing, not detectably wrong, just fixed at an old value while the world moved on. Eviction has to propagate *forward*, which means the system needs a static analysis of which entries depend on which, and it means partial-state operators cannot have fully-stateful descendants at all.',
          'There is a concrete case in the paper worth reading, where a story changes author and the join for a per-author aggregate upqueries a vote count that turns out to be evicted — so an eviction notice is sent for the author whose total just became unknowable. *The general point is that this is not a cache.* A cache miss is a local event with a local fix. Here a miss propagates, because the thing downstream was not storing a copy of an answer, it was storing a **derivative** of one.',
        ],
      },
    },
    {
      n: 'Step 05',
      title: 'Bound the thing by what is asked for, not by what fits',
      rung: 'Rung 5 · The design stance',
      body: [
        'The stance is one sentence and it generalises far past databases: **when you must bound a resource, bound it in the units of the problem rather than the units of the machine.** Streaming systems bounded state by time — a window, a watermark, a retention period — because time is what you can measure without understanding the workload. This one bounds it by demand, which requires being able to reconstruct what you dropped, and that requirement is where all the difficulty went. The paper puts its own claim more precisely and more usefully: partial materialisation is **well known for materialized views in databases and novel to dataflow systems**, which is the whole act in one sentence — the theory was next door the entire time.',
        'The second move is the one to steal. **Reversing the direction of a request is a design primitive.** The graph already had edges; updates flowed down them. An upquery is the observation that the same edges can carry a demand upward, which turns an eviction from a loss into a deferral. Nothing new was built to make that possible; an existing structure was read in the other direction.',
        'And notice the coincidence that indicates a good joint. Partial state exists to bound memory. It also happens to make **adding a query nearly free** — new operators are created evicted, so there is nothing to backfill, and they populate from real reads. The mechanism that solves the memory problem solves the deployment problem, and the measurements bear it out: instant transitions with it on, 25 seconds of stopped writes with it off. *When one mechanism resolves two problems that seemed unrelated, it is usually because they were the same problem.*',
        'The paper is unusually good about its limits, and lists them in the introduction rather than burying them: eventual consistency only, randomised eviction, inefficiency on sharded queries needing shuffles, incomplete SQL support, and recomputation rather than checkpointing on failure. **A limitations paragraph before the contributions is a strong signal**, and it is what lets the evaluation be read as a claim rather than a pitch.',
      ],
      diagram: <PartialNotWindowedDiagram />,
    },
    {
      n: 'Step 06',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 6 · What the graph costs',
      body: [
        '**Eventual consistency, and it is now load-bearing.** A write is visible in different views at different times, because the design refuses global coordination — which is precisely why it out-scales the previous chapter’s system past four machines. For a vote count that is fine and every application here had already accepted it by installing a cache. For anything where a user must see their own write immediately, it is a real constraint, and there is no knob.',
        '**Upqueries across a shard boundary are expensive**, because they must contact every ancestor shard. That is a cap on how far this scales, it is acknowledged, and it interacts badly with the one thing you would want to do about it — resharding — which currently funnels through a single instance.',
        '**Join upqueries cost duplicated state.** Because a join’s upquery has to run inside a single-threaded operator chain to exclude concurrent updates, each chain containing a join may need **its own copy** of the upstream state it queries into. So the memory saved by partial state is partly spent again on parallelism, and the exchange rate depends on your query shapes rather than on anything you configure.',
        '**Not everything can be partial.** Twenty-five of the sixty stateful operators here cannot, because their state has no key to look up — a front page ranks *all* stories, so every output depends on every input, and there is no single upquery that reconstructs one entry. And because a partial operator may not have a fully-stateful descendant, one unparameterised view forces full state on everything beneath it. **The 91% figure is a property of this application’s queries**, not of the design.',
        '**And failure means rebuilding.** There are no checkpoints and no replicas of operator state; a failed instance is recovered by streaming the base tables back through the graph. Fully-stateful operators must be rebuilt in full before they process anything. Partial ones get off lightly — they come back empty, as they always start — which is the one place in this chapter where the eviction story pays a dividend nobody designed for.',
      ],
      callout: {
        kind: 'bad',
        big: 'PARTIAL EVERYWHERE, EXCEPT WHERE IT MATTERS MOST',
        text: 'A view with no parameter to look up — the front page, the top twenty — cannot be partial, and it forces full state on everything below it. The queries that most need this are the ones the mechanism cannot help.',
      },
    },
    {
      n: 'Step 07',
      title: 'Where it stands in 2026',
      rung: 'Rung 7 · Descendants',
      body: [
        '**The prototype became a company and then became a library.** The research system was 45,000 lines of Rust; the work continued commercially as ReadySet, a caching layer that speaks the MySQL and Postgres wire protocols and maintains query results incrementally from the replication stream — the same idea with the base tables handed back to a real database, which is a concession that makes it deployable in front of a system somebody already runs.',
        '**And the argument with the previous chapter is worth keeping.** Benchmarked head to head, differential dataflow supports slightly more load per machine on one or two machines and **tails off above four**, reaching roughly 20M requests a second at ten machines against a linear 30M. The cause is its progress-tracking protocol, which coordinates between workers so that writes can be exposed atomically. **That coordination is the price of the guarantee**, and this system declines to pay it and offers eventually-consistent reads instead. Neither is wrong; they are answers to different questions about what a read is allowed to see.',
        '**What it did not settle.** Consistency is the obvious one — transactions are named as future work and the paper says so on its first page. But the deeper unfinished business is that both systems in this act require somebody to *build* the incremental computation. Here the application writes SQL and the system compiles it into a graph, which looks like the problem solved, until you notice that the compiler handles the SQL it handles and that the operator implementations were written by hand, one per operator, each with its own argument about why it is correct. **Add an operator and you inherit none of the theory.**',
        '*Which is the chapter that closes the act.* Two systems have now shown that maintaining an answer beats recomputing it, and neither can tell you what the incremental version of an arbitrary query *is*. That has been the state of the field since the eighties: a paper per class of query, each with its own algorithm and its own proof. The last chapter asks whether there is a procedure instead.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Partial state.',
      body: 'An operator holding only the entries somebody has asked for. Bounded by demand rather than by age, so an unpopular key is slow rather than unanswerable.',
    },
    {
      term: 'Upquery.',
      body: 'A request for one key travelling upstream, against the flow of updates, recursing until it finds state or reaches a base table. What makes eviction a deferral rather than a loss.',
    },
    {
      term: 'Eviction notice.',
      body: 'A message flowing downstream saying an entry is gone. Needed because operators drop updates for evicted entries, so anything below would otherwise be silently frozen.',
    },
    {
      term: 'External view.',
      body: 'A leaf of the graph the application reads by key — a lock-free, double-buffered hash table. Reads never touch an operator.',
    },
    {
      term: 'Negative update.',
      body: 'A delta that revokes rather than adds, carrying the same values as the record it removes and following the same path. Chapter 22’s retraction, with the policy question already answered.',
    },
  ],
  inTheWild: {
    note: '5 things that decide whether this works for you',
    points: [
      '**Count your reads before anything else.** The entire case rests on the ratio. At nine reads per write, moving work to the write side is obviously right; at parity it is a much closer call, and the paper’s own 50/50 numbers are far lower than its 95/5 ones.',
      '**Unparameterised views are the trap.** A front page, a leaderboard, a global top-N — anything where every output depends on every input — cannot be partial, and it forces full state on everything beneath it. Look for these first; they set your floor.',
      '**"It is just a cache" is the wrong model and will mislead you.** A cache miss is local. Here a miss propagates downstream as eviction, because what is downstream is a derivative of the missing thing rather than a copy of it.',
      '**Eviction makes writes faster, not just memory smaller.** Four times faster, in the measurement. An update that arrives for something nobody is holding is dropped. That is a genuinely counterintuitive property and it means a cold system is a fast system, right up until somebody reads.',
      '**Skew is where this wins and where the alternatives break.** Everyone voting on the same story is what contends a database row, stampedes a cache invalidation, and costs nothing to a lock-free view. If your load is uniform, the gap narrows a lot.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Bound a resource by demand, not by age',
        when: 'you are about to cap something with a window or a TTL. Ask whether the bound you are picking is a statement about the machine or about the question — a time bound silently decides which questions are answerable, and nobody reviews that decision.',
      },
      {
        choose: 'Read your existing edges in the other direction',
        when: 'you need a new capability and are about to build a new channel for it. A graph that carries updates one way can usually carry demand the other, which is the difference between dropping something and deferring it.',
      },
      {
        choose: 'Update, do not invalidate',
        when: 'a derived value goes stale. An update knows what changed; an invalidation has thrown that away and delegated the recomputation to whoever asks next — which is one person if you are lucky and a herd if you are not.',
      },
      {
        choose: 'Prefer an undetectable-corruption impossible to a repair mechanism',
        when: 'the wrong answer would be a plausible-looking value. If you cannot tell corrupt from correct without keeping the provenance of every row, ordering is cheaper than detection and much cheaper than provenance.',
      },
    ],
  },
  misconception: {
    think: '“Noria is a cache that knows how to invalidate itself.”',
    actually:
      'It is the opposite: **nothing is ever invalidated**, and the difference is not wordplay. A cache stores a copy of an answer and throws it away when the answer might have changed, which delegates the recomputation to whoever asks next — one person if you are lucky, a hundred simultaneously if the key was popular. Here a write streams through the graph as a delta and *updates* the answer in place, so there is no moment when the correct value is unknown and nobody has to recompute anything. What makes it genuinely not-a-cache is the eviction rule. A cache miss is a local event with a local fix: fetch it again. Here, evicting an entry forces everything downstream that depended on it to be evicted too, because operators **drop updates for entries they are not holding** — that is where four-times-faster writes come from — and a downstream entry that stayed would be permanently, undetectably stale rather than merely absent. So what sits below is not a copy of the answer, it is a *derivative* of it, and derivatives do not survive their input going missing. The other half of the misconception is about the bound. A cache evicts by age or by size, on the machine’s terms. This evicts by demand, on the question’s terms, which is why an unpopular story from last March is slow rather than unanswerable — and why bounding it that way required an entire paper: **you can only drop what you can rebuild, and rebuilding it means a request travelling upstream through a system that has not stopped moving.**',
  },
  sources: [
    {
      year: '2018',
      title: 'Noria: dynamic, partially-stateful data-flow for high-performance web applications — Gjengset et al. (OSDI)',
      url: 'https://www.usenix.org/conference/osdi18/presentation/gjengset',
      note: 'Read **§4** and skip nothing in it — the four invariants are the paper, and the mechanisms only make sense as answers to them. **§8.4** on state size is the two pages that decide whether you would ever do this: 789 MB fully materialised, 73 MB that cannot be evicted. The introduction lists the system’s limitations *before* its contributions, which is worth noticing as a piece of scientific writing.',
    },
    {
      year: '2021',
      title: 'Towards a Dataflow-Driven Database — Jon Gjengset (MIT PhD thesis)',
      url: 'https://jon.thesquareplanet.com/papers/phd-thesis.pdf',
      note: 'The long version by the first author, and much better than the paper if you actually want to build one of these. It has room to explain the upquery correctness argument properly rather than in eight compressed pages, and it is written in a voice that admits which parts were hard.',
    },
    {
      year: '2013',
      title: 'Scaling Memcache at Facebook — Nishtala et al. (NSDI)',
      url: 'https://www.usenix.org/system/files/conference/nsdi13/nsdi13-final170_update.pdf',
      note: 'Chapter 12, and the world this paper is arguing with. Re-read §3.2 on thundering herds directly before the evaluation above and the skewed-workload result stops being a benchmark and starts being an answer to a specific, named, well-documented misery.',
    },
    {
      year: '2012',
      title: 'DBToaster: Higher-order Delta Processing for Dynamic, Frequently Fresh Views — Ahmad, Kennedy, Koch, Nikolic (VLDB)',
      url: 'https://www.vldb.org/pvldb/vol5/p968_yanifahmad_vldb2012.pdf',
      note: 'The system that wins the single-threaded write benchmark here, by compiling view definitions to native code, and a good demonstration that "faster" is a question with several axes. It has no concurrent reads, no parallelism and no query changes — read the comparison in §8.2 for an unusually fair account of a competitor’s advantages.',
    },
    {
      year: '2014',
      title: 'Easy Freshness with Pequod Cache Joins — Kate, Kohler, Kester, Narula, Mao, Morris (NSDI)',
      url: 'https://www.usenix.org/conference/nsdi14/technical-sessions/presentation/kate',
      note: 'Partial materialisation in response to client demand, four years earlier and by an overlapping group, for static queries and without sharing across them. The clearest way to see what this chapter’s contribution actually adds, and short.',
    },
  ],
  seenIn: [
    { label: 'The Most Common Derived Copy — Ch 12', to: '/papers/memcache', live: true },
    { label: 'Change as the Unit of Work — Ch 24', to: '/papers/differential', live: true },
    { label: 'When It Happened, and When You Heard — Ch 22', to: '/papers/dataflow', live: true },
    { label: 'One Engine, Both Shapes — Ch 19', to: '/papers/naiad', live: true },
  ],
  finale: {
    title: 'You can only drop what you can rebuild',
    body: 'Nearly every request a web application serves is a read, and both standard answers put the expensive work on it — the database recomputes, the cache recomputes on a miss and makes invalidation somebody’s job. Compile the queries into one data-flow graph instead and writes update the answers as they pass through, so a read is a key lookup and invalidation stops existing rather than moving. The obstacle was always state: every answer to every query, fully materialised, is eight times the size of the data. Streaming systems bounded that by time, which does not make an old story slow, it makes it unanswerable. Bound it by demand instead — keep what somebody asked for, start empty, and derive a missing entry by sending a request back up the same edges the updates came down. That works, and paying for it takes eight pages, because an upquery response is a snapshot, ordinary updates are deltas, the two do not commute, and getting the order wrong leaves a number that is quietly wrong forever. The bill: 73 MB that cannot be evicted where 789 MB would otherwise be needed, five times the throughput of a hand-optimised database, eventual consistency, and no help at all for the queries with no key to look up. What neither this chapter nor the last can tell you is what the incremental version of an arbitrary query *is*.',
  },
  next: { title: 'Incremental by Construction', slug: 'dbsp' },
}
