import type { Comic } from '../types'
import { LeaderFollowerDiagram } from '../diagrams'

export const replicationLeader: Comic = {
  slug: 'replication-leader',
  chapter: 'Chapter 5 · Replication',
  chapterNo: 'Ch 5',
  title: 'Leader & Followers',
  dek: 'Keep the same data on several machines. The simplest scheme — one writer, many readers — is also the one almost everything uses.',
  minutes: 4,
  caption:
    'Replication means keeping a copy of the same data on more than one node — for **more reads**, for **staying up** when a machine dies, and for **serving closer** to users. The oldest, most common answer picks one node boss.',
  steps: [
    {
      n: 'Step 01',
      title: 'One node is the boss',
      accent: 'denim',
      rung: 'Rung 1 · Intuition',
      diagram: <LeaderFollowerDiagram />,
      body: [
        'Pick one replica as the **leader**. Every write goes to it first. The others are **followers**, and they exist to take reads off the leader’s back.',
        'Reads can go to any replica; writes have exactly one door. That asymmetry is the whole design.',
      ],
    },
    {
      n: 'Step 02',
      title: 'The replication log',
      rung: 'Rung 2 · Mechanism',
      body: [
        'When the leader applies a write, it also appends it to a **replication log** and streams that log to every follower. Each follower replays the log in the same order.',
        'Same starting state + same ordered changes = same ending state. This is why Postgres ships its **WAL** to replicas and Kafka followers copy the leader’s **log** verbatim.',
      ],
      code: {
        file: 'leader.log',
        lines: [
          { t: '#1  SET user:42.name = "Ada"' },
          { t: '#2  INCR user:42.logins' },
          { t: '#3  SET user:42.name = "Ada L."   # followers replay in order', hl: 'good' },
        ],
      },
      deeper: {
        summary: 'Statement vs row-based replication — and why row wins.',
        body: [
          '**Statement-based** ships the SQL (`UPDATE … SET ts = NOW()`) — compact, but nondeterministic functions (`NOW()`, `RAND()`), triggers, and auto-increments can make a follower diverge. **Row-based** (logical) ships the actual before/after row values, so followers apply *facts*, not instructions — deterministic and replayable. Postgres’ physical WAL goes further and ships **byte-level page changes**. The trend is always toward shipping effects, not commands.',
        ],
      },
    },
    {
      n: 'Step 03',
      title: 'Sync or async?',
      accent: 'terra',
      rung: 'Rung 1 · Intuition',
      body: [
        '**Synchronous:** the leader waits for a follower to confirm before telling the client “done”. Safe — the write survives a leader crash — but one slow follower stalls every write.',
        '**Asynchronous:** the leader confirms immediately and streams to followers whenever. Fast, but a crash can lose the last few writes. Almost everyone runs async, and spends the rest of their life managing what that costs.',
      ],
      callout: {
        kind: 'bad',
        big: 'the catch',
        text: 'Async replication is the default — which means followers are always a little behind. That gap has a name, and its own comic.',
      },
    },
  ],
  bubbles: [
    { term: 'Leader.', body: 'The one replica that accepts writes. Also called primary or master.' },
    { term: 'Follower.', body: 'A read-only replica that replays the leader’s log. Also: replica, secondary, standby.' },
    { term: 'Failover.', body: 'When the leader dies, a follower is promoted to leader. Easy to say, full of sharp edges.' },
  ],
  misconception: {
    think: '“Adding followers makes my database faster.”',
    actually:
      'Actually — followers scale **reads**, not **writes**. Every write still funnels through the single leader, and each follower adds replication traffic. Read-heavy apps love replicas; a write bottleneck needs **partitioning** (Ch 6), not more copies of the same data.',
  },
  sources: [
    {
      year: '2017',
      title: 'Designing Data-Intensive Applications, Ch. 5 — Kleppmann',
      url: 'https://dataintensive.net/',
      note: 'The full taxonomy: single-leader, multi-leader, leaderless, and their failure modes.',
    },
  ],
  seenIn: [
    { label: 'Postgres — WAL streaming', to: '/components/postgres', live: true },
    { label: 'Redis — replica of', to: '/components/redis', live: true },
    { label: 'Kafka — ISR followers', to: '/components/kafka', live: true },
  ],
  finale: {
    title: 'One writer, many readers',
    body: 'Every database you’ve met runs some version of this. Postgres streams its WAL; Redis replicas follow a primary; Kafka partition followers copy the leader’s log. Open one to watch a write propagate.',
  },
  next: { slug: 'replication-lag', title: 'Replication Lag' },
}
