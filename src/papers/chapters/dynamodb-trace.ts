import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* One write into DynamoDB in 2022, drawn so that Chapter 6's picture can be
   held next to it. In 2007 the same write went to whichever node happened to
   pick it up, and the reader was left holding the reconciliation. Here it is
   metered at the door, ordered by an elected leader, acknowledged by two of
   three replicas in different zones, and then checked for the rest of its life.

   Amber for the leader, matching Spanner in Chapter 11 — a Paxos leader is
   coordination machinery, and the whole point of this chapter is that the
   machinery came back. Green for the storage replicas and the archive, because
   they hold the bytes. Violet for the log replica: it is replication with no
   storage, which is exactly the category violet has carried since Chapter 8.
   Blue for the front door. Red only where something is actually wrong.

   Admission control is deliberately NOT a node. The GAC service vends tokens
   to request routers every few seconds; it is not on the per-request path, and
   drawing a hop to it would say something false about the write. The router's
   token bucket is local, which is why it lives in the router's own label.

   Geometry: the corridor at x≈60 — right of the replica boxes, inside the
   partition zone — carries the leader's reach past the two followers down to
   the log replica, and back. Nothing else needs routing; the front door is a
   plain vertical chain and the archive sits clear to the right. */
const C = {
  door: VIZ.blue,
  leader: VIZ.amber,
  replica: VIZ.green,
  logrep: VIZ.violet,
  bad: VIZ.red,
}

