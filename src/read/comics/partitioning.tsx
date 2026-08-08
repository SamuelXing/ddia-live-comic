import type { Comic } from '../types'
import { RingDiagram } from '../diagrams'

export const partitioning: Comic = {
  slug: 'partitioning',
  chapter: 'Chapter 6 · Partitioning',
  chapterNo: 'Ch 6',
  title: 'Consistent Hashing',
  dek: 'How do you split one dataset across many machines — and add a machine later without moving almost everything?',
  minutes: 4,
  caption:
    'When a dataset outgrows a single machine, you cut it into **partitions** and scatter them across nodes. The entire game is one function: **given a key, which node holds it?** Choose badly and every new machine you add triggers a stampede.',
  steps: [
    {
      n: 'Step 01',
      title: 'The naïve map',
      rung: 'Rung 1 · Intuition',
      body: [
        'The obvious answer: hash the key, take it modulo the number of nodes. Even spread, one line of math, nothing to store.',
      ],
      code: {
        file: 'assign.py',
        lines: [{ t: 'node = hash(key) % N   # N = number of nodes' }],
      },
    },
    {
      n: 'Step 02',
      title: 'The stampede',
      accent: 'terra',
      rung: 'Rung 1 · Intuition',
      body: [
        'Grow from four nodes to five and the modulo shifts under **almost every key**. Data that never needed to move gets rehashed to a different node all at once.',
      ],
      callout: {
        kind: 'bad',
        big: '~80%',
        text: 'of keys relocate on a single **4 → 5** resize. A live cluster spends the afternoon shuffling instead of serving.',
      },
      deeper: {
        summary: 'Why exactly ~80%? The counting argument.',
        body: [
          'A key stays put only if `hash(k) % 4 == hash(k) % 5`. For uniformly random hashes those agree for only about **1 in 5** keys — so roughly **80% move**. Bump N by one again and it happens *again*: modulo has no memory of where a key used to live.',
        ],
        code: {
          file: 'why.py',
          lines: [
            { t: 'stayed = sum(h % 4 == h % 5 for h in hashes)' },
            { t: '# stayed / total ≈ 0.20  → 80% relocate' },
          ],
        },
      },
    },
    {
      n: 'Step 03',
      title: 'Put everything on a ring',
      accent: 'denim',
      rung: 'Rung 2 · Mechanism',
      diagram: <RingDiagram />,
      body: [
        '**Consistent hashing** lays nodes and keys on the same [[hash space|A fixed circle of values, 0 → 2³²−1. Both nodes and keys are hashed onto it; a value’s position on the circle is all that matters.]], and a key belongs to the first node it meets travelling **clockwise**.',
        'Add a node and only the slice between it and its clockwise neighbour moves — **≈ 1/N** of the keys, not 80%.',
      ],
      deeper: {
        summary: 'The lookup, and why virtual nodes exist.',
        body: [
          'The owner is **computed, not stored** — binary-search the sorted ring for the first point ≥ `hash(key)`:',
        ],
        code: {
          file: 'ring.py',
          lines: [
            { t: 'ring = sorted(hash(n) for n in nodes)' },
            { t: 'i = bisect_left(ring, hash(key))   # first node clockwise', hl: 'good' },
            { t: 'owner = ring[i % len(ring)]        # wrap around' },
          ],
        },
      },
    },
    {
      n: 'Step 04',
      title: 'Add a node, calmly',
      accent: 'denim',
      rung: 'Rung 2 · Mechanism',
      body: [
        'Naïvely, one point per node gives **lumpy** slices — one node can own a fat arc, and a lost node dumps all its keys on a single neighbour. Fix: place each machine at **many** points on the ring (**virtual nodes**), so load evens out and a departure spreads across *all* survivors.',
      ],
      callout: {
        kind: 'good',
        big: '≈ 1/N',
        text: 'of keys relocate when you add the Nᵗʰ node. Compare that to **~80%**. This is the whole reason the ring exists.',
      },
      think: {
        q: 'You spread a million users evenly across the ring — perfectly balanced. Then one celebrity posts, and half your traffic hits the single key holding their profile. The ring is balanced. Why is one machine on fire?',
        a: '**Consistent hashing balances *keys*, not *traffic*.** It spreads a million *different* keys evenly — but it can’t split the load of *one* key, because that key lives on exactly one node no matter how you slice the ring. Every one of the celebrity’s readers hashes to the same place. Balancing keys and balancing load are different problems: you fix a **hot key** with something else — cache it, replicate it to several nodes, or split it into sub-keys. The ring solved “add a machine cheaply,” never “one key is too popular.”',
      },
    },
  ],
  bubbles: [
    { term: 'Clockwise rule.', body: 'Walk clockwise from a key; the first node you hit owns it.' },
    { term: 'Virtual nodes.', body: 'Each machine placed at many points so no single node gets a fat slice.' },
  ],
  inTheWild: {
    note: 'where a perfectly balanced ring still tips over',
    points: [
      'Adding a node moves only ~1/N of the keys — but that’s still gigabytes streaming across the network while the cluster serves live traffic. Do it at peak and rebalancing competes with users for the same bandwidth; big clusters deliberately *throttle* it so it doesn’t cause an outage.',
      'One key, one node is fast. But “give me all orders from last week” now has to ask *every* node and merge the answers (a **scatter-gather**). The more finely you split, the slower these whole-dataset questions get.',
      'The ring routes by the *primary* key. Search by anything else — email, status — and that value lives on a different node than the row. You either ask every partition (slow) or keep a *second* index partitioned differently (and now must keep it in sync).',
      'Partition by `user_id`, then later need to query by region? Too late — the data’s already scattered by user. The **partition key is one of the hardest things to change after launch**, because changing it means re-shuffling everything.',
    ],
  },
  tradeoffs: {
    title: 'how should you split the data?',
    rows: [
      { choose: 'By hash of the key', when: 'you want even spread and mostly look keys up one at a time — **user profiles, sessions, key-value**. (consistent hashing)' },
      { choose: 'By key range', when: 'you often scan neighbours in order — **time-series, “orders from March,” anything sorted**. But watch for hot ranges like *today’s* date. (range partitioning)' },
      { choose: 'Replicate the hot key', when: 'one key gets far more traffic than the rest — copy it to several nodes and spread the reads. **A celebrity profile, a global config row.**' },
      { choose: 'Don’t partition yet', when: 'it all still fits on one machine — partitioning adds cross-node queries and rebalancing you don’t need yet. **Scale up before you scale out.**' },
    ],
  },
  misconception: {
    think: '“Consistent hashing means the keys never move.”',
    actually:
      'Actually — adding a node **always** moves some keys; that’s unavoidable if the new node is to hold any data. What consistent hashing guarantees is that it moves the **minimum**: about `1/N`, and only from neighbours — never a full reshuffle.',
  },
  sources: [
    {
      year: '1997',
      title: 'Consistent Hashing and Random Trees — Karger et al. (STOC)',
      url: 'https://dl.acm.org/doi/10.1145/258533.258660',
      note: 'The original result: distributed caching for the early web; where the ring comes from.',
    },
    {
      year: '2007',
      title: 'Dynamo: Amazon’s Highly Available Key-value Store (SOSP)',
      url: 'https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf',
      note: 'Consistent hashing + virtual nodes in production; the design most modern stores copy.',
    },
  ],
  seenIn: [
    { label: 'Kafka — topic partitions', to: '/components/kafka', live: true },
    { label: 'Redis — cluster hash slots', to: '/components/redis', live: true },
    { label: 'Cassandra', note: 'roadmap' },
    { label: 'DynamoDB', note: 'roadmap' },
  ],
  finale: {
    title: 'Watch the ring rebalance under load',
    body: 'You’ve got the idea. Now operate it at production scale: add a node and watch exactly which keys move — the mechanism inside Redis Cluster’s hash slots and Kafka’s partition assignment.',
  },
  next: { slug: 'transactions', title: 'Isolation Levels' },
}
