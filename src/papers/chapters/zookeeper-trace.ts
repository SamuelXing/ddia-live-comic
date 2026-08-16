import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* The herd-free lock recipe, which is the thing people actually build with
   ZooKeeper and the thing the paper argues you should build rather than be
   given. It is also the clearest demonstration of the chapter's argument: no
   lock primitive exists, and yet a correct queueing lock is six lines.

   Green for the service and violet for the znodes it stores, because they are
   a store; blue for the clients. Nothing is amber — there is no coordinator in
   this picture, which is the joke: the coordination service has no coordinator
   visible to its clients, only a namespace.

   Geometry: the corridor at x≈35.5 (between the client zone and the ensemble)
   carries C3's traffic past C2, and the corridor at x≈62.5 (between the
   ensemble and the namespace) carries the watch notification back. */
const C = {
  client: VIZ.blue,
  zk: VIZ.green,
  znode: VIZ.violet,
  bad: VIZ.red,
}

export const zkLockTrace: TraceSpec = {
  title: 'A lock built out of a service that has no locks',
  aspect: 0.5,
  zones: [
    { label: 'Three clients', x: 2, y: 4, w: 31, h: 42 },
    { label: 'The ensemble', x: 38, y: 4, w: 22, h: 42 },
    { label: 'The namespace', x: 65, y: 4, w: 32, h: 42 },
  ],
  nodes: [
    { id: 'c1', x: 4, y: 8, w: 27, h: 7.5, label: 'Client 1', sub: 'wants the lock', color: C.client },
    { id: 'c2', x: 4, y: 19, w: 27, h: 7.5, label: 'Client 2', sub: 'wants it too', color: C.client },
    { id: 'c3', x: 4, y: 30, w: 27, h: 7.5, label: 'Client 3', sub: 'and so does this one', color: C.client },
    { id: 'zk', x: 40, y: 19, w: 18, h: 9, label: 'ZooKeeper', sub: '5 servers, 1 leader', color: C.zk },
    { id: 'n1', x: 67, y: 8, w: 28, h: 7, label: 'lock-0000000001', sub: 'ephemeral · client 1', color: C.znode },
    { id: 'n2', x: 67, y: 19, w: 28, h: 7, label: 'lock-0000000002', sub: 'ephemeral · client 2', color: C.znode },
    { id: 'n3', x: 67, y: 30, w: 28, h: 7, label: 'lock-0000000003', sub: 'ephemeral · client 3', color: C.znode },
  ],
  steps: [
    {
      title: 'Everyone creates a node, and the service numbers them',
      prose:
        'There is no <code>acquire()</code> here — the API has seven calls and none of them is a lock. Each client instead creates a child under <code>/lock</code> with two flags: <b>SEQUENTIAL</b>, so the service appends a monotonically increasing counter to the name, and <b>EPHEMERAL</b>, so the node disappears when that client’s session ends. <em>The numbering is the whole mechanism.</em> Three clients raced; the service has silently put them in an order and told each one its own place.',
      focus: ['c1', 'c2', 'c3', 'zk'],
      particles: [
        { from: 'c1', to: 'zk', color: C.client },
        { from: 'c2', to: 'zk', color: C.client },
        { from: 'c3', to: 'zk', color: C.client, via: [{ x: 35.5, y: 33.75 }, { x: 35.5, y: 23.5 }] },
      ],
    },
    {
      title: 'The writes go through consensus — and only the writes',
      prose:
        'Creating a znode is an update, so it goes through <b>Zab</b>, the ensemble’s atomic broadcast protocol: the leader proposes, a majority acknowledges durably, and only then is it real. That is the round trip Chapter 8 priced. <em>Reads do not do this</em>, and the whole performance story of this paper is that decision — with a 5-server ensemble the paper measured <b>18,000 writes a second and 165,000 reads.</b>',
      focus: ['zk', 'n1', 'n2', 'n3'],
      particles: [
        { from: 'zk', to: 'n1', color: C.znode },
        { from: 'zk', to: 'n2', color: C.znode },
        { from: 'zk', to: 'n3', color: C.znode },
      ],
    },
    {
      title: 'Lowest number holds the lock — and works that out for itself',
      prose:
        'Each client lists the children of <code>/lock</code> and looks at its own position. Client 1 has the lowest sequence number, so <b>client 1 holds the lock</b>. Nobody granted it. There was no request to grant, no server that decided, and no state anywhere called “the lock holder” — <em>the holder is whoever has the smallest name</em>, which every client can determine by reading. The service supplied an order and stayed out of the decision.',
      focus: ['c1', 'zk', 'n1'],
      particles: [
        { from: 'c1', to: 'zk', color: C.client },
        { from: 'zk', to: 'c1', color: C.zk },
      ],
    },
    {
      title: 'The waiters each watch exactly one node — the one in front',
      prose:
        'Now the part that separates this from the naive version. A waiting client does <b>not</b> watch the lock. It watches <em>the node immediately before its own</em>: client 2 watches lock-1, client 3 watches lock-2. So a release wakes exactly one client. <b>Watch what the naive design would do instead</b> — everyone watches the lock itself, the holder releases, and a thousand clients wake simultaneously to discover that 999 of them still cannot proceed. That is the <b>herd effect</b>, and the paper calls it out by name.',
      focus: ['c2', 'c3', 'n1', 'n2'],
      particles: [
        // over the top of the ensemble: y≈17 is the only clear east-west lane,
        // sitting below the top row of znodes and above the ZooKeeper box
        { from: 'c2', to: 'n1', color: C.client, via: [{ x: 35.5, y: 22.75 }, { x: 35.5, y: 17 }, { x: 62.5, y: 17 }, { x: 62.5, y: 11.5 }] },
        { from: 'c3', to: 'n2', color: C.client, via: [{ x: 35.5, y: 33.75 }, { x: 35.5, y: 44 }, { x: 62.5, y: 44 }, { x: 62.5, y: 22.5 }] },
      ],
    },
    {
      title: 'Client 1 finishes, and the handover wakes one machine',
      prose:
        'Client 1 deletes its node. The watch on it fires, client 2 is notified, re-checks that it now holds the lowest number, and proceeds. <b>One notification, one wakeup, one client.</b> Client 3 heard nothing and is still watching a node that has not changed. The queue advances by exactly one position, which is what a lock ought to do and what the simple recipe does not.',
      focus: ['c1', 'zk', 'n1', 'c2'],
      particles: [
        { from: 'c1', to: 'zk', color: C.client },
        { from: 'zk', to: 'n1', color: C.bad },
        { from: 'zk', to: 'c2', color: C.zk },
      ],
    },
    {
      title: 'Client 2 dies holding it — and nothing has to notice',
      prose:
        'Now the failure that makes ephemeral nodes worth having. Client 2 crashes: no release, no cleanup, no operator. Its session stops being renewed, and when the session expires <b>the service deletes every ephemeral node that client created.</b> lock-2 vanishes, client 3’s watch fires, and the lock moves on. <em>Liveness of the lock is tied to liveness of the session</em>, so a dead holder cannot wedge the queue — which is precisely the failure a lock file on a disk cannot survive.',
      focus: ['c2', 'zk', 'n2', 'c3'],
      particles: [
        { from: 'c2', to: 'zk', color: C.bad },
        { from: 'zk', to: 'n2', color: C.bad },
        { from: 'zk', to: 'c3', color: C.zk },
      ],
    },
    {
      title: 'And the sharp edge nobody puts on the slide',
      prose:
        'A session expires because the client went <em>quiet</em>, and quiet is not the same as dead. A client paused by garbage collection can have its node deleted, the lock handed onward, and then wake up believing it still holds it. <b>ZooKeeper cannot prevent this and does not claim to</b> — the same limit Chapter 4 met, one paper earlier. The fix is the same too: the znode’s version number is a <b>fencing token</b>, and the resource being protected has to check it. <em>A lock service can tell you that you had the lock. Only the resource can enforce that you still do.</em>',
      focus: ['c2', 'c3', 'zk'],
      particles: [
        { from: 'c2', to: 'zk', color: C.bad },
        { from: 'zk', to: 'c2', color: C.bad },
      ],
    },
  ],
}
