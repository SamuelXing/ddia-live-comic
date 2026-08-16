import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* The application from the paper's own Figure 1, which is the thing it was
   built to make possible: tweets arriving continuously, an iterative graph
   computation over them that never stops or restarts, and interactive queries
   answered against a consistent view of its results. Every existing system in
   2013 could do two of those three.

   Colours: blue at both ends because both are the outside world — records
   coming in, answers going out. Green for the vertex that holds state, because
   it is the only place records actually accumulate. Amber for ingress, egress
   and feedback: they compute nothing and touch only timestamps, which makes
   them coordination machinery in exactly the sense the amber has meant all
   book. Violet for the checkpoint. Red only in the failure step.

   Progress tracking is deliberately NOT a node. It is a protocol every worker
   participates in, not a service anything sends a record to, and drawing a hop
   to a box called "coordinator" would say the opposite of what §3.3 argues.
   It appears as the thing that lets step 4 happen at all.

   Geometry: the loop is a vertical column at x=29..45 so ingress, the stateful
   vertex and feedback stack in reading order; egress steps right at x=50; the
   answering side is a clear column at x=70. The one routed line is the
   checkpoint, which uses the gap at y≈29 between the stateful vertex and the
   feedback vertex. */
const C = {
  world: VIZ.blue,
  state: VIZ.green,
  clock: VIZ.amber,
  durable: VIZ.violet,
  bad: VIZ.red,
}

