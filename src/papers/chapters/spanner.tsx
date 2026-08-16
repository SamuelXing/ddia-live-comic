import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { TrueTimeDiagram, CommitWaitDiagram } from '../diagrams'
import { spannerTrace } from './spanner-trace'

/* Closes Act IV, and answers Chapter 7 with money. Lamport's paper says there
   is no observable global order and offers a computable substitute; this paper
   says: buy the order, and here is the receipt.

   The thing to protect in this chapter is the reframing. TrueTime is almost
   always taught as "Google has atomic clocks", which makes it sound like an
   advantage you cannot have. The actual contribution is an API that returns an
   interval instead of a number — an honesty change, not an accuracy one — plus
   the willingness to sit still for the width of that interval. The clocks are
   what make the interval narrow enough to sit still for. */

export const spanner: Chapter = {
  slug: 'spanner',
  act: 'Act IV · Buying the Promises Back',
  paperNo: 'Paper 11',
  title: 'Paying for Time with Hardware',
  dek: 'Chapter 7 proved you cannot observe a global order of events. This paper agrees, and then buys one anyway — with an API that admits how wrong the clock is, and a database willing to wait that long.',
  minutes: 18,
  paper: {
    title: 'Spanner: Google’s Globally-Distributed Database',
    authors: 'James C. Corbett, Jeffrey Dean, Michael Epstein, Andrew Fikes, Christopher Frost, JJ Furman, Sanjay Ghemawat, Andrey Gubarev et al.',
    venue: 'OSDI',
    year: '2012',
    url: 'https://www.usenix.org/system/files/conference/osdi12/osdi12-final-16.pdf',
  },
  caption:
    'Chapter 10 put transactions on top of a store that had none, and it worked because indexing is patient. Now the same demand arrives from somewhere that is not. Google’s advertising backend runs on a hand-sharded MySQL, and **the last time they resharded it took over two years** and dozens of teams. It needs transactions across arbitrary rows, synchronous replication across a continent, and the ability to survive a datacenter without anybody noticing. Chapter 7 already ruled out the obvious approach: there is no global “before” you can observe, only one you can compute from messages. So this paper stops trying to observe it. **It buys it.**',
  steps: [
    {
      n: 'Step 01',
      title: 'What the customer actually asked for',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'The requirement has an unusually precise name — **external consistency** — and it is worth stating carefully because everything in the chapter is downstream of it. *If transaction T1 finishes before transaction T2 starts, then T1’s timestamp must be smaller than T2’s.* Not “before” in the sense of messages passed. Before in the sense a person with a stopwatch would mean, standing in two different countries.',
        'That is a demand Chapter 7 explicitly declined to meet. Lamport’s clocks order events **that are connected by messages**, and two clients on separate continents that never communicate have no ordering at all — even though one of them plainly went first. For a search index that gap is a curiosity. For a system that moves money, it is the whole product: a customer’s two actions must not appear to have happened in the wrong order because they were served by different datacenters.',
        'And the second constraint rules out Chapter 10’s answer. **Percolator’s timestamp oracle is one machine.** That works inside a datacenter, where a round trip is a fraction of a millisecond and batching hides the rest. Across an ocean it is a 70-millisecond tax on every transaction, plus a single machine on one continent whose failure stops writes on every other. *The thing that made the last chapter possible is the first thing to break here.*',
        'What is available instead: Chapter 8’s consensus, sharded — data split into thousands of groups, each one its own Paxos state machine with a long-lived leader. That gives ordering **within** a group. It says nothing whatsoever about how a write in Virginia relates to a write in Belgium.',
      ],
      code: {
        file: 'what_you_must_guarantee.txt',
        lines: [
          { t: 'T1 commits in Virginia   ...............  10:00:00.000' },
          { t: 'T2 starts in Belgium     ...............  10:00:00.004' },
          { t: '' },
          { t: 'required: stamp(T1) < stamp(T2)', hl: 'good' },
          { t: '' },
          { t: '# and the two machines never exchanged a message,' },
          { t: '# so nothing in Chapter 7 can order them.' },
          { t: '' },
          { t: 'available:' },
          { t: '  paxos, per shard  → order inside a group' },
          { t: '  wall clocks       → confidently wrong', hl: 'bad' },
        ],
      },
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'Three questions. The first has four wrong-looking answers because the right one is not a mechanism at all — it is a change in what the clock is allowed to say.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**The guarantee:** if T1 finishes before T2 begins — in real time, anywhere on earth — then T1’s timestamp must be smaller.',
              '**The geography:** replicas across a continent, sometimes across the world. A round trip may be tens of milliseconds and you cannot make it shorter.',
              '**What you have:** Chapter 8’s consensus, sharded into thousands of independent groups, each with a long-lived leader.',
              '**What you do not have:** any way for two machines to observe the same instant, and no willingness to route every transaction through one machine.',
              '**The workload:** reads outnumber writes heavily, and the reads must not be the thing that pays for this.',
            ],
            questions: [
              {
                q: 'You need timestamps that agree with real time across continents. What do you stamp transactions with?',
                options: [
                  {
                    label: 'Chapter 7’s logical clocks',
                    verdict: 'dead',
                    why: 'They order what is connected and nothing else. Two transactions on two continents that never exchanged a message get no ordering from a logical clock — and worse, the order it *does* invent for them is arbitrary, so it can contradict what a customer watched happen. Lamport’s paper says this about itself, in the section about the anomalous behaviour, and it is exactly the anomaly here.',
                  },
                  {
                    label: 'One global sequencer, like Chapter 10’s oracle',
                    verdict: 'dead',
                    why: 'It is correct, and it is a machine on one continent that every transaction on every other continent must reach twice. That is a round trip added to every commit, and a single component whose bad afternoon stops writes worldwide. The design that made the previous chapter cheap is the one thing that cannot cross an ocean.',
                  },
                  {
                    label: 'NTP-synchronised wall clocks, and stamp with the local reading',
                    verdict: 'dead',
                    why: 'Every machine confidently reports a number that is wrong by an amount it will not tell you. Two clocks disagree by tens or hundreds of milliseconds, so a transaction that genuinely happened later can receive a smaller stamp, and the database will believe it. **The problem is not that the clock is inaccurate. It is that the API hides the inaccuracy** — you are handed a number with no error bar and no way to ask for one.',
                  },
                  {
                    label: 'A clock that returns an interval, and never a single number',
                    verdict: 'move',
                    why: 'Change what the call is allowed to say. `TT.now()` returns **[earliest, latest]** with an absolute guarantee that the true time lies inside it, and half the width is called ε. Nothing here made the clocks more accurate — it made them **honest**, and honesty is a thing you can build on. Every remaining decision is about what to do with a width instead of a point.',
                  },
                ],
              },
              {
                q: 'Your clock says the time is somewhere in a 10 ms window. What stamp do you assign, and when do you let anyone see the write?',
                options: [
                  {
                    label: 'Pick the earliest end — the write is at least that old',
                    verdict: 'dead',
                    why: 'Cheap and broken. The stamp you chose is probably in the future relative to your own uncertainty, so a transaction that starts later can legitimately read a smaller stamp and be ordered before you. You have produced timestamps that disagree with reality in exactly the direction the guarantee forbids.',
                  },
                  {
                    label: 'Pick the midpoint — it is the best estimate',
                    verdict: 'dead',
                    why: 'It is the best *estimate*, which is a statistical idea, and this is not a statistical guarantee. Half the time the true instant is later than your stamp, and half of a correctness property is none of it. The interval is not there to be averaged; it is there to be respected at its pessimistic end.',
                  },
                  {
                    label: 'Pick the latest end, and reveal the commit immediately',
                    verdict: 'dead',
                    why: 'Very close, and it fails at the last inch. You chose a stamp that may still be in the future, and then you told someone about it — so a reader can observe your write, start their own transaction, and receive a stamp *smaller* than yours despite genuinely coming after. The order in the database now contradicts the order a person saw.',
                  },
                  {
                    label: 'Pick the latest end — then wait until that stamp is definitely in the past',
                    verdict: 'move',
                    why: '**Commit wait.** Choose `s = TT.now().latest`, hold your locks, and tell absolutely nobody until `TT.after(s)` is true. Now anyone who learns about your write is learning about it at a real time later than s, so any stamp they get is larger. The cost is about **2ε of doing nothing** on every write, and the reason this is a viable design rather than a joke is that ε has been engineered down to single-digit milliseconds.',
                  },
                ],
              },
              {
                q: 'Every write now pays for the uncertainty. What does that purchase let you do with reads?',
                options: [
                  {
                    label: 'Nothing special — reads take read locks like any database',
                    verdict: 'dead',
                    why: 'You just paid for global timestamps and then declined to spend them. Read locks make readers block writers and writers block readers, across continents, on a workload that is mostly reads. It is the correct textbook answer and it throws away the entire reason for the previous decision.',
                  },
                  {
                    label: 'Reads go to the leader, which is always current',
                    verdict: 'dead',
                    why: 'Correct and wasteful. Every read crosses to wherever the leader happens to be, so a European client reads from Virginia, and read capacity is capped at one machine per shard no matter how many replicas you keep. Chapter 9 already priced this mistake in a much smaller system.',
                  },
                  {
                    label: 'Reads name a timestamp and go to any replica that has caught up to it',
                    verdict: 'move',
                    why: 'This is the payoff. A read-only transaction picks a stamp and reads from **any** replica far enough ahead — no locks, blocking nothing, blocked by nothing, and served from the nearest continent. Because every commit carries a globally meaningful stamp, *reading the entire database as it stood at 09:00 is a well-defined operation*, which turns into consistent backups, MapReduce over a live database, and schema changes announced for a future instant.',
                  },
                  {
                    label: 'Reads are eventually consistent, as in Act II',
                    verdict: 'dead',
                    why: 'Then you have built two systems that disagree with each other and told the application to sort it out. Worse, it is unnecessary here: the expensive property has already been bought on the write path, so weakening reads saves nothing you were paying for and gives up the one guarantee the customer came for.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived Spanner — and the contribution is an admission, not a clock',
              body: [
                '**TrueTime’s content is the error bar.** Everything else in the system is respectable and familiar: sharded Paxos, two-phase locking, two-phase commit over the top, multi-version storage. What no other database had was a clock API that *returns how wrong it might be*, so the database can reason about the uncertainty instead of pretending it away. The GPS receivers and atomic clocks are not the idea — they are what makes ε small enough that the idea is affordable.',
                '**And the algorithm is: wait.** Commit wait is a database deliberately being slow, for a bounded and measured amount of time, so that the number it wrote down means something everywhere. Chapter 7 said there is no observable global order. This does not refute that. **It converts an unobservable quantity into a latency**, and then pays it.',
                '**What it buys is disproportionate.** Lock-free read-only transactions at any replica. Snapshot reads at any past instant. A consistent backup of a database spanning continents, taken while it is being written to. Atomic schema changes across thousands of servers, scheduled for a future timestamp — which, as the paper notes drily, *would be a meaningless sentence without TrueTime.*',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'The clock that tells you how wrong it is',
      accent: 'denim',
      rung: 'Rung 3 · The mechanism',
      body: [
        'Three calls, and one of them is the paper. `TT.now()` returns an interval. `TT.after(t)` says whether `t` has definitely passed. `TT.before(t)` says whether it definitely has not. There is no call that returns the time, because there is no such thing to return.',
        'Underneath: **time masters in every datacenter**, most with GPS receivers on separated antennas, the rest — called Armageddon masters, which tells you what they are for — with atomic clocks. Two kinds on purpose, because the failure modes do not overlap: GPS fails through antenna faults, radio interference, spoofing and leap-second bugs; atomic clocks fail by drifting. Masters compare themselves against each other continuously and **evict themselves** when they disagree. Every machine runs a daemon that polls several masters, applies a variant of Marzullo’s algorithm to throw out the liars, and gets thrown out itself if its own crystal drifts too far.',
        'The measured result is the figure below. Between polls the daemon widens ε at a deliberately conservative **200 microseconds per second** of assumed drift, so ε sawtooths from about **1 ms just after a poll to about 7 ms just before the next**, thirty seconds later — averaging near **4 ms**. Roughly 6 of those milliseconds are the drift ramp and 1 is the network round trip to the masters.',
        'And a line worth keeping, on whether any of this can be trusted: the paper reports that in Google’s fleet, **bad CPUs are about six times more likely than bad clocks.** Which is an unusually good argument. You already trust the arithmetic.',
      ],
      diagram: <TrueTimeDiagram />,
    },
    {
      n: 'Step 04',
      title: 'The step where nothing happens',
      accent: 'denim',
      rung: 'Rung 4 · The reveal',
      span: 2,
      body: [
        'Watch step 5. Every other trace in this book animates something moving; this one animates a leader sitting still with the locks held and the answer already decided, refusing to tell anyone. That stillness is the paper.',
        'And watch step 7, which is the invoice being cashed: a reader on the far continent goes to a local replica, takes nothing, blocks nobody, and gets an answer that is consistent with a transaction that committed on the other side of an ocean.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={spannerTrace} />
        </div>
      ),
      think: {
        q: 'Commit wait makes a transaction slower. How can deliberately delaying T1 possibly change anything about T2, which has not started and does not know T1 exists?',
        a: 'Because the guarantee is about **what can be observed**, not about what is true internally. The chain is three lines long. **(1)** T1 chose `s = TT.now().latest`, so `s` is at or after the real instant it was chosen. **(2)** T1 waited for `TT.after(s)`, so by the time any human, client or replica can possibly learn that T1 committed, real time has passed `s`. **(3)** T2 begins after that observation, and its own stamp is at least `TT.now().latest` computed at its start — which is at or after a real time already later than `s`. Therefore `s1 < s2`, and no coordination between them was needed. The delay is not doing work; **it is closing the window in which somebody could see a write whose timestamp had not yet come true.** This is the general shape worth taking away: when you cannot make two machines agree on a fact, you can sometimes make one of them wait long enough that disagreement stops being observable. The price is always latency, and the good version of the trick is the one where you can put a number on it.',
      },
    },
    {
      n: 'Step 05',
      title: 'What it costs, measured twice',
      rung: 'Rung 5 · The measurement',
      body: [
        'The microbenchmark first, because it isolates commit wait. A write on a single replica with commit wait **disabled** takes 9.4 ms; with it enabled, 14.4 ms. **So commit wait is about 5 ms**, and Paxos is about 9. Add replicas and write latency barely moves — 13.9 ms at three, 14.4 at five — because Paxos runs in parallel and a bigger quorum is *less* sensitive to one slow replica, not more.',
        'The read side is the whole argument in one row of a table. At five replicas: writes 14.4 ms and **2,800 a second**; read-only transactions 1.4 ms and **25,300 a second**; snapshot reads 1.3 ms and **50,000 a second**. Snapshot read throughput scales nearly linearly with replicas because those reads can be served by any of them. *Writes bought the guarantee; reads spend it.*',
        'Two-phase commit scales further than the folklore says: **17 ms mean at one participant, 42.7 ms at fifty, and 71.4 ms at a hundred**, with the 99th percentile flat around 100 ms up to that point. It falls apart at 200 participants (150 ms mean, 320 ms at p99). So the honest summary is that distributed commit across dozens of shards is fine and across hundreds is not.',
        'Then production, which is always less flattering. Measured from the ad-serving frontend over 24 hours: reads averaged **8.7 ms across 21.5 billion of them**, single-shard commits **72.3 ms**, and multi-shard commits **103 ms**. That is five to seven times the microbenchmark, and the paper says where it went — lock conflicts giving writes a fat tail, and a read standard deviation of **376 ms** that dwarfs the mean. **The clean number is 14 ms. The number your users feel is 100.**',
        'And the availability result is the one to remember for an architecture review. Five zones, a quarter of a million reads a second, then kill a whole zone. Kill a non-leader zone: **no effect at all.** Kill the leader zone *with* warning, so leadership hands off first: **a 3–4% dip you cannot see on the graph.** Kill it with no warning: **throughput goes to roughly zero and takes about ten seconds to come back**, which is exactly the Paxos leader lease length, because that is how long the dead leaders’ leases take to expire.',
      ],
      diagram: <CommitWaitDiagram />,
      deeper: {
        summary: 'Why a leader lease is a lower bound on your worst-case failover, and why shortening it is not free',
        body: [
          'Spanner’s Paxos leaders hold **time-based leases, ten seconds by default**, and the system depends on an invariant that two leaders’ lease intervals never overlap. That invariant is what allows a leader to assign timestamps within its lease and know no other leader is assigning any.',
          'The consequence is arithmetic: if a leader dies without warning, nothing can safely elect a replacement until its lease has certainly expired. Leases across many groups are staggered, so the recovery curve is a ramp rather than a cliff — but the tail of it is the full lease length. **The measured ten-second recovery is not a bug or a tuning failure. It is the lease, being honoured.**',
          'The obvious fix is a shorter lease, and it is not free: shorter leases mean lease-renewal traffic on every group all the time, which is a constant cost paid to improve a rare case. The paper says outright that they were building the better answer — have the replicas *release* their lease votes when they detect the leader has failed, so the common case does not have to wait out a timeout it can prove is unnecessary. **This is the same shape as every failure-detection question since Chapter 5: you can wait out a timeout, or you can get told, and getting told is always more machinery.**',
        ],
      },
    },
    {
      n: 'Step 06',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 6 · What global consistency costs',
      body: [
        '**Every write pays for the uncertainty, whether or not it needed to.** Commit wait is charged on all read-write transactions, including ones entirely inside a single datacenter where no cross-continental ordering question could possibly arise. It is a flat tax, roughly 2ε, and the only way to reduce it is to make the clocks better. The paper says as much: with replicas close together, **ε may noticeably affect performance**, and the plan is to shrink ε rather than to skip the wait.',
        '**ε is not constant, and its spikes are somebody else’s problem.** It is a sawtooth in normal operation, but it jumps when time masters are unreachable — the paper reports an hour-long, **datacenter-wide** increase caused by taking two time masters down for routine maintenance. Overloaded machines and congested links cause local spikes. **Your commit latency now has a dependency on the health of the time infrastructure**, which is a sentence no other database has to write.',
        '**And this is genuinely infrastructure you must have.** GPS antennas on the roof, atomic clocks in the rack, a time-master fleet per datacenter, and a daemon on every machine that is allowed to evict the machine it runs on. The paper is right that an atomic clock is not expensive by datacenter standards — but the operational surface is real, and it is the reason this design was reproducible by roughly nobody for years afterwards.',
        '**Two-phase commit is still two-phase commit.** Spanner’s answer to the standard objection is not that it made 2PC cheap; it is that **running it over Paxos removes the availability half of the objection** — a coordinator that dies is replaced, because the coordinator is a replicated group rather than a machine. The latency half stands, and it is on the graph: a hundred participants triple your commit latency, and two hundred is off the map.',
        '**The tail is where it lives.** A read mean of 8.7 ms with a standard deviation of 376 ms is not a distribution, it is a warning. Lock conflicts under two-phase locking are the fat tail on writes, and long-running transactions holding locks across a wide area is exactly the workload this concurrency control was chosen for. **You get strong guarantees and a wide latency spread**, and the second one is what capacity planning has to be done against.',
      ],
      callout: {
        kind: 'bad',
        big: 'YOU CANNOT SKIP THE WAIT',
        text: 'Commit wait is not an optimisation you can turn off for local transactions — it is where the guarantee comes from. The only lever is ε, which means the only lever is hardware.',
      },
    },
    {
      n: 'Step 07',
      title: 'What it begat — and where it stands in 2026',
      rung: 'Rung 7 · Descendants',
      body: [
        '**It ended a fifteen-year argument, and it ended it awkwardly.** Act II’s premise was that global strong consistency was unaffordable, and enough people rounded that off to *impossible* that CAP became a slogan. Spanner is a working counterexample with published latencies, and the honest reading is narrower than either camp wanted: strong consistency across continents is **buyable**, the price is a few milliseconds per write plus a time infrastructure, and whether that is a good trade depends on your workload rather than on a theorem.',
        '**The clones split into two families.** CockroachDB reproduces the architecture without the hardware, using a hybrid logical clock and a bounded uncertainty interval — and, because it cannot wait out an ε it does not trust, it **restarts transactions that land in the uncertainty window** instead. YugabyteDB does something similar. *The trade is visible and instructive: no atomic clocks, and occasional retries that surprise the application.* Meanwhile the managed cloud databases — Cloud Spanner itself, and AWS’s time-sync service exposing a bounded clock error — sell you the hardware answer by the hour.',
        '**And the sharpest legacy is a habit of mind.** Before this paper, a clock API returned a number. After it, the interesting question in a distributed system became *how wrong could this be, and can the system be told?* The pattern shows up well outside databases now: bounded staleness in caches, uncertainty windows in event processing, and every design review where somebody asks what happens if two nodes disagree about the time by 200 milliseconds.',
        '**2026 status: TrueTime is a product feature and commit wait is a line item.** Cloud Spanner runs multi-region configurations with published latency envelopes; the distributed-SQL market it created is crowded. What has *not* changed is the shape of the trade. **Externally consistent writes cost a wait proportional to how badly you know the time**, and every system in this family is either paying that wait, retrying instead of paying it, or quietly not offering the guarantee.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'External consistency.',
      body: 'If one transaction finishes before another starts in real time, its timestamp is smaller. The same property as linearizability, applied to whole transactions.',
    },
    {
      term: 'TrueTime.',
      body: 'A clock API returning an interval guaranteed to contain the true instant. Half the width is ε — in production about 4 ms on average.',
    },
    {
      term: 'Commit wait.',
      body: 'Holding a committed transaction’s locks, and telling nobody, until its timestamp is certainly in the past. About 2ε, and the source of the guarantee.',
    },
    {
      term: 'Safe time.',
      body: 'The newest timestamp at which a replica is known to be complete. A read at or below it can be served locally; above it, the replica has to catch up first.',
    },
    {
      term: 'Directory.',
      body: 'A set of rows sharing a key prefix — the unit of placement and of movement between groups. Applications control locality by choosing keys.',
    },
    {
      term: 'Leader lease.',
      body: 'A time-bounded grant of Paxos leadership, ten seconds by default. Leases never overlap, which is why an unwarned leader failure costs about that long.',
    },
  ],
  inTheWild: {
    note: '5 ways this bites in production',
    points: [
      '**Commit latency has a hardware dependency nobody expects.** ε widens when time masters are unreachable, and the paper documents a datacenter-wide hour of it caused by routine maintenance on two machines. The symptom is every write in a region getting slower with no change to the database, the network, or the query plan.',
      '**Hot rows serialise everything, exactly as in any locking database.** Two-phase locking was chosen deliberately for long transactions, and the cost is a fat write tail under conflict — the paper’s own production numbers show it. Global distribution does not soften this; it lengthens the window during which the lock is held.',
      '**Wide transactions look fine until they are not.** Commit latency is flat-ish to fifty participants, then climbs, then falls apart around two hundred. Teams discover this by adding a secondary index that fans a write across far more shards than they intended.',
      '**An unwarned leader-zone failure costs a full lease.** Draining a zone politely costs a few percent; losing it abruptly costs roughly ten seconds of near-zero throughput on the affected groups. Failover drills that always drain gracefully never measure the number that matters.',
      '**And the read tail is wide even when everything is healthy.** A mean of 8.7 ms with a standard deviation of 376 ms means the average tells you almost nothing. Alert on percentiles, or you will be paged by an average that has not moved while a fraction of users wait a second.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Expose the uncertainty',
        when: 'you are building any API over a quantity you cannot measure exactly — time, position, a replica’s lag, a queue’s depth. Returning a bound instead of a point estimate lets the caller be correct; returning a number forces them to guess and be wrong silently.',
      },
      {
        choose: 'Wait instead of coordinating',
        when: 'a round of agreement would cost more than the uncertainty you are trying to eliminate. Commit wait is cheaper than asking anybody anything — **but only because ε is small and bounded**, and a wait against an unbounded uncertainty is just a hang.',
      },
      {
        choose: 'Pay on the write path',
        when: 'reads dominate. The whole design puts the cost where the traffic is not, so that reads can be lock-free, local, and served at any timestamp. Check the ratio before copying the pattern; on a write-heavy workload the arithmetic reverses.',
      },
      {
        choose: 'Take the weaker guarantee deliberately',
        when: 'nothing in your product can tell the difference between externally consistent and merely serializable. This is a real cost with a real number, and paying it out of habit — or because a vendor page made it sound free — is how a database ends up slower than it needed to be.',
      },
    ],
  },
  misconception: {
    think: '“Spanner works because Google has atomic clocks.”',
    actually:
      'The atomic clocks are the cheap part of the idea, and they are not even the interesting part. **What Spanner has is a clock API that refuses to return a number.** `TT.now()` gives back an interval and an absolute promise that the true instant is inside it — so the database can *reason about* its own uncertainty rather than pretending it away like every other system. That change is free. What the hardware buys is a **narrow** interval: GPS receivers and atomic clocks are what keep ε down to a few milliseconds, and the reason narrowness matters is that the algorithm on top is to **sit still for the width of the interval before revealing a commit.** Widen ε to a second and the design is unchanged and the database is unusable. And you can see the shape of the trade in the systems that copied it without the hardware: CockroachDB and YugabyteDB keep an uncertainty interval and, rather than waiting it out, **restart transactions that land inside it** — the same physics, a different place to pay. So the sentence to carry away is not that Google bought better clocks. It is that **an honest error bar turns an unobservable global order into a bounded latency**, and once it is a latency, it is just a cost.',
  },
  sources: [
    {
      year: '2012',
      title: 'Spanner: Google’s Globally-Distributed Database — Corbett et al. (OSDI)',
      url: 'https://www.usenix.org/system/files/conference/osdi12/osdi12-final-16.pdf',
      note: 'Read **§3 and §4.1.2 together** and stop there if you read nothing else — three API calls, then a five-line proof that commit wait gives external consistency. It is the shortest path from an idea to its justification in this book. **§5.3** is the measured ε, and **§5.4** is the F1 case study, which is the most candid account of migrating a revenue-critical database that Google has published.',
    },
    {
      year: '2013',
      title: 'F1: A Distributed SQL Database That Scales — Shute et al. (VLDB)',
      url: 'https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/41344.pdf',
      note: 'The customer’s side of the story, written a year later. Worth it for the detail Spanner’s §5.4 only gestures at: what it actually took to move the advertising backend off a hand-sharded MySQL whose last reshard took two years, and which parts of SQL had to be rethought when a join might cross a continent.',
    },
    {
      year: '2017',
      title: 'Spanner, TrueTime and the CAP Theorem — Eric Brewer (Google)',
      url: 'https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/45855.pdf',
      note: 'The author of CAP, on the system most often cited as breaking it. His answer is precise and worth the twenty minutes: Spanner is a CP system that chooses consistency during a partition, and its availability in practice comes from Google owning the network well enough that the partitions CAP is about are rare. Read it directly after the CAP interlude.',
    },
    {
      year: '2011',
      title: 'Megastore: Providing Scalable, Highly Available Storage for Interactive Services — Baker et al. (CIDR)',
      url: 'https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/36971.pdf',
      note: 'The system Spanner was built to replace, and the reason its data model is semi-relational rather than key-value: 300+ teams had chosen Megastore despite throughput that collapsed at a few writes per second per group, purely because the schema was easier to live with. A useful reminder that the winning design is often the one people can stand to use.',
    },
  ],
  seenIn: [
    { label: 'What “Before” Even Means — Ch 7', to: '/papers/lamport', live: true },
    { label: 'Consensus, Twice Told — Ch 8', to: '/papers/consensus', live: true },
    { label: 'Transactions, Hand-Rolled — Ch 10', to: '/papers/percolator', live: true },
    { label: 'Interlude: CAP', to: '/papers/cap', live: true },
  ],
  finale: {
    title: 'Act IV closes: both promises bought back, at very different prices',
    body: 'Two chapters, one demand, two currencies. Chapter 10 paid in software — a library, locks parked beside the data, a commit point hidden in one row, and cleanup left to strangers — and it worked because a web index will wait. This one paid in hardware and in patience, buying an honest error bar on the clock and then sitting still for its width on every write. What both of them really did was fix the order in which writes are allowed to have happened, and then defend that order with everything they had. Next: an act that stops treating the order as machinery in the basement. The log has been inside every system in this book, quietly, doing the actual work. What happens if you promote it — if the table, the cache and the index become readers of one sequence, each behind by a different amount?',
  },
  next: { title: 'The Most Common Derived Copy', slug: 'memcache' },
}
