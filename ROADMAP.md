# DDIA, as a live comic — Roadmap

Where the project is headed. **The plan is this first section**; everything from
`Shipped` down is the record of what is already built, kept because the reasoning
behind each decision is worth more than the summary of it.

## Next up

Roughly the order I would do them in. The three long menus further down — app sims,
paper-driven components, the composer — are the longer game, and the sequencing note
at the end of this section says why they are not first.

**The comprehension track, the calculator-correctness track and the sims' engine fork are
done** (#30, #32–#38, #43, #45); what they found and what shipped is in `Shipped`. What is
left here is the cost calculator, one unfinished half of sharing, and one unsourced number.

### A third calculator: cost

**This one needs a conversation before it needs code.** The framing below — *ratios,
not prices* — is my answer to the maintenance problem, not an agreed one, and it is
the whole design. If the ratio framing is wrong, nothing under it survives.

The case for it being its own page rather than a column is the same one that kept
capacity and latency apart — **it is a different shape.** Capacity is division,
monotone and safe to extrapolate. Latency is a hockey stick that goes vertical well
before the ceiling. Cost is **linear when you rent and a staircase when you buy**: you
never pay for 1.3 machines, and that discontinuity is the lesson. It is also the only
one of the three whose answer can invert an architecture — capacity says "you need a
cache", cost says the cache outprices the database it protects, or that **egress
dominates the bill and appears in no capacity model anywhere.** Against the
`$0.023/GB-month` already in the S3 envelope, reading a GB out once costs roughly 4×
storing it for a month.

**The risk, which is unlike anything else on this site: prices expire.** Every other
constant here is physics or a published measurement — the speed of light is not
repriced, and Netflix's 1.1M writes/s stays true as a historical fact forever. A price
list is true until a vendor changes it, and then the page is silently wrong with no
error anywhere. That is a different maintenance class from the rest of the project.

**So build ratios, not prices.** Egress ÷ storage. Per-request price ÷ object size —
the small-object tax the S3 page already computes, where a 1 KB object costs ~18× its
monthly storage on *every* read. Managed ÷ self-run. Cloud-year ÷ purchase price, and
where the crossover lands. Ratios move far more slowly than absolute prices, and the
architectural decision lives in the ratio anyway. Absolute dollars go behind one dated
constants table carrying the same `MEASURED` / `ASSUMED` treatment as everything else.

Anchors for the reality tests, in the established style: Dropbox's S-1 (~$75M saved
over two years moving off S3), 37signals' published repatriation numbers, and the COST
paper already cited on the web deep-dive. A second win: `estCostUSD` in the
observability sim is currently `~$0.10/GB` with no source — the weakest number on the
site — and would import from a real model the way the latency page imports from
capacity instead of restating constants.

### Sharing — one half left