export const dynamodbTrace: TraceSpec = {
  title: 'One write, metered at the door and then watched for the rest of its life',
  aspect: 0.5,
  zones: [
    { label: 'The front door', x: 2, y: 4, w: 25, h: 42 },
    { label: 'One partition, 3 AZs', x: 31, y: 4, w: 32, h: 42 },
    { label: 'What watches it', x: 67, y: 4, w: 31, h: 42 },
  ],
  nodes: [
    { id: 'app', x: 4, y: 10, w: 21, h: 8, label: 'Your write', sub: 'PutItem · 1 KB', color: C.door },
    { id: 'rtr', x: 4, y: 22, w: 21, h: 8, label: 'Request router', sub: 'token bucket · auth', color: C.door },
    { id: 'memds', x: 4, y: 34, w: 21, h: 8, label: 'MemDS', sub: 'who owns this key', color: C.door },
    { id: 'lead', x: 33, y: 9, w: 24, h: 7, label: 'Leader · AZ 1', sub: 'Paxos lease', color: C.leader },
    { id: 'f1', x: 33, y: 19, w: 24, h: 7, label: 'Follower · AZ 2', sub: 'log + B-tree', color: C.replica },
    { id: 'f2', x: 33, y: 29, w: 24, h: 7, label: 'Follower · AZ 3', sub: 'log + B-tree', color: C.replica },
    { id: 'logr', x: 33, y: 38, w: 24, h: 7, label: 'Log replica', sub: 'recent log only', color: C.logrep },
    { id: 's3', x: 69, y: 12, w: 27, h: 8, label: 'Log archive · S3', sub: 'checked on the way in', color: C.replica },
    { id: 'scrub', x: 69, y: 28, w: 27, h: 8, label: 'Scrub', sub: 'rebuilt from day one', color: C.leader },
  ],
  steps: [
    {
      title: 'Before it is stored, it is counted',
      prose:
        'A request router authenticates the call and spends a token from a bucket it holds locally — <b>time-limited tokens, topped up every few seconds from a central service that tracks the whole table’s consumption</b>. Then it asks MemDS which partition owns the hash of the key. Both halves are new since 2007 and both exist for the same reason: <em>this machine is shared with strangers.</em> The 2007 ring had no admission control because every installation belonged to one team, and a team that overloaded itself had only itself to answer to.',
      focus: ['app', 'rtr', 'memds'],
      particles: [
        { from: 'app', to: 'rtr', color: C.door },
        { from: 'rtr', to: 'memds', color: C.door },
        { from: 'memds', to: 'rtr', color: C.door },
      ],
    },
    {
      title: 'And here is the whole retreat, in one arrow',
      prose:
        'The write goes to <b>the leader</b>. Not to a coordinator that happens to be nearby, not to the first healthy nodes on a ring — to the one replica that has won a Multi-Paxos election and is holding a lease on it. <em>Only the leader may accept a write, and only the leader may serve a strongly consistent read.</em> Chapter 6 spent its entire length on how to avoid needing this. Fifteen years later the same organisation put it back, and the paper says so plainly: DynamoDB shares most of the name of the earlier system <b>and little of its architecture</b>.',
      focus: ['rtr', 'lead'],
      particles: [{ from: 'rtr', to: 'lead', color: C.door }],
    },
    {
      title: 'Two out of three, in different buildings',
      prose:
        'The leader writes a log record and sends it to its peers. The write is acknowledged to the application <b>once a quorum has it durably</b> — and a healthy write quorum here means two of the three replicas, each in a different Availability Zone. Notice what is not happening: no version vector, no sibling, nothing for the caller to reconcile. <em>The order was decided in one place, so there is only ever one answer.</em> That is what the leader is for, and it is the entire difference between this picture and Chapter 6’s.',
      focus: ['lead', 'f1', 'f2', 'app'],
      particles: [
        { from: 'lead', to: 'f1', color: C.leader },
        { from: 'lead', to: 'f2', color: C.leader, via: [{ x: 60, y: 12.5 }, { x: 60, y: 32.5 }] },
        { from: 'f1', to: 'lead', color: C.replica },
        { from: 'lead', to: 'app', color: C.leader },
      ],
    },
    {
      title: 'A replica goes quiet, and the repair is not a new copy',
      prose:
        'One follower stops answering, so the group is down to two and every write is now one failure from being stuck. Healing a storage replica means copying the B-tree <em>and</em> the write-ahead logs, which takes <b>several minutes</b>. So the leader does something cheaper first: it adds a <b>log replica</b> — a member that holds only recent log entries and no key-value data at all, an acceptor in the Paxos sense. Copying that takes <b>seconds</b>. The quorum is whole again long before the real repair finishes, and Amazon runs <em>millions</em> of these groups in a single Region.',
      focus: ['lead', 'f2', 'logr'],
      particles: [
        { from: 'lead', to: 'f2', color: C.bad, via: [{ x: 60, y: 12.5 }, { x: 60, y: 32.5 }] },
        { from: 'lead', to: 'logr', color: C.logrep, via: [{ x: 60, y: 12.5 }, { x: 60, y: 41.5 }] },
        { from: 'logr', to: 'lead', color: C.logrep, via: [{ x: 60, y: 41.5 }, { x: 60, y: 12.5 }] },
      ],
    },
    {
      title: 'The failure that is worse than a dead node',
      prose:
        'Now a subtler fault: the leader is fine, but one follower cannot hear it. Heartbeats stop arriving, so that follower concludes the leader is dead and calls an election — and a <b>new leader cannot serve anything until the old lease expires</b>, which is a couple of seconds of unavailability caused by nothing being broken. The fix is one message. Before triggering a failover, the follower <b>asks the other replicas whether they can still reach the leader</b>, and drops the attempt if they can. <em>A gray failure is a disagreement about health, so the cure is to take a second opinion.</em>',
      focus: ['f2', 'f1', 'lead'],
      particles: [
        { from: 'f2', to: 'f1', color: C.bad },
        { from: 'f1', to: 'f2', color: C.replica },
      ],
    },
    {
      title: 'The log leaves the building',
      prose:
        'Write-ahead logs live on all three replicas, and are periodically <b>archived to S3</b> — the object store designed for eleven nines. Only a few hundred megabytes of log is typically waiting to be archived at any moment. The archiving agent is paranoid on purpose: before uploading it verifies that <em>every entry belongs to the table and partition it claims</em>, that the checksums hold, and that there are <b>no holes in the sequence numbers</b>. Agents run on all three replicas, and one that finds the file already uploaded downloads it back and compares it against its own local log.',
      focus: ['lead', 'f1', 's3'],
      particles: [
        { from: 'lead', to: 's3', color: C.replica },
        { from: 'f1', to: 's3', color: C.replica },
      ],
    },
    {
      title: 'And then it is checked against a copy of itself built from scratch',
      prose:
        'The scrub process asks two questions, forever. First, do all three replicas hold the same data. Second — and this is the one worth stealing — <b>does the live data match a replica rebuilt offline from the archived log, starting at the table’s inception?</b> Not from a recent snapshot: from the beginning. A bug that corrupted a page in 2019 and a bit that rotted last night both fail the same comparison. The paper’s own summary, after a decade of running it: <em>continuous verification of data at rest is the most reliable way they have found</em> to protect against hardware faults, silent corruption <b>and their own software.</b>',
      focus: ['s3', 'scrub', 'lead'],
      particles: [
        { from: 's3', to: 'scrub', color: C.replica },
        { from: 'scrub', to: 'lead', color: C.leader },
      ],
    },
  ],
}
