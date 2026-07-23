import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* Colors: clients blue, routing machinery amber, queue-as-data violet,
   disk/store green, alarms & danger red, cross-DC links cyan. */
const C = {
  client: VIZ.blue,
  machine: VIZ.amber,
  queue: VIZ.violet,
  store: VIZ.green,
  danger: VIZ.red,
  edge: VIZ.cyan,
}

export const publishTrace: TraceSpec = {
  title: 'Trace a publish — exchange, bindings, queue, ack',
  aspect: 0.5,
  zones: [
    { label: 'Producer side', x: 2, y: 4, w: 21, h: 42 },
    { label: 'The broker', x: 27, y: 4, w: 45, h: 42 },
    { label: 'Consumer side', x: 76, y: 4, w: 22, h: 42 },
  ],
  nodes: [
    { id: 'prod', x: 4.5, y: 9, w: 16, h: 7, label: 'Producer', sub: 'basic.publish', color: C.client },
    { id: 'chan', x: 4.5, y: 21, w: 16, h: 8, label: 'Channel', sub: 'multiplexed on one TCP', color: C.client },
    { id: 'ex', x: 29.5, y: 8, w: 17, h: 8, label: 'Exchange', sub: 'topic: orders.#', color: C.machine },
    { id: 'bind', x: 51, y: 8, w: 18, h: 8, label: 'Bindings', sub: 'trie match → queues', color: C.machine },
    { id: 'qproc', x: 29.5, y: 21, w: 17, h: 8, label: 'Queue process', sub: 'one Erlang actor', color: C.queue },
    { id: 'store', x: 51, y: 21, w: 18, h: 8, label: 'Message store', sub: 'fsync if persistent', color: C.store },
    { id: 'credit', x: 29.5, y: 35, w: 17, h: 7.5, label: 'Credit flow', sub: 'backpressure per hop', color: C.danger },
    { id: 'unack', x: 51, y: 35, w: 18, h: 7.5, label: 'Unacked tracking', sub: 'per delivery tag', color: C.machine },
    { id: 'cons', x: 78, y: 9, w: 18, h: 8, label: 'Consumer', sub: 'prefetch = 30', color: C.client },
    { id: 'dlx', x: 78, y: 22, w: 18, h: 8, label: 'Dead-letter exchange', sub: 'rejected & expired', color: C.machine },
  ],
  steps: [
    {
      title: 'Publish on a channel',
      prose:
        'The producer publishes over a <b>channel</b> — a lightweight session multiplexed onto one long-lived TCP connection (connections are expensive here; channels are how you get concurrency without paying for sockets). With <b>publisher confirms</b> on, the broker will ack this publish asynchronously once the message is safe — the producer&apos;s only durability signal, so production code always turns it on.',
      focus: ['prod', 'chan'],
      particles: [{ from: 'prod', to: 'chan', color: C.client }],
    },
    {
      title: 'The exchange — routing as a first-class object',
      prose:
        'The message arrives at an <b>exchange</b> with a routing key like <code>orders.eu.created</code>. The producer knows <em>nothing about queues</em> — who consumes, how many copies, whether anyone is listening. That indirection is the heart of the smart-broker bet: topology lives in the broker, so producers and consumers evolve independently.',
      focus: ['chan', 'ex'],
      particles: [{ from: 'chan', to: 'ex', color: C.client, via: [{ x: 25, y: 25 }, { x: 25, y: 12 }] }],
    },
    {
      title: 'Binding match',
      prose:
        'The exchange consults its <b>bindings</b> — for a topic exchange, a trie of patterns (<code>orders.#</code>, <code>*.eu.*</code>) matched against the routing key; fanout copies to every bound queue; direct matches exactly; headers match on metadata. This routing work is paid <b>per message, broker-side</b> — flexibility Kafka simply refuses to offer, at a per-message cost Kafka refuses to pay.',
      focus: ['ex', 'bind'],
      particles: [{ from: 'ex', to: 'bind', color: C.machine }],
    },
    {
      title: 'Into the queue process',
      prose:
        'Each matched queue is <b>one Erlang process</b> — an actor with a mailbox, processing messages strictly in order. FIFO comes free from the actor model, and so does the ceiling that defines Chapter 3: <em>one queue can never use more than one core</em>. Sixteen consumers on one queue still share one sequential process.',
      focus: ['bind', 'qproc'],
      particles: [{ from: 'bind', to: 'qproc', color: C.queue }],
    },
    {
      title: 'Persistence, if you asked',
      prose:
        'A persistent message on a durable queue is written to the <b>message store</b> (batched fsyncs), and only then is the publisher&apos;s confirm released. For <b>quorum queues</b> the bar is higher still: the message is a Raft log entry, confirmed after a <em>majority of replicas</em> fsync it. Durability here is per-message and explicit — and each level of it costs throughput (Chapter 3 prices it).',
      focus: ['qproc', 'store'],
      particles: [{ from: 'qproc', to: 'store', color: C.store }],
    },
    {
      title: 'Credit — backpressure by design',
      prose:
        'Every hop grants <b>credit</b> to the previous one: bindings to channels, queues to bindings. A queue that can&apos;t keep up stops granting; the channel stops reading its socket; TCP pushes back to the producer. RabbitMQ <em>slows publishers down</em> rather than dropping or endlessly buffering — the polite version of what Chapter 2&apos;s second trace shows happening rudely.',
      focus: ['credit', 'qproc'],
      particles: [{ from: 'qproc', to: 'credit', color: C.danger }],
    },
    {
      title: 'Push to the consumer, bounded by prefetch',
      prose:
        'The broker <b>pushes</b> deliveries to consumers (Kafka&apos;s consumers pull — the inversions keep stacking). <b>Prefetch</b> caps how many unacked messages a consumer may hold: too low and it starves waiting on round-trips; unlimited and one consumer hoards the whole backlog while its peers idle. Per-consumer prefetch is the single most important client-side knob.',
      focus: ['qproc', 'cons'],
      particles: [{ from: 'qproc', to: 'cons', color: C.queue, via: [{ x: 48.75, y: 18.5 }, { x: 74.5, y: 18.5 }, { x: 74.5, y: 13 }] }],
    },
    {
      title: 'Ack — and the message dies',
      prose:
        'The consumer processes and sends <code>basic.ack</code> with its delivery tag; the broker clears it from <b>unacked tracking</b> and the message is <b>deleted</b>. This is the defining queue semantic: a message is a <em>task</em>, consumed once and gone — not Kafka&apos;s log entry that outlives its readers. No replay, no second consumer group, no reprocessing last Tuesday. (Streams, in Chapter 7, are Rabbit&apos;s answer when you want that back.)',
      focus: ['cons', 'unack', 'qproc'],
      particles: [{ from: 'cons', to: 'unack', color: C.client }],
    },
    {
      title: 'Reject → dead letter',
      prose:
        'If the consumer <code>nack</code>s with <code>requeue=false</code> — or the message expires (TTL) or overflows <code>max-length</code> — it routes to the <b>dead-letter exchange</b> instead of vanishing: the escape hatch for poison messages and the building block for retry-with-backoff topologies. Skip configuring it and a failing message redelivers forever, burning a queue&apos;s one core on a task that will never succeed (Chapter 8).',
      focus: ['cons', 'dlx'],
      particles: [{ from: 'cons', to: 'dlx', color: C.machine }],
    },
  ],
}

