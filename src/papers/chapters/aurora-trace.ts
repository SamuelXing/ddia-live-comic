import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* A write in a database that has stopped writing pages. The trace exists to
   make one absence visible: at no point does a data page cross the network,
   and at no point is there a round of agreement about whether something
   committed. Six copies, four acknowledgements, and monotonic numbers doing
   the job that Chapter 8 needed a protocol for.

   Violet for the storage tier, because these are segments and this whole
   chapter is about the storage tier being where the interesting work moved.
   Blue for the application and the read replica. Nothing here is amber — there
   is no coordinator and no leader in this picture, which is the point of the
   asynchronous scheme.

   Geometry: the corridor at x≈25 (between the instance zone and storage)
   carries the writer's reach down to the third zone past the second, and the
   corridor at x≈67 (inside the storage zone, right of its nodes) carries the
   peer-to-peer gossip between the top and bottom AZs. The lane at y≈41, below
   every storage box, carries the log stream out to the read replica. */
const C = {
  client: VIZ.blue,
  seg: VIZ.violet,
  cold: VIZ.green,
  bad: VIZ.red,
}

export const auroraTrace: TraceSpec = {
  title: 'A write that ships no pages, and a commit that asks nobody',
  aspect: 0.5,
  zones: [
    { label: 'The instance', x: 2, y: 4, w: 21, h: 42 },
    { label: 'Storage · 6 copies, 3 zones', x: 27, y: 4, w: 42, h: 42 },
    { label: 'Readers and backup', x: 73, y: 4, w: 25, h: 42 },
  ],
  nodes: [
    { id: 'db', x: 4, y: 12, w: 17, h: 9, label: 'Primary', sub: 'never writes a page', color: C.client },
    { id: 'app', x: 4, y: 30, w: 17, h: 8, label: 'Your app', sub: 'waiting on commit', color: C.client },
    { id: 'az1', x: 29, y: 9, w: 36, h: 7, label: 'Zone A · 2 segments', color: C.seg },
    { id: 'az2', x: 29, y: 19, w: 36, h: 7, label: 'Zone B · 2 segments', color: C.seg },
    { id: 'az3', x: 29, y: 29, w: 36, h: 7, label: 'Zone C · 2 segments', color: C.seg },
    { id: 'rep', x: 75, y: 12, w: 21, h: 8, label: 'Read replica', sub: 'same volume, no writes', color: C.client },
    { id: 's3', x: 75, y: 28, w: 21, h: 8, label: 'S3', sub: 'continuous backup', color: C.cold },
  ],
  steps: [
    {
      title: 'One kind of thing crosses the network, and it is not a page',
      prose:
        'A mirrored MySQL puts five different kinds of data on the wire for one write — redo log, binary log, data pages, a second copy of each page to survive a torn write, and metadata files — and three of those steps are <em>sequential</em>, so the latencies add and the slowest one sets the pace. Aurora sends <b>redo log records and nothing else.</b> No pages on eviction, no pages on checkpoint, no pages ever. The records are batched by which <b>protection group</b> they belong to and shipped to all six copies at once. Measured over thirty minutes of the same benchmark: <b>7.4 I/Os per transaction becomes 0.95</b>, and 780,000 transactions becomes 27.4 million.',
      focus: ['db', 'az1', 'az2', 'az3'],
      particles: [
        { from: 'db', to: 'az1', color: C.seg },
        { from: 'db', to: 'az2', color: C.seg },
        { from: 'db', to: 'az3', color: C.seg, via: [{ x: 25, y: 16.5 }, { x: 25, y: 32.5 }] },
      ],
    },
    {
      title: 'Four of six answer, and the slowest two are simply ignored',
      prose:
        'The write is durable when <b>four of the six copies</b> have it on disk. Two copies in each of three zones, a write quorum of 4 and a read quorum of 3 — which survives losing an entire zone <em>plus</em> one more node without losing data, and losing an entire zone without losing the ability to write. The familiar three-copies-two-of-three does not, because a zone failure is <b>correlated</b>: it arrives on top of the background noise of failures rather than instead of it. And the quorum has a second effect that matters every day: <em>a slow storage node is just one of the two you did not wait for.</em>',
      focus: ['az1', 'az2', 'az3', 'db'],
      particles: [
        { from: 'az1', to: 'db', color: C.seg },
        { from: 'az2', to: 'db', color: C.seg },
        { from: 'az3', to: 'db', color: C.seg, via: [{ x: 25, y: 32.5 }, { x: 25, y: 16.5 }] },
      ],
    },
    {
      title: 'The storage node does two things in front and six behind',
      prose:
        'On the foreground path a storage node does exactly two things: <b>put the record in an in-memory queue, persist it, acknowledge.</b> Everything else happens later and out of the way — sorting and grouping records, gossiping with peers to fill gaps, coalescing records into materialised data pages, staging to S3, garbage collecting old versions, scrubbing pages for bit rot. <em>Background work here is negatively correlated with foreground load</em>, which is the reverse of a traditional database, where checkpointing and page flushing get busiest exactly when the system is busiest.',
      focus: ['az2', 's3'],
      particles: [
        { from: 'db', to: 'az2', color: C.seg },
        { from: 'az2', to: 'db', color: C.seg },
        { from: 'az3', to: 's3', color: C.cold },
      ],
    },
    {
      title: 'Missing records get filled in by gossip, not by a protocol',
      prose:
        'Some batches will be lost, so some segments have holes. Chapter 8’s answer would be a round of agreement; this paper refuses to pay for one. Every log record carries a <b>backlink</b> to the previous record for its protection group, so a node can tell exactly where its own sequence breaks, and then <b>peers gossip to exchange what each is missing.</b> Because the database allocates the sequence numbers, the numbers themselves carry the ordering — <em>there is nothing to agree about, only gaps to fill.</em> The paper’s phrase for the whole scheme is asynchronous consensus, and the practical meaning is that no write waits for one.',
      focus: ['az1', 'az2', 'az3'],
      particles: [
        { from: 'az1', to: 'az2', color: C.seg },
        { from: 'az2', to: 'az3', color: C.seg },
        { from: 'az3', to: 'az1', color: C.seg, via: [{ x: 67, y: 32.5 }, { x: 67, y: 12.5 }] },
      ],
    },
    {
      title: 'The commit does not block anybody, including the committer',
      prose:
        'When your transaction commits, the worker thread does not wait. It records the transaction’s commit sequence number on a list and <b>goes off to do other work</b>. Separately, as acknowledgements arrive, a durability point advances — and a dedicated thread wakes up whichever waiting transactions it has just passed and answers their clients. <em>There is no two-phase commit here and no synchronisation point at all</em>, just a number going up. The same log stream is also pushed to the read replicas, which apply records to pages they happen to have cached and discard the rest; the paper measures replica lag at <b>20 milliseconds or less</b>.',
      focus: ['db', 'app', 'rep'],
      particles: [
        { from: 'db', to: 'app', color: C.client },
        { from: 'db', to: 'rep', color: C.client, via: [{ x: 25, y: 16.5 }, { x: 25, y: 41 }, { x: 71, y: 41 }, { x: 71, y: 16 }] },
      ],
    },
    {
      title: 'A read asks one segment, because the writer knows who is current',
      prose:
        'You would expect a read quorum on every read, and there isn’t one. The database <em>issued</em> every log record, so it knows precisely how far each segment has got. When a page is needed it picks a read point, chooses a segment it knows is complete past that point, and <b>reads from that one node.</b> Quorum reads happen only on recovery, when that runtime knowledge has been lost and must be rebuilt. <em>Knowing what you sent is cheaper than asking what arrived</em> — and it works here because there is exactly one writer, which is the simplifying assumption the whole design is allowed to make.',
      focus: ['db', 'az2'],
      particles: [
        { from: 'db', to: 'az2', color: C.client },
        { from: 'az2', to: 'db', color: C.seg },
      ],
    },
    {
      title: 'It crashes, and there is nothing to replay',
      prose:
        'A traditional database restarts at its last checkpoint and replays the redo log to catch up, which is why checkpoint intervals are a tuning knob everybody hates. Here, <b>redo application never stopped</b> — it happens continuously, in the background, on the storage fleet, and it did not care that the database was gone. On restart the instance contacts a read quorum of each protection group, works out the highest durable point, and truncates whatever was above it. The paper reports recovery in <b>under 10 seconds</b> even after crashing at over 100,000 writes a second. <em>Crash recovery stopped being an event and became a thing that was always happening.</em>',
      focus: ['db', 'az1', 'az2', 'az3'],
      particles: [
        { from: 'db', to: 'az1', color: C.bad },
        { from: 'db', to: 'az2', color: C.bad },
        { from: 'az1', to: 'db', color: C.seg },
      ],
    },
  ],
}
