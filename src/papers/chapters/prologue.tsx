import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import {
  SeekBudgetDiagram,
  BTreeReachDiagram,
  FiveStructuresDiagram,
  ThreeLoansDiagram,
} from '../diagrams'
import { prologueTrace } from './prologue-trace'

/* Written last, read first, and the only chapter in the book whose job is to
   set up debts rather than to pay one off. It reads three documents because
   the thing being described is not a system — it is the state of the art that
   Chapter 1 walks away from, and no single paper contains it.

   Two traps. The first is writing a textbook chapter: relational algebra,
   B-tree splits, ACID as an acronym. All of that is available better
   elsewhere, and none of it is what the rest of this book spends. So the
   spine is the 50-millisecond seek — one physical fact that Bayer and
   McCreight measure and Gray is still quoting eight years later — and every
   idea here is a way of not paying it.

   The second is nostalgia. "One machine was enough" has to be a measured
   claim rather than a fond one, which is why Gray's ceiling is quoted
   directly: 150 transactions a second and a hundred gigabytes was the limit
   of the technology in 1978, and it stayed roughly the limit for a long time
   because almost nothing needed more. Chapter 1 is what happens when
   something does. */

export const prologue: Chapter = {
  slug: 'prologue',
  act: 'Prologue',
  paperNo: 'Paper 0 · told three times',
  title: 'One Machine Was Enough',
  dek: 'Three ideas from around 1970 that the next thirty chapters spend without ever stopping to introduce: ask for data by describing it, index it in a tree wide enough to beat the disc, and make a group of changes all happen or none.',
  minutes: 15,
  paper: {
    title: 'A Relational Model of Data for Large Shared Data Banks',
    authors: 'E. F. Codd',
    venue: 'Communications of the ACM 13(6):377–387 · IBM Research, San Jose',
    year: '1970',
    url: 'https://www.seas.upenn.edu/~zives/03f/cis550/codd.pdf',
  },
  caption:
    'A bank, in 1978. A thousand teller terminals, ten million accounts, and a database of more than ten thousand million bytes that has to be on-line every moment of the working day. At the busiest part of the afternoon it runs about **thirty transactions a second**, and a teller who presses the button waits two seconds for the answer. It runs on one machine. Jim Gray, writing it down that year, gives the ceiling for the whole technology as **a hundred gigabytes, ten thousand terminals and a hundred and fifty transactions a second** — and that ceiling held for a very long time, because hardly anything in the world needed more than that. This chapter is the three ideas that made the machine work. **Every one of them gets given away later in this book**, by somebody who ran into a wall, and most of them get bought back afterwards at a price. You cannot watch that happen without seeing them intact first.',
  steps: [
    {
      n: 'Step 01',
      title: 'Fifty milliseconds, and everything else is arithmetic',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'One number runs this chapter. On the disc Bayer and McCreight were measuring in 1970, **the average delay before any data comes back is about 50 milliseconds** — the arm moves, the platter turns round — after which index entries stream past at about 90 microseconds each. Eight years later Gray is still writing 50 milliseconds per seek into his arithmetic, because nothing about the arm had changed.',
        'Put their two figures together and the shape of every design here falls out. **One seek costs about what it costs to transfer five hundred and fifty entries.** That is not a small difference to be optimised later; it is the difference between the two things a machine can do, and a design is good exactly insofar as it converts seeks into transfers. Every idea in this chapter is a way of not going to the disc.',
        'Here is what happens when you ignore it. Gray describes the job that prints monthly statements: for each account, gather the recent history records and put them next to the account record, sorted by mailing address. With fifteen transactions a month against each of ten million accounts, **that job reads a hundred and sixty million records.** Written the obvious way — find an account, find its history, move on — it is one seek per record, about two million seeks a day, and it finishes in **eighty days.** It has to finish in a few hours, before the envelopes go out.',
        '*Notice what that does to the job of writing programs.* The naive version is not slightly slow, it is four hundred times too slow, and the difference between the two versions is not cleverness about banking — it is knowing to sort both files and walk them together instead of chasing pointers. Which raises the question this chapter is really about: **should the person writing the statement program have to know that?**',
      ],
      diagram: <SeekBudgetDiagram />,
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'It is around 1970, you have one machine, one disc, and a queue of people who each want to ask the data something different. Nothing below is a distributed systems problem, and every one of the wrong answers shipped in a real product.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**What you have:** one machine, and a disc that takes ~50 ms to reach and then streams. Main store is measured in tens of kilobytes and does not survive the power going off.',
              '**What you are given:** ten million records that must all be reachable at all times, and a room of people who will write programs against them for the next twenty years.',
              '**What will change without asking you:** the queries. New reports, new indexes, a field nobody wanted last year. The data outlives every program written against it, and it outlives you.',
              '**What must never happen:** money leaving one account and not arriving in the other, whatever the machine does at the moment in between.',
            ],
            questions: [
              {
                q: 'Ten million keys on a disc, and a lookup must be fast. How is the index arranged?',
                options: [
                  {
                    label: 'A balanced tree of pages, each page holding hundreds of keys, kept balanced as things are inserted',
                    verdict: 'move',
                    why: 'The move is choosing the **width** rather than the shape, and choosing it from the hardware. Make a page big enough to be worth a seek — the authors work out that on their disc the best size is around 120 entries, and pick that — and the tree becomes so shallow that depth stops mattering. Their own table is the argument: one page indexes 120 keys, two levels 14,640, three levels 1,771,560, and **four levels reach two hundred and fourteen million.** Any key in a two-hundred-million-key index is four seeks away, and in practice one or two, because the upper levels are touched by every query and stay in memory. The cost of keeping it balanced is paid where nobody is waiting: a page that fills up splits in half and pushes one key upward, which is why the tree grows at the root rather than at the leaves and never goes lopsided. Utilisation is at least half and usually much better — the price of never having to reorganise the file.',
                  },
                  {
                    label: 'Keep the records sorted and binary-search them',
                    verdict: 'dead',
                    why: 'Right idea, wrong unit. Binary search over ten million records is about **twenty-three probes**, and on this hardware a probe is a seek, so a lookup is more than a second. The deeper problem is insertion: keeping an array sorted means moving everything after the insertion point, so one new account rewrites the file. *A structure with no update story is not an index, it is a snapshot* — which is exactly the complaint that will be made about columnar formats forty years later, in Chapter 15.',
                  },
                  {
                    label: 'Hash the key straight to a disc address',
                    verdict: 'dead',
                    why: 'One seek for a lookup, which beats the tree, and it is genuinely the right answer when a lookup is all you ever do. Two things kill it here. **Nothing is in order**, so "every account between these two numbers" and "in ascending order by address" — the statement job, the report, the audit — degrade to reading everything. And the table has a size baked into it: outgrow it and you rehash, which means rewriting the file, while people are using it. Chapter 6 is about the version of this trap that survives into the present, where the hash decides which *machine* your data is on.',
                  },
                  {
                    label: 'Keep the index in memory and rebuild it after a crash',
                    verdict: 'dead',
                    why: 'Tempting, and the arithmetic refuses. Main store on this machine is enough for **about 1,250 index entries** — the authors say so, because they wrote a paging scheme to make use of it — against an index of a hundred thousand. Memory is not a place you keep an index in 1970; it is a place you keep the part of the index you are using, which is what their demand-paging scheme does and what a buffer pool still does today. The instinct is a good one arriving fifty years early: it becomes reasonable in Chapter 18, and Chapter 25 builds a whole system on it.',
                  },
                ],
              },
              {
                q: 'How does an application program say which data it wants?',
                options: [
                  {
                    label: 'It describes what it wants; the system works out how to get it',
                    verdict: 'move',
                    why: 'This is the argument the paper opens with, and it is worth noticing that it is not an argument about mathematics. Codd names three things a program should stop being able to see. **Ordering** — that records come back in the order they happen to sit on the disc, so re-sorting the file breaks programs. **Indexing** — that a program names an index to get the fast path, so dropping the index breaks it. **Access path** — that a program navigates from a known entry point through pointers, so changing the structure breaks it. All three have the same consequence: *the storage layout is frozen the moment the first program is written against it.* Describe instead, and the layout becomes somebody’s private business — which is the thing that makes the index in the previous question replaceable, and makes the sort-and-merge fix for the eighty-day statement job something a system can choose rather than something a person must know.',
                  },
                  {
                    label: 'It navigates: start at a known record and follow pointers to the ones related to it',
                    verdict: 'dead',
                    why: 'The incumbent, and it deserves more respect than it usually gets — it is fast, it is predictable, and a programmer who knows the structure can get exactly what they want with no optimiser standing in the way. The paper attacks it with an example rather than a theorem, which is the right weapon. Parts and projects, with a quantity committed by each project to each part: you can file that as a hierarchy **five different ways**, and every one of them is defensible. Now every program in the building encodes whichever one was chosen, and the choice cannot be revisited. *The cost of this design is not paid by the machine, it is paid by the next twenty years of programmers*, and that is a cost no benchmark reports.',
                  },
                  {
                    label: 'Give each program its own file, laid out for the query it makes',
                    verdict: 'dead',
                    why: 'The pre-database world, and it works until two of the files disagree — which is immediately. Now the same customer has two addresses, and no rule says which is right, because the rule lives in whichever program was written most recently. This is precisely the position Chapter 12 finds Facebook in with a cache, and Chapter 29 finds an enterprise in with four copies of one dataset. **The oldest answer in this book, and the one that keeps coming back wearing a new hat.**',
                  },
                  {
                    label: 'Describe what you want, and let the programmer name the index when they know better',
                    verdict: 'dead',
                    why: 'The compromise everybody reaches for, and the reason to reject it is subtle enough to be worth stating. A hint is optional until it is load-bearing: one query is slow, somebody adds the hint, it ships, and now the index cannot be dropped without breaking that program. Do that a hundred times and you have the previous option back, with a query language on top. **A guarantee with an escape hatch is a guarantee nobody can rely on** — and every system in this book that kept one ended up honouring it forever, which is Chapter 16’s whole complaint about knobs.',
                  },
                ],
              },
              {
                q: 'Money leaves one account and must arrive in another. The machine can stop at any instant. Who guarantees it?',
                options: [
                  {
                    label: 'The system does: record what you intend on a separate log before touching the data, and replay it after a crash',
                    verdict: 'move',
                    why: 'Two ideas, and both are load-bearing. The first is **atomicity as a system service**: the program says begin and commit, and everything between either happens or leaves no trace — which means the person writing the statement program does not need a plan for being interrupted between the debit and the credit, and there is no correct plan they could have written anyway. Gray’s vocabulary for the ways it ends is worth stealing: a transaction can die by *suicide* (bad input, the program gives up), or by *murder* (deadlock, timeout, the machine stops). Once it has committed neither is available and the only remedy is compensation — a second transaction that undoes the first, which the system will not write for you. The second idea is **the ordering**: the log record describing a change must reach the disc before the changed page does. Get that backwards and there is a moment where the data has moved and nothing remembers what it was. And the commit itself is nothing but forcing the log — one sequential write, while the modified pages may sit in memory for minutes, because a disc is only good at one kind of writing.',
                  },
                  {
                    label: 'Each application program handles it, carefully',
                    verdict: 'dead',
                    why: 'It is not a matter of care. There is no sequence of ordinary writes with the property that stopping anywhere in it leaves the accounts consistent — that is what the transaction is *for*. And there is a second, quieter failure: even a program that is perfect on its own is not correct in the presence of other programs running at the same time, so every author would have to reason about every other author’s interleaving. **Chapter 5 is what happens when this is handed to the application in a distributed setting**, and it goes exactly as badly.',
                  },
                  {
                    label: 'Copy the whole database before each change, and swap the copies on success',
                    verdict: 'dead',
                    why: 'Correct, and it prices itself out instantly: this database is ten gigabytes and there are thirty transactions a second. But the instinct is completely sound and it comes back the moment copying is cheap and the unit is small — a version of a *page* rather than of the database. Chapter 3 is that idea as an immutable file, Chapter 12 as a versioned row, Chapter 16 as a set of files in an object store. *What was absurd here at the scale of a database is the default at the scale of a file.*',
                  },
                  {
                    label: 'Order the writes so that a crash always leaves something valid',
                    verdict: 'dead',
                    why: 'People really do this, and for one carefully-chosen data structure it can be made to work. It falls apart on the second one: the ordering that saves a B-tree page is not the ordering that saves the account record, and a transaction touching three of them has no ordering that satisfies all three at once. You also cannot compose it — every new structure needs a new argument, made by hand, and checked by nobody. **A log is the general answer, and its generality is the point:** one mechanism, one invariant, and it does not care what the data is.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived the database — and every one of these gets sold later',
              body: [
                '**A wide, balanced tree on disc.** Pages sized to be worth a seek, so a two-hundred-million-key index is four accesses deep and usually fewer. It grows at the root, so it never needs reorganising, and it does range scans as easily as lookups because the leaves are in order.',
                '**Data described, not navigated.** The layout stops being visible to programs, which is what makes it changeable — a new index, a different sort order, a rewritten storage engine, none of it touching anybody’s code. The value is in what it lets a *later* person do.',
                '**Transactions, guaranteed by a log.** Begin and commit; the system takes care of what happens in between. Write the intention down before the data, commit by forcing one sequential file, and rebuild the world from that file after a crash.',
                '*And here is the thing to carry out of this page.* Put those three together and you have a machine that answers questions nobody anticipated, over data laid out however is convenient this year, without any application author ever thinking about a crash. **The next thirty chapters are what happens when each of those is taken away** — and what it costs to get it back.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'One transaction, in the order it has to happen',
      accent: 'denim',
      rung: 'Rung 3 · The answer',
      span: 2,
      body: [
        'Watch the ordering rather than the mechanism, because the ordering is the correctness argument and it is the part every later chapter inherits. The log record reaches the disc before the page it describes. The commit is the log write, not the data write. And after the power comes back, the file somebody appended to is the only thing that knows what happened.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={prologueTrace} />
        </div>
      ),
      deeper: {
        summary: 'Why the wide tree is the whole design',
        body: [
          'The B-tree paper is easy to under-read as a data structure result. It is really a hardware argument, and the authors make it explicitly: the page size is not a matter of taste, it is computed from two properties of the disc you happen to own. They give the formula, evaluate it for the machine on the bench, and conclude that the right page holds somewhere between 128 and 256 entries — then use 120, for programming convenience, and say so.',
          'From there the table below does the arguing. **Four levels of a 120-entry tree address two hundred and fourteen million keys.** The index in their experiments is a hundred thousand keys, which is three levels, which is three disc accesses — and their measured throughput at that size is at least four operations a second, with fifteen thousand keys managing nine. Those numbers are not impressive and were never meant to be; they are the honest cost of a disc that takes fifty milliseconds to answer.',
          'The property that made it last is the one that sounds least interesting. **A B-tree never needs reorganising.** Keys arrive in whatever order they arrive, pages split when full and push a key up, and the tree stays balanced with storage at least half used — usually much more. Every earlier index scheme degraded as it aged and had to be rebuilt periodically, which for a file that must be on-line at all times is not a maintenance task, it is an outage. *That is why this structure is still underneath almost every database you can buy*, and why Chapter 1 giving it up is such a violent thing to do.',
        ],
        figure: <BTreeReachDiagram />,
      },
    },
    {
      n: 'Step 04',
      title: 'The argument that took a decade to win',
      rung: 'Rung 4 · The fight',
      body: [
        'The relational paper is the one people cite and the one people misremember. It is remembered as being about mathematics — relations, tuples, normal form — and the mathematics is there. But read the first two pages and the case is almost entirely **about people**, and specifically about people who are not in the room yet.',
        'Codd names three ways a program can become welded to the storage. It can depend on the **order** records come back in, which they will if the file is stored sorted and the program was written by somebody who noticed. It can depend on an **index** by name, so that dropping an index nobody uses breaks a program somebody does. And it can depend on the **access path** — the tree or network it navigates — so that restructuring is impossible. His example is the good part, because it is a shrug rather than a proof: parts, projects, and how much of each part each project has taken. **You can file that as a hierarchy five different ways**, all reasonable, and whichever you choose, every program in the building now knows it by heart.',
        'The opposition was not stupid and was not defeated by argument. Navigational databases were fast, in production, and defended by people who could point at working systems; the counter-argument — made in a Turing lecture, no less — was that a programmer who understands the structure will always beat a system guessing on their behalf. **That was true at the time.** What changed it was not a better proof but the arrival of optimisers good enough that the guess was usually fine, and the accumulating weight of the thing Codd predicted: the programs outlive the assumptions, and a shop with fifteen years of navigational code cannot change its mind about anything.',
        '*The reason this belongs at the front of this book rather than in a history of databases* is that the same argument recurs in every act, with the sides redrawn. Chapter 3 hands the layout back to the programmer and calls it a feature. Chapter 6 makes the partition key a decision you cannot revisit. Chapter 16 removes the knobs and takes responsibility for the guess. And Season 2’s third act ends with a system that takes SQL — a description of what you want — and compiles it into a running graph, which is Codd’s argument arriving somewhere he did not send it.',
      ],
      diagram: <FiveStructuresDiagram />,
      callout: {
        kind: 'good',
        big: 'FIVE FILING CABINETS, ALL CORRECT',
        text: 'The relational case is not that hierarchies are wrong. It is that choosing one commits everybody who comes after you, and nobody should have that much power over people they will never meet.',
      },
    },
    {
      n: 'Step 05',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 5 · What it costs',
      body: [
        '**Somebody has to guess, and the guess can be wrong.** Once programs describe what they want, a component has to decide how to get it — and when it decides badly the person who wrote the query has no way to say so, which was the navigational camp’s objection and remains the reason database work has a reputation for occult debugging. Chapter 16 is a whole chapter about a company deciding to own that guess entirely, and what it costs them when it goes wrong.',
        '**Locks mean waiting, and waiting means deadlock.** Holding your locks until commit is what buys the illusion that nothing else is running, and the price is transactions queueing behind each other and occasionally forming a cycle that has to be broken by killing one of them — Gray’s *murder*, chosen by the system, on grounds of whose work is cheapest to throw away. Every degree of concurrency you win back after this is won by weakening the rule, and Chapter 12 is somebody doing that very carefully.',
        '**Everything is written twice.** The log gets the record and the data file gets the page, and on a busy system the log is the busiest device in the building — which is why it gets a spindle of its own. This is a genuinely good trade, since one sequential write beats several scattered ones, and it is still a doubling.',
        '**And the whole thing assumes one machine.** One clock, so the order of events is not in doubt. One memory, so the lock table is simply a table. One disc, so the log is simply a file. *Not one of those three assumptions survives Chapter 1*, and the entire remainder of this book is the cost of losing them.',
      ],
      callout: {
        kind: 'bad',
        big: '150 TPS AND A HUNDRED GIGABYTES',
        text: 'Gray’s ceiling for the whole technology in 1978. It held for a long time because almost nothing needed more — and then something did.',
      },
    },
    {
      n: 'Step 06',
      title: 'What the rest of the book does with these three',
      rung: 'Rung 6 · The loans',
      body: [
        '**Ask by describing** is the first thing to go. Chapter 3 builds a store with no joins and no query language, where the key is the entire interface and the layout is your problem — and it does that on purpose, because the alternative did not fit. It comes back in pieces: Act VI puts SQL over columns, and Season 2 ends with systems that take a whole SQL query and compile it into a graph that maintains its own answer. *Twenty-five years to get back to describing, and the thing you get back is better than what you gave up.*',
        '**The index you update in place** goes next, and it goes because of a file system. Chapter 1’s GFS will let you append to a file and will not let you edit one, so the tree of pages you overwrite becomes a sorted file you merge — and the interlude after Chapter 3 gives that trade its proper name. Reads get more expensive, writes get much cheaper, and an entire generation of storage engines is built on the swap.',
        '**All-or-nothing across rows** is sold in Act I too, and it is the one bought back most expensively. Chapter 10 rebuilds it in a client library on a store that offers nothing, and pays in latency so large the system is only usable for a crawler. Chapter 11 buys it with atomic clocks and a deliberate wait on every commit. **Two chapters, one guarantee, two currencies** — and both of them are re-implementing what a single machine gave away for free in 1970.',
        '*The pattern to take forward is not that the old system was better.* It is that none of these ideas was ever refuted. Each was given up under a specific pressure, by people who said so at the time, and the interest was paid later by somebody else. **When a chapter in this book tells you a system does not support something, the useful question is which of these three it has borrowed against.**',
      ],
      diagram: <ThreeLoansDiagram />,
    },
    {
      n: 'Step 07',
      title: 'And then something needed more',
      rung: 'Rung 7 · The wall',
      body: [
        'For about thirty years the answer to almost any data question was a machine like the one on this page, and it was a good answer — not a compromise anybody was waiting to escape. The ceiling was real and almost nobody was near it. Buying a bigger machine was a purchase order rather than a research programme.',
        'Then a company set out to keep a copy of **the entire web** and to re-read it constantly, on hardware chosen for being cheap rather than for being reliable, in numbers where something is always broken. Every assumption on this page fails at once. The data does not fit on one disc, so there is no one file. The machines die weekly, so there is no one memory to hold a lock table. There is no single clock, so the order of events becomes a question rather than a fact. And the workload is a scan of everything rather than a lookup of one thing, which is the case the B-tree is worst at.',
        '*So the next chapter opens with people giving up the first of the three*, and doing it with a directness that still reads as shocking: a file system that will let you create a file, append to it, read it and delete it, and **will not let you change a byte you have already written.** Everything in Act I is downstream of that refusal. Read it knowing what it cost, because the paper does not tell you — it is only describing what it built.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Data independence.',
      body: 'A program’s freedom from how the data is actually stored — its order, its indexes, its structure. Codd’s subject, and the property every later chapter trades away first.',
    },
    {
      term: 'Fanout.',
      body: 'How many keys fit in one index page. High fanout makes the tree shallow, which is the only thing that matters when reaching any page costs 50 ms and reading 500 more entries costs the same again.',
    },
    {
      term: 'Write-ahead log.',
      body: 'The rule that the record describing a change reaches durable storage before the change itself does. Break it and there is an instant where the data has moved and nothing remembers the old value.',
    },
    {
      term: 'Compensation.',
      body: 'Undoing a committed transaction by running another one that corrects it. The system will not do this for you, because only the application knows what "corrects" means.',
    },
  ],
  inTheWild: {
    note: '4 things from 1970 that decide arguments today',
    points: [
      '**Ask what one random access costs, and count them.** The number has moved — 50 ms became 100 µs on an SSD — but the reasoning has not, and neither has the habit of designing around it. Every layout decision in this book is somebody counting seeks in the units of their decade.',
      '**"Who is allowed to change this later" is a design question.** The relational argument is entirely about that, and it is the question people skip. If your storage layout is visible to callers, you have chosen it once, for everybody, forever.',
      '**Write the intention before the change.** Not only in databases: it is why a deployment writes a plan before touching anything, why a migration is a file rather than a session, and why the recovery path is the one you should test first, since it runs when everything else has already failed.',
      '**Concurrency correctness is not carefulness.** A program that is right on its own can be wrong beside another copy of itself, and no amount of review finds it. That is a system-level property or it is absent.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Size the unit of I/O from the device, not from the data',
        when: 'designing any on-disc structure. The B-tree’s page is computed from seek time and transfer rate, and everything good about it follows from that one calculation.',
      },
      {
        choose: 'Describe over navigate, unless you own every caller',
        when: 'the data will outlive the programs. It usually does. The exception is real — if there is one caller and it is you, a pointer chase is faster and simpler.',
      },
      {
        choose: 'One general mechanism over one argument per structure',
        when: 'you are making crashes safe. Careful write ordering works for one data structure and does not compose across three; a log does not care what the data is.',
      },
      {
        choose: 'Ask which of the three you are borrowing against',
        when: 'a system tells you it does not support something. Descriptive queries, in-place indexes and multi-record atomicity are the three, and one of them is almost always the answer.',
      },
    ],
  },
  misconception: {
    think: '“The relational model won because it was mathematically rigorous.”',
    actually:
      'It won slowly, against opposition that was correct about performance, and the rigour was not the argument. Read the first two pages of the paper and the case is about **people who are not in the room**: programs that break when a file is re-sorted, programs that break when an unused index is dropped, programs that break when a hierarchy is restructured. Codd’s own illustration is not a theorem — it is parts and projects, filed five different ways, every one defensible, and the observation that choosing one commits everybody who comes afterwards. The navigational camp’s reply was that a programmer who understands the structure will beat a system guessing on their behalf, and *at the time that was simply true*; what changed was optimisers getting good enough that the guess was usually fine, plus fifteen years of accumulated code proving Codd right about what freezes. The rigour mattered for a different reason: it gave the optimiser a set of equivalences it could safely rearrange a query with, which is what made the guessing viable. **So the order is the opposite of the myth.** The argument was won on maintenance, and the mathematics is what let somebody eventually build the thing that made winning it affordable.',
  },
  sources: [
    {
      year: '1970',
      title: 'A Relational Model of Data for Large Shared Data Banks — E. F. Codd (CACM 13(6))',
      url: 'https://www.seas.upenn.edu/~zives/03f/cis550/codd.pdf',
      note: 'Eleven pages, and the first two are the ones to read. **§1.2 is the whole argument** — ordering dependence, indexing dependence, access path dependence — and §1.2.3’s parts-and-projects example, with its five equally good hierarchies, is more persuasive than anything in the formal sections. The relational algebra in §2 is fine and is not why the paper mattered.',
    },
    {
      year: '1970',
      title: 'Organization and Maintenance of Large Ordered Indices — Bayer & McCreight (Boeing Scientific Research Laboratories, report no. 20)',
      url: 'https://infolab.usc.edu/csci585/Spring2010/den_ar/indexing.pdf',
      note: 'The original report, before the 1972 journal version, and worth having in this form because the hardware is right there in it: a 2311 disc, 50 ms to reach a page, 90 µs per entry after that. **Read §10 and Figure 9** — the page size is derived from the device rather than chosen, and the table showing that four levels reach 214 million keys is the entire case for the structure in one small block of numbers.',
    },
    {
      year: '1978',
      title: 'Notes on Data Base Operating Systems — Jim Gray (Operating Systems: An Advanced Course, LNCS 60)',
      url: 'https://jimgray.azurewebsites.net/papers/dbos.pdf',
      note: 'Eighty-nine pages of somebody explaining a working system to people who have not built one, and the best single document about what a database actually does. **§1.1 for the bank** — a thousand tellers, ten million accounts, thirty transactions a second — and **§5.7 and §5.8 for locking and recovery**, which is where the vocabulary you use every day was written down. The historical note in §5.8.3.2 is a small delight: write-ahead logging only became necessary once core memory was replaced, because core survived a power cut.',
    },
    {
      year: '1981',
      title: 'The Transaction Concept: Virtues and Limitations — Jim Gray (VLDB; Tandem TR 81.3)',
      url: 'https://jimgray.azurewebsites.net/papers/thetransactionconcept.pdf',
      note: 'The short version, three years later, and the one to read if eighty-nine pages is too many. It is also the more honest of the two about what transactions cannot do — the *limitations* in the title are the long-running case and the distributed case, and both of those are Act IV of this book.',
    },
    {
      year: '1973',
      title: 'The Programmer as Navigator — Charles W. Bachman (Turing Award lecture, CACM 16(11))',
      url: 'https://doi.org/10.1145/355611.362534',
      note: 'The other side, argued by somebody who had shipped the systems and won the Turing Award for them, three years after Codd’s paper and long before the argument was settled. **Read it to find out how good the losing case was** — the programmer who knows the structure really can beat the optimiser, and that objection never stopped being true, it stopped being decisive. The ACM’s own copy is behind a login; the lecture is short and widely reprinted, so it is easy to find one that is not.',
    },
  ],
  seenIn: [
    { label: 'The File System That Refused to Edit — Ch 1', to: '/papers/gfs', live: true },
    { label: 'Interlude: The RUM Triangle', to: '/papers/rum', live: true },
    { label: 'Transactions, Hand-Rolled — Ch 10', to: '/papers/percolator', live: true },
    { label: 'The Read Path as a Graph — Ch 25', to: '/papers/noria', live: true },
  ],
  finale: {
    title: 'The debts this book spends thirty chapters paying',
    body: 'A bank in 1978 runs ten million accounts and thirty transactions a second on one machine, and the ceiling for the entire technology that year is a hundred and fifty. Underneath it are three ideas from around 1970 and one physical fact. The fact is that reaching the disc costs fifty milliseconds while reading five hundred more entries costs the same again, so every design is a scheme for turning seeks into transfers. The B-tree does it by being wide rather than tall — 120 entries to a page, four levels reaching two hundred and fourteen million keys, growing at the root so it never needs reorganising. The relational model does it by refusing to let programs see the layout at all, which is an argument about maintenance rather than mathematics: parts and projects can be filed as a hierarchy five defensible ways, and whichever you pick, everybody who comes after you is stuck with it. And the transaction does it by making atomicity the system’s job — write the intention to a log before the data, commit by forcing that one file, rebuild everything afterwards from what was appended. The bill is an optimiser that can guess wrong, locks that make transactions wait and occasionally kill each other, every write happening twice, and three assumptions — one clock, one memory, one disc — that do not survive the next chapter. Nothing here is refuted later. It is lent out, under pressure, by people who said what they were giving up, and the interest is paid by somebody else about a decade further on.',
  },
  next: { title: 'The File System That Refused to Edit', slug: 'gfs' },
}
