import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* Back to a trace rather than a timeline, and deliberately so. The two
   chapters before this are about time domains, which boxes and arrows cannot
   draw. This one is about a marker travelling through a topology and what
   happens where two edges meet — which is exactly what boxes and arrows are
   for, and drawing it on the timeline would say something false.

   Colours: blue for the sources, because they are the front door. Amber for
   the coordinator and the barrier's own colour, because injecting and aligning
   markers is coordination machinery and nothing else. Green where the answer
   accumulates. Violet for durable storage. Red only where a machine dies.

   The one geometric decision worth recording: the coordinator's line to the
   commit runs along the channel at y=45, under the whole graph, because the
   direct route grazes the aggregate's lower edge with under a unit of
   clearance and would be one careless nudge away from cutting a label. */
const C = {
  door: VIZ.blue,
  coord: VIZ.amber,
  answer: VIZ.green,
  durable: VIZ.violet,
  bad: VIZ.red,
}

export const flinkSnapshotsTrace: TraceSpec = {
  title: 'A marker walks through a running dataflow, and nothing stops to let it',
  aspect: 0.5,
  zones: [
    { label: 'Who asks', x: 2, y: 4, w: 20, h: 42 },
    { label: 'The dataflow, still running', x: 24, y: 4, w: 46, h: 42 },
    { label: 'Durable', x: 72, y: 4, w: 26, h: 42 },
  ],
  nodes: [
    { id: 'coord', x: 4, y: 18, w: 16, h: 9, label: 'Coordinator', sub: 'injects barriers', color: C.coord },
    { id: 's1', x: 27, y: 8, w: 17, h: 7, label: 'Source A', sub: 'offset 4,201', color: C.door },
    { id: 's2', x: 27, y: 32, w: 17, h: 7, label: 'Source B', sub: 'offset 9,880', color: C.door },
    { id: 'm1', x: 48, y: 8, w: 20, h: 7, label: 'Filter', sub: 'no state at all', color: C.coord },
    { id: 'agg', x: 48, y: 22, w: 20, h: 7, label: 'Aggregate', sub: 'per-key counts', color: C.answer },
    { id: 'sink', x: 48, y: 36, w: 20, h: 7, label: 'Sink', sub: 'commits the epoch', color: C.answer },
    { id: 'store', x: 76, y: 12, w: 20, h: 9, label: 'State store', sub: 'operator state only', color: C.durable },
    { id: 'log', x: 76, y: 30, w: 20, h: 9, label: 'Snapshot n', sub: 'complete', color: C.durable },
  ],
  steps: [
    {
      title: 'Everything valuable here is state, and none of it can be recomputed',
      prose:
        'Two sources, a stateless filter, an aggregate holding per-key counts, a sink. The counts are the problem. <b>Chapter 18 could rebuild a lost partition from its recipe</b> because nothing was mutable — that does not work here, since the aggregate’s contents depend on which records reached it and in what order. <b>Chapter 19 stopped every worker in the cluster</b> to take a consistent picture. That works and it is what this chapter is arguing with: a system that pauses to protect itself is a system whose safety costs throughput in direct proportion to how safe you want to be.',
      focus: ['agg', 's1', 's2'],
      particles: [],
    },
    {
      title: 'The coordinator injects a marker — and it is a record, not a signal',
      prose:
        'A central coordinator periodically pushes a <b>barrier</b> into every source. This is the move the whole algorithm rests on: the barrier is <em>not</em> an out-of-band message telling operators to do something. It is inserted into the data stream itself, so it travels the same channels, in the same order, subject to the same delivery. Each source records its current offset as its own state and passes the barrier downstream. <em>Nothing pauses.</em> Records behind the barrier keep flowing right behind it.',
      focus: ['coord', 's1', 's2'],
      particles: [
        { from: 'coord', to: 's1', color: C.coord },
        { from: 'coord', to: 's2', color: C.coord },
      ],
    },
    {
      title: 'It divides the stream into before and after',
      prose:
        'Because the channels deliver in order, the barrier is a clean cut: <b>every record ahead of it was produced before the snapshot, every record behind it after.</b> The filter has no state, so it forwards the barrier immediately and carries on. That is the property the algorithm buys with the ordering assumption — an operator does not have to reason about time, or ask anybody anything. It only has to notice a marker go by.',
      focus: ['s1', 'm1'],
      particles: [
        { from: 's1', to: 'm1', color: C.door },
        { from: 'm1', to: 'agg', color: C.coord },
      ],
    },
    {
      title: 'Two inputs, and one of them is ahead',
      prose:
        'The aggregate has two inputs and the barrier reaches one first. It <b>blocks that input</b> — buffering, not dropping — and keeps processing the other one. This is the only pause anywhere in the algorithm, it is one input of one operator, and it lasts exactly as long as its sibling takes to catch up. <em>The rest of the graph does not know it is happening.</em> Sources are still reading, the filter is still filtering, the sink is still writing.',
      focus: ['agg', 's2'],
      particles: [{ from: 's2', to: 'agg', color: C.door }],
    },
    {
      title: 'Aligned — now write the state, and get out of the way',
      prose:
        'The barrier arrives on the second input too. The aggregate now knows it has processed <b>exactly the records before the barrier on every input and none after</b>, so its counts are a consistent cut of the computation. It writes them, forwards the barrier, and unblocks. Note the order in the algorithm: <em>broadcast the barrier first, then snapshot.</em> Downstream operators start their own alignment while this one is still writing, so the work overlaps down the whole graph instead of rippling.',
      focus: ['agg', 'store', 'sink'],
      particles: [
        { from: 'agg', to: 'store', color: C.durable },
        { from: 'agg', to: 'sink', color: C.coord },
      ],
    },
    {
      title: 'And here is what is not in the snapshot',
      prose:
        'When the barrier reaches the sinks, the global snapshot is complete — and it contains <b>operator states and nothing else.</b> No records in transit. The classical algorithm this descends from captures the messages on every channel too, and that is where the size comes from. It is unnecessary here: a record that crossed a channel before the barrier <em>is already reflected in the state of the operator that consumed it</em>, and one that crossed after belongs to the next snapshot. <b>The ordering assumption is what lets you store nothing about the wires.</b>',
      focus: ['sink', 'log', 'store'],
      particles: [
        { from: 'sink', to: 'log', color: C.durable },
        { from: 'coord', to: 'log', color: C.coord, via: [{ x: 20, y: 45 }, { x: 74, y: 45 }] },
      ],
    },
    {
      title: 'A machine dies, and the fix is one instruction',
      prose:
        'Reset every operator to its state from snapshot <em>n</em>, and rewind every source to the offset recorded in that same snapshot. That is the whole recovery. The records between the offset and the crash are read again, and because the operator states are exactly what they were at the barrier, replaying them produces the same result. <b>It is Chandy–Lamport from Chapter 7</b>, finally doing the job it was invented for — with the channel states dropped because the topology guarantees they are redundant.',
      focus: ['store', 's1', 's2', 'agg'],
      particles: [
        { from: 'agg', to: 'sink', color: C.bad },
        { from: 'store', to: 'agg', color: C.durable },
        { from: 'log', to: 's2', color: C.durable, via: [{ x: 74, y: 45 }, { x: 35, y: 45 }] },
      ],
    },
  ],
}
