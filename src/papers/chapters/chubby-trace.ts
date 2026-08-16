import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* Role semantics as everywhere: client blue, the coordinator amber, the cached
   copy green (it is a store), the failure red.

   Geometry: three zones. The corridor at y≈19 is load-bearing — it sits below
   the master (ends y16) and above the first replica (starts y22), and carries
   the client's traffic to the protected service without crossing the cell. The
   corridor at x≈57.5 runs inside the cell zone, right of the replicas, so the
   master can reach the far replica without cutting through the near one.

   Zone captions are budgeted by hand (the lint only measures SVG, and these are
   canvas): much past 18 characters and the next zone's caption is touching. The
   detail lives in the node subtitles instead. */
const C = {
  client: VIZ.blue,
  cell: VIZ.amber,
  cache: VIZ.green,
  bad: VIZ.red,
}

export const chubbySessionTrace: TraceSpec = {
  title: 'One session — and the fail-over the whole design exists to survive',
  aspect: 0.5,
  zones: [
    { label: 'Client', x: 2, y: 4, w: 21, h: 42 },
    { label: 'Chubby cell', x: 26, y: 4, w: 33, h: 42 },
    { label: 'Protected service', x: 62, y: 4, w: 35, h: 42 },
  ],
  nodes: [
    { id: 'app', x: 4, y: 8, w: 17, h: 8, label: 'Your app', sub: 'wants to be master', color: C.client },
    { id: 'cache', x: 4, y: 30, w: 17, h: 7, label: 'Local cache', sub: 'invalidated, never polled', color: C.cache },
    { id: 'm', x: 29, y: 8, w: 27, h: 8, label: 'Chubby master', sub: '1 of 5, elected by Paxos', color: C.cell },
    { id: 'r2', x: 29, y: 22, w: 27, h: 7, label: 'Replica', sub: 'Paxos peer', color: C.cell },
    { id: 'r3', x: 29, y: 33, w: 27, h: 7, label: 'Replica', sub: 'the next master', color: C.cell },
    { id: 'res', x: 65, y: 8, w: 29, h: 8, label: 'GFS chunkserver', sub: 'checks the sequencer', color: VIZ.violet },
  ],
  steps: [
    {
      title: 'Open a session, and start the clock',
      prose:
        'The client opens a <b>session</b> with the cell&rsquo;s master and is given a <b>lease</b> — a promise that the master will not unilaterally end the session before some time. Everything after this hangs off that one lease: locks held, files cached, handles open. The client keeps it alive with <b>KeepAlive</b> calls, which the master simply does not answer until it is nearly ready to extend. <em>A call that is deliberately left hanging is also a heartbeat, at no extra cost.</em>',
      focus: ['app', 'm'],
      particles: [
        { from: 'app', to: 'm', color: C.client },
        { from: 'm', to: 'app', color: C.cell },
      ],
    },
    {
      title: 'Acquire the lock — and take the sequencer with it',
      prose:
        'The client opens the file <code>/ls/cell/gfs-master</code> and acquires it in exclusive mode. That file is now a lock, and the client is now the GFS master. It also asks for a <b>sequencer</b>: an opaque string naming this lock, this mode, and <b>this acquisition</b> — a number that goes up every time the lock changes hands. Nothing has been protected yet. Step 7 is where it earns its keep.',
      focus: ['app', 'm'],
      particles: [
        { from: 'app', to: 'm', color: C.client },
        { from: 'm', to: 'app', color: C.cell },
      ],
    },
    {
      title: 'Read the tiny file — once',
      prose:
        'The client reads the file that says who the master is. The Chubby master returns the contents <em>and records that this client is now caching it</em>. Every read after this is answered from local memory at no cost to anyone. With <b>90,000 clients on one master</b> — the paper&rsquo;s own measurement — this is not an optimisation, it is the only reason the cell stands up.',
      focus: ['app', 'm', 'cache'],
      particles: [
        { from: 'app', to: 'm', color: C.client },
        { from: 'm', to: 'cache', color: C.cache },
        { from: 'cache', to: 'app', color: C.cache },
      ],
    },
    {
      title: 'Write the file — and pay for everyone else’s cache',
      prose:
        'Now the client writes its own address into that file so others can find it. The master cannot acknowledge the write until it has <b>invalidated every cached copy</b> and heard back — so the cost of a write is proportional to how many clients are caching that file, not to its size. <em>Invalidation rather than update</em>, deliberately: sending the new value would make Chubby a publish-subscribe system, and it is a bad one.',
      focus: ['app', 'm', 'cache'],
      particles: [
        { from: 'app', to: 'm', color: C.client },
        { from: 'm', to: 'cache', color: C.cache },
        { from: 'm', to: 'app', color: C.cell },
      ],
    },
    {
      title: 'The master dies — and the client goes quiet on purpose',
      prose:
        'KeepAlives stop coming back. The client does not know whether the master is dead or merely unreachable, and — this is the good part — <b>it does not guess.</b> When its local lease runs out the session enters <b>jeopardy</b>: the client empties and disables its cache, blocks its own Chubby calls rather than failing them, and tells the application so it can go quiet too. It then waits out a <b>grace period, 45 seconds by default.</b>',
      focus: ['app', 'm', 'cache'],
      particles: [
        { from: 'app', to: 'm', color: C.bad },
        { from: 'app', to: 'cache', color: C.bad },
      ],
    },
    {
      title: 'A new master, and the session survives it',
      prose:
        'The surviving replicas elect a new master among themselves. It refuses to do anything useful at first: it waits out the worst-case old lease, learns from the clients themselves which sessions, locks and handles existed, and only then starts serving. If the client reaches it before the grace period ends, <b>the session continues and the lock is still held</b> — the application never learned there was an outage. The paper&rsquo;s snapshot puts a typical fail-over at <b>14 seconds</b>.',
      focus: ['r2', 'r3', 'app'],
      particles: [
        { from: 'r2', to: 'r3', color: C.cell },
        // down the left of the replica stack: straight through, it splits r2
        { from: 'r3', to: 'app', color: C.cell, via: [{ x: 27, y: 36 }, { x: 27, y: 14 }] },
        { from: 'r3', to: 'cache', color: C.cache },
      ],
    },
    {
      title: 'Or it does not — and the sequencer catches the zombie',
      prose:
        'If the grace period runs out first, the session is gone and the lock is released. Somebody else is the master now. And the old one may still be alive — paused, partitioned, about to wake up and write. <b>The lock service cannot stop it; only the thing being written to can.</b> The zombie&rsquo;s write carries a sequencer from an older acquisition, the chunkserver compares it to the highest it has seen, and the write bounces.',
      focus: ['app', 'res'],
      particles: [
        { from: 'app', to: 'res', color: C.bad, via: [{ x: 24.5, y: 19 }, { x: 60.5, y: 19 }] },
        { from: 'res', to: 'app', color: C.bad, via: [{ x: 60.5, y: 19 }, { x: 24.5, y: 19 }] },
      ],
    },
  ],
}
