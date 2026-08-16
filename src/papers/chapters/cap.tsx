import type { Chapter } from '../types'
import { CapProofDiagram, PacelcDiagram } from '../diagrams'

/* The book's second interlude, same shape as the first: no `paper` field, so
   no citation card and no answer key; no DesignIt, because there is nothing
   here to design — the reader is not being walked toward a system, they are
   being handed a claim and taught to state it correctly.

   It sits between Dynamo and Cassandra because Dynamo is the single most-cited
   piece of evidence for CAP and the citation is usually wrong, and because Act
   IV spends two chapters buying back what people think CAP forbids. Getting
   the statement right here saves arguing with a misremembered theorem twice. */

export const cap: Chapter = {
  slug: 'cap',
  act: 'Act II · Availability at Any Cost',
  paperNo: 'Interlude',
  title: 'Interlude: CAP',
  dek: 'The most cited result in this field, and the one most often quoted by people who have not read it. Four pages to state it correctly — and to find the question it does not ask.',
  minutes: 9,
  caption:
    'You have just watched a company give up a guarantee to keep a promise, and there is a theorem everyone reaches for to explain it. **Pick two of three: consistency, availability, partition tolerance.** It gets drawn as a triangle on whiteboards, it gets used to end arguments, and the person citing it can rarely say what any of the three words mean in it. That is a shame, because the actual result is small, precise, and provable in a paragraph — and the précis people carry around is wrong in a way that leads to bad decisions. **Stop for one page and get the statement right.**',
  steps: [
    {
      n: 'The idea',
      title: 'The proof is one paragraph, and you can check it yourself',
      accent: 'terra',
      body: [
        'Eric Brewer raised it as a conjecture in a 2000 keynote. Two years later Seth Gilbert and Nancy Lynch turned it into a theorem, and the argument is short enough to hold in your head all at once.',
        'Two servers, `p1` and `p2`. Every message between them is lost — that is the partition. A client writes a new value to `p1`, which stores it and acknowledges. A moment later another client sends a read to `p2`. **That second server cannot tell the difference between a world where the write happened and a world where it did not**, because the only evidence is on the other side of a break in the network. So it has exactly two moves: hand back the value it has, which is stale, or refuse to answer until it hears from `p1`, which may be never.',
        'That is the whole thing. Answering breaks consistency; waiting breaks availability; there is no third door. **It is not a trade curve or an engineering guideline** — it is an impossibility result about a specific, narrow model, and the narrowness is what makes it provable.',
        'And there is a sting in the tail that almost nobody quotes. In an asynchronous network there is no bound on how long a message may take, so a slow link is indistinguishable from a broken one. Gilbert and Lynch spell out the consequence: it is *“even impossible to guarantee consistency when there are no partitions, and return a bad answer only when partitions occur.”* **The unfixable case is not the dramatic one. It is the one where everything is merely slow.**',
      ],
      diagram: <CapProofDiagram />,
    },
    {
      n: 'The letters',
      title: 'None of the three words means what it usually means',
      body: [
        '**C is not the C in ACID.** In ACID, consistency means the database does not let you violate your own constraints — the foreign keys hold, the cheque total matches the line items. In CAP it means something else entirely: every read returns a value consistent with a single, atomic history, as though one machine were serving every request in order. That is **linearizability**, a specific and demanding guarantee, and it is the strongest one on the shelf. A system can be perfectly correct about its constraints and offer nothing like it.',
        '**A is not uptime.** CAP’s availability says every request to a non-failing node **eventually** receives a response — not a fast one, not a 99.9% one. *Eventually.* A system that answers every request in an hour satisfies it; a system with four nines that returns one error satisfies it. So the theorem is not describing the thing your SLA is about, and a design that trades away CAP-availability may still be the most reliable system in your building.',
        '**P is not a choice you get to make.** This is the one that does the damage. Consistency and availability are properties you build; partition tolerance is a statement about the network you are on. Cables get cut, switches reboot, a datacentre link saturates. **You cannot opt out of the possibility, only out of surviving it** — so the honest form of the theorem is not *pick two of three*, it is: *when a partition happens, you will choose between consistency and availability, and if you have not chosen deliberately then the choice was made by whoever wrote your defaults.*',
        'Which is why the whiteboard triangle is worse than useless. Brewer said so himself, ten years on: the *“2 of 3”* formulation is **misleading**, because it hides that the choice arises only during a partition, and that it can be made differently for different operations in the same system. The letters were a slogan. The slogan outlived the argument.',
      ],
      think: {
        q: 'People label single-node PostgreSQL a “CA system”. Is that right?',
        a: 'It is true and it is empty. One machine has no network between replicas, so there is no partition to tolerate and the theorem has nothing to say — you can call it CA the way you can call an empty room quiet. **The label stops meaning anything the moment you add a replica**, and the interesting version of the question arrives with it: a synchronous standby makes the pair CP, because a write blocks when the standby is unreachable; an asynchronous one makes it AP-ish, because the primary keeps accepting writes that the standby has not got and may never get. *The database did not change. The deployment did* — and CAP classifies deployments, not products.',
      },
    },
    {
      n: 'The move',
      title: 'The question it forgets to ask',
      accent: 'denim',
      body: [
        'Here is the practical problem with CAP as a design tool: **it describes a situation that is rare, and says nothing about the one you are in right now.** Partitions are unusual. The rest of the time — which is nearly all of the time — a replicated system still has to decide how much coordination to do before answering, and that decision costs latency on every single request, forever.',
        'Daniel Abadi’s fix is a longer acronym and a much better question. **PACELC**: if there is a **P**artition, do you keep **A** or **C**; **E**lse, do you keep **L**atency or **C**? Dynamo answers *availability, then latency* — it gives up consistency in both cases, which is what makes it coherent rather than merely permissive. Bigtable answers *consistency, then consistency.* MongoDB, in Abadi’s classification, keeps availability under partition and consistency the rest of the time.',
        'The second column is where the money is. **A system that waits for a quorum on every read is paying for a partition that is not happening**, on every request, all year. That is not a criticism — it is often exactly right — but it is a cost that CAP renders invisible, and teams routinely accept it without noticing they have.',
        'One detail from that same paper closes a loop from the last chapter. Abadi notes that the tunable stores can trade back toward consistency by raising `R` and `W`, *“although they cannot achieve full consistency as defined by Gilbert and Lynch, even if R + W > N.”* The inequality buys you overlap between the nodes you asked. It does not buy you linearizability, and the sloppy quorum is one reason why.',
      ],
      diagram: <PacelcDiagram />,
    },
    {
      n: 'Why here',
      title: 'Between the ring and its descendant — and pointing at Act IV',
      body: [
        'Dynamo is the most-cited piece of evidence for CAP, and the citation is usually made backwards. The paper does not say *we are AP because CAP forced us*. It says a refused write costs Amazon money, so writes will not be refused, and here is the bill for that. **The engineering decision came first and the theorem is the explanation, not the cause** — which is the right order, and the opposite of how it usually gets retold.',
        'It also explains why Act III is a flashback. If you cannot have both, and you decide you want the consistent one, then you need machines to agree on an order while some of them are unreachable. That is consensus, and the book goes back to 1978 to get it. Everything Act I leaned on — Chubby’s elections, Bigtable’s leases — was already spending it without saying so.',
        'And then Act IV is two attempts to buy back what people think CAP forbids, which is where the misreading gets expensive. **Spanner is a CP system**: when it cannot reach a quorum it stops rather than diverging. But Google runs it on a private network engineered so hard that partitions are rarer than the other things that take a service down, and Brewer’s own note on it makes the argument that its availability is high enough that the CAP choice stops being the thing users experience. **Read that as the real lesson of the theorem**: it tells you what happens *during* a partition, and how often you are in one is a question about money and cable, not about computer science.',
        'Last thing, and it is the reason to read Kleppmann’s critique rather than only the original. CAP fixes one consistency model, one failure model, and one definition of available, and then proves something narrow and true. Real systems live in the enormous space between *linearizable* and *anything goes* — read-your-writes, monotonic reads, causal consistency — **and CAP has nothing to say about any of it.** A theorem that answers one question well is not a framework for all the others.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Linearizability.',
      body: 'The C in CAP. Every operation appears to take effect at one instant between its request and its response, so the system behaves as if one machine served everything in order.',
    },
    {
      term: 'Availability (CAP’s).',
      body: 'Every request to a working node eventually gets a response. No deadline, no percentage. Not the thing your uptime dashboard measures.',
    },
    {
      term: 'Partition.',
      body: 'The network splits into groups that cannot reach each other. Note that in an asynchronous network, sufficiently slow is indistinguishable from split.',
    },
    {
      term: 'Safety and liveness.',
      body: 'Nothing bad happens, versus something good eventually happens. Gilbert and Lynch place CAP as one case of a much older result: you cannot promise both when the system is unreliable.',
    },
    {
      term: 'PACELC.',
      body: 'If Partitioned, choose Availability or Consistency; Else, choose Latency or Consistency. The extension that covers the case you are actually in.',
    },
  ],
  tradeoffs: {
    title: 'how to use it without misusing it',
    rows: [
      {
        choose: 'Ask what happens during a partition',
        when: 'you are choosing a datastore. Not *is it CP or AP* — ask what a write does when the quorum is unreachable, and what a read returns. The answer is concrete, testable, and usually documented; the label is neither.',
      },
      {
        choose: 'Ask the else-clause too',
        when: 'you care about latency, which is always. How much coordination happens on the ordinary request, when nothing is broken? That is the cost you pay every day, and CAP does not mention it.',
      },
      {
        choose: 'Name the guarantee, not the letter',
        when: 'you are writing a design doc. *Read-your-writes within a session* is a promise someone can implement and test. *We chose AP* is a slogan that two readers will interpret differently and neither will notice.',
      },
      {
        choose: 'Stop citing it as an excuse',
        when: 'someone reaches for CAP to justify a system being wrong under no partition at all. Most inconsistency in production is not the theorem — it is a missing merge function, a default nobody read, or a clock. **The theorem is narrow. Your bug probably is not it.**',
      },
    ],
  },
  misconception: {
    think: '“CAP proves you can only pick two of consistency, availability and partition tolerance.”',
    actually:
      'You do not get three to pick from. **Partition tolerance is not a property you choose** — it is a description of the network, and every network can partition. So there are only two things on the table, and the choice between them only arises *while a partition is happening*. Brewer put this in print himself in 2012, calling the 2-of-3 framing misleading and noting that the choice is per-operation, not per-database — the same system can answer one endpoint strictly and another one loosely, and good ones do. What the theorem actually gives you is a small, sharp fact about one bad minute. **What people use it for is to end arguments**, which it is not equipped to do, because the interesting question was never which two letters you picked.',
  },
  sources: [
    {
      year: '2002',
      title: 'Brewer’s Conjecture and the Feasibility of Consistent, Available, Partition-Tolerant Web Services — Gilbert & Lynch (SIGACT News)',
      url: 'https://www.comp.nus.edu.sg/~gilbert/pubs/BrewersConjecture-SigAct.pdf',
      note: 'The paper that made the conjecture a theorem. Read §2 for the formal statement and the proof; it is genuinely short. Worth reading purely to see how much smaller the real claim is than the thing built on top of it.',
    },
    {
      year: '2012',
      title: 'Perspectives on the CAP Theorem — Gilbert & Lynch',
      url: 'https://groups.csail.mit.edu/tds/papers/Gilbert/Brewer2.pdf',
      note: 'The same authors, ten years later, and the better first read. Their reframing is the takeaway: CAP is one instance of the far older fact that **you cannot guarantee both safety and liveness in an unreliable system.** The proof sketch on page 3 is the figure drawn above.',
    },
    {
      year: '2012',
      title: 'CAP Twelve Years Later: How the “Rules” Have Changed — Eric Brewer (IEEE Computer)',
      url: 'https://www.infoq.com/articles/cap-twelve-years-later-how-the-rules-have-changed/',
      note: 'The author of the conjecture explaining what people got wrong with it, which is a rare and useful genre. The part worth the trip is the partition-recovery discussion — what a system should do *after* the network comes back, which the theorem says nothing about and which is where most of the real engineering is.',
    },
    {
      year: '2012',
      title: 'Consistency Tradeoffs in Modern Distributed Database System Design — Daniel Abadi (IEEE Computer)',
      url: 'https://www.cs.umd.edu/~abadi/papers/abadi-pacelc.pdf',
      note: 'Six pages, and the source of PACELC and of the classifications in the table above. The argument that CAP’s omission of the no-partition case is a *“major oversight”* is the most useful correction anyone has made to it.',
    },
    {
      year: '2015',
      title: 'A Critique of the CAP Theorem — Martin Kleppmann',
      url: 'https://arxiv.org/abs/1509.05393',
      note: 'The careful demolition: what CAP’s definitions actually cover, how the informal versions go wrong, and why the space of consistency models is far richer than one line between two points. Read it last, after you believe the theorem — it is much more interesting once you do.',
    },
  ],
  seenIn: [
    { label: 'The Cart That Must Not Close — Ch 5', to: '/papers/dynamo', live: true },
    { label: 'Interlude: The RUM Triangle', to: '/papers/rum', live: true },
    { label: 'Leaderless & quorums — the comic', to: '/ddia/read/replication-quorum', live: true },
    { label: 'Why it’s hard — the comic', to: '/ddia/read/distributed-troubles', live: true },
  ],
  finale: {
    title: 'A small true thing, carrying a great deal it was never asked to',
    body: 'What you should take out of this page is a habit rather than a letter pair. When someone tells you a system is AP or CP, ask them the two questions the theorem does not: what happens to a write when the quorum is gone, and how much coordination does an ordinary read pay when nothing at all is wrong. Next, back to Act II, and the system that took Dynamo’s ring, put Bigtable’s data model on top of it, and became the thing the rest of the industry actually deployed.',
  },
  next: { title: 'A Marriage of Two Papers', unwritten: true },
}
