import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* Raft rather than Paxos, because Raft is the one people implement and because
   a split vote is a thing you can watch happen. The Paxos two-phase shape gets
   a diagram and prose in the chapter instead.

   Amber moves once, at step 3, and then stays — which is the difference from
   the Dynamo and Cassandra traces, where it moved every step. That contrast is
   the point of the act: Act II's systems had no leader and paid for it in
   conflicts; this one elects a leader and pays for it in elections.

   Geometry: five servers stacked in the left zone, the client and the committed
   log on the right. The corridor at x≈54.5 (right of the stack, inside the
   zone) carries the leader's traffic to the servers it is not adjacent to;
   without it those routes cut straight through the servers in between. */
const C = {
  follower: VIZ.blue,
  leader: VIZ.amber,
  log: VIZ.violet,
  bad: VIZ.red,
}

export const raftTrace: TraceSpec = {
  title: 'Five servers, one leader, and the failure the whole design is for',
  aspect: 0.5,
  zones: [
    { label: 'Five servers', x: 2, y: 4, w: 56, h: 42 },
    { label: 'The client', x: 61, y: 4, w: 36, h: 42 },
  ],
  nodes: [
    { id: 's1', x: 5, y: 7, w: 48, h: 7, label: 'S1 · term 1', sub: 'follower', color: C.follower },
    { id: 's2', x: 5, y: 16, w: 48, h: 7, label: 'S2 · term 1', sub: 'follower', color: C.follower },
    { id: 's3', x: 5, y: 25, w: 48, h: 7, label: 'S3 · term 1', sub: 'follower', color: C.follower },
    { id: 's4', x: 5, y: 34, w: 48, h: 7, label: 'S4 · term 1', sub: 'follower', color: C.follower },
    { id: 'app', x: 64, y: 8, w: 30, h: 8, label: 'Your service', sub: 'wants one value stored', color: VIZ.green },
    { id: 'log', x: 64, y: 30, w: 30, h: 8, label: 'The committed log', sub: 'identical everywhere', color: C.log },
  ],
  steps: [
    {
      title: 'Nobody is in charge, and a clock runs out',
      prose:
        'Every server starts as a <b>follower</b> doing nothing but waiting to hear from a leader. Each holds a countdown — chosen randomly from a range, in the paper <b>150 to 300 milliseconds</b> — and the randomness is load-bearing rather than decorative. Without it every server times out together, every server stands for election, nobody wins, and they do it again: the paper measured that case taking <b>over ten seconds</b> to settle. With it, one server almost always wakes up first.',
      focus: ['s1', 's2', 's3', 's4'],
      particles: [],
    },
    {
      title: 'S2 stands for election and asks the others to vote',
      prose:
        'S2’s timer fires first. It increments the <b>term</b> — a number that only ever goes up, and which is how every message in this system is dated — declares itself a candidate, votes for itself, and asks everyone else. A server grants its vote if it has not already voted in this term <em>and</em> the candidate’s log is at least as up to date as its own. That second condition is doing quiet, essential work: <b>it makes it impossible to elect a leader who is missing committed entries.</b>',
      focus: ['s2', 's1', 's3', 's4'],
      particles: [
        { from: 's2', to: 's1', color: C.follower },
        { from: 's2', to: 's3', color: C.follower },
        { from: 's2', to: 's4', color: C.follower, via: [{ x: 54.5, y: 19.5 }, { x: 54.5, y: 37.5 }] },
      ],
    },
    {
      title: 'A majority says yes — and a majority is the whole trick',
      prose:
        'Three of the four grant it, so S2 is leader for term 2 and immediately starts sending heartbeats to stop anyone else timing out. <b>Why a majority and not everybody?</b> Because two majorities of the same group cannot be disjoint: whatever an earlier majority agreed, any later majority contains at least one server that was there and remembers. <em>Requiring everybody would mean one crashed machine halts the system</em> — which is exactly what Chapter 7’s algorithm does, and exactly what this fixes.',
      focus: ['s1', 's2', 's3', 's4'],
      particles: [
        { from: 's1', to: 's2', color: C.leader },
        { from: 's3', to: 's2', color: C.leader },
        { from: 's4', to: 's2', color: C.leader, via: [{ x: 54.5, y: 37.5 }, { x: 54.5, y: 19.5 }] },
      ],
    },
    {
      title: 'A write arrives — appended first, committed later',
      prose:
        'The client sends a command. The leader appends it to <b>its own log first</b> and only then ships it out; nothing is applied to anything yet. That ordering is why the log is the primitive rather than the value: <em>the leader is not deciding what the answer is, it is deciding what position in a sequence this command occupies.</em> Everything else — the state machine, the database on top, the lock service in the next chapter — is a function of that sequence.',
      focus: ['app', 's2', 's1', 's3'],
      particles: [
        { from: 'app', to: 's2', color: VIZ.green },
        { from: 's2', to: 's1', color: C.log },
        { from: 's2', to: 's3', color: C.log },
      ],
    },
    {
      title: 'A majority has it on disk — now it is committed, and now you are told',
      prose:
        'Once a majority has written the entry durably, the leader marks it <b>committed</b>, applies it, and answers the client. It piggybacks the new commit point on the next heartbeat, so the followers apply it too, slightly later. <b>The cost of every write is one round trip to half the cluster</b>, and no cleverness removes it — that latency is what you are buying agreement with, and it is why the next chapter refuses to pay it on reads.',
      focus: ['s1', 's3', 's2', 'log', 'app'],
      particles: [
        { from: 's1', to: 's2', color: C.log },
        { from: 's3', to: 's2', color: C.log },
        { from: 's2', to: 'log', color: C.log },
        { from: 's2', to: 'app', color: C.leader },
      ],
    },
    {
      title: 'The leader dies mid-flight, and one follower has an entry nobody else does',
      prose:
        'S2 crashes just after sending an entry to S1 and nobody else. That entry is <b>on disk and not committed</b>, and the distinction is everything: it was never acknowledged, so no client was told it succeeded, and it is safe to throw away. Meanwhile the heartbeats stop, the followers’ timers run out, and the election begins again with a higher term. <em>Any message stamped with an older term is now ignored by everyone</em> — which is how a system with no synchronised clock nonetheless refuses to listen to the past.',
      focus: ['s2', 's1', 's3', 's4'],
      particles: [
        { from: 's2', to: 's1', color: C.bad },
        { from: 's1', to: 's3', color: C.bad, via: [{ x: 54.5, y: 10.5 }, { x: 54.5, y: 28.5 }] },
        { from: 's1', to: 's4', color: C.bad, via: [{ x: 54.5, y: 10.5 }, { x: 54.5, y: 37.5 }] },
      ],
    },
    {
      title: 'The new leader overwrites the difference, and nobody outside noticed',
      prose:
        'S3 wins term 3. It never had that stray entry, and it was allowed to win because its log was up to date with everything <em>committed</em>. It now forces its own log onto the others: it walks backwards with each follower until it finds where they agree, then overwrites everything after. <b>S1’s uncommitted entry is deleted.</b> That is not data loss — it is the definition of uncommitted. The paper measured the whole gap, crash to new leader serving, at roughly <b>half the minimum election timeout</b>.',
      focus: ['s3', 's1', 's4', 'log'],
      particles: [
        { from: 's3', to: 's1', color: C.leader, via: [{ x: 54.5, y: 28.5 }, { x: 54.5, y: 10.5 }] },
        { from: 's3', to: 's4', color: C.leader, via: [{ x: 54.5, y: 28.5 }, { x: 54.5, y: 37.5 }] },
        { from: 's3', to: 'log', color: C.log },
      ],
    },
  ],
}
