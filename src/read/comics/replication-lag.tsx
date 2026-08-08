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
      body: [
        'Guarantee that a user always sees **their own** updates. Route reads of things they just wrote to the **leader** (or to a follower known to be caught up), for a little while after the write.',
      ],
      callout: {
        kind: 'good',
        big: 'guarantee',
        text: 'Others may still see the old value briefly — but *you* never see your own write disappear.',
      },
    },
    {
      n: 'Step 02',
      title: 'Time runs backwards',
      accent: 'terra',
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
