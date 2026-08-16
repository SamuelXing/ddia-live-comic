import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* Dremel's serving tree with the columns hanging off the bottom of it, because
   the two ideas only work together: striping by column is what makes a scan
   cheap enough to be interactive, and the tree is what turns a cheap scan into
   an answer in three seconds instead of an hour.

   Violet for the column stripes, because they are storage. Amber for the tree,
   which is the coordination machinery. Blue for the client. The 198 columns
   nobody asked for are drawn and never touched on purpose — the absence is the
   point, and a diagram that omitted them would be hiding the argument.

   Geometry: the corridor at x≈54 (inside the tree zone, right of its nodes)
   carries nothing; the one that matters is x≈58, between the tree and the
   columns, which routes the leaf's reach up to the first column past the
   second one. */
const C = {
  client: VIZ.blue,
  tree: VIZ.amber,
  col: VIZ.violet,
  bad: VIZ.red,
}

export const columnarTrace: TraceSpec = {
  title: 'Two columns out of two hundred, and a tree that turns a scan into an answer',
  aspect: 0.5,
  zones: [
    { label: 'The question', x: 2, y: 4, w: 18, h: 42 },
    { label: 'The serving tree', x: 24, y: 4, w: 32, h: 42 },
    { label: 'Leaf disks, striped by column', x: 60, y: 4, w: 38, h: 42 },
  ],
  nodes: [
    { id: 'q', x: 4, y: 16, w: 14, h: 9, label: 'Your query', sub: '2 of 200 fields', color: C.client },
    { id: 'root', x: 26, y: 9, w: 26, h: 7, label: 'Root server', sub: 'rewrites the query', color: C.tree },
    { id: 'mid', x: 26, y: 21, w: 26, h: 7, label: '100 intermediates', sub: 'partial aggregation', color: C.tree },
    { id: 'leaf', x: 26, y: 33, w: 26, h: 7, label: '2,900 leaves', sub: 'one slot per thread', color: C.tree },
    { id: 'c1', x: 62, y: 10, w: 34, h: 7, label: 'stripe: country', color: C.col },
    { id: 'c2', x: 62, y: 21, w: 34, h: 7, label: 'stripe: item.amount', color: C.col },
    { id: 'c3', x: 62, y: 32, w: 34, h: 8, label: '198 other stripes', sub: 'never opened', color: C.col },
  ],
  steps: [
    {
      title: 'A question every layout in this book gets wrong',
      prose:
        '<code>SELECT country, SUM(item.amount) GROUP BY country</code>, over a table of <b>24 billion nested records</b> where the amount field repeats about 40 billion times. Nothing in Acts I through V was built for this. Every one of them stores a record’s fields together so that <em>fetching one record</em> is one seek — which is exactly the wrong shape when you want one field out of all of them. Read this query the way the storage layer has to: <b>two fields, and a request to ignore 198 others.</b>',
      focus: ['q', 'root'],
      particles: [{ from: 'q', to: 'root', color: C.client }],
    },
    {
      title: 'The query is rewritten on the way down, not shipped whole',
      prose:
        'The root does not run the query; it <em>rewrites</em> it. The table’s tablets get divided among the next level, and each child receives the same aggregation over its own slice. Each level does this again, so by the time the query reaches the leaves it has become thousands of small independent scans. <b>The shape is borrowed from web search</b>, not from databases — a serving tree, pushing a request down and merging replies on the way back. That inheritance is why the answer comes back in seconds rather than at the pace of the slowest scan.',
      focus: ['root', 'mid', 'leaf'],
      particles: [
        { from: 'root', to: 'mid', color: C.tree, count: 2 },
        { from: 'mid', to: 'leaf', color: C.tree, count: 3 },
      ],
    },
    {
      title: 'The leaf opens two files and leaves the other 198 shut',
      prose:
        'Here is the whole idea. Because every field is stored contiguously, a leaf reads only the stripes the query named. Dremel measured this against a MapReduce over the same table: <b>reading 0.5 TB of columnar data instead of 87 TB of records</b> — an order of magnitude of the difference came from the layout alone, before any query engine got involved. And a stripe is <em>all one type and often nearly sorted</em>, so it compresses far harder than a page with two hundred mixed fields on it.',
      focus: ['leaf', 'c1', 'c2', 'c3'],
      particles: [
        { from: 'leaf', to: 'c1', color: C.col, via: [{ x: 58, y: 36.5 }, { x: 58, y: 13.5 }] },
        { from: 'leaf', to: 'c2', color: C.col },
      ],
    },
    {
      title: 'The values alone cannot say where they came from',
      prose:
        'Real data is not a flat table — it is nested records with optional and repeated fields, and a bare list of values loses that. Two <code>Code</code> values in a stripe: were they two languages in one document, or one language in each of two documents? So each value carries <b>two small integers</b>. The <b>repetition level</b> says which repeated field it repeated at; the <b>definition level</b> says how many optional ancestors were actually present, which is what lets NULLs go unstored entirely. <em>Together they encode the record structure losslessly</em>, so any subset of fields can be read and the records rebuilt.',
      focus: ['c1', 'c2'],
      particles: [
        { from: 'c1', to: 'leaf', color: C.col, via: [{ x: 58, y: 13.5 }, { x: 58, y: 36.5 }] },
        { from: 'c2', to: 'leaf', color: C.col },
      ],
    },
    {
      title: 'Partial answers merge upward, and the tree’s depth matters',
      prose:
        'Each leaf returns its own grouped totals; intermediates merge them; the root merges those. <b>How many levels you need depends on how many groups come back</b> — and this is the measurement worth remembering. A query producing a few hundred countries ran in 3 seconds and gained nothing from an extra level. A query producing <b>1.1 million distinct domains halved</b> when a level was added, because otherwise the root has to merge thousands of replies nearly sequentially. <em>Aggregation is only free when the result is small.</em>',
      focus: ['leaf', 'mid', 'root', 'q'],
      particles: [
        { from: 'leaf', to: 'mid', color: C.tree, count: 3 },
        { from: 'mid', to: 'root', color: C.tree, count: 2 },
        { from: 'root', to: 'q', color: C.client },
      ],
    },
    {
      title: 'One slot is slow, and the dispatcher stops waiting for it',
      prose:
        'With thousands of tablets on a shared cluster, some slot will be unlucky. The dispatcher keeps a histogram of tablet processing times and <b>reschedules the stragglers elsewhere</b>, sometimes more than once — the same instinct as MapReduce’s backup tasks in Chapter 2. It matters most where there are fewer replicas to choose from: on a two-way replicated table, 99% of tablets finished in under 5 seconds while a handful dragged the query from <b>under a minute to several minutes</b>. And there is an escape hatch: ask for <b>98% of tablets instead of 100%</b> and most of the tail disappears.',
      focus: ['mid', 'leaf'],
      particles: [
        { from: 'mid', to: 'leaf', color: C.tree },
        { from: 'leaf', to: 'mid', color: C.tree, count: 2 },
      ],
    },
    {
      title: 'And the crossover, which is the part to remember',
      prose:
        'Columnar is not a free win, it is a trade with a measurable crossover. Retrieval time grows <em>linearly with the number of fields you read</em>, and rebuilding whole records from stripes is expensive — assembly and parsing can each roughly double the time. So there is a point where record-oriented storage wins again, and Dremel puts it plainly: <b>the crossover often lies at dozens of fields.</b> Ask for two columns of two hundred and this is a rout. Ask for most of them, and you have paid for a layout you are not using.',
      focus: ['leaf', 'c3'],
      particles: [
        { from: 'leaf', to: 'c3', color: C.bad, count: 3 },
      ],
    },
  ],
}