State-in-the-URL and per-route metadata shipped (#39, #42). The share **buttons** were
built (#40) and then removed at Sam's call (#41) — see the `Shipped` entry, which
records both what was built and the process mistake that produced it. One item remains:

- **Per-page OG images**, so the preview *picture* varies with the page. The words
  already do: 24 routes carry their own title and description, but all 24 sit on the
  same picture. The renderer already exists — headless Chrome over an HTML template —
  it just produces one card today. **Not obviously worth 24 renders**: the words are
  what a reader reads in a chat client, and this is the half that only changes the
  thumbnail.

### Loose end from the sims

`estCostUSD` in the observability sim is still `~$0.10/GB` with no source — the weakest
number on the site. It is listed under the cost calculator above because that is where it
would import from rather than restate; if the cost page never happens, this number still
needs either a citation or an `ASSUMED` label.

### Sequencing — why none of the big menus are first

The composer's own gate says to build it only once the component library is rich
enough to be worth composing, and **six flagship deep-dives and twelve comics already
clear that bar.** A seventh component makes the site longer, not better. Meanwhile the
two weakest surfaces are the experimental sims and comic comprehension, and both are
about how the depth that already exists *lands*. So: sharpen before building. The
composer stays the exception, because it is the synthesis rather than more of the same.

### Loose ends

- **Cloudflare toggles** — Always Use HTTPS (`http://systemscomic.com` currently
  serves plaintext with no redirect) and a `www` CNAME plus redirect rule
  (`www.systemscomic.com` does not resolve).
- **3 merged remote branches** — `concurrent-defined`, `roadmap-next`, `set-live-url`,
  each carrying a squash-merged PR (#36, #31, #28), safe to delete. (This line said
  **27** for weeks, never recounted after the cleanup that removed most of them. Note
  that `git branch -r --merged origin/main` reports **none** of the three: every PR here
  is squash-merged, so the branch tip is not an ancestor of `main` and the ancestry
  check is useless on this repo. `gh pr list --head <branch>` is the one that answers.)

## Shipped

- ✅ **The two sims run on one engine again** (#45). They had been running on *copies* of
  one engine — 973 and 927 lines differing in 118 — for long enough that the observability
  copy still opened "Feed at Scale", still declared a class named `FeedEngine`, and its
  model carried two shims written for a shared engine that did not exist. 1,900 lines
  became 1,264, and the geo-map subsystem moved into the feed, which is the only sim with
  map stages.

  Verified by pixel-diff rather than by argument: seeding `Math.random` and pumping rAF by
  hand makes a run reproducible frame-for-frame (two runs on `main` came back
  byte-identical, which is what makes the comparison mean anything). Every feed frame was
  unchanged; every observability frame differed in exactly one 52×12 box — the node
  caption, changed on purpose. **That caption was the fork's real damage:** the
  observability engine had inherited the feed's `subLabel`, so it branched on `pgP`,
  `redis` and `kafka` — kinds no observability pipeline has — and had no branch for the
  indexer it draws. The visible symptom was an indexer reading `6×` while federation gave
  it 8× the slots.

  `engine.test.ts` now checks each sim's hooks against its own model. **The first version
  of that test passed against a deliberately broken engine** — it matched `kind === '…'`
  with single quotes and the bundler rewrites literals to double quotes, so it matched
  nothing and reported success. Third time this class of bug has appeared here; it is
  why every new guard gets broken on purpose before it is trusted.
- ✅ **Comprehension: the whole track, and two verification tools that were lying.**
  Six PRs against the audit finding that some pages "are not that straight and easy to
  understand enough".
  - **Quorums say what they do not do** (#30). Leaderless writes are not sequenced by
    anything, and `W + R > N` guarantees a read *sees* every candidate value while
    saying nothing about which is right. Freshness and resolution are different
    problems, and the page had let them read as one.
  - **`concurrent(v1, v2)` is no longer magic** (#36). The call was on screen with
    nothing behind it; version vectors were named three times and defined none. Now
    defined in the `deeper` fold-out with a two-counter-map figure — and kept out of
    the Rung 1 body on purpose, since Cassandra is last-write-wins and DynamoDB
    dropped vector clocks, so most readers will never operate one.
  - **In-the-wild bullets can carry a figure** (#33, #34). `InTheWild.points` was typed
    `string[]`, so the wall of text was a wall *by construction*. Typed as
    `(string | WildPoint)[]`, then one figure per comic — not one per bullet, which
    would have been 49 drawings and a different kind of wall.
  - **Forward references, swept and then guarded** (#35). Two real gaps found; six of
    the ten "hits" were my matcher hitting `next: { slug }` nav links and the `term:`
    field name. `glossary.test.ts` now fails on a term used before the comic that
    defines it, and a second test asserts each of the three recorded exemptions is
    *still* a genuine forward reference — an exemption list nobody re-checks becomes
    a list of things that used to be true.
  - **Ch 6 companion — Choosing the Partition Key** (#43), the twelfth comic. The hole
    it fills, recorded because it is the strongest argument this project has for a new
    page: hash vs range is how DDIA *opens* Ch 6, before consistent hashing, and this
    site gave it two rows of a tradeoffs table — while **three shipped surfaces
    depended on the distinction and none taught it**. The capacity calculator's *first*
    requirement row is `Fetch one thing / Scan a range`, and its own info text calls
    the sort key "the most consequential schema decision you will make". The **hot
    range** is a full cascade trace on the S3 deep-dive — the date-prefix disaster *is*
    a timestamp partition key — and the concept behind it got four words. **Compound
    keys** appeared once sitewide, as a fix in a Kafka runbook row. It was not new
    surface; it was a hole under existing pages, which is why it earned an exception to
    "sharpen before building". Deliberately *not* bolted onto the consistent-hashing
    comic, whose single misconception is clean and would have been blunted by a fifth
    step about a different decision. Hash → what hashing costs (scatter-gather, which gets
    *worse* as you add nodes) → what sorting costs (the hot range, and the clock only
    moves one way) → the compound key. Local vs global secondary indexes went in the
    fold-out rather than becoming a fifth step. Its index card shipped blank for one
    commit, saying "in the sketchbook" beside a working link; `index-page.test.ts` now
    asserts every comic has a card, under the title it advertises, with a panel drawn.
  - **Two tools were passing without checking anything.** `npm run check:diagrams`
    reported OK while measuring **zero** diagrams — it had been green through an app
    that 500'd on a duplicate export. It now opens every `<details>` first
    (`getBBox()` returns zeros in a `display:none` subtree, so a figure in a collapsed
    bullet measured as a point at the origin), fails on any page error, fails if a
    comic yields no diagrams, and prints the count. Separately, **`npx tsc --noEmit`
    checks nothing here** — `tsconfig.json` is solution-style (`"files": []` plus
    references), so it exits 0 having verified nothing; the real gate is
    `npm run typecheck` (`tsc -b`). Every "typecheck ✓" from the wrong command was
    vacuous.
- ✅ **The calculator's own correctness** (#32). Two findings from tracing the
  requirement filters, and neither is a CAP problem — **CAP cannot bind on that panel
  at all, because none of the seven requirements asks about availability.** You cannot
  violate a theorem whose third term you never requested, and "must be current" is
  read-your-writes on the primary path, not linearizability. That is now said out loud
  in "what it will not tell you".
  - **Nothing enforced that a survivor exists.** No combination empties the candidate
    list, but only because sharded SQL passes every filter *structurally* — an
    accidental universal survivor. Had `alive` ever emptied, `alive.reduce(…, alive[0])`
    seeds with `undefined` and the `!` asserts it away: a crash or silent garbage, not
    a graceful "nothing fits". All **64** combinations are now swept at three load
    scales, plus a canary that names `sqlShard` as the store the guarantee rests on —
    so if the thing holding it up changes, the test says which thing.
  - **"Must be current" contradicted "who else must see each write".** Derived systems
    are fed asynchronously — that is why the page starts recommending a log at two of
    them — so *must be current* cannot be true of the copies at any budget. The tension
    is surfaced where the two rows meet.
- ✅ **The sims got a correctness floor** (#37, #38). They had no tests at all. The
  harness reads each mission goal's **source** rather than calling it, because `&&`
  short-circuits and a goal can pass without ever reading the control it claims to be
  about. It immediately found one: a break-it-then-fix-it mission whose payoff goal was
  **already ticked on arrival**. Separately, sparse stages drew a handful of nodes
  adrift in a large canvas; both engines now compute a zoom in `layout()`.
- ✅ **Sharing, and one thing I got wrong about how to take a request** (#39–#42).
  Calculator state now lives in the URL, so a dialled-in scenario is a link — the model
  is a pure function of its inputs, and that claim was unusable while the inputs could
  not travel. 24 routes carry their own title, description and card tags, emitted as
  flat `dist/<route>.html` at build time (scrapers do not run JS; and the
  `<route>/index.html` form makes Cloudflare **307** to a trailing slash first — found
  by running real `wrangler dev`, not by reasoning about it). Two bugs worth keeping:
  `Number('')` is `0`, not `NaN`, so a truncated `?dau` link silently set daily actives
  to the bottom rung; and constants the page decides for itself leaked into shared
  URLs until `DECIDED` was threaded through both encode and decode.

  **The process mistake:** Sam asked for a share-to-social button. I reframed it into
  URL state and OG cards, wrote *my* version into this file titled "buttons last" with
  a line arguing "share on X" does not travel — and built that. The reframe was worth
  having; substituting it for the request was not. The button was then built (#40) and
  removed at Sam's call (#41), along with the calculator's copy-link. **A reframe goes
  alongside the request, not instead of it.**
- ✅ **The concept lens is drawn — 11 of 11 ideas live** (twelve now, with the Ch 6
  companion above). Part I gained **Ch 1 · Tail
  Latency** (the average is nobody's experience; `1 − 0.99¹⁰⁰ = 63%` for fan-out *and*
  for a 100-request session; hedged requests taking 1,800 ms → 74 ms; and why the cache
  did nothing for the tail). Part III gained both of its chapters: **Ch 10 · The Shuffle**
  (the sort in the middle is the job; broadcast and pre-partitioned joins as ways to not
  move data; one hot key making the cluster irrelevant — Amdahl in a third costume) and
  **Ch 11 · Stream–Table Duality** (a log is not a queue, which is the entire trick;
  compaction bounded by key cardinality rather than history; and dual writes as the bug
  the duality actually fixes — the same "one log, many consumers" the capacity page starts
  recommending at two derived systems). Nine new diagrams, all passing `check:diagrams`.
  Chapter numbers now say **DDIA 1st edition** everywhere they appear, since the 2nd
  edition renumbers.
- **Component deep-dives** — flagship, 9-chapter treatment per infra component.
  - ✅ Kafka (flagship template: abstraction → anatomy w/ animated traces → hardware
    envelope → scale up/out → ops runbook + failure cascade → large-cluster reference → papers)
  - ✅ Postgres (UPDATE trace through parser/planner/executor/buffer pool/WAL, MVCC +
    vacuum lifecycle trace, PG hardware envelope, read/write-asymmetry sandbox, pager
    runbook + idle-transaction cascade, Notion sharding reference + fleet trace)
  - ✅ Redis (event-loop trace, fork/COW persistence trace, one-core hardware envelope,
    hot-key shard sandbox, whale-key cascade + runbook, Redis Cluster fleet trace —
    first page built from the `scalelab-design` skill)
  - ✅ RabbitMQ (publish→exchange→queue→ack trace, BEAM/watermark anatomy trace,
    per-node envelope with the alarm line, two-ceiling scale-out sandbox,
    slow-consumer-freeze cascade + runbook, production-estate trace with the
    Kafka handoff)
  - ✅ Web / app tier (request trace through four queues nobody instruments — the
    kernel accept backlog and the pool checkout wait; the autoscaler as a control
    loop with 3–5 minutes of dead time; a slot-not-CPU envelope carrying the M/M/1
    multiplier imported from `latencyModel`; a scale-out sandbox that reports what
    the clones *multiply* — connections, deploy headroom, queueing; the retry-storm
    cascade as a metastable failure; and Stack Overflow's nine servers, where
    `L = λW` on their published counters gives ≈ 6 requests in flight per box)
  - ✅ S3 / object storage (a GET from SigV4 to first byte and a PUT showing
    durable-first/visible-second, which is where strong read-after-write comes from;
    an envelope for a service you do not own — rate limits and a price list, with
    the SDK connection pool and the small-object tax as the two ceilings nobody
    expects; a prefixes-and-CDN sandbox that reads the invoice as a capacity signal;
    the date-prefix cascade where retrying prevents S3's own repartition from
    finishing; 2013 → 2025 scale figures with the interface unchanged)
  - **All six components are now flagship**, so `CLASSIC_MODULES`, `ClassicModulePage`
    and the `/components/:key` catch-all are gone. `ModulePanel.tsx` is just the
    `Sandbox` widget now, and `types.ts` lost `ModuleDef`/`ModuleContent` for a single
    `SandboxContent`.
  - `sandboxes.test.ts` makes "drag every slider to both extremes" permanent: it sweeps
    all six `compute()` functions to both ends of every ladder and both corners, and
    asserts no rendered string says NaN/Infinity and no meter percentage is non-finite.
    It found a real one on its first run — a 0% target-utilization rung divided the web
    fleet size by zero and reported `Infinity` connections.
  - Next: the Topology Composer, or more components from the papers (Cassandra, etcd/Raft).
- ✅ **The comic diagrams are live — where the idea is about time.** Five of the 33
  panels move, because what they explain is a process: replication lag (writes
  crossing a gap that never closes, stale plate breathing), the LSM write path
  (memtable fills → flushes → compaction lands the merged file), a Raft election
  (votes arriving in sequence, then the majority beat), a timeout (heartbeats
  missing → "A is dead" → the zombie wakes, one 6s clock), and the partition
  stampede (keys in flight). The other twenty-eight stay still on purpose —
  motion on a structural drawing explains nothing the still frame didn't.
  Only `transform`, `opacity` and `stroke-dashoffset` are animated: none of them
  change what `getBBox()`/`getPointAtLength()` report, so `npm run check:diagrams`
  still measures shipping geometry (verified green with animations running). Every
  declaration is gated on `prefers-reduced-motion: no-preference`, and the
  reduced-motion render was checked **byte-identical** to the pre-animation
  diagrams. Reserved class prefix: `gn-an-*`.
- ✅ **Order-of-magnitude sliders everywhere.** Every sandbox on the site now snaps
  to a 1-2-5 ladder like the capacity calculator — no more "557k/s" implying a
  measurement, and no more "2,175.8 MB/s" claiming six significant figures built on
  a shrug. Derived readouts round to two significant figures (`fmt.sig`, `fmt.mbs`).
  Shared ladders + slider live in `src/deepdives/ladder.tsx`; `InputDef.min/max/step`
  became `InputDef.steps`. Not everything is a ladder — a count that is small and
  exact (3 brokers, RF 2, RAM in powers of two) is a *choice*, not an estimate, so it
  keeps every value. `inputs.test.ts` enforces two rules across all six sandboxes:
  every default sits on a rung (an off-ladder default renders the thumb on the
  nearest rung while the label prints the stored value — the panel contradicts itself
  before you touch it), and every ladder climbs.
- ✅ **Storage-first calculator.** The decision the tool exists to make is where data
  lives, so that decision is now decomposed into the four dimensions that actually
  differ — **data model · storage engine · distribution · atomicity scope** — across
  six real compositions (single-primary SQL, sharded SQL, document, wide-column ring,
  column-oriented, in-memory KV). "SQL vs NoSQL" is a marketing split, not a mechanical
  one; keeping engine and distribution separate matters because choosing an LSM engine
  used to silently choose ring-based partitioning too. Two requirements were missing and
  are now filters: **how reads find the data** (point lookup disqualifies the column
  store — a row lives spread across every column file) and **how fresh reads must be**
  (must-be-current puts the cache on the write path and rules out async replicas, which
  is where the tool could previously give confidently wrong advice). Transport is
  demoted: it only becomes a comparison table when something must be pushed. Guarded by
  tests that assert each dimension filters independently, and that stores sharing an
  engine tie on the numbers — so what separates them is the requirement, never an
  invented constant.
- ✅ **Reality-tested against published architectures.** The calculator's arithmetic is
  pinned to numbers real operators published: Twitter's 345k deliveries/s, WhatsApp's 2M
  connections per box, Netflix's 1.1M writes/s on 288 Cassandra nodes (per-node flat at
  10.9–11.9k, which is what linear scale-out means), Facebook's memcache paper, Uber's
  40M req/s cache at a 99% hit rate, Discord's wide-column ring, Slack's 2.3M QPS on
  sharded MySQL, and the published shard-split thresholds (Vitess 250 GB, Cash App 1 TB,
  Notion 10 TB per physical database). Each is a test, not a claim.
  **The most valuable finding was where the model is structurally blind.** Discord and
  Slack store chat with the same access pattern and made opposite choices; four companies
  (Uber, Slack, Figma, Instagram) justified their storage pick by operational familiarity
  and never by a technical capability. A page that scores only workload fit will
  confidently disagree with all four, so it now says so in "what it will not tell you".
  Resharding cost is stated with both extremes — Google's AdWords MySQL took "over two
  years of intense effort across dozens of teams", DynamoDB splits "in the order of
  minutes", and automatic is not free either (a Cassandra node measured 106 hours to
  stream 2.2 TB plus three weeks of compaction) — and deliberately not scored.
- ✅ **Every number traceable, and a sensitivity sweep that found a bug.** Four changes,
  all aimed at the same complaint: the verdict was a wall of prose in which "19 shards"
  and "8.7%" appeared as assertions. (1) The verdict is now **sections** — ruled out ·
  what is left by the time it reaches a store · a table of how close each survivor gets ·
  headroom · so — and every computed number is a **click that jumps to the ceiling it was
  divided by** and flashes that row. There is now a *Write stream* ceiling row, because
  the engine table had been measuring against a wall the reader was never shown.
  (2) Each column names **real products and one operator running it at a published
  scale** — Stack Overflow on one SQL Server primary, Slack's 2.3M QPS on Vitess,
  DynamoDB's 89.2M req/s Prime Day peak, Discord and Netflix on the ring, Cloudflare's
  6M req/s into ClickHouse, Facebook's memcache fleet. (3) The page states its **scope**
  up front — rates, bytes and machine counts against eight ceilings; *no* latency, money,
  correctness or skew — and that the answer is **a pure function, not a judgement**:
  same inputs, same output, every number a division printed beside it.
  (4) **"The numbers pick" is not "the only one that works."** Said outright, plus:
  pinning any surviving column now produces a computed diff of what that choice costs —
  its first wall, what stops being atomic, who owns the resharding, and which forced
  components change. Writing that diff exposed a component the page had never
  recommended: **a plan for transactions that cross a shard**, which fires for the
  ledger preset at 8 shards.
  Two habits borrowed from *Computer Architecture: A Quantitative Approach*.
  **Amdahl's law** on the ceilings: each store binds on one wall while the other idles,
  so the verdict now prints how far the first wall is *and* the ratio to the second —
  the entire budget any fix has to spend. And **report the sensitivity, not just the
  estimate**: every constant is moved one rung on its own ladder, the whole model
  re-run, and only the moves that change an *answer* are listed. It earned its keep
  immediately — it caught a live ranking bug where deciding the cache **per store** let
  a store cross the 30% threshold *because* it reads badly, collect the 90% discount,
  and then score better at reads than the store whose reads were cheap enough not to
  need one. "Worse at reads wins", for the second time. The cache is now decided by the
  read rate against one node's ceiling, so every column is judged on identical incoming
  load; the artifact is pinned by a regression test.
  **The comparison table was also unreadable, and measuring said why — it was not
  width.** Row labels took 183px of a 647px table (28% of the comparison spent on
  captions, because `nowrap` sized the column to its longest label), and every data row
  printed the same caption in all six columns: "misses only, behind its cache" ×6, "of
  3 GiB/s" ×5. A caption true of the whole row now belongs to the row, the label column
  wraps and is capped at 118px, and per-cell prose keeps only what differs. That alone
  took columns **69–82px → 81–95px** and the table **781px → 577px tall**, with every
  cell one or two lines instead of four to seven.
  Widening the page was tried and **reverted**: the columns did get roomier (115–132px),
  but the page then carried two measures, and every panel had to be re-balanced around
  the wider one — half-empty prose cards, a note flowed into columns, a word-break rule
  that leaked out and split "VERDICT" into "VERDIC/T". More cost in consistency than the
  columns were worth. The sandbox split is now explicit (`minmax(280px, 344px) 1fr`)
  rather than falling out of whichever table had the widest min-content.
  Kept from that detour, because they were real bugs: grid items get `min-width: 0`, the
  output tables wrap instead of setting a min-content floor, and the two prose-wide
  tables scroll in their own boxes — so the page no longer scrolls sideways at any width
  (it did before, from ~1000px down). Only genuine jargon carries a gloss: "hand-rolled"
  gets an info icon (no middleware — the application works out the shard itself; Notion
  by workspace id, Figma via a proxy it spent nine months building), while PostgreSQL and
  Cassandra do not need one. Each store's scale claim links to the post it came from.
- ✅ **The latency budget** (`/calculator/latency`) — a second calculator, deliberately not
  merged with the first. Capacity is division: load over ceiling, monotone, safe to
  extrapolate. Latency is a hockey stick that goes vertical well before that ceiling — at
  43% of a capacity ceiling you are already waiting three-quarters of your service time in
  a queue — so one panel implying they behave alike would hide the single most important
  fact. Two routes under one nav item, because a tab held in component state cannot be
  linked and a fifth nav item would worsen the ≤700px overflow.
  You state a p99 target and the page **spends** it: **physics floors · hops add ·
  utilization multiplies · fan-out amplifies the tail**. It names the largest term and
  ranks the fixes in milliseconds. It refuses to predict a p99 — a queueing network with
  assumed distributions is confidently wrong — so every term is closed form and the one
  assumed distribution (the tail shape pricing fan-out in ms) is marked and shown.
  **The useful half is "what will not help":** a cache does nothing for your p99 until the
  hit rate passes 99%, because below that a p99 request is by definition a miss; no amount
  of capacity touches the speed of light; a faster median is nearly invisible under fan-out,
  where you need one server's p99.99. Anchors as tests: Dean & Barroso's 63% reproduces
  exactly (1 − 0.99¹⁰⁰), a 100-way fan-out needs p99.99 (0.99^(1/100)), NY–London is
  55.85 ms theoretical / 78 ms routed against a published 70–80 band, and the datacenter
  floor is napkin-math's measured 500 µs rather than the wire.
  Constants and controls are imported from the capacity page, never restated. Its ladder
  invariant immediately found a **live bug there**: `fsync` defaults to its measured 300 µs
  while `L.us` went …200, 500…, so that thumb had been rendering on 200 while the label read
  300 µs — `inputs.test.ts` only ever walked the six sandboxes, never the calculator.
  The cross-link is the point of keeping them adjacent: every component the capacity page
  forces is also a hop, so those cards now link to what they cost in milliseconds.
- ✅ **Component math reconciled with the calculator.** Two real inconsistencies.
  Redis assumed 5 µs per command (~194k ops/s at 512 B) — above the top of the
  published unpipelined range; it now uses the calculator's 10 µs, which
  `redis-benchmark`'s 72k–180k supports. Postgres modelled no fsync wall at all, so a
  96-core box implied 80k TPS on CPU alone; it now carries a **commit durability**
  meter derived exactly as the calculator does (8 commits per fsync ÷ 300 µs ≈
  27k/s) — the ceiling cores cannot buy past, because a commit waits on the disk, not
  the CPU. Kafka's "~10 MB/s per partition" is relabelled as the operational
  guideline it is (recovery and rebalance time), not a disk limit: a partition is a
  sequential append and the disk streams GB/s.
- ✅ **`scalelab-design` skill** (`.claude/skills/scalelab-design/`) — codifies the
  hard-won UI/animation patterns (validated palette, label shrink-to-fit, edge-port +
  waypoint routing, runbook/tile/meter/trace styles, nine-chapter template + wiring
  checklist). The "nothing overlaps a label" invariant is now *enforced*: a dev-mode
  trace lint (`src/components/traceLint.ts`) console-warns any particle route that
  cuts through a node, any overlapping/off-canvas node, or unknown ids.

## App simulations (gallery)

- ✅ Social Feed (`/sims/feed`) — local → global, fan-out, hot keys, sharding.
  Reworked as a **guided mission lab**: capped/centered topology, per-stage goal
  checklists that latch as you trigger each lesson, KPI strip, bottleneck auto-tag,
  and an honest latency model (queue+service only — travel animation no longer
  counted, which had been drowning the queueing signal).
- ✅ Observability at Scale (`/sims/observability`) — logs/metrics/traces pipeline as a
  mission lab: single box → Kafka buffer → scale the index tier → **cardinality explosion**
  (the wall horizontal scaling can't climb) → hot/cold storage tiering with a live cost
  estimate → federate + per-team quotas. Reuses the Feed engine with observability hooks
  (cardinality inflates index/query cost; clusters multiply index capacity). Pairs with a
  planned **ClickHouse** flagship deep-dive (the storage box's spec sheet).
- E-commerce checkout — inventory contention, flash sales, sagas.
- Food delivery (FTGO) — choreographed multi-service sagas.
- Chat / messaging — websockets, connection scaling, ordering.
- Video streaming — transcode queue, CDN, object storage.

## New-domain components (paper-driven)

Cassandra · DynamoDB · Flink · etcd/Raft · ClickHouse · MotherDuck/DuckDB · Ray ·
Spark · inference engines (vLLM) · "Inside a web server" (concurrency models + TechEmpower).

## Ship it

- ✅ **Deployed — [systemscomic.com](https://systemscomic.com).** A static-assets
  Cloudflare **Worker**, not Pages: the "Connect to Git" flow now creates a Worker and
  runs `wrangler deploy`, which auto-detects Vite and refuses below v6 — so the answer
  was to state the deployment explicitly in `wrangler.jsonc` rather than chase a major
  upgrade for a plugin this site would not use. The SPA rewrite is
  `not_found_handling: "single-page-application"`, and it is the *only* fallback:
  a Pages-style `public/_redirects` with `/* /index.html 200` failed the deploy
  outright, because Workers validates that file server-side and correctly calls a
  catch-all rewriting to a path the catch-all also matches an infinite loop. Shipped
  alongside it: route-level code splitting, a 1200×630 OG card, `_headers` (immutable
  assets, revalidated index), README + MIT licence, and the repo renamed to
  `ddia-live-comic`.
  Two lessons worth keeping. `wrangler deploy --dry-run` does **not** exercise
  server-side validation, so a config can pass locally and fail on deploy. And route
  splitting is a cascade hazard: lazy chunks changed stylesheet *order*, which flipped
  the winner between two rules of identical specificity and overlapped a table's text.
  All stylesheets are now imported from `main.tsx` in explicit order, theme last, and
  the overrides were rewritten to be order-independent.
- **Support / sponsor** — a Support section with a sponsor QR (GitHub Sponsors / Ko-fi).

---

## ★ North star (phase 3): the Topology Composer

**Idea.** A sandbox where users drag in infra components (web tier, LB, Redis, Postgres,
Kafka, S3, …), wire them together, define traffic, and watch their *own* architecture
scale and break. The deep-dives teach each block in isolation; the app sims show fixed
compositions; the composer is the synthesis — "build whatever you want and watch it break."

**Why it's the north star.** It's an *evolution of the Feed engine*, not a rewrite:
nodes-as-queues, particles, metrics, and the edge-port + waypoint routing are already
built. The component deep-dives are already the capacity "spec sheets" for each box.

**The hard part (design around this, don't fight it): traffic semantics.** A blank canvas
of boxes has no notion of what a "request" *does*. The make-or-break design decisions:

1. **Typed components with typed ports.** A web tier *emits* DB queries + cache ops +
   events; a DB *accepts* queries; a cache *accepts* ops and branches on hit/miss.
   Connections are type-validated, so "what flows" is well-defined and nonsense wiring
   is impossible.
2. **User-defined request flows.** The user clicks a path to define a request type
   (like our route arrays, authored in the UI). The existing engine handles the rest.
3. **Frame it as bottleneck-finding, not prediction.** "Push traffic, see which box
   reddens first, and what fixes it" stays honest with rough per-component math.
   "Predict your exact p99" is fragile queueing-network math — avoid promising it.
4. **Start from "fork a template," not blank canvas.** Let users open the Feed /
   e-commerce topology and modify it (insert a cache, add a replica, split a service).
   Lower risk, same thrill; blank canvas comes later.

**New work required:** the typed-port model, the flow editor, and auto-layout/routing for
arbitrary user graphs (elkjs / dagre for layout).

**Sequencing:** build this only *after* the component library is rich enough to be worth
composing and the design patterns are locked into the skill. Building it on a library of
three boxes wastes the idea. Until then: **make every new component a clean, typed,
self-describing module so it's "composer-ready" from day one.**
