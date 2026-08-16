import type { TimelineSpec } from '../../components/TimelinePlayer'
import { VIZ } from '../../styles/viz'

/* One window, emitted five times, which is the entire argument of the paper
   rendered as a picture. The previous chapter's timeline had a window fire
   once, at the watermark, and then a late record turn up and be dropped —
   because with one bound and one timer that is the only story available.

   Here the same window emits early on a processing-time trigger, again, again,
   once when the watermark passes it, and once more when a late record lands.
   The badge above the band says which kind of emission it was, because the
   whole point is that these are different in kind and not repeats.

   The video-ad billing example from §1 and §3.3.3: how much of an ad was
   watched, in two-minute windows, where a meaningful share of views come from
   phones that were offline at the time. */

export const dataflowTimeline: TimelineSpec = {
  title: 'One window, five answers — and none of them is a correction of a mistake',
  aspect: 0.66,
  eventAxis: {
    label: 'when the ad was watched',
    max: 12,
    ticks: [
      { at: 0, label: '12:00' },
      { at: 4, label: '12:02' },
      { at: 8, label: '12:04' },
      { at: 12, label: '12:06' },
    ],
  },
  procAxis: {
    label: 'when you could have said something',
    max: 20,
    ticks: [
      { at: 0, label: '12:00' },
      { at: 5, label: '12:02' },
      { at: 10, label: '12:05' },
      { at: 15, label: '12:07' },
      { at: 20, label: '12:10' },
    ],
  },
  windows: [
    { from: 0, to: 4, label: '12:00–12:02' },
    { from: 4, to: 8, label: '12:02–12:04' },
    { from: 8, to: 12, label: '12:04–12:06' },
  ],
  records: [
    { id: 'v1', event: 0.6, arrived: 1.5 },
    { id: 'v2', event: 1.9, arrived: 2.8 },
    { id: 'v3', event: 1.2, arrived: 4.1 },
    { id: 'v4', event: 3.1, arrived: 4.9 },
    { id: 'v5', event: 2.6, arrived: 6.8 },
    { id: 'v6', event: 3.6, arrived: 8.4 },
    { id: 'w1', event: 4.4, arrived: 6.1 },
    { id: 'w2', event: 5.8, arrived: 7.2 },
    { id: 'w3', event: 6.5, arrived: 9.5 },
    { id: 'w4', event: 7.4, arrived: 11.8 },
    { id: 'x1', event: 8.6, arrived: 10.4 },
    { id: 'x2', event: 9.9, arrived: 12.6 },
    { id: 'x3', event: 11.2, arrived: 14.2 },
    // the phone that was in a field with no signal all morning
    {
      id: 'offline',
      event: 2.2,
      arrived: 16.4,
      label: 'watched at 12:01, uploaded at 12:08',
      color: VIZ.red,
    },
    { id: 'x4', event: 10.5, arrived: 17.8 },
  ],
  steps: [
    {
      title: 'The same picture, and one window to watch',
      prose:
        'Ad views, in two-minute windows of <b>when the ad was watched</b>. Keep your eye on the first band. In the previous chapter that band gets one number, when the watermark passes it, and a record that turns up afterwards is dropped and counted. <em>Here it is going to produce five answers</em>, and the argument is that those five are different in kind rather than four mistakes and a correction.',
      now: 5.2,
    },
    {
      title: 'Somebody wants a number now, and the watermark is nowhere near',
      prose:
        'An advertiser adjusting a budget does not want a complete number in six minutes; they want <em>an indication</em> in thirty seconds. So a trigger fires on <b>processing time</b> — every so often, regardless of what the watermark is doing — and the window emits what it has. It is incomplete and everybody involved knows it. <b>Its usefulness has nothing to do with its completeness</b>, which is the sentence the previous chapter had no way to say.',
      now: 7.0,
      watermark: 1.4,
      fired: ['12:00–12:02'],
      panes: { '12:00–12:02': 'early' },
      note: { text: 'partial, on purpose', event: 0.4, proc: 6.2 },
    },
    {
      title: 'And again — the window has not closed, it has spoken',
      prose:
        'The clock trigger fires again and a better partial goes out. Nothing about the window has ended; it is still open, still accumulating, still waiting on its bound. <em>Emitting stopped being the same thing as finishing.</em> That separation is the hinge of the whole paper: one axis of time decides <b>where</b> data is grouped, and a completely different one decides <b>when</b> you say something about it.',
      now: 9.4,
      watermark: 2.6,
      fired: ['12:00–12:02'],
      panes: { '12:00–12:02': 'early ·  again' },
    },
    {
      title: 'The watermark passes, and now the good answer goes out',
      prose:
        'The bound crosses <b>12:02</b>, so as far as the pipeline can tell, everything for the first window has been seen. This is the pane the previous chapter’s timer produced, and it is still the most valuable one — it is what a statistics job or a daily report should use. <b>What changed is that it is no longer the only one</b>, so nobody had to choose between having it and having something sooner.',
      now: 11.6,
      watermark: 4.3,
      fired: ['12:00–12:02'],
      panes: { '12:00–12:02': 'on time' },
    },
    {
      title: 'A phone comes back from a field',
      prose:
        'A view that happened at <b>12:01</b> was recorded on a device with no signal and uploaded at <b>12:08</b>. The paper is blunt that no watermark can be right about this: if somebody takes a device into the wilderness, <em>the system has no practical way of knowing when they might come back</em>. So this is not a bound that was badly tuned. It is a bound that was always going to be a heuristic, for a reason no amount of engineering removes.',
      now: 16.8,
      watermark: 8.6,
      fired: ['12:00–12:02', '12:02–12:04'],
      panes: { '12:02–12:04': 'on time' },
      highlight: ['offline'],
    },
    {
      title: 'So the window speaks a fifth time',
      prose:
        'A <b>late</b> trigger fires and the first window emits again, now including the view from the field. Five panes from one window: three because somebody wanted speed, one because the bound said so, one because the world turned out to have more to say. <em>Each was the best available answer at the moment it was given</em>, and the pipeline never had to pretend otherwise.',
      now: 18.4,
      watermark: 9.4,
      fired: ['12:00–12:02', '12:02–12:04'],
      panes: { '12:00–12:02': 'late', '12:02–12:04': 'on time' },
      highlight: ['offline'],
      note: { text: 'the number for 12:00–12:02 just changed', event: 2.4, proc: 19.2 },
    },
    {
      title: 'And now the question that is actually hard',
      prose:
        'Your consumer has received five numbers for one window. What do they mean together? <b>Discarding:</b> each pane is independent and they sum — right for a downstream stage that adds things up. <b>Accumulating:</b> each pane replaces the last — right for a database keyed by window. <b>Accumulating and retracting:</b> the new pane is preceded by a retraction of the old — <em>necessary</em> when something downstream has already grouped on the old value, because otherwise there is no way to tell it to stop counting one. Three answers, and the pipeline author picks. Nobody before this made it a question you could even ask.',
      now: 20,
      watermark: 11.2,
      fired: ['12:00–12:02', '12:02–12:04', '12:04–12:06'],
      panes: { '12:00–12:02': 'late', '12:02–12:04': 'on time', '12:04–12:06': 'on time' },
    },
  ],
}
