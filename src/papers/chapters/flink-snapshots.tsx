import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { BarrierAlignDiagram, SnapshotCostDiagram, ExactlyOnceLedgerDiagram } from '../diagrams'
import { flinkSnapshotsTrace } from './flink-snapshots-trace'

/* The act's closer, and the shortest paper in the book — eight pages, one
   algorithm, one graph of results. The chapter is worth an evening for two
   reasons that are not "here is how Flink checkpoints".

   First, it is the payoff for Chapter 7. Chandy-Lamport has been sitting in
   this book since Act III of season 1 as a beautiful thing nobody used, and
   this is what it was for — with the channel states dropped, because a
   dataflow graph with ordered channels makes them redundant. That deletion is
   the contribution and it is one paragraph long.

   Second, it settles Act I's argument. Chapter 18 recovered by recomputing and
   could only do it because nothing was mutable; chapter 19 recovered by
   stopping the world and paid for it in throughput. This is the third answer,
   and the evaluation is the only place in the act where the three are directly
   compared on the same engine. */

export const flinkSnapshots: Chapter = {
  slug: 'flink-snapshots',
  act: 'Act II · Time Is Not When It Arrived',
  paperNo: 'Paper 23',
  title: 'A Photograph of a Moving System',
  dek: 'Three chapters of machinery, all of it state, and a machine that is going to die holding it. The answer is a marker walking through the graph — and it is a thirty-year-old algorithm with its most expensive part removed.',
  minutes: 15,
  paper: {
    title: 'Lightweight Asynchronous Snapshots for Distributed Dataflows',
    authors: 'Paris Carbone, Gyula Fóra, Stephan Ewen, Seif Haridi, Kostas Tzoumas',
    venue: 'arXiv (KTH · SICS · data Artisans)',
    year: '2015',
    url: 'https://arxiv.org/abs/1506.08603',
  },
  caption:
    'Everything this act has built is state. Windows held open in case something late arrives; panes buffered so a correction can be routed; emitted values kept so they can be retracted; per-key counts that are the answer itself. None of it can be recomputed the way Chapter 18 recomputed a lost partition, because it depends on which records arrived and in what order. So a machine is going to die holding it, and the two answers this book has offered so far are both unavailable. Chapter 18 replayed a recipe, which needs immutability. Chapter 19 **stopped every worker in the cluster**, wrote everything down, and started again — which works, and means the price of being safe rises in direct proportion to how often you want to be safe. This paper is eight pages long and deletes most of that price, using an algorithm that has been sitting in this book since Chapter 7 waiting for somebody to need it.',
  steps: [
    {
      n: 'Step 01',
      title: 'Two ways to photograph a system, and both are expensive',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'You need a **consistent** picture of a running distributed computation — one where, if an operator’s state reflects having consumed a record, the operator that sent that record shows it as sent. Anything less and recovery produces a result that never could have happened: a count that includes a record its source will replay, or excludes one nobody will send again.',
        'The obvious way is to stop. Pause every worker, drain the queues, write the state, resume — which is what the previous engine in this book does, and it is correct. Its cost is not the writing; it is the **not processing.** The paper measures it directly: on a ten-node cluster the runtime penalty for stopping the world grows sharply as snapshots get more frequent, because the system spends more of its life not working. And the cost lands in bursts of a second or two, which for a latency-critical pipeline is worse than a steady tax, *because an SLA is violated by the bad seconds and not by the average one.*',
        'The other classical way is a distributed snapshot algorithm, and there has been one since 1985. **Chandy–Lamport**, which Chapter 7 covered and which nothing in Season 1 actually used, records a consistent cut without any global pause. Its cost is different and also real: it captures the **state of every channel** — every message in flight between every pair of processes — as part of the snapshot. For a high-throughput dataflow with full network shuffles, that is a great deal of data whose only purpose is to be replayed into operators that will consume it immediately.',
        'So the constraint is a genuine fork with no obvious third road. **Pause and pay in throughput, or do not pause and pay in the size of what you store.** The paper’s whole contribution is noticing that the second cost is avoidable in this particular shape of system, and that the reason is something the system already guarantees for other purposes.',
      ],
      diagram: <SnapshotCostDiagram />,
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'Only two, which is honest for a paper that is eight pages long and does one thing. Almost everybody gets the second one wrong on the first attempt.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**What you are protecting:** operator state — per-key aggregates, open windows, buffered panes, source offsets. It is mutable, it depends on the order records arrived in, and it cannot be recomputed from a description.',
              '**The shape of the system:** a directed graph of operators. Channels are quasi-reliable, deliver in FIFO order, and can be blocked and unblocked. Some graphs contain loops.',
              '**What you may not do:** stop the world. This is a latency system and the snapshot has to happen often — every few seconds — so anything whose cost scales with frequency is disqualified.',
              '**What recovery has to give you:** a state that could actually have occurred. If an operator counted a record, whoever sent it must agree it was sent.',
              '**What you already have:** replayable sources with offsets, so anything you can prove was not yet consumed can simply be read again.',
            ],
            questions: [
              {
                q: 'You need every operator to write its state at the “same” moment, without a global clock and without stopping anything. How do you say when?',
                options: [
                  {
                    label: 'Put a marker into the data stream itself, and let it travel the ordinary channels with the ordinary records',
                    verdict: 'move',
                    why: 'The move is that the **barrier is a record, not a signal.** An out-of-band message asking operators to snapshot arrives at an arbitrary point in each one’s input, so nobody can say what it means. A marker inserted into the stream arrives at a *defined* point, because the channels deliver in order — so it cuts the stream cleanly into everything produced before the snapshot and everything after. An operator does not need a clock, or a coordinator round trip, or knowledge of the topology. **It only has to notice a marker go past**, which is the smallest possible thing to ask of a component that is busy. The coordinator’s entire job shrinks to injecting barriers at the sources periodically.',
                  },
                  {
                    label: 'Have the coordinator send every operator a “snapshot now” RPC',
                    verdict: 'dead',
                    why: 'The RPCs arrive at different moments, so each operator writes a state reflecting a different amount of its input, and the union is not a cut any execution could have produced. You can rescue it by making every operator *pause* on receipt until everyone has confirmed — and you have rebuilt the stop-the-world algorithm, complete with its cost. **The problem was never getting the message out; it was that “now” has no meaning across machines** unless something in the data itself defines it, which is Chapter 7’s argument arriving twenty-five chapters later.',
                  },
                  {
                    label: 'Have every operator snapshot on a timer, with clocks synchronised well enough',
                    verdict: 'dead',
                    why: 'Even with perfect clocks this is wrong, and that is the interesting part. Operator B’s state at 12:00:00 reflects records that left operator A *before* 12:00:00 — but which ones is a function of network delay nobody knows. So the pair of states is only consistent if you also know exactly what was in flight, which is the channel-state cost this design exists to avoid. **Simultaneity in wall-clock time is not the property you need.** The property you need is a consistent cut, and those are not the same thing.',
                  },
                  {
                    label: 'Have each operator snapshot after every N records, and record N so recovery can line them up',
                    verdict: 'dead',
                    why: 'Counting is local and the graph is not. Operator B’s 1,000th record does not correspond to operator A’s 1,000th — a filter drops things, a flatMap multiplies them, a shuffle mixes several senders. So the counts have no relation to each other and lining them up at recovery is not possible, only imaginable. *Any scheme where each operator decides for itself when to snapshot has this shape;* the decision has to be carried by something that visits all of them in order, which is what the marker is.',
                  },
                ],
              },
              {
                q: 'An operator has two inputs. The barrier arrives on one of them. What does it do?',
                options: [
                  {
                    label: 'Block that input and keep processing the other, until the barrier arrives there too — then snapshot',
                    verdict: 'move',
                    why: 'This is **alignment**, and it is what makes the snapshot mean something: when both barriers have arrived, the operator has processed exactly the records that preceded the barrier on every input, and none that followed on any. Its state is a clean cut. Two details are worth having exactly right. The block **buffers, it does not drop** — the early input’s records wait and are processed the moment the barrier is forwarded. And the operator **broadcasts the barrier before writing its state**, not after, so downstream operators begin their own alignment while this one is still writing and the work overlaps rather than rippling down the graph. *The only pause anywhere is one input of one operator, for as long as its siblings take to catch up.*',
                  },
                  {
                    label: 'Snapshot immediately — it has a barrier, that is the signal',
                    verdict: 'dead',
                    why: 'The most natural first answer and it silently produces an impossible state. The operator has consumed records from the second input that came *after* that input’s barrier, so its state includes work belonging to the next snapshot. Recover from it and those records get replayed from the source and counted twice, while the state claims a consistency it does not have. **Nothing detects this** — the snapshot completes, recovery succeeds, and one number is wrong. The whole value of alignment is turning a subtle correctness property into a mechanical rule an operator can follow without understanding it.',
                  },
                  {
                    label: 'Wait for both barriers but keep processing both inputs meanwhile, and note which records came after',
                    verdict: 'dead',
                    why: 'This works and it is the expensive version. Recording which post-barrier records you consumed means storing them, so you have reinvented channel state — the exact cost this design set out to remove — and you now need logic to subtract their effect at recovery, which requires the operator to be reversible. **Blocking is cheaper than remembering**, and it is cheaper precisely because the wait is short: a few records on one channel, not a general-purpose undo.',
                  },
                  {
                    label: 'Snapshot when the last barrier arrives, but forward the barrier only after the state is safely written',
                    verdict: 'dead',
                    why: 'Correct, and needlessly slow in a way that compounds. Downstream operators cannot begin aligning until this one has finished writing, so the snapshot walks the graph one stage at a time and total duration is the *sum* of every stage’s write. Broadcast first and the writes overlap, so the duration is closer to the slowest single one. The state being written is a copy taken at the moment of alignment, so forwarding early is safe — *and the difference between summing and maxing is the whole reason this can run every few seconds.*',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived asynchronous barrier snapshotting — and what got deleted',
              body: [
                '**The algorithm, in full.** A coordinator injects barriers into the sources. A source snapshots its offset and broadcasts the barrier. A non-source operator blocks each input as its barrier arrives; when all inputs have delivered one, it broadcasts the barrier, writes its state, and unblocks. When the barriers reach the sinks, the snapshot is complete. Recovery resets every operator to its state and every source to its offset. That is the entire thing, and the pseudocode is about twenty lines.',
                '**What was deleted, and why it is the contribution.** Chandy–Lamport records the state of every channel as well as every process. Here the global snapshot contains **operator states and nothing else.** The justification is one observation: a record that crossed a channel before the barrier is *already reflected in the state of the operator that consumed it*, and a record that crossed after belongs to the next snapshot — so the channel contents are redundant given FIFO ordering and alignment. **The paper is the first to take the minimum state possible for acyclic topologies**, and the deletion is what makes snapshotting cheap enough to do every few seconds.',
                '**And the case that does not simplify.** A cycle deadlocks the algorithm as stated — operators in a loop wait forever for a barrier from an input fed by their own output — and records circulating inside the loop would be lost. The fix is narrow: identify back-edges by static analysis, treat the rest of the graph as acyclic, and have each consumer of a back-edge **log the records it receives from that edge** between forwarding the barrier and receiving it back. So channel state comes back, for exactly the edges that need it and no others. *That is the shape of a good simplification: not that the hard case disappears, but that it stops being everybody’s cost.*',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'A marker walks through a running dataflow',
      accent: 'denim',
      rung: 'Rung 3 · The reveal',
      span: 2,
      body: [
        'Back to a trace rather than a timeline, and deliberately: this chapter is about a marker moving through a topology and what happens where two edges meet, which is what boxes and arrows are for.',
        'Step 4 is the only pause in the whole algorithm, step 6 is the thing that was deleted, and step 7 is how short recovery turns out to be once you have the right picture.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={flinkSnapshotsTrace} />
        </div>
      ),
      think: {
        q: 'Chapter 7 covered Chandy–Lamport in 1985 and nothing in Season 1 used it. Why did it take thirty years to find a home?',
        a: '**Because the algorithm needs a property that general distributed systems do not have and dataflow systems get for free.** Chandy–Lamport works on any system of processes exchanging messages, and that generality is exactly what makes it expensive: with an arbitrary communication graph, arbitrary message ordering and processes that may talk to anyone at any time, there is no way to know what a marker’s arrival implies about the messages that came before it — so the algorithm has to capture them explicitly, and channel state is the price of assuming nothing. Now look at what a dataflow graph gives you. The topology is **fixed and known** before execution starts. Channels are **FIFO**. Data flows in one direction, from sources toward sinks. Operators consume from their inputs and produce to their outputs and communicate no other way. Under those conditions the marker’s arrival implies everything you needed the channel state for: everything ahead of it has been consumed and is already in somebody’s state; everything behind it has not been consumed and can be read again from a source that remembers its offset. *The channel contents were never information. They were a consequence.* And that is the general lesson, which is worth more than the algorithm: **a famous general result often has an expensive component that exists to cover a case your system cannot produce.** The engineering is not inventing something new — it is identifying which of your constraints makes part of the general answer redundant, and then being willing to say so. Notice too that the cyclic case is where the constraint breaks: a loop means a record can be in flight on an edge whose contents are not implied by anything, and the fix is to log exactly those edges. **The deletion is justified by a property, so it survives exactly as far as the property does.**',
      },
    },
    {
      n: 'Step 04',
      title: 'What it costs, next to stopping the world',
      rung: 'Rung 4 · The measurement',
      body: [
        'The evaluation is small and it is the only place in this act where two recovery strategies are compared on the same engine, which makes it worth more than its size. A topology of **six operators**, parallelism equal to the cluster size, **three full network shuffles** deliberately included to accentuate any cost from blocking, and **one billion records** through it on up to 40 EC2 instances.',
        'The comparison is against the stop-the-world algorithm from Chapter 19 — reimplemented on the same engine, so the difference is the algorithm rather than the codebase. At long snapshot intervals the two are close, because stopping the world in bursts of a second or two and then running normally is cheap when it happens rarely. **As the interval shortens, they separate sharply**: the synchronised version’s cost rises with frequency, because the system spends a growing share of its life not processing anything. The barrier version stays close to the no-fault-tolerance baseline at every interval.',
        'That shape is the whole result and it is worth stating as a principle rather than a graph. **Stopping the world makes safety a tax proportional to how safe you want to be**, so every team eventually snapshots less often than they would like and discovers at recovery time how much reprocessing that bought them. The barrier version decouples the two: you may snapshot every three seconds, and recovery costs three seconds of replay.',
        'The scaling result is the boring one and is included honestly: fixed input, parallelism from 5 to 40 nodes, snapshots every 3 seconds, and both the baseline and the snapshotted job scale linearly. *No claim is made that this is fast* — the claim is that turning it on does not change the shape of your performance, which is the only claim a fault-tolerance mechanism should be making.',
      ],
      code: {
        file: 'abs.txt',
        lines: [
          { t: '# the whole algorithm, for an operator with N inputs' },
          { t: '' },
          { t: 'on barrier from input i:' },
          { t: '    block(i)' },
          { t: '    if every input has now delivered a barrier:' },
          { t: '        broadcast the barrier downstream', hl: 'good' },
          { t: '        write my state' },
          { t: '        unblock every input' },
          { t: '' },
          { t: 'on record from input i:' },
          { t: '    state, out = f(record, state)' },
          { t: '    send out' },
          { t: '' },
          { t: '# broadcast BEFORE writing: downstream starts aligning while' },
          { t: '# this operator is still writing, so the writes overlap' },
        ],
      },
      diagram: <BarrierAlignDiagram />,
      deeper: {
        summary: 'The loop, where the deletion stops working',
        body: [
          'Run the algorithm as stated on a graph with a cycle and it deadlocks. An operator inside the loop waits for barriers on all its inputs, and one of those inputs is fed, eventually, by its own output — which will not produce a barrier until it has received one. Everybody waits forever. And even if it did terminate, records circulating inside the loop at snapshot time are in flight on a channel whose contents nothing implies, so they would simply vanish on recovery.',
          'The fix keeps the deletion everywhere it is valid and pays only where it is not. **Back-edges are identified by static analysis** — an edge pointing to a vertex already visited in a depth-first search — and removing them leaves a directed acyclic graph containing every operator. The algorithm runs on that DAG exactly as before: an operator with back-edge inputs takes its state copy once all its *regular* inputs have delivered barriers, and broadcasts immediately, which is what avoids the deadlock.',
          'Then the one addition. From that moment until the barrier comes back around the loop, the operator **logs every record it receives on its back-edges**. Those records are in the snapshot, and on recovery they are put back in flight. So the final snapshot is all operator states plus the back-edge records only — a strict subset of what the classical algorithm would have stored, and paid for exactly by the graphs that need it.',
          '*The pattern is worth taking away from the paper independently of streaming.* An optimisation justified by a structural property should degrade to the general algorithm precisely where the property fails — not fall over, and not silently give a wrong answer. Here the property is "a channel’s contents are implied by what is downstream of it", the failure case is a cycle, and the degradation is exactly as large as the cycle.',
        ],
      },
    },
    {
      n: 'Step 05',
      title: 'Find the constraint that makes the general answer wasteful',
      rung: 'Rung 5 · The design stance',
      body: [
        'The stance is small and unusually clean: **take a correct general algorithm, identify which of its costs exists to handle a case your system cannot produce, and delete that cost.** Not a new algorithm; a subtraction, with an argument for why the subtraction is safe.',
        'Notice how much rests on constraints the system already had for other reasons. FIFO channels exist because a dataflow engine wants ordered delivery anyway. A known, fixed topology exists because the graph is compiled before execution. Replayable sources exist because Chapter 20 established that anyway, for recovery. **None of those was added for snapshotting.** The paper found that three properties already present, taken together, make a whole component of the classical algorithm redundant.',
        'And it is honest about the boundary, which is what makes the stance repeatable rather than lucky. The deletion is justified by a property; where the property fails — cycles — the cost comes back, scoped to exactly the edges that break it. *An optimisation whose author cannot tell you where it stops being valid is not an optimisation, it is a hope.*',
        'The paper is also candid that this is early work with obvious room left. It names the next step itself: decouple the snapshotted state from the operational state, so tasks could keep processing while persisting, removing even the short alignment pause — at a cost in computation, space and network I/O that they had not yet measured. **Naming your own unfinished business in a conclusion is rarer than it should be**, and it is why the follow-up work knew where to start.',
      ],
      diagram: <ExactlyOnceLedgerDiagram />,
    },
    {
      n: 'Step 06',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 6 · What the marker costs',
      body: [
        '**Alignment stalls, and the stall is as long as your slowest input.** The pause is small in the common case and it is a real pause, and its duration is set by whichever upstream branch is furthest behind. So a skewed or backlogged input does not merely lag — it holds up its siblings at every operator that joins them, at every snapshot. **The cost of the algorithm is a function of how balanced your graph is**, which is not a property most people are tracking.',
        '**The whole thing rests on assumptions the outside world does not honour.** Channels must be quasi-reliable and FIFO, and blockable. Sources must be replayable to an offset. Where any of that fails — an unordered source, a channel you do not control, a sink that cannot be rewritten — the guarantee stops at that boundary, and nothing announces where the boundary is.',
        '**Recovery is still global.** This is the one that gets forgotten because the *snapshot* is asynchronous: on failure, every operator resets to the last snapshot and every source rewinds. One dead machine costs the whole job the work since the last barrier. That is much better than Chapter 19, where one dead process cost everybody everything since the last stop-the-world pause — and it is still nothing like Chapter 18’s per-partition rebuild. *The paper names per-task-granularity recovery as future work, which is the correct place for it.*',
        '**And loops pay the old price.** Back-edge records are logged for the duration of a snapshot, so an iterative computation gets back exactly the channel-state cost the acyclic case deleted — bounded to the cycle, and real. **The optimisation is precisely as good as the structure it depends on**, which is honest and is also a constraint on what you can build inside one.',
      ],
      callout: {
        kind: 'bad',
        big: 'ASYNCHRONOUS SNAPSHOT, GLOBAL RECOVERY',
        text: 'Taking the picture no longer stops the world. Using it still does — every operator resets and every source rewinds to the last barrier. The mechanism that got cheap was the insurance premium, not the claim.',
      },
    },
    {
      n: 'Step 07',
      title: 'Where it stands in 2026 — and what Act II settled',
      rung: 'Rung 7 · The end of the act',
      body: [
        '**This is how stateful stream processing recovers, essentially everywhere.** It is Flink’s checkpointing mechanism and it has been extended rather than replaced: incremental checkpoints that write only what changed, unaligned checkpoints that trade a little channel state back for the removal of the stall under backpressure, and savepoints — an operator-triggered snapshot you can restart a modified program from, which turned "deploy a new version of a streaming job" from an outage into an operation.',
        '**And Chapter 7 finally got its payoff.** Chandy–Lamport spent thirty years as the elegant result everybody teaches and nobody runs. What it needed was not a better algorithm but a system whose constraints made its expensive half unnecessary — which is worth remembering next time a classical result looks impractical. *The question to ask is not whether it is too expensive, but which of its costs is paying for a case you have ruled out.*',
        '**What this act settled.** Act I got the delay from hours to seconds and left one assumption untouched: that a record’s place in the queue tells you when it happened. This act removed it. You can now compute a bound on completeness instead of guessing a timeout; you can name which of three clocks you meant; you can decide separately where data is grouped, when you speak about it, and what a later answer does to an earlier one; and you can survive a machine dying in the middle of all that without stopping to protect yourself. **The delay is down to seconds and the answers are now right about a world that is out of order**, which is a different achievement from making them fast.',
        '**And here is the assumption this act leaves standing.** Every chapter so far has taken a query and re-run it — over a smaller batch, over a window, over a pane, but re-run. The advertiser’s dashboard recomputes its window when a trigger fires. Ten thousand of those dashboards recompute the same thing over data that barely moved. *Nothing in this book has yet asked why an answer should be computed at all, rather than maintained.* The next act treats a change as the unit of work, so that a write updates the answer instead of invalidating it — and the argument starts from the observation that Chapter 12 already told us invalidation is the hard part.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Barrier.',
      body: 'A marker injected into the data stream itself and carried on the ordinary channels. Divides the stream into records before the snapshot and records after it.',
    },
    {
      term: 'Alignment.',
      body: 'An operator blocking each input as its barrier arrives, until every input has delivered one. What makes the snapshotted state a cut that could actually have occurred.',
    },
    {
      term: 'Consistent cut.',
      body: 'A global state in which every received message was also sent. The property recovery needs, and not the same thing as every machine writing its state at the same wall-clock moment.',
    },
    {
      term: 'Back-edge.',
      body: 'An edge pointing at an already-visited vertex — a loop. Removing them leaves a DAG; records on them are logged for the duration of a snapshot, which is the one place channel state survives.',
    },
    {
      term: 'Savepoint.',
      body: 'Not in this paper: a snapshot taken on request rather than on a schedule, that a modified program can be restarted from. What turned upgrading a streaming job into an operation instead of an outage.',
    },
  ],
  inTheWild: {
    note: '5 ways this bites in production',
    points: [
      '**One skewed input makes every snapshot slow.** Alignment waits for the furthest-behind branch, so a backlogged source turns a millisecond stall into a long one — at every joining operator, every snapshot. The symptom is checkpoint duration climbing while nothing about the checkpoint changed.',
      '**Under backpressure, alignment and backpressure feed each other.** A slow operator makes a barrier take longer to arrive, which lengthens alignment, which slows things further. This is exactly why unaligned checkpoints were added later, and why the setting exists at all.',
      '**Snapshot interval is tuned for the good day.** The cost is small, so people set it generously — and then discover at recovery that generous means replaying everything since the last one, at a moment when the backlog is already growing.',
      '**The sink was not idempotent and nobody checked.** Recovery replays records from the source offsets in the snapshot, so anything already written between the barrier and the crash is written again. Same requirement as Chapter 20, same silent failure.',
      '**State outgrows the machine and the checkpoint becomes the bottleneck.** The algorithm is cheap; writing a large state is not. Teams meet this as “checkpoints started timing out”, which is a storage problem wearing a snapshotting problem’s clothes.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'A marker in the data, not a message about the data',
        when: 'you need components to agree on a moment and they have no shared clock. A marker travelling the ordinary ordered channels arrives at a defined point in everyone’s input; a side-channel message arrives at an arbitrary one, and no amount of care fixes that.',
      },
      {
        choose: 'Delete the part of a general algorithm your constraints make redundant',
        when: 'a classical result looks too expensive. Ask which of its costs covers a case your system cannot produce — and then be able to say exactly where your property fails, because that is where the cost must come back.',
      },
      {
        choose: 'Block briefly rather than remember',
        when: 'the alternative is recording what you consumed so you can subtract it later. Waiting a few records is cheaper than a general-purpose undo, and it does not require the operation to be reversible.',
      },
      {
        choose: 'Broadcast before you persist',
        when: 'a phase has to sweep a pipeline. Forwarding first lets every stage overlap its work, so total duration is the slowest stage rather than the sum of all of them — which is the difference between snapshotting every few seconds and every few minutes.',
      },
    ],
  },
  misconception: {
    think: '“Flink checkpoints are just Chandy–Lamport, so this paper is an implementation report.”',
    actually:
      'It is Chandy–Lamport **with the expensive half removed**, and the removal is the paper. The 1985 algorithm records the state of every process *and the contents of every channel* — every message in flight between every pair — because it assumes nothing about the communication graph, and under that assumption the in-flight messages are genuinely information you cannot reconstruct. A dataflow engine is not that general. Its topology is fixed and known, its channels deliver in FIFO order, data moves one way from sources toward sinks, and its sources can be rewound to an offset. Under **those** constraints the channel contents stop being information and become a consequence: a record that crossed before the barrier is already reflected in the state of whoever consumed it, and one that crossed after will simply be read again from the source. So the snapshot is operator states and nothing else, which is what makes it cheap enough to run every few seconds — and the measured difference against stopping the world grows precisely as the interval shrinks. *The contribution is not the algorithm, it is the argument that a component of it was redundant here*, and the paper earns that by showing exactly where the argument fails — cycles — and paying the old price only on the back-edges that break it.',
  },
  sources: [
    {
      year: '2015',
      title: 'Lightweight Asynchronous Snapshots for Distributed Dataflows — Carbone, Fóra, Ewen, Haridi, Tzoumas',
      url: 'https://arxiv.org/abs/1506.08603',
      note: 'Eight pages, and **§4.2** is two of them — read the twenty lines of pseudocode and the proof sketch beside it, which is the whole idea. Then **§4.3** on cycles, which is the more instructive half: watch a clean simplification meet the case that breaks it and degrade in exactly the right amount. The evaluation is one graph and it is the only direct comparison in this act between two recovery strategies on one engine.',
    },
    {
      year: '1985',
      title: 'Distributed Snapshots: Determining Global States of Distributed Systems — Chandy & Lamport (ACM TOCS)',
      url: 'https://lamport.azurewebsites.net/pubs/chandy.pdf',
      note: 'Chapter 7, and the thirty-year-old parent. Read it directly before the paper above and the deletion becomes obvious rather than clever: the channel recording is right there, doing work that a fixed FIFO topology makes unnecessary. It is also just a beautiful piece of writing, and short.',
    },
    {
      year: '2013',
      title: 'Naiad: A Timely Dataflow System — Murray et al. (ACM SOSP)',
      url: 'https://dl.acm.org/doi/10.1145/2517349.2522738',
      note: 'Chapter 19, and the system this paper benchmarks against — its stop-the-world snapshotting was reimplemented on the same engine to make the comparison fair, which is more care than most evaluations take. Read §3.4 of it beside §7 of this one to see the same problem answered twice.',
    },
    {
      year: '2015',
      title: 'Apache Flink: Stream and Batch Processing in a Single Engine — Carbone et al. (IEEE Data Eng. Bull.)',
      url: 'https://asterios.katsifodimos.com/assets/publications/flink-deb.pdf',
      note: 'The system paper by overlapping authors, for the context this one omits — where the snapshots sit inside a whole engine, and how the same runtime serves batch and streaming from the streaming side rather than the batch side. The right companion if Act I’s unification argument interested you.',
    },
    {
      year: '2017',
      title: 'State Management in Apache Flink — Carbone, Ewen, Fóra, Haridi, Richter, Tzoumas (VLDB)',
      url: 'https://www.vldb.org/pvldb/vol10/p1718-carbone.pdf',
      note: 'What the idea grew into: incremental snapshots that write only what changed, queryable state, and the rescaling story. Read it if you are actually operating one of these — the gap between the eight-page algorithm and a system that can be upgraded on a Tuesday is most of what this paper covers.',
    },
  ],
  seenIn: [
    { label: 'When It Happened, and When You Heard — Ch 22', to: '/papers/dataflow', live: true },
    { label: 'What “Before” Even Means — Ch 7', to: '/papers/lamport', live: true },
    { label: 'One Engine, Both Shapes — Ch 19', to: '/papers/naiad', live: true },
    { label: 'The Cost of Starting Over — Ch 18', to: '/papers/spark', live: true },
  ],
  finale: {
    title: 'The half of the algorithm you did not need',
    body: 'Three answers to one question now sit next to each other. Recompute from a recipe, which needs immutability and cannot help you here. Stop every worker in the cluster, which is correct and charges you in proportion to how often you want to be safe. Or push a marker through the running graph, let each operator block one input until its siblings catch up, and write nothing about the wires at all — because a fixed topology with ordered channels makes the wires a consequence rather than a fact. That last one is a thirty-year-old algorithm with its expensive half removed, and the removal is justified by properties the engine already had for other reasons. Act II is finished: the answers are now right about a world that arrives out of order, and they survive the machine that dies holding them. What none of it has questioned is why an answer is computed at all, rather than maintained — which is the next act.',
  },
  next: { title: 'Change as the Unit of Work', slug: 'differential' },
}