export const beamTrace: TraceSpec = {
  title: 'The queue is a process — BEAM, backlog, and the alarm',
  aspect: 0.5,
  zones: [
    { label: 'Publishers', x: 2, y: 4, w: 21, h: 42 },
    { label: 'One broker node (BEAM VM)', x: 27, y: 4, w: 45, h: 42 },
    { label: 'The cliff edge', x: 76, y: 4, w: 22, h: 42 },
  ],
  nodes: [
    { id: 'pubs', x: 4.5, y: 9, w: 16, h: 8, label: 'Publisher fleet', sub: 'thousands of channels', color: C.client },
    { id: 'sched', x: 29.5, y: 8, w: 17, h: 8, label: 'BEAM schedulers', sub: 'one per core', color: C.machine },
    { id: 'q1', x: 51, y: 8, w: 18, h: 8, label: 'queue: orders', sub: 'one process, one core', color: C.queue },
    { id: 'q2', x: 51, y: 21, w: 18, h: 8, label: 'queue: emails', sub: 'another process, in parallel', color: C.queue },
    { id: 'ram', x: 29.5, y: 21, w: 17, h: 8, label: 'Process heaps', sub: 'backlog lives here', color: C.store },
    { id: 'page', x: 29.5, y: 35, w: 17, h: 7.5, label: 'Paging to disk', sub: 'message store v2', color: C.store },
    { id: 'alarm', x: 51, y: 35, w: 18, h: 7.5, label: 'Memory alarm', sub: 'vm_memory_high_watermark', color: C.danger },
    { id: 'blocked', x: 78, y: 9, w: 18, h: 8.5, label: 'Publishers blocked', sub: 'cluster-wide, all of them', color: C.danger },
    { id: 'drain', x: 78, y: 22, w: 18, h: 8, label: 'Consumers drain', sub: 'deliveries continue', color: C.client },
    { id: 'ok', x: 78, y: 35, w: 18, h: 7.5, label: 'Alarm clears', sub: 'below the watermark', color: C.store },
  ],
  steps: [
    {
      title: 'An actor per queue',
      prose:
        'RabbitMQ runs on the <b>BEAM</b> — Erlang&apos;s VM, built for telephone switches: millions of lightweight processes, preemptively scheduled across <b>one scheduler per core</b>. Every queue, channel, and connection is such a process. The design gift: isolation and FIFO for free. The design bill: <em>one queue is one process</em>, and a process runs on one core at a time.',
      focus: ['pubs', 'sched', 'q1'],
      particles: [
        { from: 'pubs', to: 'sched', color: C.client, count: 2 },
        { from: 'sched', to: 'q1', color: C.queue },
      ],
    },
    {
      title: 'Queues in parallel',
      prose:
        'The saving grace Redis doesn&apos;t have: RabbitMQ parallelizes <b>across queues</b>. A hundred queues spread across sixteen cores use them all — the broker scales with queue count, which is why Chapter 5&apos;s answer to nearly everything is &ldquo;more queues.&rdquo; But no amount of hardware helps <em>within</em> one queue; that ceiling is architectural.',
      focus: ['q1', 'q2', 'sched'],
      particles: [{ from: 'sched', to: 'q2', color: C.queue }],
    },
    {
      title: 'A healthy queue is empty',
      prose:
        'RabbitMQ&apos;s design assumption — the exact opposite of Kafka&apos;s — is that messages <b>flow through</b>: published, delivered, acked, deleted within milliseconds. RAM holds only what&apos;s in flight. A queue with a standing backlog isn&apos;t a buffer doing its job; it&apos;s an incident with a slow fuse.',
      focus: ['q1', 'ram'],
    },
    {
      title: 'Backlog — the poison',
      prose:
        'Now consumers slow down (a deploy, a dependency, a vacation). Publishes keep landing, and every unconsumed message sits in <b>process heaps</b> — with per-message bookkeeping on top of the payload. Erlang GC pressure grows with heap size, so the queue process itself gets slower <em>as</em> it gets fuller. The debt compounds, quietly.',
      focus: ['pubs', 'ram'],
      particles: [{ from: 'pubs', to: 'ram', color: C.danger, via: [{ x: 25, y: 13 }, { x: 25, y: 25 }] }],
    },
    {
      title: 'Paging buys time, costs latency',
      prose:
        'The broker defends its RAM by <b>paging</b> messages to disk (the v2 message store does this aggressively; &ldquo;lazy queues&rdquo; made it the default posture in 3.12+). It works — millions of messages can wait on disk — but the queue is now doing disk I/O <em>inside</em> its one sequential process. Throughput drops exactly when you need it most.',
      focus: ['ram', 'page'],
      particles: [{ from: 'ram', to: 'page', color: C.store }],
    },
    {
      title: 'The alarm',
      prose:
        'Memory keeps climbing past <code>vm_memory_high_watermark</code> — <b>40% of RAM by default</b>. The broker declares a <b>memory alarm</b>. This is not a log line; it is a cluster-wide state change, and what happens next is the most famous behavior in RabbitMQ operations.',
      focus: ['ram', 'alarm'],
      particles: [{ from: 'ram', to: 'alarm', color: C.danger }],
    },
    {
      title: 'Everyone stops',
      prose:
        'The alarm <b>blocks every publishing connection on every node</b> — not just to the bloated queue, to <em>all</em> queues. One team&apos;s slow consumer has frozen every producer in the company. Publishers don&apos;t get errors; their <code>publish</code> calls simply <b>hang</b>, which is how the freeze propagates upstream into web handlers (Chapter 6 plays the full cascade).',
      focus: ['alarm', 'blocked'],
      particles: [{ from: 'alarm', to: 'blocked', color: C.danger }],
    },
    {
      title: 'The only way out',
      prose:
        'Deliveries continue — consumers are the exit. The backlog drains, memory falls below the watermark, the alarm clears, publishers unfreeze. The lesson is structural: <b>bulkheads before the alarm</b> — <code>max-length</code> and TTL on every queue (drop or dead-letter, your choice, but <em>bounded</em>), per-vhost memory limits per tenant — so one queue&apos;s worst day stays one queue&apos;s problem.',
      focus: ['blocked', 'drain', 'ok'],
      particles: [{ from: 'drain', to: 'ok', color: C.store }],
    },
  ],
}

