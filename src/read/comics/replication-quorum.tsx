import type { Comic } from '../types'
import { QuorumDiagram } from '../diagrams'

export const replicationQuorum: Comic = {
  slug: 'replication-quorum',
  chapter: 'Chapter 5 · Replication',
  chapterNo: 'Ch 5',
  title: 'Leaderless & Quorums',
  dek: 'What if no node is the boss? Let clients write to several replicas at once — and lean on a little arithmetic to still read fresh data.',
  minutes: 5,
  caption:
    'Leader-based replication has one door for writes, and a scramble when the leader dies. **Leaderless** systems (Dynamo, Cassandra, Riak) throw that out: a client sends every write to **several replicas at once**, and reads from several too. The magic that keeps it correct is one inequality.',
  steps: [
    {
      n: 'Step 01',
      title: 'Write to many, read from many',
      rung: 'Rung 1 · Intuition',
      body: [
        'With **N** replicas, don’t wait for all of them. A write succeeds once **W** replicas acknowledge; a read asks **R** replicas and takes the newest answer.',
        'Fast and available — a few dead replicas don’t stop you. But how do you avoid reading stale data when nobody is in charge?',
      ],
      code: {
        file: 'quorum.txt',
        lines: [
          { t: 'N = 5     # replicas per key' },
          { t: 'W = 3     # acks needed to call a write done' },
          { t: 'R = 3     # replicas consulted on a read' },
        ],
      },
    },
    {
      n: 'Step 02',
      title: 'The one inequality',
      accent: 'denim',
      rung: 'Rung 2 · Mechanism',
      diagram: <QuorumDiagram />,
      body: [
        'If **`W + R > N`**, the set of replicas you wrote to and the set you read from **must overlap** by at least one. That overlapping replica has the latest write — so your read is guaranteed to see it.',
        'With N=5, W=3, R=3: 3 + 3 > 5. At least one replica is in both sets. That node carries the truth.',
      ],
      callout: {
        kind: 'good',
        big: 'W + R > N',
        text: 'The quorum condition. Overlap guarantees a fresh read without any node being the leader.',
      },
    },
    {
      n: 'Step 03',
      title: 'Tune the dials',
      rung: 'Rung 2 · Mechanism',
      body: [
        'The same knobs trade speed for safety. Want **fast writes**? Lower W. Want **fast reads**? Lower R. Want them cheap and are willing to read stale? Break the inequality on purpose.',
        '**Read repair** and **anti-entropy** run in the background to heal replicas that missed a write, so the stragglers converge over time.',
      ],
    },
    {
      n: 'Step 04',
      title: 'The honest caveat',
      accent: 'terra',
      rung: 'Rung 1 · Intuition',
      body: [
        'Quorums are not magic. Concurrent writes to different replicas can still **conflict**, and edge cases (sloppy quorums, timing) can hand back stale data even when `W + R > N`. Leaderless buys availability; it does not buy you linearizability for free.',
      ],
      deeper: {
        summary: 'How leaderless stores resolve concurrent writes.',
        body: [
          'Two clients write the same key at two replicas at the “same time” — which wins? **Last-write-wins** picks by timestamp and silently **drops** the other write (simple, lossy). **Version vectors** detect that the writes were concurrent and keep both as *siblings*, handing the conflict to the application to merge — or to a **CRDT** that merges deterministically (e.g. a shopping cart unions its items). There is no single right answer; there is only which data loss you can tolerate.',
        ],
      },
    },
  ],
  bubbles: [
    { term: 'Quorum.', body: 'A subset big enough that any two subsets overlap. Here: any W and any R share a replica.' },
    { term: 'Read repair.', body: 'On a read, notice a replica is behind and write the fresh value back to it.' },
    { term: 'Sloppy quorum.', body: 'Under failure, accept writes on stand-in nodes — more available, weaker guarantee.' },
  ],
  misconception: {
    think: '“W + R > N gives me strong (linearizable) consistency.”',
    actually:
      'Actually — the overlap guarantees a read *sees* the latest committed write, but leaderless quorums still permit **concurrent-write conflicts** and, with sloppy quorums or partitions, stale reads. `W + R > N` buys freshness on the happy path, not linearizability. For that you need consensus (Ch 9).',
  },
  sources: [
    {
      year: '2007',
      title: 'Dynamo: Amazon’s Highly Available Key-value Store (SOSP)',
      url: 'https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf',
      note: 'The origin of tunable quorums, version vectors, and read repair.',
    },
  ],
  seenIn: [
    { label: 'Cassandra — tunable W/R', note: 'roadmap' },
    { label: 'DynamoDB', note: 'roadmap' },
    { label: 'Kafka — acks=all', to: '/components/kafka', live: true },
  ],
  finale: {
    title: 'No boss, just arithmetic',
    body: 'Leaderless replication is how Dynamo-style stores stay writable through failures. Kafka’s producer `acks` setting is the same idea in miniature — choose how many replicas must confirm before a write counts.',
  },
  next: { slug: 'partitioning', title: 'Consistent Hashing' },
}
