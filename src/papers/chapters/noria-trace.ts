import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* A vote is cast, a story nobody has looked at in a week is read, and the
   answer to both is the same graph. The trace exists to show the direction
   reversal that is the whole paper: updates flow down, and when something is
   missing a request flows UP the same edges.

   Colours: blue for the application, which is the client. Amber for the read
   handler, which is machinery and not an answer. Green where answers live —
   the operator states and the view. Violet for the base tables, because they
   are the durable copy. Red for the upquery, because a miss on the read path
   is the case the design exists to survive and the one that costs.

   Geometry: the upquery runs up a dedicated lane at x=44.5, between the base
   tables (right edge 42) and the operator column (left edge 47). The direct
   route from the view to the count goes straight through the join. */
const C = {
  app: VIZ.blue,
  handler: VIZ.amber,
  answer: VIZ.green,
  durable: VIZ.violet,
  miss: VIZ.red,
}

export const noriaTrace: TraceSpec = {
  title: 'A write goes down the graph; a read that misses goes back up it',
  aspect: 0.52,
  zones: [
    { label: 'The app', x: 2, y: 4, w: 18, h: 44 },
    { label: 'Tables, operators, views', x: 22, y: 4, w: 54, h: 44 },
    { label: 'The read', x: 78, y: 4, w: 20, h: 44 },
  ],
  nodes: [
    { id: 'app', x: 4, y: 22, w: 14, h: 9, label: 'Application', sub: 'votes and reads', color: C.app },
    { id: 'votes', x: 25, y: 8, w: 17, h: 7, label: 'votes', sub: 'base table', color: C.durable },
    { id: 'stories', x: 25, y: 34, w: 17, h: 7, label: 'stories', sub: 'base table', color: C.durable },
    { id: 'count', x: 47, y: 8, w: 19, h: 7, label: 'VoteCount', sub: 'count per story', color: C.answer },
    { id: 'join', x: 47, y: 21, w: 19, h: 7, label: 'Join', sub: 'on story id', color: C.answer },
    { id: 'view', x: 47, y: 36, w: 19, h: 7, label: 'StoriesWithVC', sub: 'the external view', color: C.answer },
    { id: 'reader', x: 80, y: 21, w: 16, h: 9, label: 'Read handler', sub: 'lock-free lookup', color: C.handler },
  ],
  steps: [
    {
      title: 'The query is not run on the read — it is standing there already',
      prose:
        'The application hands over a relational schema and a set of parameterised queries, and they are compiled into <em>one</em> graph: base tables at the roots, operators in the middle, the views the application reads at the leaves. Nothing here is a cache the application maintains. <b>It is the query itself, left running.</b> Note what is missing compared with Chapter 12: there is no invalidation logic anywhere, because nothing is ever invalidated.',
      focus: ['votes', 'stories', 'count', 'join', 'view'],
      particles: [],
    },
    {
      title: 'A vote arrives, and it walks down',
      prose:
        'The write goes to the durable base table first, then enters the graph as an <b>update</b> — a delta, not a row. The count operator does not recount anything; it emits “this story’s count changed by one”. The join turns that into a change to the story’s row, and the view is patched. <em>The cost of the write is the path it walked</em>, and the cost of every read that follows is a key lookup, which is what makes a page view cheap.',
      focus: ['app', 'votes', 'count', 'join', 'view'],
      particles: [
        { from: 'app', to: 'votes', color: C.app },
        { from: 'votes', to: 'count', color: C.answer },
        { from: 'count', to: 'join', color: C.answer },
        { from: 'join', to: 'view', color: C.answer },
      ],
    },
    {
      title: 'And a deletion walks down the same edges, wearing a minus sign',
      prose:
        'An unvote produces a <b>negative update</b> — the same values as the positive one it revokes, following the same path, and removing the entry when it lands. This is Chapter 22’s retraction with the argument settled: there, whether to retract was a policy the pipeline author chose. Here every operator emits deltas that can be negative, and “take that back” is not a special case anybody had to design.',
      focus: ['count', 'join', 'view'],
      particles: [
        { from: 'app', to: 'votes', color: C.miss },
        { from: 'count', to: 'join', color: C.miss },
        { from: 'join', to: 'view', color: C.miss },
      ],
    },
    {
      title: 'Now somebody reads a story nobody has touched in a week',
      prose:
        'And it is not there. Keeping every answer to every query would need eight times the size of the base tables, so operators hold <b>partial state</b>: only the entries somebody has actually asked for. An operator starts <em>fully evicted</em> and fills up as it is read. This is not windowing — the missing entry is not old, it is unpopular, and windowing would have made it permanently unanswerable rather than briefly slow.',
      focus: ['view', 'reader'],
      particles: [{ from: 'reader', to: 'view', color: C.miss }],
    },
    {
      title: 'So the request goes back up the graph',
      prose:
        'The view sends an <b>upquery</b> to its ancestors: not “recompute yourself”, but “give me the records for this one key”. If they are missing there too the request <em>recurses</em>, up to the base tables in the worst case. This is the reversal the paper is built on — the same edges that carry updates downward carry demand upward, and it is why the state can be a fraction of the whole while every key stays answerable.',
      focus: ['view', 'join', 'count', 'votes'],
      particles: [
        { from: 'view', to: 'count', color: C.miss, via: [{ x: 44.5, y: 39 }, { x: 44.5, y: 11 }] },
        { from: 'count', to: 'votes', color: C.miss },
      ],
    },
    {
      title: 'The answer flows forward and fills the hole',
      prose:
        'The response travels the ordinary data-flow path back to whoever asked, and the entry is populated. From here ordinary updates keep it current until it is evicted again. The delicate part is that a response is a <b>snapshot</b> and an update is a <b>delta</b>, and the two do not commute — apply them in the wrong order and the count is permanently wrong with nothing to detect it. The fix is narrow: a join’s upquery is confined to a chain of operators owned by one thread, so no update can be in flight past it.',
      focus: ['count', 'join', 'view'],
      particles: [
        { from: 'votes', to: 'count', color: C.answer },
        { from: 'count', to: 'view', color: C.answer, via: [{ x: 44.5, y: 11 }, { x: 44.5, y: 39 }] },
      ],
    },
    {
      title: 'And every read after it is a lookup',
      prose:
        'The view is a hash table the read handlers read without locking — double-buffered, so a writer updates one copy while readers work on the other and a pointer swap exposes it. Under a skewed workload that alone is worth <b>10×</b> over locking the buckets, because the popular key is the contended one. <em>Reads never touch an operator.</em> On the real application this took a hand-optimised MySQL from 1,000 page views a second to 5,000.',
      focus: ['reader', 'view', 'app'],
      particles: [
        { from: 'view', to: 'reader', color: C.answer },
        { from: 'reader', to: 'app', color: C.app, via: [{ x: 88, y: 50 }, { x: 11, y: 50 }] },
      ],
    },
  ],
}
