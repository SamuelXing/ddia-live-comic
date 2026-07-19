import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* Colors: client blue, broker machinery amber, page cache green,
   replication violet, purgatory red. */
const C = {
  client: VIZ.blue,
  broker: VIZ.amber,
  cache: VIZ.green,
  repl: VIZ.violet,
  purg: VIZ.red,
}

export const produceTrace: TraceSpec = {
  title: 'Trace a produce request (acks=all)',
  aspect: 0.5,
  zones: [
    { label: 'Producer (client)', x: 2, y: 4, w: 21, h: 42 },
    { label: 'Broker — partition leader', x: 27, y: 4, w: 45, h: 42 },
    { label: 'Followers', x: 76, y: 4, w: 22, h: 27 },
  ],
  nodes: [
    { id: 'app', x: 4.5, y: 9, w: 16, h: 7, label: 'Your app', sub: 'send(key, value)', color: C.client },
    { id: 'accum', x: 3.5, y: 21, w: 18, h: 9, label: 'RecordAccumulator', sub: 'batch per partition', color: C.client },
    { id: 'sender', x: 4.5, y: 36, w: 16, h: 7, label: 'Sender thread', sub: 'one TCP per broker', color: C.client },
    { id: 'net', x: 29.5, y: 8, w: 17, h: 8, label: 'Network threads', sub: 'default 3', color: C.broker },
    { id: 'reqq', x: 51, y: 8, w: 18, h: 8, label: 'Request queue', sub: 'shared', color: C.broker },
    { id: 'io', x: 29.5, y: 21, w: 17, h: 8, label: 'I/O threads', sub: 'default 8', color: C.broker },
    { id: 'cache', x: 51, y: 20.5, w: 18, h: 9, label: 'OS page cache', sub: 'active segment append', color: C.cache },
    { id: 'index', x: 29.5, y: 33, w: 17, h: 7.5, label: 'Offset + time index', sub: 'mmap, sparse', color: C.broker },
    { id: 'purg', x: 50, y: 33, w: 21, h: 7.5, label: 'Purgatory', sub: 'hierarchical timing wheel', color: C.purg },
    { id: 'hw', x: 75.5, y: 33, w: 22, h: 7.5, label: 'High watermark', sub: 'min ISR log-end-offset', color: C.repl },
    { id: 'f1', x: 78.5, y: 8, w: 18, h: 8, label: 'Follower B2', sub: 'replica fetcher', color: C.repl },
    { id: 'f2', x: 78.5, y: 20, w: 18, h: 8, label: 'Follower B3', sub: 'replica fetcher', color: C.repl },
  ],
  steps: [
    {
      title: 'Partition & batch on the client',
      prose:
        'The serializer turns your record into bytes; the partitioner picks a partition — <code>hash(key) % partitions</code> for keyed records (this is what makes per-key ordering work), sticky batching for null keys. Records accumulate into <b>per-partition batches</b> governed by <code>batch.size</code> and <code>linger.ms</code>, and compression (lz4/zstd) is applied per <em>batch</em>, not per record — batching is where Kafka clients earn their throughput.',
      focus: ['app', 'accum'],
      particles: [{ from: 'app', to: 'accum', color: C.client, count: 3 }],
    },
    {
      title: 'Sender drains to the leader',
      prose:
        'A single background <b>sender thread</b> drains ready batches and multiplexes them over one TCP connection per broker, routed to each partition’s <b>leader</b>. With the idempotent producer (default), every batch carries a producer id + sequence number so broker-side dedup makes retries safe.',
      focus: ['accum', 'sender', 'net'],
      particles: [
        { from: 'accum', to: 'sender', color: C.client },
        // route up the clear channel between the producer & broker zones
        { from: 'sender', to: 'net', color: C.client, via: [{ x: 24, y: 39.5 }, { x: 24, y: 12 }] },
      ],
    },
    {
      title: 'Network thread → request queue',
      prose:
        'Broker <b>network threads</b> (default 3) do no real work — they read bytes off sockets and park complete requests in a shared <b>request queue</b>. Keeping them thin is deliberate: socket I/O never blocks behind disk work.',
      focus: ['net', 'reqq'],
      particles: [{ from: 'net', to: 'reqq', color: C.broker }],
    },
    {
      title: 'Append to the log — the heart of Kafka',
      prose:
        'An <b>I/O thread</b> (default 8) validates the batch (leader epoch, producer sequence) and appends it to the partition’s <b>active segment</b> — a plain <em>sequential file write</em> that lands in the <b>OS page cache</b>. There is <b>no fsync</b> on this path by default: durability comes from replication, and the OS flushes lazily. Sequential I/O + page cache instead of application buffers is <em>the</em> design decision the whole system falls out of.',
      focus: ['reqq', 'io', 'cache'],
      particles: [
        { from: 'reqq', to: 'io', color: C.broker },
        { from: 'io', to: 'cache', color: C.cache },
      ],
    },
    {
      title: 'Sparse indexes, memory-mapped',
      prose:
        'Every ~4 KB of log (<code>log.index.interval.bytes</code>) gets one entry in the <b>offset index</b> and <b>time index</b> — memory-mapped files that let a fetch at offset N binary-search to a file position without scanning. Sparse is enough because reads then scan forward sequentially.',
      focus: ['io', 'index'],
      particles: [{ from: 'io', to: 'index', color: C.broker }],
    },
    {
      title: 'Parked in purgatory',
      prose:
        'With <code>acks=all</code> the response can’t be sent until the in-sync replicas have the batch. The request is parked in <b>purgatory</b> — a hierarchical timing-wheel structure that holds hundreds of thousands of pending requests with O(1) insert/expire. No thread blocks waiting.',
      focus: ['purg'],
      particles: [{ from: 'io', to: 'purg', color: C.purg }],
    },
    {
      title: 'Followers fetch — replication is consumption',
      prose:
        'Followers are not sent data; they <b>fetch it</b>, running the same fetch protocol as any consumer, and append to their own logs (their own page caches). One replication mechanism, one code path — and it reads from the leader’s page cache, so tail replication rarely touches disk.',
      focus: ['f1', 'f2', 'cache'],
      particles: [
        { from: 'cache', to: 'f1', color: C.repl },
        { from: 'cache', to: 'f2', color: C.repl },
      ],
    },
    {
      title: 'High watermark advances',
      prose:
        'The leader tracks every replica’s log-end-offset. The <b>high watermark</b> = the minimum across the ISR: everything below it is <em>committed</em> and survives any single-broker loss. When the HW passes our batch, purgatory completes the produce request. Consumers may only ever read up to the HW.',
      focus: ['hw', 'purg', 'f1', 'f2'],
      particles: [
        // f1's report routes down the channel left of the followers, not through f2
        { from: 'f1', to: 'hw', color: C.repl, via: [{ x: 74, y: 12 }, { x: 74, y: 36.75 }] },
        { from: 'f2', to: 'hw', color: C.repl },
      ],
    },
    {
      title: 'Ack the producer',
      prose:
        'The response exits through the same network thread and the producer’s callback fires. Total cost of a durable, replicated write: <b>two network hops, one sequential page-cache append, and RF−1 fetches</b> — and at no point did anyone wait on a random disk seek. That is why one broker sustains hundreds of MB/s.',
      focus: ['net', 'app'],
      particles: [
        // response routes down under the grid and up the inter-zone channel,
        // instead of cutting straight across the page cache
        { from: 'purg', to: 'net', color: C.broker, via: [{ x: 60.5, y: 46 }, { x: 24, y: 46 }, { x: 24, y: 12 }] },
        { from: 'net', to: 'app', color: C.client },
      ],
    },
  ],
}

