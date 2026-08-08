import type { Comic } from '../types'
import { TimeoutDiagram } from '../diagrams'

export const distributedTroubles: Comic = {
  slug: 'distributed-troubles',
  chapter: 'Chapter 8 · The Trouble with Distributed Systems',
  chapterNo: 'Ch 8',
  title: 'Why It’s Hard',
  dek: 'In one process a function returns or the machine is off. Across a network, nothing is that honest — and a healthy server can be declared dead.',
  minutes: 6,
  caption:
    'A single computer is a mostly-honest partner: an operation succeeds, fails cleanly, or the whole thing is off. A **distributed** system offers no such comfort — messages get lost, delayed, duplicated; clocks drift; a process freezes mid-step. The whole discipline is acting sensibly on **partial, late, possibly-wrong information.**',
  steps: [
    {
      n: 'Step 01',
      title: 'The network won’t tell you',
      accent: 'terra',
      rung: 'Rung 1 · Intuition',
      body: [
        'You send a request and hear nothing back. Which happened? The request was lost; it arrived but the node died; it’s still processing; the reply was lost; or everything’s fine but *slow*. **You cannot tell them apart** from where you’re standing.',
        'The only tool is a **timeout** — and a timeout is a guess, not a fact.',
      ],
    },
    {
      n: 'Step 02',
      title: 'Clocks lie',
      accent: 'terra',
      rung: 'Rung 1 · Intuition',
      body: [
        'Time feels like solid ground; it isn’t. A machine’s **wall clock** is synced by NTP and can jump backward, or drift seconds from its neighbours. Order two events across two machines by their timestamps and you can conclude the effect happened *before* the cause.',
        'For measuring durations, use a [[monotonic clock|A clock guaranteed to only move forward at a steady rate, unaffected by NTP jumps. Good for “how long did this take,” useless for “what time is it.”]] — never the wall clock.',
      ],
    },
    {
      n: 'Step 03',
      title: 'Your process can freeze',
      accent: 'terra',
      rung: 'Rung 1 · Intuition',
      diagram: <TimeoutDiagram />,
      body: [
        'A **garbage-collection pause** (or a hypervisor pausing your VM, or swapping) can stop a healthy process dead for hundreds of milliseconds — sometimes seconds. Your code has no idea it was gone.',
        'So a node holding a lease can miss its heartbeats, get **declared dead**, then wake up mid-instruction still believing it’s the leader — a **zombie** about to corrupt state.',
      ],
    },
    {
      n: 'Step 04',
      title: 'You can’t detect death — only suspect it',
      accent: 'denim',
      rung: 'Rung 2 · Mechanism',
      body: [
        'Give up on *knowing* a node is down. The system decides by **quorum**: enough peers stop hearing heartbeats within a timeout, so they *declare* it dead and move on. It might be wrong — the node might be alive and slow — and that’s allowed.',
        'To make being-wrong safe, hand out **fencing tokens**: every time leadership changes, the number goes up, and the storage layer **rejects any write carrying an old token**. The zombie’s stale write bounces.',
      ],
      callout: {
        kind: 'good',
        big: 'fencing',
        text: 'Truth is defined by the **majority**, and a monotonic **fencing token** turns “we might be wrong about who’s alive” into “a stale leader simply can’t do damage.”',
      },
      deeper: {
        summary: 'Why a fencing token is the whole trick.',
        body: [
          'A lock service that just says “you have the lock” is not enough — the holder can pause, lose the lock, wake, and still act. The fix: the lock service returns a **monotonically increasing token** with each grant. The client attaches it to every write; the resource remembers the highest token it has seen and **refuses anything lower**. Now even a perfectly-timed zombie is harmless: its token is stale, so its write is refused. Detection can be imperfect as long as *action* is fenced.',
        ],
      },
    },
  ],
  bubbles: [
    { term: 'Timeout.', body: 'A guess that a peer is gone. Too short → false deaths; too long → slow failover.' },
    { term: 'Clock skew.', body: 'Two machines’ wall clocks disagreeing. Ordering events by timestamp is a trap.' },
    { term: 'Fencing token.', body: 'A number that only goes up; the resource rejects any write carrying an old one.' },
  ],
  misconception: {
    think: '“A timeout means the node is down.”',
    actually:
      'Actually — a timeout means you *stopped waiting*. The node may be alive and merely slow, paused, or partitioned away from you while happily serving others. You can never be certain, which is exactly why correctness rests on **majorities and fencing**, not on detecting death.',
  },
  sources: [
    {
      year: '1978',
      title: 'Time, Clocks, and the Ordering of Events — Lamport (CACM)',
      url: 'https://lamport.azurewebsites.net/pubs/time-clocks.pdf',
      note: 'Why physical time can’t order distributed events, and what to use instead.',
    },
    {
      year: '2016',
      title: 'How to do distributed locking — Kleppmann',
      url: 'https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html',
      note: 'The fencing-token argument in full — why a lock alone isn’t safe.',
    },
  ],
  seenIn: [
    { label: 'RabbitMQ — failure detection', to: '/components/rabbitmq', live: true },
    { label: 'Every simulation — fail a node', to: '/sims/feed', live: true },
  ],
  finale: {
    title: 'Fail a node and watch it recover',
    body: 'Every simulation has a “fail a node” button — push it and watch the system suspect, re-route, and heal. The RabbitMQ deep-dive shows where timeouts and heartbeats live in a real broker.',
  },
  next: { slug: 'consensus', title: 'Consistency & Consensus' },
}
