import type { Chapter } from '../types'
import { StalenessLadderDiagram, TwoEndingsDiagram } from '../diagrams'
import { ArcTable, ThroughLines } from '../SeasonBlocks'

/* The second close, and it works the way the first one does: nothing here is
   a new fact. Everything factual is somewhere else in the book; what is new is
   the arrangement, which is the only thing a chapter cannot supply about
   itself.

   Two things make this page different from Season 1's, and both come from the
   material rather than from wanting variety.

   Season 1's close can land a conclusion, because Season 1 converges — six
   acts making the same move, and an epilogue that ties it off. Season 2's body
   converges too, on the ladder, and that part is written the same way. Its
   ENDING does not. Chapters 29 and 30 reach opposite conclusions from the same
   observation, both shipped, both in production. So the last blocks of this
   page acknowledge the split and hand the reader a way to tell which one
   describes them — they do not pick, and they do not re-argue it either. The
   chapters already did the arguing; running it again in smaller type would be
   the epilogue with the interesting parts removed.

   Which is why the two-endings figure here is the same figure Chapter 30 ends
   on, reused deliberately rather than redrawn. A new drawing would imply a new
   claim. There isn't one. */

export const season2: Chapter = {
  slug: 'season-2',
  act: 'The Close · Season 2',
  paperNo: 'The close',
  title: 'The Season, in One Page',
  dek: 'Thirteen papers about shortening the gap between a thing happening and somebody seeing it. What the four acts add up to, the ideas that cross all of them, and why the ending is two answers instead of one.',
  minutes: 9,
  caption:
    'The trade this season argues about is not consistency against availability. It is **freshness against everything freshness costs** — and what made that a different argument from Season 1’s is that the data stopped sitting still and waiting to be visited. Read the chapters straight through and they look like thirteen unrelated systems. Read the acts and there is a ladder: each one takes a slice off the wait between an event and somebody seeing it, by a mechanism that has nothing to do with the others, and every single one sends the same bill. This page is that ladder, the ideas that cross it, and an ending the season declines to settle — because the field has not settled it either.',
  steps: [
    {
      title: 'One ladder, four rungs',
      accent: 'denim',
      body: [
        'The season has one subject and it is a duration: **the gap between a thing happening and somebody being able to see it.** Every act shortens it, and no two of them do it the same way. Keeping the middle of a computation in memory has nothing mechanically in common with deciding what to do about a record that arrived an hour late, or with maintaining an answer instead of recomputing it, or with a data type whose merge is forced by its shape.',
        'What they have in common is the invoice. *Look down the right-hand column.* Memory that cannot be spilled. Windows held open for arrivals that may never come. Every difference kept and indexed rather than folded away. A change history nobody is allowed to truncate. **Four different disguises for the same thing: state that has to stay hot, because the alternative is going back to the data.** That is the season in a sentence, and none of the four papers puts it that way — you can only see it from a page like this one.',
      ],
      diagram: <StalenessLadderDiagram />,
    },
    {
      title: 'The acts, as the trade each one made',
      span: 2,
      body: [
        'The same four columns Season 1’s ledger uses — **the wall, the guarantee sold, what that bought, and the bill** — and this season’s cost column is worth reading on its own, because it is a list of the numbers that end up in somebody’s capacity plan. Resident memory. Window retention. Index size. History that only grows.',
        'The last row is the one that does not behave. Every other act in this book, in either season, ends with one answer and a bill for it. The epilogue ends with two answers that disagree, so its row holds both — which is not a formatting compromise. *It is the honest content of that act.*',
      ],
      diagram: <ArcTable season={2} />,
    },
    {
      title: 'What kept coming back',
      accent: 'denim',
      span: 2,
      body: [
        'The ideas with no chapter of their own, because no single paper can claim them. Deliberately no overlap with Season 1’s six, even where one of those genuinely resurfaces — the log turns up again, hard, in the epilogue, and it is already written up there rather than padded out again down here.',
      ],
      diagram: <ThroughLines season={2} />,
    },
    {
      title: 'The ending the season does not settle',
      accent: 'terra',
      body: [
        'Both epilogue chapters start from the same observation — that you have assembled the parts of a database by hand — and go in opposite directions. **Chapter 29 draws the system boundary around one storage layer**, so batch, streaming and interactive workloads share a set of tables, and pays a few commits a second with no transaction spanning two of them. **Chapter 30 draws it around many specialised stores joined by a log**, and pays with stale reads, work reprocessed after a crash, and nothing that can optimise across the seam.',
        'It is worth being clear that this is not a gap in the book. Both papers shipped, both approaches are in production at scale, and companies run them together — a topic feeding a table that something else queries. *There is no experiment that settles it*, because the thing being optimised is not throughput. It is where you want your seams, which is a question about how many teams you have and how independently they deploy — which is exactly what the 2015 paper was saying when it listed organisational scalability beside throughput as a design requirement.',
        'So the useful question is not which one is right. It is **which one describes what you already have.** If you keep four copies of one dataset because the layer underneath could not update them atomically, that is waste, and Chapter 29 is about you. If you are running a search index and a columnar store because a full-text query and a scan of one column are genuinely different jobs, that is not waste, and no amount of merging will make it so — and then the thing worth fixing is the tangle of bespoke pipelines between them, which is Chapter 30. Most architectures have some of each, and the two chapters are better read as a diagnostic than as a choice.',
      ],
      diagram: <TwoEndingsDiagram />,
    },
    {
      title: 'What this season left out, and what it is fair to doubt',
      accent: 'terra',
      body: [
        '**The papers do not know about each other.** Season 1 had a chronology to hang on — one paper answering the previous one, roughly in order. These bunch into 2011–2020 and were mostly written in parallel by people solving the same problem in different buildings. The ladder is an arrangement imposed afterwards by this book; it is a useful one and it is not a lineage. *Where Season 1 could say "and so, next, somebody did this", this season mostly cannot.*',
        '**Several things that belong here are somewhere else on purpose.** The scheduling and isolation layer everything in this season actually runs on — the cluster manager, the sandbox — is Book I’s subject, and the rule for this shelf is that overlaps cross-link rather than duplicate. Materialize, ksqlDB and Flink SQL are named in passing rather than read, because Act III already reads the theory underneath all three.',
        '**And the sourcing is one-sided in the same way Season 1’s was.** Nearly every paper here comes from the company that shipped the system, describing the version that worked, with numbers no outsider can reproduce. This season adds a second-order version of the same problem: several of these papers are five to fifteen years old, and the clouds underneath them have changed twice — S3 gained strong consistency months after one of these papers described its absence as a design constraint, and gained the conditional write that retired a whole coordination service four years after that. **Treat every measurement here as a claim by an interested party about a machine that no longer exists.** Which is not a reason to disbelieve them, and is a reason to check the date before you quote a number.',
      ],
    },
  ],
  sources: [
    {
      year: '2015',
      title: 'The Dataflow Model — Akidau et al. (PVLDB 8(12))',
      url: 'https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/43864.pdf',
      note: 'If you read one paper again from this season, this one. It is the only paper here whose contribution is a set of questions rather than a system, and the four it names — what, where, when, how — are the vocabulary the rest of the field ended up using. Chapter 22 covers it; the paper is better.',
    },
    {
      year: '2021',
      title: 'Streaming Systems — Akidau, Chernyak & Lax (O’Reilly)',
      url: 'https://www.oreilly.com/library/view/streaming-systems/9781491983867/',
      note: 'The book-length version of Act II, by the people who wrote the model, and the clearest published explanation of why event time is not a preference. Read it if the watermark chapter left you wanting the animations — it has them, and they are better than anybody else’s.',
    },
    {
      year: '2015',
      title: 'Immutability Changes Everything — Pat Helland (CIDR)',
      url: 'https://www.cidrdb.org/cidr2015/Papers/CIDR15_Paper16.pdf',
      note: 'Recommended at the end of Season 1 as well, and it earns the repeat: read it a second time with this season in hand, because half the essay is about the thing Act III and the epilogue are both doing. Append-only storage as the default at every layer, and the derived copy as the normal state of affairs rather than the exception.',
    },
    {
      year: '2017',
      title: 'Designing Data-Intensive Applications — Martin Kleppmann',
      url: 'https://dataintensive.net/',
      note: 'Chapters 11 and 12 are the mechanisms this season watched being invented, explained as things you might choose rather than as things somebody once had to build. The pairing works the same way it did in Season 1: a chapter here for the pressure, the matching chapter there for the machinery.',
    },
  ],
  seenIn: [
    { label: 'The Cost of Starting Over — Ch 18', to: '/papers/spark', live: true },
    { label: 'Sewing It Back Together — Ch 29', to: '/papers/delta', live: true },
    { label: 'The Database, With the Lid Off — Ch 30', to: '/papers/unbundling', live: true },
    { label: 'Season 1, in one page', to: '/papers/season-1', live: true },
  ],
  finale: {
    title: 'The bill was always the same bill',
    body: 'Thirteen papers about one duration — the wait between an event and somebody seeing it — and four acts that each shorten it by a mechanism with nothing in common with the others. Keep the middle of the computation in memory and recover by replaying the recipe. Key results to when things happened rather than when they turned up, speak before the input is complete, and correct yourself afterwards. Make the change itself the thing being computed, so an answer is edited instead of rebuilt. Make convergence a property of the data, so that the copy in the tunnel is not a stale one — it is simply a copy. Four unrelated ideas, and every one of them is paid for in state that has to stay hot: memory that cannot spill, windows held open for arrivals that may never come, every difference kept and indexed, a change history nobody may truncate. That is the season, and it is the thing to carry out of it — when somebody offers you fresher data, the question is not whether the mechanism works, it is what has to stay resident for it to. And the ending is two people looking at the same heap of parts and disagreeing about whether the right move is to put the lid back on, which is not a hole in the argument. It is where the argument currently is.',
  },
  next: { title: 'One Machine Was Enough', unwritten: true },
}
