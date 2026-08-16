import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { ChunkBudgetDiagram, AppendRegionsDiagram } from '../diagrams'
import { gfsAppendTrace } from './gfs-trace'

export const gfs: Chapter = {
  slug: 'gfs',
  act: 'Act I · The Web Breaks the Box',
  paperNo: 'Paper 1',
  title: 'The File System That Refused to Edit',
  dek: 'Google’s machines die weekly and its files outgrew every disk on the market. The file system that falls out of that has one operation no other file system has — and quietly drops one that all of them do.',
  minutes: 16,
  paper: {
    title: 'The Google File System',
    authors: 'Sanjay Ghemawat, Howard Gobioff & Shun-Tak Leung',
    venue: 'SOSP',
    year: '2003',
    url: 'https://static.googleusercontent.com/media/research.google.com/en//archive/gfs-sosp2003.pdf',
  },
  caption:
    'It is 2001 and Google is holding a copy of the web. It does not fit — not on a disk, not on a machine, not on the largest machine anyone sells. So it is spread across hundreds of cheap boxes bought by the rack, and at that count something is broken right now and something else will break before lunch. Buying storage that scales is not on the table; the appliances that could hold this cost more than the search results they would be serving. *So you write the file system yourself, and it has to assume the hardware is dying underneath it while it runs.*',
  steps: [
    {
      n: 'Step 01',
      title: 'Write down the workload before you write anything else',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'The paper opens by listing what will actually run on this thing, and the list is the design. **Files are enormous** — a few million of them, most over 100 MB, multi-gigabyte being ordinary. **Reads are long sweeps**, hundreds of kilobytes to megabytes at a time, walking forward through a file. **Writes are appends**: the crawl adds pages, the indexer adds records, and once a file is written it is hardly ever touched again.',
        'Then the sentence the whole paper turns on, arriving third: **“component failures are the norm rather than the exception.”** Not a caveat — a design input. Across hundreds of commodity machines, a disk fails, memory rots, a switch drops a rack. The file system spends its entire life partly broken, so recovery cannot be an exceptional path taken on a bad day. It has to be the ordinary path, running all the time, boring.',
        'Now hold that beside what a file system was *for* in 2001: a lot of small files, edited in place, on one machine you trusted, behind thirty years of hard-won POSIX semantics. Every assumption is not merely a poor fit. **Each one is inverted.** Which is a strange kind of freedom — if none of the old constraints apply, none of the old answers are automatically right either.',
      ],
      code: {
        file: 'workload.txt',
        lines: [
          { t: 'a few million files, most 100 MB+   # multi-GB is normal' },
          { t: 'reads:   long sequential sweeps' },
          { t: '         some small random reads' },
          { t: 'writes:  large sequential APPENDS', hl: 'good' },
          { t: '         in-place edits: supported, not fast', hl: 'bad' },
          { t: 'once written, files are seldom modified again' },
          { t: '' },
          { t: 'hundreds of cheap machines' },
          { t: 'something is broken right now', hl: 'bad' },
        ],
      },
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'It is 2001. You have racks of ordinary PCs with ordinary disks, a crawl that never stops arriving, and no budget for hardware that would make any of this easy. Nobody has written the paper you are about to re-derive, and the two systems this book covers next — MapReduce and Bigtable — do not exist yet, because they are both waiting on what you decide here.',
        'Three decisions. Take them in order; each one pays for the one before it. Wrong turns cost nothing on this page and cost years in 2001.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**The files:** a few million, most over 100 MB, many multi-GB — hundreds of terabytes in total, and the crawl keeps adding',
              '**The machines:** hundreds of cheap boxes with ordinary disks. Something is failed right now; something else will fail today',
              '**The reads:** long sequential sweeps, because whatever consumes this data eats it whole',
              '**The writes:** almost entirely appends — and **hundreds of processes on different machines appending to the same file at once**',
              '**The budget:** you may not buy your way out. Storage that could hold this costs more than the product it would be serving',
            ],
            questions: [
              {
                q: 'Something has to know which machine holds which piece of which file. Where does that catalogue live?',
                options: [
                  {
                    label: 'On one machine, in memory',
                    verdict: 'move',
                    why: 'The answer nobody expects to be right. **One master** knows every file, every chunk, every replica location — so placement, rebalancing and garbage collection are decisions taken by one mind with the whole picture, and there is no agreement protocol anywhere because there is nobody to agree with. It only survives if you keep it off the data path, which is what Decision 2 is really buying.',
                  },
                  {
                    label: 'Spread it across every machine',
                    verdict: 'dead',
                    why: 'Now creating a file needs several machines to agree, and it is 2001: there is no production consensus service in the building to do it with — Chubby is five years and four chapters away. You would have to solve the hardest problem in this book *before storing a single byte*.',
                  },
                  {
                    label: 'No catalogue — hash the filename to a machine',
                    verdict: 'dead',
                    why: 'Placement becomes a formula, which is elegant until a disk dies: the formula still points at the corpse. Worse, you can no longer *choose* where a copy goes — and choosing is the entire game, because racks lose power together and three copies in one rack is one copy with extra steps.',
                  },
                  {
                    label: 'Every machine keeps a full copy of the catalogue',
                    verdict: 'dead',
                    why: 'Every file creation becomes a broadcast, and then you need everyone to agree on the *order* of the broadcasts — which is the previous option again, with more network traffic and a harder failure mode.',
                  },
                ],
              },
              {
                q: 'That one master holds an entry per piece of every file. How big is a piece?',
                options: [
                  {
                    label: '4 KB, like every other file system',
                    verdict: 'dead',
                    why: 'Do the division: a petabyte in 4 KB blocks is **244 billion entries**. At the paper’s own 64 bytes apiece that is fifteen terabytes of catalogue — for one machine, in 2001. The master’s memory stops being an implementation detail and becomes the cluster’s capacity.',
                  },
                  {
                    label: '64 MB — four orders of magnitude bigger',
                    verdict: 'move',
                    why: 'The same petabyte is now **15 million entries, under a gigabyte of RAM.** And the second prize is bigger than the first: a client asks the master once and can then read 64 MB before it needs to ask again, over one long-lived connection to one chunkserver. The master answers a question per *chunk*, not per read.',
                  },
                  {
                    label: 'One piece per file — keep it simple',
                    verdict: 'dead',
                    why: 'A 2 GB file now lives on one machine, and reading it runs at one machine’s disk. You bought hundreds of boxes precisely so that a sweep could be spread across them; this hands that back.',
                  },
                ],
              },
              {
                q: 'Hundreds of crawlers, on hundreds of machines, all appending to the same file at the same moment. How do you keep them from landing on top of each other?',
                options: [
                  {
                    label: 'A lock — one appender at a time',
                    verdict: 'dead',
                    why: 'Hundreds of parallel producers, queued behind one lock, is a cluster pretending to be a single machine. And the lock holder can die mid-write, so now you need leases, timeouts and failure detection **on the critical path of every append** — a distributed systems problem bolted onto every write in the system.',
                  },
                  {
                    label: 'Each client reads the end of the file and writes there',
                    verdict: 'dead',
                    why: 'Two clients read the same end-of-file, both write at that offset, one record silently disappears. This is exactly the race `O_APPEND` exists to prevent on a single machine — except there is no kernel here that spans three replicas on three machines.',
                  },
                  {
                    label: 'Give each writer its own file and merge later',
                    verdict: 'dead',
                    why: 'The instinct most engineers still reach for, and Decision 2 already priced it: millions of small files is millions of catalogue entries in one machine’s RAM, spent on a rounding error of real bytes. You also cannot read anything until the merge job has run, so the pipeline grows a stage whose only job is undoing this choice.',
                  },
                  {
                    // no markdown here: DesignIt renders option labels raw, so
                    // asterisks would print as asterisks
                    label: 'The client says what to write; the server decides where',
                    verdict: 'move',
                    why: 'This is **record append**, and it is the operation no file system before it had. The client hands over bytes and no offset. One replica — whichever currently holds the lease — picks the position, applies it, and tells the others to apply it at the same place. No lock service, no agreement protocol: the machine that had to touch the bytes anyway is simply *allowed to decide*.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You just re-derived GFS — and §2.5, §2.6 and §3.3 of the paper',
              body: [
                'One master holding all metadata in RAM. Chunks four orders of magnitude larger than a normal block, so that RAM is a gigabyte rather than a warehouse. And an append where **the server picks the offset** — the one genuinely new operation in the paper, and the reason hundreds of writers can share a file with no lock manager in sight.',
                'The thread running through all three is worth naming, because it is what the next four hundred pages of this book argue with: **GFS never asks anyone to agree. It appoints.** The master decides where chunks live and nobody votes. The lease holder decides the order of appends and nobody votes. There is no consensus protocol anywhere inside it — only appointments, and a way to notice when an appointee stops answering. That is enormously cheaper to build. *Act III is about everything it cannot buy.*',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'One append, end to end',
      accent: 'denim',
      rung: 'Rung 3 · The reveal',
      span: 2,
      body: [
        'Here is the machine as shipped — your three decisions plus the parts you did not have to invent: how the bytes reach three machines without the client sending them three times, and what happens when one replica does not cooperate.',
        '**Watch step six.** It is where the design stops flattering itself and tells you what it is actually selling. And as the whole thing plays, count what crosses the master: two small messages, at the very start, and nothing after.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={gfsAppendTrace} />
        </div>
      ),
    },
    {
      n: 'Step 04',
      title: 'Sixty-four megabytes is not a tuning knob',
      rung: 'Rung 4 · The number underneath',
      body: [
        'It reads like a performance setting and it is really the load-bearing wall. The paper states the exchange rate directly: **“The master maintains less than 64 bytes of metadata for each 64 MB chunk.”** Everything else follows from that ratio.',
        'Metadata in RAM is what lets the master do its real job. Re-balancing, garbage collection, noticing that a chunk is down to two copies — all of these are **sweeps over an in-memory structure**, periodic and cheap. Push the catalogue onto disk and each of those becomes a distributed algorithm with a paper of its own. The chunk size is what keeps them chores.',
        'The bill arrives as **hot spots**, and the paper pays it in public. A small file is one chunk, so it lives on exactly three machines — and when GFS was first used by a batch-queue system, an executable stored as a single-chunk file was launched on hundreds of machines at once and those three chunkservers were flattened. The fix was more replicas for that one file and staggered start times: an operational answer to a structural problem, which is the honest kind of answer and worth noticing as a pattern.',
      ],
      diagram: <ChunkBudgetDiagram />,
      think: {
        q: 'The master keeps every chunk’s *location* in memory — but never writes those locations to disk. Everything else about a file it persists. Why is location different?',
        a: 'Because a chunkserver is the authority on what a chunkserver has: it is holding the disk. If the master persisted locations, its record and the truth could disagree after any crash — and the truth would win anyway, so the record was never worth having. Instead the master asks at startup and keeps asking: every chunkserver reports what it holds in its heartbeat. **The general rule: do not persist a fact another machine owns.** Store that and you have not made a record, you have made a cache that thinks it is a record — and it will be wrong exactly when you need it.',
      },
    },
    {
      n: 'Step 05',
      title: 'Two operations added, thirty years of semantics dropped',
      rung: 'Rung 5 · The interface is the design',
      body: [
        'GFS is not something you mount. There is no kernel driver, no POSIX layer — it is a **library you link into your program**, with a small deliberate API. Create, delete, open, close, read, write, and then the two additions that carry the workload: **record append**, and **snapshot**, which copies a file or a whole directory tree almost instantly by copy-on-write on the chunks, so a job can branch a dataset and go wreck it safely.',
        'What was left out matters as much. No hard links. No Unix permission model. No directory tree in any real sense: the namespace is **a flat lookup table from full pathname to metadata**, with prefix locks standing in for per-directory inodes. Directories that only look like directories, held as strings.',
        'And that is the lesson to carry out of this chapter, though it needs saying honestly: **the interface was designed for the applications, not for compatibility.** Every file system before it aimed at POSIX so that programs nobody controlled would keep working. GFS had one customer — Google’s own code — and could ask that customer to change. *That is a luxury, not a technique.* When you cannot ask your callers to change, most of this chapter is unavailable to you, and pretending otherwise is how a beautiful design becomes a migration that never finishes.',
      ],
      deeper: {
        summary: 'Why not just run a lock service, like a sensible person?',
        body: [
          'The obvious alternative to record append is a lock manager handing out the right to write at the end of a file. And this is not a story about that being impossible — Google went on to build exactly that service, and it is Chapter 4.',
          'It is a story about the bill. A lock per append puts a round trip to a **third** system on the critical path of every write, makes that system’s availability the file system’s availability, and funnels hundreds of concurrent appenders into a queue. Record append gets the same serialisation for nothing, because the machine that was going to write the bytes anyway — the lease-holding primary — is simply permitted to choose.',
          'What you give up is that the decision is only as good as the appointment. If two replicas both believe they hold the lease, both pick offsets. GFS stops that from mattering with a **chunk version number**: a replica that missed mutations has an old version, and the master treats it as garbage rather than as a peer. Version numbers doing the work consensus would otherwise do is a pattern worth learning to recognise — every leader-based system later in this book has one, under some other name.',
        ],
      },
    },
    {
      n: 'Step 06',
      title: 'The bill, in writing',
      accent: 'terra',
      rung: 'Rung 6 · What it gave up',
      body: [
        'Every design in this book pays for what it gets, and GFS pays in the one place engineers are least prepared to absorb it: **what the file contains afterwards.**',
        'A record append that returns success means your record is in every replica, at least once, at an offset GFS chose. **Not exactly once.** When an append fails on one replica the client retries, and the replicas that succeeded the first time now hold the record twice. The paper is unflinching: *“GFS may insert padding or record duplicates in between.”* Regions around your record may hold junk, and replicas of the same chunk are not required to match byte for byte.',
        'So the applications carry it, and Google’s applications were built to. Every record gets a checksum, so garbage is detectable, and a unique id, so duplicates can be dropped on the way in. That was cheap **for Google**, whose readers already checkpointed and validated. It is not cheap for code written on the assumption that a file system behaves like a file system — and that assumption is the default everywhere else.',
        '**The master’s real limit is not the one everybody names.** Availability was handled: mutations go to a replicated operation log, shadow masters serve read-only access while it is down, a fresh master replays the log and asks the chunkservers what they hold. What could not be engineered around is arithmetic — one entry per file and one per chunk, in one machine’s memory. The ceiling is **file count**, not bytes, and file count is what Google’s workload eventually blew through.',
        'And small files were second-class **by writing**: *“Small files must be supported, but we need not optimize for them.”* Everyone who later ran HDFS discovered what that sentence costs when a data lake fills up with 40 KB Parquet files.',
      ],
      diagram: <AppendRegionsDiagram />,
      callout: {
        kind: 'bad',
        big: 'AT LEAST ONCE',
        text: 'A successful append means the bytes are in every replica, somewhere, at least one time. Skipping the garbage and dropping the duplicates is the application’s job — GFS moved that problem up a layer rather than solving it.',
      },
    },
    {
      n: 'Step 07',
      title: 'What it begat — and where it stands in 2026',
      rung: 'Rung 7 · Descendants',
      body: [
        'Inside Google, the direct heir is two chapters away. **Bigtable’s commit log is a GFS file; its SSTables are GFS files** — and the reason Bigtable’s storage engine looks the way it does is that the floor underneath it would not let anything be edited. The refusal propagated up a layer and came out the other side as a database design.',
        'Outside, **HDFS** is close to a transcription: NameNode for master, DataNode for chunkserver, three replicas, the block size raised to 128 MB. It carried the entire Hadoop era. The one thing it never really carried across was record append — HDFS can append, but not the many-writers, server-picks-the-offset kind. *That turned out to be the least portable idea in the paper.*',
        'Google replaced GFS itself around 2010 with **Colossus**, and the fix for the master closes a satisfying loop: metadata moved out of one machine and into a distributed store, and that store is **Bigtable** — which was built on GFS. The child holds up the parent. Google reports the change let Colossus scale over **100× past the largest GFS clusters**; erasure coding also displaced three-way replication for colder data, roughly 1.5× the bytes instead of 3×.',
        '**2026 status: the paper is retired and the bargain is everywhere.** S3 and GCS sell the GFS deal by the gigabyte — objects you replace but never edit, no POSIX, no real directory tree (a “folder” in S3 is a key prefix, exactly as GFS’s namespace was a flat map of strings), durability from replication you never see or manage. Every LSM engine, every data lake, every table format that commits by writing a new file and swapping a pointer (Iceberg, Delta) is downstream of one 2003 decision to stop pretending that files can be edited.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Chunk.',
      body: '64 MB of a file, stored as a plain Linux file on three chunkservers. The unit of placement, replication and repair — and the unit the master keeps an entry for.',
    },
    {
      term: 'Master.',
      body: 'The one machine holding the namespace and the chunk map, in RAM. It answers where; it never carries data.',
    },
    {
      term: 'Lease.',
      body: 'A time-limited appointment. For the next sixty seconds this replica is primary for this chunk and decides the order of mutations. Expiry is how GFS survives an appointee dying.',
    },
    {
      term: 'Record append.',
      body: '“Append these bytes somewhere in this file and tell me where.” The offset is the server’s choice — which is exactly what makes it safe for many writers at once.',
    },
    {
      term: 'Consistent vs defined.',
      body: 'Consistent = every replica shows the same bytes. Defined = consistent *and* the region shows one write whole, not a splice of several. After a record append you get defined for the record itself, and no promise at all about what sits beside it.',
    },
  ],
  inTheWild: {
    note: '5 ways this design bites in production',
    points: [
      'A 40 KB file costs a catalogue entry and three replicas, the same as a 64 MB one. Every HDFS operator eventually meets the **small files problem** — the NameNode heap, not the disks, is the cluster’s real capacity, sized by rule of thumb at roughly a gigabyte per million blocks — and the fix is always the same shape: pack the little files into big ones and pay for a compaction job forever.',
      'Duplicates are not a thought experiment. Anything reading an append log this way must be **idempotent or it double-counts**, and the standard remedy — a unique id per record, deduplicated on read — is the ancestor of every “at-least-once delivery, so make your consumer idempotent” note in every queue’s documentation since.',
      'Storage capacity looks like disks and is actually **RAM in one box**: total bytes ÷ chunk size × 64 B. That makes chunk size a planning decision, not a performance one, and doubling it to buy headroom buys hot spots at the same time.',
      'Three replicas is a **placement** decision before it is a count. GFS deliberately puts a copy on another rack, because racks lose their switch and their power together. Three copies in one failure domain is one copy that cost you three disks.',
      'When a machine dies, every chunk it held is suddenly under-replicated and the cluster wants to fix all of them **at once** — a repair stampede that can saturate the network and take out neighbours. The paper prioritises: chunks furthest below their replication target, and chunks blocking live client work, go first. Any system that repairs at full speed on failure has a second outage built into its first one.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Take the GFS bargain',
        when: 'the data arrives as an unstoppable stream of appends and leaves in long sweeps — logs, events, telemetry, crawls, anything you will later regret having edited. Immutability is what makes replication and repair boring, and boring is the product.',
      },
      {
        choose: 'Keep a real file system',
        when: 'anything in the stack expects POSIX: in-place updates, rename-as-commit, `mmap`, small files, or tools written by people you cannot phone. Fighting that costs a year, and the year is not refundable.',
      },
      {
        choose: 'Let the server pick the position',
        when: 'many writers share one destination and throughput matters more than knowing where a record landed. The price is due on the read side — design records that can be recognised and deduplicated, before you write the first one.',
      },
      {
        choose: 'Pay for a coordinator instead',
        when: 'you need exactly-once, or an order the client can predict and reason about. GFS is cheap precisely because there is no consensus inside it; **buying that back is Acts III and IV of this book, and it takes four papers.**',
      },
    ],
  },
  misconception: {
    think: '“A single master is an obvious single point of failure — a rookie mistake they got away with because it was 2003.”',
    actually:
      'Availability was the easy part and they solved it: master mutations go to a replicated operation log, shadow masters serve read-only access while it is down, and a fresh master rebuilds by replaying the log and asking the chunkservers what they are holding. The limit that actually killed it is far less obvious — **one machine’s RAM must hold one entry per file and one per chunk**, so the ceiling is *file count*, not bytes, and no amount of failover moves it. The reflex objection was aimed at the wrong wall; Colossus was built to knock down the real one.',
  },
  sources: [
    {
      year: '2003',
      title: 'The Google File System — Ghemawat, Gobioff & Leung (SOSP)',
      url: 'https://static.googleusercontent.com/media/research.google.com/en//archive/gfs-sosp2003.pdf',
      note: 'Read §2.1 first and slowly — the assumptions are the whole design, stated before any mechanism, and almost nobody reads them. Then §2.5–2.6 (chunk size, the master’s memory) and §3.1–3.3 (the write path and record append). §5 on fault tolerance is short and good. Skip §6’s throughput numbers unless you enjoy 2003 hardware; they were measured over 100 Mbps links.',
    },
    {
      year: '2009',
      title: 'GFS: Evolution on Fast-forward — McKusick & Quinlan (ACM Queue)',
      url: 'https://queue.acm.org/detail.cfm?id=1594206',
      note: 'The postmortem, six years on: Quinlan led GFS after the paper, and McKusick — of BSD’s Fast File System — asks the questions a file-system person would. Much of it is what the single master really cost as file counts grew, and what happened when latency-sensitive products got built on a system designed for batch throughput. Read it straight after the paper; it is the honest half.',
    },
    {
      year: '2021',
      title: 'A peek behind Colossus, Google’s file system (Google Cloud blog)',
      url: 'https://cloud.google.com/blog/products/storage-data-transfer/a-peek-behind-colossus-googles-file-system',
      note: 'GFS’s replacement, described by the people who run it. The part worth your time is the metadata service: the single master became many curators storing file metadata in Bigtable — the system Chapter 3 builds *on top of* GFS.',
    },
  ],
  seenIn: [
    { label: 'The Database GFS Deserved — Ch 3', to: '/papers/bigtable', live: true },
    { label: 'B-trees vs LSM-trees — the comic', to: '/ddia/read/storage', live: true },
    { label: 'S3 / object storage — the deep-dive', to: '/ddia/components/s3', live: true },
    { label: 'Kafka — the log with a front door', to: '/ddia/components/kafka', live: true },
  ],
  finale: {
    title: 'The refusal that propagated',
    body: 'GFS did not set out to change how databases are built. It set out to keep the crawl on machines that keep dying, and the shortest path there was to stop pretending a file can be edited. Everything stacked on top then had to live inside that refusal — which is where immutable files, background merges and repair-as-a-chore come from, and why they are still in your storage engine tonight. Next: the same machines that hold the chunks are asked to *compute* something, and the answer is a pattern so plain that a decade of people mistake it for a product.',
  },
  next: { title: 'MapReduce — the Pattern, Not the Product', unwritten: true },
}
