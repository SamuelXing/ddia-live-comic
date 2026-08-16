import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* The trace IS the chapter's argument: the middle zone is Dynamo's half and
   the right zone is Bigtable's half, and one write crosses from one into the
   other. No other chapter's figure has to hold two papers at once.

   Role semantics as everywhere: client blue, whichever node is coordinating
   amber, anything holding bytes violet, the failure red. Amber moves here for
   the same reason it moves in Dynamo — any node can coordinate.

   Geometry: two empty corridors carry everything awkward. x≈57.5 runs inside
   the ring zone to the right of the nodes, so the coordinator can reach the
   third replica without cutting through the second. x≈23.5 sits in the gap
   between the client and the ring, and carries the second concurrent write
   down to node C past both of the nodes above it. */
const C = {
  client: VIZ.blue,
  coord: VIZ.amber,
  data: VIZ.violet,
  bad: VIZ.red,
}

export const cassandraWriteTrace: TraceSpec = {
  title: 'One write, across both halves — the ring on the left, the storage engine on the right',
  aspect: 0.5,
  zones: [
    { label: 'Client', x: 2, y: 4, w: 20, h: 42 },
    { label: 'The ring', x: 25, y: 4, w: 34, h: 42 },
    { label: 'Inside node B', x: 62, y: 4, w: 35, h: 42 },
  ],
  nodes: [
    { id: 'app', x: 4, y: 8, w: 16, h: 8, label: 'Inbox Search', sub: 'insert / get', color: C.client },
    { id: 'a', x: 28, y: 8, w: 28, h: 7.5, label: 'Node A', sub: 'took the call', color: C.coord },
    { id: 'b', x: 28, y: 19, w: 28, h: 7.5, label: 'Node B', sub: 'replica — drawn right', color: C.data },
    { id: 'c', x: 28, y: 30, w: 28, h: 7.5, label: 'Node C', sub: 'replica, other coast', color: C.data },
    { id: 'log', x: 65, y: 8, w: 29, h: 7, label: 'Commit log', sub: 'own disk, append only', color: C.data },
    { id: 'mem', x: 65, y: 19, w: 29, h: 7, label: 'Memtable', sub: 'in RAM, sorted', color: VIZ.green },
    { id: 'sst', x: 65, y: 30, w: 29, h: 8, label: 'Data files', sub: 'immutable + bloom filter', color: C.data },
  ],
  steps: [
    {
      title: 'Any node will do — that part is Dynamo',
      prose:
        'The client sends <code>insert(user_id, word, message_id)</code> to whichever node it feels like. That node hashes the key, works out from its own copy of the ring who owns it, and <b>becomes the coordinator for this request</b>. There is no master to ask and no lookup to perform: every node already knows the whole ring, because membership is gossiped. <em>The node that coordinates the next write may be a different one, and nothing anywhere records that this one ever did.</em>',
      focus: ['app', 'a'],
      particles: [{ from: 'app', to: 'a', color: C.client }],
    },
    {
      title: 'Fan out to N, wait for a quorum',
      prose:
        'The coordinator sends the write to the replicas for that key and waits. How those replicas are chosen is a policy the application picks — <b>rack-unaware</b> walks the ring, while <b>rack-aware</b> and <b>datacenter-aware</b> deliberately spread the copies so that losing a rack, or a coast, loses one copy rather than all of them. Inbox Search ran across east and west coast datacentres for exactly this reason. The coordinator answers the client once a quorum has acknowledged.',
      focus: ['a', 'b', 'c'],
      particles: [
        { from: 'a', to: 'b', color: C.data },
        { from: 'a', to: 'c', color: C.data, via: [{ x: 57.5, y: 11.75 }, { x: 57.5, y: 33.75 }] },
        { from: 'b', to: 'a', color: C.data },
        { from: 'a', to: 'app', color: C.coord },
      ],
    },
    {
      title: 'Inside a replica — and notice what does not happen',
      prose:
        'Two things, in this order. The bytes are appended to a <b>commit log on its own dedicated disk</b>, which only ever writes sequentially, and only after that succeeds is an in-memory structure updated. <b>Nothing was read.</b> No B-tree page fetched to find where the row lives, no lock taken, no old value examined. That is the entire reason this design exists — the paper is running <em>billions of writes a day</em>, and a design that reads before it writes has already lost.',
      focus: ['b', 'log', 'mem'],
      particles: [
        { from: 'b', to: 'log', color: C.data },
        { from: 'log', to: 'mem', color: VIZ.green },
      ],
    },
    {
      title: 'The memtable fills, and becomes a file nobody will ever edit',
      prose:
        'When the in-memory structure passes a threshold it is dumped to disk in one sequential pass, carrying an index of its keys and a <b>bloom filter</b> summarising them. That file is now immutable — which is why <em>reading it needs no lock at all</em>, and the paper says the server is “practically lockless”. Files accumulate, so a background merge collapses them, and it is careful about which: it will never compact a 100 GB file against one under 50 GB. This half is Bigtable, almost unchanged.',
      focus: ['mem', 'sst'],
      particles: [
        { from: 'mem', to: 'sst', color: VIZ.green, count: 2 },
      ],
    },
    {
      title: 'A read pays for all of that',
      prose:
        'The memtable is checked first, then the files, newest to oldest. The bloom filter on each one answers <em>definitely not here</em> cheaply, so most files are skipped without a seek. Then the <b>column index</b> — generated every 256 KB as the columns were written — jumps straight to the right chunk instead of scanning. For Inbox Search this delivered a median around <b>16 ms</b>, with the worst term search at 44 ms. <em>Cheap writes are paid for on the read side; that is the LSM bargain, and the interlude named it.</em>',
      focus: ['app', 'a', 'b', 'mem', 'sst'],
      particles: [
        { from: 'app', to: 'a', color: C.client },
        { from: 'a', to: 'b', color: C.data },
        { from: 'b', to: 'mem', color: VIZ.green },
        { from: 'b', to: 'sst', color: C.data },
        { from: 'sst', to: 'a', color: C.data, via: [{ x: 60.5, y: 34 }, { x: 60.5, y: 11.75 }] },
        { from: 'a', to: 'app', color: C.coord },
      ],
    },
    {
      title: 'Two writes at once — and here it parts company with Dynamo',
      prose:
        'Two updates to the same cell land on different coordinators. Dynamo would keep both and hand them to your code. Cassandra does not: <b>every column carries a timestamp, and the highest one wins.</b> No siblings, no merge function, nothing for the application to implement. And the granularity is the <b>column</b>, not the row — two writes touching different columns of one row both survive, so the common case is not a conflict at all. <em>Crucially, deciding this required reading nothing</em>, which is the property the whole design is protecting.',
      focus: ['app', 'a', 'c'],
      particles: [
        { from: 'app', to: 'a', color: C.client },
        { from: 'app', to: 'c', color: C.client, via: [{ x: 23.5, y: 12 }, { x: 23.5, y: 33.75 }] },
        { from: 'a', to: 'c', color: C.data, via: [{ x: 57.5, y: 11.75 }, { x: 57.5, y: 33.75 }] },
      ],
    },
    {
      title: 'And the bill arrives as a clock',
      prose:
        '“Highest timestamp wins” is only as good as the clocks producing them, and these are wall clocks on commodity machines. A node running a few seconds fast writes values that <b>beat every later write</b> until real time catches up. A node running slow writes values that are accepted, replicated, acknowledged — and then quietly lose to something older on the next read. <b>There is no error and no metric for this.</b> Dynamo paid for concurrency detection with a read before every write; Cassandra declined to pay, and the invoice is addressed to your NTP configuration.',
      focus: ['a', 'c', 'app'],
      particles: [
        { from: 'c', to: 'a', color: C.bad, via: [{ x: 57.5, y: 33.75 }, { x: 57.5, y: 11.75 }] },
        { from: 'a', to: 'app', color: C.bad },
      ],
    },
  ],
}
