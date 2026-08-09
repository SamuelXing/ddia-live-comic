import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* Colors: client blue, S3 machinery amber, storage green,
   durability/replication violet, edge cyan, danger red. */
const C = {
  client: VIZ.blue,
  s3: VIZ.amber,
  store: VIZ.green,
  dur: VIZ.violet,
  edge: VIZ.cyan,
  hot: VIZ.red,
}

/* ------------------------------------------------------------------
   Trace 1 — one GET. The point: almost none of the latency floor is
   the disk. It is an authenticated HTTP request that has to look up
   where the object lives before anyone can read a byte of it.
   ------------------------------------------------------------------ */
export const getTrace: TraceSpec = {
  title: 'Trace one GET — from signature to first byte',
  aspect: 0.5,
  zones: [
    { label: 'Your client', x: 2, y: 4, w: 21, h: 42 },
    { label: 'S3, in one region', x: 27, y: 4, w: 45, h: 42 },
    { label: 'Storage nodes', x: 76, y: 4, w: 22, h: 42 },
  ],
  nodes: [
    { id: 'app', x: 4.5, y: 11, w: 16, h: 8, label: 'Your app', sub: 'GET /bucket/key', color: C.client },
    { id: 'dns', x: 4.5, y: 28, w: 16, h: 8, label: 'Regional endpoint', sub: 'one of many hosts', color: C.client },
    { id: 'fe', x: 29.5, y: 8, w: 17, h: 8, label: 'Front-end fleet', sub: 'TLS · HTTP', color: C.s3 },
    { id: 'auth', x: 51, y: 8, w: 18, h: 8, label: 'SigV4 + policy', sub: 'who, and may they', color: C.s3 },
    { id: 'index', x: 29.5, y: 21, w: 17, h: 8, label: 'Index', sub: 'key → where it lives', color: C.s3 },
    { id: 'fetch', x: 51, y: 21, w: 18, h: 8, label: 'Read & reassemble', sub: 'k of n fragments', color: C.store },
    { id: 'stream', x: 37, y: 34, w: 18, h: 7.5, label: 'Stream out', sub: 'first byte, then bulk', color: C.s3 },
    { id: 'azA', x: 78, y: 8, w: 18, h: 8, label: 'AZ A', sub: 'fragments', color: C.store },
    { id: 'azB', x: 78, y: 21, w: 18, h: 9, label: 'AZ B', sub: 'fragments', color: C.store },
    { id: 'azC', x: 78, y: 34, w: 18, h: 7.5, label: 'AZ C', sub: 'fragments', color: C.store },
  ],
  steps: [
    {
      title: 'This is an HTTP request, not a disk read',
      prose:
        'Every difference between S3 and a filesystem starts here. There is no file handle, no seek, no open connection to a device — there is <b>a signed HTTP request to a web service</b>, resolved through DNS to one of a very large number of front-end hosts. Everything object storage gives you and everything it refuses follows from that one substitution.',
      focus: ['app', 'dns'],
      particles: [{ from: 'app', to: 'dns', color: C.client }],
    },
    {
      title: 'Authenticate before anything else',
      prose:
        'The front end verifies a <b>SigV4 signature</b> computed over the request, then evaluates the union of IAM policy, bucket policy, and any access-point rules. This runs on every single request — there is no session to amortize it across. It is a real component of the latency floor and a real component of the cost, and it is the reason a presigned URL is a genuinely different performance object than a signed request.',
      focus: ['fe', 'auth'],
      particles: [
        { from: 'dns', to: 'fe', color: C.client, via: [{ x: 25, y: 32 }, { x: 25, y: 12 }] },
        { from: 'fe', to: 'auth', color: C.s3 },
      ],
    },
    {
      title: 'The index is the whole system',
      prose:
        'A bucket is a <b>flat keyspace</b> — <code>a/b/c.jpg</code> contains no directories, only a string with slashes in it. So the first real work is an index lookup: which storage nodes hold the fragments of this key. That index is partitioned by key range, and <em>this is where the per-prefix request limit comes from</em>. It is not a policy AWS chose to impose on you; it is the shape of the data structure showing through.',
      focus: ['auth', 'index'],
      particles: [{ from: 'auth', to: 'index', color: C.s3 }],
    },
    {
      title: 'Read k fragments of n — from more than one building',
      prose:
        'The object was never stored as a copy. It was <b>erasure coded</b> into fragments spread across independent availability zones, and reading it back needs any sufficient subset. Two consequences worth holding on to: the read survives a whole zone being gone, and it is <em>fastest fragments win</em> — so S3 gets the hedging benefit from Chapter 1 of the Tail Latency comic for free, structurally.',
      focus: ['fetch', 'azA', 'azB', 'azC'],
      particles: [
        { from: 'index', to: 'fetch', color: C.store },
        { from: 'fetch', to: 'azA', color: C.store },
        { from: 'fetch', to: 'azB', color: C.store },
        { from: 'fetch', to: 'azC', color: C.store },
      ],
    },
    {
      title: 'First byte in tens of milliseconds — then it is fast',
      prose:
        'AWS documents roughly <b>100–200 ms first-byte latency</b> for small objects. Add up what produced it: DNS, TLS, signature verification, policy evaluation, an index lookup, and a fan-out read. Almost none of it is the disk. This is <em>the</em> defining property of the tier — a floor you cannot optimize below because it is structural, not incidental.',
      focus: ['fetch', 'stream'],
      particles: [{ from: 'fetch', to: 'stream', color: C.s3 }],
    },
    {
      title: 'So the floor decides what S3 is for',
      prose:
        'Once streaming, throughput is enormous — AWS documents single instances pulling up to <b>100 Gb/s</b>. The floor is <b>per request</b>, so it amortizes to nothing on a 100 MB object and dominates completely on a 4 KB one. That single ratio decides every design question on this page: how big to make objects, what to put a CDN in front of, and what never belongs in S3 at all.',
      focus: ['stream', 'app'],
      particles: [{ from: 'stream', to: 'app', color: C.client, via: [{ x: 25, y: 44 }, { x: 25, y: 15 }] }],
    },
  ],
}

