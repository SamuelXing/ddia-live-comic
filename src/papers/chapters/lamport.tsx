import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { HappenedBeforeDiagram, AnomalyDiagram } from '../diagrams'
import { lamportMutexTrace } from './lamport-trace'

/* Opens Act III, and it is a flashback — 1978, twenty-five years before
   Chapter 1. The chapter's job is not to teach logical clocks as a technique;
   it is to make the reader feel the question first, because "which happened
   first" sounds like it must have an answer and the whole act depends on
   accepting that it does not.

   Deliberately does NOT teach vector clocks: Chapter 5 already drew them, and
   the interesting thing here is the opposite direction — how much you can buy
   with a single integer once you stop asking it for something it cannot give. */

export const lamport: Chapter = {
  slug: 'lamport',
  act: 'Act III · Agreement (a flashback)',
  paperNo: 'Paper 7',
  title: 'What “Before” Even Means',
  dek: 'Two acts have now been quietly leaning on a word nobody defined. Here is the 1978 paper that defined it, and the more uncomfortable thing it proved along the way.',
  minutes: 15,
  paper: {
    title: 'Time, Clocks, and the Ordering of Events in a Distributed System',
    authors: 'Leslie Lamport',
    venue: 'Communications of the ACM 21(7)',
    year: '1978',
    url: 'https://lamport.azurewebsites.net/pubs/time-clocks.pdf',
  },
  caption:
    'Act II ended with two machines holding two versions of one shopping cart and no way to say which came later. Cassandra answered with a wall clock and hoped. Dynamo answered by refusing to answer. **Both were working around the same missing thing**, and it is not a mechanism — it is a definition. What does it mean for one event to happen before another, on machines that share no clock? The paper that asks this is twenty-five years older than everything else in this book, it is six pages long, it is the most cited paper in the field, and its most useful result is a piece of bad news.',
  steps: [
    {
      n: 'Step 01',
      title: 'A question that turns out to be the wrong question',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'Start where the paper starts, with something so ordinary it is hard to see as a problem. *“We say that something happened at 3:15 if it occurred after our clock read 3:15 and before it read 3:16.”* Fine. An airline grants a reservation if the request was made **before** the flight filled. Also fine — and now put the request and the flight on different machines.',
        'Which clock decides? Each machine has one and they disagree, by milliseconds if someone is diligent and by minutes if they are not. You cannot appeal to the real time either, because *“the system must contain real clocks”* to observe it, and those clocks are the thing that is wrong. **A specification written in terms of physical time is not implementable by machines that only have imperfect physical clocks.**',
        'So Lamport does something that reads as a sidestep and is actually the entire contribution. **He declines to define “before” in terms of time at all.** Instead: define it only where the system itself can witness it, and accept whatever is left over.',
        'What is left over is the uncomfortable part, and it is stated in the introduction with no ceremony: *“In a distributed system, it is sometimes impossible to say that one of two events occurred first.”* Not difficult. Not expensive. **Impossible** — and then the sentence that should be nailed above every distributed system ever built: *“We have found that problems often arise because people are not fully aware of this fact and its implications.”*',
      ],
      code: {
        file: 'which_came_first.txt',
        lines: [
          { t: 'machine A: 14:32:07.912  "seat booked"' },
          { t: 'machine B: 14:32:07.908  "flight full"' },
          { t: '' },
          { t: '# so the booking came after? no —', hl: 'bad' },
          { t: '# you compared two different clocks,' },
          { t: '# and they disagree by more than 4ms' },
          { t: '' },
          { t: '# fix the clocks? they are ALWAYS wrong', hl: 'bad' },
          { t: '# by some amount you cannot observe' },
          { t: '' },
          { t: '# so: stop asking about time', hl: 'good' },
          { t: '# ask what could have influenced what' },
        ],
      },
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'It is 1978. There is no ARPANET consensus literature to borrow from, there are no distributed databases, and the machines you have communicate only by sending each other messages. You want to build the airline system — or a lock, or anything where order matters — and you are about to discover why you cannot.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**The system:** processes that share nothing, communicate only by messages, and each execute their own events in their own order',
              '**The clocks:** every machine has one, all of them drift, and **no machine can observe how wrong its own clock is**',
              '**The messages:** they arrive eventually, and take an unpredictable amount of time — a slow one is indistinguishable from a lost one',
              '**The goal:** a definition of *before* that the system can actually evaluate, and something useful built on top of it',
              '**Not available:** a shared clock, a central authority, and the year 2026',
            ],
            questions: [
              {
                q: 'Event a happens on one machine, event b on another. You need to know which came first. What do you compare?',
                options: [
                  {
                    label: 'The wall-clock timestamps each machine recorded',
                    verdict: 'dead',
                    why: 'The two numbers came from two clocks that disagree by more than the gap you are measuring, so the comparison answers a question about clock drift rather than about events. This is not a quality problem that better hardware fixes — a clock you cannot check against anything is wrong by an amount you cannot know, and the whole point of Chapter 6 is what happens to a database that bets on this.',
                  },
                  {
                    label: 'Their arrival order at a central sequencer',
                    verdict: 'dead',
                    why: 'The paper kills this one with a three-line counterexample. P1 sends a request to the scheduler, then sends a message to P2; P2 reacts by sending its own request — and P2’s request can arrive first. **The scheduler orders arrivals, and arrivals are not the order things happened.** So a central authority does not even solve this correctly, quite apart from being the thing two acts have just finished throwing out.',
                  },
                  {
                    label: 'Nothing — define “before” only where the system can witness it',
                    verdict: 'move',
                    why: 'Refuse the general question and answer the answerable part. Say `a → b` when they are in the same process and a came first; say it when a is the sending of a message and b is its receipt; and take the transitive closure. That is the whole definition. It means the relation holds **exactly when a could have influenced b** — and it also means that pairs with no chain between them are simply *not ordered*, which is the news the rest of the chapter is about.',
                  },
                  {
                    label: 'Ask a majority of machines which one they saw first',
                    verdict: 'dead',
                    why: 'Each machine can only report when it *learned* of the two events, which is arrival order again, now with voting on top. And if a majority could settle it, you would need that majority to agree on an order first, which is the problem you are trying to solve. Order is not a matter of opinion, and a poll of observers who each saw a different sequence produces a number, not a fact.',
                  },
                ],
              },
              {
                q: 'Your relation is a partial order — plenty of event pairs have no chain either way. But a queue needs one line, not a branching structure. How do you get a single sequence?',
                options: [
                  {
                    label: 'Have each process pick an order for the unordered pairs',
                    verdict: 'dead',
                    why: 'Nothing makes two processes pick the same way, so you end up with several total orders that disagree, which is worse than the partial order you started with — that at least everybody agreed on. The requirement here is not that the order be *correct*, since there is no fact to be correct about. It is that everyone computes the **same** one.',
                  },
                  {
                    label: 'Wait until the chain of messages settles it',
                    verdict: 'dead',
                    why: 'For genuinely concurrent events there is no chain, and there never will be — waiting does not produce one, it just means the queue never advances. This is the mistake worth naming, because it is what people do in practice: treating *"we cannot order these yet"* as a timing problem, when it is a statement about what happened.',
                  },
                  {
                    label: 'Give every event a counter value, and break ties by process id',
                    verdict: 'move',
                    why: 'Each process keeps an integer, bumps it between events, sends it along with every message, and on receipt jumps above whatever it was sent. That guarantees `a → b` implies a smaller number. Numbers still tie, so break the tie with **any fixed ordering of the processes** — the id will do. It is arbitrary and it does not matter that it is arbitrary, because every process applies the same arbitrary rule and therefore reaches the same sequence.',
                  },
                  {
                    label: 'Use physical timestamps, but only to break ties',
                    verdict: 'dead',
                    why: 'It looks like a small dose of a bad idea and it is still the bad idea. Two clocks that disagree will break the same tie in opposite directions on different machines, so the orders diverge — and unlike a process id, you cannot inspect a timestamp and know whether the machine that produced it was fast. The tiebreak has to be something every process can evaluate identically, which is a very short list.',
                  },
                ],
              },
              {
                q: 'Every process can now compute the same total order over all requests. Build mutual exclusion on it — with no central authority.',
                options: [
                  {
                    label: 'The process with the lowest-numbered request just takes it',
                    verdict: 'dead',
                    why: 'It cannot know that it has the lowest, because a request stamped earlier may still be crossing the network toward it. Acting on the best order you have so far is exactly the bug: **an ordering is only safe to act on once you know nothing earlier can still arrive**, and knowing that is a separate problem from computing the order.',
                  },
                  {
                    label: 'Broadcast requests, queue them in the agreed order, and go when you are first and have heard from everyone since',
                    verdict: 'move',
                    why: 'Every process keeps its own private queue, and takes the resource when its request is at the head **and** it has received a later-stamped message from every other process — which is the only way to be certain no earlier request is still in flight. Both conditions are checked locally, with no permission asked of anybody. **Nobody grants the lock. Each process works out that it holds it.**',
                  },
                  {
                    label: 'Elect a coordinator and have it hand out the resource',
                    verdict: 'dead',
                    why: 'The previous decision already showed the coordinator ordering arrivals rather than events, so it gets the answer wrong even when it is up. There is also nothing here to elect it with — election is Chapter 8, and it will turn out to need this chapter as a prerequisite rather than the other way round.',
                  },
                  {
                    label: 'Pass a token around the ring; whoever holds it may proceed',
                    verdict: 'dead',
                    why: 'A real technique with a real weakness: it grants the resource in *token order* rather than in request order, so a process that asked first can wait for the token to go all the way round. It also loses the general result — a token gives you mutual exclusion and nothing else, whereas the queue below generalises to any synchronisation you can describe as a state machine.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You just re-derived the most cited paper in the field — and the state machine',
              body: [
                'The mechanism is six paragraphs of a six-page paper: a counter per process, two rules for moving it, and a tiebreak. What makes it enormous is the last decision, because the queue was only an example. **Generalise it and you get the replicated state machine:** feed the same commands, in the same order, to identical copies, and they stay identical forever, with no further communication. Every consensus system in the rest of this book — Paxos, Raft, ZooKeeper, Spanner — is that idea plus a way to agree on the order when machines fail.',
                'Which is exactly the limitation the paper puts in writing rather than leaving for someone else to find. The algorithm *“requires the active participation of all the processes”*, so **one failed process halts everything.** No majority, no quorum, no fallback. It is not an oversight; it is the honest boundary of what a partial order plus a tiebreak can buy you.',
                'And then the sentence that sets up the next two chapters, which is easy to read past: *“the entire concept of failure is only meaningful in the context of physical time. Without physical time, there is no way to distinguish a failed process from one which is just pausing between events.”* **The reason the fix is hard is not that failure detection is fiddly.** It is that within this model, failure is not a detectable condition at all — and the CAP interlude made the same observation from the other end, which is that slow and partitioned are the same thing to an observer.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'Ordered, and not ordered',
      accent: 'denim',
      rung: 'Rung 3 · The relation itself',
      body: [
        'The picture is the paper’s Figure 1, turned so time runs down the page. Three processes, some events, some messages. **One event happened before another exactly when you can get from the first to the second by moving forward along process lines and message lines** — that is the whole test, and it is why the relation is exactly *could have influenced*.',
        'Follow the denim path: an event on P reaches a later event on P by going out to Q, along Q for a while, and back. Ordered, definitively, with no clock involved. Now look at the two terra dots. There is no path from one to the other in either direction, so they are **concurrent** — and concurrent here does not mean *at the same time*. One of them may well have happened hours earlier by some external reckoning. It means neither could have known about the other, so **nothing inside the system can order them and nothing ever will.**',
        'Lamport notes the resemblance to special relativity, and then makes a distinction worth borrowing. Relativity orders events by the messages that *could* be sent; he orders them by messages that **actually are** sent, because *“we should be able to determine if a system performed correctly by knowing only those events which did occur.”* A correctness argument you can check from a log, rather than from a physics of what was possible.',
      ],
      diagram: <HappenedBeforeDiagram />,
      think: {
        q: 'The clock condition says `a → b` implies `C(a) < C(b)`. Why does the paper insist the converse must not hold?',
        a: 'Because a converse would be a claim the numbers cannot support. If `C(a) < C(b)` implied `a → b`, then two concurrent events would have to carry equal numbers — and the diagram shows why that breaks immediately: two events on the *same* process are ordered by definition and must differ, while both may be concurrent with a third event on another line. Equal numbers would then be forced to be unequal. **So a smaller timestamp means "possibly earlier, possibly unrelated", and never "definitely earlier."** This is the single most misused property in the field: people see integers, assume the integers mean time, and build a comparison on top of a relation that only ever ran one direction.',
      },
    },
    {
      n: 'Step 04',
      title: 'The algorithm — and the sentence that ends Act III’s first chapter',
      accent: 'denim',
      rung: 'Rung 4 · The reveal',
      span: 2,
      body: [
        'Three peers, one resource, no coordinator. Every box is the same colour in this trace because there is genuinely nothing special about any of them — giving one an accent would be a lie about the algorithm.',
        'The step to watch is the last one. The algorithm is correct, elegant, and stops completely when one machine dies.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={lamportMutexTrace} />
        </div>
      ),
    },
    {
      n: 'Step 05',
      title: 'Your order is internally perfect, and it is wrong',
      accent: 'terra',
      rung: 'Rung 5 · The anomaly the author raised himself',
      body: [
        'Here is the objection, and it is the paper’s own. Someone issues request A on a computer in one city, **picks up the telephone**, and asks a friend to issue request B on a computer in another. B can easily receive the lower timestamp and be ordered first.',
        'Nothing malfunctioned. The system ordered every event it was told about, correctly, by rules that guarantee consistency. It simply never saw the phone call — and *“no algorithm based entirely upon events in [the system], and which does not relate those events in any way with the other events [outside it], can guarantee that request A is ordered before request B.”* **Causality that travels outside your system is invisible to your system**, and no amount of internal cleverness recovers it.',
        'Two exits, and they are the two exits for every version of this problem since. **Carry the ordering by hand**: A’s issuer gets the timestamp back and tells their friend to stamp B later — which makes correctness the user’s job, and is exactly what a modern client library is doing when it hands you an opaque context to pass along. Or **buy real clocks** good enough that a message can never outrun the difference between them, which the paper states as a precise inequality relating clock error to the shortest possible message time.',
        'That second exit is worth remembering, because a system in Act IV takes it literally. **Spanner buys the clocks** — GPS receivers and atomic clocks in every datacentre — and then waits out its own uncertainty before committing. Thirty-four years apart, and it is the same escape hatch: if you cannot detect the ordering, pay to make the ambiguity smaller than the thing you care about.',
      ],
      diagram: <AnomalyDiagram />,
    },
    {
      n: 'Step 06',
      title: 'The half nobody reads',
      rung: 'Rung 6 · Physical clocks, and a number from 1978',
      body: [
        'Roughly the last third of the paper is about real clocks, and it is skipped in essentially every summary — which is a shame, because it is the part with numbers in it and the part that leads somewhere modern.',
        'Two conditions. **PC1** bounds the rate: a clock must tick within a factor κ of correct, and the paper records that *“for typical crystal controlled clocks, κ ≤ 10⁻⁶.”* One part in a million — a second of drift roughly every eleven and a half days, per clock, in opposite directions. **PC2** bounds the spread: any two clocks stay within ε of each other. The theorem then says that if every link carries a message every τ seconds with unpredictable delay under ξ, a strongly connected network of diameter d holds **ε = d(2κτ + ξ)** — and that it takes about τd from a cold start to get there.',
        'Read what that expression is telling you rather than the algebra. **Your clock skew is bounded by how often you talk and how unpredictable the network is, multiplied by how far apart you are in hops.** Not by how good your crystals are — κ is in there, but it is multiplied by the sync interval, so a diameter of 5 and a jittery network dominate it completely. That is why *tighten the clocks* is usually the wrong lever and *shorten the path* is usually the right one.',
        'And it explains why the second exit from the anomaly is expensive. To rule out anomalies you need the clock spread to be **smaller than the shortest possible message time** between any two processes — and message times fell by orders of magnitude over the following decades while clock synchronisation improved far more slowly. The gap got harder to close, not easier, which is why closing it eventually required buying atomic clocks rather than writing better software.',
      ],
      deeper: {
        summary: 'Why “just use NTP” is a different claim from the one people think they are making.',
        body: [
          'NTP over a decent network keeps machines within a few milliseconds of each other, and a good deployment does better. That sounds like plenty — until you notice the comparison the theorem asks for is not against your latency but against **the shortest interval between two events you need to order**, and that within a datacentre is microseconds.',
          'So the useful question is never *how accurate are our clocks*. It is: **is the clock error smaller than the smallest gap I need to distinguish?** In a datacentre, with millisecond clock error and microsecond message times, the answer is no by three orders of magnitude — which is why last-write-wins on wall clocks is a real hazard rather than a theoretical one, and why Chapter 6 spends its bill section on exactly that.',
          'It is also why Spanner does not claim its clocks are right. It claims they are wrong by **at most** a known amount, publishes that amount as an interval, and then waits it out — turning an unbounded unknown into a bounded cost. That is a fundamentally different kind of claim from *our clocks are synchronised*, and the difference is the whole of Chapter 11.',
        ],
      },
    },
    {
      n: 'Step 07',
      title: 'What it begat — and where it stands in 2026',
      rung: 'Rung 7 · Descendants',
      body: [
        '**The vocabulary is the legacy.** *Happened-before*, *concurrent*, *logical clock*, *timestamp* in the sense every distributed system now means it — all from these six pages. The paper won the ACM SIGOPS Hall of Fame award and a Dijkstra Prize, and Lamport took the Turing Award in 2013 with this at the front of the citation.',
        '**Vector clocks are the direct extension**, arriving via Fidge and Mattern in 1988: keep one counter per process instead of one, and you recover the converse the single integer could never give — you can now tell *concurrent* from *ordered* rather than only ruling out one direction. Chapter 5 drew them, and paid for them, which is the whole reason Chapter 6 refused to.',
        '**The state machine approach outgrew the paper entirely.** Lamport’s own later work formalised it, and it is the shape of every replicated system you will meet: agree on an order for the commands, apply them everywhere, and the copies cannot diverge. Chapters 8 and 9 are about doing that when machines fail — which this algorithm explicitly cannot.',
        '**Hybrid logical clocks** (2014) are the modern reconciliation, and they are what you will actually find in a database today: a physical timestamp with a logical counter attached, close enough to real time to be human-meaningful and still guaranteeing that causality never runs backwards. CockroachDB and MongoDB both use them, and they exist precisely because neither half of this paper is sufficient alone.',
        '**2026 status: universally used, routinely misread.** Lamport timestamps are in every queue, every CRDT, every version vector, and most people who use them believe a smaller number means earlier. The paper is very clear that it does not. **The result that has aged best is not the algorithm but the warning** — that *before* is a partial order, that concurrent pairs genuinely have no answer, and that problems arise because people are not fully aware of this. Forty-eight years on, that sentence is still doing more work than the mechanism it introduced.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Happened-before (→).',
      body: 'a → b if they are in one process with a first, or a is a message send and b its receipt — plus transitivity. Reads as: a could have influenced b.',
    },
    {
      term: 'Concurrent.',
      body: 'Neither a → b nor b → a. Not "at the same time" — it means no chain of messages connects them, so nothing in the system can order them.',
    },
    {
      term: 'Logical clock.',
      body: 'One integer per process, bumped between events and advanced past any timestamp received. Guarantees a → b implies C(a) < C(b), and promises nothing in reverse.',
    },
    {
      term: 'Total order (⇒).',
      body: 'The partial order extended to a full sequence by breaking ties on process id. Arbitrary on purpose — what matters is that every process computes the same one.',
    },
    {
      term: 'State machine.',
      body: 'Commands plus a state plus a transition function. Feed identical copies the same commands in the same order and they stay identical, without further communication.',
    },
    {
      term: 'The anomaly.',
      body: 'Information travelling by a channel the system cannot see — a phone call — so a consistent internal order contradicts what actually happened.',
    },
  ],
  inTheWild: {
    note: '5 ways this bites in production',
    points: [
      '**A smaller Lamport timestamp is read as "earlier".** It is not — it rules out one direction and asserts nothing about the other. Code that sorts events by logical timestamp and calls the result a history is producing *a* consistent order, not *the* order, and the difference surfaces as two services disagreeing about a sequence they both computed correctly.',
      '**Wall-clock comparison across machines, everywhere, forever.** `if (a.updated_at > b.updated_at)` across two services is the single most common instance of this paper’s opening problem, and it fails in exactly the way Chapter 6 pays for: silently, under skew, with no error to alert on.',
      '**The anomaly shows up as "the API says it saved but the read is stale".** A user writes through one service and reads through another, and the causal link — the user themselves — is outside both systems. This is why client libraries hand you an opaque token to pass along: it is the paper’s first exit, productised.',
      '**"Requires all processes" gets rediscovered as a hang.** Any protocol that waits to hear from *everyone* stops when one member is slow rather than dead. The fix is a quorum, which is Chapter 8, and teams routinely build the all-participants version first because it is the obvious one.',
      '**Concurrent gets treated as a timing bug.** An engineer sees two events that cannot be ordered, assumes better instrumentation would resolve it, and goes looking for a clock to fix. There is nothing to find. The correct response is to decide what the system should *do* with unordered pairs — merge them, pick by rule, or surface both.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Track causality, not time',
        when: 'you need to know whether one thing could have affected another — cache invalidation, conflict detection, session guarantees. Lamport timestamps if you only need to rule out one direction; vector clocks if you need to recognise genuine concurrency, at the cost Chapter 5 describes.',
      },
      {
        choose: 'Agree an arbitrary total order',
        when: 'you need every replica to reach the same state and there is no fact about the true order. The order does not have to be right, because there is nothing to be right about — **it has to be identical everywhere**, and that is a much cheaper requirement.',
      },
      {
        choose: 'Pass causality by hand',
        when: 'the link between two operations lives outside your system — a user, a phone call, another company’s API. Hand the caller a token and have them present it on the next request. Nothing else can see that edge.',
      },
      {
        choose: 'Buy the clocks',
        when: 'you genuinely need external ordering and the ambiguity costs more than the hardware. It is a real answer at a real price, and it works only if you treat the clock as an interval you must wait out rather than a number you can compare.',
      },
    ],
  },
  misconception: {
    think: '“Lamport clocks let you work out what happened first without a shared clock.”',
    actually:
      'They let you work out what **could not** have happened first, which is a strictly weaker and far more useful thing. The guarantee runs one way only: if a → b then C(a) < C(b). Read it backwards and you are asserting something the paper explicitly rules out — a smaller number means *earlier or unrelated*, and it can never distinguish the two. **The genuine contribution is the bad news**: that for a large fraction of event pairs there is no first, not because the machinery is inadequate but because the relation is a partial order and those pairs are simply not in it. Everything else in the paper — the counters, the tiebreak, the queue, the state machine — is what you build once you have accepted that. And the chapter after this one is the field spending twenty years working out how to agree on an arbitrary order *while machines are failing*, which is the part this algorithm cannot do at all.',
  },
  sources: [
    {
      year: '1978',
      title: 'Time, Clocks, and the Ordering of Events in a Distributed System — Leslie Lamport (CACM 21(7))',
      url: 'https://lamport.azurewebsites.net/pubs/time-clocks.pdf',
      note: 'Six pages, and unlike most things in this book it can be read in an evening with no prerequisites. **The first two pages are the ones that matter** — the definition of → and the observation that it is only partial. Then the mutual exclusion algorithm, then the anomaly, which is the author raising the best objection to his own result. The physical-clocks section is skipped by almost everyone; read it for the theorem, and for the fact that a 1978 paper priced clock skew in terms of network diameter.',
    },
    {
      year: '2019',
      title: 'Lamport’s own note on the paper (My Writings, entry 27)',
      url: 'https://lamport.azurewebsites.net/pubs/pubs.html',
      note: 'Lamport annotates his own bibliography, and the entry for this paper is worth the click: he explains that the insight came from noticing a published algorithm was wrong, and that the relativity connection was the thing that made the partial order feel inevitable rather than clever. Rare access to how a result actually arrived.',
    },
    {
      year: '1988',
      title: 'Virtual Time and Global States of Distributed Systems — Friedemann Mattern',
      url: 'https://www.vs.inf.ethz.ch/publ/papers/VirtTimeGlobStates.pdf',
      note: 'Vector clocks, ten years later — Mattern and Fidge arrived at them independently in the same year. One counter per process instead of one total, which buys back the converse a single integer cannot give: you can now recognise genuine concurrency rather than only ruling out one direction. Read it beside Chapter 5, which draws the mechanism, and Chapter 6, which refuses to pay for it.',
    },
    {
      year: '2014',
      title: 'Logical Physical Clocks and Consistent Snapshots in Globally Distributed Databases — Kulkarni, Demirbas et al.',
      url: 'https://cse.buffalo.edu/tech-reports/2014-04.pdf',
      note: 'Hybrid logical clocks — the reconciliation of this paper’s two halves, and what you will actually find inside a modern distributed database. Physical enough to be human-meaningful, logical enough that causality never runs backwards.',
    },
  ],
  seenIn: [
    { label: 'The Cart That Must Not Close — Ch 5', to: '/papers/dynamo', live: true },
    { label: 'A Marriage of Two Papers — Ch 6', to: '/papers/cassandra', live: true },
    { label: 'Interlude: CAP', to: '/papers/cap', live: true },
    { label: 'Why it’s hard — the comic', to: '/ddia/read/distributed-troubles', live: true },
    { label: 'Consensus — the comic', to: '/ddia/read/consensus', live: true },
  ],
  finale: {
    title: 'The order was never out there to be found',
    body: 'A definition was missing, two acts spent their energy working around the hole, and when it finally arrives it withholds most of what anybody wanted from it. There is no true sequence waiting to be discovered; there is a partial order that genuinely stops, and past that point any order will do provided everybody computes the same one. Which relocates the whole problem, and names the rest of this act: not *what happened first*, but *how does a group of machines settle on one answer when some of them have stopped and nobody can tell which*. Next: the algorithm that solves it, told twice, because the first telling was famously incomprehensible.',
  },
  next: { title: 'Consensus, Twice Told', slug: 'consensus' },
}
