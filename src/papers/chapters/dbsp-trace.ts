import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* The circuit Algorithm 4.6 produces for the paper's own example query, and a
   change walking through it. The trace exists because the chapter's claim is
   about a *mechanical procedure*, and the only way to believe a procedure is
   to watch it run on something concrete.

   The zones are the argument: operators are grouped by what their incremental
   version costs, not by what they do. That grouping is the entire result —
   filter and project cost nothing because they are linear, the join costs the
   database times the change because it is bilinear, and duplicate elimination
   costs the change despite being neither.

   Colours: blue for the incoming changes. Amber for the linear operators,
   which are pure machinery and store nothing. Green where state accumulates.
   Violet for the delayed copy — z-inverse is storage wearing a clock. Red on
   the retraction, since a negative row is the case this whole act is about.

   Zone labels are short on purpose: they are drawn at a fixed y and a long one
   runs into its neighbour's. */
const C = {
  change: VIZ.blue,
  linear: VIZ.amber,
  state: VIZ.green,
  delayed: VIZ.violet,
  minus: VIZ.red,
}

export const dbspTrace: TraceSpec = {
  title: 'A row is deleted, and the machine-generated circuit does the least possible work',
  aspect: 0.52,
  zones: [
    { label: 'Changes in', x: 2, y: 4, w: 17, h: 44 },
    { label: 'Linear', x: 21, y: 4, w: 25, h: 44 },
    { label: 'Bilinear', x: 48, y: 4, w: 28, h: 44 },
    { label: 'Neither', x: 78, y: 4, w: 20, h: 44 },
  ],
  nodes: [
    { id: 'dt1', x: 3, y: 10, w: 14, h: 8, label: 'change to t1', sub: 'one row, −1', color: C.change },
    { id: 'dt2', x: 3, y: 34, w: 14, h: 8, label: 'change to t2', sub: 'nothing today', color: C.change },
    { id: 'sig1', x: 22, y: 10, w: 11, h: 7, label: 'filter', sub: 'a > 2', color: C.linear },
    { id: 'pi1', x: 35, y: 10, w: 10, h: 7, label: 'project', sub: 'x, id', color: C.linear },
    { id: 'sig2', x: 22, y: 34, w: 11, h: 7, label: 'filter', sub: 's > 5', color: C.linear },
    { id: 'pi2', x: 35, y: 34, w: 10, h: 7, label: 'project', sub: 'y, id', color: C.linear },
    { id: 'int1', x: 49, y: 10, w: 12, h: 7, label: 'all of t1', sub: 'so far', color: C.state },
    { id: 'int2', x: 49, y: 34, w: 12, h: 7, label: 'all of t2', sub: 'up to yesterday', color: C.delayed },
    { id: 'join', x: 63, y: 22, w: 12, h: 7, label: 'two joins', sub: 'and a sum', color: C.state },
    { id: 'dist', x: 79, y: 12, w: 18, h: 8, label: 'distinct', sub: 'watch the sign', color: C.state },
    { id: 'out', x: 79, y: 34, w: 18, h: 8, label: 'change to the view', sub: 'what to send on', color: C.change },
  ],
  steps: [
    {
      title: 'Nobody drew this — it was derived',
      prose:
        'This is a select-project-join with a <code>DISTINCT</code> on it, put through five mechanical steps: translate the plan, drop the duplicate-elimination operators that provably cannot matter, lift the whole thing to work on streams, wrap it in integrate and differentiate, then push that wrapper inward operator by operator until it disappears. <b>No cost model, no statistics, no heuristics.</b> The same five steps produce the same circuit every time, which is the claim the chapter has to earn.',
      focus: ['sig1', 'pi1', 'sig2', 'pi2', 'join', 'dist'],
      particles: [],
    },
    {
      title: 'A row is deleted, which is a row with a weight of −1',
      prose:
        'Somebody removes a record from <code>t1</code>. What enters the circuit is not a command; it is a <b>table containing one row whose weight is minus one</b>. Insertions and deletions are the same kind of object and the same code path, which is the concession that buys everything downstream — the operators only have to know how to add.',
      focus: ['dt1'],
      particles: [{ from: 'dt1', to: 'sig1', color: C.minus }],
    },
    {
      title: 'The filter and the projection are unchanged, literally',
      prose:
        'These operators are <b>linear</b>: run them on a sum of two inputs and you get the sum of running them on each. For anything linear, the incremental version is the operator itself — the derivation produces no wrapper at all. So the filter tests one row and the projection drops a column from one row. <em>They store nothing.</em> Not “a little”; the state of a linear operator in this model is exactly zero.',
      focus: ['sig1', 'pi1'],
      particles: [
        { from: 'sig1', to: 'pi1', color: C.minus },
        { from: 'pi1', to: 'join', color: C.minus, via: [{ x: 47, y: 26 }] },
      ],
    },
    {
      title: 'The join is where state has to live, and where the cost is',
      prose:
        'A join is <b>bilinear</b> — linear in each side separately — and bilinear things do not simplify away. The change to the left has to meet everything on the right, and vice versa, so both accumulated sides are kept. One is delayed by a step so the two joins do not double-count the pair that changed on both sides at once. The cost is the size of the database times the size of the change, which is a factor of <em>database over change</em> better than re-running the query, and that ratio is the whole business case.',
      focus: ['int1', 'int2', 'join'],
      particles: [
        { from: 'int1', to: 'join', color: C.state },
        { from: 'int2', to: 'join', color: C.delayed },
      ],
    },
    {
      title: 'Then the one operator that should have been expensive',
      prose:
        'Duplicate elimination is not linear — its whole job is to flatten weights back to one, and it needs the current set to know whether it can. The naive incremental version therefore costs the whole database, and that is the operator every earlier system chokes on. <b>It costs the change instead.</b> The reason is one sentence: a row can only appear in the output if its weight <em>crossed zero</em>, and only rows that changed can have crossed anything. So the output is bounded by the input change, whatever the database is doing.',
      focus: ['dist'],
      particles: [{ from: 'join', to: 'dist', color: C.state }],
    },
    {
      title: 'And what comes out is a change, not a view',
      prose:
        'The circuit emits the <b>delta to the view</b> — possibly a retraction, possibly nothing at all. It never materialises the answer unless somebody asks it to, which is the difference between this and Chapter 25: there the maintained view <em>was</em> the product, and here it is optional. Changes in, changes out, and the symmetry is not a nicety — it is why the composition rule holds, and the composition rule is why the whole thing can be a compiler pass.',
      focus: ['dist', 'out'],
      particles: [{ from: 'dist', to: 'out', color: C.change }],
    },
    {
      title: 'The same five steps also handle the loop',
      prose:
        'Wrap a query in a cycle and you have recursion — transitive closure, reachability, the connected components of Chapter 24. Incrementalizing a feedback loop turns out to be the feedback loop around the incrementalized body, and applying that once produces <b>semi-naive evaluation</b>, the standard Datalog algorithm, as a consequence rather than a design. Apply it a second time, to a circuit that already contains a loop, and you get a recursive query that maintains itself as its input changes. <em>Nothing was added to the language to make that work.</em>',
      focus: ['join', 'int1', 'dist'],
      particles: [
        /* down the outside of the output box, not through it — the back edge
           leaves distinct's bottom and the direct line to the lane clips it */
        { from: 'dist', to: 'join', color: C.state, via: [{ x: 77, y: 26 }, { x: 77, y: 47 }, { x: 62, y: 47 }] },
        { from: 'join', to: 'out', color: C.change, via: [{ x: 77, y: 38 }] },
      ],
    },
  ],
}
