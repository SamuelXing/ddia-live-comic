import type { Comic } from '../types'
import {
  QuorumDiagram, QuorumWriteDiagram, DialsDiagram, ConflictDiagram,
  SlowestOfRDiagram, ZombieValueDiagram, LwwSkewDiagram, SloppyQuorumDiagram,
} from '../diagrams'

export const replicationQuorum: Comic = {
  slug: 'replication-quorum',
  chapter: 'Chapter 5 · Replication',
  chapterNo: 'Ch 5',
  title: 'Leaderless & Quorums',
  dek: 'What if no node is the boss? Let clients write to several replicas at once — and lean on a little arithmetic to still read fresh data.',
  minutes: 5,
  caption:
    'Leader-based replication has one door for writes — which quietly means one node decides **what happened first**. **Leaderless** systems (Dynamo, Cassandra, Riak) throw out both: a client sends each write to **several replicas at once**, and *nothing* puts two writes in an order. Hold on to that second loss; it is where this chapter ends up. What keeps reads fresh in the meantime is one inequality.',
  steps: [
    {
      n: 'Step 01',
      title: 'Write to many, read from many',
      rung: 'Rung 1 · Intuition',
      diagram: <QuorumWriteDiagram />,
      body: [
        'With **N** replicas, don’t wait for all of them. A write succeeds once **W** replicas acknowledge; a read asks **R** replicas and takes the newest answer.',
        'Any client can do this to any replica at any moment. No node is funnelling the writes, which means no node is **sequencing** them either — a fact that stays quiet until Step 04.',
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
      think: {
        q: 'You set **N=3, W=1, R=1** to make reads and writes as fast as possible. One replica says “got it” for your write, then crashes before copying it to anyone. What did you just give up?',
        a: '**Both durability and freshness.** Only one machine ever had that write, and it’s gone — so the write is simply **lost**. And `W + R = 2`, which isn’t more than `3`, so your reads never had the overlap that guarantees a fresh answer anyway. `W=1, R=1` is “fire and hope”: as fast as it gets, with almost no promise. Every knob you turn down is a guarantee you’re spending.',
      },
    },
    {
      n: 'Step 03',
      title: 'Tune the dials',
      rung: 'Rung 2 · Mechanism',
      diagram: <DialsDiagram />,
      code: {
        file: 'tune.py',
        lines: [
          { t: 'N, W, R = 5, 3, 3      # W + R = 6 > 5  -> fresh reads', hl: 'good' },
          { t: 'N, W, R = 5, 1, 1      # W + R = 2 < 5  -> may read stale', hl: 'bad' },
          { t: '' },
          { t: '# heal the replicas that missed a write' },
          { t: 'on_read(k, replies):' },
          { t: '    newest = max(replies, key=version)' },
          { t: '    for r in replies:' },
          { t: '        if version(r) < version(newest):' },
          { t: '            write_back(r.node, k, newest)   # read repair' },
        ],
      },
      body: [
        'The same knobs trade speed for safety. Want **fast writes**? Lower W. Want **fast reads**? Lower R. Want them cheap and are willing to read stale? Break the inequality on purpose.',
        '**Read repair** and [[anti-entropy|A background sweep that continuously compares replicas and copies over whatever is missing. Read repair only heals the keys somebody happens to read; anti-entropy eventually reaches the ones nobody asks for.]] run in the background to heal replicas that missed a write, so the stragglers converge over time.',
      ],
    },
    {
      n: 'Step 04',
      title: 'The honest caveat',
      accent: 'terra',
      rung: 'Rung 1 · Intuition',
      diagram: <ConflictDiagram />,
      code: {
        file: 'resolve.py',
        lines: [
          { t: '# last-write-wins: simple, and silently drops a write' },
          { t: 'winner = max(versions, key=lambda v: v.timestamp)', hl: 'bad' },
          { t: '' },
          { t: '# keep both: the app (or a CRDT) merges them' },
          { t: 'if concurrent(v1, v2):' },
          { t: '    return merge(v1, v2)        # e.g. union the cart', hl: 'good' },
        ],
      },
      body: [
        'Step 01 said a read takes **the newest** answer. This is where that word breaks. With no leader, two clients can write the same key at the same instant to *different* replicas — and since nothing sequenced them, there is no fact of the matter about which one came second.',
        'And `W + R > N` does not rescue you, because it never promised what it looks like it promises. Overlap guarantees your read **sees every candidate value**. It does not tell you which one is *right*. Freshness and resolution are different problems, and the inequality only solves the first.',
        'So conflicts are not an edge case bolted onto the design — they are the bill for removing the leader. Add sloppy quorums and clock skew on top and reads can go stale too. Leaderless buys availability; it does not buy [[linearizability|The illusion that only one copy of the data exists: every operation appears to take effect at a single instant, and once a write is acknowledged every later read sees it. Ch 9 builds it with consensus.]] for free.',
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
  inTheWild: {
    note: '5 ways the math still bites in production',
    points: [
      {
        t: 'Ask for the freshest read and you wait for the **slowest** of your R replicas. One slow machine slows *every* read — so in real clusters, tail latency (not correctness) is what quietly pushes teams to accept slightly staler reads.',
        figure: <SlowestOfRDiagram />,
      },
      {
        t: 'Delete a key while one replica happens to be offline. It comes back later still holding the old value, and hands it right back — **the thing you deleted reappears.** (This is why a delete leaves a little “was-deleted” marker, a *tombstone*, that lingers a while.)',
        figure: <ZombieValueDiagram />,
      },
      {
        t: 'When two people write the same key at the same moment, many systems just keep the one with the newer **clock timestamp** and throw the other away — no error, no warning. And if the two clocks disagree, the “winner” might even be the *older* write. **Someone’s change silently vanishes.**',
        figure: <LwwSkewDiagram />,
      },
      {
        t: 'During a network split, some systems take your write on **whatever nodes they can still reach** instead of the key’s real replicas, just to stay up. The write “succeeds” — but a normal read later asks the real replicas, which never got it, so it looks lost. (This stand-in trick is a *sloppy quorum*.)',
        figure: <SloppyQuorumDiagram />,
      },
      /* No figure. This one is advice about who to believe, not a mechanism —
         there is no sequence to draw, and a drawing here would be decoration
         competing with the four above it. */
      'Databases advertise strong guarantees; a famous test suite called **Jepsen** keeps catching them break those promises under network trouble. When it really matters, trust the test results, not the datasheet.',
    ],
  },
  tradeoffs: {
    title: 'when two writes collide, who wins?',
    rows: [
      { choose: 'Keep the newest', when: 'collisions are rare and losing one now and then is fine — **metrics, caches, session data**. (a.k.a. last-write-wins)' },
      { choose: 'Keep both, merge later', when: 'you **can’t lose a write** and your app knows how to combine them — **shopping carts, shared docs**. (the bookkeeping is called *version vectors*)' },
      { choose: 'Merge automatically', when: 'you want the system to combine concurrent writes with **no app code** — **counters, sets, presence**. (these data types are *CRDTs*)' },
      { choose: 'Just elect a leader', when: 'you truly need **one correct answer, every time**. Quorums won’t give it — stop tuning W/R and go to consensus **(Ch 9)**.' },
    ],
  },
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
      note: 'The origin of tunable quorums, version vectors, and read repair — read §4 for exactly how the guarantees soften under failure.',
    },
    {
      year: '2013',
      title: 'Quantifying Eventual Consistency with PBS — Bailis et al. (VLDB)',
      url: 'http://www.bailis.org/papers/pbs-vldb2012.pdf',
      note: 'Puts numbers on “how stale, how often” for a given W/R — turns hand-waving into a distribution.',
    },
    {
      year: 'Jepsen',
      title: 'Jepsen analyses — Cassandra, Riak, and friends (aphyr.com)',
      url: 'https://jepsen.io/analyses',
      note: 'What actually breaks under partition. The antidote to trusting a system’s own consistency claims.',
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
