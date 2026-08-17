import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { MarriageDiagram, PhiDiagram } from '../diagrams'
import { cassandraWriteTrace } from './cassandra-trace'

/* Closes Act II. The chapter is about composition, so it spends its weight on
   the REFUSALS rather than the borrowings — anyone can list what Cassandra
   took from Dynamo and Bigtable, and the list is in the paper's own related-
   work section. What is Cassandra's alone is the sentence explaining why it
   would not take vector clocks: a write would have to read first. Everything
   downstream, including the clock-skew problem it is famous for, follows from
   that one refusal. */

export const cassandra: Chapter = {
  slug: 'cassandra',
  act: 'Act II · Availability at Any Cost',
  paperNo: 'Paper 6',
  title: 'A Marriage of Two Papers',
  dek: 'Two designs on the table, one problem, and a team at Facebook taking half of each. What it borrowed is the famous part. What it refused is the part that decided everything after.',
  minutes: 16,
  paper: {
    title: 'Cassandra — A Decentralized Structured Storage System',
    authors: 'Avinash Lakshman & Prashant Malik',
    venue: 'LADIS',
    year: '2009',
    url: 'https://www.cs.cornell.edu/projects/ladis2009/papers/lakshman-ladis2009.pdf',
  },
  caption:
    'Two of the last four chapters solved half of this problem each. **Bigtable** knows how to lay structured data on a disk that cannot be edited — sorted rows, column families, a memtable in front, immutable files behind — and hangs it all off one master and a file system it did not write. **Dynamo** knows how to keep taking writes when machines vanish — a ring, gossip, quorums, nobody in charge — and stores opaque blobs it refuses to understand. A team at Facebook has a problem that needs both halves, and one of the paper’s own authors wrote Dynamo. **So: take the ring from one and the storage engine from the other.** The borrowing is the easy part and the paper is candid about it. The interesting part is the one thing it would not take.',
  steps: [
    {
      n: 'Step 01',
      title: 'Inbox Search, and a write rate that rules most designs out',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'Facebook wants users to search their own inbox. Two queries: **term search** — which of my messages contain this word — and **interactions** — every message between me and this person. Both are per-user, both want results in time order, and neither needs anything a relational database is good at.',
        'What makes it hard is the write side. Every message anyone sends updates the index of everyone in the conversation, which the paper puts at **billions of writes per day**. Before launch they had to move what already existed: **7 TB of inbox data for over 100 million users**, sitting in MySQL, rebuilt into a reverse index by MapReduce jobs and loaded in.',
        'Now look at what a row-store does with each of those writes. Find the page holding the row — *that is a read* — take a lock, modify it in place, update the secondary indexes, write the log. **At a billion a day the read-before-write is the whole cost**, and it is the cost you cannot optimise away, because it is not a bug in the implementation. It is what updating a B-tree means. Chapter 3 and the RUM interlude both said this, from the other direction.',
        'And it must be fast to read anyway. Inbox Search is a box a user types into and waits at, so tens of milliseconds, from an index spread across two coasts.',
      ],
      code: {
        file: 'inbox_search.txt',
        lines: [
          { t: 'what the index has to answer:' },
          { t: '  "which of MY messages contain X"' },
          { t: '  "every message between me and Y"' },
          { t: '' },
          { t: 'writes: billions/day — every message' },
          { t: '        updates every participant', hl: 'bad' },
          { t: 'reads:  tens of ms, user is waiting' },
          { t: '' },
          { t: '# a row store reads a page before every' },
          { t: '# write. That is not slow code —', hl: 'bad' },
          { t: '# that is what a B-tree update IS' },
        ],
      },
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'Unusually, you already have the answers — you have read four of the papers this one cites, in this book. So the decisions here are not *what mechanism*, they are **which parent, for which part, and where do you overrule both of them.**',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**The workload:** a per-user index, appended to constantly. **Billions of writes a day**, reads in tens of milliseconds, results wanted in time order',
              '**The seed data:** **7 TB across 100M+ users** already in MySQL, to be rebuilt as a reverse index and loaded in',
              '**The machines:** hundreds of commodity nodes across two coasts, some fraction always broken, and **no GFS** — you have local disks and nothing underneath them',
              '**The prior art on your desk:** Bigtable for the data model and the storage engine, Dynamo for the ring — and one of you wrote Dynamo',
              '**The tolerance:** losing a recent index entry for a moment is survivable. Refusing writes, or stopping for an election, is not',
            ],
            questions: [
              {
                q: 'Store “which of user 42’s messages contain the word ‘tuesday’”, updated constantly, read in one shot. What is the shape on disk?',
                options: [
                  {
                    label: 'A relational table of (user, word, message) rows',
                    verdict: 'dead',
                    why: 'This is the thing being replaced, and it is instructive that it worked at all — 7 TB of it was running on MySQL. It falls over on the write path rather than the read path: every insert finds a page, locks it, rewrites it, and updates the indexes. Multiply by billions a day. The query is fine; it is the maintenance of the index that is impossible.',
                  },
                  {
                    label: 'One blob per user, read out and rewritten on each change',
                    verdict: 'dead',
                    why: 'Now every message rewrites a user’s entire index, so the cost of a write grows with how much history someone has — the most active users, the ones who matter most, get the worst service. And a search for one word drags the whole structure off disk to look inside it, which is read amplification bought with nothing.',
                  },
                  {
                    label: 'A row per user, with sorted columns grouped into families',
                    verdict: 'move',
                    why: 'Bigtable’s model, taken almost unchanged. The user id is the row key; the word is a **super column**; the ids of messages containing it are the columns inside. Columns sort by name or by time, and Inbox Search asks for time, so the results come off the disk already in the order the page will show them. One query, one contiguous slice, no sorting afterwards.',
                  },
                  {
                    label: 'A separate small table for each user',
                    verdict: 'dead',
                    why: 'A hundred million tables, each with its own files, its own metadata and its own place in whatever catalogue tracks them — you have converted a data problem into a metadata problem roughly as large. Bigtable makes the same point from the other side: it stores everything in one enormous sorted map precisely so that the number of things to keep track of does not grow with users.',
                  },
                ],
              },
              {
                q: 'A write has to be durable before you acknowledge it, and there is no GFS underneath you. Where does the byte actually land?',
                options: [
                  {
                    label: 'Update the row in place on the local disk',
                    verdict: 'dead',
                    why: 'Every one of those is a seek to find the row, a read to get the page, and a random write to put it back, plus a lock while it happens. This is the failure from the previous question wearing different clothes, and no amount of tuning removes it — the shape of the write is the problem.',
                  },
                  {
                    label: 'Build a replicated file system first, then put the database on it',
                    verdict: 'dead',
                    why: 'Bigtable’s answer, and it is a good one when GFS already exists and another team maintains it. Here it means writing Chapter 1 before you can start Chapter 6, and inheriting a component whose failure modes are now yours. **Bigtable gets durability from GFS; you have to get it from somewhere else, and that constraint is what makes this a different system rather than a port.**',
                  },
                  {
                    label: 'Append to a sequential commit log, update memory, flush to an immutable file later',
                    verdict: 'move',
                    why: 'The log gives durability at the speed of a sequential disk — and it gets a **dedicated disk**, so nothing else makes its head seek. Memory gives the sorted structure. The flush gives an immutable file that needs no locks to read and merges cheaply with its neighbours later. Durability comes from the log, redundancy comes from the ring, and **the disk is never asked to do anything but write forwards.**',
                  },
                  {
                    label: 'Hold it in memory and replicate to N nodes before acknowledging',
                    verdict: 'dead',
                    why: 'Durability now means *N machines do not lose power at once*, and a rolling restart — the most routine operation there is — becomes a data-loss event. You would also have to solve it eventually anyway, because memory is not where hundreds of terabytes live. It is a real technique for a cache and not one for a system of record.',
                  },
                ],
              },
              {
                q: 'Two writes to the same cell, made without either side knowing about the other. Dynamo keeps both and hands them to your code. Do you inherit that?',
                options: [
                  {
                    label: 'Yes — vector clocks, siblings, and an application merge function',
                    verdict: 'dead',
                    why: 'Dead *here*, and the paper says why in the sentence that explains the whole design: **“a write operation in Dynamo also requires a read to be performed for managing the vector timestamps.”** To extend a version’s clock you must first fetch the version. That is a read before every write, which is exactly the cost this system was built to eliminate — so the mechanism that made Chapter 5 work is unaffordable one chapter later, at a different write rate.',
                  },
                  {
                    label: 'Take a lock on the row while writing it',
                    verdict: 'dead',
                    why: 'A lock requires somebody to grant it, which requires agreement, which stops during a partition — and you have just spent a whole design avoiding anything that can stop. It also serialises writes to the most active rows, which are the ones under the most pressure. Chapter 4 is about who could grant such a lock, and the answer does not belong on this path.',
                  },
                  {
                    label: 'Attach a timestamp to every column and keep the highest',
                    verdict: 'move',
                    why: 'Last write wins, decided **per column rather than per row**, so two writes touching different columns of the same row both survive and the common case stops being a conflict at all. Nothing is read to make the decision, the application implements nothing, and a reader can pick a winner from data alone. **The cost is deferred rather than avoided** — and it is deferred onto the clock, which is where the next chapter of trouble starts.',
                  },
                  {
                    label: 'Keep every version forever and let readers sort it out',
                    verdict: 'dead',
                    why: 'Siblings without the bookkeeping that makes siblings useful. Storage grows without bound for hot cells, every read gets slower as versions pile up, and the reader is handed a set of values with no information about how they relate — which is strictly worse than Dynamo, where at least the clocks say which ones are genuinely concurrent.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You just re-derived a system by subtraction',
              body: [
                'The paper is unusually easy to summarise: **Dynamo’s distribution layer, Bigtable’s storage layer.** It says so itself, and its related-work section reads like a shopping list. Ring and gossip and quorums from one; column families, commit log, memtable, immutable files, bloom filters and compaction from the other.',
                'What makes it a design rather than an assembly is the **refusal**, and there is really only one that matters. Vector clocks are rejected on a cost argument, not a correctness one — the mechanism is fine, it just needs a read on the write path, and at billions of writes a day that is the one thing you cannot have. Every property Cassandra is known for follows from that single decision: no siblings, no merge function, last-write-wins, column-level granularity, and a hard dependency on clocks that has caused more confusion than any other part of it.',
                'There is a second refusal, and the paper is charmingly honest about half-taking it back. Bigtable’s master is rejected — but ranges still have to be assigned, so **Cassandra elects a leader using ZooKeeper**, which tells joining nodes what they are replicas for. The lesson comes near the end of §6, and it is the most useful sentence in the paper for anyone building something: *“Although Cassandra is a completely decentralized system we have learned that having some amount of coordination is essential to making the implementation of some distributed features tractable.”* **Act I’s lock service walks back in through a side door**, one chapter after an act that threw it out.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'One write across both halves',
      accent: 'denim',
      rung: 'Rung 3 · The reveal',
      span: 2,
      body: [
        'The middle zone is Dynamo and the right zone is Bigtable, and the write crosses from one into the other at step 3. No other figure in this book has to hold two papers at once.',
        'Steps 6 and 7 are where the marriage stops being a copy. Watch what does *not* happen at step 6 — nothing is read to decide the winner — and then watch step 7 bill you for it.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={cassandraWriteTrace} />
        </div>
      ),
    },
    {
      n: 'Step 04',
      title: 'The seam',
      rung: 'Rung 4 · What it took, and what it declined',
      body: [
        'Set the inheritance out plainly and the shape of the argument shows. **Everything on the distribution side is Dynamo** — the ring, gossip membership, N replicas with a quorum on the way in, no master anywhere near a write. **Everything on the storage side is Bigtable** — column families, the commit log in front of an in-memory structure, immutable files behind it, a bloom filter per file, background compaction. Cassandra even keeps Dynamo’s word for the replica set: the *preference list*.',
        'The divergences are few and each is a real decision. Dynamo spread load with **virtual nodes**, giving one machine many random positions on the ring; Cassandra instead **moves lightly loaded nodes** along the ring toward the heavy ones, and says plainly that it chose this because it makes the implementation tractable and the choices deterministic. It also uses an **order-preserving** hash, which keeps ranges scannable and hands you the hot-spot problem the partition-key comic spends its whole length on.',
        'And then the refusal that matters, which is worth reading in the paper’s own dry phrasing: Dynamo *“prefers a client side conflict resolution mechanism”*, and *“a write operation in Dynamo also requires a read to be performed for managing the vector timestamps. This is can be very limiting in environments where systems need to handle a very high write throughput.”* Two sentences, one typo, and the entire divergence between the two systems.',
        '**This is the general lesson of the chapter and it outlives all three systems.** A mechanism is not good or bad on its own; it is priced against a workload. Vector clocks are correct, they were the right answer one chapter ago, and they are unaffordable here — because the price is a read, and this system’s scarcest resource is exactly that.',
      ],
      diagram: <MarriageDiagram />,
      think: {
        q: 'Cassandra decides conflicts per column rather than per row. That sounds like a detail. Why is it the difference between last-write-wins being usable and being a disaster?',
        a: 'Because it changes how often two writes are a conflict at all. Row-level last-write-wins means **any two concurrent writes to a row destroy one of them**, even when they touched completely unrelated fields — update someone’s display name while another process updates their timezone, and one silently loses. Column-level means those two writes commute, and only genuine same-field races are decided by the clock. **The granularity of your conflict unit sets your conflict rate**, and that is a general point: the same resolution policy is fine at one granularity and unusable at another. It is also why the trouble that remains is real trouble — what is left after this optimisation is exactly the cases where two writers meant different things about the same fact.',
      },
    },
    {
      n: 'Step 05',
      title: 'What it measured, and the one genuinely new idea in it',
      rung: 'Rung 5 · The measurement',
      body: [
        'The production numbers are modest and specific. **50+ TB on a 150-node cluster** spread between east and west coast datacentres. Search interactions: 7.69 ms at best, **15.69 ms median**, 26.13 ms worst. Term search: 7.78 / 18.27 / 44.41 ms. Inbox Search launched in June 2008 for about 100 million users and the paper reports it running for over 250 million.',
        'A detail worth stealing: when a user clicks into the search box, an asynchronous message primes the cache with that user’s index **before they have finished typing**. The latency budget is spent during a human’s reaction time, which is the cheapest place there is.',
        'But the contribution nobody quotes is the failure detector, and it is a genuinely good idea. Conventional detectors return a verdict — *up* or *down* — and someone has to pick a timeout, which is a bet about the network that is wrong at both ends. The **Φ accrual detector** returns a *suspicion level* instead: each node tracks the distribution of gap times between gossip messages from every other node, and reports how surprising the current silence is. **The caller then picks its own tolerance**, and a Φ of 5 means acting on a silence that would occur by chance about once in a hundred thousand times.',
        'The measurement is the argument. On a 100-node cluster the conventional detectors they tried took **about two minutes** to notice a dead node — the paper calls that *“practically unworkable”* — and the accrual detector at Φ=5 took **about 15 seconds**. The team also notes they found an exponential distribution fitted the gossip channel better than the Gaussian the original paper assumed, which is the kind of correction you only get from running it.',
      ],
      diagram: <PhiDiagram />,
      deeper: {
        summary: 'Why a suspicion level beats a timeout, stated generally.',
        body: [
          'A timeout forces one number to answer two questions at once: *how long before we act* and *how sure do we need to be*. Those have different right answers for different callers. Routing a read away from a slow node should happen fast and be cheap to get wrong; declaring a node permanently gone and rebuilding its data should be slow and nearly certain.',
          'An accrual detector separates them. It publishes a continuous measure of surprise, and each caller thresholds it however its own consequences demand. The failure detector stops being a component that makes decisions and becomes one that supplies evidence.',
          'That generalises well beyond this paper, and it is worth carrying: **whenever a component answers a yes-or-no question by comparing something to a constant, ask whether it should be reporting the something instead.** Every caller downstream has a different appetite for being wrong, and the constant can only be right for one of them.',
        ],
      },
    },
    {
      n: 'Step 06',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 6 · What last-write-wins costs',
      body: [
        '**The winner of a conflict is chosen by a wall clock.** A node a few seconds fast writes values that beat every later write until real time catches up; a node a few seconds slow writes values that are accepted, replicated, acknowledged — and then lose to something older the next time anyone looks. **No error is raised and no counter moves.** Dynamo bought the ability to detect this and paid with a read before every write. Cassandra declined the purchase, and the invoice arrives addressed to whoever maintains NTP.',
        '**Deletes are worse here than in Chapter 5.** A delete cannot remove anything, because the data may be on a node that is offline and would come back and resurrect it — so a delete writes a **tombstone**, a marker with a timestamp, which every read must then step over. Keep tombstones too briefly and deleted things return; keep them too long and a heavily churned partition becomes mostly gravestones. The single worst read pathology in production Cassandra is a query that scans a hundred thousand tombstones to return four rows.',
        '**The order-preserving hash hands you the hot-spot problem.** Ranges stay scannable, which is useful, and it means keys that sort together *live* together — so a key beginning with a timestamp puts every write from today onto one machine while the rest of the ring idles. The DDIA comic on choosing a partition key argues this out in full, and it is linked below rather than repeated.',
        '**And repair is a chore somebody has to own.** Quorum reads and read repair fix what gets read; everything else drifts until an anti-entropy pass compares Merkle trees and mends it. That pass is expensive, it competes with live traffic, and if it does not complete within the tombstone lifetime the deleted rows come back. **This is the operational fact about eventually consistent stores that no paper puts in its abstract**: consistency is not just eventual, it is *scheduled*, and somebody has to run the schedule.',
      ],
      callout: {
        kind: 'bad',
        big: 'THE CONFLICT RESOLVER IS YOUR NTP DAEMON',
        text: 'Last-write-wins moves the decision out of your code and into the clocks of every machine that can accept a write. It is cheap, it needs no merge function, and it means a misconfigured server can quietly overwrite correct data with stale data for as long as its clock is wrong.',
      },
    },
    {
      n: 'Step 07',
      title: 'What it begat — and where it stands in 2026',
      rung: 'Rung 7 · Descendants',
      body: [
        'Cassandra escaped Facebook almost immediately and became the system this act is actually remembered by. Apache in 2009, DataStax commercialising it, and deployments at Netflix, Apple and Discord that are among the largest operational datasets anybody talks about publicly. **Dynamo was more influential; Cassandra was more deployed** — because one was a paper and the other was a download.',
        'The data model in the paper is essentially gone. Super column families were a dead end, and **CQL** replaced the Thrift API with something that looks like SQL: tables, rows, a primary key split into a partition key and clustering columns. It is a better interface and it hides the thing you must still understand — *the partition key decides which machine, the clustering columns decide the order within it* — which means the most consequential decision in the system is now made by people who think they are declaring a schema.',
        '**The consistency story got the extension the paper lacked.** Lightweight transactions arrived on Paxos, giving compare-and-set at real cost — four round trips, and a rate limit measured in the hundreds per partition per second. Then **Accord** (from 2023, shipping through the 5.x line) offered general multi-partition transactions in one round trip in the common case. Read that as Act III arriving late: the thing this act threw out came back, properly, once someone did the consensus work.',
        '**ScyllaDB** is the same design rewritten in C++ with a shard-per-core, shared-nothing thread model and its own scheduler, and it is the strongest evidence that the architecture was sound and the JVM was a tax. Amazon sells **Keyspaces**, a Cassandra-compatible API over its own storage. And Cassandra 5.0 brought storage-attached indexes and vector search, which is what happens to every durable database eventually.',
        '**2026 status: the argument that opened this act closed quietly.** Cassandra grew transactions; DynamoDB grew leaders and strongly consistent reads; the leader-based systems grew availability tricks. What survived from this paper is not the ring or the column families but the operating assumption underneath both — **that a storage system may hand its user a choice about consistency instead of a promise** — which is now so ordinary that it is a dropdown in a console.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Column family.',
      body: 'A named group of columns under a row key, sorted by name or by time. Bigtable’s idea; the unit that a query slices and that the storage engine keeps together on disk.',
    },
    {
      term: 'Memtable.',
      body: 'The sorted in-memory structure a write lands in after the commit log. Flushed to an immutable file when it grows past a threshold.',
    },
    {
      term: 'Commit log.',
      body: 'The append-only durability record, on its own disk so nothing makes its head seek. Rolled at 128 MB; entries are dropped once the data they cover has been flushed.',
    },
    {
      term: 'Tombstone.',
      body: 'A delete, written as a timestamped marker rather than a removal — because the row may exist on a node that is currently offline. Reads must step over them until compaction collects them.',
    },
    {
      term: 'Accrual failure detector.',
      body: 'A detector that reports how surprising a node’s silence is rather than declaring it dead. Callers pick their own threshold, so a cheap decision and an expensive one can use different ones.',
    },
    {
      term: 'Order-preserving hash.',
      body: 'Ring positions that keep key order, so ranges stay scannable. The reason a poorly chosen partition key concentrates every write on one node.',
    },
  ],
  inTheWild: {
    note: '5 ways this bites in production',
    points: [
      '**Clock skew silently eats writes.** Nothing logs it, nothing counts it, and the symptom reaches you as a user saying a change did not save. The first question in any Cassandra data-loss investigation is whether the clocks agreed, and the answer is often that one node was drifting for a week.',
      '**Tombstones become the read path.** A queue-shaped table — insert, read, delete — is the classic mistake, and it produces partitions where the live rows are a rounding error next to the markers for the dead ones. Cassandra will eventually refuse the query rather than scan them, which is the kindest possible failure and still an outage.',
      '**The partition key is a permanent decision.** Choose one that puts today’s data in one place and no amount of hardware helps, because the ring is doing exactly what you asked. Changing it means rewriting the table, which at these data sizes means a migration measured in weeks.',
      '**Repair is a job, not a feature.** Anti-entropy has to complete within the tombstone lifetime or deleted data returns. It competes with live traffic, it fails halfway, and on a large cluster arranging for it to finish reliably is somebody’s recurring calendar entry.',
      '**Large partitions punish you late.** Nothing stops a row from growing to gigabytes, and nothing warns you while it happens — then compaction, repair and reads on that partition all degrade together, on a cluster where every other partition is fine and every dashboard looks healthy.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Take last-write-wins',
        when: 'the value is a fact rather than an accumulation — a status, a reading, a current position — and the write rate makes a read-before-write unaffordable. Then have someone actually own clock synchronisation, because you have just made it a correctness dependency rather than an operational nicety.',
      },
      {
        choose: 'Take siblings and a merge function',
        when: 'losing a concurrent write is unacceptable and your value is something that accumulates. You are paying a read on every write and a merge function you must keep correct forever. Chapter 5 is the chapter for this, and it is honest about the bill.',
      },
      {
        choose: 'Borrow a mechanism from another system',
        when: 'you have checked what it costs **at your rates**, not at theirs. This whole chapter is one worked example: a mechanism that was correct and affordable at Amazon’s write volume was correct and unaffordable at Facebook’s.',
      },
      {
        choose: 'Allow yourself a little coordination',
        when: 'full decentralisation is making some feature intractable. The paper says this out loud after arguing for symmetry throughout, and it is the more useful position: **a coordination service off the write path costs you almost nothing and buys a great deal of simplicity.**',
      },
    ],
  },
  misconception: {
    think: '“Cassandra is basically open-source Dynamo.”',
    actually:
      'It is Dynamo’s distribution layer with **Bigtable’s storage engine and data model** underneath, and one deliberate disagreement with Dynamo at the centre of it. Dynamo stores opaque blobs and refuses to interpret them, so when two writes race it keeps both and makes your application choose. Cassandra stores structured rows it does understand, so it can resolve a race itself with a per-column timestamp — and it must, because it explicitly rejected vector clocks on the grounds that maintaining them **requires reading before every write**, which its workload could not afford. **The two systems answer the central question of this act in opposite directions**: Dynamo says the store cannot know which value is right so it will not pretend, and Cassandra says the store will pick one and the clock will decide. Everything that is pleasant about operating Cassandra, and everything that is treacherous about it, comes from that single sentence in §2.',
  },
  sources: [
    {
      year: '2009',
      title: 'Cassandra — A Decentralized Structured Storage System — Lakshman & Malik (LADIS; reprinted in SIGOPS OSR 2010)',
      url: 'https://www.cs.cornell.edu/projects/ladis2009/papers/lakshman-ladis2009.pdf',
      note: 'Six pages, and rougher than the papers around it — typos, a copyright line still reading 200X. Read **§2** first, because the two sentences rejecting vector clocks explain more of the system than the rest of the paper combined. Then §5.6 for local persistence and §6.1 for what Inbox Search actually did. **§6 is the best part**: what they learned, including the admission that a fully decentralised system still wanted a coordinator.',
    },
    {
      year: '2004',
      title: 'The Φ Accrual Failure Detector — Hayashibara, Défago, Yared & Katayama (JAIST IS-RR-2004-010)',
      url: 'https://oneofus.la/have-emacs-will-hack/files/HDY04.pdf',
      note: 'The idea Cassandra borrowed and improved: report a continuous suspicion level rather than a verdict, and let each caller choose its own threshold. Worth reading for the general move, which applies far outside failure detection — every component that compares a measurement to a constant is making somebody else’s tradeoff for them.',
    },
    {
      year: '2007',
      title: 'Dynamo: Amazon’s Highly Available Key-value Store — DeCandia et al. (SOSP)',
      url: 'https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf',
      note: 'One half of the marriage, and Chapter 5 here. Read §4.4 beside Cassandra’s §2 — one paper builds the versioning machinery with care, the next declines it in two sentences on a cost argument. That is as close as systems papers get to a direct exchange.',
    },
    {
      year: '2006',
      title: 'Bigtable: A Distributed Storage System for Structured Data — Chang et al. (OSDI)',
      url: 'https://static.googleusercontent.com/media/research.google.com/en//archive/bigtable-osdi06.pdf',
      note: 'The other half, and Chapter 3. §6 on implementation is the part Cassandra reproduces most directly — memtable, immutable files, compaction, bloom filters. What Cassandra could not take is the foundation: Bigtable gets its durability from GFS, and there was no GFS at Facebook.',
    },
  ],
  seenIn: [
    { label: 'The Cart That Must Not Close — Ch 5', to: '/papers/dynamo', live: true },
    { label: 'The Database GFS Deserved — Ch 3', to: '/papers/bigtable', live: true },
    { label: 'Choosing the partition key — the comic', to: '/ddia/read/partition-key', live: true },
    { label: 'B-trees vs LSM-trees — the comic', to: '/ddia/read/storage', live: true },
    { label: 'Interlude: The RUM Triangle', to: '/papers/rum', live: true },
  ],
  finale: {
    title: 'Act II ends with the store deciding, badly, on purpose',
    body: 'Throw out the master and you find out, over the following two chapters, everything it had been quietly doing for you. Dynamo handed the decision to the application and was honest that it could not make it. Cassandra took the decision back, resolved it with a number that is not really a measure of anything, and got the write rate it needed in exchange. Both are defensible; neither is agreement. And the thing both are working around has a name, which is that on machines with separate clocks nobody can say what happened first. Next: the book stops going forward and goes back to 1978 to ask that question properly.',
  },
  next: { title: 'What “Before” Even Means', slug: 'lamport' },
}
