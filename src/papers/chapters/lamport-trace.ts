import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* The paper's own worked example: three symmetric processes, one resource, and
   an ordering agreed without anybody deciding it. Unusually for this book the
   nodes are all the same colour — that is the point, there is no coordinator,
   and giving one of them amber would be a lie about the algorithm.

   Geometry: the processes stack in the left zone and the corridor at x≈60.5
   (right of them, still inside that zone) carries P1's message to P3 without
   cutting through P2. The right zone holds one node, deliberately — it is not
   a machine, it is what all three independently compute, and the trace's last
   step is about the fact that nobody had to be told it. */
const C = {
  proc: VIZ.blue,
  msg: VIZ.violet,
  agreed: VIZ.green,
  bad: VIZ.red,
}

export const lamportMutexTrace: TraceSpec = {
  title: 'Three peers, one resource, and an order nobody was told',
  aspect: 0.5,
  zones: [
    { label: 'Three processes', x: 2, y: 4, w: 60, h: 42 },
    { label: 'What each computes', x: 65, y: 4, w: 32, h: 42 },
  ],
  nodes: [
    { id: 'p1', x: 5, y: 8, w: 54, h: 8, label: 'P1 · clock 0', sub: 'wants the resource', color: C.proc },
    { id: 'p2', x: 5, y: 19, w: 54, h: 8, label: 'P2 · clock 0', sub: 'wants it too', color: C.proc },
    { id: 'p3', x: 5, y: 30, w: 54, h: 8, label: 'P3 · clock 0', sub: 'just watching', color: C.proc },
    { id: 'ord', x: 68, y: 19, w: 26, h: 9, label: 'The same queue', sub: 'on all three', color: C.agreed },
  ],
  steps: [
    {
      title: 'A counter, and one rule for moving it',
      prose:
        'Each process keeps an integer and nothing else — no clock, no calendar, no shared anything. It bumps that integer between its own events, and when it sends a message it attaches the current value. <b>On receiving a message, a process sets its counter above the number it just saw.</b> Those two rules are the whole mechanism, and together they guarantee one thing: <em>if this event could have influenced that one, its number is smaller.</em> The converse is not promised and never will be.',
      focus: ['p1', 'p2', 'p3'],
      particles: [],
    },
    {
      title: 'P1 asks — and tells everybody, because there is nobody to ask',
      prose:
        'P1 wants the resource. It stamps a request with its counter, <b>puts the request on its own queue</b>, and broadcasts it to every other process. Notice what is absent: there is no scheduler to send it to. The paper explains why a central scheduler is not merely unfashionable but <em>wrong</em> here — P1 could message P2, P2 could then request, and P2&rsquo;s request could reach the scheduler first. <b>A scheduler orders arrivals, and arrivals are not the order things happened.</b>',
      focus: ['p1', 'p2', 'p3'],
      particles: [
        { from: 'p1', to: 'p2', color: C.msg },
        { from: 'p1', to: 'p3', color: C.msg, via: [{ x: 60.5, y: 12 }, { x: 60.5, y: 34 }] },
      ],
    },
    {
      title: 'P2 asks at the same time — and “at the same time” is exactly the problem',
      prose:
        'Before P2 hears anything, it wants the resource too. It stamps its own request and broadcasts. These two requests are <b>concurrent</b> in the paper&rsquo;s precise sense: neither could have influenced the other, so there is no fact of the matter about which came first. <em>Any system that claims to know is either using a clock or making it up.</em>',
      focus: ['p1', 'p2', 'p3'],
      particles: [
        { from: 'p2', to: 'p1', color: C.msg },
        { from: 'p2', to: 'p3', color: C.msg },
      ],
    },
    {
      title: 'The tie is broken by a rule, not by a fact',
      prose:
        'Both requests carry the same number. Every process now applies the same tiebreak — <b>the lower process id wins</b> — and every process therefore reaches the same answer without discussing it. That rule is <em>arbitrary</em> and the paper says so plainly. It is not discovering who really asked first; it is manufacturing an answer that everyone will manufacture identically. <b>That is all a total order has to be.</b>',
      focus: ['p1', 'p2', 'p3'],
      particles: [],
    },
    {
      title: 'Acknowledge — and the acknowledgement is the interesting part',
      prose:
        'Each process replies to every request it receives, with a timestamped acknowledgement. This looks like bookkeeping and it is the load-bearing rule. A process may take the resource only when its request is first in its queue <b>and it has heard something later from every other process</b> — because that is the only way to be sure no earlier request is still in flight. <em>You cannot know you have heard everything; you can only know you have heard from everyone since.</em>',
      focus: ['p1', 'p2', 'p3'],
      particles: [
        { from: 'p3', to: 'p1', color: C.msg, via: [{ x: 60.5, y: 34 }, { x: 60.5, y: 12 }] },
        { from: 'p3', to: 'p2', color: C.msg },
        { from: 'p2', to: 'p1', color: C.msg },
      ],
    },
    {
      title: 'All three hold the identical queue — and nobody sent it to them',
      prose:
        'Every process now has the same sequence of requests in the same order, derived independently from the same rules. P1 is at the head, so P1 takes the resource; the others can see that it should, and wait, without being told. <b>Generalise the queue to any state machine and you have the whole idea:</b> feed the same commands in the same order to identical copies and they stay identical forever. <em>Replication stops being about copying data and becomes about agreeing on an order.</em>',
      focus: ['p1', 'p2', 'p3', 'ord'],
      particles: [
        { from: 'p1', to: 'ord', color: C.agreed },
        { from: 'p2', to: 'ord', color: C.agreed },
        { from: 'p3', to: 'ord', color: C.agreed },
      ],
    },
    {
      title: 'Now kill one — and the whole thing stops',
      prose:
        'P3 dies. It owes everyone an acknowledgement it will never send, so <b>no process can ever satisfy the “heard from everyone” condition</b>, and the resource is never granted again. The paper states this without flinching: the algorithm requires the active participation of all processes, and one failure halts the system. Then it names the reason the fix is hard, in a sentence worth memorising: <b>without physical time there is no way to distinguish a failed process from one that is merely pausing.</b> <em>That sentence is the next two chapters.</em>',
      focus: ['p1', 'p2', 'p3'],
      particles: [
        { from: 'p1', to: 'p3', color: C.bad, via: [{ x: 60.5, y: 12 }, { x: 60.5, y: 34 }] },
        { from: 'p2', to: 'p3', color: C.bad },
      ],
    },
  ],
}
