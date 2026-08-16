import type { Chapter } from '../types'
import { RumTriangleDiagram, RumTradesDiagram } from '../diagrams'

/* The book's first interlude, and the shape of every interlude after it: no
   `paper` field, so no citation card and no answer key; no DesignIt, because
   this is not a design problem the reader can be walked into; four short steps
   and two figures. It exists to name an axis the surrounding chapters keep
   arguing along without naming, so the next fourteen can stop re-arguing it. */

export const rum: Chapter = {
  slug: 'rum',
  act: 'Act I · The Web Breaks the Box',
  paperNo: 'Interlude',
  title: 'Interlude: The RUM Triangle',
  dek: 'Three chapters, three storage decisions, and the same argument underneath each one. Here is the shape of that argument, named once — so the rest of the book can stop having it.',
  minutes: 7,
  caption:
    'You have now watched three systems choose how bytes sit on a disk, and each time the argument had the same skeleton with nobody drawing it. GFS refused to edit anything and got writes so cheap they are a single sequential append — then paid for it on every read, and in space that only comes back at compaction. Bigtable made the same bargain one floor up and called it an LSM tree. The B-tree, which nobody in Act I chose, makes the opposite trade entirely. **Stop for one page and name the axis.** Every access method anyone has ever designed pays three tolls, and the interesting part is that it can dodge exactly two of them.',
  steps: [
    {
      n: 'The idea',
      title: 'Three overheads, and you may only avoid two',
      accent: 'terra',
      body: [
        'The framing comes from a 2016 paper with an unusually honest title: **the RUM conjecture**, not the RUM theorem. Three overheads, and you already measure all three under different names:',
        '**Read overhead.** How much you have to touch to answer a question. Bytes read divided by bytes wanted. Your operators call it *read amplification*.',
        '**Update overhead.** How much you have to write to record one change. The B-tree that rewrites a page, a WAL entry and two index entries to store forty bytes. *Write amplification.*',
        '**Memory overhead.** What the structure costs beyond the data itself — indexes, bloom filters, versions not yet collected, slack left in pages for future inserts, replicas. *Space amplification.*',
        'And the claim: **hold two of them down and the third goes up, without bound.** Not as a proved impossibility — it is a conjecture, and it is supported by the fact that sixty years of access methods have all landed somewhere on this surface rather than off it.',
      ],
      diagram: <RumTriangleDiagram />,
    },
    {
      n: 'Reading back',
      title: 'Act I again, with the names attached',
      body: [
        '**GFS is a pure update-overhead play.** Refusing in-place edits means a write is one sequential append and nothing else — the cheapest update anyone has ever charged for. Read overhead is where the bill lands: a reader may have to skip padding and duplicates, and it is the *application* that pays, in checksums and record ids. Memory pays too, three replicas plus whatever garbage has not yet been compacted away.',
        '**Bigtable is the same move with the arithmetic on show.** Memtable, immutable sorted files, background merges. Reads consult several files instead of one, and old versions linger until a major compaction runs. Then it does the thing that makes the triangle worth knowing: it spends **memory** on bloom filters to win back most of the **read** cost. Not a free improvement — a purchase.',
        '**The B-tree that Act I never chose** sits across the triangle. One path from root to leaf, so read overhead is close to the floor; a modest fraction of space for the index. It pays in updates: roughly three times the logical write once you count the log, the page and the indexes — *and it must read the leaf before it can write it*, which is the whole argument of the calculator’s newest ceiling.',
        'None of the three is better. **They are three positions on one surface**, and which one is right is a question about your workload rather than about the engine.',
      ],
      think: {
        q: 'Compression looks like it beats the conjecture: it shrinks memory *and* often speeds up reads, because there is less to pull off the disk. Free lunch?',
        a: 'No — it is paid for in a currency the triangle does not have an axis for, which is **CPU**. Decoding costs cycles on every read, and the reason it still often wins is that the disk or network was the constraint and the CPU was idle, so you swapped a scarce resource for an abundant one. That is the honest general form of every "free" optimisation: *find a resource nobody is using and spend that instead.* It stops working the moment the machine changes shape — which is exactly what happened when storage got fast enough that decompression became the bottleneck.',
      },
    },
    {
      n: 'The move',
      title: 'You cannot leave the triangle — but you can buy along it',
      accent: 'denim',
      body: [
        'The conjecture is not a counsel of despair. It says that every improvement is *purchased*, and it tells you where to look for the receipt.',
        'A **bloom filter** spends memory — a few bits per key — to avoid reading files that cannot contain what you asked for. **Compaction** spends update overhead, in the background, to buy back both read cost and space. A **second index** spends memory and slows every write, to make one more query shape cheap. Each is a named trade with a direction.',
        'So the useful habit is a question rather than a rule. **When someone says a system is “just faster”, ask which of the three it spent.** If they can name it, you now know the workload where their answer stops being true. If they cannot, one of two things is happening: it is a genuine constant-factor engineering win, which is rare and real and worth respecting — or the bill has not arrived yet, and it will arrive as write amplification under sustained load, or as space that never comes back.',
      ],
      diagram: <RumTradesDiagram />,
    },
    {
      n: 'Why here',
      title: 'And why this sits before Act II rather than inside Act I',
      body: [
        'Everything so far has been about bytes on one machine’s disk. Act II is about **copies**, and the triangle walks straight across with its axes renamed.',
        'How many replicas must answer before a read is trustworthy — that is read overhead, over a network. How many must acknowledge before a write is safe — update overhead. How many copies exist at all — memory. **Dynamo’s N, R and W are a RUM triangle with a network in the middle of it**, and the reason its knobs feel familiar when you meet them is that you have already met the shape.',
        'One warning before the next interlude, because these two get confused constantly. **RUM is about cost; CAP is about possibility.** RUM says you will pay for what you take, and lets you choose the currency. CAP says there is something you cannot have at all. A conjecture about accounting and a theorem about impossibility are not the same kind of claim, and treating either one as the other is how people end up arguing that their database has beaten physics.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Read amplification.',
      body: 'Bytes actually read to satisfy a query, over bytes you wanted. An LSM read checking six files has a read amplification of about six.',
    },
    {
      term: 'Write amplification.',
      body: 'Bytes written to durable storage per byte of logical change. The B-tree’s ×3 is log plus page plus indexes; an LSM pays its version later, in compaction.',
    },
    {
      term: 'Space amplification.',
      body: 'Bytes stored over bytes of live data. Old versions, tombstones, page slack, and anything compaction has not got to yet.',
    },
    {
      term: 'Access method.',
      body: 'The structure that decides where a record lives and how it is found — B-tree, LSM tree, hash index, heap file. The thing this whole interlude is about.',
    },
  ],
  tradeoffs: {
    title: 'which corner to stand in',
    rows: [
      {
        choose: 'Minimise reads',
        when: 'queries dominate and arrive in shapes you can predict. Index them, cache them, filter them — and accept that every index is a tax on every write, forever, including the writes that never query it.',
      },
      {
        choose: 'Minimise updates',
        when: 'ingest never stops and is the thing that will break first. Append, buffer, merge later. You are borrowing against reads and space, and compaction is the repayment schedule — **size it, or it sizes you.**',
      },
      {
        choose: 'Minimise memory',
        when: 'the data is enormous and mostly cold, and the cost that matters is the monthly one. Compress it, drop the indexes, keep one copy in a cheap tier — and expect the occasional query to be genuinely slow rather than pretending otherwise.',
      },
      {
        choose: 'Refuse to choose',
        when: 'the workload is genuinely mixed and small enough that mediocrity on all three is affordable. This is a real answer and the most common one in practice — the failure is not making it, it is making it *by accident* and then being surprised.',
      },
    ],
  },
  misconception: {
    think: '“The RUM conjecture is a result like CAP — it proves you can’t have all three.”',
    actually:
      'It proves nothing, and it says so in its own name. CAP is an **impossibility theorem**: there is a thing that cannot exist, and no amount of engineering will produce it. RUM is an **accounting claim**: everything can be improved, and every improvement is paid for out of one of three budgets. That difference changes what you do with it. You do not use RUM to rule a design out — you use it to find the invoice, and then to ask whether your workload can afford it. A lens for reading someone else’s benchmark, mostly, and it is very good at that.',
  },
  sources: [
    {
      year: '2016',
      title: 'Designing Access Methods: The RUM Conjecture — Athanassoulis et al. (EDBT)',
      url: 'https://openproceedings.org/2016/conf/edbt/paper-12.pdf',
      note: 'Six pages, and the figure on the third is the one reproduced above. Read it for the survey as much as the conjecture: it places a few dozen real access methods on the triangle, which is a faster education in storage engines than any single system paper.',
    },
    {
      year: '2017',
      title: 'Monkey: Optimal Navigable Key-Value Store — Dayan, Athanassoulis & Idreos (SIGMOD)',
      url: 'https://nivdayan.github.io/monkeykeyvaluestore.pdf',
      note: 'The follow-up that makes the trade continuous rather than a choice of corners: allocate bloom-filter bits unevenly across LSM levels and you move along the read-memory curve on purpose. Worth reading right after, because it turns the lens into a knob.',
    },
  ],
  seenIn: [
    { label: 'B-trees vs LSM-trees — the comic', to: '/ddia/read/storage', live: true },
    { label: 'The Database GFS Deserved — Ch 3', to: '/papers/bigtable', live: true },
    { label: 'Read, write and space amplification, priced — the calculator', to: '/calculator/capacity', live: true },
  ],
  finale: {
    title: 'One axis, fourteen chapters',
    body: 'The point of stopping here is not the triangle itself — it is that you now have somewhere to put every storage argument for the rest of the book, including the ones that arrive dressed as something else. Next, back to Act I’s last chapter: the service that has been quietly appointing every master you have met so far.',
  },
  next: { title: 'The Lock Everyone Was Secretly Holding', slug: 'chubby' },
}