export const consumeTrace: TraceSpec = {
  title: 'Trace a fetch (consume) request',
  aspect: 0.5,
  zones: [
    { label: 'Consumer (client)', x: 2, y: 4, w: 21, h: 38 },
    { label: 'Broker — partition leader', x: 27, y: 4, w: 47, h: 42 },
    { label: 'Kafka itself', x: 76, y: 16, w: 22, h: 18 },
  ],
  nodes: [
    { id: 'cons', x: 4.5, y: 9, w: 16, h: 8, label: 'Consumer', sub: 'poll() loop', color: C.client },
    { id: 'commit', x: 4.5, y: 28, w: 16, h: 8, label: 'Offset commit', sub: 'group coordinator', color: C.client },
    { id: 'net', x: 29.5, y: 8, w: 18, h: 8, label: 'Network thread', color: C.broker },
    { id: 'fpurg', x: 52.5, y: 8, w: 19, h: 8, label: 'Fetch purgatory', sub: 'long poll', color: C.purg },
    { id: 'hw', x: 29.5, y: 21, w: 18, h: 7, label: 'HW check', sub: 'committed data only', color: C.repl },
    { id: 'cache', x: 52.5, y: 20, w: 19, h: 9, label: 'OS page cache', sub: 'segment data', color: C.cache },
    { id: 'sfile', x: 40, y: 34, w: 21, h: 8, label: 'sendfile()', sub: 'zero-copy → NIC', color: C.cache },
    { id: 'offlog', x: 77, y: 20, w: 20, h: 10, label: '__consumer_offsets', sub: 'compacted topic', color: C.repl },
  ],
  steps: [
    {
      title: 'Fetch request',
      prose:
        'The consumer asks for data from <b>offset N</b> — position is consumer-side state, the broker tracks nothing per consumer on the read path. <code>fetch.min.bytes</code> and <code>fetch.max.wait.ms</code> tell the broker “don’t answer until you have this much, or this long has passed.”',
      focus: ['cons', 'net'],
      particles: [{ from: 'cons', to: 'net', color: C.client }],
    },
    {
      title: 'Long-poll in fetch purgatory',
      prose:
        'If not enough data exists yet, the fetch parks in <b>purgatory</b> instead of busy-polling. This one mechanism gives Kafka low latency <em>and</em> batched efficiency: data arriving completes waiting fetches immediately, quiet partitions cost nothing.',
      focus: ['fpurg'],
      particles: [{ from: 'net', to: 'fpurg', color: C.purg }],
    },
    {
      title: 'Bounded by the high watermark',
      prose:
        'The read is capped at the <b>high watermark</b>: only records replicated to the ISR are visible. A consumer can never observe data that a leader failover could roll back.',
      focus: ['hw'],
      particles: [{ from: 'fpurg', to: 'hw', color: C.repl }],
    },
    {
      title: 'Read from the page cache',
      prose:
        'Tail consumers — the overwhelmingly common case — read data written seconds ago, which is still sitting in the <b>page cache</b>: no disk I/O at all. The dangerous case is a <em>lagging</em> consumer paging in cold segments from disk, evicting hot pages and hurting everyone — cache pollution as a noisy-neighbor problem.',
      focus: ['cache'],
      particles: [{ from: 'hw', to: 'cache', color: C.cache }],
    },
    {
      title: 'Zero-copy to the NIC',
      prose:
        'The broker calls <b>sendfile(2)</b>: the kernel moves pages from the cache straight to the network card. The data never enters broker user space — no copies, no heap allocation, no GC pressure, regardless of message size. (TLS is the caveat: encryption forces one pass through user space — still cheap, but it’s why plaintext benchmarks look superhuman.)',
      focus: ['sfile', 'cons'],
      particles: [
        { from: 'cache', to: 'sfile', color: C.cache },
        // zero-copy delivery routes under the grid, not across the HW-check node
        { from: 'sfile', to: 'cons', color: C.cache, via: [{ x: 50.5, y: 44 }, { x: 24, y: 44 }, { x: 24, y: 13 }] },
      ],
    },
    {
      title: 'Commit offsets — to Kafka itself',
      prose:
        'The consumer records its position by producing to <b>__consumer_offsets</b> — a compacted internal topic keyed by (group, topic, partition). Kafka stores its own coordination state in its own log: the log really is the database.',
      focus: ['commit', 'offlog'],
      // route under the grid to __consumer_offsets, not across the page cache
      particles: [{ from: 'commit', to: 'offlog', color: C.repl, via: [{ x: 12.5, y: 46 }, { x: 87, y: 46 }] }],
    },
  ],
}
