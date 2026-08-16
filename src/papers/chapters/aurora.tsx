import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { WriteAmplificationDiagram, AzQuorumDiagram } from '../diagrams'
import { auroraTrace } from './aurora-trace'

/* Closes Act V, and it is the only chapter in the book whose thesis is
   literally a section heading in its own paper — §3 of the Aurora paper is
   called "The Log Is the Database".

   The risk with this chapter is that it reads as an AWS product tour. The
   defence is to keep it on the two ideas that generalise: (1) when storage
   moves across a network, the question stops being "how fast is the disk" and
   becomes "what am I sending", and (2) monotonic numbers plus one writer can
   replace a consensus round, which is a trade with a name and a cost rather
   than a trick. */

export const aurora: Chapter = {
  slug: 'aurora',
  act: 'Act V · The Log Is the Database',
  paperNo: 'Paper 14',
  title: 'The Log Made Literal',
  dek: 'Two chapters argued the log is the real record. This one takes it at face value inside a relational database: stop writing pages entirely, ship only the redo log, and let the storage tier work out what the pages should say.',
  minutes: 17,
  paper: {
    title: 'Amazon Aurora: Design Considerations for High Throughput Cloud-Native Relational Databases',
    authors: 'Alexandre Verbitski, Anurag Gupta, Debanjan Saha, Murali Brahmadesam, Kamal Gupta, Raman Mittal, Sailesh Krishnamurthy et al.',
    venue: 'ACM SIGMOD',
    year: '2017',
    url: 'https://pages.cs.wisc.edu/~yxy/cs764-f20/papers/aurora-sigmod-17.pdf',
  },
  caption:
    'Chapter 12 made a cache honest by feeding it from a commit log. Chapter 13 made the log a service and argued that tables are views of it. This chapter is what happens when somebody applies that idea **inside** a relational database, in the least forgiving place available: a MySQL that customers expect to behave exactly like MySQL, running on a cloud where the storage is at the other end of a network. The paper does not hedge about it either. **Section 3 is titled “The Log Is the Database.”**',
  steps: [
    {
      n: 'Step 01',
      title: 'The bottleneck moved and nobody told the database',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'Databases were designed around a fact that stopped being true. **The disk was the bottleneck**, so forty years of engineering went into touching it as little as possible — buffer pools, checkpoints, group commit, careful page layouts. Move storage onto a fleet of machines at the other end of a network and spread the I/O across hundreds of disks, and no individual disk is hot any more. **The bottleneck is now the network**, and specifically the packets per second and the bandwidth between the database tier and the storage tier.',
        'Which makes write amplification the thing that matters, and a conventional database is spectacular at it. Look at what a synchronously mirrored MySQL puts on the wire for one logical write: **the redo log, the binary log archived to S3, the modified data pages, a second copy of every page** to survive a torn write, and metadata files. That is five kinds of data, and the writes go to an EBS volume, then its local mirror, then across to a standby instance, then its volume, then *its* mirror.',
        '**Three of those steps are sequential**, so latency adds rather than overlaps. And from a distributed-systems angle the arrangement is worse than it looks: it is effectively a **4-of-4 write quorum**, so every participant can hold everything up and the slowest one always does. *Jitter is not averaged out here; it is accumulated.*',
        'Meanwhile the cloud has a property that on-premise hardware does not, and it changes what durability means. At fleet scale there is a **continuous background noise** of failing disks, rebooting nodes and flapping network paths — not as incidents, as weather. On top of that, an availability zone can go away entirely, and when it does it takes every copy inside it at once. **That failure is correlated, and it lands on top of the background noise rather than instead of it**, which is the fact that breaks the quorum everyone reaches for first.',
      ],
      code: {
        file: 'one_write_the_old_way.txt',
        lines: [
          { t: 'redo log             → volume + mirror' },
          { t: 'binlog               → volume + mirror → S3' },
          { t: 'data pages           → volume + mirror' },
          { t: 'double-write buffer  → volume + mirror' },
          { t: 'FRM metadata         → volume + mirror' },
          { t: '' },
          { t: '  … then all of it again on the standby' },
          { t: '' },
          { t: 'steps 1, 3 and 5 are sequential', hl: 'bad' },
          { t: 'effective quorum: 4 of 4', hl: 'bad' },
          { t: '' },
          { t: 'measured: 7.4 I/Os per transaction' },
        ],
      },
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'Three questions. The first is the one this act has been building toward for two chapters, and the third is a genuine surprise after Act III — you are about to be talked out of consensus by people who clearly understand it.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**The engine:** a fork of MySQL/InnoDB. It must stay MySQL — same SQL, same isolation levels, same behaviour — because customers are migrating existing applications onto it.',
              '**The bottleneck:** the network between the database and its storage. Not the disk, and not the CPU.',
              '**The environment:** a continuous background rate of node, disk and network failures, plus the occasional loss of an entire availability zone, which takes everything inside it at once.',
              '**The workload:** OLTP. Latency matters, the tail matters more, and a stall in one transaction must not hold up others.',
              '**The obligation:** durability is the contract. Data once written must be readable, through any of the above.',
            ],
            questions: [
              {
                q: 'Storage is now across a network. What do you actually send on a write?',
                options: [
                  {
                    label: 'What MySQL already sends — pages, logs, the lot',
                    verdict: 'dead',
                    why: 'Five kinds of data, several of them representing the same change twice, amplified again by replication. And the double-write buffer is the sharpest example of a legacy assumption: it exists so that a torn page write cannot corrupt anything — a problem you no longer have, being paid for in the resource that is now scarce. *You are shipping the cure for a disease the new environment does not carry.*',
                  },
                  {
                    label: 'Only the redo log records — and push the log applicator into storage',
                    verdict: 'move',
                    why: 'A redo record is the difference between a page before and after. If the storage tier can apply redo, it can produce any page on demand, so **the database never needs to write a page at all** — not on eviction, not on checkpoint, not ever. Storage materialises pages in the background as a cache of applied log records. Measured: **7.4 I/Os per transaction becomes 0.95**, and 35× the transactions in the same window. *This is Chapter 13’s duality moved inside a single database: the log is the record, the pages are a view.*',
                  },
                  {
                    label: 'Send the pages, but compress them',
                    verdict: 'dead',
                    why: 'A constant factor against a structural problem, and it leaves every other cost in place: the writes are still sequential, the quorum is still effectively everybody, checkpointing still competes with foreground work, and crash recovery still means replaying from the last checkpoint. **The redo record was always smaller than the page it describes** — the design question is whether you can avoid sending the page at all.',
                  },
                  {
                    label: 'Use chain replication so each node forwards to the next',
                    verdict: 'dead',
                    why: 'It genuinely reduces network cost, and the paper considers it. But a chain makes latency additive by construction — each hop waits for the previous one — which is the exact property being escaped. In an environment where the slowest node dominates response time, you want to write to everyone in parallel and be able to ignore the stragglers.',
                  },
                ],
              },
              {
                q: 'How many copies, where, and what quorum?',
                options: [
                  {
                    label: 'Three copies, one per zone, write 2 and read 2',
                    verdict: 'dead',
                    why: 'The standard answer, and it is not enough here — for a reason worth internalising. At fleet scale, **some node somewhere is always down**. So the event you must survive is not “a zone fails” but “a zone fails *while* a background failure is in progress elsewhere”. That is two copies gone, leaving one, and **with one copy you cannot tell whether it is current.** The individual failures are independent; the zone failure is correlated with everything inside it.',
                  },
                  {
                    label: 'Six copies, two per zone, write 4 and read 3',
                    verdict: 'move',
                    why: 'Now the arithmetic works. Lose a whole zone and one extra node — three copies gone — and a read quorum of 3 still holds, so **nothing is lost and the missing copies can be rebuilt**. Lose a whole zone and the write quorum of 4 still holds, so **writes never stop**. The cost is honest: six copies of everything, and a write that must reach four machines. The benefit beyond durability is that you are always ignoring your two slowest nodes.',
                  },
                  {
                    label: 'More copies still — nine or twelve',
                    verdict: 'dead',
                    why: 'Durability is not the binding constraint past a point, and each extra copy costs storage and network on every write forever. The better lever is elsewhere: **shrink the repair time rather than adding replicas.** The window of vulnerability is how long you sit with a missing copy, so cutting that window has the same effect as adding redundancy and costs far less.',
                  },
                  {
                    label: 'Erasure coding, for the same durability at less storage',
                    verdict: 'dead',
                    why: 'Excellent for cold, large, rarely-read data, and wrong on a write path measured in microseconds. Reconstructing from fragments turns a degraded read into a computation across several nodes, which is precisely the tail-latency behaviour this design is built to avoid — and this data is not cold, it is the hot end of a live redo stream.',
                  },
                ],
              },
              {
                q: 'Six storage nodes each hold a partial view of the log. How do they agree on what is durable?',
                options: [
                  {
                    label: 'Run Paxos over the storage nodes',
                    verdict: 'dead',
                    why: 'Correct, well understood, and the wrong tool for this shape. A round of agreement per write is exactly the latency the design is trying to remove, and it would put a leader election on the path of a storage tier that is meant to be dumb and parallel. **You only need consensus when independent proposers can disagree** — and here there is one writer, so nobody is proposing anything competing.',
                  },
                  {
                    label: 'Two-phase commit across the six copies',
                    verdict: 'dead',
                    why: 'The paper’s own words: 2PC is chatty and intolerant of failure, and a high-scale system has a continual background noise of failures for it to be intolerant of. Chapter 11 fixed the availability half of that objection by running 2PC over Paxos groups — but that trade buys resilience with latency, and this design is spending its entire budget in the other direction.',
                  },
                  {
                    label: 'Nothing — monotonic sequence numbers, gossip, and a point that advances',
                    verdict: 'move',
                    why: 'The database allocates every log record’s sequence number, so **the ordering is already decided before anything is sent** and there is nothing to agree about — only gaps to fill. Each record carries a backlink to the previous one for its group, so a node can see exactly where its sequence breaks; peers **gossip** to exchange what they are missing; and a durability point advances asynchronously as acknowledgements arrive. No round trip, no leader, no protocol on the write path. *This works because there is exactly one writer — state that assumption out loud, because it is the whole permission slip.*',
                  },
                  {
                    label: 'Elect a leader per segment and replicate through it',
                    verdict: 'dead',
                    why: 'You have re-created the thing being avoided, one level down, and multiplied it by the number of segments — thousands of tiny Paxos groups, each with an election to run and leases to renew. It also reintroduces a serialisation point per segment, when the appeal of the storage tier is that it is embarrassingly parallel and has no opinions.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived Aurora — and the biggest wins are things that stopped happening',
              body: [
                '**Crash recovery disappeared as an event.** In a traditional database, recovery means replaying redo from the last checkpoint, which is why the checkpoint interval is a knob that trades foreground performance against how long you are down. Here redo application is happening continuously on the storage fleet anyway, and it did not notice the database die. The instance restarts, asks each group what is durable, truncates above it, and is open — **generally under 10 seconds**, even after crashing at over 100,000 writes a second.',
                '**Backup stopped being an operation.** Storage nodes stage log and pages to S3 as background work, so the backup is continuous and never competes with foreground traffic. So is garbage collection, page materialisation and bit-rot scrubbing. *Background work in a traditional database is positively correlated with load — checkpointing gets urgent exactly when you are busy. Here it is negatively correlated, because the storage tier does housekeeping when the foreground is quiet.*',
                '**And the repair window is the real durability lever.** The volume is cut into **10 GB segments**, and a segment can be rebuilt in about **10 seconds** on a 10 Gbps link. To lose data you would need two independent failures inside the same ten-second window *plus* a zone failure elsewhere. Segmenting also makes operations cheap: a hot node is fixed by marking one segment bad and letting the quorum heal it somewhere colder, and the whole fleet can be patched one zone at a time.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'A write with no pages and a commit with no protocol',
      accent: 'denim',
      rung: 'Rung 3 · The reveal',
      span: 2,
      body: [
        'Two absences to watch for. **No data page ever crosses the network** — only redo records go right, and only pages come back. And **nothing in this trace is a round of agreement**: four acknowledgements advance a number, gossip repairs the holes, and a thread wakes up whoever that number just passed.',
        'Step 7 is the one that reframes the rest. Crash recovery is fast not because it was optimised but because it was already happening.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={auroraTrace} />
        </div>
      ),
      think: {
        q: 'Chapter 8 spent a whole chapter arguing you need consensus to agree on a sequence of values. Six storage nodes are agreeing on a sequence of log records with no consensus at all. Which chapter is wrong?',
        a: 'Neither, and the difference between them is the most portable idea in this chapter. **Consensus is for when independent proposers can disagree about what comes next.** Raft elects a leader precisely so that there is one proposer, and then most of the protocol is about surviving the moment when leadership changes and two machines might both believe they hold it. Aurora starts with something Raft has to work for: **exactly one writer, which allocates every sequence number itself.** So the order is decided before anything is sent, and no storage node ever has an opinion about what position a record occupies — it either has that record or it has a gap. Filling a gap is a data-transfer problem, not an agreement problem, and gossip is enough. The cost of the shortcut is written into the design: a single writer, so writes do not scale horizontally, and the recovery path has to reconstruct by quorum what the writer used to know in memory. **The general rule worth taking away: before reaching for consensus, ask whether you have more than one proposer.** If you do not — one leader, one allocator, one client library — a monotonic counter and a repair mechanism will often do the job, and Chapter 10 quietly made the same bet with its timestamp oracle.',
      },
    },
    {
      n: 'Step 04',
      title: 'What it bought, measured',
      rung: 'Rung 4 · The measurement',
      body: [
        '**The headline is write amplification, and it is the number that explains all the others.** Thirty minutes of the same write-only benchmark: mirrored MySQL managed 780,000 transactions at **7.4 I/Os each**; Aurora managed 27.4 million at **0.95** — and that is *despite* writing six copies, because each storage node sees only its own unamplified share. Fewer bytes on the network is what pays for the replication.',
        '**Throughput scales with the instance and keeps going where MySQL stops.** On the largest instance tested: **121,000 writes and 600,000 reads a second**, about five times MySQL 5.7. With a 100 GB dataset the write-only gap is **67×**; even at 1 TB with a working set that does not fit in cache it is **34×**. And under connection pressure the shapes differ in kind rather than degree — Aurora goes from 40,000 writes/sec at 50 connections to **110,000 at 5,000**, while MySQL peaks around 500 connections and then *falls* as concurrency rises.',
        '**Replica lag is where the architecture shows most plainly.** Replicas read the same log stream and share the same storage volume, so they cost nothing extra in storage or write I/O. At 10,000 writes a second, Aurora’s replica lag is **5.4 milliseconds**; MySQL’s, at the same rate, is **300 seconds**. That is not a tuning difference — MySQL is shipping and re-applying a stream of statements while Aurora’s replicas are updating cached pages from a log the storage already has.',
        '**And the customer numbers are the ones that would show up in your monitoring.** An internet gaming company’s average web transaction went from **15 ms to 5.5 ms**. An education company saw p95 latencies drop from **40–80 ms down to near their 1 ms p50** — which is the jitter story rather than the throughput story, and jitter was the thing the sequential, 4-of-4, checkpoint-driven arrangement was manufacturing. Their replica lag went from spikes of **12 minutes to under 20 ms**, which turned a standby they could not read into capacity they could use.',
      ],
      diagram: <WriteAmplificationDiagram />,
    },
    {
      n: 'Step 05',
      title: 'Why six copies and not three',
      rung: 'Rung 5 · The durability argument',
      body: [
        'This section is the most reusable thinking in the paper and it is not about databases at all. **Start from the observation that failures at fleet scale are not events, they are a rate.** At any moment some disks are dead and being replaced. So the question is never “can I survive a zone failure”, it is “can I survive a zone failure *given that something else is already broken*”.',
        'That reframing kills 2-of-3 immediately. Three copies in three zones survives any one failure. But a zone loss plus one background failure elsewhere leaves **one copy**, and one copy is not enough — not because the data is gone, but because **you cannot tell whether it is current.** Durability failed for an epistemological reason rather than a physical one.',
        'Six copies across three zones with a write quorum of 4 and a read quorum of 3 survives that case with a copy to spare. But the more interesting move is the second one: **reduce the repair time instead of adding redundancy.** You cannot easily make failures rarer, so shrink the window in which a second failure is fatal. Cut the volume into **10 GB segments** and a lost one is rebuilt in **about 10 seconds**; to lose data you now need two independent failures inside that same ten seconds *plus* a correlated zone loss elsewhere.',
        'And then the operational dividend, which is the part the paper is quietly proudest of. **A system that tolerates long failures tolerates short ones for free.** A hot disk is fixed by marking a segment bad and letting the quorum heal it onto a colder node. Patching is a brief unavailability of one node, done one zone at a time. Rolling out new storage software is the same event as a node being slow. *Designing for the disaster is what made routine maintenance boring.*',
      ],
      diagram: <AzQuorumDiagram />,
    },
    {
      n: 'Step 06',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 6 · What the split costs',
      body: [
        '**One writer. That is the assumption everything rests on**, and it is the ceiling. A cluster is a single writer plus up to fifteen read replicas, so read capacity scales and write capacity is whatever one instance can do. The whole no-consensus argument is licensed by there being exactly one allocator of sequence numbers — take that away and the gossip-and-advance scheme stops working. *A design that avoids consensus by having one proposer has bought its speed with a scaling limit.*',
        '**The storage tier is bespoke, and that is not a small asterisk.** This is not MySQL on better disks; it is a fork of InnoDB talking a private protocol to a purpose-built multi-tenant service, with its control plane on DynamoDB and its workflows on SWF. You cannot run it on your own hardware, and the parts of the paper you can apply elsewhere are the *ideas* — ship the log not the pages, size the quorum for correlated failure, shrink repair time — not the system.',
        '**Six copies of everything is six copies of everything.** The design trades storage and write fan-out for durability and tail latency, and that is the right trade at this scale, but it is a real cost that a single-node database does not pay. Every log record goes to six machines and four must answer before anything is durable.',
        '**And the workloads that arrive are stranger than the benchmarks.** The paper is candid about it: SaaS customers consolidate tenants into schemas until a single instance holds **over 150,000 tables**, which puts pressure on dictionary caches nobody sized for that. Rails-style frameworks generate *dozens of schema migrations a week*, so an efficient online DDL had to be built — per-page schema versions, upgraded lazily on write. And customers turned out to have almost no tolerance for **a planned 30-second patch every six weeks**, which is how zero-downtime patching became a feature rather than an optimisation.',
      ],
      callout: {
        kind: 'bad',
        big: 'ONE WRITER IS THE PERMISSION SLIP',
        text: 'No consensus on the write path, no read quorum in normal operation, no coordination between storage nodes — all of it licensed by there being exactly one process allocating sequence numbers. It is also the reason write throughput has a ceiling.',
      },
    },
    {
      n: 'Step 07',
      title: 'What it begat — and where it stands in 2026',
      rung: 'Rung 7 · Descendants',
      body: [
        '**Log-is-the-database became the default shape for cloud databases.** Every major provider now ships a version: a stateless-ish compute tier speaking a redo or WAL protocol to a shared, replicated, self-healing storage service. Neon does it for Postgres with a pageserver and a safekeeper quorum; AlloyDB and Azure’s Hyperscale tier do their own variants; and each of them reruns this paper’s arithmetic about what crosses the network.',
        '**Separating compute from storage turned into the product feature, not the implementation detail.** Once storage is a service you can scale and pay for on its own, you get instant clones that share the same underlying volume, branch-a-database-for-a-pull-request, point-in-time restore that is just a timestamp, and scale-to-zero compute. **None of those are database features; they are consequences of the log being somewhere else.**',
        '**Aurora itself kept going in the direction Act IV pointed.** A second paper in 2018 went further into avoiding distributed consensus for I/O, commits and membership changes; Aurora Serverless made the compute tier elastic; and Aurora DSQL, announced in 2024, adds a distributed transaction layer with multiple writers — using, as it happens, **a bounded-uncertainty time service**, which is Chapter 11 arriving in the same product a decade later.',
        '**2026 status: the architecture is settled and the argument moved to the tier below.** Nobody building a cloud database now starts by asking whether storage should be local. The live questions are the ones this design opened: how much of the engine belongs in the storage tier, whether the single writer can be relaxed without paying for consensus, and how far the same trick goes when the storage service is object storage with hundred-millisecond latencies rather than SSDs on the same network.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Redo log record.',
      body: 'The difference between a page before and after a change. Applied to the old page, it produces the new one — which is why shipping it is enough.',
    },
    {
      term: 'Protection group.',
      body: 'Six 10 GB segments holding one range of the volume, two in each of three zones. The unit of replication and of repair.',
    },
    {
      term: 'LSN.',
      body: 'A log sequence number, allocated by the database, monotonically increasing. Because one process hands them out, the order is settled before anything is sent.',
    },
    {
      term: 'VDL.',
      body: 'The volume durable point — the highest sequence number the whole volume is known to hold. A commit completes when this passes the transaction’s number.',
    },
    {
      term: 'Gossip.',
      body: 'Storage nodes comparing notes to find and fill gaps in their own log. What replaces a consensus round when nobody disagrees about order.',
    },
    {
      term: 'Segment.',
      body: 'A 10 GB piece of the volume, rebuildable in about 10 seconds. Repair time, not replica count, is the lever that makes the durability arithmetic work.',
    },
  ],
  inTheWild: {
    note: '5 ways this bites in production',
    points: [
      '**The write ceiling arrives without warning.** Read capacity scales by adding replicas, so teams grow comfortably until the workload turns write-heavy and discovers there is exactly one writer. The remedy is sharding at the application level, which is the work the architecture was supposed to have made unnecessary.',
      '**Replica lag is small enough to be trusted, and it is still not zero.** At twenty milliseconds people stop thinking about it and start reading their own writes from a replica. It works almost always, which is the worst frequency for a bug — the failure is rare, user-visible, and impossible to reproduce on a quiet system.',
      '**Storage grows and does not shrink the way people expect.** Volume space is allocated as it is used, and reclaiming it after a large delete is not the immediate refund the billing page implies. Capacity planning against a self-growing volume needs someone actually watching it.',
      '**A long-running transaction still holds locks.** Nothing here changed concurrency control — that stayed in the engine, deliberately. Hot rows, lock waits and long transactions behave exactly as they did in MySQL, and the improved I/O path can make it *easier* to generate contention because the writes go through faster.',
      '**Failover is fast, and connections still break.** The storage survives the compute dying, which is the whole point, but applications still see dropped connections and in-flight transactions rolled back. Teams that skip connection-level retry logic discover that a ten-second recovery is only ten seconds for the database.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Ship the change, not the result',
        when: 'the expensive resource is between you and your storage. A redo record is smaller than the page it describes, and if the far end can apply it, you never have to send the page at all. **This is the log-table duality with a network bill attached.**',
      },
      {
        choose: 'Size the quorum for correlated failure',
        when: 'your replicas share anything — a zone, a rack, a power supply, a deploy. The failure that matters is the correlated one landing on top of the background failures already in progress, and a quorum sized for independent failures will not survive it.',
      },
      {
        choose: 'Shrink repair time before adding replicas',
        when: 'durability is not where you want it. You cannot easily make failures rarer, but you can make the vulnerable window shorter — and small segments that rebuild in seconds do more for the arithmetic than another full copy, at a fraction of the cost.',
      },
      {
        choose: 'Skip consensus when there is one proposer',
        when: 'a single process allocates the ordering — one leader, one writer, one sequencer. Then agreement is already settled and what remains is gap-filling, which gossip handles. **Say the assumption out loud**, because the day a second writer appears, the shortcut becomes a correctness bug.',
      },
    ],
  },
  misconception: {
    think: '“Aurora is MySQL with faster storage.”',
    actually:
      'The storage is not faster — it is **further away**, across a network, on ordinary SSDs, replicated six times. Everything gained comes from changing what is sent to it. A conventional MySQL puts five kinds of data on the wire for one write: redo, binlog, data pages, a second copy of every page to survive a torn write, and metadata. Aurora sends **redo log records and nothing else**, and pushes the log applicator into the storage tier so that pages can be generated there on demand. Pages then become what Chapter 13 said tables were — **a materialised view of the log, and optional as far as correctness is concerned.** Once you believe that, three things stop being problems rather than getting faster. Checkpointing has nothing to do, because there are no dirty pages to flush. Crash recovery has nothing to replay, because redo application never stopped — it is happening continuously on the storage fleet, so recovery is generally **under 10 seconds** even after a crash at 100,000 writes a second. And backup stops competing with foreground work, because it is just more background staging to S3. The measured 7.4-to-0.95 I/O ratio is the visible result, but the design change is a claim about what the database *is*: **not a set of pages with a log for recovery, but a log with pages as a cache.**',
  },
  sources: [
    {
      year: '2017',
      title: 'Amazon Aurora: Design Considerations for High Throughput Cloud-Native Relational Databases — Verbitski et al. (SIGMOD)',
      url: 'https://pages.cs.wisc.edu/~yxy/cs764-f20/papers/aurora-sigmod-17.pdf',
      note: 'One of the most practically useful papers in this book, and short. **§2.1 and §2.2 are the durability argument** — why 2-of-3 fails against a correlated zone loss, and why shrinking repair time beats adding copies; that reasoning transfers to any replicated system you will ever size. **§3 is the thesis** and is titled “The Log Is the Database”. **§7, Lessons Learned**, is the rare section where an industrial paper says what customers actually did, including the 150,000-table instances.',
    },
    {
      year: '2018',
      title: 'Amazon Aurora: On Avoiding Distributed Consensus for I/Os, Commits, and Membership Changes — Verbitski et al. (SIGMOD)',
      url: 'https://pages.cs.wisc.edu/~yxy/cs839-s20/papers/aurora-sigmod-18.pdf',
      note: 'The follow-up, and the one to read if the third design question above left you unconvinced. It sets out in detail how quorum membership is changed without consensus, how reads avoid quorums in normal operation, and what recovery has to reconstruct. Read it directly after Chapter 8 for a proper argument about when consensus is and is not the right instrument.',
    },
    {
      year: '2013',
      title: 'The Tail at Scale — Jeff Dean & Luiz André Barroso (CACM)',
      url: 'https://research.google/pubs/pub40801/',
      note: 'Cited by Aurora, and the paper that explains why a 4-of-6 quorum is a latency mechanism as much as a durability one. Once a request depends on many machines, the slowest one dominates — so any design that lets you ignore your two slowest participants is buying tail latency, not just fault tolerance. Six pages, and it will change how you read every benchmark in this book.',
    },
    {
      year: '1992',
      title: 'ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging — Mohan et al. (ACM TODS)',
      url: 'https://cs.stanford.edu/people/chrismre/cs345/rl/aries.pdf',
      note: 'The recovery method Aurora is departing from, and the reason “replay from the last checkpoint” was the default for twenty-five years. Worth reading the first few sections just to see how much machinery the conventional answer needs — and therefore how much disappears when redo application is continuous and somebody else’s job.',
    },
  ],
  seenIn: [
    { label: 'Write Once, Replay Everywhere — Ch 13', to: '/papers/kafka', live: true },
    { label: 'Consensus, Twice Told — Ch 8', to: '/papers/consensus', live: true },
    { label: 'Paying for Time with Hardware — Ch 11', to: '/papers/spanner', live: true },
    { label: 'Postgres — the deep dive', to: '/ddia/components/postgres', live: true },
  ],
  finale: {
    title: 'Act V closes: the plumbing turned out to be the building',
    body: 'Three chapters, one promotion. The cache in Chapter 12 was a replica with no protocol, and the protocol it eventually needed came from a daemon reading a commit log. Chapter 13 took that log out of the basement and made it a service, then argued that a table is what you get by replaying one and a log is not what you get by reading a table. This chapter put the claim inside a relational database and took it completely literally: no pages on the wire, no checkpoint, no consensus round, and a crash recovery that finishes in ten seconds because it never stopped running. The through-line is the same each time — the sequence of changes is the primary record, and everything you query is a reader that has fallen behind. Next: one of those readers stops wanting a row. It wants one column of a billion rows, which every layout in this book gets wrong, and the fix will split the industry in two.',
  },
  next: { title: 'Reading Sideways', slug: 'columnar' },
}
