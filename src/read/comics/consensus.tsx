import type { Comic } from '../types'
import { RaftDiagram, ConsistencyKindsDiagram, LogCommitDiagram, SplitVoteDiagram } from '../diagrams'

export const consensus: Comic = {
  slug: 'consensus',
  chapter: 'Chapter 9 · Consistency & Consensus',
  chapterNo: 'Ch 9',
  title: 'Raft, Illustrated',
  dek: 'Sometimes several machines must agree on one value — who leads, what’s next in the log — even as some crash and messages vanish. That’s consensus.',
  minutes: 6,
  caption:
    'Replication (Ch 5) copies data; it doesn’t make nodes **agree**. Consensus does: get a group to decide on a single value — the next log entry, the current leader — and *stick to it* despite crashes and lost messages. It sounds abstract until you realize half your stack (leader election, distributed locks, config) is consensus underneath. **Raft** is the version built to be understood.',
  steps: [
    {
      n: 'Step 01',
      title: 'Two kinds of “consistent”',
      rung: 'Rung 1 · Intuition',
      diagram: <ConsistencyKindsDiagram />,
      body: [
        '**Eventual consistency** (Ch 5’s leaderless world): replicas may disagree for a while, then converge. Cheap and available.',
        '**Linearizable**: the system behaves as if there’s **one** copy and every operation happens at a single instant — once a write is acknowledged, every later read sees it. That single agreed history is what consensus buys, and it isn’t free.',
      ],
    },
    {
      n: 'Step 02',
      title: 'Elect a leader',
      accent: 'denim',
      rung: 'Rung 2 · Mechanism',
      diagram: <RaftDiagram />,
      body: [
        'Raft chops time into numbered [[term|A logical clock: an ever-increasing number labeling each election round. Every message carries its term; a higher term always wins, which is how stale leaders step down.]]s. Everyone starts as a **follower**. Hear nothing from a leader before a randomized **election timeout**, and a follower becomes a **candidate**, bumps the term, and asks everyone to vote.',
        'Collect votes from a **majority** and you’re the leader. The randomized timeouts make it unlikely two candidates start at once.',
      ],
    },
    {
      n: 'Step 03',
      title: 'Replicate the log',
      accent: 'denim',
      rung: 'Rung 2 · Mechanism',
      diagram: <LogCommitDiagram />,
      code: {
        file: 'commit.py',
        lines: [
          { t: 'def on_append_response(entry, acks):' },
          { t: '    if acks >= len(cluster) // 2 + 1:      # a majority', hl: 'good' },
          { t: '        entry.committed = True' },
          { t: '        apply_to_state_machine(entry)     # in log order' },
          { t: '    # 5 nodes -> need 3.  6 nodes -> need 4 (still survives 2)' },
        ],
      },
      body: [
        'The leader takes every change as a **log entry** and ships it to followers. Once a **majority** have stored an entry, the leader marks it **committed** and applies it — and tells followers to do the same, in order.',
        'Because entries commit in log order and only after a majority hold them, every node replays the **same sequence** — one agreed history.',
      ],
      deeper: {
        summary: 'Why a majority is the magic number.',
        body: [
          'A **quorum** is any subset larger than half. The key property: **any two majorities overlap** in at least one node. So a value committed by one majority can never be contradicted by another majority — the overlapping node remembers it. That single fact gives you at most one leader per term *and* durable commits, and it’s why a 5-node cluster survives 2 failures but a 6-node one still only survives 2 (you always need ⌊n/2⌋+1).',
        ],
      },
      think: {
        q: 'You want to survive more failures, so you grow your Raft cluster from **5 nodes to 6**. How many failures can each survive — and did the extra node help?',
        a: '**Both survive exactly 2 failures.** A majority of 5 is 3, so you can lose 2; a majority of 6 is 4, so you can *still* only lose 2 — but now every commit must reach *four* nodes instead of three, so it’s slower. The sixth node bought zero extra fault tolerance and made every decision more expensive. That’s why Raft clusters are almost always **odd** — 3, 5, 7. An even node just adds the cost of a bigger quorum without the benefit of surviving one more failure.',
      },
    },
    {
      n: 'Step 04',
      title: 'Split votes & split brains',
      accent: 'terra',
      rung: 'Rung 1 · Intuition',
      diagram: <SplitVoteDiagram />,
      code: {
        file: 'term.py',
        lines: [
          { t: 'def on_message(msg):' },
          { t: '    if msg.term > self.term:              # someone is newer' },
          { t: '        self.term = msg.term' },
          { t: '        self.become_follower()            # stale leader steps down', hl: 'good' },
          { t: '    elif msg.term < self.term:' },
          { t: '        reject(msg)                       # ignore the past' },
        ],
      },
      body: [
        'Two candidates can tie — each gets half, neither wins. Raft shrugs: no majority, so **no leader this term**; the randomized timeouts fire again and a new term elects a winner. A tie costs a little latency, never correctness.',
        'And a partitioned old leader? It’s stuck on a lower term. The moment it sees a higher-term message, it **steps down** — majority rule means two leaders can’t both commit.',
      ],
      callout: {
        kind: 'good',
        big: 'majority',
        text: 'One leader per term, commits that survive any minority of failures — all from “more than half, and any two halves overlap.”',
      },
    },
  ],
  bubbles: [
    { term: 'Term.', body: 'A numbered election round; a higher term always beats a lower one.' },
    { term: 'Quorum.', body: 'Any majority. Any two majorities share a node — the whole safety argument.' },
    { term: 'Split brain.', body: 'Two nodes both think they lead. Majority rule + terms prevent both from committing.' },
  ],
  inTheWild: {
    note: 'what consensus really costs in production',
    points: [
      'A committed write has to reach a majority and hear back *before* it counts — at least one round-trip to other machines on every write. Fine inside one datacenter; brutal across regions, where that’s tens of milliseconds each time. Consensus trades latency for agreement.',
      'All writes funnel through **one leader**, and each write fans out to the followers. You can’t speed writes up by adding nodes — more nodes means *more* messages per commit, not fewer. Consensus is for agreement, not throughput.',
      'Adding or removing a node from a *live* group is one of the trickiest things you can do. Do it naively and you can briefly have two overlapping majorities that each elect a leader — a split brain. Raft has a careful “joint consensus” dance precisely because this is where real clusters have corrupted themselves.',
      'You rarely *implement* Raft — but you run it: **etcd, ZooKeeper, Kafka’s controller, Consul**. When one gets slow, it’s often consensus latency (a slow disk on the leader, a far-away follower) showing up as mysterious slowness in everything that depends on it.',
    ],
  },
  tradeoffs: {
    title: 'do you actually need consensus here?',
    rows: [
      { choose: 'Yes — use Raft/Paxos', when: 'several nodes must agree on one answer and never disagree — **leader election, config, distributed locks, metadata**.' },
      { choose: 'No — eventual is fine', when: 'replicas can disagree briefly and converge, and availability beats a single truth — **shopping carts, caches, feeds**. (Ch 5 leaderless)' },
      { choose: 'Buy it, don’t build it', when: 'you need consensus but not to *write* it — lean on a proven system instead of rolling your own. **etcd, ZooKeeper, Consul.**' },
      { choose: 'Single leader, no quorum', when: 'one machine deciding is acceptable and you’ll tolerate downtime when it fails — simpler and cheaper, and fine for plenty of internal tools.' },
    ],
  },
  misconception: {
    think: '“Consensus means every node has to agree.”',
    actually:
      'Actually — consensus needs only a **majority**, and that’s the point: waiting for *all* nodes would mean one crash halts everything. Requiring a majority is exactly what lets the system keep deciding while a minority is down or unreachable.',
  },
  sources: [
    {
      year: '2014',
      title: 'In Search of an Understandable Consensus Algorithm (Raft) — Ongaro & Ousterhout',
      url: 'https://raft.github.io/raft.pdf',
      note: 'The paper written to be teachable; leader election and log replication in full.',
    },
    {
      year: '2001',
      title: 'Paxos Made Simple — Lamport',
      url: 'https://lamport.azurewebsites.net/pubs/paxos-simple.pdf',
      note: 'The classic consensus algorithm Raft was designed to be a clearer alternative to.',
    },
  ],
  seenIn: [
    { label: 'Kafka — KRaft controller', to: '/components/kafka', live: true },
    { label: 'RabbitMQ — quorum queues', to: '/components/rabbitmq', live: true },
    { label: 'etcd / Raft', note: 'roadmap' },
  ],
  finale: {
    title: 'See consensus running a real broker',
    body: 'Kafka’s KRaft mode and RabbitMQ’s quorum queues are Raft in production. Both deep-dives show where the leader, the log, and the majority live inside a system you already use.',
  },
  next: { slug: 'shuffle', title: 'The Shuffle' },
}