export const naiadTrace: TraceSpec = {
  title: 'A loop that never stops, over input that never stops, answering questions the whole time',
  aspect: 0.5,
  zones: [
    { label: 'The outside world', x: 2, y: 4, w: 22, h: 42 },
    { label: 'One loop context', x: 26, y: 4, w: 40, h: 42 },
    { label: 'Answering', x: 68, y: 4, w: 30, h: 42 },
  ],
  nodes: [
    { id: 'tweets', x: 4, y: 10, w: 18, h: 8, label: 'Tweets', sub: '32,000 a second', color: C.world },
    { id: 'queries', x: 4, y: 28, w: 18, h: 8, label: 'Queries', sub: '10 a second', color: C.world },
    { id: 'ing', x: 29, y: 9, w: 16, h: 7, label: 'Ingress', sub: 'adds a counter', color: C.clock },
    { id: 'cc', x: 29, y: 20, w: 16, h: 7, label: 'Components', sub: 'stateful, in RAM', color: C.state },
    { id: 'fb', x: 29, y: 31, w: 16, h: 7, label: 'Feedback', sub: 'counter + 1', color: C.clock },
    { id: 'eg', x: 50, y: 20, w: 14, h: 7, label: 'Egress', sub: 'drops it again', color: C.clock },
    { id: 'top', x: 70, y: 9, w: 26, h: 7, label: 'Top hashtag', sub: 'per component', color: C.state },
    { id: 'ans', x: 70, y: 21, w: 26, h: 7, label: 'Your answer', sub: 'joined to your group', color: C.world },
    { id: 'ckpt', x: 70, y: 33, w: 26, h: 7, label: 'Checkpoint', sub: 'all of it, at once', color: C.durable },
  ],
  steps: [
    {
      title: 'Two inputs, one graph, and nothing that can be told to wait',
      prose:
        'Tweets arrive forever. Queries arrive forever. Between them sits an iterative computation — connected components over the graph of who mentions whom — which is exactly the kind of loop the previous chapter’s engine runs beautifully <em>over an input that holds still</em>. Here the input does not hold still, and the loop is not allowed to finish, and somebody wants a consistent answer out of the middle of it. <b>In 2013 you could get any two of those three</b>, from three different systems, and gluing them together meant gluing their failure modes together too.',
      focus: ['tweets', 'queries', 'cc'],
      particles: [],
    },
    {
      title: 'A record enters the loop and its timestamp grows a dimension',
      prose:
        'Every message carries a logical timestamp. Outside the loop it is just an <b>epoch</b> — which batch of input this came from, labelled by the producer. Crossing into the loop, the ingress vertex appends a fresh loop counter set to zero. <em>The timestamp is now a coordinate rather than a position:</em> not “message 4,001” but “the first time round, on the third batch of tweets”. That change is the entire paper. A sequence number cannot distinguish those two facts, and a system that cannot distinguish them cannot run a second batch before the first has converged.',
      focus: ['tweets', 'ing', 'cc'],
      particles: [
        { from: 'tweets', to: 'ing', color: C.world },
        { from: 'ing', to: 'cc', color: C.clock },
      ],
    },
    {
      title: 'Round again — and nobody was asked for permission',
      prose:
        'The components vertex updates its state and sends what changed onward; the feedback vertex adds one to the innermost counter and hands it back. There is <b>no barrier here</b>, and that absence is the point. Iteration four of epoch one can be in flight while epoch three is still arriving at the front door, because their timestamps are not comparable and the system knows it. <em>A batch engine synchronises every iteration because it has no way to tell those messages apart.</em>',
      focus: ['cc', 'fb'],
      particles: [
        { from: 'cc', to: 'fb', color: C.state },
        { from: 'fb', to: 'cc', color: C.clock },
      ],
    },
    {
      title: 'And yet it can still know that it has seen everything',
      prose:
        'A vertex counting distinct items can emit each new item the moment it sees it, but it cannot emit a <em>count</em> until it knows no more items are coming for that time. So it asks to be notified at time t, and the system must not deliver that notification early. What makes it possible is the graph structure: the loop counters only ever go up, so the system can prove which future timestamps are still reachable from the work outstanding anywhere in the cluster. <b>The cost of that proof is the real engineering</b> — the naive version floods the network, and accumulating updates locally before sending them cuts the protocol traffic by <b>one to two orders of magnitude</b>.',
      focus: ['cc', 'eg'],
      particles: [{ from: 'cc', to: 'eg', color: C.state }],
    },
    {
      title: 'A question arrives, and insists on the freshest answer',
      prose:
        'Egress strips the loop counter back off and the result rejoins the outer stream: the top hashtag in each component, updated as the components change. Your query is joined against it. <em>Ask for the answer that includes everything received so far</em> and it is correct, and it takes <b>500 to 900 ms</b> — because a correct answer cannot be given until the component structure has caught up with the tweets, and your query is queued behind that work.',
      focus: ['eg', 'top', 'queries', 'ans'],
      particles: [
        { from: 'eg', to: 'top', color: C.clock },
        { from: 'top', to: 'ans', color: C.state },
        { from: 'queries', to: 'ans', color: C.world },
      ],
    },
    {
      title: 'Ask the same question about a second ago instead',
      prose:
        'Now request the answer as of one second in the past. It is the same query, over the same graph, with the same consistency guarantee — <em>it is describing a moment that has finished happening</em>. Most responses come back in <b>under 10 ms</b>, with occasional peaks near 100 when the graph computation gets in the way. **One second of age, and the wait falls by roughly fifty times.** That is the trade this whole season is about, and this is the first place in the book anybody put a number on it.',
      focus: ['queries', 'ans', 'top'],
      particles: [
        { from: 'top', to: 'ans', color: C.state },
        { from: 'queries', to: 'ans', color: C.world },
      ],
    },
    {
      title: 'And the bill: everybody stops together, and everybody restarts together',
      prose:
        'The state in that green box is mutable and updated constantly, which is precisely what the previous chapter gave up in order to recover cheaply. So recovery here works the only other way: <b>pause every worker, drain the message queues, checkpoint every stateful vertex, resume.</b> When a process dies, all the survivors revert to the last durable checkpoint and the dead one’s vertices are handed out among them. There is no partial recovery, because there is no lineage to replay. The paper says so plainly: this design <em>favours performance in the common case that there are no failures, at the expense of availability in the event of a failure.</em>',
      focus: ['cc', 'ckpt', 'fb'],
      particles: [
        { from: 'cc', to: 'ckpt', color: C.durable, via: [{ x: 48, y: 29 }] },
        { from: 'ckpt', to: 'cc', color: C.bad, via: [{ x: 48, y: 29 }] },
      ],
    },
  ],
}
