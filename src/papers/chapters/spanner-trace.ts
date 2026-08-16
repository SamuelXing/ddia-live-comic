import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* One transaction across two Paxos groups on two continents. The step that
   matters is step 5, and it is the only step in this book where the picture
   deliberately stops moving: commit wait is a coordinator holding its locks and
   telling nobody anything, on purpose, for about ten milliseconds.

   Amber for the two leaders, because a Paxos leader is exactly the machinery
   Act II threw away and Act III put back. Violet for the replica sets, which
   are storage. Green for TrueTime, which is the only thing in the picture that
   is not software — and there are two of them, one per continent, because that
   is the honest drawing: two independent machines, two independent intervals,
   and the guarantee is that both of them contain the truth.

   Geometry: the corridor at x≈57.5 (inside group A, right of its nodes) and
   x≈95.5 (the same inside group B) carry each leader's call to its own clock
   past its own replicas. The corridor at x≈62 between the two zones, entered
   along the clear lane at y≈19, carries the client's traffic to the far leader
   without cutting through the near one. */
const C = {
  client: VIZ.blue,
  leader: VIZ.amber,
  replica: VIZ.violet,
  clock: VIZ.green,
}

export const spannerTrace: TraceSpec = {
  title: 'One transaction, two continents, and ten milliseconds of deliberate stillness',
  aspect: 0.5,
  zones: [
    { label: 'The client', x: 2, y: 4, w: 20, h: 42 },
    { label: 'Group A · US east', x: 26, y: 4, w: 34, h: 42 },
    { label: 'Group B · Europe', x: 64, y: 4, w: 34, h: 42 },
  ],
  nodes: [
    { id: 'app', x: 4, y: 14, w: 16, h: 9, label: 'Your client', sub: 'drives the commit', color: C.client },
    { id: 'la', x: 28, y: 9, w: 27, h: 8, label: 'Leader A', sub: 'the coordinator', color: C.leader },
    { id: 'ra', x: 28, y: 21, w: 27, h: 7, label: 'Replicas A', sub: 'Paxos majority', color: C.replica },
    { id: 'tta', x: 28, y: 34, w: 27, h: 8, label: 'TrueTime here', sub: 'GPS + atomic clocks', color: C.clock },
    { id: 'lb', x: 66, y: 9, w: 27, h: 8, label: 'Leader B', sub: 'a participant', color: C.leader },
    { id: 'rb', x: 66, y: 21, w: 27, h: 7, label: 'Replicas B', sub: 'Paxos majority', color: C.replica },
    { id: 'ttb', x: 66, y: 34, w: 27, h: 8, label: 'TrueTime here', sub: 'a different machine', color: C.clock },
  ],
  steps: [
    {
      title: 'The client takes the locks, and the client runs the commit',
      prose:
        'A transaction touching rows in two groups. Reads go to each group’s leader, which takes <b>read locks</b> — this is ordinary two-phase locking, and after Chapter 10’s optimism it is worth noticing that Spanner is pessimistic on purpose: it was designed for transactions that run for minutes, and optimistic schemes fall apart under long conflicts. Writes are buffered at the client until commit. <em>The client drives the whole two-phase commit</em>, which sounds like Chapter 10 and is for the same reason: it avoids sending the data twice across an ocean.',
      focus: ['app', 'la', 'lb'],
      particles: [
        { from: 'app', to: 'la', color: C.client },
        { from: 'app', to: 'lb', color: C.client, via: [{ x: 24, y: 19 }, { x: 62, y: 19 }, { x: 62, y: 13 }] },
      ],
    },
    {
      title: 'The far group prepares — through consensus, before it answers',
      prose:
        'Leader B takes its write locks, picks a <b>prepare timestamp</b> larger than anything it has issued before, and logs a prepare record <em>through Paxos</em> — a majority of its replicas, durably, before it says a word back. That is Chapter 8’s bill arriving inside phase one of a two-phase commit. It then tells the coordinator its prepare stamp. <b>The coordinator skips this phase for itself</b>, because it is about to write a commit record through its own Paxos group anyway.',
      focus: ['lb', 'rb', 'la'],
      particles: [
        { from: 'lb', to: 'rb', color: C.replica },
        { from: 'rb', to: 'lb', color: C.replica },
        { from: 'lb', to: 'la', color: C.leader },
      ],
    },
    {
      title: 'Ask what time it is, and get back a width',
      prose:
        'Now the part no other system in this book can do. The coordinator calls <code>TT.now()</code> and receives <b>an interval</b> — earliest and latest — guaranteed to contain the true time. It picks the commit stamp <b>s at the latest end</b>, the most pessimistic point available, and no smaller than every participant’s prepare stamp. <em>Choosing the middle would be cheaper and wrong.</em> In production that interval is about 1 ms wide just after a clock poll and about 7 ms just before the next, averaging near 4.',
      focus: ['la', 'tta'],
      particles: [
        { from: 'la', to: 'tta', color: C.clock, via: [{ x: 57.5, y: 13 }, { x: 57.5, y: 38 }] },
        { from: 'tta', to: 'la', color: C.clock, via: [{ x: 57.5, y: 38 }, { x: 57.5, y: 13 }] },
      ],
    },
    {
      title: 'Log the commit — a majority, durably, as always',
      prose:
        'The coordinator writes the commit record through its own Paxos group. This is the step every chapter since Chapter 8 has ended on, and by now it should feel routine: <b>a majority has it on disk, so the decision survives losing a minority</b>, including the coordinator itself. Note what has <em>not</em> happened yet — no replica has applied it, no lock has been released, and the client has been told nothing.',
      focus: ['la', 'ra'],
      particles: [
        { from: 'la', to: 'ra', color: C.replica },
        { from: 'ra', to: 'la', color: C.replica },
      ],
    },
    {
      title: 'And now it does nothing, deliberately',
      prose:
        'Nothing moves in this step and that is not a rendering bug. The decision is made and durable, and the coordinator <b>refuses to reveal it</b> until <code>TT.after(s)</code> is true — until the stamp it chose is certainly in the past by every clock on earth. Locks stay held. The client keeps waiting. This is <b>commit wait</b>, it costs about <b>2ε</b>, and the measured cost in the paper’s microbenchmark is roughly <b>5 ms</b> of a 14 ms write. <em>The one trick of this paper is being willing to be slow on purpose for a bounded, measurable amount of time.</em>',
      focus: ['la'],
      particles: [],
    },
    {
      title: 'Release, and tell everyone the same number',
      prose:
        'Commit wait is over, so the coordinator sends the commit stamp to the client and to every participant leader. Each participant logs the outcome through <em>its own</em> Paxos group, applies the write <b>at that same stamp</b>, and drops its locks. Every replica on both continents now agrees not just that the transaction happened but exactly <b>when</b> it happened — and that shared number is what makes a consistent read across the whole database at a timestamp possible at all.',
      focus: ['la', 'lb', 'rb', 'app'],
      particles: [
        { from: 'la', to: 'app', color: C.leader },
        { from: 'la', to: 'lb', color: C.leader },
        { from: 'lb', to: 'rb', color: C.replica },
      ],
    },
    {
      title: 'Meanwhile a reader, on the far continent, touches none of this',
      prose:
        'This is what the ten milliseconds bought. A read-only transaction picks a timestamp and reads from <b>any replica that is far enough ahead</b> — not the leader, no locks, no coordination, and it blocks nobody and nothing blocks it. Snapshot reads in the past are free the same way. <em>Commit wait is paid once, on writes, by the writer; the guarantee it creates is spent everywhere else, forever.</em> Consistent backups, MapReduce over a live database, and schema changes stamped with a future time all come out of this one property.',
      focus: ['app', 'rb'],
      particles: [
        { from: 'app', to: 'rb', color: C.client, via: [{ x: 24, y: 19 }, { x: 62, y: 19 }, { x: 62, y: 24.5 }] },
        { from: 'rb', to: 'app', color: C.replica, via: [{ x: 62, y: 24.5 }, { x: 62, y: 19 }, { x: 24, y: 19 }] },
      ],
    },
  ],
}
