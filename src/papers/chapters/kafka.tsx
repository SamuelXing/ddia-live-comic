import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { LogTableDiagram, IntegrationDiagram } from '../diagrams'
import { kafkaTrace } from './kafka-trace'

/* The act's centre, and the second chapter in this book to read two documents
   instead of one — Chapter 8 did it with Paxos and Raft. The pairing is the
   point: the 2011 paper is a modest systems paper about beating ActiveMQ, and
   the 2013 blog post is the argument that made the thing matter. Neither is
   sufficient alone, and the gap between them is a genuinely interesting fact
   about how ideas land.

   Keep the framing honest: the post is not a better version of the paper, it
   is a different claim entirely. The paper says "here is a fast log
   aggregator". The post says "the log is the abstraction underneath data
   integration, replication and stream processing, and you should run one." */

export const kafka: Chapter = {
  slug: 'kafka',
  act: 'Act V · The Log Is the Database',
  paperNo: 'Paper 13 · told twice',
  title: 'Write Once, Replay Everywhere',
  dek: 'A modest 2011 paper about a fast message queue, and a 2013 blog post that reframed the same system as the missing abstraction underneath everything. The second one is why you have heard of the first.',
  minutes: 18,
  paper: {
    title: 'Kafka: a Distributed Messaging System for Log Processing',
    authors: 'Jay Kreps, Neha Narkhede & Jun Rao',
    venue: 'NetDB',
    year: '2011',
    url: 'https://www.microsoft.com/en-us/research/wp-content/uploads/2017/09/Kafka.pdf',
  },
  caption:
    'Chapter 12 ended with a daemon tailing MySQL’s commit log so that a cache could be told what changed — chosen over sending messages because **a stream can be replayed and a message cannot.** Hold that thought and look around. Every system in this book has a log inside it doing the real work: GFS appends, Bigtable’s memtable, the Paxos log, Spanner’s ordered writes, Percolator’s write records. In every one of them the log is private plumbing. So here is the question this chapter is about, asked at LinkedIn in 2011 by people drowning in point-to-point data pipelines: **why is the log a private implementation detail? Make it a service, and let anything subscribe.**',
  steps: [
    {
      n: 'Step 01',
      title: 'The problem was never messaging',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'The 2011 paper opens on a workload that did not fit anything available. **Activity data — clicks, impressions, searches, page views — is orders of magnitude larger than the “real” data**, because a single page generates a record for every item shown and not clicked as well as the one that was. It used to be scraped off servers into a warehouse overnight. Now it feeds search relevance, recommendations, ad targeting and abuse detection, **in seconds**.',
        'Enterprise message queues were the obvious tool and were wrong in four specific ways, each worth understanding because each is a design decision inverted. **They offer per-message delivery guarantees** nobody needed here — losing the occasional page-view event is genuinely fine — and those guarantees cost complexity everywhere. **They have no batch API**, so every message is a TCP round trip. **They have no real partitioning story.** And decisively: **they assume the backlog is always small**, so their performance falls apart when messages accumulate — which is exactly what a nightly Hadoop load does on purpose.',
        'The log aggregators of the day — Scribe, Flume, Yahoo’s Data Highway — got the throughput right and the shape wrong. They were built to dump into HDFS for offline consumption, they leaked implementation details into the consumer (*“minute files”*), and they **pushed** data at consumers rather than letting consumers pull. Push is a fine model until one consumer is slower than the producer, at which point you have to decide what to drop.',
        'So the requirement is genuinely awkward: **one system that serves a real-time consumer sitting milliseconds behind the writer and a batch consumer sitting six hours behind, reading the same data, without either one being able to hurt the other.** Every existing system was built for one of those two and treated the other as an edge case.',
      ],
      code: {
        file: 'the_awkward_requirement.txt',
        lines: [
          { t: 'consumer A: a live service' },
          { t: '  wants: milliseconds behind' },
          { t: '  reads: continuously, forever' },
          { t: '' },
          { t: 'consumer B: a nightly warehouse load' },
          { t: '  wants: the whole day, at once' },
          { t: '  reads: hours late, in a big gulp' },
          { t: '' },
          { t: '# same data. same system. neither', hl: 'good' },
          { t: '# one degrades the other.', hl: 'good' },
          { t: '' },
          { t: '# every queue in 2011 assumed the', hl: 'bad' },
          { t: '# backlog was always small.', hl: 'bad' },
        ],
      },
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'Three questions, and the first one decides the other two. Notice as you go that each answer is arrived at by **removing** something every competing system had.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**The volume:** activity data, far larger than the transactional data it describes, arriving continuously and never stopping.',
              '**The consumers:** some read at the tail in real time; some read hours-old data in large gulps. Both are first-class.',
              '**The tolerance:** losing the occasional event is acceptable. Falling over when a consumer gets behind is not.',
              '**The hardware:** commodity machines with spinning disks. Sequential access is cheap; random access and per-message bookkeeping are not.',
              '**The scale:** hundreds of gigabytes a day at LinkedIn in 2011, and it is obviously going to grow.',
            ],
            questions: [
              {
                q: 'Several consumers read the same stream at wildly different speeds. Who remembers how far each one has got?',
                options: [
                  {
                    label: 'The broker, per consumer, per message',
                    verdict: 'dead',
                    why: 'What every message queue does, and the source of most of their cost. The broker needs a random-access structure mapping message ids to state, it must update that state on every acknowledgement, and it cannot delete anything until everyone has acked. The paper measured the consequence directly: **one of ActiveMQ’s busiest threads was walking a B-tree to maintain message metadata**, and its broker was doing disk writes during a pure read benchmark. You are paying storage-engine prices for a bookkeeping problem.',
                  },
                  {
                    label: 'The consumer remembers its own position, and the broker keeps nothing',
                    verdict: 'move',
                    why: 'A **stateless broker**. The consumer holds an offset and asks for bytes from there; the broker looks up which segment file contains that offset and reads. No delivery state, no per-consumer structure, no acknowledgement protocol — and enormous consequences downstream. A read becomes a file seek, adding a consumer costs the broker nothing, **and rewinding becomes free** because there was never anything to rewind.',
                  },
                  {
                    label: 'One queue per consumer, so each has its own copy',
                    verdict: 'dead',
                    why: 'Storage multiplied by the number of consumers, and the number of consumers is the thing you want to grow without thinking about it. It also makes adding a consumer an operational act — provision a queue, backfill it, keep it — which is precisely the friction this system exists to remove. The whole point is that a new reader of existing data should cost nothing.',
                  },
                  {
                    label: 'The broker pushes and does not track anything',
                    verdict: 'dead',
                    why: 'It removes the bookkeeping and creates a worse problem: a consumer slower than the producer must be flooded, throttled or dropped, and the broker has to decide which. Pull inverts that cleanly — each consumer takes what it can handle and simply falls behind if it cannot keep up. **Falling behind is a fine state; being flooded is not.**',
                  },
                ],
              },
              {
                q: 'Your broker has no idea who has read what. So when do you delete a message?',
                options: [
                  {
                    label: 'When every subscriber has acknowledged it',
                    verdict: 'dead',
                    why: 'This requires exactly the state you just refused to keep, and it hands every consumer a veto over your disk. One consumer that is down for a week, or that was decommissioned and never deregistered, and the log grows without bound. The failure is also delayed and confusing: the system works fine for months and then a forgotten subscriber fills a disk.',
                  },
                  {
                    label: 'After a fixed time, whether anybody read it or not',
                    verdict: 'move',
                    why: 'A **time-based retention policy**, typically **seven days**. Blunt, and it is the right blunt: it is a property of the log alone, it needs no knowledge of consumers, and it makes disk usage a function of throughput rather than of subscriber behaviour. It is only affordable because performance here does not degrade as data accumulates — which is itself a consequence of the storage layout. *And it turns “how far behind may you be” into a number somebody has to choose deliberately.*',
                  },
                  {
                    label: 'Never — keep everything',
                    verdict: 'dead',
                    why: 'Tempting, and in 2011 on commodity disks it was not on the table. Worth noting that the industry moved toward this answer as storage got cheap: tiered retention to object storage, and compacted topics that keep the latest value per key forever. **The idea that a log could be the permanent record rather than a buffer was the direction of travel** — it just needed a decade of storage prices.',
                  },
                  {
                    label: 'When the disk fills, drop the oldest',
                    verdict: 'dead',
                    why: 'Nearly the same mechanism with the guarantee removed. Now retention depends on how much other traffic there happened to be, so a consumer’s safe lag varies with an unrelated topic’s volume, and nobody can answer “how long do I have to fix this before I lose data”. A time policy is worse on utilisation and much better on being able to reason about it.',
                  },
                ],
              },
              {
                q: 'One totally ordered log will not go faster than one machine. What do you give up to scale it?',
                options: [
                  {
                    label: 'Nothing — put a sequencer in front and keep the global order',
                    verdict: 'dead',
                    why: 'You have made one machine assign every position in the stream, which caps the whole system at that machine’s rate and makes its failure everybody’s. Chapter 10 could afford this shape because a timestamp is tiny and a datacenter round trip is short. Here the sequencer would be on the path of every event of a firehose that is already the largest data source in the company.',
                  },
                  {
                    label: 'Global ordering — split into partitions, each ordered on its own',
                    verdict: 'move',
                    why: 'A topic becomes many **partitions**, each a totally ordered log on some broker, with **no ordering between them**. Throughput now scales with partitions. The honest cost is that ordering is only available *within* a partition, so anything that must be ordered together has to be routed to the same partition — which makes the partitioning key a schema decision with real consequences, exactly as it was in Chapter 6.',
                  },
                  {
                    label: 'Let several consumers share a partition and coordinate',
                    verdict: 'dead',
                    why: 'Then two consumers must agree on who processes what, inside a partition, continuously — locking and shared state on the hot path, which is the overhead the whole design is avoiding. Making the partition the unit of both ordering **and** ownership means consumers only coordinate when membership changes, which is rare. Over-partition instead, so there is always more parallelism available than consumers.',
                  },
                  {
                    label: 'Give each consumer its own partition of the data',
                    verdict: 'dead',
                    why: 'This confuses the producer’s problem with the consumer’s. Partitioning must be decided when data is written, by a key that reflects what needs to stay ordered; if it is decided by who reads it, then every new consumer with a different access pattern requires the data to be repartitioned. The producer’s key choice has to serve all readers, present and future.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived Kafka — and then a blog post two years later explained what you had built',
              body: [
                '**Everything here is a subtraction.** No per-message ids, so no index. No delivery state, so no per-consumer bookkeeping. No in-process cache, so the page cache does the work and the JVM has nothing to collect. No copies into user space, because `sendfile` hands the file straight to the socket. What is left is a file you append to and read from at an offset — and it beat the alternatives by margins that look like measurement errors until you notice how much was removed.',
                '**The 2011 paper does not claim what the system turned out to be.** It claims a fast log aggregator, and it proves it: 400,000 messages a second published, four times the consumption rate of the alternatives, nine bytes of overhead per message against 144. It is a good paper. It is not the reason you have heard of Kafka.',
                '**The reason is a blog post from December 2013**, in which Jay Kreps argues that the log is not an implementation detail of Kafka but the abstraction underneath databases, replication, consensus, version control and stream processing — and that an organisation should run one as shared infrastructure. *The system did not change. What it was for changed.* The rest of this chapter is that argument, because it is the one that reorganised the industry.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'One file, read twice, at different speeds',
      accent: 'denim',
      rung: 'Rung 3 · The reveal',
      span: 2,
      body: [
        'Watch step 3 and step 6 together. Two consumers reading the same bytes six hours apart, and then one of them winding itself backwards to re-read a day it got wrong. Both are ordinary here and both are impossible in a queue, for the same reason: **nothing was ever tracking consumption.**',
        'Note also where ZooKeeper sits — off the data path entirely, holding group membership and offsets, consulted when something changes rather than when something is read.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={kafkaTrace} />
        </div>
      ),
      think: {
        q: 'The broker keeps no delivery state and deletes on a timer. So what stops a consumer group from silently losing data forever?',
        a: '**Nothing does, and that is a deliberate transfer of responsibility rather than an oversight.** The guarantee Kafka offers is at-least-once within the retention window, and the window is a policy you set. A consumer that falls further behind than the retention period has permanently lost the data it skipped, and it will not be told — it will simply resume at the oldest available offset. What the design gives you in exchange is that **the failure is measurable in advance**: consumer lag is a number you can graph, retention is a number you chose, and the distance between them is the time you have to fix an outage. Compare that with the queue you were sold instead, which guarantees delivery right up until the moment the backlog exceeds what the broker can hold, and then fails in a way nobody planned for. This is the same trade as Chapter 12’s: *the honest system is the one whose failure mode has a number attached.* And the same instinct explains the delivery guarantee — the paper says plainly that exactly-once would need two-phase commit and that de-duplicating in the consumer is cheaper, which is a sentence worth carrying into every messaging design review you attend.',
      },
    },
    {
      n: 'Step 04',
      title: 'Tables and events are the same thing',
      rung: 'Rung 4 · The idea the post supplied',
      body: [
        'Here is the reframing, and it is the sentence that made a message queue into infrastructure. **A log of changes and a table of current values are dual.** The log is the list of every credit and debit; the table is the balances. Replay the log in order and you get the table. And you can get *any* table — one keyed differently, one aggregated, one denormalised for a search index — from the same log.',
        'The reverse does not hold, and that asymmetry is the whole claim. **From the table you cannot recover the history**, so the log is the more fundamental structure and the table is a view of it that happens to be the one people usually store. Once you believe that, the cache in Chapter 12 stops being a cache and becomes another view; the search index stops being a sidecar; the warehouse stops being a destination. *All of them are readers of one sequence, each behind by a different amount.*',
        'The mechanism underneath is older than any of it, and this book already met it. **The State Machine Replication Principle**, in Kreps’ own phrasing: *if two identical, deterministic processes begin in the same state and get the same inputs in the same order, they will produce the same output and end in the same state.* That is Chapter 7 — Lamport, 1978, the state machine approach — arriving thirty-five years later as an argument about company infrastructure rather than about clocks.',
        'And the practical payoff is the ugliest problem in most organisations. **Wiring N data sources to M destinations point-to-point takes N×M pipelines**, each one bespoke, each one somebody’s job, each one a way for bad data to reach Hadoop and turn expensive machines into an expensive space heater. Put a log in the middle and it becomes **N+M**: every producer writes once, every consumer subscribes once, and adding a system costs one connection instead of a row of them.',
      ],
      diagram: <LogTableDiagram />,
      deeper: {
        summary: 'Why the paper is modest and the blog post is not, and what that says about how ideas actually land',
        body: [
          'The 2011 paper is a competent systems paper: here is a problem, here are four design decisions, here is a benchmark against ActiveMQ and RabbitMQ, here is what we run in production. Its stated contribution is throughput. Nothing in it claims that the log is a universal abstraction, and nothing in it tells you to restructure your data infrastructure around one.',
          'The December 2013 post makes a claim of a completely different kind, and makes it about a system that had not changed. It argues that logs are what you must understand to understand databases, replication, Paxos, Hadoop and version control; that tables and events are dual; that data integration is a more valuable problem than the analytics everyone was excited about; and that stream processing is a *generalisation* of batch processing rather than a niche beside it. **By then LinkedIn was running over 60 billion message writes a day through the thing.**',
          'It is worth being clear-eyed about what this means. The engineering was necessary and was not sufficient. The system existed for two years doing exactly what it does now, and the thing that turned it into a category was **an argument about what it was for** — written, as Kreps has said since, because they had big ideas about Kafka and felt most people did not understand it. *Chapter 8 had a version of this too: Paxos was correct for sixteen years before somebody optimised for being understood.*',
        ],
      },
    },
    {
      n: 'Step 05',
      title: 'What it costs to make the log a service',
      accent: 'terra',
      rung: 'Rung 5 · The bill',
      body: [
        '**In 2011 there was no replication, and the paper says so.** If a broker’s disk failed permanently, every unconsumed message on it was gone forever. Producers did not even wait for acknowledgements — that is part of why the publish numbers are so good — so there was no guarantee a published message had been received at all. The paper lists replication as future work, and everything the system is used for today depends on that work having been done.',
        '**Ordering is per partition and people forget constantly.** A topic gives you no global order at all. Two events about the same user, routed to different partitions because somebody keyed on the wrong field, can be processed in either order forever — and the bug looks like application logic rather than a partitioning decision made in a schema review two years earlier. **This is Chapter 6’s partition-key problem in a new costume**, and it is just as unchangeable after the fact.',
        '**At-least-once means duplicates, and duplicates are yours to handle.** A consumer that dies without committing its offset will re-read whatever it had processed since. The paper is unusually direct about this: exactly-once would require two-phase commit, it is not necessary for these applications, and **de-duplicating in the consumer is more cost-effective**. That is the correct answer and it puts real work in every consumer that cares.',
        '**Retention is a deadline you set in advance and discover under pressure.** Seven days is a fine default until a consumer group is broken over a holiday. Since the broker will not tell you, **consumer lag becomes a metric you must actually watch** — the gap between lag and retention is how long you have to fix an incident, and most teams learn its value the first time they run out of it.',
        '**And the shared log becomes shared infrastructure, with everything that implies.** Once every team publishes to it, it is on the critical path of systems its operators have never heard of. Schemas become a contract — LinkedIn reached for Avro and a schema registry almost immediately — and a producer that changes a field breaks consumers it does not know exist. *The N×M pipelines did not disappear; they turned into N+M connections and one very large coordination problem about what the messages mean.*',
      ],
      diagram: <IntegrationDiagram />,
      callout: {
        kind: 'bad',
        big: 'ORDER IS PER PARTITION, NOT PER TOPIC',
        text: 'The unit of ordering and the unit of parallelism are the same thing, and it is not the topic. Anything that must stay in order must share a key — decided when the data is written, and expensive to change afterwards.',
      },
    },
    {
      n: 'Step 06',
      title: 'What it begat — and where it stands in 2026',
      rung: 'Rung 6 · Descendants',
      body: [
        '**Replication arrived, and with it the guarantees the paper deferred.** Partition leaders and in-sync replicas, `acks=all`, idempotent producers, and eventually transactions giving exactly-once semantics *within* Kafka — the thing the 2011 paper said it would not do, delivered a decade later when the workloads demanded it. And in 4.0 (2025) Kafka finished removing ZooKeeper in favour of **KRaft**, its own internal Raft, which is the reversal Chapter 9 discussed: when your product is already a replicated log, an external coordination service is a second consensus implementation to operate.',
        '**Change data capture made Chapter 12’s daemon general.** Debezium and its relatives tail a database’s replication log and publish the changes as a topic, which is mcsqueal without the cache-shaped hole in it. **The database’s private log became a public stream**, and with it the whole outbox pattern, the read-model-per-service habit in event-driven architectures, and the ability to build a new derived store by replaying history rather than by writing a backfill.',
        '**And “the log is the database” became something people build on literally.** Kafka Streams and ksqlDB materialise tables from topics; Flink and Materialize compute over streams as first-class inputs; the modern lakehouse table formats keep a log of changes and treat the table as a view of it. The strong version of the duality — *store the log, derive everything else* — is now a mainstream architecture with a name, event sourcing, and a well-known failure mode: replaying five years of history through code that has changed forty times is harder than the diagram suggests.',
        '**2026 status: the abstraction won so completely that the argument is invisible.** Every serious data platform has a durable ordered stream at the centre, whether it is Kafka, Kinesis, Pulsar, Redpanda or a cloud service that hides the brokers entirely. The remaining hard problems moved up a layer and are all about meaning rather than mechanism: **who owns this topic, what is in it, what happens when the schema changes, and how far behind is that consumer right now.**',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Topic.',
      body: 'A named stream. Divided into partitions, which are the only place ordering exists.',
    },
    {
      term: 'Partition.',
      body: 'A totally ordered log on one broker. The unit of parallelism and the unit of ordering, deliberately the same thing.',
    },
    {
      term: 'Offset.',
      body: 'A message’s position in its partition, which is also its address. Increasing but not consecutive — the next one is this plus the message length.',
    },
    {
      term: 'Consumer group.',
      body: 'A set of consumers jointly reading a topic, each partition owned by exactly one member. Different groups read the same data independently.',
    },
    {
      term: 'Stateless broker.',
      body: 'The broker tracks nothing about who read what. The decision everything else falls out of, including free rewinds and time-based retention.',
    },
    {
      term: 'Log-table duality.',
      body: 'A log of changes and a table of current values hold the same information. The table is derivable from the log; the history is not derivable from the table.',
    },
  ],
  inTheWild: {
    note: '5 ways this bites in production',
    points: [
      '**Two events about one entity land in different partitions.** Somebody keyed on request id instead of user id, so a create and an update are processed in either order depending on timing. It works in test with one partition and breaks in production with twelve, and the fix requires repartitioning a topic other teams are reading.',
      '**Consumer lag quietly exceeds retention.** A consumer group is broken over a weekend, retention is seven days, and nobody is alerting on the gap between them. When it is restarted it resumes from the oldest available offset and skips everything in between — silently, because the broker has no way to know it should complain.',
      '**Duplicates arrive and nothing is idempotent downstream.** A consumer dies before committing its offset, replays a few thousand messages, and inserts them all again. At-least-once was in the documentation; nobody read it before writing the sink.',
      '**A producer changes a field and breaks strangers.** Once the log is shared infrastructure, the schema is a contract with consumers the producer has never met. Without a registry and compatibility rules, a routine refactor becomes an incident in a team that did not deploy anything.',
      '**Rebalances turn into stampedes.** Every membership change reassigns partitions across the group, and with heavy state or slow startup a rolling deploy becomes minutes of nobody consuming — repeated once per instance, because each restart triggers another rebalance.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Keep consumption state in the consumer',
        when: 'you want readers you have not met yet. A server that tracks per-consumer state pays for every subscriber and can never delete anything safely; one that hands out positions in a file does not care how many readers there are or how far behind they get.',
      },
      {
        choose: 'Retain by time, and watch the gap',
        when: 'you cannot know who has finished reading — which is whenever the readers are independent. Then the important number is not retention, it is **retention minus lag**: how long you have to fix an outage before it becomes data loss.',
      },
      {
        choose: 'Publish the change, not the current value',
        when: 'more than one system needs to know something happened. A change stream can build any view, including ones nobody has thought of; a snapshot of current state can only build the view it already is.',
      },
      {
        choose: 'Choose the partition key like a schema decision',
        when: 'you create the topic — because it is one. It fixes what can be ordered together and what can be parallelised, and it is as painful to change afterwards as a primary key. **This is Chapter 6’s lesson arriving in a different system.**',
      },
    ],
  },
  misconception: {
    think: '“Kafka is a message queue.”',
    actually:
      'It is a **replicated commit log offered as a service**, and the difference is not vocabulary. In a queue, a message is delivered and then it is gone: the broker holds per-consumer delivery state, cannot free anything until everyone has acknowledged, and consumption is destructive. Here the broker holds **no consumer state at all** — a message is a position in a file, readers hold their own offsets, and reading changes nothing. Every property people find surprising comes from that one difference. *Many independent readers at wildly different points in the same data*, because there is nothing per-reader to duplicate. *Rewinding to re-process a bad day*, because nothing recorded that you had already read it. *Retention by time rather than by acknowledgement*, because the broker genuinely does not know who is finished. And the reason it matters beyond messaging is the duality: **a table is what you get by replaying a log, and a log is not what you get by reading a table.** So the log is the primary record, and the database, the cache, the search index and the warehouse are all views of it that have fallen behind by different amounts. That claim is what the 2013 post added to the 2011 system, and it is the claim this act is named for.',
  },
  sources: [
    {
      year: '2011',
      title: 'Kafka: a Distributed Messaging System for Log Processing — Kreps, Narkhede & Rao (NetDB)',
      url: 'https://www.microsoft.com/en-us/research/wp-content/uploads/2017/09/Kafka.pdf',
      note: 'Seven pages, and worth reading precisely because it is so much more modest than the system’s reputation. **§3.1 is the whole design**: simple segment files, offsets instead of ids, the stateless broker, `sendfile`, and the page cache. Read §3.3 on delivery guarantees for a refreshingly blunt paragraph about why exactly-once was not attempted. Note that replication is listed as future work.',
    },
    {
      year: '2013',
      title: 'The Log: What every software engineer should know about real-time data’s unifying abstraction — Jay Kreps',
      url: 'https://web.archive.org/web/20260609223006/https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying',
      note: 'The document that made the system matter, and the longest thing in this bibliography — set aside an evening. Linked through the Internet Archive because **LinkedIn has since taken the original down**, which is its own small argument for why a book about papers should check its links. Read Part One for the state machine replication principle and the log-table duality; Part Two is the data-integration case, and it is the part that changed how companies are wired.',
    },
    {
      year: '1978',
      title: 'Time, Clocks, and the Ordering of Events in a Distributed System — Leslie Lamport (CACM)',
      url: 'https://lamport.azurewebsites.net/pubs/time-clocks.pdf',
      note: 'Chapter 7 here, and the source of the principle the blog post rests on: identical deterministic processes, fed the same inputs in the same order, end in the same state. Re-read §3 with this chapter in mind and the log stops looking like messaging infrastructure and starts looking like the input tape of a state machine — which is what it is.',
    },
    {
      year: '2013',
      title: 'Apache Kafka documentation — design',
      url: 'https://kafka.apache.org/documentation/',
      note: 'The living version of §3 of the paper, and the honest place to see what changed. Replication, in-sync replicas, `acks`, idempotent producers, transactions and KRaft are all things the 2011 paper either deferred or had not imagined. Reading the design section beside the paper is a good way to see which decisions were load-bearing and which were 2011.',
    },
  ],
  seenIn: [
    { label: 'The Most Common Derived Copy — Ch 12', to: '/papers/memcache', live: true },
    { label: 'What “Before” Even Means — Ch 7', to: '/papers/lamport', live: true },
    { label: 'Consensus as a Service — Ch 9', to: '/papers/zookeeper', live: true },
    { label: 'Kafka — the deep dive', to: '/ddia/components/kafka', live: true },
  ],
  finale: {
    title: 'The log stopped being an implementation detail',
    body: 'Two documents, one system, and the gap between them is the interesting part. The paper removed everything a message queue normally does — the ids, the index, the per-consumer bookkeeping, the copies into user space — and was left with a file you append to and read at an offset, which turned out to be four hundred thousand messages a second. The post then said what that file was: not a buffer but the primary record, with tables, caches, indexes and warehouses as views of it that have fallen behind by different amounts. Next: a relational database takes that claim completely literally. It stops writing pages over the network altogether, ships nothing but redo log records to its storage tier, and lets the storage work out what the pages should say. The section of the paper where this happens is titled, without any hedging, "The Log Is the Database."',
  },
  next: { title: 'The Log Made Literal', slug: 'aurora' },
}
