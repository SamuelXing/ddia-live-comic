import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* A commit and a read against the same table, on a store that cannot do either
   of them. The trace exists because the design is entirely a sequence — which
   object you touch first, and what is invisible until the last step — and a
   still picture of a directory listing cannot show that a Parquet file has been
   sitting there for a minute while nobody could see it.

   Colours: green on the data objects, since they are the store. Amber on the
   log and the pointer, which are the coordinator here — the whole paper is
   about getting coordination out of a service and into two objects. Violet on
   the checkpoint, because it is a derived copy of the log and nothing else.
   Blue on the two clients. Red only on the losing commit.

   Geometry: the writer is on the left and the reader on the right with the
   store between them, so nothing has to cross a zone it does not touch. The
   middle column is stacked in the order a reader touches it — pointer,
   checkpoint, log, data — so every hop is to an immediate neighbour and no
   route has to be bent around anything. That ordering is not cosmetic: an
   earlier draft put the log between the pointer and the checkpoint, and every
   route from one to the other cut straight through it. */
const C = {
  client: VIZ.blue,
  data: VIZ.green,
  log: VIZ.amber,
  ckpt: VIZ.violet,
  lost: VIZ.red,
}

export const deltaTrace: TraceSpec = {
  title: 'One directory in an object store, behaving like a table',
  aspect: 0.56,
  zones: [
    /* the two client zones are short on purpose — they hold one box each, and
       running them the full height of the table zone left two large empty
       rectangles flanking the only column with anything in it */
    { label: 'The writer', x: 2, y: 17, w: 30, h: 24 },
    { label: 'The table', x: 34, y: 4, w: 32, h: 46 },
    { label: 'The reader', x: 68, y: 17, w: 30, h: 24 },
  ],
  nodes: [
    { id: 'job', x: 5, y: 24, w: 26, h: 10, label: 'A Spark job', sub: 'wants to add rows', color: C.client },
    { id: 'ptr', x: 36, y: 8, w: 28, h: 8, label: '_last_checkpoint', sub: 'one tiny object', color: C.log },
    { id: 'ckpt', x: 36, y: 19, w: 28, h: 8, label: 'Checkpoint', sub: 'the log, compacted', color: C.ckpt },
    { id: 'log', x: 36, y: 30, w: 28, h: 8, label: 'The log', sub: '000004.json …', color: C.log },
    { id: 'data', x: 36, y: 41, w: 28, h: 7, label: 'Parquet objects', color: C.data },
    { id: 'q', x: 70, y: 24, w: 26, h: 10, label: 'A BI query', sub: 'one narrow filter', color: C.client },
  ],
  steps: [
    {
      title: 'The store cannot do any of this',
      prose:
        'Everything here lives in one directory of an object store, and the store offers a key-value interface with <b>no atomicity across keys</b>. Write two objects and a reader may see one of them. Crash halfway and the table is corrupt. Listing is worse than it sounds: a LIST returns a thousand keys per call at tens to hundreds of milliseconds, so finding the objects in a large table can take longer than reading them. <em>Roughly half of Databricks’ support escalations in 2014–2016 were this.</em>',
      focus: ['data', 'log'],
      particles: [],
    },
    {
      title: 'A reader starts at the pointer, not at the data',
      prose:
        'The first move is a single small read of <code>_last_checkpoint</code>, which names the most recent compacted checkpoint. That one object is why the rest is cheap: it turns “which objects are in this table” from an open-ended search into <b>a read at a known key</b>. Nothing has been listed yet.',
      focus: ['q', 'ptr'],
      particles: [{ from: 'q', to: 'ptr', color: C.client }],
    },
    {
      title: 'The checkpoint, then whatever happened since',
      prose:
        'It reads the checkpoint — a Parquet file holding one record per object still in the table — and then lists <em>forward from that number</em> for the handful of JSON records written since. Log ids are zero-padded on purpose, so a lexicographic LIST from a known key returns exactly the new ones. Checkpoints are written <b>every ten transactions</b> by default, so “whatever happened since” is small by construction.',
      focus: ['ptr', 'ckpt', 'log'],
      particles: [
        { from: 'ptr', to: 'ckpt', color: C.ckpt },
        { from: 'ckpt', to: 'log', color: C.log },
      ],
    },
    {
      title: 'And it already knows what is inside each object',
      prose:
        'Every <code>add</code> record carries the object’s statistics — row count, per-column minimum and maximum, null counts. So the reader now has, from one small read and one short list, both the membership of the table and enough to <b>skip most of it</b>. The alternative it replaced was opening each Parquet footer in turn, which on an object store can cost more than the query.',
      focus: ['ckpt', 'log', 'data'],
      particles: [{ from: 'log', to: 'data', color: C.data, count: 2 }],
    },
    {
      title: 'Meanwhile the writer has been writing, invisibly',
      prose:
        'The job writes its new Parquet objects first, with GUID names, in parallel, before committing anything. <em>They are already in the store and they are not in the table</em> — no log record mentions them, so no reader can see them. This is what makes a crash harmless rather than corrupting: an abandoned write leaves objects nobody references, which is litter, not damage.',
      focus: ['job', 'data'],
      particles: [{ from: 'job', to: 'data', color: C.data, count: 2, via: [{ x: 33, y: 44 }] }],
    },
    {
      title: 'The commit is one create of the next number',
      prose:
        'The whole transaction turns on a single operation: <b>create <code>000005.json</code> only if it does not already exist.</b> That one object atomically adds every new Parquet file and removes every replaced one, however many there are. There is no lock, no coordinator in the read path, and nothing that has to be running when nobody is querying.',
      focus: ['job', 'log'],
      particles: [{ from: 'job', to: 'log', color: C.log }],
    },
    {
      title: 'Two writers, one number',
      prose:
        'Concurrency is optimistic, so the second writer simply loses the create and retries against version 5 — often keeping the objects it already wrote and committing them as 000006. Serializability comes from the fact that only one client can create each id. <b>The bill is in that sentence</b>: commit rate is bounded by how fast the store can do one conditional create, which is tens to hundreds of milliseconds, so a table takes a few transactions per second — fine for jobs that batch, useless for anything OLTP-shaped.',
      focus: ['job', 'log'],
      particles: [
        { from: 'job', to: 'log', color: C.lost, via: [{ x: 33, y: 34 }] },
        { from: 'log', to: 'job', color: C.lost, via: [{ x: 33, y: 34 }] },
      ],
    },
  ],
}
