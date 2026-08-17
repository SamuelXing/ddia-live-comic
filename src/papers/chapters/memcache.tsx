import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { LeaseHerdDiagram, InvalidationLatencyDiagram } from '../diagrams'
import { memcacheTrace } from './memcache-trace'

/* Opens Act V. The act's claim is that the log is the primary record and
   everything else is a reader that has fallen behind; this chapter makes that
   claim about the thing every reader already has and does not think of as a
   replica at all.

   The chapter is deliberately structured so that mcsqueal is a REVEAL rather
   than an introduction. A reader who has spent eleven chapters on replication
   protocols should feel the click when the invalidation turns out to come from
   the commit log — and should then notice they have been running a change-data
   capture pipeline in production without calling it one. */

export const memcache: Chapter = {
  slug: 'memcache',
  act: 'Act V · The Log Is the Database',
  paperNo: 'Paper 12',
  title: 'The Most Common Derived Copy',
  dek: 'You have a cache. It is a replica of your database with no replication protocol, and something has to keep it honest. Work out what — then find out where the answer actually comes from.',
  minutes: 17,
  paper: {
    title: 'Scaling Memcache at Facebook',
    authors: 'Rajesh Nishtala, Hans Fugal, Steven Grimm, Marc Kwiatkowski, Herman Lee, Harry C. Li, Ryan McElroy et al.',
    venue: 'USENIX NSDI',
    year: '2013',
    url: 'https://www.usenix.org/system/files/conference/nsdi13/nsdi13-final170_update.pdf',
  },
  caption:
    'Every system in this book has had a write-ahead log inside it, treated as plumbing — the boring file you replay after a crash. This act turns that around. And it starts with the derived copy you already run and probably do not think of as one. **A cache is a replica.** It holds data that lives authoritatively somewhere else, it is allowed to be behind, and unlike every replication scheme in the last eleven chapters, it ships with **no protocol at all** — just a convention your application code is expected to follow. This is the paper about running that arrangement at a billion requests a second, and the answer it arrives at is the whole act in miniature.',
  steps: [
    {
      n: 'Step 01',
      title: 'The shape of the load, which decides everything',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'Start with the fan-out, because it is unlike anything in the book so far. **A single popular page fetches 521 distinct items** from the cache, 1,740 at the 95th percentile. The web server batches them — 24 keys per request typically, 95 at p95 — and a page like that will touch **over a hundred distinct cache servers**, sometimes several hundred. Every web server talks to essentially every cache server within a short window.',
        'That pattern breaks things that nothing else in this book has had to worry about. All those replies come back at once and can overwhelm a rack switch — **incast congestion** — so the client runs a sliding window over its outstanding requests, TCP-style, but across every destination at once rather than per connection. Too small a window and requests serialise; too large and the switches drop packets. There is an optimum and it has to be found by measurement.',
        'And then the constraint that makes the chapter. **A cache miss is not a slow hit. It is load on MySQL.** Users read an order of magnitude more than they write, the read paths hit MySQL and HDFS and half a dozen backend services, and the caching layer is the only reason features that touch thousands of keys per page can exist at all. So the design goal is not latency. It is *keeping the miss rate low enough that the databases survive*, which is a very different objective and produces very different mechanisms.',
        'One more thing, stated plainly in the paper and worth adopting as a stance: **the probability of reading stale data is treated as a parameter to be tuned**, like responsiveness. Not a bug to be eliminated. A dial.',
      ],
      code: {
        file: 'one_page_load.txt',
        lines: [
          { t: '521 items fetched      (p95: 1,740)' },
          { t: ' 24 keys per batch     (p95: 95)' },
          { t: '100+ distinct servers contacted' },
          { t: '' },
          { t: 'median get latency ....... 333 µs' },
          { t: 'p95 get latency .......... 1.135 ms' },
          { t: '' },
          { t: '# and every miss becomes:', hl: 'bad' },
          { t: '#   one query against MySQL', hl: 'bad' },
          { t: '' },
          { t: '# the cache is not making things fast.' },
          { t: '# it is the reason the database is alive.' },
        ],
      },
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'A billion requests a second arrive at a tier of caches sitting in front of MySQL, and every decision below is about what happens when the two disagree. Most engineers get the first one wrong at least once, usually in production and usually at night.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**The workload:** reads dominate by an order of magnitude, a page can touch hundreds of cache servers, and the whole thing runs at a billion requests a second.',
              '**The truth:** MySQL is authoritative. The cache is not, and is always allowed to simply not have something.',
              '**The danger:** every miss is a database query. A cluster-wide loss of hit rate is a database outage.',
              '**The geography:** many clusters share a storage cluster to form a region; one region holds the master databases and the others hold read replicas that lag.',
              '**The stance:** stale reads are a tunable parameter, not a defect — but somebody has to be able to say how stale, with a number.',
            ],
            questions: [
              {
                q: 'A row changes in MySQL. What do you do to the cached copy?',
                options: [
                  {
                    label: 'Set it to the new value — you have the value right there',
                    verdict: 'dead',
                    why: 'This is the intuitive answer and it has a permanent failure mode. Two concurrent updates can reach the cache in the opposite order to the one they committed in, and **the loser lands last and stays there forever** — a stale set. Nothing later corrects it, because the cache holds what looks like a perfectly good value and has no idea it is wrong. *Sets are not idempotent, and this arrangement reorders them.*',
                  },
                  {
                    label: 'Delete it, and let the next reader refill it',
                    verdict: 'move',
                    why: '**Deletes are idempotent**, and that single property carries the design. Apply one twice and nothing happens; apply two out of order and the result is the same; apply one that was not needed and you have caused exactly one extra database query. The cache is not authoritative and is always allowed to be empty, so *the worst outcome of a wrong delete is load, and the worst outcome of a wrong set is a wrong answer, indefinitely.* Facebook measured that only **4% of deletes issued actually invalidate anything** — and paid that waste happily.',
                  },
                  {
                    label: 'Write through the cache, so it is always current',
                    verdict: 'dead',
                    why: 'Now the cache is on the write path, which makes it a component whose failure stops writes rather than merely slows reads. You have also coupled the two layers you were separating — the paper is explicit that keeping cache and persistence independent is what let them scale each one on its own schedule. A cache you cannot lose is not a cache.',
                  },
                  {
                    label: 'Give everything a short TTL and let it expire',
                    verdict: 'dead',
                    why: 'The lazy answer, and it fails in both directions at once. Short TTLs mean constant unnecessary misses on data that never changed, which is database load you are choosing to generate; long TTLs mean serving data known to be wrong for the length of the TTL. It also makes staleness impossible to reason about per key — everything is as stale as the worst case allows. Expiry is a backstop, not an invalidation strategy.',
                  },
                ],
              },
              {
                q: 'Ten thousand web servers miss on the same hot key at the same instant. What stops that from being ten thousand queries?',
                options: [
                  {
                    label: 'Nothing — provision the database for it',
                    verdict: 'dead',
                    why: 'You provision for peak, so this decides the size of your database fleet. Facebook measured it on herd-prone keys over a week: **17,000 queries a second at peak** with nothing in place. The same keys with the mechanism below: **1,300**. That is not a tuning difference, it is a capacity-planning difference of more than ten times.',
                  },
                  {
                    label: 'Hand the first client a token, and tell everyone else to wait',
                    verdict: 'move',
                    why: 'A **lease**: on a miss, the server issues a 64-bit token bound to that key, and issues one **at most every 10 seconds**. Whoever holds it goes to the database; everyone else gets told to retry shortly, by which time the value is usually there. The same token does a second job for free — it must be presented on the set, and the server rejects it if the key was deleted meanwhile, **so leases kill the stale-set race as well.** One mechanism, both problems, and it works like load-link/store-conditional.',
                  },
                  {
                    label: 'Take a distributed lock on the key before querying',
                    verdict: 'dead',
                    why: 'Right instinct, wrong weight — and Chapter 9 already priced it. A lock service call per cache miss is a coordination round trip on the hottest path in the system, and a client that dies holding the lock blocks the key until a session expires. A lease is the same idea with the cost removed: it is advisory, it is local to the server that already has the key, and losing it means somebody does an extra database query.',
                  },
                  {
                    label: 'Never evict hot keys',
                    verdict: 'dead',
                    why: 'It does not address the case, because the herd is caused by **invalidation**, not eviction — a heavily written, heavily read key is repeatedly deleted by its own writers, and every delete sends the fleet back to the database. Pinning it in memory changes nothing. It also removes exactly the wrong keys from the eviction policy.',
                  },
                ],
              },
              {
                q: 'Who actually sends the invalidation to the caches, and from where?',
                options: [
                  {
                    label: 'The web server that did the write, broadcasting to every cluster',
                    verdict: 'dead',
                    why: 'Simple, and it fails in two ways that took production to discover. Web servers batch invalidations badly, so packet rates across cluster boundaries become the bottleneck. And when something goes wrong — a configuration error misrouting deletes — **there is no recourse**, because the invalidations existed only as in-flight messages from processes that have long since moved on. The fix in that situation was a rolling restart of the entire cache fleet.',
                  },
                  {
                    label: 'A daemon on each database, reading the statements that database commits',
                    verdict: 'move',
                    why: 'Put the invalidation *in the write itself*: SQL statements are amended to carry the cache keys they invalidate, and a daemon on each database — **mcsqueal** — watches what commits, extracts the deletes, batches them (an **18× improvement in deletes per packet**) and ships them out. The paper’s own reason is the one that matters here: statements are committed and stored **in reliable logs**, so a lost or misrouted delete can simply be **replayed**. *You just made the commit log the source of your invalidation stream, and you did it for operational reasons.*',
                  },
                  {
                    label: 'Have the caches poll the database for what changed',
                    verdict: 'dead',
                    why: 'Backwards. Now every cache server generates load against the thing you are protecting, continuously, in proportion to how fresh you want to be. It also scales in the wrong direction: more cache servers means more polling, when the point of adding them was to reduce database traffic.',
                  },
                  {
                    label: 'Version every value and check the version on read',
                    verdict: 'dead',
                    why: 'A read that checks a version is a read that touches the database, which is the operation the cache exists to avoid — you have kept the memory cost and thrown away the benefit. This is a genuinely good technique in a system where the check is cheaper than the fetch. Here it is the same round trip.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You re-derived memcache at Facebook — and a change-data-capture pipeline, six years before that was a phrase',
              body: [
                '**Idempotence chose the primitive.** Delete rather than set, not because it is faster but because it is the only operation that survives being duplicated, reordered, replayed and issued unnecessarily. Every mechanism downstream leans on that: mcsqueal can replay a batch it is unsure about, Gutter can hold entries nobody will ever invalidate, and a cold cluster can be filled from a warm one. *A system that can afford to redo any step is a much simpler system than one that cannot.*',
                '**The invalidation stream is the commit log, wearing a hat.** A daemon tails what the database committed and broadcasts a derived stream of deletes to every consumer that keeps a copy. That is change data capture — it just did not have the name yet, and it was arrived at because message-based invalidation had no recovery story. **The next chapter is what happens when somebody points at exactly this arrangement and says: make the log a service, and let anything subscribe.**',
                '**And the staleness has a number, which is the unusual part.** Facebook samples one delete in a million and later checks whether it really landed. Inside the master region: **four nines within a second, five nines after an hour.** Between replica regions: **three nines within a second, four nines within ten minutes.** Most teams running a cache could not tell you this figure for their own system, and it is precisely the figure that says whether the arrangement is safe.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'The cache, the herd, and where the delete comes from',
      accent: 'denim',
      rung: 'Rung 3 · The reveal',
      span: 2,
      body: [
        'Nothing in this picture is amber, and that is accurate: there is no coordinator anywhere. The memcached servers never speak to each other, the clients hold all the routing logic, and the only thing tying the copies to the truth is a stream of deletes.',
        'Step 5 is the one to sit with. Everything before it is a cache; from step 5 on it is a replication pipeline that happens to terminate in caches.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={memcacheTrace} />
        </div>
      ),
      think: {
        q: 'Deletes and sets race constantly here, and the ordering is not guaranteed. So why does the cache not drift permanently wrong the way an eventually-consistent store would?',
        a: 'Because of an asymmetry that Act II never had. In Dynamo, two conflicting writes are **both candidate truths**, and something has to pick — which is why that act needed vector clocks and reconciliation and a shopping cart that resurrects deleted items. Here there is exactly one authoritative copy, MySQL, and the cache holds **nothing that cannot be thrown away**. So the failure modes are not symmetric: an unnecessary delete costs one query, a lost delete costs a window of staleness that the next write closes, and the only genuinely permanent error is a **stale set** — a wrong value written confidently and never corrected. That is why leases exist, and why the design goes to some trouble to make sure that a set can be rejected if the key was invalidated while the setter was away. **Convergence here is not a protocol; it is a consequence of one side being disposable.** The general lesson is worth more than the mechanism: before designing a consistency scheme, work out which of your copies is allowed to be wrong, and how wrong, and for how long. If one of them is disposable, most of the hard problem evaporates.',
      },
    },
    {
      n: 'Step 04',
      title: 'The numbers that justify the mechanisms',
      rung: 'Rung 4 · The measurement',
      body: [
        '**Leases, on herd-prone keys over a week: peak database rate 17,000/s without, 1,300/s with.** Since you provision for peak, that ratio is a direct multiple on the size of the database fleet. It is the clearest cost-of-a-mechanism number in this act.',
        '**Gutter — one percent of the fleet, left idle — cuts client-visible failures by 99%** and converts 10–25% of failures into hits every day. When a server dies, hit rates in Gutter pass 35% within four minutes and often approach 50%. The alternative everyone reaches for first, rehashing the dead server’s keys onto its neighbours, is the dangerous one: **a single key can be 20% of one server’s traffic**, so you hand a hot key to a healthy machine and take that one down too.',
        '**On the servers themselves, fine-grained locking tripled get throughput** — 600,000 to 1.8 million items a second for hits, 2.7 million to 4.5 million for misses. Misses are cheaper than hits, which is counter-intuitive until you notice a miss returns one static token for the whole batch while a hit has to build and ship every value. And UDP beat TCP by 13% on single gets.',
        '**Median get latency in production is 333 microseconds**, p75 475µs, p95 1.135ms. Set that against the end-to-end latency from an idle web server — median 178µs, p95 374µs — and the gap at p95 is the real story: it is large responses plus **time spent runnable but waiting to be scheduled**, which is the incast window doing its job. *The tail of a cache is usually not the cache.*',
      ],
      diagram: <LeaseHerdDiagram />,
    },
    {
      n: 'Step 05',
      title: 'How stale, exactly',
      rung: 'Rung 5 · The number nobody has for their own cache',
      body: [
        'This is the measurement to steal. Sample one delete in a million, record when it was issued, then keep asking every cluster whether that key is really gone. Plot the fraction still wrong against how long you have waited. **You now have a replication lag figure for your cache**, which is a thing almost nobody has and everybody assumes.',
        'The shape is the interesting part. Inside the master region, four nines of deletes have landed within **one second**, and five nines after an hour. Between replica regions it is **three nines within a second and four nines within ten minutes** — a full decade worse, all the way along, purely because of distance and the number of hops.',
        'And the tail is not what people expect. The paper’s own reading: if an invalidation is still missing after a few seconds, **the usual cause is that the first attempt failed and a retry will fix it** — not that anything is broken. Which is why the pipeline is built to be replayable rather than reliable.',
        'The cross-region case also needs a second mechanism, and it is the one place the cache is used for something other than caching. A user who writes in a replica region must not then read their own stale row from the local replica database. So the web server sets a **remote marker** for that key, and a subsequent miss that sees the marker sends its query to the *master* region instead. **This is a deliberate trade of latency for freshness**, and it is subtle in a way the paper flags itself: evicting a normal cache key is always safe, but evicting a remote marker is not — it changes what the system believes about where the truth is.',
      ],
      diagram: <InvalidationLatencyDiagram />,
    },
    {
      n: 'Step 06',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 6 · What a look-aside cache costs',
      body: [
        '**The consistency protocol lives in your application code.** Not in a library, not in the store — in every call site that reads and writes. Get, then check, then query, then set with a lease; write, then delete. Miss one path and you have a key that is wrong until something else happens to touch it. **The paper describes a system where systems and application engineers evolved the model together**, which is honest and also a warning: this arrangement works because everybody knew the rules.',
        '**The failure mode of the whole thing is correlated.** Caches exist to keep load off the databases, so anything that empties them at once — a cluster restart, a bad deploy, a network event — points the full read load at MySQL simultaneously. Cold Cluster Warmup exists for exactly this: a cold cluster fills from a *warm* one instead of the database, cutting recovery from days to hours. And it needs a two-second hold-off on deletes to avoid filling itself with values the warm cluster has not invalidated yet, which is the kind of detail you only find in production.',
        '**Everything is a pool, and the pools are set by hand.** Wildcard for the default, separate pools for high-churn keys, replicated pools for small hot data, regional pools for large cold data. Get it wrong and low-churn keys that were still valuable get evicted by high-churn keys nobody wants any more. The paper is candid that the decision to move a key family into a regional pool is **a set of manual heuristics**.',
        '**And it is stale by design, which surprises people forever.** The system provides best-effort eventual consistency and says so. But the failure is quiet — an old count, a stale membership list, a profile field that reverts — and it looks like an application bug rather than a caching decision. *A tunable staleness parameter is only a good idea if somebody is actually reading the dial.*',
      ],
      callout: {
        kind: 'bad',
        big: 'DELETE, NEVER SET',
        text: 'Two concurrent updates can reach the cache in the wrong order and the loser stays. Deletes cannot fail that way — the worst case is a wasted query. 96% of deletes here invalidate nothing, and that waste is what buys the property.',
      },
    },
    {
      n: 'Step 07',
      title: 'What it begat — and where it stands in 2026',
      rung: 'Rung 7 · Descendants',
      body: [
        '**mcrouter is the piece that got adopted.** The proxy that coalesces connections, routes, batches and fans out invalidations was open-sourced and became the standard way to run memcached at scale. The lesson generalised faster than the code: **put the complexity in a stateless client or proxy, and keep the stateful server stupid and fast.**',
        '**The look-aside pattern is now the default, defaults included.** Redis and memcached in front of Postgres or MySQL, cache-aside on the read path, delete-on-write on the write path — that is the shape of most production systems written since. So are the bugs: every team eventually meets the stale set, and most of them meet it in an incident rather than in a design review.',
        '**And the invalidation problem got solved properly by turning it into a stream.** Debezium, Maxwell and the whole change-data-capture family do what mcsqueal did — tail the database’s own log and publish what changed — except as general infrastructure rather than a cache-specific daemon. **That generalisation is the next chapter**, and it is worth noticing that Facebook arrived at the mechanism first and the framing second.',
        '**2026 status: caching is a solved pattern with an unsolved contract.** Managed caches are a checkbox at every cloud provider, and the mechanics are commodity. What is still not commodity is knowing **how stale your cache is** and **which of your call sites gets the invalidation wrong** — and the paper answered both, once, in 2013, with a sampling harness most teams still do not have.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Look-aside cache.',
      body: 'The application checks the cache, and on a miss fetches from the source and puts it back. The cache is filled by its readers, never by its source.',
    },
    {
      term: 'Lease.',
      body: 'A 64-bit token handed to one client on a miss, at most once per key per 10 seconds. Must be presented on set, so it stops both herds and stale sets.',
    },
    {
      term: 'Stale set.',
      body: 'A cached value written out of order, so the older write lands last. Permanent, silent, and the reason invalidation is a delete rather than an update.',
    },
    {
      term: 'Thundering herd.',
      body: 'A hot key is invalidated and every reader misses at once, sending the whole fleet to the database in the same instant.',
    },
    {
      term: 'mcsqueal.',
      body: 'A daemon on each database that reads the statements it commits, extracts cache deletes, and broadcasts them. Change data capture, before the name.',
    },
    {
      term: 'Gutter.',
      body: 'A small idle pool, about 1% of the fleet, that catches requests for servers that stopped answering. Entries expire fast so nobody has to invalidate them.',
    },
  ],
  inTheWild: {
    note: '5 ways this bites in production',
    points: [
      '**One call site sets instead of deletes.** Somebody optimises a write path to push the new value into the cache and skip a future miss. It works in testing, and under concurrency it eventually writes a value that no later write will ever correct. The bug reports say “the number is wrong on my profile” and lead nowhere.',
      '**The herd arrives on the day the key gets popular.** A key with modest traffic is invalidated often and nobody notices. It becomes popular, and now every invalidation is a synchronised database spike. The database graph shows a sawtooth nobody can explain from the application logs.',
      '**A cache flush is a database outage.** Restarting a cluster, deploying a bad config, or losing a rack empties enough of the cache that the miss traffic exceeds what the databases can serve. The cache did not fail — it just stopped hiding how much load there really is.',
      '**Cross-region staleness gets discovered by a user.** Someone updates a setting in one region and reads their own stale value back, because the replica database had not caught up and nothing told the cache. Without a remote-marker equivalent, the fix people reach for is a sleep.',
      '**Nobody can say how stale.** Ask a team what fraction of their invalidations have landed one second after the write and you will usually get an estimate. The mechanism to answer it is a sampled delete and a checker, and it takes an afternoon — but only if someone decides the number matters.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Invalidate, do not update',
        when: 'the cache is not authoritative — which is nearly always. Deletes survive duplication, reordering and replay; sets do not. Accept that most deletes will be unnecessary; that waste is what makes the scheme safe.',
      },
      {
        choose: 'Drive invalidation from the log, not the writer',
        when: 'more than one process writes, or more than one cache reads. A message from the writer is gone once sent; a stream derived from the commit log can be replayed after a misroute, a buffer overflow or an outage. **This is the decision the rest of the act generalises.**',
      },
      {
        choose: 'Spend a mechanism on the hot key',
        when: 'a key is both heavily read and heavily written. Leases, request coalescing or single-flight all do the same job — let one caller through and make the rest wait — and the ratio between the herd and the coalesced peak is usually more than tenfold.',
      },
      {
        choose: 'Measure your staleness before defending it',
        when: 'anybody says stale data is acceptable here. It probably is. But “acceptable” needs a distribution, not an adjective, and a sampled invalidation checker will give you one in an afternoon.',
      },
    ],
  },
  misconception: {
    think: '“A cache is a performance optimisation.”',
    actually:
      'A cache is **an unmanaged replica**. It holds a second copy of data that is authoritative somewhere else, it is behind by an amount nobody usually measures, and it converges only because something keeps sending it corrections. Every question you would ask about a replication scheme applies to it — what is the lag, what happens to a lost update, what happens when two writers race, what happens when the stream stops — and the uncomfortable answer is that in most systems the protocol is not written down anywhere except as a convention in application code. Look at what Facebook had to build once they took the replica framing seriously: an idempotent primitive because messages get reordered, a token to arbitrate concurrent writers, **a daemon reading the commit log because in-flight messages cannot be replayed**, a standby pool so a failure does not become a stampede, a marker to route reads to the master when the local replica is behind, and a sampling harness to report the lag in nines. That is not a cache configuration. That is a replication protocol, arrived at one incident at a time — and it exists because the cache was a replica the whole time.',
  },
  sources: [
    {
      year: '2013',
      title: 'Scaling Memcache at Facebook — Nishtala et al. (USENIX NSDI)',
      url: 'https://www.usenix.org/system/files/conference/nsdi13/nsdi13-final170_update.pdf',
      note: 'Unusually readable for a systems paper, and organised by scale rather than by component — one cluster, then a region, then the world — which is a structure worth stealing for your own design docs. Read **§3.2 on leases** for the mechanism, then **§4.1** for mcsqueal, which is the paragraph this act is built on. **§7.3** is the invalidation-latency measurement almost nobody replicates.',
    },
    {
      year: '2013',
      title: 'Workload Analysis of a Large-Scale Key-Value Store — Atikoglu et al. (SIGMETRICS)',
      url: 'https://ranger.uta.edu/~sjiang/pubs/papers/atikoglu12-memcached.pdf',
      note: 'The companion the paper points you to for workload detail. Traces from Facebook’s memcached fleet in far more depth than §7 has room for: key and value size distributions, request rates, and hit rates over time. Read it if you have ever had to size a cache and resented guessing.',
    },
    {
      year: '2013',
      title: 'TAO: Facebook’s Distributed Data Store for the Social Graph — Bronson et al. (USENIX ATC)',
      url: 'https://www.usenix.org/system/files/conference/atc13/atc13-bronson.pdf',
      note: 'The other half of the same infrastructure, written the same year. TAO takes responsibility for persistence and models a graph rather than opaque keys — so reading the two together shows the same team choosing differently when the cache is allowed to know what the data means. They share client libraries and mcrouter.',
    },
    {
      year: '1989',
      title: 'Leases: An Efficient Fault-Tolerant Mechanism for Distributed File Cache Consistency — Gray & Cheriton (SOSP)',
      url: 'https://dl.acm.org/doi/10.1145/74851.74870',
      note: 'Where the lease comes from, twenty-four years earlier, in a paper about file caches — behind ACM’s paywall, though the PDF is easy to find on university course pages. Worth it for how completely the idea transfers: a time-bounded promise about a cached item, which turns an unbounded consistency problem into a bounded one. Chapter 4’s Chubby uses the same primitive for something else entirely.',
    },
  ],
  seenIn: [
    { label: 'The Cart That Must Not Close — Ch 5', to: '/papers/dynamo', live: true },
    { label: 'Consensus as a Service — Ch 9', to: '/papers/zookeeper', live: true },
    { label: 'Replication lag — the comic', to: '/ddia/read/replication-lag', live: true },
    { label: 'Redis — the deep dive', to: '/ddia/components/redis', live: true },
  ],
  finale: {
    title: 'The replica you already run, and the stream that keeps it honest',
    body: 'A cache is a copy of your data with no protocol, and this paper is what happens when a billion requests a second force you to write the protocol down. It arrives at an idempotent primitive because messages get reordered, a token because writers race, a standby pool because failure is contagious, and a lag figure in nines because “stale is fine” is not an engineering statement. But the piece that matters most for what comes next is the least glamorous: the invalidations come from a daemon reading the database’s own commit log, chosen because a stream can be replayed and a message cannot. Next: somebody looks at exactly that arrangement and asks the obvious question. Why is the log a private implementation detail of one database, tailed by one daemon, for one consumer? Make it a service. Let anything subscribe.',
  },
  next: { title: 'Write Once, Replay Everywhere', slug: 'kafka' },
}
