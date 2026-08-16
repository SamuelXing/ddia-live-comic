import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* Two people editing the same shared list, one of them on a train. The trace
   exists to show the thing a still picture cannot: that both replicas keep
   accepting writes the entire time, that the channel is allowed to be terrible,
   and that the merge lands on the same value from both directions.

   The topology is deliberately symmetric — there is no master side and no
   arrow that only points one way — because the asymmetry is what every other
   chapter in this book has had and this one does not.

   Colours: blue for the two devices, which are the clients here and also the
   authority, which is the point. Green where the payload accumulates. Amber
   for the merge, because it is the machinery. Red on the removal, since a
   deletion arriving out of order is the case that broke Chapter 5.

   Geometry: the two devices talk through the wire node rather than directly.
   A direct arc between them would have to route around the whole middle
   column, and it would also draw a peer-to-peer link the paper does not
   require — the channel may perfectly well be a server. */
const C = {
  device: VIZ.blue,
  payload: VIZ.green,
  merge: VIZ.amber,
  gone: VIZ.red,
}

export const crdtTrace: TraceSpec = {
  title: 'Two people edit the same list with no way to reach each other, and both end up right',
  aspect: 0.5,
  zones: [
    { label: 'Alice', x: 2, y: 4, w: 30, h: 42 },
    { label: 'The wire', x: 34, y: 4, w: 30, h: 42 },
    { label: 'Bob', x: 66, y: 4, w: 32, h: 42 },
  ],
  nodes: [
    { id: 'alice', x: 4, y: 10, w: 26, h: 10, label: 'Alice’s replica', sub: 'on a train, no signal', color: C.device },
    { id: 'wire', x: 38, y: 10, w: 22, h: 10, label: 'The channel', sub: 'lossy, out of order', color: C.merge },
    { id: 'bob', x: 68, y: 10, w: 26, h: 10, label: 'Bob’s replica', sub: 'at his desk', color: C.device },
    { id: 'aset', x: 4, y: 30, w: 26, h: 10, label: 'Her payload', sub: 'what she has seen', color: C.payload },
    { id: 'lub', x: 38, y: 30, w: 22, h: 10, label: 'Merge', sub: 'least upper bound', color: C.merge },
    { id: 'bset', x: 68, y: 30, w: 26, h: 10, label: 'His payload', sub: 'what he has seen', color: C.payload },
  ],
  steps: [
    {
      title: 'Two copies, and neither of them is the real one',
      prose:
        'Alice is on a train and Bob is at his desk, and they are editing the same shared list. Notice what is missing from this picture: there is no leader, no quorum, and no arrow that only points one way. <b>Every chapter of this book so far has had one of those</b> — a master in Act I, a coordinator in Act III, a majority in the flashback. Here both copies are authoritative, and the writes have already happened on the devices that made them.',
      focus: ['alice', 'bob'],
      particles: [],
    },
    {
      title: 'Both of them write, and neither asks',
      prose:
        'Alice adds an item. Bob removes a different one. Both operations complete <em>immediately and locally</em>, because there is nobody to ask and nothing to wait for. This is the availability Chapter 5 fought for, taken to its limit — <b>a replica accepts an update independently of network conditions</b>, and it tolerates every other replica being dead, which is a stronger claim than any quorum system in this book can make.',
      focus: ['alice', 'bob', 'aset', 'bset'],
      particles: [
        { from: 'alice', to: 'aset', color: C.device },
        { from: 'bob', to: 'bset', color: C.gone },
      ],
    },
    {
      title: 'The train goes into a tunnel, and it changes nothing',
      prose:
        'The channel is allowed to be as bad as it likes: it may drop messages, duplicate them, reorder them, or stop for an hour. The design does not require it to behave, only that a partition <em>eventually</em> heals. Alice keeps editing the whole time. <b>The unreliability of the wire has been moved out of the correctness argument entirely</b>, which is what the next two steps are about.',
      focus: ['wire', 'alice'],
      particles: [{ from: 'alice', to: 'wire', color: C.device, count: 2 }],
    },
    {
      title: 'And here is what makes that safe',
      prose:
        'Merging two states computes their <b>least upper bound</b> — the smallest state that includes both. A least upper bound is commutative, idempotent and associative, which is three ways of saying the same useful thing: <em>the order updates arrive in cannot matter, arriving twice cannot matter, and how they are batched cannot matter.</em> The channel was never able to affect the answer, so nothing has to be done about it.',
      focus: ['lub', 'aset', 'bset'],
      particles: [
        { from: 'aset', to: 'lub', color: C.payload },
        { from: 'bset', to: 'lub', color: C.payload },
      ],
    },
    {
      title: 'The tunnel ends and both sides converge',
      prose:
        'Alice’s state reaches Bob and Bob’s reaches Alice, and each merges what it received into what it had. They arrive at the <b>same value from opposite directions</b>, having exchanged no messages about who should win. This is <b>strong</b> eventual consistency, and the word doing the work is not “eventual”: replicas that have seen the same updates <em>have</em> the same state, rather than converging on one later after somebody arbitrates.',
      focus: ['aset', 'bset', 'lub'],
      particles: [
        { from: 'lub', to: 'aset', color: C.merge },
        { from: 'lub', to: 'bset', color: C.merge },
      ],
    },
    {
      title: 'No consensus was reached, and none was needed',
      prose:
        'Look at what did not happen. No round trip, no vote, no leader election, no rollback of an update that turned out to conflict. The whole of Act III of Season 1 exists to solve agreement, and <em>this sidesteps it</em>: convergence here tolerates <b>every replica but one crashing</b>, which no consensus protocol in this book can survive. The cost is that you may only ask for answers the data type can compute without asking anybody.',
      focus: ['alice', 'bob', 'aset', 'bset'],
      particles: [],
    },
    {
      title: 'And the part that is still a decision',
      prose:
        'Suppose Alice adds an item at the same moment Bob removes <em>that</em> item. Add-wins converges. Remove-wins converges. Highest-identifier-wins converges. <b>The mathematics forces them to agree and says nothing about what they should agree on</b> — so the semantics is still somebody’s call, made once when the type is designed rather than every time two writes collide. That is a smaller job than Chapter 5’s and it is not no job.',
      focus: ['lub'],
      particles: [
        { from: 'alice', to: 'lub', color: C.device, via: [{ x: 33, y: 25 }] },
        { from: 'bob', to: 'lub', color: C.gone, via: [{ x: 65, y: 25 }] },
      ],
    },
  ],
}
