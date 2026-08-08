import type { Comic } from '../types'
import { WriteSkewDiagram } from '../diagrams'

export const transactions: Comic = {
  slug: 'transactions',
  chapter: 'Chapter 7 · Transactions',
  chapterNo: 'Ch 7',
  title: 'Isolation Levels',
  dek: 'A transaction promises all-or-nothing and isolation from everyone else. That second word is where databases quietly cut corners.',
  minutes: 6,
  caption:
    'A transaction groups reads and writes so they’re **atomic** (all or nothing) and **isolated** (as if no one else were running). But true isolation is expensive, so databases offer *levels* — each one a bargain that blocks some anomalies and **permits others**. Knowing which is the difference between a correct system and a 3am data-corruption page.',
  steps: [
    {
      n: 'Step 01',
      title: 'The promise',
      rung: 'Rung 1 · Intuition',
      body: [
        'Wrap two writes in a transaction and a crash between them can’t leave you half-done — money leaves one account only if it arrives at the other. That’s **atomicity**, and it’s the easy half.',
        'The hard half is **isolation**: what does a transaction see when *others* are running at the same time?',
      ],
    },
    {
      n: 'Step 02',
      title: 'The weakest bargain',
      accent: 'terra',
      rung: 'Rung 1 · Intuition',
      body: [
        'The floor is **Read Committed**: you never read another transaction’s *uncommitted* writes (no **dirty reads**), and you never overwrite them. Most databases default here.',
        'But two reads in the same transaction can still return **different values** if someone commits in between — a *non-repeatable read*. The ground moves under you mid-transaction.',
      ],
    },
    {
      n: 'Step 03',
      title: 'Freeze the world: snapshots',
      accent: 'denim',
      rung: 'Rung 2 · Mechanism',
      body: [
        '**Snapshot isolation** (a.k.a. [[repeatable read|The transaction reads from a consistent snapshot taken at its start; every read sees the same version, as if the rest of the world froze.]]) gives each transaction a private, consistent snapshot of the DB as of when it began. Every read is stable; readers never block writers.',
        'Postgres builds this with **MVCC** — it keeps *multiple versions* of each row and shows you the ones visible to your snapshot.',
      ],
      deeper: {
        summary: 'How MVCC serves a snapshot without locking.',
        body: [
          'Each row version is stamped with the transaction id that created it. Your transaction gets a snapshot: the set of transaction ids already committed at your start. A read walks the version chain and returns the newest version **visible to that snapshot** — so writers can keep appending new versions while you read a stable past. This is why `VACUUM` exists: old versions must eventually be cleaned up.',
        ],
      },
    },
    {
      n: 'Step 04',
      title: 'The anomaly snapshots miss',
      accent: 'terra',
      rung: 'Rung 1 · Intuition',
      diagram: <WriteSkewDiagram />,
      body: [
        'Two doctors are on call. Each opens a transaction, both **read** “on-call = 2”, both reason “the other covers me”, and each takes themselves off. Both commit against their own snapshot. Result: **nobody is on call.**',
        'This is **write skew** — two transactions read the same thing and write to *different* rows, so nothing directly conflicts, yet together they break an invariant snapshot isolation can’t see.',
      ],
    },
    {
      n: 'Step 05',
      title: 'The real thing: serializable',
      accent: 'denim',
      rung: 'Rung 2 · Mechanism',
      body: [
        '**Serializable** is the top: the result is guaranteed to equal *some* one-at-a-time ordering — every anomaly gone, including write skew.',
        'Three ways to get it: actual serial execution (one thread), **two-phase locking** (readers and writers block each other — safe, slow), or **Serializable Snapshot Isolation** (SSI): run optimistically on snapshots, detect the dangerous read-write patterns, and abort a loser.',
      ],
      callout: {
        kind: 'good',
        big: 'SSI',
        text: 'Postgres’s `SERIALIZABLE` is SSI — snapshot speed, serializable safety, at the cost of occasional **retry a transaction** aborts. Design for retries and you get correctness nearly for free.',
      },
      deeper: {
        summary: '2PL vs SSI — why one blocks and the other aborts.',
        body: [
          '**2PL** acquires shared locks on reads and exclusive locks on writes and holds them to commit — correctness by *prevention*, but readers and writers wait on each other and deadlocks happen. **SSI** takes no read locks; it lets transactions run on their snapshots and tracks *rw-dependencies*. If it spots the specific cycle that produces write skew, it aborts one transaction. Prevention (2PL) trades throughput for no retries; detection (SSI) trades retries for concurrency.',
        ],
      },
    },
  ],
  bubbles: [
    { term: 'Dirty read.', body: 'Reading another transaction’s uncommitted write. Read Committed blocks it.' },
    { term: 'Write skew.', body: 'Two txns read the same data, write different rows, and jointly break an invariant.' },
    { term: 'Phantom.', body: 'A write in one txn changes the *set of rows* another txn’s query matches.' },
  ],
  misconception: {
    think: '“Repeatable Read (snapshot isolation) means my transactions are serializable.”',
    actually:
      'Actually — snapshot isolation still permits **write skew** and **phantoms**. It stabilizes what you *read*, not the interactions between transactions writing different rows. Only `SERIALIZABLE` closes those. (And confusingly, the SQL standard’s isolation names don’t map cleanly onto what engines actually do.)',
  },
  sources: [
    {
      year: '1995',
      title: 'A Critique of ANSI SQL Isolation Levels — Berenson, Bernstein, Gray et al.',
      url: 'https://www.microsoft.com/en-us/research/publication/a-critique-of-ansi-sql-isolation-levels/',
      note: 'Why the standard’s levels are underspecified, and where snapshot isolation sits.',
    },
    {
      year: '2012',
      title: 'Serializable Snapshot Isolation in PostgreSQL — Ports & Grittner (VLDB)',
      url: 'https://www.vldb.org/pvldb/vol5/p1850_danrkports_vldb2012.pdf',
      note: 'How Postgres makes SERIALIZABLE cheap by detecting dangerous structures, not locking.',
    },
  ],
  seenIn: [
    { label: 'Postgres — MVCC & isolation', to: '/components/postgres', live: true },
    { label: 'Cassandra — lightweight txns', note: 'roadmap' },
  ],
  finale: {
    title: 'See MVCC and the anomalies for real',
    body: 'The Postgres deep-dive traces an UPDATE through MVCC and shows vacuum reclaiming dead row versions — the machinery that makes snapshots (and their limits) real.',
  },
  next: { slug: 'distributed-troubles', title: 'The Trouble with Distributed Systems' },
}
