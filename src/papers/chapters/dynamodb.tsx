import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { RetreatDiagram, ThroughputDilutionDiagram, MetadataLoadDiagram } from '../diagrams'
import { dynamodbTrace } from './dynamodb-trace'

/* The epilogue. Chapter 5's closing step already says the argument ended in a
   draw, so this chapter cannot just be "and here is the retreat" — that is a
   paragraph, and it has been written.

   What makes it a chapter is what the 2022 paper spends its pages on. Read it
   cold and the surprise is not the leader. It is that consistency takes about
   half a page and never comes back, while admission control, hot keys, silent
   corruption, gray failures, cache bimodality and how to roll a deployment
   back take the rest. Fifteen years of operating the thing, and the pressures
   that dominated were not the ones the field spent those years arguing about.
   That is the epilogue's actual payload, and every step should serve it. */

export const dynamodb: Chapter = {
  slug: 'dynamodb',
  act: 'Epilogue',
  paperNo: 'Paper 17 · fifteen years later',
  title: 'The Retreat',
  dek: 'The same building, the same name, and almost none of the same architecture. What Amazon walked back after a decade of running it — and the thing that turned out to matter more than any of it.',
  minutes: 18,
  paper: {
    title: 'Amazon DynamoDB: A Scalable, Predictably Performant, and Fully Managed NoSQL Database Service',
    authors: 'Mostafa Elhemali, Niall Gallagher, Nicholas Gordon, Joseph Idziorek, Richard Krog, Colin Lazier, Erben Mo, Akhilesh Mritunjai, Somu Perianayagam, Tim Rath, Swami Sivasubramanian, James Christopher Sorenson III, Sroaj Sosothikul, Doug Terry, Akshat Vig',
    venue: 'USENIX ATC',
    year: '2022',
    url: 'https://www.usenix.org/system/files/atc22-elhemali.pdf',
  },
  caption:
    'Chapter 5 opened with a shopping cart that was not allowed to refuse a write, and Amazon paid an enormous price to keep that promise: no leader, sloppy quorums, and versions the application had to reconcile itself. Fifteen years later the same company published a paper about the system that carries the name, and it runs an elected leader per partition, refuses writes when the quorum is gone, and will sell you a strongly consistent read. **Nobody published a retraction.** But before you read this as a defeat, notice where the retreat actually started — and it was not in an argument about consistency. It was that Amazon’s own engineers stopped choosing Dynamo.',
  steps: [
    {
      n: 'Step 01',
      title: 'The system that lost to a worse one',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'Here is the sentence in the history section that reframes everything after it. Amazon launched other data services in the years after Dynamo — S3 and SimpleDB — that were **managed and elastic**, and Amazon engineers began preferring those *“even though the functionality of Dynamo was often better aligned with their applications’ needs.”* The better-fitting database lost. It lost to services that fitted worse and that nobody had to operate.',
        'Dynamo was **single-tenant**. Every team that wanted one ran its own installation, which meant every team had to grow experts in gossip, quorums, anti-entropy and ring topology — and the paper is blunt that this operational complexity *“became a barrier to adoption.”* Chapter 5 measured the price of availability in siblings and merge functions, and that accounting was right as far as it went. It just left out the largest line item, which was people.',
        'SimpleDB, the fully managed alternative, had its own problems that are worth knowing because DynamoDB was built to fix exactly them. Tables were capped at **10 GB** and at a modest request rate, so customers split their data across several tables by hand. And because *every attribute was indexed*, every write updated every index, which made latency unpredictable in a way nobody could plan around. **Two ways of making the customer do the database’s job**, and both had to go.',
        'So the goal was stated as a combination rather than an improvement: the incremental scalability and predictable performance of Dynamo, plus the administration model of a cloud service and a richer data model than a pure key-value store. That is the brief. Read the rest of this chapter as the answer to it, and hold one number in your head as the scale it now runs at — during the 66-hour Prime Day of 2021, Amazon’s own systems peaked at **89.2 million requests per second** against it.',
      ],
      diagram: <RetreatDiagram />,
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'This one is different from every other chapter in the book. You are not starting from a blank page — you are starting from a system that works, a paper the industry has been citing for a decade, and ten years of tickets. Three questions. The first is the famous retreat, and it is the easiest of the three. The other two are what the paper actually spends its length on.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**What you have:** the 2007 design. A leaderless ring, sloppy quorums, hinted handoff, vector clocks, and conflicting versions handed back to the application to merge.',
              '**What happened:** teams had to become experts to run it, and started choosing a managed service that fitted their needs worse.',
              '**Who it is for now:** hundreds of thousands of customers, most of whom will never read a manual — and tables from unrelated companies sitting on the same physical machines.',
              '**What you are promising:** single-digit millisecond latency, and *the same* latency whether the table holds ten megabytes or a hundred terabytes.',
              '**What the customer configures:** nothing. No node count, no repair schedule, no cluster. They pick a key and a throughput number.',
            ],
            questions: [
              {
                q: 'Dynamo has no leader, on purpose — that is the whole argument of the 2007 paper. Now you must offer a strongly consistent read to anyone who asks for one. What happens to the leader?',
                options: [
                  {
                    label: 'Elect one per partition, with Paxos and a lease — it takes the writes and the consistent reads',
                    verdict: 'move',
                    why: 'This is the retreat, and it is worth being exact about the trade. What it buys is a single place where the order of writes is settled, which is what turns a strongly consistent read into a read rather than a negotiation — and it removes siblings from the customer’s life entirely. What it costs is the property Chapter 5 was built for: a write now needs a live leader and a quorum, so a partition can genuinely be unavailable for writes in a way the ring could not be. **The thing that makes that survivable is not the leader, it is the size of the unit.** A Region runs millions of these groups, so losing one is a partial outage rather than an outage. *The 2007 design made every key equally available; this one makes availability granular.*',
                  },
                  {
                    label: 'Stay leaderless and get consistency from the quorum arithmetic instead',
                    verdict: 'dead',
                    why: 'The inequality only holds when the readers and the writers are drawing from the *same* set of nodes — and Chapter 5’s sloppy quorum deliberately breaks that, by writing to whichever nodes are healthy rather than whichever nodes own the key. That is precisely what kept it available, and precisely what makes the arithmetic a heuristic. You would also still be handing siblings back to the caller, which is the part customers most wanted to stop doing.',
                  },
                  {
                    label: 'Stay leaderless, but resolve conflicts on the server with last-write-wins',
                    verdict: 'dead',
                    why: 'A real option, widely shipped, and it is a data-loss policy with a friendly name: the losing write is simply gone, and which one loses depends on clocks you do not control. For a managed service it is worse than that. It converts a **visible** problem — siblings you are forced to merge — into an **invisible** one, and invisible problems are the kind a support organisation cannot survive, because the first person to notice is the customer and the evidence is already deleted.',
                  },
                  {
                    label: 'One leader for the whole table, elected the same way',
                    verdict: 'dead',
                    why: 'You have rebuilt Act I’s master and inherited every ceiling that came with it — one machine’s worth of writes, and one machine’s worth of blast radius. The unit that gets a leader has to be small enough that there are millions of them in a Region and small enough to move, split and repair without anybody noticing. **Granularity is the load-bearing decision here, not the election.**',
                  },
                ],
              },
              {
                q: 'A customer provisions throughput for a table; you divide it among the table’s partitions. Their traffic is skewed to a handful of keys, so they are being throttled while the table as a whole sits half idle. Fix it.',
                options: [
                  {
                    label: 'Take admission control off the partition: count the table’s consumption centrally, let partitions always burst, split by the traffic you observe',
                    verdict: 'move',
                    why: 'Three moves that only work together. **Global admission control** hands each request router a bucket of short-lived tokens and refills it every few seconds from a service that tracks the whole table, so the budget belongs to the table rather than to a partition. **Always-burst** then requires the fleet to be rebalanced by measured consumption rather than by allocation, because a node is now packed with more capacity than it strictly owns. And **splitting for consumption** picks the split point from the key distribution the partition has actually seen, not the middle of the range — which matters, because the middle of a skewed range splits nothing useful. Splits land in minutes. The partition-level bucket stays as defence in depth, so one tenant still cannot eat a whole storage node.',
                  },
                  {
                    label: 'Tell them to choose a better partition key',
                    verdict: 'dead',
                    why: 'Correct, useless, and the answer the industry gave for a decade. Access skew is a property of the customer’s users, not of their schema — a celebrity has more followers, a new product gets more views, and no key design makes that untrue. And it does not even address the second failure, which involves no bad key at all: when a partition is split **for size**, its throughput allocation is divided between the children, so a table that is merely growing gets weaker per partition without anyone touching it.',
                  },
                  {
                    label: 'Let a hot partition borrow the unused capacity of its neighbours on the same node',
                    verdict: 'dead',
                    why: 'This shipped, it is called bursting, and it is kept — but it is not the answer. It absorbs **short** spikes, holding a partition’s unused capacity for later use for up to about 300 seconds, and it works only if the node happens to have spare room. That makes a customer’s success dependent on the traffic patterns of strangers who share their hardware, which is not a property you can put in a service description.',
                  },
                  {
                    label: 'Watch for throttling and raise the allocation of any partition that is suffering',
                    verdict: 'dead',
                    why: 'This shipped too, as adaptive capacity, and it eliminated over **99.99 percent** of the throttling caused by skewed access — a genuinely good mechanism, also kept. Its flaw is in the word *watch*: it is **reactive**, so it begins helping after the customer has already been throttled, and a throttled request is experienced as unavailability regardless of what the dashboard says afterwards. *Being right eventually is not the same as being right, when the thing you are measuring is what the application saw.*',
                  },
                ],
              },
              {
                q: 'Every request must know which storage node owns the key, so routers cache the table’s routing information. The cache hit rate is 99.75 percent. What is wrong with that?',
                options: [
                  {
                    label: 'On a cache hit, still call the metadata store asynchronously — so its load is the same whether the cache works or not',
                    verdict: 'move',
                    why: 'This looks like throwing away the entire benefit of the cache, and it is the most transferable idea in the paper. The cache keeps doing the job you wanted — latency — and stops doing the job it was doing accidentally, which is **hiding how much work the system would need if it were not there.** Load on the metadata tier becomes flat, high and knowable; a cold start changes nothing, because there is no spike left to absorb. It is not free: they pay for it with a permanently larger metadata fleet, which is why they rebuilt it as an in-memory store sized for the full request rate. *You are buying the removal of a cliff, and the price is a bill you pay every second.*',
                  },
                  {
                    label: 'Nothing — 99.75 percent is an excellent hit rate',
                    verdict: 'dead',
                    why: 'It is excellent, and that is the problem. A hit rate that high means the store behind it is provisioned for a quarter of a percent of the request rate, so the system only works while the cache works. Bring up a fresh fleet of routers with empty caches and metadata traffic has been observed **spiking to 75 percent** — from a quarter of a percent. **An ineffective cache does not degrade, it collapses the thing behind it**, and that failure has a name and a published postmortem.',
                  },
                  {
                    label: 'Give routers a bigger cache and pre-warm it before they take traffic',
                    verdict: 'dead',
                    why: 'Both raise the hit rate, and raising the hit rate raises the stakes — the fallback path is now exercised even more rarely and provisioned even more thinly, which is how a path becomes untested. Pre-warming also has to succeed at the exact moment you are adding capacity, which is usually the moment you are already in trouble. **The failure you are engineering away is not “the cache is too small.” It is “the cache stopped being useful all at once,”** and no amount of warming touches that.',
                  },
                  {
                    label: 'Keep the cache, and on a miss retry the metadata store with exponential backoff',
                    verdict: 'dead',
                    why: 'Backoff manages a stampede once it has started; it does not prevent one, and this particular stampede is every request in flight discovering it needs the same service at the same moment. Retries add load to a tier that is already saturated, which lengthens the outage rather than shortening it. Backoff is necessary and it is not a plan — the plan has to be that the load does not change when the cache does.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived DynamoDB 2022 — and, more usefully, you found out what the paper is about',
              body: [
                '**The architecture, stated plainly.** A table is split into partitions; each partition is a replication group of three replicas in three Availability Zones; the group elects a leader by Multi-Paxos and the leader holds a lease. Writes and strongly consistent reads go to the leader; eventually consistent reads go to anybody. A sick replica is patched over in seconds with a **log replica** that holds only recent log entries. Admission control lives above the partition, not in it. Metadata lives in memory and is deliberately over-served. *Of the 2007 design, what survives is that the partition key is hashed — and even that now feeds ranges that split when they get hot.*',
                '**The retreat is not a defeat, and the framing matters.** Dynamo answered *“how do we stay writable while a datacenter is on fire?”* and answered it well. DynamoDB answers *“how do we run this for hundreds of thousands of strangers who will never read a manual?”* Those questions have different answers and the second one is not less interesting. The evidence that it was the real question was already there in 2010: Amazon’s own engineers chose the managed service over the better-fitting one.',
                '**And here is what to take from a paper written fifteen years after the argument.** Look at what it spends its pages on. Consistency gets about half a page and never comes back. The rest is admission control, hot keys, silent corruption, gray failures, cache bimodality and how to roll a deployment back safely. **The arguments the field was having were not the arguments the operators were having** — and this book has now spent sixteen chapters on the first kind, which is exactly why the seventeenth is about the second.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'One write, and everything that watches it',
      accent: 'denim',
      rung: 'Rung 3 · The reveal',
      span: 2,
      body: [
        'Hold Chapter 5’s picture next to this one. There, a write went to whichever node picked it up and the reader was left holding the reconciliation. Here it is metered before it is stored, ordered by an elected leader, acknowledged by two replicas in two buildings, and then checked against a copy of itself for as long as the table exists.',
        'Step 4 is the repair trick worth stealing, step 5 is the failure mode that is worse than a dead machine, and step 7 is the sentence the authors say they would keep above all the others.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={dynamodbTrace} />
        </div>
      ),
      think: {
        q: 'Spanner, in Chapter 11, also runs Paxos groups with leaders and leases. Is this the same system with a different data model?',
        a: '**No, and the difference is which promise each one refuses to give up.** Spanner spends real hardware — GPS receivers, atomic clocks, and a commit wait that deliberately does nothing for a few milliseconds — to buy a single global property: any transaction, anywhere, can be placed on one timeline that every replica agrees with. That is what makes a consistent read across the whole database at a timestamp possible, and it is why Spanner can offer transactions that span arbitrary rows on other continents. DynamoDB does not try. Its unit of agreement is **one partition**, and its promise is about the *shape of the latency curve* rather than the shape of the data: single-digit milliseconds for a key-value operation, unchanged whether the table is ten megabytes or a hundred terabytes, whether it is Tuesday or Prime Day. Everything follows from which promise came first. Spanner is willing to make a write wait out clock uncertainty; DynamoDB is not willing to make a write wait for anything it cannot bound. Spanner will let you write a transaction whose cost you cannot see; DynamoDB gives you an API of four operations whose cost you can, and prices each one. *One system chose a guarantee and engineered the latency around it; the other chose a latency and engineered the guarantees around that.* Which is the right choice depends entirely on whether the thing you cannot afford to lose is the invariant or the response time — and the reason both papers are in this book is that most engineers have only ever been taught to ask the first question.',
      },
    },
    {
      n: 'Step 04',
      title: 'The bug that was in the pricing model',
      rung: 'Rung 4 · The measurement',
      body: [
        'Read this arithmetic slowly, because it is the clearest example in the book of a design being correct and still wrong. A single partition tops out at around **1,000 write units**. Provision a table at 3,200 and it becomes four partitions of 800 each. Raise the table to 3,600 and each partition rises to 900. Raise it to 6,000 and the table is split into eight partitions of **750 each** — *and every partition can now absorb less traffic than it could before you paid more.*',
        'That is **throughput dilution**, and it needs no hot key and no mistake by anyone. The other failure does involve skew and is worse: split a partition **for size**, and its throughput allocation is divided evenly between the children, on the assumption that traffic divides evenly too. It does not. **The hot half of a partition ends up with less capacity than it had before the split** — the system responded to growth by making the busy part weaker.',
        'Both surfaced to the customer as the same thing: rejected reads and writes, called throttling, *while the table’s own provisioned total was more than sufficient*. And the customer’s only lever was to raise the table’s throughput and deliberately not use most of it. The paper is candid about how that felt: it was a poor experience, and there was no good way to estimate the right number. **An over-provisioned table is a bug report written in money.**',
        'The fix took three tries, which is the useful part. Bursting handled short spikes and depended on the node having room. Adaptive capacity handled long ones and eliminated over **99.99 percent** of skew-driven throttling — reactively, after the customer had already been hurt. Only the third attempt questioned the premise: **stop allocating throughput to partitions at all.** Count consumption for the table centrally, vend short-lived tokens to the request routers, let every partition burst always, and split on the key distribution actually observed. *The first two fixes made the mechanism better. The third deleted it.*',
      ],
      code: {
        file: 'what_the_customer_saw.log',
        lines: [
          { t: 'table: orders   6000 WCU provisioned   8 partitions' },
          { t: '' },
          { t: '10:04:12  PutItem  pk=order#2291  ok' },
          { t: '10:04:12  PutItem  pk=order#8812  ok' },
          { t: '10:04:12  PutItem  pk=order#8812  ProvisionedThroughputExceeded', hl: 'bad' },
          { t: '10:04:12  PutItem  pk=order#8812  ProvisionedThroughputExceeded', hl: 'bad' },
          { t: '10:04:13  PutItem  pk=order#0117  ok' },
          { t: '' },
          { t: '# consumed this second: 2,140 of 6,000 WCU' },
          { t: '# the table was two-thirds idle while the writes were refused' },
        ],
      },
      diagram: <ThroughputDilutionDiagram />,
      deeper: {
        summary: 'Why the abstraction leaked, and what that costs a managed service',
        body: [
          'Partitions were an **internal** abstraction. Customers were never meant to know how many they had, and the API gives them no way to find out. But the throughput they could actually use was governed by partition boundaries, so an invisible implementation detail became the thing that determined whether their application worked — and they could neither see it, nor influence it, nor be told about it without breaking the promise that it did not exist.',
          'That is the specific tax a managed service pays. In a system you run yourself, a leaking abstraction is annoying and diagnosable: you read the source, you find the ceiling, you work around it. In a system somebody else runs, the same leak arrives as *unexplained* failure, and the vendor cannot explain it without exposing the mechanism they promised to hide. **The only clean exit is to remove the leak**, which is what global admission control did — not by documenting partitions but by making them stop governing.',
          'It is the same shape as Chapter 16’s argument about knobs from the other end. There, removing a knob meant the system had to make a decision well enough that nobody missed it. Here, hiding a mechanism means the mechanism has to stop having customer-visible edges. *Both are the same bill: the less you ask of the user, the more of their problem becomes yours, and there is no version where the difficulty simply disappears.*',
        ],
      },
    },
    {
      n: 'Step 05',
      title: 'Predictable beats efficient',
      rung: 'Rung 5 · The design stance',
      body: [
        'The lessons section names four things, and the fourth is the one to write down: **design for predictability over absolute efficiency.** Their gloss on it is sharper than the slogan — while components such as caches improve performance, *do not allow them to hide the work that would be performed in their absence*, so the system stays provisioned for the unexpected.',
        'The routing cache is the worked example. Routers cached a table’s partition map and hit about **99.75 percent** of the time, which meant the metadata service was sized for the remaining quarter of a percent. Then you add capacity: a batch of new routers arrives with empty caches, and metadata traffic has been seen **spiking to 75 percent** of the full request rate. The redesign is deliberately wasteful. A cache **hit** also fires an asynchronous refresh, so the metadata fleet sees constant traffic no matter what the hit rate is doing. They paid for that with a metadata store rebuilt to hold everything in memory and scaled to the entire incoming request rate of DynamoDB. *The efficient design has a cliff in it. The predictable one has a bill in it.*',
        'The same instinct shows up in how they check the data. Every log entry, message and log file carries a checksum, so corruption cannot cross a network hop unnoticed. Beyond that, the **scrub** process continuously verifies not only that all three replicas agree, but that the live data matches a replica *rebuilt offline from the archived log, starting at the table’s inception*. That is enormously more expensive than comparing replicas to each other, and it is the only version that catches a bug which wrote the same wrong bytes to all three. Their conclusion after a decade: continuous verification of data at rest is **the most reliable method** they have found — against hardware failures, silent corruption, *and their own software.*',
        'And it shows up in how they deploy. The replication protocol is specified in **TLA+** and model-checked whenever a feature touches it, which they credit for giving them the confidence to introduce log replicas at all. Deployments go to a few nodes first, with automatic rollback on alarm thresholds. Protocol changes ship as **read-write deployments** — first teach every node to *understand* the new message, only then start *sending* it — so old and new code coexist safely and a rollback is not a new, untested state. And they roll back on purpose in testing, because the rollback path is the one nobody exercises until the worst night of the year.',
      ],
      diagram: <MetadataLoadDiagram />,
    },
    {
      n: 'Step 06',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 6 · What the retreat costs',
      body: [
        '**A partition can be unavailable, and Chapter 5’s could not.** Writes need a live leader and a quorum of two replicas in different zones. Lose the quorum and that slice of the table stops accepting writes — a thing the 2007 ring was specifically built never to do. The service is designed for **99.99 percent** availability for Regional tables and **99.999 percent** for global ones, measured as the share of requests that succeed in each five-minute window, which is an honest way to state it and is not the same as a promise that no request fails.',
        '**A leader change costs a couple of seconds, even when it is unnecessary.** A newly elected leader must wait out the old leader’s lease before serving anything. That is fine when the old leader is genuinely dead and a pure loss when it was a gray failure — which is why the peer-consultation fix exists, and why it is worth remembering that the failure detector is now a small distributed protocol of its own with its own failure modes.',
        '**Some hot keys cannot be split at all.** Splitting for consumption works by dividing a key range, so a partition receiving heavy traffic to a *single item* has nothing to divide. The paper says outright that such workloads cannot benefit, and that the system detects them and does not try. **The most extreme skew is precisely the case the mechanism cannot help**, and the application still has to solve it — with a cache, or by spreading the value across keys itself.',
        '**Sequential access defeats it too.** A partition whose key range is being walked in order has no stable hot region to split around; the heat moves as fast as the split does. Between these two, the answer to “what if my access pattern is pathological?” is still, in the end, *change your access pattern* — the managed service absorbed most of that problem, not all of it.',
        '**And the predictability is bought with real money, continuously.** A metadata tier sized for the full request rate, a scrub that rebuilds tables from their entire log history, checksums on every message, three copies plus log replicas plus an S3 archive. None of it makes a single query faster. All of it exists so that the bad day looks like the ordinary day, and *somebody is paying for that capacity every second of every ordinary day.*',
      ],
      callout: {
        kind: 'bad',
        big: 'THE UNIT OF FAILURE IS THE PARTITION',
        text: 'Bringing back the leader brought back write unavailability — and the only reason that is survivable is that a Region holds millions of these groups. Availability stopped being a property of the database and became a property of the slice you happened to touch.',
      },
    },
    {
      n: 'Step 07',
      title: 'Where it stands in 2026 — and what Season 1 was about',
      rung: 'Rung 7 · The draw',
      body: [
        '**The argument ended in a draw, and both sides walked.** This chapter is one half of it: the leaderless side grew a leader, a quorum, and consistent reads on request. The other half happened quietly on the leader-based side, and Chapters 11 and 14 are the evidence — Spanner and Aurora spent the same decade learning the availability engineering that Chapter 5’s authors invented because they had no alternative. Nobody conceded. **The industry stopped wanting the choice per database and started wanting it per request**, which is why every serious store in this book now offers both a fast read and a correct one and charges differently for them.',
        '**Managed became the default, and that turned out to be the bigger story.** The thing that beat Dynamo inside Amazon in 2010 — a service somebody else operates — has beaten almost everything since. It is why the systems in Acts V and VI are described by their APIs rather than their clusters, and why an engineer starting today may never see a `nodetool` command or a repair schedule. That is a genuine gain and it has a cost this book has tried to keep visible: **the mechanisms did not disappear, they moved behind a wall**, and the person on call is still the one who has to know what is on the other side of it.',
        '**What this season has been about.** Seventeen chapters so far, one shape repeated: a limit is hit, somebody gives up a guarantee to get past it, and then spends the next decade buying it back at a price they can afford. Act I gave up the single machine. Act II gave up the master. Act III worked out what agreement really costs. Act IV bought transactions back, twice, with different currencies. Act V made the log the primary artifact. Act VI split analytics off and then rented the machines to do it. And the epilogue is the same move once more — *give up the leaderless write, buy back the operator.*',
        '**And the thing that dates fastest is not the mechanism.** The papers in this book were right about their problems and are being steadily contradicted about their conclusions, which is what a healthy field looks like from the inside. Read them for the pressure that forced the design, not for the design — the pressures come back, and the answers are made of whatever hardware and economics happened to exist that year. *Season 2 is about what happens when the data stops sitting still.*',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Partition.',
      body: 'A contiguous slice of a table’s hashed key space, replicated three ways and led by one of them. The internal unit of everything — capacity, failure, repair and splitting.',
    },
    {
      term: 'Replication group.',
      body: 'The replicas of one partition, spread across Availability Zones, running Multi-Paxos to elect a leader. A Region holds millions of them.',
    },
    {
      term: 'Log replica.',
      body: 'A group member that keeps only recent write-ahead log entries and no key-value data. It is added in seconds to restore a quorum, while a real replica takes minutes to build.',
    },
    {
      term: 'Global admission control.',
      body: 'A service that tracks a table’s total consumption and vends short-lived tokens to request routers, so the throughput budget belongs to the table rather than to any one partition.',
    },
    {
      term: 'Split for consumption.',
      body: 'Dividing a partition because of traffic rather than size, at a point chosen from the key distribution actually observed. Useless against a single hot item, and the system knows not to try.',
    },
    {
      term: 'Scrub.',
      body: 'Continuous verification at rest: check that all three replicas agree, and that they agree with a replica rebuilt from the archived log going back to the table’s creation.',
    },
    {
      term: 'Statically stable.',
      body: 'A design that keeps working when a dependency fails, using what it already knows. Cached authorisation results, for example, are refreshed in the background and used regardless.',
    },
  ],
  inTheWild: {
    note: '5 ways this bites in production',
    points: [
      '**One item gets famous and nothing helps.** A single celebrity key, a global counter, a lock row. There is no split that divides one item, so the platform cannot rescue you and says so — the fix is yours, in front of the database, and it is usually a cache or a write-sharded key.',
      '**On-demand absorbs double your previous peak, instantly, and no more.** Anything beyond that is accommodated as traffic climbs, not before it. A launch that goes from nothing to enormous in one minute is the shape this handles least well, which is why the advice is always to warm a table before an event rather than trust the ramp.',
      '**A strongly consistent read costs about twice an eventual one, and defaults are eventual.** Teams discover this either on the invoice or in a bug report about a value that was just written and did not come back. Both discoveries happen months after the code was written.',
      '**Point-in-time restore covers the previous 35 days, and restores into a new table.** It is excellent and it is not an undo button — you get a second table and then a migration you have to plan, at the worst possible moment to be planning one.',
      '**The abstraction is hidden, so capacity problems arrive without an explanation.** You cannot see your partitions, so when something throttles anyway the debugging is inference from metrics. Most of this chapter’s history exists to shrink that surface, and it is smaller than it was rather than gone.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'A leader per small partition',
        when: 'you need a definite order for writes and a consistent read on demand, and you can make the unit small enough that losing one is partial. **The size of the unit, not the election, is what decides whether this is survivable** — the same protocol over one big group is Act I’s master again.',
      },
      {
        choose: 'Meter above the shard, not inside it',
        when: 'a customer’s budget is for the whole table but their traffic is not evenly spread. Allocating capacity per shard makes an invisible internal boundary decide whether their application works — and no amount of tuning that boundary fixes what it fundamentally is.',
      },
      {
        choose: 'A cache that refreshes on hits',
        when: 'the thing behind the cache cannot survive the cache going cold. You pay full load forever in exchange for deleting a cliff, and you should reach for it exactly when the failure mode is correlated — every cache in a fleet going cold at once, which is what a deployment does.',
      },
      {
        choose: 'Verify against a rebuild, not against the other copies',
        when: 'the bugs you fear could have written the same wrong bytes to every replica. Comparing copies only finds divergence; comparing against the log from inception finds agreement that was wrong all along. It costs a great deal and it is the only check that covers your own code.',
      },
    ],
  },
  misconception: {
    think: '“DynamoDB is the Dynamo paper, productised.”',
    actually:
      'The paper written by its own authors says otherwise in a single clause: DynamoDB shares most of the name of the earlier system **and little of its architecture.** Writes go to an elected Multi-Paxos leader rather than to any node on a ring. Ordering comes from that leader rather than from vector clocks. Concurrent writes produce no siblings, because there is only ever one place the order was decided. Strongly consistent reads are available on request. Placement still hashes the partition key, but the resulting ranges are split when they get hot, which the ring had no way to express. **What actually carried over is the goal, not the design** — predictable performance at scale, and a database that stays up. And the reason for the change is not that the 2007 design was wrong; it is that the question changed. Dynamo was built for one company’s engineers to run for themselves, and it lost inside that company to services nobody had to operate. *The paper you are reading is what the same problem looks like when the operator is a stranger and there are hundreds of thousands of them.*',
  },
  sources: [
    {
      year: '2022',
      title: 'Amazon DynamoDB: A Scalable, Predictably Performant, and Fully Managed NoSQL Database Service — Elhemali et al. (USENIX ATC)',
      url: 'https://www.usenix.org/system/files/atc22-elhemali.pdf',
      note: 'Read **§2** first, and read it as history rather than preamble — it is the only place anybody explains why Dynamo lost inside Amazon. Then **§4**, which is the best thing in the paper: three attempts at the same problem, each one improving the mechanism before the third deletes it. **§5.3** on continuous verification and **§6.6** on the metadata cache are each two pages that will change how you build something.',
    },
    {
      year: '2007',
      title: 'Dynamo: Amazon’s Highly Available Key-value Store — DeCandia et al. (SOSP)',
      url: 'https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf',
      note: 'Chapter 5, and the other half of this one. Read the two back to back in a single sitting — it takes an evening and it is the best available lesson in how a design ages. Notice that almost nothing in the 2007 paper is *refuted* by the 2022 one. The premises simply changed underneath it, and the conclusions went with them.',
    },
    {
      year: '2015',
      title: 'Summary of the Amazon DynamoDB Service Disruption and Related Impacts in the US-East Region — AWS',
      url: 'https://aws.amazon.com/message/5467D2/',
      note: 'The postmortem the paper cites when it says an ineffective cache can bring down the thing behind it. A metadata service saturated by storage servers all asking at once, and a recovery made harder because the load would not subside. Read it beside §6.6 and the redesign stops looking paranoid.',
    },
    {
      year: '2015',
      title: 'How Amazon Web Services Uses Formal Methods — Newcombe, Rath, Zhang, Munteanu, Brooker, Deardeuff (CACM)',
      url: 'https://www.amazon.science/publications/how-amazon-web-services-uses-formal-methods',
      note: 'The reference behind the TLA+ claim, and worth reading for the engineering culture rather than the notation. The useful part is their account of which bugs model checking found — the ones needing a specific interleaving of a rare failure and a rare retry, which are exactly the bugs testing does not reach.',
    },
    {
      year: '2020',
      title: 'Millions of Tiny Databases — Brooker, Chen, Ping (USENIX NSDI)',
      url: 'https://www.usenix.org/system/files/nsdi20-paper-brooker.pdf',
      note: 'Not cited by the chapter’s paper, and the best companion to it. Amazon again, on the same instinct from a different service: make the unit of consensus small, make there be an enormous number of them, and manage the fleet rather than the cluster. If Step 07’s claim that granularity is the load-bearing decision interests you, this is the paper that argues it directly.',
    },
  ],
  seenIn: [
    { label: 'The Cart That Must Not Close — Ch 5', to: '/papers/dynamo', live: true },
    { label: 'Interlude: CAP', to: '/papers/cap', live: true },
    { label: 'Paying for Time with Hardware — Ch 11', to: '/papers/spanner', live: true },
    { label: 'Leaderless & quorums — the comic', to: '/ddia/read/replication-quorum', live: true },
  ],
  finale: {
    title: 'The arguments the operators were having',
    body: 'The arc started with a company that could not fit its data on one machine and ends with one that could not fit its database in its engineers’ heads. What this last chapter adds is a correction to how the rest of the season reads. The arguments the field remembers — leaders against no leaders, consistency against availability, the theorem everybody misquotes — are settled in half a page here, and the remaining fourteen are about hot keys, silent corruption, whether a cache is lying to you about how much capacity you would need without it, and how to undo a deployment at three in the morning. That is not a lesser subject. It is what running any of this actually consists of, and it is the part no paper had written down until somebody had done it for fifteen years. One page left, and it is not a paper: the whole season on one, and what all of it adds up to.',
  },
  next: { title: 'The Season, in One Page', slug: 'season-1' },
}