/* ------------------------------------------------------------------
   Trace 2 — the PUT. The deepest mechanism here is the ordering:
   fragments become durable first, the key becomes visible last, and
   that ordering is what makes read-after-write strong.
   ------------------------------------------------------------------ */
export const putTrace: TraceSpec = {
  title: 'Trace one PUT — what eleven nines actually costs',
  aspect: 0.5,
  zones: [
    { label: 'Your client', x: 2, y: 4, w: 21, h: 42 },
    { label: 'The write path', x: 27, y: 4, w: 45, h: 42 },
    { label: 'Three AZs', x: 76, y: 4, w: 22, h: 42 },
  ],
  nodes: [
    { id: 'app', x: 4.5, y: 11, w: 16, h: 8, label: 'PUT', sub: 'the whole object', color: C.client },
    { id: 'mpu', x: 4.5, y: 28, w: 16, h: 8, label: 'Multipart', sub: 'or 10,000 parts', color: C.client },
    { id: 'fe', x: 29.5, y: 8, w: 17, h: 8, label: 'Front end', sub: 'auth · checksum', color: C.s3 },
    { id: 'erasure', x: 51, y: 8, w: 18, h: 8, label: 'Erasure code', sub: 'k data + m parity', color: C.dur },
    { id: 'durable', x: 29.5, y: 21, w: 17, h: 8, label: 'Durability ack', sub: 'enough fragments', color: C.dur },
    { id: 'spread', x: 51, y: 21, w: 18, h: 8, label: 'Spread fragments', sub: 'zones · drives', color: C.store },
    { id: 'commit', x: 37, y: 34, w: 18, h: 7.5, label: 'Commit the key', sub: 'the index entry, last', color: C.s3 },
    { id: 'azA', x: 78, y: 8, w: 18, h: 8, label: 'AZ A', sub: 'own power', color: C.store },
    { id: 'azB', x: 78, y: 21, w: 18, h: 9, label: 'AZ B', sub: 'own network', color: C.store },
    { id: 'azC', x: 78, y: 34, w: 18, h: 7.5, label: 'AZ C', sub: 'own failures', color: C.store },
  ],
  steps: [
    {
      title: 'An object is immutable, so a write is always a whole object',
      prose:
        'There is no append, no in-place edit, no partial write. Changing one byte means uploading the object again. That sounds like a limitation and is actually the <b>enabling constraint</b> — it is what lets S3 treat every write as an independent unit, place it anywhere, and never coordinate with a previous writer. Multipart upload splits a large object across parallel connections, but even that assembles into one immutable object at the end.',
      focus: ['app', 'mpu'],
      particles: [{ from: 'app', to: 'mpu', color: C.client }],
    },
    {
      title: 'Checksum on the way in',
      prose:
        'The front end authenticates the request and verifies a <b>checksum</b> of the bytes. Everything downstream re-verifies against it, continuously, for as long as the object exists — background scrubbing that finds bit rot and rebuilds fragments before anyone reads them. Durability is not a property of the disks; it is a property of a loop that never stops running.',
      focus: ['fe', 'erasure'],
      particles: [
        { from: 'mpu', to: 'fe', color: C.client, via: [{ x: 25, y: 32 }, { x: 25, y: 12 }] },
        { from: 'fe', to: 'erasure', color: C.dur },
      ],
    },
    {
      title: 'Erasure coding, not copies',
      prose:
        'Three full replicas cost 3× the storage for one machine&apos;s worth of tolerance. <b>Erasure coding</b> splits the object into <code>k</code> data fragments plus <code>m</code> parity fragments — any <code>k</code> of the <code>k+m</code> reconstruct it — at roughly 1.5× overhead instead of 3×. <em>The redundancy is arithmetic rather than duplication</em>, which is what makes eleven nines affordable rather than merely possible.',
      focus: ['erasure', 'spread'],
      particles: [{ from: 'erasure', to: 'spread', color: C.dur }],
    },
    {
      title: 'Spread so that correlated failures cannot line up',
      prose:
        'Fragments land on different drives, in different racks, in <b>different availability zones with independent power and networking</b>. Eleven nines is not a claim that drives are reliable — drives fail constantly and S3 assumes it. It is a claim about how many <em>simultaneous, independent</em> failures it would take to lose a fragment set, and that number is chosen to be absurd.',
      focus: ['spread', 'azA', 'azB', 'azC'],
      particles: [
        { from: 'spread', to: 'azA', color: C.store },
        { from: 'spread', to: 'azB', color: C.store },
        { from: 'spread', to: 'azC', color: C.store },
      ],
    },
    {
      title: 'Durable first — visible second',
      prose:
        'Enough fragments acknowledge, and only <em>then</em> does the index entry for the key get committed. That ordering is the entire trick behind <b>strong read-after-write consistency</b>: there is no window where the key resolves to a half-written object, because the key does not resolve at all until the bytes are already durable. Same shape as a database committing its log before its pages — <em>the log is the truth, the index is a pointer at it</em>.',
      focus: ['durable', 'commit'],
      particles: [
        { from: 'azB', to: 'durable', color: C.dur, via: [{ x: 74, y: 18.3 }, { x: 48, y: 18.3 }] },
        { from: 'durable', to: 'commit', color: C.s3 },
      ],
    },
    {
      title: 'And what the ack does not promise',
      prose:
        'The 200 comes back and the object is durable across three buildings. It is <b>not</b> protected from you: eleven nines has nothing to say about a <code>DELETE</code>, a lifecycle rule with a wrong prefix, or a bucket policy someone widened. Versioning and MFA-delete exist for exactly the failure the durability figure does not cover, and the gap between the two is where nearly all real data loss on S3 happens.',
      focus: ['commit', 'app'],
      particles: [{ from: 'commit', to: 'app', color: C.client, via: [{ x: 25, y: 44 }, { x: 25, y: 15 }] }],
    },
  ],
}

