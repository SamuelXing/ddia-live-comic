import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { QuorumOverlapDiagram, RaftStudyDiagram } from '../diagrams'
import { raftTrace } from './consensus-trace'

/* The middle of Act III, and the only chapter in the book that reads two
   papers about the same problem sixteen years apart. The thesis is not "here
   is how consensus works" — the DesignIt does that in three decisions. It is
   that the second paper's contribution was understandability, that this is a
   real contribution, and that it was demonstrated with a control group, which
   is a thing algorithms papers essentially never do.

   Rhymes deliberately with Ch 2 (the pattern was the contribution) and Ch 4
   (the packaging was the contribution). Three chapters, one question: what has
   to be true for an idea to actually get used? */

export const consensus: Chapter = {
  slug: 'consensus',
  act: 'Act III · Agreement (a flashback)',
  paperNo: 'Paper 8 · told twice',
  title: 'Consensus, Twice Told',
  dek: 'One algorithm, two papers, sixteen years apart. The first was correct and nobody could implement it. The second changed almost nothing that matters and changed everything.',
  minutes: 18,
  paper: {
    title: 'The Part-Time Parliament · Paxos Made Simple · In Search of an Understandable Consensus Algorithm',
    authors: 'Leslie Lamport (1998, 2001) · Diego Ongaro & John Ousterhout (2014)',
    venue: 'ACM TOCS · USENIX ATC',
    year: '1998–2014',
    url: 'https://lamport.azurewebsites.net/pubs/lamport-paxos.pdf',
  },
  caption:
    'Chapter 7 left you with a working algorithm and one fatal sentence: it requires every process to participate, so a single failure stops it forever. Everything since has been built on top of that hole. GFS needed a master appointed; Chubby needed five machines to agree on which of them was in charge; the ring in Act II came apart precisely where it had no way to agree. **This is the hole**, and closing it took the field about twenty years, produced the most notorious paper in computer science, and then — because almost nobody could build from it — produced a second paper whose stated goal was that people should be able to understand it.',
  steps: [
    {
      n: 'Step 01',
      title: 'The requirement, and why the obvious answers all fail',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'Some number of machines must agree on **one value** — which server is the leader, what the next entry in the log is, whether this transaction committed. Once anybody anywhere has acted on the decision, it can never change. Machines may crash and restart; messages may be delayed, duplicated or lost; and no clock can be trusted, which Chapter 7 has already established at length.',
        'The one thing you are allowed to assume is that nobody lies. Crashes and silence, not sabotage. **Byzantine faults are a different and much harder problem**, and everything in this book operates inside a single organisation’s network where the assumption is fair.',
        'Now watch the obvious answers fall over. *Everybody must agree* is Chapter 7 and stops on the first crash. *A designated decider* moves the problem: something must appoint the decider, and that something needs this same guarantee — Chapter 4 walked into this circle from the other side. *First to shout wins* gives different answers to different listeners, because arrival order is not a fact about the world.',
        'What is left is the answer that took the longest to find and reads as obvious afterwards: **let a majority decide.** The reason it works is not a property of computers at all. It is that two majorities of the same group cannot avoid each other, so whatever an earlier majority settled, any later majority contains at least one machine that was there.',
      ],
      code: {
        file: 'the_hole_in_chapter_7.txt',
        lines: [
          { t: 'Lamport 1978, mutual exclusion:' },
          { t: '  wait for a message from EVERY process' },
          { t: '  → one crash and nothing ever proceeds', hl: 'bad' },
          { t: '' },
          { t: 'and you cannot just time it out, because' },
          { t: '  "without physical time there is no way' },
          { t: '   to distinguish a failed process from' },
          { t: '   one which is just pausing"', hl: 'bad' },
          { t: '' },
          { t: 'so: stop requiring everybody.' },
          { t: 'require a MAJORITY — two of them always', hl: 'good' },
          { t: 'share a member, and that member remembers' },
        ],
      },
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'The first two decisions build the algorithm. The third is the one this chapter is really about, and it is not a question about distributed systems at all.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**The goal:** all machines agree on one value, and once anyone acts on it, it can never change',
              '**The failures:** machines crash and come back; messages are delayed, duplicated or dropped. **Nobody lies** — crashes and silence only',
              '**The clocks:** useless for correctness, per Chapter 7. Timeouts may be used to make progress, never to establish safety',
              '**The bar:** it must stay available while a minority is down, because a system that stops on one crash is the thing you are replacing',
              '**The users:** engineers who have to build this, on a deadline, and get the corner cases right',
            ],
            questions: [
              {
                q: 'Five machines. Some are down. You need a decision that can never be reversed. Who has to agree?',
                options: [
                  {
                    label: 'All five, so nobody can possibly disagree later',
                    verdict: 'dead',
                    why: 'Chapter 7’s algorithm exactly, and it is unavailable the moment one machine reboots — which on commodity hardware is roughly always. Worse, you cannot even tell whether the missing machine is dead or slow, so there is no safe timeout to add. Requiring unanimity converts every single-machine failure into a total outage.',
                  },
                  {
                    label: 'One designated machine, with the others as backups',
                    verdict: 'dead',
                    why: 'Something has to appoint it and notice when it dies, and that something needs the same guarantee you are trying to build — this is the circle Chapter 4 walked into from the other side. Two backups can also both conclude the primary is gone and both take over, which is the split brain the whole exercise exists to prevent.',
                  },
                  {
                    label: 'Any three of the five',
                    verdict: 'move',
                    why: 'A majority, and it works because of a fact about sets rather than about computers: **two majorities of the same group always share at least one member.** So a later round cannot help but include somebody who witnessed the earlier one. It also fails in the right direction — three of five can proceed while two are down, and if the network splits three against two, only one side can act.',
                  },
                  {
                    label: 'Whichever machines respond first, up to some fixed number',
                    verdict: 'dead',
                    why: 'A fixed count without the majority property gives you two disjoint groups that can each act. Two of five, twice, with no overlap — and now two different values are both decided, both durable, and both wrong. The size is not the point; **the overlap is the point**, and only a majority guarantees it.',
                  },
                ],
              },
              {
                q: 'A majority already accepted the value X, but everyone who knew that has gone quiet. A new proposer arrives believing the field is clear and starts pushing Y. How do you stop it?',
                options: [
                  {
                    label: 'Once a machine accepts a value, it refuses everything afterwards',
                    verdict: 'dead',
                    why: 'Now a proposer that got two acceptances and then crashed has wedged the system permanently: no future proposal can ever reach a majority, and nobody can clear the state because clearing it is exactly what would break safety. You have traded a liveness problem for a deadlock, which is a worse trade than it looks.',
                  },
                  {
                    label: 'Number the proposals, and make a proposer ask before it tells',
                    verdict: 'move',
                    why: 'Two phases. First the proposer asks a majority to **promise** to ignore anything older than its number — and each machine, in replying, reports any value it has already accepted. If any reply carries a value, the proposer is obliged to **abandon its own and propose that one instead**. So the new proposer cannot help but discover X, because its majority overlaps the earlier one. It thinks it is proposing freely; it is actually being told what to say.',
                  },
                  {
                    label: 'Have the machines vote on which of X and Y they prefer',
                    verdict: 'dead',
                    why: 'A vote needs the voters to agree on what they are voting about and to tally it consistently, which is the problem you are solving, one level down. And there is nothing to prefer: X may already have been acted on by a client that was told it succeeded. **This is not a choice between two candidates — it is an obligation to discover a commitment that already exists.**',
                  },
                  {
                    label: 'Timestamp the proposals and let the later one win',
                    verdict: 'dead',
                    why: 'Chapter 7 spent fifteen pages on why that comparison is meaningless across machines, and here the consequence is not a lost shopping cart but a reversed decision somebody has already acted on. Proposal numbers must be unique and ordered, but they are **identifiers, not times** — they say which round this is, never which round happened first.',
                  },
                ],
              },
              {
                q: 'You now have a correct algorithm. It has been published for a decade, it is taught everywhere, and teams keep shipping broken implementations of it. What do you change?',
                options: [
                  {
                    label: 'Publish a shorter, clearer explanation of the same algorithm',
                    verdict: 'dead',
                    why: 'Tried, by the author, and it did not work. *Paxos Made Simple* opens with the sentence “The Paxos algorithm, when presented in plain English, is very simple” — and implementations stayed rare and difficult for another decade. The gap is not between the reader and the prose; it is between an algorithm that decides **one value** and a system that needs an ordered log of millions, and closing that gap is left to the reader every time.',
                  },
                  {
                    label: 'Write a formal proof so implementers can verify their own versions',
                    verdict: 'dead',
                    why: 'The proofs exist and are not what is missing. The Chubby team — people with every advantage — wrote an entire second paper on what building a working Paxos actually took, and the gaps they hit were incomplete specifications, fault-tolerance handling and the distance between pseudocode and production. **More rigour at the top does not close a gap that opens at the bottom.**',
                  },
                  {
                    label: 'Design a different algorithm whose primary goal is that people can understand it',
                    verdict: 'move',
                    why: 'Treat understandability as the requirement to optimise, ahead of elegance and ahead of minimality, and accept a less general result in exchange. That means decomposing the problem into separately explainable pieces, and deliberately reducing the number of states a reader must hold in their head — even where a more clever formulation exists. It sounds soft, and Raft made it concrete enough to **measure with a control group.**',
                  },
                  {
                    label: 'Accept it is hard and have everyone use one shared library',
                    verdict: 'dead',
                    why: 'The most reasonable-sounding answer here, and Chapter 4 records what happened when Google tried exactly it: they shipped a standalone consensus library, and it went largely unused, because a library demands to be designed in from the start and availability is something teams add later. What did work was shipping a service — which is Chapter 9, and it still needs somebody to have built the thing correctly underneath.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived Paxos in two decisions — and the third is why there is a second paper',
              body: [
                'Those first two decisions are single-decree Paxos: majorities for safety, and a two-phase protocol where the prepare round forces a new proposer to adopt any value that might already have been chosen. Everything else in the literature — multi-Paxos, leader leases, reconfiguration, Raft itself — is machinery for running that repeatedly, efficiently, over a log.',
                '**And that is exactly where implementations broke.** Paxos decides one value. Real systems need a sequence of them, agreed in order, with a stable leader so the prepare phase can be skipped, plus log truncation and membership changes. The paper does not describe that system; it describes the atom. Ongaro and Ousterhout name this directly: Paxos’ single-decree formulation means real systems must be built on an architecture the paper never specifies, and every team invents a different one.',
                '**Raft’s move is to make the log the primitive from the first sentence.** There is always a leader; entries flow one way, leader to followers, never the reverse; a server may not be elected unless its log is at least as current as the majority’s. Each of those costs something in generality and buys a system you can hold in your head. **The claim is not that Raft is better as an algorithm. It is that a correct implementation is more likely**, which for infrastructure is the property that actually matters — and unlike almost any other algorithms paper, they went and measured it.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'Why a majority, in one picture',
      accent: 'denim',
      rung: 'Rung 3 · The whole safety argument',
      body: [
        'Everything above rests on one observation, and it is not a fact about distributed systems. Take five servers. Any three of them, and any other three of them, **must share at least one member** — there is no way to choose two groups of three from five that miss each other. Four out of seven, six out of eleven, the same.',
        'So when a later round asks a majority *have you accepted anything?*, at least one machine in that majority was in the earlier majority and has to say yes. **The new proposer cannot avoid learning about the old decision**, however unlucky its timing, however many machines have died in between. Safety is not maintained by anyone remembering to be careful; it falls out of arithmetic.',
        'This is also why the numbers are always odd. Five servers tolerate two failures; six servers also tolerate two, because a majority of six is four. **The sixth machine adds cost, adds a round-trip participant, and adds nothing.** Every consensus deployment you meet has three, five or seven members for this reason and no other.',
      ],
      diagram: <QuorumOverlapDiagram />,
      think: {
        q: 'If majorities make it safe, why did it take until 1998, and why is the algorithm still considered hard?',
        a: 'Because safety was never the difficult half — **liveness is.** With majorities you can prove nothing bad happens quite readably. What you cannot prove is that anything ever happens at all: two proposers can leapfrog each other’s proposal numbers indefinitely, each invalidating the other’s prepare round, forever. That is not a bug in Paxos, it is unavoidable — the **FLP result** of 1985 proves that no deterministic algorithm can guarantee both safety and termination in an asynchronous system with even one crash. So every real system dodges rather than solves: elect a distinguished proposer, add randomised timeouts, and accept that progress is *very likely* rather than certain. **Raft’s randomised election timeout is not an optimisation — it is the dodge, made obvious.** And the difficulty people report is mostly the second half of that: reasoning about a protocol whose termination is probabilistic and whose safety must hold anyway.',
      },
    },
    {
      n: 'Step 04',
      title: 'Five servers, one leader, one crash',
      accent: 'denim',
      rung: 'Rung 4 · The reveal',
      span: 2,
      body: [
        'Raft rather than Paxos, because Raft is the one people actually implement. Watch the amber box: it moves **once**, at step 3, and then stays. In the Act II traces it moved on every step, because those systems had no leader and paid for it in conflicts. This one elects a leader and pays for it in elections.',
        'The last two steps are the whole reason the algorithm is more than a nice idea: a leader dies mid-write, an entry exists on one machine and nowhere else, and the system resolves it without anyone outside noticing.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={raftTrace} />
        </div>
      ),
    },
    {
      n: 'Step 05',
      title: 'An algorithms paper with a control group',
      rung: 'Rung 5 · The measurement',
      body: [
        'Here is what makes the 2014 paper unusual, and it is not the algorithm. **They claimed their contribution was understandability, and then they measured it.** Forty-three students at Stanford and Berkeley watched a video lecture on each algorithm and sat a quiz on each, in both orders to cancel out learning effects.',
        'Mean score out of 60: **25.7 for Raft, 20.8 for Paxos.** Thirty-three of the forty-three scored higher on Raft. A paired t-test puts the true difference at **at least 2.5 points with 95% confidence.** And the study was tilted *toward* Paxos — fifteen participants had prior Paxos experience, none had prior Raft experience, and the Paxos lecture ran 14% longer.',
        'You can pick at it. Undergraduates are not the engineers who build consensus systems; the same authors made both lectures; a quiz is not an implementation. **All true, and it remains far more evidence than any comparable claim in the field has ever offered** — the usual standard for "this design is simpler" is that the author found it so.',
        'The other measurements are more ordinary and worth keeping. Leader election settles in about **half the minimum election timeout**, with timeouts drawn from 150–300 ms on a cluster whose broadcast time was around 15 ms. Remove the randomness entirely and elections took **over ten seconds**, because the servers kept splitting the vote in lockstep. *Five milliseconds of jitter is the difference between a working system and a livelock*, which is a good thing to know before you tune a timeout to a nice round number.',
      ],
      diagram: <RaftStudyDiagram />,
      deeper: {
        summary: 'The timing inequality, which is the only tuning rule you need.',
        body: [
          'Raft states its requirement as `broadcastTime ≪ electionTimeout ≪ MTBF`, and almost every consensus misconfiguration is a violation of one of those two inequalities.',
          '**Left side:** the election timeout must be well above the time to send a round of RPCs and get replies, or followers will start elections while a perfectly healthy leader is mid-heartbeat — and each spurious election is an unavailability window. This is what breaks when a cluster is stretched across regions with the timeouts left at their single-datacentre defaults.',
          '**Right side:** the election timeout must be far below the mean time between failures, or the cluster spends a meaningful fraction of its life leaderless. This is rarely the binding constraint on real hardware, and it is why the usual advice is *raise the timeout* rather than lower it.',
          'The instructive part is what is **not** in the inequality: cluster size, data volume, request rate. Election behaviour is governed by network round-trip time and failure rate, and by nothing you can fix with a bigger machine.',
        ],
      },
    },
    {
      n: 'Step 06',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 6 · What agreement costs',
      body: [
        '**Every committed write is a round trip to half the cluster, forever.** No batching, pipelining or clever engineering removes it — it is the price of the guarantee. Put your consensus members in three regions for durability and you have bought a cross-region round trip on every write, which is a decision usually made by whoever drew the availability-zone diagram rather than by anyone thinking about latency.',
        '**More members make it worse, not better.** Five servers tolerate two failures and require three acknowledgements; seven tolerate three and require four, from a slower tail. Chapter 9 measures exactly this and it is the most counter-intuitive number in the act. **Adding machines to a consensus group buys fault tolerance and spends throughput.**',
        '**A leaderless window on every failure.** The cluster is unavailable for writes from the moment the leader dies until a new one is serving — around half the election timeout at best, and longer if the failure is a slow leader rather than a dead one, because nobody notices promptly. Chapter 4 records what that costs downstream: a fourteen-second Chubby fail-over turning into tens of minutes of recovery across hundreds of machines.',
        '**And the implementations really are hard.** This is not folklore. The Chubby team wrote a whole paper on the distance between the algorithm and a working system; Raft exists because that distance was still costing the industry a decade later. **Do not write one.** Use etcd, use ZooKeeper, use a library that a lot of people have already broken in interesting ways — which is Chapter 9’s entire argument, arriving from the other direction.',
      ],
      callout: {
        kind: 'bad',
        big: 'AGREEMENT IS A ROUND TRIP, PRICED PER WRITE',
        text: 'Consensus does not make a system slow by being badly implemented. It is slow because a majority must durably acknowledge before anyone can be told it happened, and that is the guarantee, not the overhead.',
      },
    },
    {
      n: 'Step 07',
      title: 'What it begat — and where it stands in 2026',
      rung: 'Rung 7 · Descendants',
      body: [
        '**Paxos ran the previous era mostly invisibly.** Chubby underneath Google, and through Chubby underneath GFS and Bigtable; Spanner’s replica groups; Megastore. It won the Dijkstra Prize in 2012 and is, by a distance, the algorithm most cited by people who have not implemented it.',
        '**Raft won the current one, and it won on adoption.** etcd — and therefore every Kubernetes cluster on earth, where each object is a key and every controller lease is a write through consensus. TiKV, CockroachDB, Consul, and Kafka’s KRaft, which finally let Kafka drop its own ZooKeeper dependency. The reference site lists implementations in dozens of languages, which is itself the evidence: **the paper produced a population of implementations rather than a population of citations.**',
        '**The frontier moved to the leader.** A single leader is a bottleneck and a latency floor, so the interesting recent work removes it: EPaxos and its successors commit commuting commands in one round trip with no designated leader, and Cassandra’s Accord takes that into production for multi-partition transactions. Flexible quorums showed the read and write quorums need only intersect, not both be majorities. None of it changes the fundamental price.',
        '**2026 status: consensus became a dependency rather than a skill.** Almost nobody implements it; almost everybody depends on it, usually without naming it — *"we use etcd for leader election"* passes review unexplained. The remaining hazard is the one Chapter 4 named and this act priced: the coordination layer is in every box on the diagram and in none of the boxes anyone owns, so its bad afternoon is everyone’s outage. **And the deepest thing here is still the 2014 claim, which was never really about consensus**: that for infrastructure, an algorithm people can implement correctly beats a more elegant one they cannot — and that this is a measurable property, not a matter of taste.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Quorum.',
      body: 'Any majority of the group. The only property that matters is that two of them always intersect, which is what stops a later round from missing an earlier decision.',
    },
    {
      term: 'Term.',
      body: 'Raft’s monotonically increasing round number. Every message carries one, and anything stamped with an old term is ignored — a logical clock doing the job no wall clock could.',
    },
    {
      term: 'Committed.',
      body: 'Durably stored on a majority. Before that an entry may exist on disk somewhere and still be deleted, which is not data loss — it is the definition.',
    },
    {
      term: 'Prepare / promise.',
      body: 'Paxos’ first phase. The proposer asks a majority to ignore older proposals; their replies reveal any value already accepted, which the proposer must then adopt as its own.',
    },
    {
      term: 'Split vote.',
      body: 'Several candidates each take some votes and nobody reaches a majority. Fixed by randomising the timeouts, which is the entire reason that randomness exists.',
    },
    {
      term: 'FLP.',
      body: 'The 1985 impossibility result: no deterministic algorithm guarantees both safety and termination in an asynchronous system with one crash. Every real system dodges it with timeouts.',
    },
  ],
  inTheWild: {
    note: '5 ways this bites in production',
    points: [
      '**The consensus cluster is stretched across regions by accident.** Somebody spreads the members over three availability zones for durability, and every write now pays a cross-zone round trip. It is not wrong — but it should be a decision with a number attached, and it is usually neither.',
      '**Timeouts get tuned to round numbers and lose their jitter.** Raft measured elections taking over ten seconds with no randomness, versus tens of milliseconds with five milliseconds of it. Any configuration that makes members time out in lockstep reintroduces exactly that.',
      '**Nobody sizes for the write ceiling.** Consensus throughput is bounded by one leader doing a durable round trip per entry, and it does not improve when you add members — it gets worse. Teams discover this when the coordination layer saturates at a rate their application-tier dashboards say is trivial.',
      '**Slow leaders are worse than dead ones.** A dead leader triggers an election promptly; a leader that is alive but paused on GC or a sick disk keeps heartbeating just enough to hold its position while serving nothing. This is the FLP boundary showing up as an incident, and it is why leases and health checks are separate mechanisms.',
      '**Someone implements it.** The single most reliably regretted decision in this chapter. Two papers exist specifically because production consensus is harder than the algorithm, and the correct move is to depend on an implementation that has already had its corner cases found by other people.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Put it through consensus',
        when: 'the decision must be unique and durable and being wrong is unrecoverable — who is primary, whether this transaction committed, what the current membership is. Small, rare, load-bearing facts. That is what it is excellent at, and it costs a round trip each time.',
      },
      {
        choose: 'Keep it out of consensus',
        when: 'the data is large, hot, or per-request. A consensus group is not a database; it is the thing that decides which database is in charge. **Per-request traffic against a consensus cluster is the most reliably regretted decision in this act.**',
      },
      {
        choose: 'Three or five members, never six',
        when: 'you are sizing a cluster. Even counts buy nothing — a majority of six is four, the same fault tolerance as five with an extra participant to wait for. Five is the usual right answer; seven only if you genuinely need to survive three simultaneous failures and can afford the slower writes.',
      },
      {
        choose: 'Depend, do not implement',
        when: 'always, essentially. etcd, ZooKeeper, or a mature library. **The gap between the published algorithm and a correct production system is the subject of two separate papers**, and it has not closed because someone read this chapter.',
      },
    ],
  },
  misconception: {
    think: '“Raft is a simplified Paxos — same algorithm, friendlier presentation.”',
    actually:
      'It is a **different algorithm**, designed under a different objective function. Paxos agrees on a single value and leaves you to build a log out of that; Raft makes the replicated log the primitive from the outset, mandates a leader at all times, forces entries to flow only from leader to follower, and refuses to elect anyone whose log is behind. Each of those is a real constraint that Paxos does not impose, and each **costs generality** to buy a system a person can hold in their head at once. The claim was never that Raft is more elegant — it is less general and its authors say so. The claim is that a correct implementation is more likely, and the reason this chapter reads two papers rather than one is that **the second demonstrated it with a control group**, which is close to unheard of for an algorithms result. If you want the honest one-line summary: *Paxos is what the problem is; Raft is what an engineer should build.*',
  },
  sources: [
    {
      year: '2001',
      title: 'Paxos Made Simple — Leslie Lamport',
      url: 'https://lamport.azurewebsites.net/pubs/paxos-simple.pdf',
      note: '**Start here, not with the 1998 paper.** Thirteen pages, and the first half — single-decree Paxos, phases one and two — is the actual algorithm and is genuinely readable. The abstract famously reads, in full: *“The Paxos algorithm, when presented in plain English, is very simple.”* Judge that for yourself; it is part of the story.',
    },
    {
      year: '1998',
      title: 'The Part-Time Parliament — Leslie Lamport (ACM TOCS)',
      url: 'https://lamport.azurewebsites.net/pubs/lamport-paxos.pdf',
      note: 'The original, written as an archaeological report on the parliament of a fictional Greek island, submitted in 1990 and published eight years later. Read it as history rather than as instruction — but do read the editor’s note, which is a small masterpiece and tells you more about how the field received this result than any summary could.',
    },
    {
      year: '2014',
      title: 'In Search of an Understandable Consensus Algorithm (Extended Version) — Ongaro & Ousterhout (USENIX ATC)',
      url: 'https://raft.github.io/raft.pdf',
      note: '**The one to read if you read one.** Figure 2 is the complete algorithm on a single page and is the densest useful page in this act — many implementations are essentially a transcription of it. §9.1 is the user study. The extended version is longer and better; take it over the conference cut.',
    },
    {
      year: '2007',
      title: 'Paxos Made Live: An Engineering Perspective — Chandra, Griesemer & Redstone (Google)',
      url: 'https://static.googleusercontent.com/media/research.google.com/en//archive/paxos_made_live.pdf',
      note: 'What it actually took to build Chubby’s consensus layer: incomplete specifications, fault-tolerance handling, testing a protocol whose failure modes are rare and catastrophic. This is the evidence for the whole chapter — the people best placed in the world to implement Paxos wrote a second paper about how hard it was.',
    },
  ],
  seenIn: [
    { label: 'What “Before” Even Means — Ch 7', to: '/papers/lamport', live: true },
    { label: 'The Lock Everyone Was Secretly Holding — Ch 4', to: '/papers/chubby', live: true },
    { label: 'Raft, illustrated — the comic', to: '/ddia/read/consensus', live: true },
    { label: 'Why it’s hard — the comic', to: '/ddia/read/distributed-troubles', live: true },
  ],
  finale: {
    title: 'The hole is closed, and it cost a round trip',
    body: 'Chapter 7 could order events but stopped dead when one machine did. This closes that, and the bill is now legible: a majority must durably acknowledge before anybody is told anything, so every agreed fact costs a round trip to half the cluster and a leaderless pause whenever the leader dies. Which raises the question this act has been circling since Chapter 4 and can now finally answer properly. Almost nobody should implement this. So how does everybody get it? Next: the same argument Chubby made, made again in the open, by people who disagreed with it in several specific and interesting ways.',
  },
  next: { title: 'Consensus as a Service', slug: 'zookeeper' },
}
