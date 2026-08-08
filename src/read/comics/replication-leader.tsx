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
      think: {
        q: 'Your leader runs async replication (the fast default) and suddenly dies. A follower is promoted to leader. A user who got a “payment saved” confirmation two seconds ago reloads — and it’s gone. How did a *confirmed* write vanish?',
        a: '**Async tells the client “done” before any follower has a copy.** Those last couple of seconds of writes lived *only* on the old leader. When it died and a follower took over, that follower had never received them — so they’re simply lost, even though the user saw a success message. That’s the real cost of async: the confirmation is a promise the followers hadn’t yet backed up. Synchronous replication closes the gap, but then every write waits on a follower — and one slow follower stalls everyone.',
      },
    },
  ],
  bubbles: [
    { term: 'Leader.', body: 'The one replica that accepts writes. Also called primary or master.' },
    { term: 'Follower.', body: 'A read-only replica that replays the leader’s log. Also: replica, secondary, standby.' },
    { term: 'Failover.', body: 'When the leader dies, a follower is promoted to leader. Easy to say, full of sharp edges.' },
  ],
  inTheWild: {
    note: 'failover — where the simple design gets its sharp edges',
    points: [
      'If the old leader isn’t really dead — just unreachable for a moment — you can end up with **two leaders** both taking writes. Now two nodes disagree about the truth, and merging them later means someone’s writes get thrown away. This is why promotion should need a *majority* to agree, not one node’s hunch. (a **split brain**)',
      'When the leader dies, *which* follower takes over? Under async, every follower is missing something — and promoting the one that’s furthest behind throws away the most data. Systems try to pick the most caught-up follower, but “most caught-up” still isn’t “caught up.”',
      'How long do you wait before declaring the leader dead? Too short and a brief network hiccup triggers a needless, disruptive failover. Too long and you’re simply down for that whole window. **No single timeout is right for both.**',
      'The instant failover happens, every read that was spread across followers piles onto the brand-new leader while the others catch up. A failover meant to save you can trigger a load spike that knocks you over *again*.',
    ],
  },
  tradeoffs: {
    title: 'how safe should each write be?',
    rows: [
      { choose: 'Async to everyone', when: 'speed matters most and losing the last second of writes in a rare crash is survivable — **most web apps, social, analytics**. (the common default)' },
      { choose: 'Sync to one follower', when: 'you can’t lose a confirmed write but can’t wait on *all* replicas — keep one in lockstep, the rest async. (**semi-synchronous**)' },
      { choose: 'Sync to a majority', when: 'a confirmed write must survive any single failure, latency be damned — **payments, orders, anything you can’t replay**. (this is really consensus, **Ch 9**)' },
      { choose: 'Many leaders', when: 'users span the globe and each region needs a *local* writer — **collaborative, multi-region apps**. But now two regions can edit the same thing, and you’re back to merging conflicts.' },
    ],
  },
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
