import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* One PageRank job in Spark, and then a machine dies during the sixth
   iteration. Chapter 2's version of this picture had a round trip through the
   file system between every stage; here the file system is touched once, at
   the start, and after that the working set never leaves RAM.

   Colours carry the roles they have carried all book. Blue for the driver,
   because it is the front door and holds no data — it holds the lineage, which
   is instructions rather than bytes. Green for the workers and for HDFS,
   because that is where records sit. Amber for the shuffle: it is coordination
   machinery, the one place in this job where every partition needs data from
   every other. Violet for the checkpoint, which is replication with no
   protocol. Red where something is actually wrong.

   The driver is deliberately NOT a data hop. Records never pass through it —
   it ships closures out and gets an answer back — and drawing a hundred
   gigabytes through the middle box would say something false about where the
   money goes. The one arrow into it is the failure notice.

   Geometry: workers stack in a column at x=31..55 with the shuffle under them,
   so the corridor at x=60 carries the two upper workers' traffic past their
   neighbours. HDFS and the checkpoint sit clear to the right of everything. */
const C = {
  driver: VIZ.blue,
  worker: VIZ.green,
  shuffle: VIZ.amber,
  archive: VIZ.violet,
  bad: VIZ.red,
}

/** the corridor right of the worker column, used to reach past a neighbour */
const lane = (fromY: number, toY: number) => [
  { x: 60, y: fromY },
  { x: 60, y: toY },
]

