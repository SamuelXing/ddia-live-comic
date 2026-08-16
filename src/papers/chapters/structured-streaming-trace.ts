import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* One epoch of a streaming query, from an offset range to a committed write —
   and then the two things the chapter is really about, which are what happens
   when a machine dies and what happens when the query was wrong for three days.

   Colours: blue for the driver and the source, because both are the front door
   and neither holds the answer. Amber for the map-side work, which is
   machinery. Green for the aggregate and the sink, because that is where the
   answer accumulates. Violet for the write-ahead log and the state store —
   replication with no protocol, the category violet has carried all book.

   The state store is deliberately a separate node rather than an attribute of
   the aggregate. That is the point of §6.1: the operator's state is not the
   operator's business, and the whole recovery story works because somebody
   else is holding it. Drawing it inside the green box would say the opposite.

   Geometry: the epoch's work runs down a column at x=29..46 with the state
   store stepped right at x=50; the one routed line is the sink write, which
   uses the gap at y≈24 above the state store. */
const C = {
  door: VIZ.blue,
  work: VIZ.amber,
  answer: VIZ.green,
  durable: VIZ.violet,
  bad: VIZ.red,
}

export const structuredStreamingTrace: TraceSpec = {
  title: 'One epoch, one dead machine, and one rollback done with a text editor',
  aspect: 0.5,
  zones: [
    { label: 'Sources', x: 2, y: 4, w: 22, h: 42 },
    { label: 'One epoch of the query', x: 26, y: 4, w: 42, h: 42 },
    { label: 'Durable', x: 70, y: 4, w: 28, h: 42 },
  ],
  nodes: [
    { id: 'kafka', x: 4, y: 10, w: 18, h: 8, label: 'Kafka', sub: 'offsets you can rewind', color: C.door },
    { id: 'drv', x: 29, y: 9, w: 17, h: 7, label: 'Driver', sub: 'defines the epoch', color: C.door },
    { id: 'sel', x: 29, y: 20, w: 17, h: 7, label: 'Filter, project', sub: 'map tasks', color: C.work },
    { id: 'agg', x: 29, y: 31, w: 17, h: 7, label: 'Aggregate', sub: 'reduce tasks', color: C.answer },
    { id: 'state', x: 50, y: 31, w: 16, h: 7, label: 'State store', sub: 'checkpointed', color: C.durable },
    { id: 'wal', x: 72, y: 10, w: 24, h: 8, label: 'Write-ahead log', sub: 'JSON, by hand', color: C.durable },
    { id: 'sink', x: 72, y: 28, w: 24, h: 8, label: 'Sink', sub: 'idempotent', color: C.answer },
  ],
  steps: [
    {
      title: 'An epoch is a range of offsets, decided before any work happens',
      prose:
        'The driver looks at where it got to in each Kafka partition, picks an end, and <b>writes the start and end offsets to a log before anything runs</b>. That is what an epoch is: not a window of time and not a batch of records, but a <em>prefix of every input</em>, named durably in advance. Everything else in this chapter is downstream of that one decision, including the ability to roll back three days later — because a point in the log is a point in the input, exactly.',
      focus: ['kafka', 'drv', 'wal'],
      particles: [
        { from: 'kafka', to: 'drv', color: C.door },
        { from: 'drv', to: 'wal', color: C.durable },
      ],
    },
    {
      title: 'The query you wrote, running as something you did not write',
      prose:
        'What the user typed was a `select … group by`, the same thing they would type against a finished table. What runs is an <em>incremental</em> plan: read only the records in this epoch, filter and project them, and carry the partial aggregates forward. The user did not annotate any operator with a windowing mode, a trigger mode or a refinement mode, and the reason that matters is not convenience. <b>Those annotations are how you incrementalise a query by hand</b>, and a person doing it by hand can put an operator expecting deltas after one emitting totals and get a wrong answer that nothing complains about.',
      focus: ['kafka', 'sel', 'agg'],
      particles: [
        { from: 'kafka', to: 'sel', color: C.door },
        { from: 'sel', to: 'agg', color: C.work },
      ],
    },
    {
      title: 'The running counts are held, and they are not the operator’s business',
      prose:
        'The aggregate keeps its counts in memory on the worker and checkpoints them <b>asynchronously, with the epoch number attached</b>, to a store designed to hold far more than fits on one machine. Note the two properties that make this liveable: it does not have to happen on every epoch, and it does not block the processing. And note who is not involved — <em>the user’s code never manages any of this</em>, including in the custom stateful operators, where the only requirement on their data is that it can be serialised.',
      focus: ['agg', 'state'],
      particles: [
        { from: 'agg', to: 'state', color: C.durable },
        { from: 'state', to: 'agg', color: C.durable },
      ],
    },
    {
      title: 'Nothing is committed until every writer says it wrote',
      prose:
        'The output goes to the sink, and then each node reports that it committed this epoch. <b>The driver waits for all of them before allowing the next epoch to commit</b>, which bounds the damage precisely: if the application dies, at most one epoch is partially written. Recovery reads the log for the last uncommitted epoch, rebuilds state from the store, replays the epochs in between with output disabled, then reruns the last one — <em>and relies on the sink being idempotent to make the rewrite harmless.</em> That requirement is real and it is pushed onto the outside world.',
      focus: ['agg', 'sink', 'wal'],
      particles: [
        { from: 'agg', to: 'sink', color: C.answer, via: [{ x: 48, y: 24 }] },
        { from: 'sink', to: 'wal', color: C.durable },
      ],
    },
    {
      title: 'A machine dies, and it costs one task',
      prose:
        'Each epoch runs as an ordinary graph of independent tasks, so a dead node loses its tasks and nothing else — they are rerun, in parallel, on machines that are alive. <em>Compare the previous chapter, where a single dead process sent every survivor back to the last checkpoint</em>, and compare it again to what most long-lived-operator streaming systems still do, which is roll the whole topology back. It also inherits the rest of the batch engine’s behaviour for free: a slow task gets a backup copy, and adding a machine is not a reconfiguration because the next epoch simply schedules onto it.',
      focus: ['sel', 'agg'],
      particles: [
        { from: 'sel', to: 'agg', color: C.bad },
        { from: 'sel', to: 'agg', color: C.work },
      ],
    },
    {
      title: 'And now the failure nobody designs for: it was wrong, and it did not crash',
      prose:
        'A field stopped parsing and has been arriving as NULL since Tuesday. Nothing failed, nothing alerted, and the sink is full of confident wrong answers. Because the log is <b>a list of offset ranges in readable JSON</b>, an administrator can find the epoch where it started, delete the output from there, and restart the job at that point. It works for one reason and it is the reason step 1 was built the way it was: <em>a position in the log is a prefix of the input</em>, so restarting there recomputes exactly the records that produced the bad output and nothing else.',
      focus: ['wal', 'drv', 'sink', 'kafka'],
      particles: [
        { from: 'wal', to: 'drv', color: C.bad },
        { from: 'kafka', to: 'drv', color: C.door },
      ],
    },
    {
      title: 'The same query, once every few hours, for a tenth of the money',
      prose:
        'Now turn the dial the other way. Trigger the job <b>once</b> and let it exit: one epoch, one commit, servers off until the next time. Customers did this on purpose — they wanted the offset tracking and the exactly-once commit, and they did not want to pay for machines running around the clock — and it saved <em>up to ten times</em> the cost for lower-volume work. It is the same code, the same log and the same guarantees, run at a freshness of several hours. <b>The engine did not gain a batch mode. Batch was always one setting of the trigger.</b>',
      focus: ['drv', 'wal', 'sink', 'agg'],
      particles: [
        { from: 'drv', to: 'wal', color: C.durable },
        { from: 'agg', to: 'sink', color: C.answer, via: [{ x: 48, y: 24 }] },
      ],
    },
  ],
}
