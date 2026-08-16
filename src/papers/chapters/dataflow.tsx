import type { Chapter } from '../types'
import TimelinePlayer from '../../components/TimelinePlayer'
import DesignIt from '../DesignIt'
import { FourQuestionsDiagram, WatermarkBothWaysDiagram, ThreeTimesDiagram } from '../diagrams'
import { dataflowTimeline } from './dataflow-timeline'

/* The most useful paper on this subject, and the one most at risk of being
   summarised into uselessness. "It separates what, where, when and how" is
   true, memorable, and teaches nobody anything on its own.

   What makes it a chapter is the reversal at its centre. Chapter 21 spent its
   length building a completeness bound, and this paper — same first author,
   two years later — opens its design principles with "never rely on any
   notion of completeness". That is not a refinement, it is the authors saying
   the frame was wrong: a watermark is simultaneously too fast (data arrives
   behind it) and too slow (one straggler holds back the whole pipeline), so it
   cannot be the signal that decides when to emit. It becomes one trigger among
   several, a window emits many times, and the interesting question moves to
   what those emissions mean together. Every step should serve that. */

export const dataflow: Chapter = {
  slug: 'dataflow',
  act: 'Act II · Time Is Not When It Arrived',
  paperNo: 'Paper 22',
  title: 'When It Happened, and When You Heard',
  dek: 'The same authors, two years on, opening with a sentence that contradicts their own previous paper: never rely on any notion of completeness. What replaced it is the vocabulary this whole field now uses.',
  minutes: 20,
  paper: {
    title:
      'The Dataflow Model: A Practical Approach to Balancing Correctness, Latency, and Cost in Massive-Scale, Unbounded, Out-of-Order Data Processing',
    authors:
      'Tyler Akidau, Robert Bradshaw, Craig Chambers, Slava Chernyak, Rafael J. Fernández-Moctezuma, Reuven Lax, Sam McVeety, Daniel Mills, Frances Perry, Eric Schmidt, Sam Whittle',
    venue: 'VLDB',
    year: '2015',
    url: 'https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf',
  },
  caption:
    'Chapter 21 spent its whole length building a bound that tells you when you have everything. Two years later the same first author published this, and the first of its stated design principles is: **never rely on any notion of completeness.** That is not a refinement. It is the authors saying the frame was wrong — and they are specific about why. A watermark is *simultaneously* too fast and too slow. Too fast, because for most real distributed sources it is intractable to derive a perfect one, so data arrives behind it. Too slow, because it is a global metric and a single straggling record holds it back for the entire pipeline. **One number cannot be both**, so it stops being the thing that decides when to speak. What replaces it is the vocabulary every stream processor now uses, and the reason this is the most useful paper in the act.',
  steps: [
    {
      n: 'Step 01',
      title: 'The bound is wrong in both directions at once',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'Take the example the paper opens with, because it makes the conflict unavoidable. A video service shows ads and bills advertisers for how much was watched. Views happen **online and offline** — somebody watches on a phone in a field and the device uploads hours later. Advertisers want to adjust budgets in near real time. **And since money is involved, correctness is paramount.**',
        'Now try to serve that with one bound and one timer. **Too fast:** a footnote in the paper is the whole problem in three sentences — if somebody takes their device into the wilderness, the system has no practical way of knowing when they might come back, regain connection and upload. So the watermark for that window will pass before the data does, and no tuning fixes it, because the missing information is *not in your system.*',
        '**Too slow:** the bound is a global progress metric, so it is held back for everyone by whoever is furthest behind. And even in a healthy pipeline the baseline skew may be minutes. A billing team in the paper hit exactly this, with watermark lags caused by stragglers in their input. So the advertiser waiting for a number waits for the slowest device on the internet.',
        'And notice what the two failures want. Too-fast wants **to emit again later**. Too-slow wants **to emit sooner, before you are sure.** One signal cannot want both, which means the design was never going to work by getting the bound more accurate. *The mistake was asking one number to decide when to speak at all.*',
      ],
      diagram: <WatermarkBothWaysDiagram />,
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'Three decisions, and unusually for this book the first one is about vocabulary rather than mechanism. That is the paper: almost nothing here is a new algorithm, and the contribution is what it lets people say.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**The application:** bill advertisers for video watched, and give them near-real-time statistics. Views arrive from devices that may be offline for hours. Money is involved, so being eventually right is not optional.',
              '**What you have already:** event time, processing time, and a watermark that computes a bound on the first from the pipeline’s pending work. All of Chapter 21.',
              '**What you have learned:** the bound is sometimes too fast and sometimes too slow, and those two failures want opposite responses.',
              '**Who is asking:** a billing team who cannot ever drop a view; a statistics team who want a good number in a reasonable time; an abuse team who would rather have 90% of the data now than 100% in ten minutes.',
              '**What you will not accept:** three pipelines, or a streaming implementation shadowed by a nightly batch one that recomputes the truth.',
            ],
            questions: [
              {
                q: 'The three teams want incompatible things from one pipeline. Before you build anything, what do you do?',
                options: [
                  {
                    label: 'Split the decision into four independent questions, and let each team answer them differently',
                    verdict: 'move',
                    why: 'The four are **what** results are computed (the transformations), **where** in event time they are grouped (windowing), **when** in processing time they are emitted (triggering), and **how** later results relate to earlier ones (accumulation). It reads like taxonomy and it is doing real work: every earlier system in this book answers all four *at once*, by having no vocabulary that separates them, which is exactly why the three teams appear to be in conflict. They are not — they agree on **what** and **where** and differ on **when**. Once that is sayable, one pipeline serves all three. *The clarity is the contribution: the questions were always separate, and the tools made them look like one.*',
                  },
                  {
                    label: 'Make the watermark much more accurate — better estimates at the injectors, percentile bounds, tighter propagation',
                    verdict: 'dead',
                    why: 'All of that is real, some of it ships, and none of it addresses the conflict. Accuracy moves the bound; it does not let the bound be in two places at once, and the abuse team wanting 90% now and the billing team wanting 100% eventually are asking for two different moments. There is also a hard floor you cannot engineer past: the view that has not left the phone is not measurable from your side at any price. **Improving an estimate is not the same as no longer needing one number to serve two purposes.**',
                  },
                  {
                    label: 'Give each team the knob they need — a slack setting, a completeness percentage, a late-data policy',
                    verdict: 'dead',
                    why: 'This is the state of practice the paper is written against, and its failure is that the knobs are not composable. Each is a local fix to a local complaint, so a pipeline accumulates a slack constant here and a percentile there, and nobody can state what the whole thing guarantees. The billing teams in §3.3 lived this: recommended practice was to use the watermark as a completion metric *with ad hoc logic to deal with late data*, and one of those teams eventually **left the platform** and built their own. **A pile of knobs is what a missing abstraction looks like from the outside.**',
                  },
                  {
                    label: 'Run the streaming pipeline for speed and a nightly batch job to produce the truth',
                    verdict: 'dead',
                    why: 'The Lambda architecture, and the paper reports what happened to a team that did it: they ran the streaming pipeline in weak consistency mode with a nightly job to generate truth, and **their customers stopped trusting the weakly consistent results over time.** So they rewrote the whole thing around strong consistency. That is the real cost and it is not the second cluster — *a number people have learned to distrust has negative value*, because now every consumer needs a rule about which of your two answers to believe, and nobody writes that rule down.',
                  },
                ],
              },
              {
                q: 'A window has to produce a result. When?',
                options: [
                  {
                    label: 'Whenever any of several signals says so — and let the window emit more than once',
                    verdict: 'move',
                    why: 'The move is not the list of signals, it is **letting one window emit many times**. Each emission is a *pane*, and the window is not closed by emitting — it goes on accumulating. That single change turns the impossible tradeoff into a choice of triggers: fire on a processing-time period for the advertiser who wants something now; fire when the watermark passes for the statistics team; fire on a **percentile watermark** for the abuse team who want most of the data quickly; fire on a count or on the data itself for an anomaly detector that should speak the moment it is confident. And they compose — with *and*, *or*, sequences and loops — so a single window can emit early on a clock, once at the bound, and again if something late arrives. *Emitting stopped meaning finishing, and that is the whole unlock.*',
                  },
                  {
                    label: 'When the watermark passes the end of the window',
                    verdict: 'dead',
                    why: 'The previous chapter’s answer, and step 1 is the argument against it: it is the wrong moment for two of your three teams, and it is *sometimes* the wrong moment for the third. It is worth being clear that this option is not deleted — a watermark trigger remains the most useful single trigger in the set, and the statistics teams in §3.3 use exactly it, precisely because for structured sources like log files the heuristic turns out to be remarkably accurate. **What changes is that it is one option rather than the mechanism.**',
                  },
                  {
                    label: 'On a fixed processing-time period — every thirty seconds, emit whatever you have',
                    verdict: 'dead',
                    why: 'Also a real trigger, also kept, and alone it is a regression. A recommendation pipeline in the paper drove its output entirely this way and was right to: regularly updated partial views were more valuable to it than mostly-complete ones, and a small amount of slow data could not delay everybody else. But make it the only signal and you can never say *this window is now as good as it is going to get* — every number is provisional forever, and the billing team cannot bill from it.',
                  },
                  {
                    label: 'Let the user set a maximum lateness and emit once, when that expires',
                    verdict: 'dead',
                    why: 'It sounds like the compromise and it takes the worst of both. You have reintroduced a constant somebody has to guess, you still emit only once so the advertiser still waits, and you have made the guess *worse* than a timeout in the previous chapter because it is now doing the work the watermark was doing. Maximum lateness is genuinely useful — it is how you decide when to **drop the state** — but that is a different question from when to speak, and merging them is the mistake being unwound.',
                  },
                ],
              },
              {
                q: 'A window has now emitted three times. What does your consumer do with three numbers for one window?',
                options: [
                  {
                    label: 'Make it a stated mode: the panes are independent, or each replaces the last, or each is preceded by a retraction of the last',
                    verdict: 'move',
                    why: 'Three modes, and each is correct for a different consumer. **Discarding** throws the window contents away on each fire, so panes are independent and a downstream sum is right — and it buffers the least. **Accumulating** keeps the contents, so each pane refines the last, which is what you want writing into a store keyed by window. **Accumulating and retracting** also emits a retraction of the previous value first, and it is not a luxury: if something downstream has *already grouped on the old value*, and the regrouping put it on a different key, there is no other way to tell it to stop counting the old one. The video-session case needs exactly this — an ad judged unpopular from early sessions can be un-judged when offline viewers come back. **Making it a stated mode is the point**; every consumer already had an implicit answer, and implicit answers between two systems is how they disagree.',
                  },
                  {
                    label: 'Always send the complete current value and let consumers overwrite',
                    verdict: 'dead',
                    why: 'This is *accumulating*, it is the most common choice, and making it the only one breaks a specific and common case. Overwriting works when the consumer is a key-value store keyed by the same window. It fails the moment anything downstream **groups again** — because the second grouping may put the old value and the new value on different keys, so overwriting never happens and the old contribution is counted forever. The failure is silent, it appears only in multi-stage pipelines, and it is precisely what retractions exist to fix.',
                  },
                  {
                    label: 'Tell consumers to deduplicate by window id and take the last one they saw',
                    verdict: 'dead',
                    why: '“Take the last one” requires an ordering nobody guaranteed, and in a distributed pipeline panes for one window can reach a consumer out of order. So you would need a pane sequence number, and a rule about gaps, and now every consumer of your stream implements a small unreliable protocol in application code. *This is the same shape as Chapter 20’s argument about relaxing exactly-once:* refusing to define the semantics does not remove the work, it relocates it to somebody with less context.',
                  },
                  {
                    label: 'Emit only the final pane to external consumers, and keep the early ones internal',
                    verdict: 'dead',
                    why: 'You have deleted the feature. The early panes exist *because* an external consumer — the advertiser adjusting a budget — wanted them; keeping them internal serves nobody. And there is no final pane to identify anyway, since a late record may arrive at any point. **“Final” is exactly the notion of completeness the paper opens by refusing.**',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived the Dataflow model — and the sentence it opens with',
              body: [
                '**The model, stated plainly.** A pipeline answers four questions independently. *What* results are computed: the transformations. *Where* in event time they are grouped: windowing, including **unaligned** windows like per-user sessions, which is the paper’s main contribution over earlier windowing models. *When* in processing time they are materialised: triggers, which may be watermarks, percentile watermarks, processing-time periods, record counts, data-driven signals, or compositions of those. *How* earlier results relate to later ones: discarding, accumulating, or accumulating with retractions.',
                '**And the design principle it leads with:** *never rely on any notion of completeness.* Read against the previous chapter that is startling, and it is the correct lesson from having shipped one. Completeness is not achievable for real sources, so a system built on it will either lie or wait forever. What you can do is make the *choice* explicit — how correct, how fast, how expensive — and let each consumer of one pipeline sit somewhere different on it.',
                '**The consequence people underrate.** Because the model says nothing about execution, the same pipeline runs on a batch engine, a micro-batch engine or a streaming engine, and the choice becomes one of latency and cost rather than semantics. That is what made the backfill problem go away — the thing that had forced a log-join team to maintain a streaming implementation *and* a separate batch one. **Chapter 20 shipped the same claim three years later from the other side of the industry**, and the two arriving independently is the strongest evidence either of them was right.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'One window, five answers',
      accent: 'denim',
      rung: 'Rung 3 · The reveal',
      span: 2,
      body: [
        'Watch the first band. In the previous chapter’s timeline a window emitted once, at the watermark, and a record that turned up afterwards was dropped and counted. Here the same window speaks five times, and the badge above it says which kind of speaking it was.',
        'Step 5 is the phone in the field — the case the paper says no watermark can be right about — and step 7 is the question that only becomes askable once a window can emit more than once.',
      ],
      diagram: (
        <div className="gn-figure">
          <TimelinePlayer spec={dataflowTimeline} />
        </div>
      ),
      think: {
        q: 'If completeness is never to be relied on, what was the previous chapter’s watermark for?',
        a: '**It was for two things, and this paper keeps one of them and demotes the other.** The demoted job is being *the* signal that a result may go out. That job assumed the bound could be trusted as a statement about the world, and it cannot: for most real distributed sources the system lacks sufficient knowledge to establish a correct watermark, so a design that waits for one is waiting for something that will sometimes never be true and will always be later than somebody needed. The kept job is quieter and it survives intact. A watermark remains an excellent estimate of *when the system thinks it has probably seen everything up to a point*, and this paper still uses it for exactly that — as one trigger among several, as a way to visualise and monitor skew, as a health signal for a pipeline, and, crucially, **as the basis for garbage collection.** That last one is worth sitting with, because it is where the two chapters genuinely agree. You have to drop old windows eventually or state grows without bound, and dropping state is a decision that tolerates being approximately right in a way that publishing a billing number does not: if you discard a window a little too early you lose a record that would have arrived, which is bad, and if you discard a little late you spent some memory, which is fine. *So the same number is unfit to decide when to speak and perfectly fit to decide when to forget* — and the reason is that those two decisions have different costs of being wrong. **The previous chapter’s error was not the watermark. It was using one bound for two decisions whose error tolerances are not the same**, which is the same shape of mistake as Chapter 17’s cache doing latency and load-hiding at once.',
      },
    },
    {
      n: 'Step 04',
      title: 'The pipelines that made them write it',
      rung: 'Rung 4 · The measurement',
      body: [
        'This paper has no benchmark table, and pretending otherwise would be dishonest. What it has instead is §3.3 — six real pipelines and what each one broke — and that is a stronger validation for a *model* than a throughput number would be. Each feature exists because a team hit a wall in production.',
        '**Billing, twice.** One team processing resource-utilisation statistics had no principled way to handle updates and retractions, and **left the platform to build their own** — whose design, the authors note ruefully, ended up very similar to the one they were concurrently developing. A second billing team was crippled by watermark lag caused by stragglers. Together those two produced triggers and retractions, and the paper says explicitly what they caused: **a shift of focus from targeting completeness to targeting adaptability over time.**',
        '**Statistics and abuse detection** produced watermark triggers and percentile watermark triggers. For structured sources like log files, the paper reports the heuristic watermark is *remarkably accurate*, so a single high-accuracy pane per window is exactly right — and for abuse detection, where processing most of the data quickly beats processing all of it slowly, the percentile version is. *Two teams, same mechanism, different point on it.*',
        '**Recommendations** produced processing-time triggers, because regularly updated partial views were worth more to them than complete ones, and because a small amount of slow data should not delay everybody else’s output. **Anomaly detection** produced data-driven and composite triggers: a differ watching for spikes should speak the moment it is confident, and driving it off a periodic signal would turn a streaming system into a micro-batch one and add latency for no reason.',
        'And **sessions** — unaligned windows that span only a subset of a source, one per user, closed by a gap in activity — are called the main contribution of the windowing model. They were, the paper says, one of the reasons MillWheel was created in the first place, and are used across search, ads, analytics, social and YouTube. *Anybody correlating bursts of otherwise disjoint user activity is computing sessions*, and before this they were computing them by hand.',
      ],
      code: {
        file: 'the_four_questions.java',
        lines: [
          { t: '// WHAT: sum the seconds watched' },
          { t: 'Sum.integersPerKey()' },
          { t: '' },
          { t: '// WHERE: per user, closed by a 30-minute gap' },
          { t: '.withWindowing(Sessions.withGapDuration(30, MINUTES))', hl: 'good' },
          { t: '' },
          { t: '// WHEN: something now, the good one at the bound,' },
          { t: '//       and again if anything turns up late' },
          { t: '.withTrigger(' },
          { t: '   Repeat(AtPeriod(1, MINUTE))' },
          { t: '   .orFinally(AtWatermark())' },
          { t: '   .withLateFirings(AtCount(1)))', hl: 'good' },
          { t: '' },
          { t: '// HOW: retract the old number before sending the new one' },
          { t: '.accumulatingAndRetractingFiredPanes()', hl: 'good' },
          { t: '' },
          { t: '# four lines, four decisions, and each can change alone' },
        ],
      },
      diagram: <FourQuestionsDiagram />,
      deeper: {
        summary: 'Why retractions are not just “send the new number”',
        body: [
          'Accumulating looks like it covers everything: emit the current total, let the consumer overwrite the old one. It works, right up until anything downstream **groups again**.',
          'Take the video case. A session-building stage emits a session; a second stage groups sessions by ad and flags ads watched for less than five seconds in most sessions. The first stage emits an early pane for a session lasting three seconds. The second stage groups it under key *short*, and flags the ad. Then the offline viewers come back, the session turns out to be four minutes long, and the first stage emits a corrected pane — which the second stage groups under key *long*.',
          '**Nothing overwrote anything**, because the two panes went to different keys. The *short* group still holds a contribution from a session that is not short, and no future message will ever visit that key to fix it. The ad stays flagged, and the only trace is a number that is quietly too high forever.',
          'A retraction is a message that says *undo the previous value*, delivered to the key the previous value went to. That is why it has to be emitted by the stage that made the claim rather than inferred by the consumer: only the producer knows what it previously said and where that went. Operations that are reversible can implement it cheaply with an *uncombine*; ones that are not have to keep the emitted value in state, which is the honest cost. *The general rule this teaches: any system where a correction can be routed differently from the thing it corrects needs an explicit retraction, and the failure of not having one is always silent.*',
        ],
      },
    },
    {
      n: 'Step 05',
      title: 'Refuse the thing everyone else is trying to achieve',
      rung: 'Rung 5 · The design stance',
      body: [
        'The five design principles are listed in half a page and the first one carries the rest: **never rely on any notion of completeness.** It is a strange thing to build a system on a refusal, and it is the most transferable idea in this act, because it converts an unachievable goal into a set of achievable choices. You cannot make a pipeline know it has everything. You can let a pipeline say *here is what I have, here is how sure I am, and here is what I will do when I learn more.*',
        'The others are quieter and worth having: be flexible enough for use cases nobody has thought of yet; make sense **and add value** in the context of each execution engine, not merely be implementable on all of them; encourage clarity of implementation; and support robust analysis of data **in the context in which they occurred**, which is the event-time argument stated as a principle rather than a feature.',
        'The stance shows up most clearly in what the paper declines to do. It does not claim to make anything faster — it says outright that **there is nothing magical about this model**, that computationally impractical things remain impractical, and that CPU, RAM and disk stay steadfastly in place. What it provides is a way to express a computation independently of the engine, and to dial in the latency and correctness a specific problem needs. *A paper that tells you what it does not improve is unusual, and it is what lets you trust the rest.*',
        'And it makes one structural claim that the industry has since ratified: **stop letting the execution engine dictate the semantics.** Properly built batch, micro-batch and streaming systems can all offer the same correctness, so the choice between them should come down to latency and resource cost. Chapter 20 shipped that same claim from a different company three years later. **Two independent arrivals at one conclusion is the closest this field gets to a proof.**',
      ],
      diagram: <ThreeTimesDiagram />,
    },
    {
      n: 'Step 06',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 6 · What the flexibility costs',
      body: [
        '**Every window now holds state until somebody decides otherwise.** Panes mean a window stays open after it has spoken, and *accumulating* means its contents stay in memory, and *retracting* means the emitted value stays too. So state is a function of how long you are willing to accept late data — which is a number a person picks, and which is now unhooked from the watermark that used to imply it.',
        '**The API surface is genuinely large, and Chapter 20 was written about that.** Four questions answered per aggregation, triggers composed with *and*, *or*, sequences and loops, three refinement modes, and the specific trap Chapter 20 names: **an operator that expects deltas placed after one that emits accumulated totals gives wrong answers, and nothing on either side detects it.** The expressiveness is real and so is the cost of it, and both papers are right about the other.',
        '**Retractions are not free and not always possible.** Reversible operations can uncombine cheaply; the rest must keep what they emitted so they can withdraw it. And **every downstream consumer must understand retractions**, which most external systems do not — so at the edge of your pipeline the mode collapses back to whatever the sink can accept.',
        '**Multiple panes are a contract with everyone downstream.** A consumer that reads one number and stops has silently opted out of correctness. This is easy to get wrong precisely because the early pane looks exactly like the final one; there is no type distinction between *my best guess* and *the number you may bill from*, only the mode you agreed on.',
        '**And the honest one the paper states itself:** nothing here makes anything faster or cheaper. It does not make the phone in the field upload sooner. What it does is stop you having to pretend that it did.',
      ],
      callout: {
        kind: 'bad',
        big: 'A PANE IS NOT A CORRECTION',
        text: 'Five answers for one window are not four mistakes and a fix. Each was the best available answer when it was given — which only makes sense if the consumer was told which mode it was reading, and that agreement lives in a config field nobody re-reads.',
      },
    },
    {
      n: 'Step 07',
      title: 'Where it stands in 2026',
      rung: 'Rung 7 · The vocabulary won',
      body: [
        '**This paper became Apache Beam, and more importantly it became the words.** Event time, processing time, windowing, watermarks, triggers, panes, allowed lateness, accumulation mode: open any stream processor’s documentation and that is the vocabulary, whoever wrote it. **The four questions are how the subject is taught.** A model that changes how people talk has outperformed one that merely runs faster.',
        '**The portability claim did less well than the vocabulary, and that is fair.** Beam’s promise that one pipeline runs on any engine is real and the runners differ in what they support, so in practice teams still pick an engine and mostly stay. *The semantic unification travelled; the operational one is harder than a model can fix.*',
        '**The part still routinely got wrong is retractions.** Most pipelines in the wild accumulate and overwrite, which is correct until something downstream regroups — and then produces a number that is quietly too high, with no error anywhere. It is the single most under-implemented idea in the paper and the one whose absence is hardest to notice.',
        '**And here is what the act has and has not settled.** After three chapters you can say precisely what you want: where data is grouped, when you speak, how a later answer relates to an earlier one, and what you will do about the phone in the field. Every one of those is now a decision rather than an accident. *What none of it has touched is what happens when a machine dies in the middle.* All of this machinery — the open windows, the buffered panes, the retained emitted values — is **state**, and the two chapters that had good answers for that were Chapter 18, which could recompute because nothing was mutable, and Chapter 19, which stopped every worker in the cluster. Neither is available here. The last chapter of this act is how to photograph a system that is not allowed to hold still.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Windowing.',
      body: 'Where in event time records are grouped. Fixed, sliding, or unaligned — the last meaning windows that cover only part of a source, like one per user.',
    },
    {
      term: 'Session window.',
      body: 'An unaligned window closed by a gap in activity rather than by a clock. Called the main contribution of this windowing model, and the thing everybody was hand-rolling before it.',
    },
    {
      term: 'Trigger.',
      body: 'When in processing time a window emits. May be a watermark, a percentile watermark, a period, a count, a data-driven signal, or a composition of those.',
    },
    {
      term: 'Pane.',
      body: 'One emission from a window. A window may produce many, and producing one does not close it.',
    },
    {
      term: 'Percentile watermark.',
      body: 'A bound tracking the progress of, say, 99% of record timestamps instead of all of them. For workloads where most of the data quickly beats all of it slowly.',
    },
    {
      term: 'Retraction.',
      body: 'A message withdrawing a previously emitted value, sent before its replacement. Required when something downstream may have grouped on the old value under a different key.',
    },
  ],
  inTheWild: {
    note: '5 ways this bites in production',
    points: [
      '**Accumulating is chosen by default and the pipeline later grows a second grouping stage.** The overwrite that used to fix everything now sends the correction to a different key, and the old contribution is counted forever. Nothing errors; a number is just too high.',
      '**Allowed lateness is set generously “to be safe” and the job dies of memory weeks later.** It is the setting that decides how long every window is retained, and its cost is invisible at the moment somebody chooses it.',
      '**A consumer reads the first pane and treats it as the answer.** There is no type distinction between an early pane and an on-time one, so the discipline lives entirely in whether two teams agreed — and one of them has since been reorganised.',
      '**Trigger expressions become unreadable.** Composed triggers with early firings, late firings and a watermark condition are genuinely hard to read six months later, and there is no test that tells you the semantics changed when somebody simplified one.',
      '**Sessions merge unexpectedly when a late record lands in the gap.** Two sessions separated by a 31-minute gap become one when a record arrives 30 minutes late in the middle, which is correct, surprising, and very hard to explain to whoever is looking at the dashboard.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Separate when-to-speak from when-you-are-sure',
        when: 'different consumers of one result need different latencies. **Merging them into one signal is what makes the requirements look contradictory** — they usually agree on what is being computed and differ only on when they need to hear it.',
      },
      {
        choose: 'Let a result be emitted more than once',
        when: 'the input can still change after you have answered. Emitting stops meaning finishing, which costs you a state-retention decision and buys you the ability to be both fast and eventually right in one pipeline.',
      },
      {
        choose: 'Emit an explicit retraction',
        when: 'anything downstream might group your output again. A correction that lands on a different key than the thing it corrects is not a correction, and the failure leaves no trace.',
      },
      {
        choose: 'Refuse to rely on completeness',
        when: 'the data comes from a world you do not control. You cannot know you have everything, so build the system that says how sure it is and what it will do when it learns more — and put that in the API rather than in a runbook.',
      },
    ],
  },
  misconception: {
    think: '“This paper is about windowing — it gave streaming systems proper time windows.”',
    actually:
      'Windowing was well studied before this and the paper says so, citing a decade of work from the database community. Its own windowing contribution is narrower and specific: **unaligned windows**, meaning windows that cover only part of a source — per-user sessions, closed by a gap in activity rather than by a clock — which people were hand-rolling everywhere and which the model makes trivial. But the reason this paper reorganised the field is the other axis entirely. **It separated where data is grouped in event time from when a result is emitted in processing time**, and then allowed one window to emit many times. Before that, emitting *was* closing, so a system had exactly one chance to be right and every design argument collapsed into how long to wait. Afterwards, the advertiser gets a partial number in thirty seconds, the statistician gets the good one when the watermark passes, and the billing system gets a corrected one when a phone comes back from a field — from a single pipeline, with the difference expressed as a trigger rather than as three deployments. *The windows are the part that looks like the contribution. The triggers are the part that changed what was buildable.*',
  },
  sources: [
    {
      year: '2015',
      title:
        'The Dataflow Model: A Practical Approach to Balancing Correctness, Latency, and Cost in Massive-Scale, Unbounded, Out-of-Order Data Processing — Akidau et al. (VLDB)',
      url: 'https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf',
      note: 'Read **§1.3** for the two time domains and then go straight to **§2.4**, which is the best thing in it: the same computation drawn a dozen times under different windowing and triggering choices, so you can see the model rather than be told it. Then **§3.3**, six real pipelines and what each one broke — including the billing team that left the platform. Skipping §3.3 is how people end up remembering this as a taxonomy paper.',
    },
    {
      year: '2013',
      title: 'MillWheel: Fault-Tolerant Stream Processing at Internet Scale — Akidau et al. (VLDB)',
      url: 'https://research.google.com/pubs/archive/41378.pdf',
      note: 'Chapter 21, by the same first author, and this paper’s own prior work. Read them in order and notice the reversal: one builds a completeness bound with great care, the other opens its principles by refusing to rely on completeness at all. That is what two years of operating something looks like, written down.',
    },
    {
      year: '2015',
      title: 'Streaming 102: The world beyond batch — Tyler Akidau',
      url: 'https://www.oreilly.com/radar/the-world-beyond-batch-streaming-102/',
      note: 'The same model without the paper’s formality, by the same author, with animations of exactly what §2.4 draws statically. If the four questions feel like a taxonomy after reading the paper, read this — it is where most practising engineers actually learned this material, and deservedly.',
    },
    {
      year: '2018',
      title:
        'Structured Streaming: A Declarative API for Real-Time Applications in Apache Spark — Armbrust et al. (ACM SIGMOD)',
      url: 'https://dl.acm.org/doi/10.1145/3183713.3190664',
      note: 'Chapter 20, and the strongest published critique of this model — that its expressiveness makes every user an expert in incremental processing, and that an operator expecting deltas after one emitting totals fails silently. Both papers are right. Read the disagreement rather than picking a side; it is the clearest case in this book of two correct answers to different questions about the same problem.',
    },
    {
      year: '2016',
      title: 'Apache Beam',
      url: 'https://beam.apache.org/',
      note: 'What this model became: an SDK that expresses the four questions and runs on several engines. Worth an hour with the programming guide even if you never ship it, because the vocabulary in it is now the vocabulary everywhere, and seeing the API makes the paper’s abstractions concrete.',
    },
  ],
  seenIn: [
    { label: 'One Record at a Time, Forever — Ch 21', to: '/papers/millwheel', live: true },
    { label: 'Interlude: The Three Times', to: '/papers/three-times', live: true },
    { label: 'The Same Query, Twice a Second — Ch 20', to: '/papers/structured-streaming', live: true },
    { label: 'The Retreat — Ch 17', to: '/papers/dynamodb', live: true },
  ],
  finale: {
    title: 'Adaptability instead of completeness',
    body: 'The previous chapter built a bound and this one says do not lean on it, which sounds like a retraction and is really a discovery about what the bound was for. A watermark is simultaneously too fast and too slow, and those two failures want opposite fixes, so no amount of accuracy was ever going to make one number serve both. What replaced it is not a better estimate but a decomposition: where data is grouped, when a result goes out, and how a later answer relates to an earlier one, each answered on its own. A window emits many times and emitting stops meaning finishing. That is the change that let a single pipeline serve an advertiser who wants something in thirty seconds and a billing system that can never lose a view. What it does not touch is the machine that dies holding all of it — the open windows, the buffered panes, the values you kept so you could retract them. That is state, and the last chapter of this act is how to photograph it without stopping the world.',
  },
  next: { title: 'A Photograph of a Moving System', slug: 'flink-snapshots' },
}
