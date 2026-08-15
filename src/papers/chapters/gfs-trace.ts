import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* Role semantics as everywhere else: client blue, the coordinator amber,
   anything holding bytes violet, the failure red.

   Geometry: three zones, chunkservers stacked in the right one. Two empty
   corridors are load-bearing — x≈93 (right of the servers) carries the
   primary's forward to the far replica, x≈55.5 (left of them) carries the
   far replica's ack back. Without them those routes run straight through
   the replica in between, which the lint catches. The top row y 8–15 is
   kept clear across the whole canvas so the client can reach the primary
   without crossing the master, and the stack starts at y 8 rather than 6
   so the first node does not sit on the zone's own caption. */
const C = {
  client: VIZ.blue,
  master: VIZ.amber,
  data: VIZ.violet,
  bad: VIZ.red,
}

export const gfsAppendTrace: TraceSpec = {
  title: 'One record append — and the retry that explains the whole consistency model',
  aspect: 0.5,
  zones: [
    { label: 'Client', x: 2, y: 4, w: 21, h: 42 },
    /* Zone captions are set in wide-tracked caps and are not measured by the
       geometry lint (it only reads SVG), so they are budgeted by hand: at this
       canvas width a caption runs past its zone somewhere around 18 characters,
       and the next zone's caption is right there. Longer labels ran together
       into one unreadable string. What each zone *means* is carried by the node
       subtitles instead. */
    { label: 'Master', x: 26, y: 4, w: 23, h: 42 },
    { label: 'Chunkservers ×3', x: 52, y: 4, w: 45, h: 42 },
  ],
  nodes: [
    { id: 'app', x: 4, y: 8, w: 17, h: 8, label: 'Your app', sub: 'GFS client library', color: C.client },
    { id: 'master', x: 28.5, y: 27, w: 18, h: 9, label: 'Master', sub: 'chunk map, in RAM', color: C.master },
    { id: 'csA', x: 58.5, y: 8, w: 32, h: 7, label: 'Chunkserver A', sub: 'primary — holds the lease', color: C.data },
    { id: 'csB', x: 58.5, y: 18, w: 32, h: 7, label: 'Chunkserver B', sub: 'replica', color: C.data },
    { id: 'csC', x: 58.5, y: 28, w: 32, h: 7, label: 'Chunkserver C', sub: 'replica', color: C.data },
    { id: 'csD', x: 58.5, y: 38, w: 32, h: 7, label: 'Chunkserver D', sub: 'empty — has room', color: C.data },
  ],
  steps: [
    {
      title: 'Ask the master once, then never again',
      prose:
        'The client wants to append a record to a file. It asks the master a single question — <b>which chunk is the last one, who holds a copy, and which of them currently holds the lease</b> — and caches the answer for the next several appends. Notice what does <em>not</em> come back: any data. The master returns names and addresses, and that is the entire reason one machine can front a petabyte.',
      focus: ['app', 'master'],
      particles: [
        { from: 'app', to: 'master', color: C.client },
        { from: 'master', to: 'app', color: C.master },
      ],
    },
    {
      title: 'Push the bytes down a chain, not out in a star',
      prose:
        'The data goes to all three replicas — but the client does not send it three times. It sends it <b>once</b>, to whichever replica is nearest on the network; that machine forwards to the next while still receiving, and so on. The paper is explicit about why: “data is pushed linearly along a carefully picked chain of chunkservers <em>in a pipelined fashion</em>”, so every machine spends its <em>full</em> outbound bandwidth on forwarding instead of splitting it three ways.',
      focus: ['app', 'csA', 'csB', 'csC'],
      particles: [
        { from: 'app', to: 'csA', color: C.data, count: 2 },
        { from: 'csA', to: 'csB', color: C.data, count: 2 },
        { from: 'csB', to: 'csC', color: C.data, count: 2 },
      ],
    },
    {
      title: 'The control message — and the decision that names the paper',
      prose:
        'Only now does the client say <b>“append it.”</b> And here is the move: <em>it does not say where.</em> A traditional write names an offset, so two clients appending at once both compute the same end-of-file and one silently lands on top of the other. In a <b>record append</b> the client supplies only the bytes, and <b>the primary picks the offset</b> — a single machine, deciding an order for everyone. Hundreds of crawlers can append to one file with no lock manager anywhere.',
      focus: ['app', 'csA'],
      particles: [{ from: 'app', to: 'csA', color: C.client }],
    },
    {
      title: 'The primary hands down the order it chose',
      prose:
        'The primary applies the record at the offset it picked, then tells the secondaries to apply <em>that same offset</em>. Every replica ends up with the same bytes in the same places because one machine serialised the decision and the others merely obeyed. This is the whole of GFS’s agreement story — no votes, no quorum, just a lease saying <em>you are the one who decides, for the next sixty seconds</em>.',
      focus: ['csA', 'csB', 'csC'],
      particles: [
        { from: 'csA', to: 'csB', color: C.data },
        { from: 'csA', to: 'csC', color: C.data, via: [{ x: 93, y: 13 }, { x: 93, y: 29 }] },
      ],
    },
    {
      title: 'Acks up the chain, and the offset comes back',
      prose:
        'The secondaries report success to the primary, the primary reports to the client, and the client gets <b>the offset the record landed at</b>. One round trip to the master, amortised over many appends; one pipelined data push; one control message. The bytes crossed the network once per replica, which is the floor.',
      focus: ['csB', 'csC', 'csA', 'app'],
      particles: [
        { from: 'csB', to: 'csA', color: C.data },
        { from: 'csC', to: 'csA', color: C.data, via: [{ x: 55.5, y: 29 }, { x: 55.5, y: 13 }] },
        { from: 'csA', to: 'app', color: C.client },
      ],
    },
    {
      title: 'Now break it: one replica misses, and the client retries',
      prose:
        'Chunkserver C fails its part of the append. The primary reports failure, and the client does the obvious thing — <b>it retries</b>. The retry succeeds everywhere. But A and B already had the record from the first attempt, so they now hold it <b>twice</b>, while C holds junk where the failure landed and the record after it. Replicas of the same chunk are no longer byte-identical, and GFS does not go back and fix them. <em>That is the design.</em> The guarantee is that the record is there <b>at least once</b>, at some offset, in every replica.',
      focus: ['app', 'csA', 'csB', 'csC'],
      particles: [
        { from: 'csC', to: 'csA', color: C.bad, via: [{ x: 55.5, y: 29 }, { x: 55.5, y: 13 }] },
        { from: 'app', to: 'csA', color: C.bad },
        { from: 'csA', to: 'csB', color: C.bad },
        { from: 'csA', to: 'csC', color: C.bad, via: [{ x: 93, y: 13 }, { x: 93, y: 29 }] },
      ],
    },
    {
      title: 'Kill a machine — the master schedules, it does not carry',
      prose:
        'Chunkserver C stops sending heartbeats. The master notices a chunk is down to two copies and issues one instruction: <b>D, copy this chunk from A.</b> The bytes travel between chunkservers; the master only ever said a sentence. Replay the whole trace and count what crossed the master: two small messages at the start. <b>That is what makes a single master survivable</b> — not that it is reliable, but that it is not in the way.',
      focus: ['master', 'csD', 'csA', 'csC'],
      particles: [
        { from: 'master', to: 'csD', color: C.master },
        { from: 'csA', to: 'csD', color: C.data, via: [{ x: 93, y: 13 }, { x: 93, y: 40 }], count: 2 },
      ],
    },
  ],
}
