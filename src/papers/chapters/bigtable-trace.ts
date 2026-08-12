import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* Colors follow the role semantics: client blue, tablet-server machinery amber,
   memtable (RAM store) green, everything GFS-durable violet, the crash red. */
const C = {
  client: VIZ.blue,
  server: VIZ.amber,
  ram: VIZ.green,
  gfs: VIZ.violet,
  crash: VIZ.red,
}

/* Standard three-zone layout (see trace-geometry.md). The corridor x≈47–78 at
   row y 8–16 is kept empty so front↔log hops run straight; compaction sits low
   in the middle zone so flush (mem→sst8) passes above it. */
export const bigtableWriteTrace: TraceSpec = {
  title: 'One write through Bigtable — and the crash that proves the design',
  aspect: 0.5,
  zones: [
    { label: 'Client', x: 2, y: 4, w: 21, h: 42 },
    { label: 'Tablet server — RAM', x: 27, y: 4, w: 45, h: 42 },
    { label: 'GFS (×3)', x: 76, y: 4, w: 22, h: 42 },
  ],
  nodes: [
    { id: 'app', x: 4.5, y: 9, w: 16, h: 7, label: 'Your app', sub: 'one row mutation', color: C.client },
    { id: 'front', x: 29.5, y: 8, w: 17, h: 8, label: 'Tablet server', sub: 'owns this key range', color: C.server },
    { id: 'mem', x: 29.5, y: 21, w: 17, h: 8, label: 'Memtable', sub: 'sorted, in RAM', color: C.ram },
    { id: 'cmp', x: 51, y: 34, w: 18, h: 7.5, label: 'Compaction', sub: 'background merge', color: C.server },
    { id: 'log', x: 78.5, y: 8, w: 18, h: 7, label: 'Commit log', sub: 'append-only', color: C.gfs },
    { id: 'sst7', x: 78.5, y: 18.5, w: 18, h: 7, label: 'SSTable-7', sub: 'immutable, sorted', color: C.gfs },
    { id: 'sst8', x: 78.5, y: 28, w: 18, h: 7, label: 'SSTable-8', sub: 'from the last flush', color: C.gfs },
    { id: 'sst9', x: 78.5, y: 38, w: 18, h: 7, label: 'SSTable-9', sub: 'compacted', color: C.gfs },
  ],
  steps: [
    {
      title: 'A write arrives at the range that owns it',
      prose:
        'The client looked up which tablet server owns the key range containing <code>com.cnn.www</code> (a METADATA lookup, cached) and sends the mutation straight to it. Note what the server does <b>not</b> do next: it does not find the row&rsquo;s page on disk — <em>there is no page, and no way to edit one if there were</em>.',
      focus: ['app', 'front'],
      particles: [{ from: 'app', to: 'front', color: C.client }],
    },
    {
      title: 'Append to the commit log — the only durable act',
      prose:
        'The mutation is appended to the tablet server&rsquo;s <b>commit log — a file in GFS</b>, replicated to three chunkservers as it lands. This one sequential append is the <em>entire</em> durability story: no page write, no in-place anything. The disks only ever see the operation they are best at.',
      focus: ['front', 'log'],
      particles: [{ from: 'front', to: 'log', color: C.gfs, count: 3 }],
    },
    {
      title: 'Into the memtable, then ack',
      prose:
        'The same mutation is inserted into the <b>memtable</b> — a sorted structure in RAM — and the client gets its ack. Total cost of a durable write: <b>one sequential append plus one in-memory insert</b>. The tablet server&rsquo;s local disk was not touched; it holds nothing worth keeping.',
      focus: ['front', 'mem', 'app'],
      particles: [
        { from: 'front', to: 'mem', color: C.ram },
        { from: 'front', to: 'app', color: C.client },
      ],
    },
    {
      title: 'The memtable fills — flush it, already sorted',
      prose:
        'At a size threshold the memtable is frozen and streamed out to GFS as a brand-new <b>SSTable</b>: an immutable file of sorted key-value entries with its index at the tail. Because the memtable was kept sorted in RAM, the flush is <em>one sequential write of pre-sorted data</em>. The old log prefix is now redundant and can be dropped.',
      focus: ['mem', 'sst8'],
      particles: [{ from: 'mem', to: 'sst8', color: C.gfs, count: 2 }],
    },
    {
      title: 'Reads must merge — the debt appears',
      prose:
        'Now the truth about one row may be spread across the memtable <em>and</em> several SSTables. A read merges them, newest first — bloom filters skip most files, but not for free. This is the bill for cheap writes: <b>the LSM tax moved from the write path to the read path</b>, where sorted layout keeps it small for range scans.',
      focus: ['front', 'mem', 'sst7', 'sst8'],
      particles: [
        { from: 'front', to: 'mem', color: C.ram },
        { from: 'front', to: 'sst7', color: C.gfs },
        { from: 'front', to: 'sst8', color: C.gfs },
      ],
    },
    {
      title: 'Compaction repays it in the background',
      prose:
        'A background pass merge-sorts several SSTables into one and deletes the inputs — settling the read debt, discarding shadowed versions, and finally making deletes real (a delete was only ever a <em>tombstone</em> record appended like any other write). Note the shape: compaction <b>reads whole files and writes a whole new file</b>. Still nothing edited in place.',
      focus: ['cmp', 'sst7', 'sst8', 'sst9'],
      particles: [
        { from: 'sst7', to: 'cmp', color: C.gfs },
        { from: 'sst8', to: 'cmp', color: C.gfs },
        { from: 'cmp', to: 'sst9', color: C.gfs },
      ],
    },
    {
      title: 'Kill the server — the design shrugs',
      prose:
        'The tablet server dies mid-flight. Its lease in Chubby expires; the master reassigns its tablets to living servers. The new owner opens the SSTables <em>where they already are</em> — in GFS — and replays the commit log <em>from GFS</em> to rebuild the memtable. <b>Nothing local existed, so nothing was lost and nothing is copied.</b> A machine death became a scheduling event — read the whole trace backwards and notice every arrow only ever appended.',
      focus: ['log', 'front', 'sst7'],
      particles: [
        { from: 'log', to: 'front', color: C.crash },
        { from: 'sst7', to: 'front', color: C.gfs, via: [{ x: 74, y: 22 }, { x: 74, y: 12 }] },
      ],
    },
  ],
}
