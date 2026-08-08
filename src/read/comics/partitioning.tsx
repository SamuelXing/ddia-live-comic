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
      body: [
        'Grow from four nodes to five and the modulo shifts under **almost every key**. Data that never needed to move gets rehashed to a different node all at once.',
      ],
      callout: {
        kind: 'bad',
        big: '~80%',
        text: 'of keys relocate on a single **4 → 5** resize. A live cluster spends the afternoon shuffling instead of serving.',
      },
    },
    {
      n: 'Step 03',
      title: 'Put everything on a ring',
      diagram: <RingDiagram />,
      body: [
        '**Consistent hashing** lays nodes *and* keys on the same circular hash space, `0 … 2³²−1`. A key belongs to the first node it meets travelling **clockwise**.',
        'Nothing is stored in a lookup table — the owner is computed. The ring is just an ordering, and ordering barely changes when you add one node.',
      ],
    },
    {
      n: 'Detail',
      title: 'The lookup, in full',
      code: {
        file: 'ring.py',
        lines: [
          { t: 'ring = sorted(hash(n) for n in nodes)' },
          { t: '' },
          { t: 'def owner(key):' },
          { t: '    h = hash(key)' },
          { t: '    for point in ring:      # first node,', hl: 'good' },
          { t: '        if point >= h:      # …clockwise', hl: 'good' },
          { t: '            return point' },
          { t: '    return ring[0]          # wrap around' },
        ],
      },
    },
    {
      n: 'Step 04',
      title: 'Add a node, calmly',
      accent: 'denim',
      body: [
        'Drop a new node onto the ring. Only the keys sitting between it and its **clockwise neighbour** move to it. One slice changes hands — the rest of the cluster never notices.',
      ],
      callout: {
        kind: 'good',
        big: '≈ 1/N',
        text: 'of keys relocate when you add the Nᵗʰ node. Compare that to **~80%**. This is the whole reason the ring exists.',
      },
    },
  ],
  bubbles: [
    { term: 'Hash space.', body: 'A fixed circle, 0 → 2³²−1. Nodes and keys both land somewhere on it.' },
    { term: 'Clockwise rule.', body: 'Walk clockwise from a key; the first node you hit owns it.' },
    { term: 'Virtual nodes.', body: 'Place each machine at many points so no single node gets a fat slice.' },
  ],
  seenIn: [
    { label: 'Kafka — topic partitions', to: '/components/kafka', live: true },
    { label: 'Redis — cluster hash slots', to: '/components/redis', live: true },
    { label: 'Cassandra', note: 'roadmap' },
    { label: 'DynamoDB', note: 'roadmap' },
  ],
  finale: {
    title: 'Watch the ring rebalance',
    body: 'This is the mechanism inside Redis Cluster’s hash slots and Kafka’s partition assignment. Open a component to see the same idea running at production scale.',
  },
  next: { slug: 'replication-leader', title: 'Leader & Followers' },
}
