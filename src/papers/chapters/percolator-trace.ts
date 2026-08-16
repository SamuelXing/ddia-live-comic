import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* The paper's Figure 4, animated: seven dollars from Bob to Joe, which is the
   smallest transaction anybody has ever needed and is genuinely impossible on
   the store underneath. Two rows. Bigtable will make either one of them atomic
   and has never heard of the other.

   Blue for the client processes, because in this design the client IS the
   coordinator — there is no transaction manager anywhere in this picture, and
   the absence is the chapter. Amber for the timestamp oracle, the one central
   thing that survived. Green for the Bigtable rows, which are a store.

   Geometry: the corridor at x≈37.5 (between the client zone and the Bigtable
   zone) carries the traffic that must not cut through the row it is not
   addressed to — the transfer's reach down to Joe, and the later transaction's
   reach up to Bob. */
const C = {
  client: VIZ.blue,
  oracle: VIZ.amber,
  row: VIZ.green,
  bad: VIZ.red,
}

export const percolatorTrace: TraceSpec = {
  title: 'Seven dollars, two rows, and a store that has never heard of a transaction',
  aspect: 0.5,
  zones: [
    { label: 'The client', x: 2, y: 4, w: 33, h: 42 },
    { label: 'Bigtable — one row at a time', x: 40, y: 4, w: 57, h: 42 },
  ],
  nodes: [
    { id: 'txn', x: 4, y: 9, w: 29, h: 9, label: 'The transfer', sub: 'a library, on some worker', color: C.client },
    { id: 'oracle', x: 4, y: 22, w: 29, h: 8, label: 'Timestamp oracle', sub: 'strictly increasing · ~2M/s', color: C.oracle },
    { id: 'other', x: 4, y: 34, w: 29, h: 8, label: 'A later transaction', sub: 'finds what got left behind', color: C.client },
    { id: 'bob', x: 42, y: 11, w: 53, h: 10, label: 'row: Bob · bal', sub: 'data | lock | write', color: C.row },
    { id: 'joe', x: 42, y: 27, w: 53, h: 10, label: 'row: Joe · bal', sub: 'data | lock | write', color: C.row },
  ],
  steps: [
    {
      title: 'Ask the one central thing in the design for a number',
      prose:
        'Bob has $10, Joe has $2, and the transfer needs both rows to change or neither. The store will not do that. So the transaction starts by asking the <b>timestamp oracle</b> for a start stamp — say <b>7</b> — and that number defines everything it will see: <em>every read in this transaction is a Bigtable lookup at a stamp of 7 or below.</em> The snapshot is fixed before a single byte is read. One machine hands out these stamps, in strictly increasing order, at around <b>two million a second</b>, because workers batch their requests into one pending call at a time.',
      focus: ['txn', 'oracle'],
      particles: [
        { from: 'txn', to: 'oracle', color: C.client },
        { from: 'oracle', to: 'txn', color: C.oracle },
      ],
    },
    {
      title: 'Lock Bob — and nominate that lock as the whole transaction',
      prose:
        'Now <b>prewrite</b>. In one Bigtable row transaction the client checks Bob’s row for any write newer than stamp 7 (abort — that is the write-write conflict) and for any lock at all (abort — somebody else is mid-flight), then writes the new balance to <code>bal:data</code> at stamp 7 and a lock to <code>bal:lock</code>. <em>The lock is a column, sitting beside the data it protects.</em> That placement is the trick: checking and locking are one atomic row operation, which is exactly the one operation Bigtable offers. And this first lock is marked <b>primary</b>.',
      focus: ['txn', 'bob'],
      particles: [{ from: 'txn', to: 'bob', color: C.client }],
    },
    {
      title: 'Lock Joe — and have that lock point back at Bob',
      prose:
        'Same check, same write, one difference: Joe’s lock is a <b>secondary</b>, and it carries the address of the primary — literally the string <code>Bob.bal</code>. A transaction touching five rows has one primary and four secondaries, and every secondary knows where the primary lives. <em>Nothing so far is committed.</em> Two rows now hold speculative data and two locks, and if the client vanished this instant the transfer would never have happened.',
      focus: ['txn', 'joe'],
      particles: [{ from: 'txn', to: 'joe', color: C.client, via: [{ x: 37.5, y: 20 }, { x: 37.5, y: 32 }] }],
    },
    {
      title: 'Erase the primary lock — and that single row write is the commit',
      prose:
        'Get a commit stamp (<b>8</b>) from the oracle. Then, in <b>one Bigtable row transaction on Bob’s row</b>, check the primary lock is still yours, erase it, and write a record to <code>bal:write</code> at stamp 8 pointing back at the data at stamp 7. <em>That row operation is the commit point of the entire transaction.</em> Before it, nothing happened. After it, everything did — including the change to Joe, which has not been touched yet and whose row still says nothing is committed. <b>The durability of a multi-row transaction rests entirely on the atomicity of one row.</b>',
      focus: ['txn', 'oracle', 'bob'],
      particles: [
        { from: 'txn', to: 'oracle', color: C.oracle },
        { from: 'txn', to: 'bob', color: C.row },
      ],
    },
    {
      title: 'Tidy up Joe — which is bookkeeping, not deciding',
      prose:
        'The client now walks the secondaries and does the same swap: write record in, lock out. This phase looks identical to the last one and means something completely different. <em>Nothing here can change the outcome</em> — the transfer committed at stamp 8 and this is just making the fact locally visible. Which is precisely why the next two steps are survivable: anybody who finds a half-finished transaction can look at the primary and know which way it went.',
      focus: ['txn', 'joe'],
      particles: [{ from: 'txn', to: 'joe', color: C.row, via: [{ x: 37.5, y: 20 }, { x: 37.5, y: 32 }] }],
    },
    {
      title: 'A reader arrives mid-flight and hits the lock',
      prose:
        'Rewind to between steps 3 and 4. Another transaction reads Joe’s row, finds a lock at or below its own start stamp, and <b>must not read the data underneath it</b> — that value may be about to be committed or about to be abandoned, and it has no way to tell by looking. So it backs off and waits. This is the honest cost of putting locks in the data: <em>a reader of an untouched value pays nothing, and a reader that lands on an in-flight cell blocks</em>. In an indexing pipeline that is fine. In a checkout path it would not be.',
      focus: ['other', 'joe'],
      particles: [{ from: 'other', to: 'joe', color: C.client }],
    },
    {
      title: 'The client dies holding the locks — and the primary settles it',
      prose:
        'Now the failure the whole design is shaped around: the client crashes between steps 4 and 5. Joe’s row keeps a lock nobody will ever release, and the process that would have cleaned it up no longer exists. So the <em>next</em> transaction to trip over that lock does the work. It follows the pointer to <code>Bob.bal</code> and looks: <b>a write record there means the transaction committed</b>, so roll Joe forward; <b>a lock still there means it did not</b>, so erase both. Cleanup and commit both go through the primary’s row, so exactly one of them wins. <em>Nobody is in charge, and the outcome is still unambiguous.</em>',
      focus: ['other', 'joe', 'bob'],
      particles: [
        { from: 'other', to: 'joe', color: C.bad },
        { from: 'other', to: 'bob', color: C.client, via: [{ x: 37.5, y: 38 }, { x: 37.5, y: 16 }] },
      ],
    },
  ],
}
