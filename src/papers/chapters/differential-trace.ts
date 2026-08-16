import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* Connected components on the Twitter mention graph, and then one edge is
   removed. The trace exists to show a thing the figures cannot: that the loop
   keeps running after the input changes, and that most of its iterations have
   nothing to do.

   Colours: blue for the input, because it is the front door. Amber for the
   loop machinery — ingress, feedback, egress exist to manage the loop index
   and nothing else. Green where the answer accumulates. Violet for the index
   of differences, which is storage. Red for the removal, because a deletion
   is the case every earlier system in this act could not handle.

   Geometry note: feedback→join is routed through a waypoint at (46,19) rather
   than straight. The direct line passes about four units above the Min box's
   top edge, which the lint tolerates and a reader reads as "through it". */
const C = {
  input: VIZ.blue,
  loop: VIZ.amber,
  answer: VIZ.green,
  kept: VIZ.violet,
  gone: VIZ.red,
}

export const differentialTrace: TraceSpec = {
  title: 'One edge disappears from a day of Twitter, and the loop barely wakes up',
  aspect: 0.5,
  zones: [
    { label: 'The input', x: 2, y: 4, w: 20, h: 44 },
    { label: 'The fixed point', x: 24, y: 4, w: 46, h: 44 },
    { label: 'Kept', x: 72, y: 4, w: 26, h: 44 },
  ],
  nodes: [
    { id: 'edges', x: 4, y: 20, w: 16, h: 9, label: 'Edges', sub: 'a 24-hour window', color: C.input },
    { id: 'ingress', x: 27, y: 9, w: 17, h: 7, label: 'Ingress', sub: 'adds a loop index', color: C.loop },
    { id: 'join', x: 48, y: 9, w: 19, h: 7, label: 'Join', sub: 'labels ⋈ edges', color: C.answer },
    { id: 'min', x: 48, y: 23, w: 19, h: 7, label: 'Min', sub: 'smallest per node', color: C.answer },
    { id: 'feedback', x: 27, y: 23, w: 17, h: 7, label: 'Feedback', sub: 'iteration i + 1', color: C.loop },
    { id: 'egress', x: 38, y: 37, w: 26, h: 7, label: 'Egress', sub: 'the components', color: C.loop },
    { id: 'index', x: 76, y: 11, w: 20, h: 9, label: 'Difference index', sub: 'by key, version, row', color: C.kept },
    { id: 'out', x: 76, y: 30, w: 20, h: 9, label: 'What changed', sub: 'downstream', color: C.answer },
  ],
  steps: [
    {
      title: 'A loop, and the reason it is a loop',
      prose:
        'Each node starts labelled with its own id and repeatedly takes the smallest label in its neighbourhood; run it to a fixed point and every node carries the smallest id in its component. It is a join, a union and a minimum, in a cycle. <b>Chapter 18’s engine can run this</b> — and it runs the whole thing again from the top every time, because the only state it trusts between iterations is a file.',
      focus: ['edges', 'join', 'min'],
      particles: [{ from: 'edges', to: 'ingress', color: C.input }],
    },
    {
      title: 'Keeping state between iterations gets you most of the way',
      prose:
        'Hold the labels from one iteration to the next and pass only the ones that <em>changed</em> into the next round. Early on that is nearly everything; once labels start settling it collapses, and the work per iteration decays exponentially after about the eighth. This is what an incremental system does, and it is already worth more than half the total work. <b>It is also the last thing on this page that anybody had built.</b>',
      focus: ['join', 'min', 'feedback'],
      particles: [
        { from: 'ingress', to: 'join', color: C.input },
        { from: 'join', to: 'min', color: C.answer },
        { from: 'min', to: 'feedback', color: C.answer, count: 3 },
        { from: 'feedback', to: 'join', color: C.loop, via: [{ x: 46, y: 19 }] },
      ],
    },
    {
      title: 'And now the input changes underneath it',
      prose:
        'The window slides by one second. A handful of mentions arrive, and <b>one edge leaves</b> — which is the case that breaks everything before this. A label that was propagated because of an edge that no longer exists has to be taken back, and taking it back may promote some other label at a node three hops away. <em>An incremental system cannot do this at all</em>: its state was folded into a running value and the ingredients were thrown away, so the honest response is to recompute the entire day.',
      focus: ['edges', 'ingress'],
      particles: [{ from: 'edges', to: 'ingress', color: C.gone, count: 2 }],
    },
    {
      title: 'Two reasons to change, and they are not in a line',
      prose:
        'Here is the move. A collection inside this loop varies for <b>two independent reasons</b> — which second of input it reflects, and how many times round the loop it has been. So its versions are labelled with a pair, and pairs are only <em>partially</em> ordered: iteration 1 of the old input and iteration 0 of the new one have no order between them at all. Neither has to subtract the other’s work out, because neither came first. <b>The correction is taken against both of them together.</b>',
      focus: ['ingress', 'join', 'feedback'],
      particles: [
        { from: 'index', to: 'join', color: C.kept, via: [{ x: 71, y: 12 }] },
        { from: 'ingress', to: 'join', color: C.gone },
      ],
    },
    {
      title: 'Which is only possible because nothing was thrown away',
      prose:
        'The other half of the model, and the one that costs money. Every difference is <b>kept</b>, in an index keyed by key, then version, then row — never folded into a current value and discarded. That is what lets a version reach for exactly the predecessors that matter to it and ignore the rest. On this graph the whole index came to <b>1.5% more than the set of labels</b> an incremental system would have kept anyway, which is the sentence that makes the design affordable rather than clever.',
      focus: ['index'],
      particles: [
        { from: 'join', to: 'index', color: C.kept },
        { from: 'min', to: 'index', color: C.kept },
      ],
    },
    {
      title: 'Most iterations have nothing to do',
      prose:
        'Round the loop again and the correction is frequently <b>empty</b> — the new second of tweets did not change what the third iteration concluded, so the third iteration produces no differences and there is nothing to send. Several iterations do no work whatsoever. <em>There is no convergence test anywhere in this system;</em> convergence is simply the absence of differences, so a loop with nothing to say says nothing and the scheduler moves on.',
      focus: ['feedback', 'join', 'min'],
      particles: [{ from: 'feedback', to: 'join', color: C.loop, via: [{ x: 46, y: 19 }] }],
    },
    {
      title: '67 differences, and the component structure is current again',
      prose:
        'The whole update — a second of new mentions and one removed edge, against a day of graph — comes to <b>67 differences</b>, which is typical across the trace. That is <b>0.003%</b> of the work a full re-run would have done, and it lands in <b>24.4 ms</b>, against 7.1 and 36.4 seconds for the from-scratch versions the paper compares against. The components are current, and the answer never stopped being available while they were computed.',
      focus: ['egress', 'out'],
      particles: [
        { from: 'min', to: 'egress', color: C.answer },
        { from: 'egress', to: 'out', color: C.answer },
      ],
    },
  ],
}
