import type { Comic } from '../types'
import { LagDiagram } from '../diagrams'

export const replicationLag: Comic = {
  slug: 'replication-lag',
  chapter: 'Chapter 5 · Replication',
  chapterNo: 'Ch 5',
  title: 'Replication Lag',
  dek: 'Async replication is fast — and it means your followers are always a little bit in the past. Here is what that costs, and how to pay it.',
  minutes: 5,
  caption:
    'A leader confirms a write immediately and tells followers *whenever*. For a moment — usually milliseconds, sometimes seconds — a follower holds an **older** version of the data. Read from it and you see the past. This is **replication lag**, and it breaks intuitions in three specific ways.',
  steps: [
    {
      n: 'Step 01',
      title: 'You read your own write — and it’s gone',
      accent: 'terra',
      rung: 'Rung 1 · Intuition',
      diagram: <LagDiagram />,
      body: [
        'You update your profile (write → leader), then reload the page (read → a lagging follower). Your change **isn’t there yet**. You refresh in a panic; a second later it appears.',
        'The system is consistent *eventually* — but the user watched their own edit vanish.',
      ],
    },
    {
      n: 'Fix 01',
      title: 'Read-your-writes',
      accent: 'denim',
      rung: 'Rung 2 · Mechanism',
      body: [
        'Guarantee that a user always sees **their own** updates. Route reads of things they just wrote to the **leader** (or to a follower known to be caught up), for a little while after the write.',
      ],
      callout: {
        kind: 'good',
        big: 'guarantee',
        text: 'Others may still see the old value briefly — but *you* never see your own write disappear.',
      },
      think: {
        q: 'The simplest fix for *all* of this staleness: just send every read to the leader too. No follower, no lag, no anomalies. Why doesn’t everyone do that?',
        a: '**Because the whole reason you added followers was to take read load off the leader.** Send every read back to the leader and you’ve thrown that away — it now serves every read *and* every write, and becomes the exact bottleneck you were escaping. The craft is reading from the leader only for the few things that truly need to be fresh — your own just-made edit — and letting everything else read from followers. You don’t remove lag; you spend freshness only where it’s worth paying for.',
      },
    },
    {
      n: 'Step 02',
      title: 'Time runs backwards',
      accent: 'terra',
      rung: 'Rung 1 · Intuition',
      body: [
        'You refresh twice. The first read hits a fresh follower and shows the new comment; the second hits a **more-lagged** follower and the comment is gone again. You’ve moved *backward* in time.',
        'The fix is **monotonic reads**: pin each user to the same replica (e.g. by hashing their id) so they never jump to a more-stale one.',
      ],
    },
    {
      n: 'Step 03',
      title: 'Cause arrives after effect',
      body: [
        'Two writes with a causal link — a question, then its answer — replicate down different paths. A reader sees the **answer before the question**. This is the **consistent-prefix** problem, and it’s why partitioned systems track causal dependencies.',
        'Three anomalies, one root cause: the copy you read is behind the copy you wrote.',
      ],
    },
  ],
  bubbles: [
    { term: 'Eventual consistency.', body: 'Stop writing and the followers catch up — eventually. Says nothing about *how long*.' },
    { term: 'Read-your-writes.', body: 'You always see your own updates. A per-user promise, not a global one.' },
    { term: 'Monotonic reads.', body: 'Time never runs backwards for a reader — no jumping to a more-stale replica.' },
  ],
  inTheWild: {
    note: 'why “just add a guarantee” is harder than it sounds',
    points: [
      '“Show users their own writes” sounds simple until they post on their phone and read on their laptop. The laptop doesn’t know the phone just posted, reads a stale follower, and the post is missing. Now you have to track writes per *user*, not per device.',
      'Pinning a user to one replica (so time doesn’t run backwards) works — until that replica dies or gets overloaded and you have to move them. They may land on a *more*-stale one, and time runs backwards anyway. The guarantee is only as stable as the routing under it.',
      'You’d like to route around lagging followers, but measuring lag is slippery: a follower can report “caught up” overall and still be seconds behind on the *one* partition you care about. Averages hide the replica that’s badly stale.',
      'In the demo, lag is milliseconds. In production a burst of writes, a slow disk, or a long query on a follower can stretch it to seconds or minutes — usually right when traffic is highest and users are most likely to notice.',
    ],
  },
  tradeoffs: {
    title: 'which staleness guarantee does this feature need?',
    rows: [
      { choose: 'None — read any follower', when: 'a few seconds stale is invisible or harmless — **someone else’s post count, a trending list, analytics**.' },
      { choose: 'Read-your-writes', when: 'users must see their *own* action immediately — **posting a comment, editing a profile, changing settings**.' },
      { choose: 'Monotonic reads', when: 'a little behind is fine, but going *backwards* isn’t — **a feed that must not un-show things, a counter that must not drop**.' },
      { choose: 'Full consistency', when: 'causally-linked events must appear in order, or you need the true latest — **chat, a bank balance**. (now you’re paying for consensus, **Ch 9**)' },
    ],
  },
  misconception: {
    think: '“Eventual consistency means the data will be right in a moment.”',
    actually:
      'Actually — “eventual” makes **no promise about when**. Under load or a slow follower the window can stretch to seconds, and the three anomalies (your-own-write, time-going-backwards, cause-after-effect) all bite inside it. You don’t remove lag; you add the *specific* guarantee (read-your-writes, monotonic reads) the feature needs.',
  },
  sources: [
    {
      year: '2013',
      title: 'Highly Available Transactions: Virtues and Limitations — Bailis et al. (VLDB)',
      url: 'https://www.vldb.org/pvldb/vol7/p181-bailis.pdf',
      note: 'Which consistency guarantees you can keep while staying available — and their costs.',
    },
  ],
  seenIn: [
    { label: 'Postgres — replica lag', to: '/components/postgres', live: true },
    { label: 'Feed — read from replicas', to: '/sims/feed', live: true },
    { label: 'Redis — async replicas', to: '/components/redis', live: true },
  ],
  finale: {
    title: 'The price of going fast',
    body: 'Every read replica you add for throughput adds a window where the data is stale. The Feed simulation lets you push reads onto lagging replicas and watch the staleness show up.',
  },
  next: { slug: 'replication-quorum', title: 'Leaderless & Quorums' },
}
