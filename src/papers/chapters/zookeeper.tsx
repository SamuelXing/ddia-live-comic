import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { ZkThroughputDiagram } from '../diagrams'
import { zkLockTrace } from './zookeeper-trace'

/* Closes Act III. Chubby (Ch 4) already made the argument that coordination
   should ship as a service; repeating it here would waste the chapter. So the
   weight goes on the DISAGREEMENTS — no lock primitive, a wait-free API,
   reads served locally and possibly stale — each of which is a deliberate
   reversal of a Chubby decision with a cost you can name.

   The measurement step carries the act's best number: Table 1, where adding
   servers multiplies reads and divides writes. */

export const zookeeper: Chapter = {
  slug: 'zookeeper',
  act: 'Act III · Agreement (a flashback)',
  paperNo: 'Paper 9',
  title: 'Consensus as a Service',
  dek: 'Chapter 4 argued that agreement should ship as a service rather than a library. Four years later somebody built the open version — and disagreed with it in three specific places.',
  minutes: 16,
  paper: {
    title: 'ZooKeeper: Wait-free coordination for Internet-scale systems',
    authors: 'Patrick Hunt, Mahadev Konar, Flavio P. Junqueira & Benjamin Reed',
    venue: 'USENIX ATC',
    year: '2010',
    url: 'https://www.usenix.org/legacy/event/atc10/tech/full_papers/Hunt.pdf',
  },
  caption:
    'Two chapters have now established the shape of the answer. Consensus works, it costs a round trip to half a cluster on every write, and **almost nobody should implement it** — the people best placed in the world to do so wrote a second paper about how hard it was. Chapter 4 drew the conclusion from inside Google: ship it as a service, because a library has to be designed in from the start and availability is something teams add later. This is that argument made again, in the open, by people who had read it and **disagreed about what the service should offer.** The disagreements are the chapter.',
  steps: [
    {
      n: 'Step 01',
      title: 'The workload that decides everything else',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'Start with the number, because every other decision in this paper falls out of it. **Coordination workloads read far more than they write.** The paper puts its target range at **2:1 to 100:1**, and reports from a production Yahoo! deployment that above a thousand operations a second the ratio sat between **10:1 and 100:1** — with the common calls being *get this value*, *list these children*, *does this exist*.',
        'That is not surprising once you look at what coordination *is*. Who is the leader — asked constantly, changes rarely. Which servers are in the group — read on every request, written when a machine comes or goes. Where does this shard live. **Almost every question is a read of something that changed hours ago.**',
        'Now put that beside Chapter 8’s bill. Every write is a round trip to a majority, durably. If reads take the same path, then **read throughput equals write throughput**, and you have built a system whose capacity is set by its rarest operation. For a workload that is 100:1 in the other direction, that is the wrong system by two orders of magnitude.',
        'And the second constraint is the one Chubby met the hard way: this thing will be depended on by everyone, so its bad afternoon is everybody’s outage. **Whatever you build has to stay up while a minority of it is down, and it has to be something a client can survive being briefly disconnected from.**',
      ],
      code: {
        file: 'coordination_workload.txt',
        lines: [
          { t: '"who is the leader?"      read  · constantly' },
          { t: '"who is in the group?"    read  · constantly' },
          { t: '"where does shard 7 live" read  · constantly' },
          { t: '' },
          { t: 'leader changed            write · ~never' },
          { t: 'a machine joined          write · rarely' },
          { t: '' },
          { t: 'measured in production: 10:1 to 100:1' },
          { t: '' },
          { t: '# so: reads through consensus =', hl: 'bad' },
          { t: '# capacity set by the rarest operation' },
        ],
      },
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'You have read Chapter 4 and you agree with its conclusion: a service, not a library. What you are deciding now is what that service *offers* — and on all three of these, the paper you are re-deriving disagreed with the paper that came before it.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**The workload:** between **2:1 and 100:1** reads to writes, and in production often at the far end of that',
              '**The cost of a write:** a majority must durably acknowledge — Chapter 8 priced it, and no design here changes that',
              '**The clients:** many, application processes rather than machines, and they are allowed to be disconnected briefly without breaking',
              '**The requirement:** teams must be able to build leader election, group membership, locks and barriers on top of it',
              '**The obligation:** everyone will depend on this, so it must survive a minority failing and must not become the outage',
            ],
            questions: [
              {
                q: 'Reads outnumber writes a hundred to one. Do reads go through the consensus protocol?',
                options: [
                  {
                    label: 'Yes — every operation goes through the log, so everything is linearizable',
                    verdict: 'dead',
                    why: 'Correct, simple, and it caps your read capacity at your write capacity. For a workload that reads a hundred times more than it writes, you have sized the entire service by its rarest operation — and coordination reads are the hot path of every client that depends on you. This is the right answer for a database and the wrong one for this.',
                  },
                  {
                    label: 'Route all reads to the leader, which is always current',
                    verdict: 'dead',
                    why: 'Better, and it still funnels every read in the ensemble through one machine, so adding servers buys fault tolerance and no read capacity at all. It also makes the leader’s failure the failure of every read in flight, on a service whose entire purpose is being available when other things are not.',
                  },
                  {
                    label: 'Serve reads from whichever server the client is connected to, from local state',
                    verdict: 'move',
                    why: 'Reads never touch the protocol, so read capacity scales with the number of servers while write capacity does not. The honest cost is that **a read may be stale** — that server may not have applied the newest writes yet — so you must say so plainly rather than hide it, and offer an escape hatch for the caller who genuinely cannot tolerate it. This one decision is the difference between tens of thousands of operations a second and hundreds of thousands.',
                  },
                  {
                    label: 'Let clients cache, and invalidate their caches before acknowledging a write',
                    verdict: 'dead',
                    why: 'Chubby’s answer, and a good one — steady-state read traffic goes to zero. But the server must now track who caches what, hundreds of thousands of entries, and **a write blocks until the invalidations are out**, so write latency becomes a function of how many clients are watching. It also makes the server stateful about its clients in a way that complicates every failure path. A defensible different trade, not a free one.',
                  },
                ],
              },
              {
                q: 'Teams need locks, leader election, group membership and barriers. What primitive do you give them?',
                options: [
                  {
                    label: 'A lock, since that is what they keep asking for',
                    verdict: 'dead',
                    why: 'Chubby did this and it works, but it bakes one policy in permanently: exclusive locks with one queueing behaviour and one fairness rule. A team that wants a read-write lock, or a barrier, or *elect one primary per shard across ten thousand shards*, now needs you to ship something. **Every recipe you did not anticipate becomes a feature request** — and the abstraction is also blocking, which is the next problem.',
                  },
                  {
                    label: 'A tiny file system of nodes, with per-node flags for ephemeral and sequential',
                    verdict: 'move',
                    why: 'Give them a hierarchical namespace of small nodes and two flags. **Ephemeral** ties a node’s lifetime to the creating client’s session, so presence means liveness and a dead client cleans up after itself. **Sequential** makes the service append a monotonically increasing counter to the name, which hands out a total order without anybody asking for one. Locks, election, membership and barriers are all short recipes over those two flags — and crucially, **none of the API calls block.**',
                  },
                  {
                    label: 'A general key-value store and let people work it out',
                    verdict: 'dead',
                    why: 'Too little. Without ephemeral nodes there is no way to express *this participant is alive* except by writing heartbeats and having every reader time them out, which pushes the hardest part of failure detection into every client independently. Without sequential nodes everyone builds their own ordering scheme, and they will not all be correct.',
                  },
                  {
                    label: 'A full transactional API so clients can update several nodes atomically',
                    verdict: 'dead',
                    why: 'Powerful, and it is the road to being a database — which is the thing a coordination service must not become, because it is shared by everyone and must stay boringly fast and always up. It also drags in the failure modes and the operational weight that Chapter 8 says to keep off this path. The correct move is to stay small enough that people cannot store their application state in you, and even then they will try.',
                  },
                ],
              },
              {
                q: 'Reads are local and can be stale. What is the weakest set of ordering guarantees that still lets somebody build a correct lock?',
                options: [
                  {
                    label: 'Full linearizability on every operation',
                    verdict: 'dead',
                    why: 'It is the guarantee everybody wants and it costs exactly the thing you just bought: a linearizable read has to confirm with a majority, so you are back to reads through consensus. Offer it as an explicit opt-in for the caller who needs it — but making it the default throws away the whole design.',
                  },
                  {
                    label: 'No ordering guarantees; clients reconcile whatever they see',
                    verdict: 'dead',
                    why: 'Nothing can be built on this. A client that writes a value and then reads it back may not see it; two operations it issued in order may take effect in the other order. Every recipe above depends on being able to reason about the sequence of your own actions, and this removes that.',
                  },
                  {
                    label: 'Linearizable writes, plus FIFO ordering for each client’s own operations',
                    verdict: 'move',
                    why: 'Two guarantees, and between them they are enough. **All writes are totally ordered** — so there is one agreed sequence of updates and no ambiguity about who created the lowest-numbered node. **Each client’s own operations apply in the order it issued them** — so a client can fire off a batch asynchronously and still reason about its own sequence. That second one is what lets clients pipeline without the API blocking, which is where the throughput comes from.',
                  },
                  {
                    label: 'Causal consistency across all clients',
                    verdict: 'dead',
                    why: 'Stronger than needed and much more expensive to provide: tracking causality between clients means shipping and comparing dependency metadata on every operation, which is Chapter 5’s bill arriving in a system that reads a hundred times more than it writes. FIFO *per client* gets you the property recipes actually rely on, and costs a sequence number.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived ZooKeeper — and three deliberate disagreements with Chapter 4',
              body: [
                '**No lock primitive.** ZooKeeper is not a lock service and the paper says so in as many words, immediately before demonstrating locks — because the point is that a general enough substrate makes the recipe short. The famous one is the herd-free queueing lock: create an ephemeral sequential node, and if you are not lowest, **watch only the node immediately ahead of you**. One release wakes exactly one client, where the naive version wakes a thousand to disappoint 999.',
                '**Wait-free, which is the word in the title and the least discussed part.** No client operation ever blocks waiting for another client. That is not a performance tweak — it is what allows one slow or dead participant to be unable to stall anybody else, and it is why the API has watches rather than blocking calls. A blocking primitive in a shared service is a way for any client to hurt every other one.',
                '**And reads are local, so reads can be stale.** Chubby kept clients consistent by caching with server-side invalidation and paid for it on writes. ZooKeeper serves reads from whichever replica you are attached to and tells you they may lag, offering `sync` for the caller who needs to catch up first. That is a genuine weakening — **it is the trade that produced the numbers in the next section**, and the reason it is defensible is that it is stated rather than hidden.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'A lock, built from a service with no locks',
      accent: 'denim',
      rung: 'Rung 3 · The reveal',
      span: 2,
      body: [
        'Nothing in this trace is amber, and that is deliberate: the coordination service presents no coordinator to its clients at all, only a namespace with two useful flags. The lock is assembled entirely out of *create a numbered node* and *watch the one in front*.',
        'Step 4 is the one worth pausing on — it is the difference between a recipe that works on a whiteboard and one that works with a thousand waiters. Steps 6 and 7 are the failures, including the one no lock service can fix.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={zkLockTrace} />
        </div>
      ),
    },
    {
      n: 'Step 04',
      title: 'The most counter-intuitive table in this act',
      rung: 'Rung 4 · The measurement',
      body: [
        'The paper benchmarks a saturated ensemble — 250 simulated clients from 35 machines — and reports throughput at both extremes of the read/write mix. **Read it as two columns going in opposite directions**, because that is the whole lesson.',
        'Three servers: **87,000 reads/sec, 21,000 writes/sec.** Thirteen servers: **460,000 reads/sec, 8,000 writes/sec.** Adding ten machines multiplied read capacity by five and cut write capacity by nearly two thirds.',
        'Both directions are exactly what Chapter 8 predicts and neither is what people expect. Reads scale because they never touch the protocol — another server is another machine answering from local state. **Writes shrink because a larger ensemble means a bigger majority to convince**, over a slower tail, on every single write. *You are not buying capacity when you add members. You are buying fault tolerance, with capacity.*',
        'Which gives the sizing rule the whole act has been building toward, and it is not a matter of taste. **Choose your ensemble size from how many simultaneous failures you must survive, and from nothing else.** Three tolerates one, five tolerates two, seven tolerates three. Never an even number, because a majority of six is four — the same tolerance as five, with an extra machine to wait for. And if you need more read capacity than the ensemble gives you, the answer is observers or a cache, never more voting members.',
      ],
      diagram: <ZkThroughputDiagram />,
      think: {
        q: 'If reads can be stale, how can the herd-free lock in the trace be correct? A client might read a stale list of children and think it is first.',
        a: 'Because the correctness rests on the **writes**, which are linearizable and therefore totally ordered — and on **FIFO client order**, which means a client always sees the effects of its own operations in the order it issued them. When a client creates its sequential node, that create is ordered against every other create; the sequence numbers are handed out by one agreed sequence and no two clients can receive the same one. A client reading the children may see a *stale* list, but staleness here can only mean **missing nodes that were created later** — which are, by construction, numbered higher and therefore behind it in the queue anyway. **A stale read cannot invent a lower number that does not exist, and a lower number that does exist was created before yours and will be in any view that contains yours.** This is a good general lesson: weak reads are often sufficient when the ordering you rely on is carried by the writes, and working out whether that holds is the actual design work.',
      },
    },
    {
      n: 'Step 05',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 5 · What everybody-depends-on-you costs',
      body: [
        '**Stale reads surprise people forever.** The guarantee is written down, the `sync` call exists, and teams still assume a read reflects the newest write because that is how every database they have used behaves. The failure is quiet: a client reads a slightly old membership list and talks to a server that has left, or checks a leader that has already changed. **A default that is fast and weak, in a service everyone uses without reading the paper, produces a long tail of subtle bugs.**',
        '**Session expiry is not death.** The same limit Chapter 4 hit. A client paused by garbage collection stops renewing its session, the service deletes its ephemeral nodes, another client takes the lock — and then the first one wakes up believing it still holds it. ZooKeeper cannot prevent this. The znode version is a **fencing token** and the protected resource has to check it, which requires everyone downstream to change, which is the fix nobody ships.',
        '**Everybody stores too much in it.** Configuration becomes state, state becomes a small database, and a znode limit exists because somebody found out the hard way — the default cap is a megabyte per node and it is there for the same reason Chubby ended up with a 256 KB limit. **A shared service must be defended against its own users**, and both papers had to learn it in production.',
        '**And it is one more thing that must be up.** ZooKeeper became the dependency underneath Hadoop, HBase, Kafka, Solr and Mesos, which meant its bad afternoon was the industry’s. The failure Chubby documented — a shared coordination wobble amplified into a hundred-machine outage by clients whose recovery path was more expensive than the incident — happened again, repeatedly, to a whole generation of clusters.',
      ],
      callout: {
        kind: 'bad',
        big: 'THE DEFAULT READ IS THE FAST ONE',
        text: 'Reads are served from local replica state and may lag. That is the decision that produced 460,000 reads a second, it is documented, and it is the source of most surprises — because every other store the caller has used answers with the newest write.',
      },
    },
    {
      n: 'Step 06',
      title: 'What it begat — and where it stands in 2026',
      rung: 'Rung 6 · Descendants',
      body: [
        '**ZooKeeper is what the open-source world actually ran for a decade.** HBase for master election and region assignment, Kafka for controller election and broker membership, Solr, Mesos, Storm, Hadoop’s own HA. If you operated a cluster between roughly 2010 and 2020, you operated a ZooKeeper ensemble, whether or not it appeared on the architecture diagram.',
        '**etcd is the current default, and it won by association.** Raft underneath instead of Zab, a flatter key/value model, a gRPC API, and — decisively — Kubernetes was built on it. Every object in a cluster is a key in etcd and every controller lease is a write through consensus, so the busiest consensus deployment on earth is one nobody chose deliberately. Consul occupies the same slot elsewhere.',
        '**And the most interesting descendant is systems removing it.** Kafka spent years replacing ZooKeeper with **KRaft**, its own internal Raft implementation, and completed the removal in 4.0 (2025). The argument is worth understanding because it partially reverses this act: for a system that *is already* a replicated log, an external coordination service is a second consensus implementation to operate, a second failure domain, and a second thing to upgrade. **When your product is a log, the library objection from Chapter 4 stops applying** — you were always going to be structured as a state machine.',
        '**2026 status: the packaging argument won so completely that both papers describe the water.** Coordination is a service you depend on, it is somebody else’s to operate, and the interesting decisions are all operational: how many members, where they sit, what your recovery path costs when they wobble. The three disagreements in this paper aged well — **stale-by-default reads with an opt-in are now simply how distributed stores present themselves**, and the wait-free instinct, that a shared service must never let one client block another, is closer to a design rule than a design choice.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Znode.',
      body: 'A node in the hierarchical namespace, holding a small amount of data plus version metadata. Not a file — the size limit exists to stop it becoming one.',
    },
    {
      term: 'Ephemeral.',
      body: 'A znode that disappears when the session that created it ends. Presence becomes liveness, so a dead participant removes itself without anybody running anything.',
    },
    {
      term: 'Sequential.',
      body: 'A flag that makes the service append a monotonically increasing counter to the name. A total order, handed out as a side effect of creating a node.',
    },
    {
      term: 'Watch.',
      body: 'A one-shot notification that a znode changed. One-shot on purpose: it makes the client re-read, which keeps the server from having to track what each client believes.',
    },
    {
      term: 'Zab.',
      body: 'The atomic broadcast protocol underneath. Serves the same role as Raft or Multi-Paxos: agree a total order on updates, and only updates.',
    },
    {
      term: 'Wait-free.',
      body: 'No client operation blocks waiting for another client. The word in the title, and the reason one stuck participant cannot stall everybody else.',
    },
  ],
  inTheWild: {
    note: '5 ways this bites in production',
    points: [
      '**A stale read decides something important.** The default read is local and may lag, and the caller almost never knows. Membership lists, leader pointers and shard maps all get read this way, and the resulting bug looks like a network problem rather than a consistency one.',
      '**The herd shows up when the recipe is written from memory.** Everyone watches the lock instead of the node ahead of them, and a release wakes every waiter at once. It works fine with three clients in a test and falls over at a thousand, which is the worst possible time to discover the difference.',
      '**Ensembles get sized by intuition.** Someone picks seven members because it sounds robust, and write capacity drops by a third against five for a fault-tolerance gain nobody costed. Or someone picks six, which tolerates exactly what five does and is slower.',
      '**Session timeouts get tuned against the wrong thing.** Too short and a GC pause becomes a spurious failover with an ephemeral node deleted under a live client; too long and genuinely dead participants hold their nodes for minutes. Both failures look like the service misbehaving rather than a timeout doing what it was told.',
      '**It becomes the outage.** Every large-cluster incident review eventually reaches *the coordination layer got slow, so the leases could not be renewed, so everything stood down.* It is invisible on the architecture diagram because it is inside every box on it.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Take the stale read',
        when: 'the value changes rarely and a slightly old answer is either harmless or self-correcting — service discovery, configuration, a shard map you will retry against anyway. This is most coordination reads, and it is where the capacity comes from.',
      },
      {
        choose: 'Pay for the fresh read',
        when: 'you are about to do something irreversible on the strength of it. `sync` first, or route through the leader, and accept that this read now costs what a write costs. **The mistake is not choosing either one — it is not knowing which you got.**',
      },
      {
        choose: 'Build the recipe, do not wait for the primitive',
        when: 'you need a coordination pattern the service does not offer. Ephemeral plus sequential plus watches composes into locks, elections, barriers and queues, and the recipes are short. Read the ones in §2.4 before writing your own; the herd effect is easy to reintroduce.',
      },
      {
        choose: 'Size for failures, not for load',
        when: 'you are choosing an ensemble size — always. Members buy fault tolerance and cost write throughput, and the relationship is measured in the table above. If you need read capacity, add observers or a cache; adding voters makes it worse.',
      },
    ],
  },
  misconception: {
    think: '“ZooKeeper is the open-source Chubby.”',
    actually:
      'It is the open-source answer to Chubby’s *argument* — ship coordination as a service — and it disagrees with the design in three specific places, each deliberately. **There is no lock primitive**, because a general namespace with ephemeral and sequential nodes lets clients build the lock their situation needs, and Chubby’s single baked-in policy could not. **The API is wait-free**, so no client operation blocks on another, because a blocking call in a shared service is a way for one participant to hurt everybody. **And reads are served locally and may be stale**, where Chubby kept client caches consistent by invalidating them before acknowledging a write — a stronger guarantee that makes write latency depend on how many clients are watching. That third disagreement is the one with a number attached: it is why a thirteen-server ensemble serves **460,000 reads a second**, and it is also why the most common ZooKeeper bug in production is somebody assuming a read reflects the newest write. **The papers agree about packaging and disagree about the contract**, and it is the contract that shows up in your incident reviews.',
  },
  sources: [
    {
      year: '2010',
      title: 'ZooKeeper: Wait-free coordination for Internet-scale systems — Hunt, Konar, Junqueira & Reed (USENIX ATC)',
      url: 'https://www.usenix.org/legacy/event/atc10/tech/full_papers/Hunt.pdf',
      note: 'Read **§2.4** first — the recipes — because it is where the argument lives: seven API calls, and locks, leader election, group membership and barriers all fall out in a few lines each. Then **§5.1** for Table 1, which is the most useful measurement in this act. The herd-free lock in §2.4 is the one to memorise; almost everyone writes the naive version first.',
    },
    {
      year: '2011',
      title: 'Zab: High-performance broadcast for primary-backup systems — Junqueira, Reed & Serafini (DSN)',
      url: 'https://ieeexplore.ieee.org/document/5958223',
      note: 'The protocol underneath, written up separately, and behind IEEE’s paywall — the Apache **ZooKeeper Internals** page covers the same ground for free if you would rather not pay. Worth knowing why it is not simply Paxos: Zab must preserve the total order of *all* prior updates across a leader change, which is a stronger requirement than agreeing one value at a time, and that requirement is what shaped the protocol.',
    },
    {
      year: '2006',
      title: 'The Chubby lock service for loosely-coupled distributed systems — Burrows (OSDI)',
      url: 'https://static.googleusercontent.com/media/research.google.com/en//archive/chubby-osdi06.pdf',
      note: 'Chapter 4 here, and the paper this one is arguing with. Read §2.1 beside ZooKeeper’s §2.4 and the disagreements are plain: locks versus a namespace, caching with invalidation versus local reads, blocking versus wait-free. Two good answers to one question, four years apart.',
    },
  ],
  seenIn: [
    { label: 'Consensus, Twice Told — Ch 8', to: '/papers/consensus', live: true },
    { label: 'The Lock Everyone Was Secretly Holding — Ch 4', to: '/papers/chubby', live: true },
    { label: 'What “Before” Even Means — Ch 7', to: '/papers/lamport', live: true },
    { label: 'Fencing tokens — the comic', to: '/ddia/read/distributed-troubles', live: true },
  ],
  finale: {
    title: 'Act III put back what Act I was standing on',
    body: 'Three chapters, and the hole is properly filled. Chapter 7 said there is no true order to discover, only one everybody can compute identically. Chapter 8 said a majority can settle it while a minority is broken, at the cost of a round trip per decision. This one said almost nobody should build that, and here is how everybody gets it anyway. Which means every appointment in Act I now has a name behind it — the master GFS waits for, the lease Bigtable’s tablet servers hold, the election Chubby runs. Next: with agreement in hand, you can start buying back the promises Act I sold. Two attempts at putting transactions on top of a system that never offered them — one done in software, on machines nobody upgraded, and one done by buying clocks.',
  },
  next: { title: 'Transactions, Hand-Rolled', unwritten: true },
}