export const sparkTrace: TraceSpec = {
  title: 'Ten iterations of PageRank, and a machine that dies during the sixth',
  aspect: 0.5,
  zones: [
    { label: 'The driver', x: 2, y: 4, w: 24, h: 42 },
    { label: 'Workers — the working set lives here', x: 28, y: 4, w: 42, h: 42 },
    { label: 'Stable storage', x: 72, y: 4, w: 26, h: 42 },
  ],
  nodes: [
    { id: 'drv', x: 4, y: 14, w: 20, h: 9, label: 'Driver', sub: 'holds the lineage', color: C.driver },
    { id: 'w1', x: 31, y: 9, w: 24, h: 7, label: 'Worker 1', sub: 'links[0] · ranks[0]', color: C.worker },
    { id: 'w2', x: 31, y: 18, w: 24, h: 7, label: 'Worker 2', sub: 'links[1] · ranks[1]', color: C.worker },
    { id: 'w3', x: 31, y: 27, w: 24, h: 7, label: 'Worker 3', sub: 'links[2] · ranks[2]', color: C.worker },
    { id: 'shuf', x: 31, y: 38, w: 24, h: 7, label: 'Shuffle', sub: 'reduceByKey', color: C.shuffle },
    { id: 'hdfs', x: 74, y: 10, w: 22, h: 9, label: 'HDFS', sub: 'the 54 GB link file', color: C.worker },
    { id: 'ckpt', x: 74, y: 30, w: 22, h: 9, label: 'Checkpoint', sub: 'only if you ask for it', color: C.archive },
  ],
  steps: [
    {
      title: 'Nothing has run yet',
      prose:
        'The program reads the link file, maps it into pairs, and calls <b>persist</b>. At this point the cluster has done <em>nothing at all</em>. A transformation computes no data; it records that a new dataset would be the old one with a function applied to it. What the driver accumulates is a graph of those records — <b>the lineage</b> — and the whole chapter turns on how small that graph is. In these jobs it stayed under <b>10 KB</b>, against a working set of a hundred gigabytes.',
      focus: ['drv'],
      particles: [],
    },
    {
      title: 'The first pass is the only one that reads the disk',
      prose:
        'An action fires — somebody asked for an answer, so now something has to happen. Tasks go to the machines that already hold the blocks, each worker reads its slice of the link file, and the result stays in memory as Java objects. <em>This pass is barely faster than the batch job would have been.</em> The paper measures the first iteration of logistic regression at <b>46 s against Hadoop’s 80</b>, and most of that gap is Hadoop’s own startup. The win has not happened yet. The win is that this never has to happen again.',
      focus: ['drv', 'hdfs', 'w1', 'w2', 'w3'],
      particles: [
        { from: 'hdfs', to: 'w1', color: C.worker },
        { from: 'hdfs', to: 'w2', color: C.worker },
        { from: 'hdfs', to: 'w3', color: C.worker },
      ],
    },
    {
      title: 'Every page sends its rank to its neighbours',
      prose:
        'Each worker joins its links against its ranks and emits a contribution along every outgoing edge. Those contributions then have to be summed <b>per destination page</b>, and a page can be linked from anywhere — so this is the step where every partition needs data from every other one. Spark calls that dependency <b>wide</b>, and it is where the job gets cut into stages: everything before it pipelines inside one machine, everything after it has to wait for the exchange.',
      focus: ['w1', 'w2', 'w3', 'shuf'],
      particles: [
        { from: 'w1', to: 'shuf', color: C.worker, via: lane(12.5, 41.5) },
        { from: 'w2', to: 'shuf', color: C.worker, via: lane(21.5, 41.5) },
        { from: 'w3', to: 'shuf', color: C.worker },
      ],
    },
    {
      title: 'And the new ranks go back into memory, not onto a disk',
      prose:
        'The summed contributions become the next iteration’s ranks, sitting in RAM on the machines that will want them. <em>This is the sentence Chapter 2 could not write.</em> In MapReduce the only channel between two jobs was the file system, so ten iterations meant nine full round trips through replicated storage. Take that away and the arithmetic changes shape: later iterations of logistic regression run in <b>3 s where Hadoop takes 76</b>. Same algorithm, same cluster, same data, same answer.',
      focus: ['shuf', 'w1', 'w2', 'w3'],
      particles: [
        { from: 'shuf', to: 'w1', color: C.shuffle, via: lane(41.5, 12.5) },
        { from: 'shuf', to: 'w2', color: C.shuffle, via: lane(41.5, 21.5) },
        { from: 'shuf', to: 'w3', color: C.shuffle },
      ],
    },
    {
      title: 'Worker 2 dies, and takes a third of the working set with it',
      prose:
        'The machine is gone and so are its partitions — held only in memory, with no second copy anywhere on the cluster. This is the moment the design has to answer for, because it is exactly the moment that made everyone believe in-memory computing was a bad bet. <em>Replicating that memory was the obvious fix, and nobody could afford it:</em> a hundred gigabytes copied across a network far slower than RAM, and twice the memory to hold what you copied.',
      focus: ['w2', 'drv'],
      particles: [{ from: 'w2', to: 'drv', color: C.bad }],
    },
    {
      title: 'The driver knows how to make it again',
      prose:
        'It reads the lineage, works out that only <b>links[1] and ranks[1]</b> are missing, and schedules the tasks that rebuild exactly those — on a machine that is still alive, from an input block that never moved. Nobody rolls back and nothing else recomputes, because nothing else was wrong. In the paper’s measurement of precisely this, a k-means iteration takes <b>58 s</b>, the iteration in which a machine is killed takes <b>80 s</b>, and the next one is back to <b>58 s</b>.',
      focus: ['drv', 'hdfs', 'w3', 'shuf'],
      particles: [
        { from: 'drv', to: 'w3', color: C.driver, via: [{ x: 27, y: 30.5 }] },
        { from: 'hdfs', to: 'w3', color: C.worker },
        { from: 'w3', to: 'shuf', color: C.worker },
      ],
    },
    {
      title: 'And the one case where remembering is not enough',
      prose:
        'The lineage gains a link per iteration and every one of them is wide. Lose a machine at iteration ninety and the rebuild can reach back through <em>all</em> of them, because a wide dependency means the missing partition may have drawn from any partition of its parent — which may have drawn from any partition of <em>its</em> parent. So checkpointing comes back, not as the mechanism but as <b>a thing you choose to do</b>: write some version of the ranks to stable storage and cut the chain there. <em>The links never need it. They can be rebuilt with a map over a file.</em>',
      focus: ['w1', 'ckpt'],
      particles: [{ from: 'w1', to: 'ckpt', color: C.archive }],
    },
  ],
}
