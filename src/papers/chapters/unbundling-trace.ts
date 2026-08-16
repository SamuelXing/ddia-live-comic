import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* The book's last trace, and the one thing in it a reader should not take on
   trust: that a stream operator can hold state, survive being killed, and hand
   that state to somebody else — without a database in the middle. The paper's
   Figures 3 and 4 are static and separate; the interesting part is that they
   are the same picture at two moments.

   The example is the paper's own word counter, deliberately. It is small
   enough that nothing is hidden, and it contains a repartition, a stateful
   operator and a recovery, which is the whole of Samza.

   Colours: blue on the source, since it is upstream and stateless. Amber on
   the two operators, which are the machinery. Green on the local store, which
   is exactly what it is. Violet on the changelog, because it is a replication
   log and it is drawn as one. Red on the crash.

   Geometry: the two Kafka topics are drawn as full-width bands rather than
   boxes, because the point being made is that the operators do not talk to
   each other at all — everything crosses a band. Particles therefore go
   vertically between rows and never sideways along one, which also keeps
   every route clear of the labels. */
const C = {
  source: VIZ.blue,
  op: VIZ.amber,
  store: VIZ.green,
  changelog: VIZ.violet,
  crash: VIZ.red,
}

export const unbundlingTrace: TraceSpec = {
  title: 'A word counter that keeps its own state, dies, and comes back right',
  aspect: 0.58,
  zones: [
    /* narrow, because there is one box in it and it feeds the topic below it
       on the left — a full-width band here read as a row with something
       missing from the right of it */
    { label: 'Producers', x: 2, y: 3, w: 48, h: 13 },
    { label: 'Kafka', x: 2, y: 18, w: 96, h: 13 },
    { label: 'The job', x: 2, y: 33, w: 96, h: 22 },
  ],
  nodes: [
    { id: 'src', x: 6, y: 6, w: 30, h: 8, label: 'Web servers', sub: 'raw strings', color: C.source },
    { id: 'strings', x: 6, y: 21, w: 40, h: 8, label: 'topic: strings', sub: '2 partitions', color: C.changelog },
    { id: 'words', x: 54, y: 21, w: 40, h: 8, label: 'topic: words', sub: 'keyed by word', color: C.changelog },
    { id: 'split', x: 6, y: 36, w: 26, h: 9, label: 'SplitWords', sub: 'no state at all', color: C.op },
    { id: 'count', x: 40, y: 36, w: 26, h: 9, label: 'CountWords', sub: 'one task per partition', color: C.op },
    { id: 'store', x: 72, y: 36, w: 22, h: 9, label: 'RocksDB', sub: 'on local disk', color: C.store },
    { id: 'clog', x: 40, y: 48, w: 54, h: 6, label: 'topic: word_counts — the changelog, compacted', color: C.changelog },
  ],
  steps: [
    {
      title: 'Two operators that have never heard of each other',
      prose:
        'A job splits strings into words; another counts them. Neither knows the other exists — the first is configured with an output topic name and the second with an input topic name, and <b>the name is the entire interface</b>. This is the property a chain of batch jobs had, where the contract between two teams was a directory name, kept intact at a latency where directories no longer work.',
      focus: ['split', 'count'],
      particles: [],
    },
    {
      title: 'The shuffle is a topic, not a network protocol',
      prose:
        'Splitting is stateless, so it fans out freely. Counting is not: every occurrence of “samza” must reach the same counter. So <code>SplitWords</code> writes each word to the <code>words</code> topic <em>keyed by the word itself</em>, and partitioning does the grouping. Unlike almost every other stream processor, <b>Samza implements no transport of its own</b> — the intermediate result is an ordinary topic, on disk, that anybody may read.',
      focus: ['src', 'strings', 'split', 'words'],
      particles: [
        { from: 'src', to: 'strings', color: C.source, count: 2 },
        { from: 'strings', to: 'split', color: C.source },
        { from: 'split', to: 'words', color: C.op, count: 2 },
      ],
    },
    {
      title: 'The counter keeps its state on its own disk',
      prose:
        'Each task owns an embedded key-value store on local disk, and reads and writes it at memory-and-SSD speed. The alternative — asking a shared database once per message — is the thing this design refuses: <b>the round trip becomes the bottleneck, and a fast enough stream will simply flatten the database.</b> Local state is not an optimisation here; it is what makes the throughput possible.',
      focus: ['words', 'count', 'store'],
      particles: [
        { from: 'words', to: 'count', color: C.op, count: 2 },
        { from: 'count', to: 'store', color: C.store },
      ],
    },
    {
      title: 'And every write to it is also appended to a log',
      prose:
        'The store would die with the disk, so each write is also appended to a dedicated changelog topic. Compaction keeps it bounded — for a counter overwritten a million times, Kafka eventually keeps only the latest value for that key — so the log stays roughly the size of the state rather than the size of the history. <em>The same replicated log that carries the input is what makes the state durable.</em>',
      focus: ['store', 'clog'],
      particles: [{ from: 'count', to: 'clog', color: C.changelog, count: 2 }],
    },
    {
      title: 'The machine dies',
      prose:
        'A node is lost, taking the RocksDB store with it. Nothing has been replicated to a peer, no standby was being kept warm, and there is no coordinator holding a copy. The framework restarts the task somewhere else, and the new task starts with <b>an empty store and a checkpointed offset.</b>',
      focus: ['count', 'store'],
      particles: [{ from: 'store', to: 'count', color: C.crash }],
    },
    {
      title: 'It rebuilds by replaying its own changelog',
      prose:
        'The task reads its partition of the changelog from the beginning and puts each entry back. Because compaction kept the latest value per key, replaying the whole thing reconstructs the state and takes about as long as the state is large. Then it resumes the input from its last checkpoint. <b>Recovery is the same operation as consumption</b> — there is no separate mechanism to test, which is why it works.',
      focus: ['clog', 'store'],
      particles: [{ from: 'clog', to: 'store', color: C.changelog, count: 3 }],
    },
    {
      title: 'And the recovery log is also the output',
      prose:
        'Watch what the changelog is. It is a stream of every change to the counts — which is precisely the result anybody downstream wanted, so a trending-words job subscribes to it and no separate output topic exists. <em>The durability mechanism, the output, and the input to the next stage are one object.</em> That collapse is the whole argument of this chapter, and the reason the picture keeps working when you add a fifth system to it.',
      focus: ['clog'],
      particles: [{ from: 'clog', to: 'words', color: C.changelog }],
    },
    {
      title: 'What it costs, stated plainly',
      prose:
        'Restarting from a checkpointed offset means the messages between that checkpoint and the crash are <b>processed twice</b>, and this counter is not idempotent — so some counts come out slightly wrong, and the paper says so. Ordering is total within a partition and absent across partitions. And a reader of any derived store may see a stale value, because the whole model is asynchronous on purpose. <em>None of these are bugs; they are the price of the seam.</em>',
      focus: ['count', 'clog', 'store'],
      particles: [{ from: 'words', to: 'count', color: C.crash, count: 2 }],
    },
  ],
}
