import type { Comic } from '../types'
import { RaftDiagram } from '../diagrams'

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
    },
    {
      n: 'Step 04',
      title: 'Split votes & split brains',
      accent: 'terra',
      rung: 'Rung 1 · Intuition',
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
  next: { slug: 'storage', title: 'Storage & Retrieval' },
}
