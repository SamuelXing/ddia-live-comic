import type { Comic } from '../types'
import {
  HashVsRangeDiagram,
  RangeScanCostDiagram,
  HotRangeDiagram,
  HotRangeVsHotKeyDiagram,
  CompoundKeyDiagram,
  LocalGlobalIndexDiagram,
} from '../diagrams'

export const partitionKey: Comic = {
  slug: 'partition-key',
  chapter: 'Chapter 6 · Partitioning',
  chapterNo: 'Ch 6',
  title: 'Choosing the Partition Key',
  dek: 'The ring decides where a key goes. Something has to decide what the key is — and that choice decides which questions you are still allowed to ask.',
  minutes: 5,
  caption:
    'The previous chapter answered “given a key, which node?” This one asks the question underneath it: **which key?** It looks like a performance decision. It is not. The partition key decides **which questions the database can still answer cheaply**, and it is close to the hardest thing on the page to change once real data exists.',
  steps: [
    {
      n: 'Step 01',
      title: 'Two ways to cut',
      rung: 'Rung 1 · Intuition',
      diagram: <HashVsRangeDiagram />,
      body: [
        'There are two ways to decide which partition a row belongs to. **Hash the key** and you get an even spread — neighbouring keys land on different nodes, which is exactly what you want when you are trying to keep any one machine from getting hot.',
        '**Sort by the key** instead and rows that are near each other stay near each other. `2024-03-01` and `2024-03-02` end up in the same place, in order.',
        'The same rows, the same nodes. What changes is not speed. It is *what you can ask*.',
      ],
      code: {
        file: 'assign.py',
        lines: [
          { t: 'partition = hash(key) % N        # even spread, no order' },
          { t: 'partition = which_range(key)     # order kept, spread is yours to manage' },
        ],
      },
    },
    {
      n: 'Step 02',
      title: 'The question you can no longer ask',
      accent: 'terra',
      rung: 'Rung 1 · Intuition',
      diagram: <RangeScanCostDiagram />,
      body: [
        'Hash the key and “give me last week’s orders” has no single place to go. The rows you want are, by design, spread evenly across every node. So the query asks **all of them** and merges the answers — a [[scatter-gather|One query sent to every partition, whose partial answers are then combined. The work grows with the number of nodes, and the response waits on the slowest one, so it gets *worse* as you scale out.]].',
        'Sort by that key instead and the same question touches **one node**, reading rows that are already in order, already next to each other on disk.',
        'This is the part that is easy to miss: hashing did not make the range query slow. It made it **a different kind of operation** — one whose cost grows as you add machines. No index fixes that, because the data is not there to be indexed.',
      ],
      think: {
        q: 'Your table is partitioned by hashed `order_id`, and the dashboard query “orders from the last 7 days” has become slow. Somebody proposes adding a second machine to the cluster to speed it up. What actually happens?',
        a: '**It gets slower.** The query already asks every node and waits for the slowest to answer; a new node means one more partial answer to wait on, and one more chance that a straggler sets your latency. Scatter-gather is the one shape where scaling out is *negative*. The fix is never more nodes — it is either a key that keeps those rows together, or a second copy of the data organised by time (which is the derived-view idea the capacity page starts recommending, and Ch 11’s log).',
      },
    },
    {
      n: 'Step 03',
      title: 'And the bill for sorting: the hot range',
      accent: 'terra',
      rung: 'Rung 1 · Intuition',
      diagram: <HotRangeDiagram />,
      body: [
        'So sort everything by time? Now every write lands in the **same partition** — today’s. Yesterday’s node is idle. Monday’s node is idle. One machine is taking the entire write load of the cluster, and the clock guarantees it will keep happening, because time only moves in one direction.',
        'This is the failure that reads as a mystery in production: the cluster is at 8% and one node is on fire. Adding nodes does not help, because the load is not spread thin — **it is concentrated on the newest key**, and every new node starts empty.',
        'Any monotonically increasing key does this. A timestamp. An auto-increment id. A ULID. The nastier version is that it works beautifully in testing, where the data was generated all at once.',
        'The fix depends on something the dashboard will not tell you — **how many distinct keys the heat is spread over.** That is the difference between a problem you can repartition your way out of and one you cannot, and it is worth knowing before the incident.',
      ],
      callout: {
        kind: 'bad',
        big: '1 of N',
        text: 'nodes doing the writing, however many you add. The hot range is not a capacity problem you can buy your way out of.',
      },
      deeper: {
        summary: 'So what do you actually do about a hot partition?',
        body: [
          'Two very different failures look identical on a dashboard — one node at 100%, the rest idle — and they have opposite fixes. The question that separates them: **how many distinct keys is the heat spread over?**',
          '**Many keys that happen to sort together** is the hot range above. The heat is only concentrated because of where those keys *landed*, so moving them fixes it. Either pick a key that spreads — the compound key in the next step — or, when you cannot change the key, put a [[bucket|A small random or hashed value prepended to a key so that rows which would otherwise sort together are split across several partitions. Called a *salt* just as often. It buys write spread and charges for it on reads.]] in front of it: `(hash(id) % 16, date)` spreads today across sixteen partitions. It works, and it costs you the thing you sorted for — a range scan now reads all sixteen and merges.',
          '**One key** is a different animal. The celebrity account, the one product every checkout touches, the tenant forty times bigger than the rest. A key is the unit of placement, so it cannot be split by definition: **doubling your partitions changes nothing, and neither does doubling it again.** The only moves left are copies — replicate that key across nodes and spread the reads, put a cache in front of it, or split it *in the application* by writing to `key:0…key:15` and summing on read, which is how sharded counters work.',
          'That is why the diagnosis matters more than the remedy. Repartitioning a single hot key is weeks of work that cannot help, and it is a very common way to spend them — the arithmetic never said it would work, but the dashboard looked the same either way.',
        ],
        figure: <HotRangeVsHotKeyDiagram />,
      },
    },
    {
      n: 'Step 04',
      title: 'Have both: hash the outside, sort the inside',
      accent: 'denim',
      rung: 'Rung 2 · Mechanism',
      diagram: <CompoundKeyDiagram />,
      body: [
        'The key does not have to be one column. Split it: the **first part picks the partition** and is hashed, and the **rest keeps the rows sorted** inside that partition.',
        'Key the messages table by `(user_id, sent_at)` and each user’s conversation lives on one node, in time order. A scan of one conversation is a single sorted read. Meanwhile writes spread across as many users as you have — no hot range, because there is no global order, only order *within* a partition.',
        'That is the whole trick, and it is why the same shape appears everywhere: Cassandra calls the parts the partition key and the [[clustering column|The part of a compound key that orders rows *inside* one partition rather than choosing which partition they go to. Cassandra’s term; DynamoDB calls the same thing a sort key.]], DynamoDB calls them the partition key and the sort key. Twitter, which built its own store rather than adopting either, landed on a partition key and a sorted *local key* — three names, arrived at separately, for one idea. **You still cannot ask a question that crosses partitions cheaply** — you have simply chosen, deliberately, which questions those are.',
      ],
      code: {
        file: 'schema.cql',
        lines: [
          { t: 'PRIMARY KEY ((user_id), sent_at)' },
          { t: '--            ^ hashed    ^ sorted within the partition', hl: 'good' },
          { t: '' },
          { t: '-- cheap:  one user, any time range' },
          { t: '-- costly: all users, one time range', hl: 'bad' },
        ],
      },
      deeper: {
        summary: 'What about querying by something that is not the key at all?',
        body: [
          'Sooner or later you need to find rows by a column the partitioning knows nothing about — email, status, region. That needs a **secondary index**, and there are exactly two places to put it, with no third option.',
          'A **local** index lives on each node beside the rows it describes. Writes stay cheap, because a row and its index entry are on the same machine. Reads pay: the value you are searching for could be anywhere, so the lookup asks every partition — scatter-gather again, wearing a different hat.',
          'A **global** index is itself partitioned, by the indexed value rather than by the table’s key. Now a lookup goes straight to one node. But a single write now touches **two partitions** — the row and its index entry — on two different machines, which is a distributed write with everything that implies. DynamoDB is explicit that its global indexes are updated asynchronously, which means the index can be behind the table it describes.',
          'Neither is free. You are choosing which side pays, and the honest question is which of the two your workload does more of.',
        ],
        figure: <LocalGlobalIndexDiagram />,
      },
    },
  ],
  bubbles: [
    { term: 'Partition key', body: 'The part of a row that decides which node holds it. Not necessarily the primary key, and not necessarily one column.' },
    { term: 'Hot partition', body: 'One partition taking a share of the load far above its share of the data. The cluster looks idle; one node does not.' },
    { term: 'Secondary index', body: 'A lookup by something that is not the partition key. Always costs either the read or the write — never neither.' },
  ],
  inTheWild: {
    note: '4 ways this decision comes back later',
    points: [
      {
        t: '**The choice is close to permanent.** Changing the partition key means rewriting every row into a new layout, because where a row lives *is* the key. Notion shards Postgres by workspace id; Figma spent nine months building a proxy before it could move. Teams live with a key they would not choose again, and the reason is almost never that they still think it was right.',
      },
      {
        t: 'A key can be perfectly even on **rows** and badly uneven on **traffic**. Partition by `customer_id` and the row counts look beautiful — until one customer is forty times bigger than the rest. The data is balanced; the load is not, and only the load matters.',
      },
      {
        t: 'Hot partitions are common enough that the managed services built machinery for them. **DynamoDB splits a partition when it runs hot**, not only when it runs large, and shifts throughput toward the busy one — because customers kept picking keys that concentrated. What none of it fixes is a single hot *item*: AWS’s own guidance there is to shard the write in your application or put a cache in front, which is the same admission the fold-out above makes.',
      },
      {
        t: 'The same trap shows up where you would not call it partitioning at all. **S3 partitions by key prefix**, so naming objects `logs/2024-03-01/...` puts a whole day behind one prefix — and the fix for the resulting throttling is to put the varying part first. A file naming convention turned out to be a shard key.',
      },
    ],
  },
  tradeoffs: {
    title: 'how should you choose the key?',
    rows: [
      { choose: 'Hash something with many values', when: 'reads fetch one thing by id and you mostly need writes spread evenly — **sessions, user profiles, key-value lookups**. Give up cheap range scans knowingly.' },
      { choose: 'Sort by the thing you scan', when: 'the queries that matter sweep a window in order — **time series, feeds, “everything for this account”**. Watch the newest partition; that is where the heat goes.' },
      { choose: 'Hash one part, sort the rest', when: 'you need both, and you can name the *one* thing every query already knows — **a user id, an account, a device**. The answer most production schemas land on. (a compound key)' },
      { choose: 'Keep a second copy, keyed differently', when: 'two access patterns genuinely disagree and no single key serves both. You are now maintaining a derived view, and it will be behind — **which is Ch 11’s problem, on purpose**.' },
      { choose: 'Do not partition yet', when: 'it still fits on one machine. A single node answers every question cheaply, and that is a real advantage you are about to spend.' },
    ],
  },
  misconception: {
    think: '“The partition key is a performance detail — we can tune it later.”',
    actually:
      'Actually — it is a **schema decision that decides which questions stay cheap**, and it is one of the hardest things in a running system to change, because where every row lives *is* the key. Tuning changes how fast an answer comes back. This changes whether the answer can be had at all without asking every machine you own.',
  },
  sources: [
    {
      year: '2006',
      title: 'Bigtable: A Distributed Storage System for Structured Data (OSDI)',
      url: 'https://research.google/pubs/pub27898/',
      note: 'Where the sorted-row-key model comes from — §2 on row keys is the origin of “range scans are cheap, and that is the whole design”.',
    },
    {
      year: '2022',
      title: 'Amazon DynamoDB: A Scalable, Predictably Performant Key-value Store (USENIX ATC)',
      url: 'https://www.usenix.org/system/files/atc22-elhemali.pdf',
      note: 'Partition key + sort key in production, and §5 on what the service had to build because customers picked keys that made hot partitions.',
    },
    {
      year: '2014',
      title: 'Manhattan, Twitter’s real-time multi-tenant distributed database',
      url: 'https://blog.x.com/engineering/en_us/a/2014/manhattan-our-real-time-multi-tenant-distributed-database-for-twitter-scale',
      note: 'The third independent arrival at the compound key: a partition key plus a sorted local key you range-scan inside. Tweets are stored this way — and the 2018 secondary-indexing post spells the model out in full.',
    },
    {
      year: '2021',
      title: 'Sharding Postgres at Notion',
      url: 'https://www.notion.com/blog/sharding-postgres-at-notion',
      note: 'A real team choosing a partition key (workspace id) and saying plainly why the alternatives were rejected.',
    },
  ],
  seenIn: [
    { label: 'Kafka — the key decides the partition', to: '/ddia/components/kafka', live: true },
    { label: 'S3 — the key prefix is a shard key', to: '/ddia/components/s3', live: true },
    { label: 'Capacity calculator — “how reads find the data”', to: '/calculator/capacity', live: true },
    { label: 'Cassandra', note: 'roadmap' },
  ],
  finale: {
    title: 'The same choice, on a real machine',
    body: 'The capacity calculator opens by asking whether your reads fetch one thing or sweep a range — this is that question, and the answer changes which stores survive the first filter. The S3 page shows the version nobody expects: a date-shaped key name throttling a service you do not even run.',
  },
  next: { slug: 'transactions', title: 'Isolation Levels' },
}
