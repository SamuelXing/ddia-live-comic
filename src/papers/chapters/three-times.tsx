import type { Chapter } from '../types'
import { ThreeTimesDiagram, ReproducibleDiagram } from '../diagrams'

/* The act's second page and its shortest. Same shape as the RUM interlude: no
   `paper`, no DesignIt, four steps, two figures.

   It exists because the previous chapter introduced two clocks and the next
   one builds a whole model on the difference, and in between there is a
   distinction working engineers get wrong constantly — usually by picking
   whichever timestamp their framework made easiest and not noticing they
   answered a different question.

   The payload is the reproducibility argument, and it is deliberately the
   thing the interlude ends on rather than the definitions. Definitions of
   event time are everywhere. The observation that a processing-time
   aggregation cannot be recomputed from its own input is the one that changes
   what somebody does on Monday. */

export const threeTimes: Chapter = {
  slug: 'three-times',
  act: 'Act II · Time Is Not When It Arrived',
  paperNo: 'Interlude',
  title: 'Interlude: The Three Times',
  dek: 'Every record in this act carries more than one timestamp, and picking the wrong one produces answers that are not wrong so much as about something else. Two pages to name all three.',
  minutes: 8,
  caption:
    'The previous chapter used two clocks without ever stopping to separate them, and the next one builds an entire model on the difference — so here is the page that names them. This is the distinction working engineers get wrong most often in this whole area, and almost never on purpose. It happens because a framework made one timestamp easy to reach, somebody reached for it, and **the resulting dashboard looked completely reasonable.** There is a third clock too, less discussed than the other two and quietly present in most production pipelines, which is worth naming precisely because nobody argues about it.',
  steps: [
    {
      n: 'The three',
      title: 'Two of them belong to the world and one belongs to you',
      accent: 'terra',
      body: [
        '**Event time** is when the thing happened — a record of the clock on whatever system produced the event, at the moment of occurrence. The producer sets it. And the property that matters: **for a given event it essentially never changes.** It is the same number in the log, in the replay, in the backfill you run next year.',
        '**Processing time** is when your system observed the record, according to your clock. It is not one number: *it changes constantly for the same record as it flows through the pipeline*, because every stage reads it at a different moment. Ask a five-stage pipeline what the processing time of a record is and there are five answers, all correct.',
        '**Ingestion time** is when the record entered your system — stamped once at the edge and then carried along. It is a hybrid, and its two halves come from opposite sides: it is **fixed like event time**, so it is stable across a replay, and it is **about your infrastructure like processing time**, so it says nothing about when anything happened. That combination makes it genuinely useful and easy to mistake for the first one.',
        'The distance between the first two is called **skew**, and it is not a constant you could subtract. It grows when a queue backs up, shrinks when it drains, and jumps to hours for one record whose phone was underground. *A diagram where every record sits the same distance below the diagonal is a diagram of a system that does not exist.*',
      ],
      diagram: <ThreeTimesDiagram />,
    },
    {
      n: 'The tell',
      title: 'Which question each one actually answers',
      body: [
        'The reliable way to catch the mistake is to ask what a result *means* rather than what it is called. Group by processing time and the honest name for the output is **“how much work my pipeline did during that minute.”** That is a real quantity and there are days you want it — capacity planning, backlog monitoring, and every graph your on-call rotation looks at.',
        'Group by event time and the output is **“how much happened out in the world during that minute.”** Also a real quantity, and it is the one almost every business question is asking for. Revenue for Tuesday. Views of an ad. Errors during the incident. *None of those is a question about your infrastructure*, and answering them with a processing-time bucket produces a number that is precisely correct about the wrong thing.',
        'And here is where ingestion time sits, which is the useful part of naming it. It is a **usable approximation of event time whenever the gap between the two is small and boring** — a service writing directly into a queue in the same datacentre. It becomes a lie exactly when the gap gets interesting: mobile clients, batched uploads, anything that retries. So the rule is not “never use ingestion time”, it is: **the moment late data is a thing you care about, ingestion time has stopped being an approximation of anything.**',
        'A useful test before you argue about it. Ask whoever wants the number what should happen to Tuesday’s figure if a record from Tuesday shows up on Thursday. If the answer is *Tuesday should change*, they want event time. If the answer is *Thursday*, they want processing time, and they are probably measuring your pipeline on purpose.',
      ],
    },
    {
      n: 'The argument',
      title: 'Only one of them can be computed twice',
      accent: 'denim',
      body: [
        'Everything above is a matter of meaning, and meaning arguments do not survive a deadline. Here is the mechanical one, and it is why this distinction is not a preference.',
        'Take a recorded input — a file, a topic with a week of retention, whatever you replay from. Run a job over it that buckets by **processing time**, twice. The two runs give different answers. Not slightly different: the second run reads the file as fast as the disk allows, so records that were spread over an hour of processing time now land in four seconds, and every bucket boundary falls somewhere else. **The output is not reproducible from its own input**, which means it cannot be backfilled, cannot be recomputed after a bug, and cannot be audited by anybody who was not watching at the time.',
        'Run the same job bucketed by **event time** and both runs produce the same numbers, because the grouping key travelled with the record instead of being read off a clock. That is the property. Chapter 20 could offer one program for the live job and the backfill; **this is the thing that makes those two runs agree**, and without it a unified API is a unified API over two different answers.',
        'Which reframes the cost. Event time is more work — you need watermarks, you need somewhere to keep windows open, you need a policy for records that turn up late. *What you are buying is not accuracy. It is the ability to run the computation again.*',
      ],
      diagram: <ReproducibleDiagram />,
    },
    {
      n: 'What it costs',
      title: 'And why the rest of this act exists',
      accent: 'terra',
      body: [
        'Nothing here is free, and the bill is the shape of the remaining chapters. **Event time means keeping state open**, because a window cannot close on schedule if a record for it may still arrive — so memory becomes a function of how late you are willing to accept data, which is a number somebody has to choose and will choose badly at least once.',
        '**It means the answer is available later**, because you are waiting for a bound rather than for a clock. And it means **a policy for stragglers**, since the bound is an estimate: drop them and count the drops, or publish a correction and require every downstream consumer to accept one.',
        'Notice that all three of those are the same sentence in different clothes: *once you admit the world is out of order, you are choosing how long to wait and what to do about being wrong.* Chapter 21 offered one bound and one timer. The next chapter takes that single decision apart into separate ones — **where** the data is grouped, **when** the result goes out, and **how** a later answer relates to the one you already sent — so that the dashboard and the billing system can want different things and both be served by one pipeline.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Event time.',
      body: 'When it happened, according to whoever produced it. Fixed for the life of the record, which is what makes a computation over it repeatable.',
    },
    {
      term: 'Processing time.',
      body: 'When a stage of your pipeline observed it. Different at every stage, and different again on a replay.',
    },
    {
      term: 'Ingestion time.',
      body: 'When it entered your system, stamped at the edge. Stable like event time, meaningless about the world like processing time.',
    },
    {
      term: 'Skew.',
      body: 'The gap between event time and processing time. Not a constant, not bounded, and not something you can subtract your way out of.',
    },
  ],
  inTheWild: {
    note: '4 ways this goes wrong quietly',
    points: [
      '**The framework made one of them the default and nobody chose.** Processing time is always the easiest timestamp to reach because it requires no cooperation from the producer. It is picked by omission far more often than by decision.',
      '**The clock on the producing device is wrong.** Event time is only as good as whoever set it, and phones with bad clocks, servers that never got NTP and clients that lie deliberately all produce events dated next week — which will hold a window open until somebody notices.',
      '**A backfill silently disagrees with the live pipeline.** Same code, same input, different numbers, and the difference is that the live run was bucketed by when it read things. This surfaces as “the historical numbers don’t match” months later, and it is not a bug anybody wrote.',
      '**Ingestion time gets called event time in conversation** and everybody nods, because for the datacentre-to-queue path they are within milliseconds. Then a mobile SDK ships, and the two diverge by hours for exactly the users whose behaviour anybody wanted to measure.',
    ],
  },
  sources: [
    {
      year: '2015',
      title: 'Streaming 101: The world beyond batch — Tyler Akidau',
      url: 'https://www.oreilly.com/radar/the-world-beyond-batch-streaming-101/',
      note: 'The best explanation of these two clocks written for people who have to ship something, by the first author of the papers on either side of this page. If the distinction has ever felt like pedantry, this is the thing that fixes it — and it is an evening at most.',
    },
    {
      year: '2015',
      title:
        'The Dataflow Model — Akidau et al. (VLDB), §1.3 “Time Domains”',
      url: 'https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf',
      note: 'Two pages, and the formal version of everything above — including the observation that event time for a given event essentially never changes while processing time changes constantly for the same record as it moves. Read it now and the next chapter starts one step further along.',
    },
    {
      year: '2008',
      title: 'Semantics and Evaluation Techniques for Window Aggregates in Data Streams — Li, Maier, Tufte, Papadimos, Tucker (SIGMOD)',
      url: 'https://dl.acm.org/doi/10.1145/1066157.1066193',
      note: 'Where a lot of this vocabulary actually comes from — the database community had windows, out-of-order processing and the time-domain distinction years before the internet-scale systems arrived. Worth reading to see how much of Act II was already known and how little of it had escaped into practice.',
    },
  ],
  seenIn: [
    { label: 'One Record at a Time, Forever — Ch 21', to: '/papers/millwheel', live: true },
    { label: 'The Same Query, Twice a Second — Ch 20', to: '/papers/structured-streaming', live: true },
    { label: 'What “Before” Even Means — Ch 7', to: '/papers/lamport', live: true },
  ],
  finale: {
    title: 'Not a preference, a property',
    body: 'Three clocks. One belongs to the world and never changes; one belongs to your machines and is different at every stage; one belongs to your edge and is stable about the wrong thing. The meaning argument is worth having and rarely wins on its own, so carry the mechanical one instead: an aggregation keyed on processing time cannot be computed twice from the same input, so it cannot be backfilled, corrected, or audited. Everything event time costs — open windows, later answers, a policy for stragglers — is the price of a computation you can run again. The next chapter is about the fact that those costs are three separate decisions, and that jamming them into one number is what made this hard.',
  },
  next: { title: 'When It Happened, and When You Heard', slug: 'dataflow' },
}
