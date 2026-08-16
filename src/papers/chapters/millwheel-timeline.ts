import type { TimelineSpec } from '../../components/TimelinePlayer'
import { VIZ } from '../../styles/viz'

/* Zeitgeist, the example the paper opens with: count how often each search
   term is used, per one-second bucket, and notice when a term spikes or dips.
   Buckets here are three units wide rather than one, because a band you cannot
   read teaches nothing.

   This is the book's first timeline rather than trace, and the whole reason
   for the new instrument is visible in step 2: on a boxes-and-arrows picture,
   a record that happened at :04 and turned up at :13 looks exactly like every
   other record. Here it is a dot a long way below the diagonal, and the
   distance is the thing the act is about.

   The dots are hand-placed and deliberately uneven. Real arrival is not a
   tidy offset, and a diagram where every point sits the same distance from
   the diagonal would make out-of-order arrival look like a constant that
   could simply be subtracted — which is the misconception the chapter exists
   to break. */

const on = (id: string, event: number, arrived: number, label?: string): {
  id: string
  event: number
  arrived: number
  label?: string
} => ({ id, event, arrived, label })

export const millwheelTimeline: TimelineSpec = {
  title: 'Counting searches per second, when the searches do not arrive in order',
  aspect: 0.66,
  eventAxis: {
    label: 'when the search happened',
    max: 12,
    ticks: [
      { at: 0, label: '10:59:00' },
      { at: 3, label: ':03' },
      { at: 6, label: ':06' },
      { at: 9, label: ':09' },
      { at: 12, label: ':12' },
    ],
  },
  procAxis: {
    label: 'when the pipeline saw it',
    max: 17,
    ticks: [
      { at: 0, label: ':00' },
      { at: 4, label: ':04' },
      { at: 8, label: ':08' },
      { at: 12, label: ':12' },
      { at: 16, label: ':16' },
    ],
  },
  windows: [
    { from: 0, to: 3, label: ':00–:03' },
    { from: 3, to: 6, label: ':03–:06' },
    { from: 6, to: 9, label: ':06–:09' },
    { from: 9, to: 12, label: ':09–:12' },
  ],
  records: [
    on('a1', 0.4, 1.1),
    on('a2', 1.2, 1.9),
    on('a3', 0.9, 2.6),
    on('a4', 2.4, 3.1),
    on('a5', 1.8, 4.0),
    on('b1', 3.3, 4.4),
    on('b2', 4.6, 5.2),
    on('b3', 3.8, 6.4),
    on('b4', 5.5, 6.9),
    on('c1', 6.2, 7.4),
    on('c2', 7.8, 8.1),
    on('c3', 6.9, 9.3),
    on('c4', 8.4, 9.9),
    on('d1', 9.4, 10.6),
    on('d2', 10.8, 11.2),
    on('d3', 9.9, 12.4),
    on('d4', 11.6, 13.1),
    // the one from the tunnel: it happened inside :03–:06 and turned up long
    // after that bucket had already published a number
    on('late', 4.2, 14.6, 'happened at :04, arrived at :14'),
    on('d5', 11.1, 15.3),
    { id: 'spike', event: 7.1, arrived: 8.6, label: 'the spike you are looking for', color: VIZ.amber },
  ],
  steps: [
    {
      title: 'One dot, one search',
      prose:
        'Across: <b>when the search was typed</b>. Down: <b>when it reached the pipeline</b>. The dashed diagonal is the assumption every chapter of Act I was quietly built on — that those two are the same number. <em>Nothing sits on it.</em> Records cross a phone network, a load balancer and a queue before anybody counts them, so every dot is below the line, and the vertical distance is how long you did not know.',
      now: 3.4,
      note: { text: 'the gap is the whole subject', event: 1.0, proc: 2.7 },
    },
    {
      title: 'And they do not arrive in the order they happened',
      prose:
        'Look at the third and fourth dots. One search happened at <b>:00.9</b> and landed at <b>:02.6</b>; another happened later, at <b>:01.2</b>, and landed <em>earlier</em>, at :01.9. Nothing is broken — they took different routes. But it kills the trick Act I relied on, which was to treat position in the stream as position in time. <b>Arrival order is not event order</b>, and no amount of engineering makes it one, because the disorder happened before the record reached you.',
      now: 6.5,
      highlight: ['a2', 'a3'],
    },
    {
      title: 'So when is a bucket finished?',
      prose:
        'You want a count per three-second bucket. The first bucket closed, in event time, at <b>:03</b> — and here it is <b>:06</b> and you still cannot publish the number, because you do not know whether another :02 search is on its way. <em>This is the question the whole act turns on</em>, and notice that it has no answer inside the data: no record ever says “I am the last one.”',
      now: 8.2,
      highlight: [],
      note: { text: 'is bucket one done? nothing here says so', event: 0.4, proc: 7.4 },
    },
    {
      title: 'The low watermark: a bound, not a clock',
      prose:
        'So the system computes one. A computation’s <b>low watermark</b> is the oldest unfinished work anywhere upstream of it — the oldest record in flight, stored, or waiting to be delivered, taken together with every watermark feeding in. It is a claim about the future: <em>nothing older than this is still coming.</em> The purple line is that claim, drawn on the event-time axis, and everything to its left is being asserted complete. It only ever moves right. Once you have said it, you cannot take it back.',
      now: 11.0,
      watermark: 3.6,
    },
    {
      title: 'A timer fires, and the bucket publishes',
      prose:
        'The user sets a <b>timer</b> on the watermark rather than on the clock, for the end of a bucket. When the watermark passes it, the timer fires and the count goes out. Timers fire in increasing time order, they are journaled in persistent state, and they survive a machine dying — which matters, because this is the moment the answer becomes visible to somebody, and it must happen exactly once.',
      now: 13.2,
      watermark: 6.4,
      fired: [':00–:03', ':03–:06'],
    },
    {
      title: 'And now the record from the tunnel',
      prose:
        'A search happened at <b>:04</b>, inside the second bucket, and turned up at <b>:14</b> — after that bucket had already gone out with a number that did not include it. The watermark said nothing older than :06 was still coming. <b>The watermark was wrong</b>, and it was always going to be sometimes wrong, because it is seeded by injectors measuring pending work in systems they do not control, and that measurement is an estimate.',
      now: 15.2,
      watermark: 9.2,
      fired: [':00–:03', ':03–:06', ':06–:09'],
      highlight: ['late'],
    },
    {
      title: 'So you drop it — and you count how many you dropped',
      prose:
        'Zeitgeist’s answer is to throw the record away and <b>keep a count of what it threw away</b>, which came to roughly <b>0.001%</b> of records. That is not a shrug; it is the honest shape of the trade, stated as a number somebody can argue with. Other pipelines take the other road and go back to correct an aggregate they already published. <em>Both are choices about what you owe the people you already answered</em> — and neither is available to a system that never admitted the question existed.',
      now: 17,
      watermark: 11.4,
      fired: [':00–:03', ':03–:06', ':06–:09'],
      highlight: ['late', 'spike'],
      note: { text: '~0.001% dropped, and counted', event: 5.6, proc: 16.2 },
    },
  ],
}
