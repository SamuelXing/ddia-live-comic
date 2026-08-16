import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* One partition, which is the only unit in Kafka where anything is ordered,
   and two consumer groups sitting at very different places in the same bytes.
   The trace is arranged so that the reader watches the same file being read
   twice at different speeds — because that is the difference between a queue
   and a log, and it is the entire chapter.

   Violet for the segment files, because they are storage and this design
   insists they are storage rather than a buffer. Blue for producers and
   consumers. Amber only for ZooKeeper, which is the one piece of coordination
   in the picture and, tellingly, is not on the data path at all.

   Geometry: the corridor at x≈24 (between the producer zone and the log)
   carries the append down past the closed segments, and the corridor at x≈70
   (between the log and the consumers) carries the offset commits down past the
   consumer group that is not making them. */
const C = {
  client: VIZ.blue,
  seg: VIZ.violet,
  zk: VIZ.amber,
  bad: VIZ.red,
}

export const kafkaTrace: TraceSpec = {
  title: 'One file, two readers, and neither of them is the broker’s problem',
  aspect: 0.5,
  zones: [
    { label: 'Producers', x: 2, y: 4, w: 20, h: 42 },
    { label: 'One partition, on one broker', x: 26, y: 4, w: 42, h: 42 },
    { label: 'Consumer groups', x: 72, y: 4, w: 26, h: 42 },
  ],
  nodes: [
    { id: 'p1', x: 4, y: 12, w: 16, h: 8, label: 'Producers', sub: 'batch, do not wait', color: C.client },
    { id: 's1', x: 28, y: 9, w: 36, h: 7, label: 'segment 00000000', sub: 'closed · oldest', color: C.seg },
    { id: 's2', x: 28, y: 19, w: 36, h: 7, label: 'segment 00014517', sub: 'closed', color: C.seg },
    { id: 's3', x: 28, y: 29, w: 36, h: 7, label: 'segment 00030706', sub: 'open · appends land here', color: C.seg },
    { id: 'c1', x: 74, y: 10, w: 22, h: 8, label: 'Real-time', sub: 'reading at the tail', color: C.client },
    { id: 'c2', x: 74, y: 24, w: 22, h: 8, label: 'Hadoop', sub: 'six hours behind', color: C.client },
    { id: 'zk', x: 74, y: 37, w: 22, h: 7, label: 'ZooKeeper', sub: 'offsets, ownership', color: C.zk },
  ],
  steps: [
    {
      title: 'A write is an append to the end of a file. That is the whole storage layer.',
      prose:
        'The producer ships a <b>batch</b> — the API takes a set of messages, because one TCP round trip per message was never going to reach the throughput this needs. The broker appends the batch to the last segment file and does nothing else. <em>No index is built, no per-message record is created, no B-tree is touched.</em> The paper measured what that omission is worth: <b>9 bytes of overhead per message against ActiveMQ’s 144</b>, and 50,000 messages a second at batch size 1 rising to <b>400,000 at batch size 50</b>, which nearly saturated the gigabit link.',
      focus: ['p1', 's3'],
      particles: [{ from: 'p1', to: 's3', color: C.client, count: 3, via: [{ x: 24, y: 16 }, { x: 24, y: 32.5 }] }],
    },
    {
      title: 'A message has no id — it has a position',
      prose:
        'Every other messaging system gives a message an identifier and then needs a structure mapping identifiers to locations. Kafka addresses a message by its <b>offset in the log</b>, so the address <em>is</em> the location. The broker keeps a small in-memory list of the first offset in each segment file; a fetch is a binary search over that list and then a read at a byte position. <b>The ids are increasing but not consecutive</b> — the next one is this one plus this message’s length — which is a strange API until you see that it is what removes the index entirely.',
      focus: ['s1', 's2', 's3'],
      particles: [],
    },
    {
      title: 'Two groups, one file, six hours apart',
      prose:
        'Here is the difference between this and a queue. A real-time service is reading at the tail, milliseconds behind the producer. A Hadoop load is reading a segment written six hours ago. <em>They are reading the same bytes, at different speeds, and neither one knows the other exists.</em> Consumer groups are independent by construction — within a group each partition is owned by exactly one member, so no two consumers ever coordinate over a single partition. And this is a <b>pull</b> model: a consumer asks for what it can handle, so a slow reader falls behind rather than being flooded.',
      focus: ['s3', 'c1', 's2', 'c2'],
      particles: [
        { from: 's3', to: 'c1', color: C.seg, via: [{ x: 66, y: 32.5 }, { x: 66, y: 14 }] },
        { from: 's2', to: 'c2', color: C.seg },
      ],
    },
    {
      title: 'The broker forgets you the moment it answers',
      prose:
        'The decision the whole design rests on: <b>the broker keeps no per-consumer state.</b> It does not know who has read what, does not track acknowledgements, does not maintain delivery state per message. The consumer remembers <em>its own offset</em> and writes it to ZooKeeper. Compare what the alternatives were spending on this — in the same benchmark, one of ActiveMQ’s busiest threads was walking a B-tree to maintain message metadata, and its broker was writing to disk during a pure read test. <b>Kafka’s broker did no disk writes at all while being consumed.</b>',
      focus: ['c1', 'c2', 'zk'],
      particles: [
        { from: 'c1', to: 'zk', color: C.client, via: [{ x: 70, y: 14 }, { x: 70, y: 40.5 }] },
        { from: 'c2', to: 'zk', color: C.client },
      ],
    },
    {
      title: 'The bytes never enter the broker’s memory',
      prose:
        'Kafka does not cache messages in its own process — it relies on the operating system’s <b>page cache</b>, which avoids double buffering, survives a broker restart warm, and means a JVM-based broker has almost nothing to garbage collect. Then on the way out it uses <code>sendfile</code>, handing bytes straight from the file to the socket: <b>two fewer copies and one fewer system call</b> than the ordinary read-then-write path. Both producer and consumer touch the file sequentially, so the kernel’s read-ahead and write-through heuristics do exactly the right thing. <em>Performance stays linear into the terabytes, which is what makes the next step affordable.</em>',
      focus: ['s2', 's3', 'c1'],
      particles: [
        { from: 's3', to: 'c1', color: C.seg, count: 3, via: [{ x: 66, y: 32.5 }, { x: 66, y: 14 }] },
      ],
    },
    {
      title: 'The consumer had a bug, so it winds itself backwards',
      prose:
        'The Hadoop job crashed halfway through and lost what it had not flushed. In a queue this is a catastrophe: the messages were acknowledged and are gone. Here the consumer simply <b>sets its offset back</b> and reads the same bytes again — the broker is not consulted about whether this is allowed, because the broker has no opinion. <em>Rewinding is free precisely because nothing was tracking consumption.</em> The paper calls this an essential feature rather than a curiosity: fix the bug, replay the day, and the output is correct.',
      focus: ['c2', 's1', 's2'],
      particles: [
        { from: 'c2', to: 'zk', color: C.client },
        { from: 's1', to: 'c2', color: C.seg, count: 2 },
      ],
    },
    {
      title: 'After seven days the oldest file is deleted, read or not',
      prose:
        'Since nobody knows who has consumed what, retention cannot be based on consumption. So it is based on <b>time</b> — a message is deleted when it is older than the policy, typically <b>seven days</b>, whether or not anybody ever read it. That is either alarming or liberating depending on which system you came from, and it is only affordable because throughput does not degrade with accumulated data. <em>And notice what it does to the contract:</em> a consumer that has been down for eight days has lost data, so “how far behind can you be” becomes a number you must actually choose.',
      focus: ['s1', 'p1', 's3'],
      particles: [
        { from: 'p1', to: 's3', color: C.client, via: [{ x: 24, y: 16 }, { x: 24, y: 32.5 }] },
        { from: 's1', to: 's2', color: C.bad },
      ],
    },
  ],
}
