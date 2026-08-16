import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* Two compute clusters on one copy of the data, which is the whole
   architecture in one picture. The thing to make visible is that the arrows
   between the warehouses and the storage are the only ones that carry table
   data — the warehouses never talk to each other, never own anything, and can
   be destroyed mid-sentence without the database noticing.

   Amber for the cloud services layer, because it is the coordination machinery
   and the only stateful thing besides the object store. Blue for compute,
   which is deliberately disposable. Green for S3, the one durable thing.

   Geometry: the corridor at x≈62 (inside the warehouse zone, right of its
   nodes) carries the top warehouse's reach down to the cache past the bottom
   one, and the lane at y≈44 — below every warehouse box — carries the
   transaction manager's reach across to the retained older versions. */
const C = {
  svc: VIZ.amber,
  vw: VIZ.blue,
  store: VIZ.green,
  bad: VIZ.red,
}

export const snowflakeTrace: TraceSpec = {
  title: 'Two clusters, one copy of the data, and nothing in between that has to be moved',
  aspect: 0.5,
  zones: [
    { label: 'Cloud services', x: 2, y: 4, w: 26, h: 42 },
    { label: 'Virtual warehouses', x: 32, y: 4, w: 32, h: 42 },
    { label: 'Object storage', x: 68, y: 4, w: 30, h: 42 },
  ],
  nodes: [
    { id: 'svc', x: 4, y: 10, w: 22, h: 8, label: 'Optimizer', sub: 'prunes by min/max', color: C.svc },
    { id: 'txn', x: 4, y: 24, w: 22, h: 8, label: 'Transactions', sub: 'a version is a file set', color: C.svc },
    { id: 'vw1', x: 34, y: 10, w: 26, h: 8, label: 'Warehouse A', sub: 'bulk load · 32 nodes', color: C.vw },
    { id: 'vw2', x: 34, y: 24, w: 26, h: 8, label: 'Warehouse B', sub: 'dashboards · small', color: C.vw },
    { id: 'cache', x: 34, y: 36, w: 26, h: 6, label: 'Local SSD cache · LRU', color: C.vw },
    { id: 's3', x: 70, y: 12, w: 26, h: 9, label: 'Table files', sub: 'immutable · columns inside', color: C.store },
    { id: 's3b', x: 70, y: 28, w: 26, h: 9, label: 'Older file versions', sub: 'kept up to 90 days', color: C.store },
  ],
  steps: [
    {
      title: 'Two clusters, one dataset, and not one byte copied between them',
      prose:
        'A bulk load is running on a large warehouse; a dashboard is querying on a small one. <b>They see exactly the same tables</b>, because neither of them owns any data — the tables live in the object store and the warehouses are pure compute. That single fact is what the whole design is for. In a shared-nothing warehouse, giving those two workloads separate machines means giving them separate <em>copies</em>, which is why organisations ended up with data marts. Here it means starting a second cluster, and <b>shutting it down again when nobody is querying</b>.',
      focus: ['svc', 'vw1', 'vw2'],
      particles: [
        { from: 'svc', to: 'vw1', color: C.svc },
        { from: 'svc', to: 'vw2', color: C.svc },
      ],
    },
    {
      title: 'Decide what not to read, before reading anything',
      prose:
        'There are no indexes here, and that is deliberate: an index needs random access, needs maintaining on every load, and — the reason that actually settled it — <em>needs the user to decide it should exist</em>, which is against the whole no-knobs premise. Instead the service layer keeps <b>the minimum and maximum of each column in each file</b>, and a predicate that cannot possibly match a file’s range eliminates it before a single byte is fetched. This metadata is orders of magnitude smaller than the data, costs almost nothing to maintain, and needs nobody’s opinion.',
      focus: ['svc', 'vw2', 's3'],
      particles: [
        { from: 'svc', to: 'vw2', color: C.svc },
        { from: 'vw2', to: 's3', color: C.store },
      ],
    },
    {
      title: 'Fetch the columns, not the files',
      prose:
        'Each table file is immutable and holds its rows <b>grouped by column inside the file</b> — the hybrid layout from Chapter 15 rather than one file per column. That choice is forced by the storage: an object store rewrites whole objects and cannot append, <em>but it will serve a byte range</em>. So a worker reads the file header, looks up where each column starts, and issues range requests for only the columns it wants. <b>The storage system’s API shaped the file format</b>, which is what happens when you build a database on something you did not write.',
      focus: ['vw2', 's3'],
      particles: [
        { from: 'vw2', to: 's3', color: C.vw },
        { from: 's3', to: 'vw2', color: C.store, count: 3 },
      ],
    },
    {
      title: 'The cache does the work, and nobody is in charge of it',
      prose:
        'Object storage is durable and slow, so each worker keeps a local SSD cache of the file headers and columns it has read. The optimizer assigns files to workers by <b>consistent hashing on the file name</b>, so the same file lands on the same worker across queries and the cache actually hits. The eviction policy is plain <b>LRU, oblivious to which query asked</b> — the paper’s own word for how well that works is “surprisingly”. <em>And when the cluster is resized, nothing is moved</em>: the hashing simply changes, and the caches drift into their new shape over subsequent queries.',
      focus: ['vw2', 'cache', 's3'],
      particles: [
        { from: 's3', to: 'cache', color: C.store },
        { from: 'cache', to: 'vw2', color: C.vw },
      ],
    },
    {
      title: 'One worker is slow, so the others take its work',
      prose:
        'Rented machines vary — same instance type, different throughput — so skew is the norm rather than an incident. A worker that finishes its files early asks its peers for more, and a peer holding a long queue <b>hands over ownership of one file</b> for the duration of this query. Then the detail worth stealing: <em>the requester downloads that file from the object store, not from the straggler.</em> <b>Helping must not put more load on the machine that was already struggling</b> — which is the mistake the obvious implementation makes.',
      focus: ['vw1', 'cache', 's3'],
      particles: [
        { from: 'vw1', to: 'cache', color: C.bad, via: [{ x: 62, y: 14 }, { x: 62, y: 39 }] },
        { from: 's3', to: 'vw1', color: C.store },
      ],
    },
    {
      title: 'A write adds files and removes files, and the removed ones stay',
      prose:
        'Files cannot be modified, so a write produces a <b>new version of the table: a new set of files.</b> That gives snapshot isolation almost for free — a transaction reads the file set as of its start — and then the same mechanism is spent several more times. Removed files are <b>retained for up to 90 days</b>, so <code>SELECT ... AT(OFFSET =&gt; -86400)</code> reads the table as it stood yesterday, <code>UNDROP</code> restores a database somebody deleted, and <b>cloning a multi-terabyte table copies no data at all</b> — it copies a list of files. <em>One immutability decision, four features.</em>',
      focus: ['txn', 's3', 's3b'],
      particles: [
        { from: 'txn', to: 's3b', color: C.svc, via: [{ x: 30, y: 28 }, { x: 30, y: 44 }, { x: 66, y: 44 }, { x: 66, y: 32.5 }] },
        { from: 's3b', to: 'vw2', color: C.store },
      ],
    },
    {
      title: 'And the cluster you were querying is replaced under you',
      prose:
        'Because compute owns nothing, resizing is not a data-movement problem and neither is upgrading. Snowflake runs <b>two versions of the service side by side</b> — two sets of cloud services against one metadata store, and warehouses of different versions <em>sharing the same worker nodes and their caches</em>, so an upgrade does not even cost a cold cache. They shipped weekly on this basis, and could downgrade quickly when something was wrong. <b>The elasticity is the same trick pointed at the user:</b> a load taking 15 hours on 4 nodes takes about 2 on 32, for roughly the same number of node-hours.',
      focus: ['vw1', 'vw2', 'cache'],
      particles: [
        { from: 'vw1', to: 'cache', color: C.vw, via: [{ x: 62, y: 14 }, { x: 62, y: 39 }] },
        { from: 'cache', to: 'vw2', color: C.vw },
      ],
    },
  ],
}
