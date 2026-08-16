import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* Role semantics as everywhere: client blue, whichever node is coordinating
   amber, anything holding bytes violet, the failure red. Note that amber moves
   in this trace — that is the chapter. In GFS and Bigtable the amber box was
   the same machine on every step; here whoever picks up the phone coordinates,
   and by step 2 it is a different node.

   Geometry: three zones with two empty corridors doing the work. x≈69.5 sits in
   the gap between the preference-list zone and the ring zone, and carries both
   the hand-off out to D and the delivery back to A — without it those routes
   run straight through node B, which the lint catches. x≈26.5 sits in the gap
   on the other side and carries the client's second concurrent write down to C
   past both A and B.

   Zone captions are budgeted by hand (the lint only measures SVG, and these are
   canvas): past roughly 18 characters the next zone's caption is touching. */
const C = {
  client: VIZ.blue,
  coord: VIZ.amber,
  data: VIZ.violet,
  bad: VIZ.red,
}

export const dynamoCartTrace: TraceSpec = {
  title: 'One cart — accepted through a failure, then reconciled by code you wrote',
  aspect: 0.5,
  zones: [
    { label: 'Cart service', x: 2, y: 4, w: 23, h: 42 },
    { label: 'Preference list', x: 28, y: 4, w: 40, h: 42 },
    { label: 'Rest of the ring', x: 71, y: 4, w: 26, h: 42 },
  ],
  nodes: [
    { id: 'app', x: 4, y: 8, w: 19, h: 8, label: 'Your cart service', sub: 'get() and put()', color: C.client },
    { id: 'merge', x: 4, y: 30, w: 19, h: 7, label: 'Your merge fn', sub: 'you have to write this', color: C.client },
    { id: 'a', x: 31, y: 8, w: 34, h: 7.5, label: 'Node A', sub: 'first on the list', color: C.coord },
    { id: 'b', x: 31, y: 19, w: 34, h: 7.5, label: 'Node B', sub: 'second', color: C.data },
    { id: 'c', x: 31, y: 30, w: 34, h: 7.5, label: 'Node C', sub: 'third', color: C.data },
    { id: 'd', x: 73, y: 30, w: 22, h: 7.5, label: 'Node D', sub: 'fourth — not an owner', color: C.data },
  ],
  steps: [
    {
      title: 'Add to cart — and W of N is enough',
      prose:
        'The key <code>cart-42</code> hashes to a position on the ring, and the three nodes clockwise from it are its <b>preference list</b>. Whichever of them the request reaches becomes the <b>coordinator</b> for this write: it stamps a version, stores the value locally, and sends it to the other two. It answers the customer as soon as <b>W</b> of them have it — with the common setting <b>N=3, W=2</b>, that is itself plus one. <em>Node C is still catching up when the page has already rendered.</em>',
      focus: ['app', 'a', 'b', 'c'],
      particles: [
        { from: 'app', to: 'a', color: C.client },
        { from: 'a', to: 'b', color: C.data },
        { from: 'a', to: 'c', color: C.data, via: [{ x: 66.5, y: 11.75 }, { x: 66.5, y: 33.75 }] },
        { from: 'b', to: 'a', color: C.data },
        { from: 'a', to: 'app', color: C.coord },
      ],
    },
    {
      title: 'Node A is unreachable — so the write goes somewhere it does not belong',
      prose:
        'A is down, or the network to it is. A strict quorum would now have two owners for a key that needs W=2 and would be one failure from refusing the write — which is the thing this system exists not to do. So Dynamo relaxes the rule: the write goes to the first <b>N healthy</b> nodes walking the ring, not the first N nodes. <b>D is not an owner of this key and takes the copy anyway</b>, tagged with a hint saying <em>this was meant for A</em>. The paper calls it a <b>sloppy quorum</b>, and the honesty of that name is worth noticing.',
      focus: ['app', 'a', 'b', 'c', 'd'],
      particles: [
        { from: 'app', to: 'a', color: C.bad },
        { from: 'app', to: 'b', color: C.client },
        { from: 'b', to: 'c', color: C.data },
        { from: 'b', to: 'd', color: C.data },
      ],
    },
    {
      title: 'A comes back, and D quietly hands the write over',
      prose:
        'D keeps hinted copies in a separate local store and scans it periodically. When A answers again, D delivers what it was holding and only then deletes its own copy — so the replica count never dips below three during the transfer. Nobody was paged, no operator ran anything, and the customer never learned that the machine holding their cart had been unreachable for four minutes. <b>This is the whole payoff for giving up the master</b>: recovery is a background chore rather than an election.',
      focus: ['d', 'a'],
      particles: [
        { from: 'd', to: 'a', color: C.data, via: [{ x: 69.5, y: 33.75 }, { x: 69.5, y: 11.75 }] },
        { from: 'a', to: 'd', color: C.data, via: [{ x: 69.5, y: 11.75 }, { x: 69.5, y: 33.75 }] },
      ],
    },
    {
      title: 'Two writes at once — and no failure required',
      prose:
        'The customer has the site open in two tabs, or a retry fired, or — the paper&rsquo;s own diagnosis — a <b>busy robot</b> is hammering the API. Two adds arrive at nearly the same instant and land on different coordinators, A and C, each of which had the same starting version. Both writes succeed, because both are supposed to. <b>Nothing is broken here.</b> The system now holds two versions of one cart, and its own records say each one is a legitimate child of the same parent.',
      focus: ['app', 'a', 'c'],
      particles: [
        { from: 'app', to: 'a', color: C.client },
        { from: 'app', to: 'c', color: C.client, via: [{ x: 26.5, y: 12 }, { x: 26.5, y: 33.75 }] },
        { from: 'a', to: 'app', color: C.coord },
        { from: 'c', to: 'app', color: C.data, via: [{ x: 26.5, y: 33.75 }, { x: 26.5, y: 12 }] },
      ],
    },
    {
      title: 'The read that returns two carts',
      prose:
        'A <code>get()</code> gathers versions from <b>R</b> nodes and compares their clocks. If one clock covers another, the older is an ancestor and gets dropped on the spot — most of the time that is what happens, and the caller never knows a comparison took place. Here neither covers the other, so the coordinator <b>returns both</b>, along with an opaque context holding the merged clock. The store has just told your application, in effect: <em>I have two answers and no way to prefer either.</em>',
      focus: ['app', 'a', 'b', 'c'],
      particles: [
        { from: 'app', to: 'a', color: C.client },
        { from: 'b', to: 'a', color: C.data },
        { from: 'c', to: 'a', color: C.data, via: [{ x: 66.5, y: 33.75 }, { x: 66.5, y: 11.75 }] },
        { from: 'a', to: 'app', color: C.bad, count: 2 },
      ],
    },
    {
      title: 'The background repairs — and the thing they cannot repair',
      prose:
        'Two mechanisms run behind all of this. <b>Read repair</b>: having seen a node return an out-of-date version during that read, the coordinator pushes the newer one back at it. <b>Anti-entropy</b>: nodes trade Merkle-tree roots for the ranges they share and walk down only the branches that disagree, so finding one differing key costs a handful of hashes instead of a full scan. Both fix <em>stale</em>. Neither touches what happened in step 4, because those two versions are not stale — they are <b>concurrent</b>, and no amount of comparing bytes decides which cart the customer meant.',
      focus: ['a', 'b', 'c'],
      particles: [
        { from: 'a', to: 'b', color: C.data },
        { from: 'b', to: 'c', color: C.data },
        { from: 'c', to: 'b', color: C.data },
      ],
    },
    {
      title: 'Your code decides — and the deleted item comes back',
      prose:
        'The store hands both carts to the application, and the application unions them, because for a cart that is obviously right: an item somebody added should not vanish. The merged version is written back with a clock covering both branches, and the branches collapse. <b>An “add to cart” is never lost.</b> But run the same merge over a <em>removal</em> and the arithmetic goes the other way — the branch that still contains the item wins, and the thing the customer deleted is in their cart again. The paper states this in one flat sentence and does not flinch: <b>“deleted items can resurface.”</b>',
      focus: ['app', 'merge', 'a'],
      particles: [
        { from: 'app', to: 'merge', color: C.client, count: 2 },
        { from: 'merge', to: 'app', color: C.client },
        { from: 'app', to: 'a', color: C.client },
      ],
    },
  ],
}
