import type { Chapter } from '../types'
import DesignIt from '../DesignIt'
import { SevenIdealsDiagram, CloudPeerDiagram } from '../diagrams'

/* A half-chapter, the same shape as Chapter 2: five steps, a DesignIt, no
   trace. That is the right size for two reasons. It is not a systems paper —
   it is a position paper with a scorecard and three prototypes, and there is
   no mechanism to walk through. And its contribution is a reframing, which is
   a thing you either accept in ten minutes or you do not.

   The risk to avoid is writing an advocacy chapter. The paper is unusually
   candid — its own findings section says the change history grows and cannot
   be truncated, that networking is unsolved, and that it would be unwise to
   put this in production today — so the chapter's honesty is available from
   the source and does not need manufacturing. The step 4 findings are almost
   all negative, which is the point: this is what happened when somebody
   actually built on the previous chapter for three years.

   The one claim worth landing hardest is the scope limitation in footnote 3,
   which almost nobody quotes: the authors explicitly exclude banking,
   e-commerce, social networking and ride-sharing. A reader who takes this as
   a general thesis about software will misread it, and the paper told them
   not to. */

export const localFirst: Chapter = {
  slug: 'local-first',
  act: 'Act IV · Everybody’s Copy Is Live',
  paperNo: 'Paper 28',
  title: 'The Network Is Optional',
  dek: 'The previous chapter made agreement a property of the data. This one asks what software you could build on that — and reports, after three years of building it, which of the hard problems turned out not to be distributed-systems problems at all.',
  minutes: 10,
  paper: {
    title: 'Local-First Software: You Own Your Data, in spite of the Cloud',
    authors: 'Martin Kleppmann, Adam Wiggins, Peter van Hardenberg, Mark McGranaghan',
    venue: 'Onward! (Cambridge · Ink & Switch)',
    year: '2019',
    url: 'https://www.inkandswitch.com/local-first/static/local-first.pdf',
  },
  caption:
    'Every chapter of this book has been about somebody else’s machines. Where the bytes sit, how many copies exist, who is allowed to decide what happened — and always, underneath, a datacentre. This one starts from a different place: **you wrote a document, and it is on your laptop.** Not cached on your laptop, subordinate to a copy on a server that is the real one; it *is* the document. That used to be ordinary, and then collaboration arrived and turned out to require the opposite arrangement, and now a text editor shows you a spinner and refuses to work in a tunnel. This is a position paper rather than a systems paper — a set of ideals, a scorecard, and three prototypes built over three years to find out what breaks. **It is the only paper in this book whose subject is what software should be for**, and it earns its place because the previous chapter made its premise technically possible for the first time.',
  steps: [
    {
      n: 'Step 01',
      title: 'You can have collaboration or you can have your work',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'Score the software you use against seven things you would want: that it is **fast**, that it works **across your devices**, that it works **offline**, that it supports **collaboration**, that it will still **open in ten years**, that it is **private**, and that you retain **control** of what you made.',
        'Files score well on six and fail the fourth completely — two people editing one file produces a manual merge, or a filename like *budget draft 2 (Jane’s version) final final 3*. Web apps invert it exactly: collaboration is superb and everything else is somebody else’s. Sync services sit in between, and their mobile apps quietly drop back to being thin clients that need a network. **Nothing gets full marks**, and the pattern is not accidental: the row that collaborates well is the row where the authoritative copy is on a server, and that is the same fact as every other column failing.',
        'The mechanism is worth stating precisely, because it explains why offline support is always retrofitted and always fragile. In a cloud app the server holds the primary copy and your device holds a cache. **An edit that has not reached the server did not happen.** So a network hiccup is not a degraded mode, it is the absence of the thing that makes edits real — which is why bolting offline support onto a web app is so consistently unsatisfying, and why a text editor can lock you out mid-sentence.',
        'And there is a longer-range version of the same problem. The software is a service, so when the service ends, your work becomes an export at best. *You are betting that a company continues to exist for at least as long as you care about the thing you made*, which for a thesis, a novel or a decade of notes is a strange bet to have made without noticing.',
      ],
      diagram: <SevenIdealsDiagram />,
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'Neither of these is an algorithm, which is the honest shape of this paper. Both ask what a piece of software is arranged around.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**What you will not give up:** real-time collaboration as good as the best cloud app. Anything that reintroduces "who has the file open" has lost the argument before it starts.',
              '**What you also will not give up:** the work is yours. It opens without a login, it survives the vendor, and nobody can lock you out of it.',
              '**What you now have:** data types that converge with no coordination, from the previous chapter. That is new, and it is why this is worth asking in 2019 and was not in 2009.',
              '**What is genuinely hard:** two people who are never awake at the same time still need to end up with each other’s edits.',
              '**Scope, stated by the authors:** documents and personal data — text, drawings, notes, plans. Explicitly *not* banking, e-commerce, social networks or ride-sharing, which centralised systems serve well.',
            ],
            questions: [
              {
                q: 'Cloud apps make the server copy authoritative and your device a cache. What do you change?',
                options: [
                  {
                    label: 'Swap the roles — the copy on your device is the primary one, and servers hold secondary copies',
                    verdict: 'move',
                    why: 'One sentence, and everything else in the paper is a consequence of it. An edit is **real the moment it is made**, because the authoritative copy is the one your keystroke landed in — so there is no state in which you have typed something that has not happened yet, and therefore no spinner, no optimistic-UI rollback and no lock-out in a tunnel. Note what this is *not*: it is not "no servers". Servers stay, and they are useful for exactly the things distribution is bad at — backup, discovery, forwarding to a device that was asleep, and bursts of compute. **What changes is that they are no longer on the critical path**, so their absence degrades convenience rather than function. The paper’s name for this is a *cloud peer*: a participant that happens to always be awake, rather than the participant that decides what is true.',
                  },
                  {
                    label: 'Keep the server authoritative and add aggressive offline caching with a sync queue',
                    verdict: 'dead',
                    why: 'This is what everybody actually does, and the paper’s survey is a catalogue of it not working. The trouble is not effort — service workers, app manifests, background sync and years of the offline-first movement have all been aimed here. It is that the architecture is centred on synchronous interaction with a server, so offline remains a special case bolted onto the side, and special cases are where the bugs live. **A queue of pending writes is a queue of edits that have not happened yet**, which is the exact condition you were trying to eliminate, now with more machinery around it.',
                  },
                  {
                    label: 'Have no servers at all — pure peer-to-peer, the network belongs to the users',
                    verdict: 'dead',
                    why: 'Ideologically clean and it fails on a mundane fact the paper hit repeatedly in its own prototypes: **two people are often not awake at the same time.** You share a document and close your laptop before the other person connects, and the document goes nowhere. There is no algorithm for this; somebody has to be online, and the pragmatic answer is a server that always is. The overreach also costs you the thing servers are genuinely good at — off-site backup, which for a device that can be lost or stolen is not optional.',
                  },
                  {
                    label: 'Make the client a full replica of the server database and sync bidirectionally',
                    verdict: 'dead',
                    why: 'This exists, it is the closest near-miss in the survey, and the specific way it falls short is the useful part. Multi-master replication does let several machines hold full copies and exchange changes — and when two of them change the same thing, it surfaces a **conflict for application code to resolve**. That is Chapter 5’s question again, in a database, and the paper judges it the reason the model never caught on for this purpose: writing that resolution correctly is hard enough that it makes fine-grained collaboration impractical. *The replication was never the missing piece.* The missing piece was a merge nobody has to write, which is the previous chapter.',
                  },
                ],
              },
              {
                q: 'Two people edit the same document while both are offline. What reconciles them?',
                options: [
                  {
                    label: 'Data types that converge by construction, swapped in for the ordinary ones the app already uses',
                    verdict: 'move',
                    why: 'The previous chapter, used as a foundation rather than studied. The framing that makes it practical is that these are **general-purpose data structures** — a map, a list, a piece of text — that happen to be multi-user underneath. So a developer building a text editor keeps an array of characters and a spreadsheet keeps a matrix of cells, exactly as in a single-user application; the type is exchanged and the merging comes with it. That matters more than it sounds: it means collaboration stops being an architecture and becomes a library, and an application developer who is not a distributed systems expert can have it without becoming one. The changes tracked can be as small as a keystroke, giving real-time collaboration, or batched into a proposal to review later, giving something closer to a pull request.',
                  },
                  {
                    label: 'Operational transformation, the technique real collaborative editors already use',
                    verdict: 'dead',
                    why: 'It works and it is the incumbent — and its assumptions are the problem here rather than its correctness. It was designed for clients transforming against a central server’s ordering, and the previous chapter noted the awkward history that most published *decentralised* versions were later shown to be incorrect. In a setting with no central authority and devices that may be weeks apart, you would be adopting the variant of the technique with the worst track record, to avoid a variant that no longer needs it.',
                  },
                  {
                    label: 'Show the user both versions and let them merge, like a version control system does',
                    verdict: 'dead',
                    why: 'This is the honest baseline and it is what today’s file sync does — the conflicted copy, the "conflicting changes" notebook, the merge tool. Two problems. It works on line-oriented text and degrades to uselessness on a spreadsheet, a drawing or a canvas, where there is no meaningful diff to show. And it fails on frequency: this has to work when the unit of change is a keystroke, and no interface asks a person to resolve keystrokes. **Manual merging scales with how rarely people collaborate**, which is the opposite of the goal.',
                  },
                  {
                    label: 'Timestamp every change and let the most recent one win',
                    verdict: 'dead',
                    why: 'Convergent, simple, and it discards one of the two people’s work with nothing recording that they were there. For a document being written by two people in a tunnel, that is precisely the population of edits you most needed to keep. The previous chapter’s point applies exactly: it is a legitimate data type for a value that genuinely is one thing, and silent data loss for anything anybody composed.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived local-first software — and the servers stayed',
              body: [
                '**The inversion.** The copy on your device is primary; servers hold secondary copies. From that one swap: no waiting on a round trip, so no spinners; work that survives the vendor, because the bytes and the software are both on your machine; privacy by default, because the central database holding everybody’s data has stopped existing; and offline as the ordinary case rather than a degraded one. **The seven ideals are not seven features, they are one architectural decision seen from seven angles.**',
                '**Convergent data types as the enabling piece.** They are what makes the inversion survive collaboration. The paper is careful about the claim — these have the *potential* to be foundational, compared to packet switching for the internet or capacitive touchscreens for the smartphone — and equally careful that the libraries are not there yet.',
                '**Servers as cloud peers.** Not the source of truth, but participants that are always awake: they store a copy and forward it to a device that reconnects, back up phones with little storage, bridge to ordinary APIs, and rent out compute for something heavy. *The difference between this and a cloud app is not fewer servers. It is what a server is for.*',
                '**And the scope, which is stated and is usually dropped when people quote this.** The subject is software for making documents and holding personal data — text, graphics, spreadsheets, notes, plans. The authors explicitly exclude banking, e-commerce, social networking and ride-sharing, which centralised systems serve well. Which is the previous chapter’s boundary showing through: **those are the applications built on invariants that span many users’ data**, and no data type gets you those.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'Three years of building it, and what actually broke',
      accent: 'denim',
      rung: 'Rung 3 · What they found',
      body: [
        'The reason this paper is worth an evening is that the group built the thing before writing about it. Three applications — a Kanban board, a collaborative drawing tool, a mixed-media canvas — used internally by a team of five and tested with about ten outside users. The evaluation is exploratory and says so; what makes it valuable is that the findings are mostly complaints, and they are complaints about the parts nobody predicted.',
        '**The technology worked, and conflicts were not the problem.** This is the surprise and it is worth sitting with, because "but what about conflicts" is the first question everybody asks. Two reasons are offered. The library tracks changes finely and understands its own data types, so two people inserting at the same position get both insertions in a deterministic order rather than a merge conflict. And **people avoid conflicting**: collaborators agree who is working on which section, because they are humans coordinating, not processes racing. In every prototype the default merge behaviour was sufficient and no case was found that needed custom semantics.',
        '**What did break was the history.** These types keep their entire change log — every keystroke — and on documents in real use, memory and disk became a problem quickly. The reason it cannot simply be truncated is the exact price of the previous chapter’s guarantee: **somebody might reconnect after six months away and need to merge from that point.** The property that lets a replica vanish for a year and come back correct is the property that stops you throwing anything away.',
        '**And the networking was not solved.** The convergent types say how to merge and nothing about how edits reach another machine. The team tried a browser peer protocol, copying files on USB keys, a distributed filesystem, and finally a peer-to-peer stack — and reports that these are nowhere near production-ready, with NAT traversal in particular failing depending on whose router you are behind. *Live collaboration between two laptops with no internet felt like magic*, and it worked unreliably.',
      ],
      diagram: <CloudPeerDiagram />,
      deeper: {
        summary: 'The problems that turned out not to be technical',
        body: [
          'The most interesting findings are the ones where the distributed systems worked and the humans could not make sense of what they were looking at. Worth reading because they are the shape of the next decade of work in this area, and none of them is an algorithm.',
          '**Nobody is online or offline any more.** A centralised system is up or down, and the server decides what is true. Here every participant has a different partial view of what exists — one person’s edits are on a laptop on an aeroplane, and they will arrive later, and other people may accept all, some or none of them. The paper calls this a *kaleidoscopic* complexity, and notes that it is difficult even for the people building it to reason about where data currently is.',
          '**Version history became a user-interface problem.** With no central arbiter, a document develops a genuinely branching history just through ordinary daily use, and users need to understand how it came to look the way it does. The prototypes tried time travel through earlier states, and highlighting what recently changed. The observation offered is that the two mainstream models for this — diffs and patches, or suggestions and comments — are both designed for text, and nobody knows what the equivalent is for a drawing.',
          '**And "stop sharing" stopped meaning anything.** Access control assumes a gatekeeper. Here, anyone holding a copy of the data can modify their copy and cannot be prevented; what others can choose is whether to accept those changes. *If you cannot remove a document from somebody else’s computer, what is the button called?* The paper puts this to interface researchers as an open question rather than proposing an answer, which is the right call and also an admission that a whole category of expected behaviour has no design yet.',
          '**The general lesson is about where difficulty moves.** Solve a distributed systems problem thoroughly enough and what remains is not a smaller distributed systems problem — it is a set of questions about what people expect, which nobody on the team was trained to answer.',
        ],
      },
    },
    {
      n: 'Step 04',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 4 · What it costs',
      body: [
        '**It was not ready, and the authors say so.** In as many words: it would not be advisable to replace a proven product with an experimental library in production. That sentence appears in a paper advocating the approach, which is the reason to trust the rest of it — and it is the correct reading of the whole thing. **This is a direction with three prototypes behind it, not a stack you adopt on Monday.**',
        '**History grows without bound.** Every keystroke, kept, because a collaborator might return after six months. This is the previous chapter’s metadata bill arriving in a product, and it is named as a major area of ongoing work rather than something handled.',
        '**Ownership comes with the jobs ownership always had.** Backups, protection against ransomware, keeping your own archive in order. The paper is straightforward that this is a trade — more responsibility for more control — and reasonable for a thesis or a film’s raw footage. *It is also exactly the work that cloud apps quietly absorbed*, and the reason many people chose them.',
        '**And discovery still needs somebody awake.** Two people who are never online together cannot exchange anything, so the always-on participant comes back — as a peer rather than an authority, but it is a server, somebody runs it, and it costs money. The architecture removed the server from the critical path; it did not remove it from the budget.',
      ],
      callout: {
        kind: 'bad',
        big: 'A DIRECTION, HONESTLY LABELLED',
        text: 'Seven ideals, a scorecard on which nothing gets full marks, three prototypes, and a findings section that is mostly problems — including the authors’ own advice not to ship it yet. The value is the reframing and the list of what breaks, not a stack.',
      },
    },
    {
      n: 'Step 05',
      title: 'Where it stands in 2026 — and what Act IV settled',
      rung: 'Rung 5 · Descendants',
      body: [
        '**The gap the paper named got filled.** It ends by describing a market opportunity in three words — a hosted service for convergent data types, with a good developer experience and a local persistence library — and a category of sync services and local-first databases grew into roughly that shape. The libraries got dramatically faster; the change-history problem that stopped the prototypes is much less of a wall than it was. **The term itself did the most work**: "local-first" gave a name to a thing people wanted and could not previously ask for, which is a real contribution and an odd one to measure.',
        '**And the scope limitation held, which is the part to remember.** The authors excluded banking, commerce and social networks on purpose, and that exclusion has not moved, because it was never about maturity. Those applications are built on invariants that span many users’ data — a seat sold once, a balance that stays positive — and Chapter 27 is exactly the result that says such invariants need coordination. *Local-first is not a general theory of software. It is the right architecture for the things you make*, and the boundary is drawn by the previous chapter’s theorem.',
        '**What this act settled.** Three acts of Season 2 assumed the machines could reach each other, and every design in them put the authority somewhere — a coordinator, a maintained view, a graph of operators on somebody’s servers. This act removed that assumption. Chapter 5 asked who writes the merge function and handed the question to the application; Chapter 27 answered it by making convergence a property of the data type, so that a replica alone in a tunnel is correct rather than degraded, and agreement is reached without ever agreeing. Chapter 28 took that seriously enough to build on and found the remaining problems are about what people expect, not about what machines can do.',
        '*And here is where the season leaves you.* Look back at what has been assembled. A log that is the record. Derived copies that fall behind. Answers maintained as changes arrive. Views that fill on demand. Types that merge without asking. **Every one of those is a component of a database, and you have been wiring them together by hand for four acts.** The epilogue is two people noticing that, and disagreeing sharply about whether the right response is to put the lid back on.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Local-first.',
      body: 'The copy on your device is the primary one; servers hold secondary copies. Every other property in the paper follows from that single swap.',
    },
    {
      term: 'Cloud peer.',
      body: 'A server in a supporting role — backup, discovery, forwarding to a device that was asleep, burst compute — rather than the source of truth. Off the critical path, not out of the budget.',
    },
    {
      term: 'The long now.',
      body: 'Your work still opens after the company is gone, because the bytes and the software are both on your machine. The ideal that most sharply separates a file from a service.',
    },
    {
      term: 'Optimistic UI.',
      body: 'Showing an operation as complete before the server has confirmed it. Hides latency and still exposes it when the request fails — which is the honest description of most offline support.',
    },
  ],
  inTheWild: {
    note: '4 things this reframes even if you never build one',
    points: [
      '**Ask where the primary copy is.** It is one question and it predicts almost everything else about a product — whether it works on a plane, whether it survives the vendor, whether your data is in a database with a million strangers’, and whether you will see a spinner.',
      '**Conflicts are less common than everyone budgets for.** The prototypes found that fine-grained merging plus ordinary human coordination handled nearly everything, and that no case needed custom resolution semantics. The engineering effort people reserve for conflict resolution is mostly spent in the wrong place.',
      '**"Works offline" is an architectural property, not a feature.** If the server holds the primary copy, offline support is a queue of edits that have not happened yet, and it will be fragile no matter how much work goes into it.',
      '**The seven ideals are a usable scorecard.** Run your own product through them. The interesting result is not the total, it is discovering which ones you failed without ever having decided to.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Decide which copy is primary, explicitly',
        when: 'starting anything that stores what users make. It is the cheapest decision to make at the beginning and among the most expensive to revisit, because every offline, privacy and longevity property is downstream of it.',
      },
      {
        choose: 'A supporting server over no server',
        when: 'you are tempted by pure peer-to-peer. Two people are often not awake at the same time, and no algorithm fixes that. Keep the always-on participant and take it off the critical path.',
      },
      {
        choose: 'Publish the boundary of your idea with the idea',
        when: 'proposing an approach. This paper names banking, commerce and social networks as out of scope in a footnote, and that footnote is what stops it being overclaimed — by other people, and by its own authors.',
      },
      {
        choose: 'Build it before you write about it',
        when: 'the claim is that something is possible. Three prototypes and ten outside users produced findings nobody predicted, and almost all of the useful ones are about people rather than machines.',
      },
    ],
  },
  misconception: {
    think: '“Local-first means peer-to-peer — getting rid of servers.”',
    actually:
      'Servers stay, and the paper is direct about needing them. What changes is their **job**. In a cloud app the server holds the authoritative copy and your device holds a cache, so an edit that has not reached the server did not happen — which is why a network hiccup can lock you out mid-sentence, and why offline support bolted onto that architecture is always a queue of edits that have not happened yet. Local-first swaps the roles: the copy on your device is primary, and servers hold secondary copies. From there they are genuinely useful for the things distribution is bad at — storing a copy and forwarding it to a device that reconnects later, backing up a phone, bridging to ordinary APIs, renting out compute for something heavy. The paper calls these **cloud peers**: participants that happen to always be awake, rather than the participant that decides what is true. And the pure peer-to-peer version was tried and found wanting on a completely mundane fact — *two people are frequently not awake at the same time*, so you share a document, close your laptop, and it goes nowhere. **The difference is not fewer servers. It is that their absence should degrade convenience rather than function.**',
  },
  sources: [
    {
      year: '2019',
      title: 'Local-First Software: You Own Your Data, in spite of the Cloud — Kleppmann, Wiggins, van Hardenberg, McGranaghan (Onward!)',
      url: 'https://www.inkandswitch.com/local-first/static/local-first.pdf',
      note: 'Twenty-five pages and an easy evening — it is written for people rather than for a programme committee. **§4.2.4, the findings, is the part to read even if you skip everything else**: three years of building, reported mostly as problems. And read footnote 3 in §2.1, which excludes banking, commerce and social networks from the scope, because it is the sentence that stops the whole thing being overclaimed and it is the one everybody drops when quoting it.',
    },
    {
      year: '2011',
      title: 'Conflict-free Replicated Data Types — Shapiro, Preguiça, Baquero, Zawirski (SSS)',
      url: 'https://www.lip6.fr/Marc.Shapiro/papers/2011/CRDTs_SSS-2011.pdf',
      note: 'Chapter 27, and the result that makes this paper possible eight years later. Read them in this order and the dependency is stark: every ideal here except collaboration was available in 1995 with ordinary files, and collaboration is the one that needed a merge nobody has to write.',
    },
    {
      year: '2017',
      title: 'A Conflict-Free Replicated JSON Datatype — Kleppmann & Beresford (IEEE TPDS)',
      url: 'https://arxiv.org/abs/1608.03960',
      note: 'The type underneath the prototypes: a JSON document — nested maps and lists — that merges, which is what lets an application swap its ordinary data structures for multi-user ones without changing its shape. The technical companion to a paper that is deliberately not technical.',
    },
    {
      year: '2019',
      title: 'Automerge — Ink & Switch',
      url: 'https://github.com/automerge/automerge',
      note: 'The library the three prototypes were built on, and still the most direct way to find out how any of this feels. Worth an hour with the tutorial: the moment where two copies of a document merge without you having written anything is the whole argument, delivered faster than the paper can.',
    },
    {
      year: '2010',
      title: 'CouchDB: The Definitive Guide — Anderson, Lehnardt, Slater',
      url: 'https://guide.couchdb.org/',
      note: 'The near-miss the paper singles out, and the most instructive one. Multi-master replication with full copies on every machine gets remarkably close, and stops exactly where conflicts have to be resolved by application code — which is Chapter 5’s question again, and the reason the model did not take over.',
    },
  ],
  seenIn: [
    { label: 'Who Writes the Merge Function — Ch 27', to: '/papers/crdt', live: true },
    { label: 'The Cart That Must Not Close — Ch 5', to: '/papers/dynamo', live: true },
    { label: 'Interlude: CAP', to: '/papers/cap', live: true },
    { label: 'The Read Path as a Graph — Ch 25', to: '/papers/noria', live: true },
  ],
  finale: {
    title: 'Whose computer is it on',
    body: 'Seven things you would want from the software you make things in — fast, on all your devices, works offline, collaborative, still opens in ten years, private, yours. Files get six and cannot collaborate. Web apps get collaboration and nothing else, and the reason is one fact: the server holds the primary copy, so an edit that has not reached it did not happen. Swap that — make the copy on your device primary and let servers hold secondary copies — and the other six come back, with convergent data types supplying the collaboration that used to require the server. Servers remain, as peers that happen to always be awake, because two people are frequently not online at the same time and no algorithm fixes that. Three years of prototypes found the merging worked, that conflicts were rarer than anybody budgets for, and that the real problems are a change history that cannot be truncated because somebody might return after six months, networking that is not production-ready, and a set of interface questions nobody has answered — starting with what "stop sharing" could possibly mean when you cannot delete a file from somebody else’s computer. The authors say plainly it is not ready. What they were right about is the question.',
  },
  next: { title: 'Sewing It Back Together', slug: 'delta' },
}