/* ---- Chapter 7: a production messaging estate ---- */
export const estateTrace: TraceSpec = {
  title: 'A production messaging estate — quorum, bulkheads, and the handoff',
  aspect: 0.5,
  zones: [
    { label: 'Apps', x: 2, y: 4, w: 21, h: 42 },
    { label: 'Cluster of three', x: 27, y: 4, w: 45, h: 42 },
    { label: 'Wider estate', x: 76, y: 4, w: 22, h: 42 },
  ],
  nodes: [
    { id: 'apps', x: 4.5, y: 8, w: 16, h: 8, label: 'Producer fleet', sub: 'long-lived connections', color: C.client },
    { id: 'lb', x: 4.5, y: 23, w: 16, h: 8, label: 'Load balancer', sub: 'spreads connections', color: C.client },
    { id: 'n1', x: 29.5, y: 8, w: 17, h: 9, label: 'Node 1', sub: 'leader: orders', color: C.queue },
    { id: 'n2', x: 51, y: 8, w: 18, h: 9, label: 'Node 2', sub: 'leader: payments', color: C.queue },
    { id: 'n3', x: 29.5, y: 22, w: 17, h: 8, label: 'Node 3', sub: 'leader: emails', color: C.queue },
    { id: 'dlq', x: 51, y: 22, w: 18, h: 8, label: 'DLX + parking lot', sub: 'retries, poison, triage', color: C.machine },
    { id: 'vh', x: 40, y: 35.5, w: 18, h: 7, label: 'vhosts', sub: 'tenants, limits, bulkheads', color: C.machine },
    { id: 'fed', x: 78, y: 8, w: 18, h: 8.5, label: 'Federation link', sub: 'async, DC → DC', color: C.edge },
    { id: 'stream', x: 78, y: 22, w: 18, h: 8, label: 'Streams', sub: 'the log, inside Rabbit', color: C.store },
    { id: 'kafka', x: 78, y: 35, w: 18, h: 7.5, label: 'The handoff', sub: 'firehose? → Kafka', color: C.machine },
  ],
  steps: [
    {
      title: 'Connections are infrastructure',
      prose:
        'AMQP connections are stateful and expensive to open (handshake, auth, channel setup), so production apps hold <b>long-lived connections</b> with channels multiplexed on top, spread across nodes by a TCP load balancer. Connection <em>churn</em> — open, publish, close, repeat — is a top-three self-inflicted wound (Chapter 6 has the metric).',
      focus: ['apps', 'lb'],
      particles: [{ from: 'apps', to: 'lb', color: C.client, count: 2 }],
    },
    {
      title: 'Quorum queues — Raft, per queue',
      prose:
        'Every important queue is a <b>quorum queue</b>: a Raft group with (typically) three replicas. A publish appends to the leader&apos;s log and confirms only after a <b>majority fsyncs</b> — real durability, priced at a network round-trip plus disk per message. (Classic mirrored queues, the old HA story, are deprecated for good reasons: their failure modes filled a decade of postmortems.)',
      focus: ['lb', 'n1'],
      particles: [{ from: 'lb', to: 'n1', color: C.queue, via: [{ x: 25, y: 27 }, { x: 25, y: 12.5 }] }],
    },
    {
      title: 'Leaders spread across nodes',
      prose:
        'Each node leads some queues and follows others — the same leadership-balancing idea as Kafka&apos;s partition leaders. A three-node cluster with leaders well spread uses all three nodes&apos; cores; a cluster where one node leads everything is one node with two expensive spectators.',
      focus: ['n1', 'n2', 'n3'],
      particles: [
        { from: 'n1', to: 'n2', color: C.queue },
        { from: 'n1', to: 'n3', color: C.queue },
      ],
    },
    {
      title: 'The dead-letter estate',
      prose:
        'Every real deployment grows a <b>parking-lot topology</b>: failures dead-letter into a retry queue with a TTL (the delay), which dead-letters back to the work queue (the retry), with a counter capping attempts before messages land in a human-triage <b>parking lot</b>. Retry-with-backoff, built entirely from TTL + DLX — the smart broker&apos;s primitives composing.',
      focus: ['n2', 'dlq'],
      particles: [{ from: 'n2', to: 'dlq', color: C.machine }],
    },
    {
      title: 'vhosts — the blast-radius tool',
      prose:
        'Tenants get <b>virtual hosts</b>: separate namespaces with their own permissions, quotas, and resource limits. After Chapter 2&apos;s trace you know why this matters: limits per vhost are how one team&apos;s runaway backlog is stopped <em>before</em> it reaches the node-wide watermark that freezes everyone.',
      focus: ['vh'],
    },
    {
      title: 'Federation, not stretched clusters',
      prose:
        'Across data centers, estates use <b>federation or shovels</b> — async links that republish messages remotely — rather than stretching one cluster over the WAN (Raft majorities across continents make every confirm pay intercontinental latency). Same lesson, third page in a row: <em>many bounded clusters, loosely coupled</em>.',
      focus: ['n2', 'fed'],
      particles: [{ from: 'n2', to: 'fed', color: C.edge }],
    },
    {
      title: 'Streams — the log moves in',
      prose:
        'RabbitMQ&apos;s answer to &ldquo;we need replay&rdquo;: <b>streams</b> — append-only, non-destructive reads, offset-tracking consumers, millions of messages per second. It is, frankly, Kafka&apos;s abstraction living inside Rabbit — perfect for fan-in pipelines and audit feeds without running a second system.',
      focus: ['stream', 'n2'],
      particles: [{ from: 'n2', to: 'stream', color: C.store }],
    },
    {
      title: 'The honest boundary',
      prose:
        'And when the workload <em>is</em> a firehose — replayable, multi-subscriber, hundreds of MB/s, consumed by teams you&apos;ve never met — it&apos;s a log workload, and the log system wins (the Kafka page&apos;s opening argument). Mature estates run <b>both</b>: RabbitMQ for tasks, routing, and RPC; Kafka for the event backbone. The failure is not choosing one — it&apos;s using either as the other.',
      focus: ['kafka', 'stream'],
      particles: [{ from: 'stream', to: 'kafka', color: C.machine }],
    },
  ],
}