/* ------------------------------------------------------------------
   Trace 3 (ch.7) — what a large workload on S3 is shaped like. You
   never operate S3's fleet; you operate the access pattern.
   ------------------------------------------------------------------ */
export const fleetTrace: TraceSpec = {
  title: 'A large workload on S3 — the four decisions that define it',
  aspect: 0.5,
  zones: [
    { label: 'Producers', x: 2, y: 4, w: 21, h: 42 },
    { label: 'One bucket', x: 27, y: 4, w: 45, h: 42 },
    { label: 'Consumers', x: 76, y: 4, w: 22, h: 42 },
  ],
  nodes: [
    { id: 'writers', x: 4.5, y: 11, w: 16, h: 8, label: 'Writers', sub: 'hash-first keys', color: C.client },
    { id: 'mpu', x: 4.5, y: 28, w: 16, h: 8, label: 'Multipart', sub: '8–16 MB parts', color: C.client },
    { id: 'prefixes', x: 29.5, y: 8, w: 17, h: 8, label: 'N prefixes', sub: '5,500 GET/s each', color: C.s3 },
    { id: 'hot', x: 51, y: 8, w: 18, h: 8, label: 'The hot 1%', sub: 'most of the reads', color: C.hot },
    { id: 'standard', x: 29.5, y: 21, w: 17, h: 8, label: 'S3 Standard', sub: 'the working set', color: C.store },
    { id: 'lifecycle', x: 51, y: 21, w: 18, h: 8, label: 'Lifecycle', sub: '→ IA → Glacier', color: C.store },
    { id: 'index', x: 37, y: 34, w: 18, h: 7.5, label: 'Your own index', sub: 'never LIST to find', color: C.s3 },
    { id: 'cdn', x: 78, y: 8, w: 18, h: 8, label: 'CDN', sub: 'absorbs the hot 1%', color: C.edge },
    { id: 'analytics', x: 78, y: 21, w: 18, h: 9, label: 'Analytics fleet', sub: 'up to 100 Gb/s each', color: C.client },
    { id: 'bill', x: 78, y: 34, w: 18, h: 7.5, label: 'The bill', sub: 'requests + egress', color: C.hot },
  ],
  steps: [
    {
      title: 'The scale you are joining',
      prose:
        'In 2013 AWS announced <b>2 trillion objects and peaks over 1.1 million requests per second</b>. By 2025 Werner Vogels was describing <b>hundreds of trillions of objects across 36 regions</b>, with individual customers driving tens of terabytes per second. In twelve years the fleet grew by orders of magnitude and <em>the interface did not change at all</em> — still a bucket, a key, and a blob.',
      focus: ['writers'],
    },
    {
      title: 'Decision one: what a key looks like',
      prose:
        'Request capacity is per partitioned prefix, so the key name <b>is</b> the shard key. Put a hash or a tenant id at the front and load spreads across as many prefixes as you like; put a date at the front and every write today lands in one place. Same data, same volume, and one of the two designs throttles — which is Chapter 6 in a single sentence.',
      focus: ['writers', 'prefixes'],
      particles: [{ from: 'writers', to: 'prefixes', color: C.client, via: [{ x: 25, y: 15 }, { x: 25, y: 12 }] }],
    },
    {
      title: 'Decision two: how big an object is',
      prose:
        'The per-request floor is fixed, so object size decides whether you are <b>request-bound or byte-bound</b>. Multipart at 8–16 MB parts turns one large upload into many parallel streams until the client NIC is the limit. Below roughly a megabyte, no amount of parallelism helps — you are paying the floor over and over, and the only real fix is to pack small things together.',
      focus: ['mpu', 'prefixes', 'standard'],
      particles: [
        { from: 'mpu', to: 'prefixes', color: C.client, via: [{ x: 25, y: 32 }, { x: 25, y: 12 }] },
        { from: 'prefixes', to: 'standard', color: C.store },
      ],
    },
    {
      title: 'Decision three: what never reaches the bucket',
      prose:
        'Access is always skewed — a small fraction of keys takes most of the reads. A CDN in front of that fraction removes request charges, egress charges, and the latency floor <b>in one move</b>, and it is the only lever on this page that improves all three at once. Everything left over is genuinely cold, which is what makes the storage-class decision easy.',
      focus: ['hot', 'cdn', 'lifecycle'],
      particles: [
        { from: 'prefixes', to: 'hot', color: C.hot },
        { from: 'hot', to: 'cdn', color: C.edge },
        { from: 'standard', to: 'lifecycle', color: C.store },
      ],
    },
    {
      title: 'Decision four: how anything gets found',
      prose:
        '<code>LIST</code> returns 1,000 keys per call and costs a request each time. At a hundred million objects that is a hundred thousand paginated calls to answer one question. <b>Keep your own index</b> — a database table of keys and metadata, written when the object is written. Every mature data platform on S3 does this, and it is what table formats like Iceberg and Delta fundamentally are.',
      focus: ['standard', 'index', 'analytics'],
      particles: [
        { from: 'standard', to: 'index', color: C.s3 },
        { from: 'lifecycle', to: 'analytics', color: C.client },
      ],
    },
    {
      title: 'And the bill reads back your access pattern',
      prose:
        'Storage is the cheap line. <b>Requests and egress are where large bills come from</b>, and both are consequences of the four decisions above rather than of how much you stored. Read it backwards from the invoice: a surprising request charge means objects are too small, and a surprising egress charge means something in front of the bucket is missing.',
      focus: ['index', 'bill', 'cdn'],
      particles: [{ from: 'index', to: 'bill', color: C.hot }],
    },
  ],
}
