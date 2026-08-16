import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* The look-aside cache, which is the most widely deployed replication scheme
   in the world and the one almost nobody calls replication. The trace is built
   so that step 5 lands as the surprise: the delete does not come from the web
   server that did the write. It comes from a daemon reading the commit log —
   which is this act's whole argument, arriving in 2013 disguised as an
   operational detail.

   Blue for the web tier, green for the cache and its standby, violet for the
   database and the daemon that reads its log. Nothing is amber: there is no
   coordinator here at all, and the paper is proud of that — the clients are
   stateless and the memcached servers never speak to each other.

   Geometry: the corridor at x≈26 (between the web zone and the cache zone) and
   x≈62 (between the cache zone and the database zone) carry the two routes
   that would otherwise be drawn straight through the cache box they are not
   addressed to. The clear east-west lane is y≈24, below the cache and above
   the gutter pool. */
const C = {
  web: VIZ.blue,
  cache: VIZ.green,
  db: VIZ.violet,
  bad: VIZ.red,
}

export const memcacheTrace: TraceSpec = {
  title: 'A cache is a replica, and this is its replication protocol',
  aspect: 0.5,
  zones: [
    { label: 'Web servers', x: 2, y: 4, w: 22, h: 42 },
    { label: 'The cache', x: 28, y: 4, w: 32, h: 42 },
    { label: 'The truth', x: 64, y: 4, w: 34, h: 42 },
  ],
  nodes: [
    { id: 'w1', x: 4, y: 10, w: 16, h: 8, label: 'Web server', sub: '521 items a page', color: C.web },
    { id: 'w2', x: 4, y: 22, w: 16, h: 8, label: 'and 10,000', sub: 'more like it', color: C.web },
    { id: 'mc', x: 30, y: 10, w: 28, h: 9, label: 'memcached', sub: 'no server talks to another', color: C.cache },
    { id: 'gut', x: 30, y: 32, w: 28, h: 8, label: 'Gutter', sub: '1% of the fleet, idle', color: C.cache },
    { id: 'db', x: 66, y: 10, w: 30, h: 9, label: 'MySQL', sub: 'the authoritative copy', color: C.db },
    { id: 'sq', x: 66, y: 30, w: 30, h: 9, label: 'mcsqueal', sub: 'reads the commit log', color: C.db },
  ],
  steps: [
    {
      title: 'A page needs 521 things, and the client does all the thinking',
      prose:
        'One popular page fetches <b>521 distinct items</b> from the cache on average, and 1,740 at the 95th percentile. The web server batches them — <b>24 keys per request</b> typically, 95 at p95 — using a dependency graph of its own data to fetch as much as possible at once. Gets go over <b>UDP</b>, which is about 20% faster than going through a proxy on TCP and means a dropped packet is simply a miss. <em>The memcached servers know none of this.</em> Routing, batching, flow control and failure handling all live in a stateless client, which is why the servers stayed simple enough to be fast.',
      focus: ['w1', 'mc'],
      particles: [
        { from: 'w1', to: 'mc', color: C.web, count: 3 },
        { from: 'mc', to: 'w1', color: C.cache, count: 3 },
      ],
    },
    {
      title: 'A miss, and what a miss actually costs',
      prose:
        'The item is not there. Now the web server has to go to MySQL, and <em>this is the event the entire system exists to prevent</em>. A cache is not a latency optimisation here; it is the thing standing between a billion requests a second and a database that cannot survive them. Note who fills the cache: <b>the web server does</b>, after querying — this is a <b>demand-filled look-aside cache</b>, so the cache is populated by its readers and never by its source.',
      focus: ['w1', 'mc', 'db'],
      particles: [
        { from: 'w1', to: 'mc', color: C.web },
        { from: 'w1', to: 'db', color: C.db, via: [{ x: 26, y: 14 }, { x: 26, y: 24 }, { x: 62, y: 24 }, { x: 62, y: 14.5 }] },
      ],
    },
    {
      title: 'One client gets a token, and the stampede does not happen',
      prose:
        'Ten thousand web servers just missed on the same hot key. Without help, that is ten thousand identical database queries — the <b>thundering herd</b>. So on a miss the server hands out a <b>lease</b>: a 64-bit token, issued for a given key <b>at most once every 10 seconds</b>. Everyone else who asks inside that window is told to wait a moment and try again, and by then the one client holding the token has usually filled the value in. Measured over a week on herd-prone keys: peak database rate <b>17,000/s without leases, 1,300/s with</b>.',
      focus: ['w1', 'w2', 'mc'],
      particles: [
        { from: 'mc', to: 'w1', color: C.cache },
        { from: 'w2', to: 'mc', color: C.bad, count: 3 },
      ],
    },
    {
      title: 'Somebody writes — and does not tell the cache',
      prose:
        'A web server updates MySQL. It amends its own SQL statement to <em>carry the cache keys that this change invalidates</em>, and then it does something worth pausing on: <b>it does not broadcast the invalidation itself.</b> It deletes locally, for read-after-write within this one request, and otherwise leaves it. A web server that broadcast to every cluster would batch badly, and — the reason that actually decided it — when a misconfiguration misrouted deletes, <em>the only recourse was a rolling restart of the entire cache fleet.</em>',
      focus: ['w2', 'db'],
      particles: [{ from: 'w2', to: 'db', color: C.db, via: [{ x: 26, y: 26 }, { x: 26, y: 24 }, { x: 62, y: 24 }, { x: 62, y: 14.5 }] }],
    },
    {
      title: 'A daemon reads the commit log, and that is the whole act',
      prose:
        'The invalidation comes from <b>mcsqueal</b>, a daemon sitting on every database, <em>watching the statements that database commits</em>. It extracts the deletes, batches them — an <b>18× improvement in deletes per packet</b> — and ships them to routers in every frontend cluster, which fan them out to the right servers. Read the paper’s own justification and you will see this act’s thesis in 2013: invalidations live in statements <b>“which databases commit and store in reliable logs,”</b> so a lost or misrouted delete can simply be <b>replayed</b>. The cache is a replica. The commit log is its replication stream.',
      focus: ['db', 'sq', 'mc'],
      particles: [
        { from: 'db', to: 'sq', color: C.db },
        { from: 'sq', to: 'mc', color: C.db, count: 2 },
      ],
    },
    {
      title: 'Why it is a delete and never an update',
      prose:
        'The obvious move is to push the <em>new value</em> into the cache and skip a future miss. It is wrong, and for a reason worth carrying to any cache you build. <b>Deletes are idempotent; sets are not.</b> Two concurrent updates can be reordered on the way in, and the loser lands last and stays there — a <b>stale set</b> that no future write will correct, because as far as the cache knows it holds a perfectly good value. A delete has no such failure mode: the worst case is an unnecessary miss. <em>Only 4% of the deletes issued actually invalidate anything</em>, and that waste is the price of the property.',
      focus: ['sq', 'mc', 'w1'],
      particles: [
        { from: 'sq', to: 'mc', color: C.bad },
        { from: 'w1', to: 'mc', color: C.web },
      ],
    },
    {
      title: 'A cache server vanishes, and 1% of the fleet catches the fall',
      prose:
        'A memcached server stops answering. Rehashing its keys onto the survivors sounds right and is dangerous — <em>a single key can be 20% of a server’s traffic</em>, so you hand a hot key to a healthy machine and take that one down too. Instead the client retries into <b>Gutter</b>, a small idle pool of about <b>1% of the servers</b>, whose entries expire quickly so nobody has to invalidate them. It converts <b>10–25% of failures into hits</b> every day, reaches a 35% hit rate within four minutes of a server dying, and cuts client-visible failures by <b>99%</b>.',
      focus: ['w1', 'mc', 'gut'],
      particles: [
        { from: 'w1', to: 'mc', color: C.bad },
        { from: 'w1', to: 'gut', color: C.cache },
      ],
    },
  ],
}
