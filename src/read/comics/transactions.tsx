import type { Comic } from '../types'
import {
  WriteSkewDiagram,
  AtomicityDiagram,
  NonRepeatableDiagram,
  MvccDiagram,
  TwoPlSsiDiagram,
  VersionBloatDiagram,
} from '../diagrams'

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
      diagram: <AtomicityDiagram />,
      code: {
        file: 'transfer.sql',
        lines: [
          { t: 'BEGIN;' },
          { t: '  UPDATE accounts SET balance = balance - 100 WHERE id = 1;' },
          { t: '  -- crash right here and NEITHER line survives', hl: 'bad' },
          { t: '  UPDATE accounts SET balance = balance + 100 WHERE id = 2;' },
          { t: 'COMMIT;    -- both, or neither', hl: 'good' },
        ],
      },
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
      diagram: <NonRepeatableDiagram />,
      code: {
        file: 'read_committed.sql',
        lines: [
          { t: 'BEGIN;' },
          { t: '  SELECT balance FROM accounts WHERE id = 1;   -- 100' },
          { t: '  -- someone else COMMITs 80 in between' },
          { t: '  SELECT balance FROM accounts WHERE id = 1;   -- 80 (!)', hl: 'bad' },
          { t: 'COMMIT;' },
        ],
      },
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
      diagram: <MvccDiagram />,
      code: {
        file: 'visibility.py',
        lines: [
          { t: '# which version does this transaction see?' },
          { t: 'def visible(version, snapshot):' },
          { t: '    return (version.xmin in snapshot.committed', hl: 'good' },
          { t: '            and version.xmin not in snapshot.in_progress' },
          { t: '            and (version.xmax is None' },
          { t: '                 or version.xmax not in snapshot.committed))' },
        ],
      },
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
      think: {
        q: 'You switch to `SERIALIZABLE` to kill write skew for good. Correctness solved. What just changed about the code your app has to run?',
        a: '**Your transactions can now be aborted and told to retry** — not from a bug, but because the database caught two of them on a collision course and killed one to keep the history clean. If your app fires a transaction once and assumes it worked, those aborts become errors users see. Serializable moves the cost from “reason about every anomaly” to “wrap every transaction in a retry loop.” Cheap safety — but only if you built for the retries. And under heavy contention on the *same* rows, the retries pile up and throughput drops. That’s the price of never having to think about write skew again.',
      },
    },
    {
      n: 'Step 05',
      title: 'The real thing: serializable',
      accent: 'denim',
      rung: 'Rung 2 · Mechanism',
      diagram: <TwoPlSsiDiagram />,
      code: {
        file: 'retry.py',
        lines: [
          { t: '# SERIALIZABLE can abort you — so always wrap in a retry' },
          { t: 'for attempt in range(5):' },
          { t: '    try:' },
          { t: '        with db.transaction(isolation="SERIALIZABLE"):' },
          { t: '            book_the_last_seat()' },
          { t: '        break', hl: 'good' },
          { t: '    except SerializationFailure:' },
          { t: '        sleep(backoff(attempt))      # someone else won; try again', hl: 'bad' },
        ],
      },
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
  inTheWild: {
    note: 'why isolation levels bite in real databases',
    points: [
      'The standard’s level *names* lie. Oracle’s “Serializable” is actually snapshot isolation; one database’s “Repeatable Read” differs from the next. You can’t trust the label — you have to check what your *specific* database does under it.',
      'Most databases default to **Read Committed**, not something stronger. So unless you changed it, two reads in the same transaction can already return different values — and most apps never notice until a subtle bug surfaces in production.',
      'Write skew is nasty because nothing *looks* wrong: two transactions each read, each check a rule (“at least one doctor on call”), each write a different row. No conflict, both commit, rule broken. Any *check-then-act* across rows — booking the last seat, enforcing a limit — can hide this and pass every test that runs the transactions one at a time.',
      {
        t: 'MVCC keeps old row versions so your snapshot stays stable — but one long-running transaction forces the database to keep *every* old version alive that whole time, bloating storage and slowing everyone until it finishes. A single forgotten open transaction can quietly degrade the whole database.',
        figure: <VersionBloatDiagram />,
      },
    ],
  },
  tradeoffs: {
    title: 'which isolation level for this transaction?',
    rows: [
      { choose: 'Read Committed', when: 'you just need to not see half-written data, and stale-within-a-transaction is fine — **most CRUD, reads for display**. (the common default)' },
      { choose: 'Snapshot / Repeatable Read', when: 'a transaction reads many rows that must all agree with each other — **reports, exports, anything that needs one consistent picture**.' },
      { choose: 'Serializable', when: 'a check-then-act rule must hold no matter what runs alongside it — **booking the last seat, enforcing a balance or limit**. Build the retry loop. (write-skew-proof)' },
      { choose: 'Explicit row locks', when: 'you want to force one transaction to *wait* for another on specific rows — a surgical `SELECT … FOR UPDATE` instead of raising the whole level.' },
    ],
  },
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
    { label: 'Postgres — MVCC & isolation', to: '/ddia/components/postgres', live: true },
    { label: 'Cassandra — lightweight txns', note: 'roadmap' },
  ],
  finale: {
    title: 'See MVCC and the anomalies for real',
    body: 'The Postgres deep-dive traces an UPDATE through MVCC and shows vacuum reclaiming dead row versions — the machinery that makes snapshots (and their limits) real.',
  },
  next: { slug: 'distributed-troubles', title: 'The Trouble with Distributed Systems' },
}
