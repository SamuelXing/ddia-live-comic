import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { VectorClockDiagram, DivergenceDiagram } from '../diagrams'
import { dynamoCartTrace } from './dynamo-trace'

/* Opens Act II. The chapter deliberately does NOT argue CAP — the interlude
   after this one does that, and doing it here would spend the reader's
   attention on a theorem before they have felt the pressure that makes the
   theorem interesting. What is Dynamo's alone: that removing the master is
   the easy half, and the expensive half is that somebody now has to decide
   which of two carts is real, in code, forever. */

export const dynamo: Chapter = {
  slug: 'dynamo',
  act: 'Act II · Availability at Any Cost',
  paperNo: 'Paper 5',
  title: 'The Cart That Must Not Close',
  dek: 'Act I hung everything on one machine being allowed to decide. Amazon prices what that costs at checkout, refuses to pay it, and finds out what you owe instead.',
  minutes: 16,
  paper: {
    title: 'Dynamo: Amazon’s Highly Available Key-value Store',
    authors: 'DeCandia, Hastorun, Jampani, Kakulapati, Lakshman, Pilchin, Sivasubramanian, Vosshall & Vogels',
    venue: 'SOSP',
    year: '2007',
    url: 'https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf',
  },
  caption:
    'Everything in Act I is unavailable at the same moment for the same reason: nobody has been appointed yet. GFS waits for a master, Bigtable waits for a tablet server’s lease, Chubby waits for an election, and each of those pauses is fine because the thing on the other side of it can wait. **Amazon has one that cannot.** A customer clicking *Add to cart* during a bad network minute is a customer who has decided to give you money, and a system that answers *try again* has already refused it. Act I would call that a partition and log it. This paper calls it a lost sale, and rebuilds the storage layer around the difference.',
  steps: [
    {
      n: 'Step 01',
      title: 'A requirement nobody in Act I would accept',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'Write the requirement down in its strongest form and it sounds unreasonable: **the write is accepted, whatever is broken.** Not *retried until it succeeds*, not *queued and applied later* — accepted, acknowledged, and durable, while a machine is down or a datacentre is unreachable. The paper puts the ambition in a single phrase that is doing a lot of work: an *“always writeable”* data store.',
        'And the scale it has to hold that promise at is ordinary retail scale on an extraordinary day. The shopping cart service **served tens of millions of requests leading to well over three million checkouts in one day**, on an infrastructure of tens of thousands of servers where, in the authors’ words, *“there are always a small but significant number of server and network components that are failing at any given time.”* Failure is not the incident here. It is the operating condition.',
        'There is a second constraint that shapes the design just as hard, and it is about *when* you are allowed to be slow. Amazon states its internal contracts at the **99.9th percentile** rather than the mean, because a page is assembled from **over 150 service calls** and the customer experiences the worst of them, not the average. The target quoted for services on Dynamo is **300ms for 99.9% of reads and writes.** So the answer cannot be *wait for the network to settle*, and it cannot be *ask four machines and take the slowest*.',
      ],
      code: {
        file: 'the_requirement.txt',
        lines: [
          { t: 'Act I, every chapter:' },
          { t: '  one machine is appointed to decide' },
          { t: '  → nobody appointed yet = nobody can write', hl: 'bad' },
          { t: '' },
          { t: 'Amazon, the checkout path:' },
          { t: '  "add to cart" refused = a sale refused', hl: 'bad' },
          { t: '  and no customer was ever consoled by an' },
          { t: '  explanation about network partitions' },
          { t: '' },
          { t: 'so the write must be accepted DURING the' },
          { t: 'failure, with nobody left to ask', hl: 'good' },
        ],
      },
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'It is 2006. You have read every paper in Act I, and each one solves your problem by appointing somebody. That option is gone. What you keep from Act I is the ring from consistent hashing and the habit of replicating three ways; what you have to invent is what happens when two machines both said yes.',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**The promise:** a write is never refused — not during a node failure, not during a network partition, not while a datacentre is dark',
              '**The workload:** get and put on one key, values usually **under 1 MB**, nothing spanning two keys, no schema and no joins',
              '**The clock you are judged by:** the **99.9th percentile**, not the average — a page assembles from over 150 service calls and the customer feels the slowest one',
              '**The machines:** commodity boxes, tens of thousands of them, spread across datacentres, with some fraction always broken. One instance is **a few hundred nodes**',
              '**Who is calling:** Amazon’s own service teams, one Dynamo instance each, and they are allowed to be told things about their data that a database would normally hide',
            ],
            questions: [
              {
                q: 'A customer adds an item. The machine that owns that key is unreachable. The write must still be accepted. Where does it go?',
                options: [
                  {
                    label: 'To the key’s leader, with a fast failover when it dies',
                    verdict: 'dead',
                    why: 'This is Act I, and Act I is exactly what fails here. Between the old leader going quiet and a new one being agreed, the key has no one who may accept writes — Chubby measured a typical fail-over at fourteen seconds, and fourteen seconds of refusing carts on a December afternoon is the thing you are being paid to prevent. Worse, a client on the wrong side of a partition cannot reach any leader, however quickly you elect one.',
                  },
                  {
                    label: 'To the N nodes that own the key, failing if fewer than N answer',
                    verdict: 'dead',
                    why: 'A strict quorum makes availability a function of which specific machines are up, and you have just built a system whose whole purpose is to not care. The paper is blunt that this approach *“would be unavailable during server failures and network partitions, and would have reduced durability even under the simplest of failure conditions.”* You do not need the general case to see it — one dead node out of three, W set to two, and the next disk hiccup refuses a sale.',
                  },
                  {
                    label: 'To the first N healthy nodes on the ring, owners or not',
                    verdict: 'move',
                    why: 'Walk clockwise past the machines that are down and hand the copy to whoever is up, tagged with a note saying who it was meant for. That node holds it in a side table and delivers it when the intended owner returns. Availability now depends on **how many nodes are up**, not on *which* — and the paper names the compromise honestly rather than dressing it up: a **sloppy quorum**, with **hinted handoff** cleaning up afterwards.',
                  },
                  {
                    label: 'To whichever node the load balancer picked, held locally until an owner appears',
                    verdict: 'dead',
                    why: 'Now one arbitrary machine is the only copy of a real customer’s cart for an unbounded time, so a promise about durability has quietly become a promise about that machine’s disk. And a read arriving at the proper owners cannot see the write at all, because nothing routes to the node holding it. You have made the write succeed by making it invisible, which is a strange definition of success.',
                  },
                ],
              },
              {
                q: 'Two nodes accepted a write for the same cart while they could not see each other. Both are back. Which version is the newer one?',
                options: [
                  {
                    label: 'Compare wall-clock timestamps; the later one wins',
                    verdict: 'dead',
                    why: 'Two failures, stacked. Clocks on commodity machines disagree by more than the gap between the two writes, so the winner is decided by whose NTP daemon drifted which way. And even with a perfect clock, *later* is the wrong question — one of those versions holds an item the customer added, and picking a winner throws it in the bin without telling anyone. This is the right answer for a session token and a catastrophe for a cart.',
                  },
                  {
                    label: 'Keep one counter per object and bump it on every write',
                    verdict: 'dead',
                    why: 'A single counter cannot tell apart the two cases that matter. Version 2 written after seeing version 1, and version 2 written by somebody who never saw the other version 2, produce the same number — and the first is safe to overwrite while the second is a conflict you must not silently resolve. **One counter compresses the history into something that cannot distinguish “after” from “beside”**, which is the only distinction you need.',
                  },
                  {
                    label: 'Hash both values and compare the hashes',
                    verdict: 'dead',
                    why: 'That answers a different question. A hash comparison tells you the bytes differ, which you already knew, and says nothing about how they came to differ — whether one version descends from the other or the two grew on separate branches. Useful later for finding *which keys* disagree between replicas, which is what the Merkle trees do; useless for deciding what to do about one.',
                  },
                  {
                    label: 'Carry a list of (node, counter) pairs along with each version',
                    verdict: 'move',
                    why: 'Give every version a small map: which node coordinated a write to it, and how many times. Then one version descends from another exactly when its counters are all greater than or equal to the other’s — a comparison, not a measurement, so no clock is involved. If neither covers the other, the two writes happened without knowledge of each other, and the system can say so instead of guessing. This is a **vector clock**, and it is the mechanism that lets the store admit uncertainty.',
                  },
                ],
              },
              {
                q: 'The read comes back with two versions and the vector clocks say neither descends from the other. Now what?',
                options: [
                  {
                    label: 'The store picks the one with the largest timestamp',
                    verdict: 'dead',
                    why: 'A store looking at two opaque blobs has exactly one merge available to it, which is to delete one of them. For a session record that is genuinely fine and Dynamo offers it. For a cart it means an item the customer put there is gone, with no error, no log line and no way for anyone to find out later. **The store cannot know which of those two situations it is in, because it has never been told what the bytes mean.**',
                  },
                  {
                    label: 'The store merges the two versions itself',
                    verdict: 'dead',
                    why: 'To merge you must know the shape of the value. Union the items if it is a cart, sum them if it is a counter, take the longer one if it is a document, and if it is a JPEG do not attempt anything at all. That knowledge lives in the application and has never crossed the interface — the store was handed *“an opaque array of bytes”* and made no promises about understanding them.',
                  },
                  {
                    label: 'Block the read until the replicas agree',
                    verdict: 'dead',
                    why: 'You have moved the outage rather than removed it. Reads now fail during exactly the conditions under which you worked so hard to keep writes succeeding, and the customer who was allowed to add an item cannot see their own cart. Worse, the two versions may never converge on their own — nothing in the system is going to pick one — so the read is not waiting for anything in particular.',
                  },
                  {
                    label: 'Return both, and let the caller collapse them',
                    verdict: 'move',
                    why: 'Push the decision up to the only layer that knows what a cart is. The read returns every version that has no descendant, plus an opaque context holding the merged clock; the application merges however its business requires and writes the result back, and that write descends from both branches so they collapse. The cost is real and worth stating plainly: **a read can now hand your code two answers, and that is a permanent property of the API**, not a failure mode you can turn off.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You just re-derived §4 — and, more importantly, the bill for it',
              body: [
                'Every piece of the mechanism was already in the literature and the paper says so in its second sentence: *“a synthesis of well known techniques.”* Consistent hashing from 1997, vector clocks from Lamport in 1978, quorums, Merkle trees, gossip. Assembled differently, though — the assembly is the contribution, and specifically the decision that **the storage system is allowed to give up on being right and say so.**',
                'The move that carries the whole design is the one about *when* conflicts get resolved. Traditional stores resolve on write, which means a write can be rejected. Dynamo resolves on read, which means a write cannot be — and the price is that the complexity does not disappear, it **relocates into the application**, permanently and visibly. Amazon considered that an acceptable price because their services were already written to cope with failure. Almost every team that adopted the descendants was not.',
                'Notice what has happened to the shape of the system. Act I’s architecture diagrams have a box at the top; this one does not, and every node runs the same code and gossips membership with a random peer once a second. **Symmetry was a design goal, not a side effect** — the paper argues it makes provisioning and operations simpler, because there is no special machine to build a runbook around. Act III will come back and ask what was quietly lost when the box at the top went away.',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'How to tell “after” from “at the same time”',
      accent: 'denim',
      rung: 'Rung 3 · The mechanism the whole design leans on',
      body: [
        'This is the piece worth slowing down for, because it is the one people carry away wrong. **A vector clock does not measure time and does not order writes.** It answers one yes-or-no question: *did the writer of this version know about that version?* If yes, the older one can be thrown away with no thought at all. If no — if neither clock covers the other — the two writes were made in ignorance of each other, and the system stops and hands both of them up.',
        'Follow the figure. `Sx` coordinates two writes in a row, giving `D1` and `D2`, and `D2` covers `D1`, so any node holding `D1` can drop it on sight. Then two clients read `D2` and write back through different coordinators, `Sy` and `Sz`. Now there are two versions, both saying *I descend from Sx’s second write*, and **neither one says anything about the other.** No amount of inspecting the values would have revealed that; the clocks are the only place that fact is recorded.',
        'The last row is where the branch closes. A client reads both, merges them in its own code, and writes the result back through `Sx`, which bumps its own counter. The new clock covers both branches, so both are now ancestors and both get collected. **The conflict was not resolved by the store — it was resolved by an application, and the store just wrote down that it had been.**',
      ],
      diagram: <VectorClockDiagram />,
      deeper: {
        summary: 'The truncation scheme, and the sentence the authors declined to defend.',
        body: [
          'A clock grows a pair per coordinating node, so in the ordinary case it stays small: writes are handled by nodes in the top N of the preference list, and that list is short. Under partitions and repeated failures, though, writes land on nodes further and further down the ring, and the list of pairs grows.',
          'Dynamo’s answer is to store a timestamp beside each pair and, once the clock reaches a threshold — *“say 10”* — **drop the oldest pair.** Which breaks the one property the clock exists for: with a pair missing, two versions can compare as concurrent when one really did descend from the other, so the application gets handed a conflict that never happened.',
          'The paper’s own note on this is one of the most quietly interesting lines in it: the scheme *“can lead to inefficiencies in reconciliation as the descendant relationships cannot be derived accurately. However, this problem has not surfaced in production and therefore this issue has not been thoroughly investigated.”* Read that as it is meant — not as sloppiness, but as a production team drawing a line between a bound they can prove and a bound they have measured, and telling you which one this is.',
        ],
      },
    },
    {
      n: 'Step 04',
      title: 'One cart, all the way through — including the part nobody demos',
      accent: 'denim',
      rung: 'Rung 4 · The reveal',
      span: 2,
      body: [
        'Watch which box is amber. In the GFS and Bigtable traces the coordinator was the same machine on every step, because it was *the* master. Here it moves: whoever the request reaches coordinates, and by step 2 a different node is running the write because the first one stopped answering. Nothing was elected in between.',
        'Steps 5 through 7 are the part that gets left out of the architecture talk. The conflict arrives without a partition, the background repair machinery cannot touch it, and the resolution happens in a function somebody on the cart team had to write and keep correct.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={dynamoCartTrace} />
        </div>
      ),
    },
    {
      n: 'Step 05',
      title: 'Three letters, and what each one is actually buying',
      rung: 'Rung 5 · The knobs',
      body: [
        '**N** is how many copies exist. **W** is how many must have the write before you answer the customer. **R** is how many must answer a read before you return it. Set `R + W > N` and any read overlaps any completed write by at least one node, so the freshest version is somewhere in what you gathered — which is a guarantee about *what you saw*, not about which node is up.',
        'The common setting across Dynamo instances is **(3, 2, 2)**, and the paper reports the measurements in section 6 from a live system running exactly that on a couple of hundred nodes. But the knobs are per-instance and teams turned them: services that mostly read and rarely write ran **R=1, W=N**, using Dynamo as a fast read engine, and the paper notes that a service needing the strongest availability can set **W=1**, at which point a write survives if any single node can take it.',
        'The awkward part is what happens when the sloppy quorum is in play. `R + W > N` reasons about a fixed set of N nodes, and hinted handoff means the nodes that took your write may not be the nodes your read asks. **The inequality is arithmetic about a set that failure has quietly changed under it** — which is why the paper describes the result as *“quorum-like”* rather than as a quorum, and why the guarantee people quote from this design is weaker in practice than the formula suggests.',
      ],
      code: {
        file: 'nrw_settings.txt',
        lines: [
          { t: '(N, R, W)   what it buys' },
          { t: '' },
          { t: '(3, 2, 2)   the common one; R+W > N', hl: 'good' },
          { t: '(3, 1, 3)   fast reads, writes need everyone' },
          { t: '(3, 3, 1)   never refuses a write; reads pay' },
          { t: '(3, 1, 1)   fastest, and R+W = 2 < 3 —', hl: 'bad' },
          { t: '            a read may miss a finished write' },
          { t: '' },
          { t: '# and with hinted handoff in play, the N in' },
          { t: '# that inequality is not the N you meant' },
        ],
      },
      think: {
        q: 'Increasing W is usually described as buying durability. It also costs availability. Why is that not the usual trade of one good thing for another?',
        a: 'Because they are not opposites here, and the paper says so directly — *“traditional wisdom holds that durability and availability go hand-in-hand. However, this is not necessarily true here.”* Raising **W** shrinks the window in which an acknowledged write exists on too few disks, so durability improves. It also means more machines must be alive for a write to be accepted, so availability drops. **You are buying certainty about writes that succeeded, and paying in writes that now fail** — and the two are measured on different customers. The one whose write was refused never appears in your durability numbers.',
      },
    },
    {
      n: 'Step 06',
      title: 'How often does any of this actually happen',
      rung: 'Rung 6 · The measurement',
      body: [
        'Section 6.3 profiles the shopping cart service over 24 hours and counts how many versions each read returned. **99.94% of requests saw exactly one.** Conflicts, the thing this entire design is organised around, showed up on roughly six reads in a million.',
        'Which invites the obvious reaction — *all that machinery for six in a million* — and the reaction is wrong, in a way worth being precise about. **The six are not the point; the guarantee is.** Amazon is not buying a low conflict rate, it is buying the absence of a refused write, and the conflicts are what that costs. If you cut the machinery and served the 999,994 identically, the day you would notice is the day a datacentre link flaps during a sale.',
        'The second finding is the one nobody quotes and it changes how you should reason about your own system. The paper reports that the rise in divergent versions came **not from failures but from concurrent writers** — and that the concurrency was *“usually triggered by busy robots (automated client programs) and rarely by humans.”* Conflicts in a real deployment are mostly not the dramatic partition from the architecture diagram. They are a retry loop, a double-clicked button, or a crawler going faster than a person can.',
      ],
      diagram: <DivergenceDiagram />,
    },
    {
      n: 'Step 07',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 7 · What removing the master costs',
      body: [
        '**Someone has to write the merge function, and it lives with your business logic forever.** Not once at integration — on every value shape, reviewed every time the shape changes, and correct under versions of the data written by code that has since been deleted. Amazon could carry that because its services were already built to cope with inconsistency; the paper says porting them was *“a relatively simple task”*, which is a sentence that only reads as reassuring if you skip who is saying it.',
        '**Deletes are where the model bites.** Merging by union is the right call for a cart and it means a removal loses to an add. The paper puts it in seven words — *“deleted items can resurface”* — and every eventually-consistent store since has needed tombstones, and then needed a policy for when to collect them, and then needed to explain to somebody why an item they deleted last Tuesday is back.',
        '**Balanced keys are not balanced load, and the paper measured its own imbalance.** Counting nodes whose request load sat more than 15% off the average, **around 20% were out of balance at low traffic and about 10% at peak.** Consistent hashing spreads keys evenly; it has nothing to say about one key that everybody wants. And membership gossip means every node holds a view of the whole ring, which the authors flag as fine for a couple of hundred nodes and *“not trivial”* beyond that.',
        '**And the operational edges are sharp.** Under the original partitioning scheme, a node joining had to scan its neighbours’ stores at low priority to collect its ranges — during the busy season, the paper reports, **bootstrapping a node took almost a day.** That is the sort of number that never appears in the summary of a design and decides what it is like to run.',
      ],
      callout: {
        kind: 'bad',
        big: 'THE STORE STOPPED DECIDING, SO YOU HAVE TO',
        text: 'Removing the master removes the pause, not the decision. Somebody still has to say which of two carts is real — and the design’s honesty is that it tells you it is now you, rather than picking one and staying quiet about it.',
      },
    },
    {
      n: 'Step 08',
      title: 'What it begat — and where it stands in 2026',
      rung: 'Rung 8 · Descendants',
      body: [
        'Amazon never open-sourced Dynamo, and the paper turned out to be worth more than the code would have been. **Cassandra** took its ring, its replication and its gossip, bolted them onto Bigtable’s column model, and became the most-deployed system in this act — that marriage is Chapter 6. **Riak** was the closest thing to a faithful reimplementation, siblings and vector clocks and all, and its history is a long argument with users about exactly the cost this chapter’s step 7 describes. **Voldemort** at LinkedIn was a third.',
        'The vocabulary escaped the systems entirely. Quorum reads with a tunable `R` and `W`, hinted handoff, read repair, anti-entropy, and *eventual consistency* as a phrase a product manager will now say out loud — all of it comes from here, and most people using the words have not read the paper they come from.',
        'The correction came from the merge problem. **CRDTs** — conflict-free replicated data types — are the answer to *“who writes the merge function”*: pick data types whose merge is mathematically forced, and concurrent updates converge without anyone deciding anything. Riak shipped them, Redis has them, and every collaborative editor you use is built on the same idea. It is a real advance and it has a boundary, which is that not every value can be shaped into one.',
        '**2026 status: the argument ended in a draw, and both sides moved.** DynamoDB shares a name with this paper and little else — it runs a leader per partition group, splits ranges under heat, and will sell you a strongly consistent read for double the price. Cassandra grew lightweight transactions, then Accord. Meanwhile the leader-based systems spent the same decade learning availability tricks they once refused. The 2022 DynamoDB paper is the Epilogue of this book, and the honest summary is that **the industry decided it wanted the choice per request, not per database.**',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Preference list.',
      body: 'The nodes responsible for one key: the first N distinct machines clockwise from the key’s position on the ring. Kept longer than N so there is somewhere to go when one is down.',
    },
    {
      term: 'Coordinator.',
      body: 'Whichever node is running this particular request. Not an appointment and not a role — the next request for the same key may be coordinated by a different node.',
    },
    {
      term: 'Sloppy quorum.',
      body: 'Read and write against the first N *healthy* nodes rather than the first N nodes. Keeps writes flowing through a failure, and quietly weakens what R + W > N promises.',
    },
    {
      term: 'Hinted handoff.',
      body: 'A copy stored by a node that does not own the key, tagged with who it was meant for, and delivered when that node returns. The repair path that needs no operator.',
    },
    {
      term: 'Vector clock.',
      body: 'A list of (node, counter) pairs on each version. Answers whether one version descends from another, or whether the two were written without knowledge of each other. Measures nothing.',
    },
    {
      term: 'Sibling.',
      body: 'One of two or more versions with no ancestor relationship. The store keeps all of them and hands them to the caller, because it has no basis for choosing.',
    },
    {
      term: 'Read repair.',
      body: 'Having noticed during a read that some replica returned an old version, the coordinator pushes the newer one back at it. Fixes stale copies; cannot touch siblings.',
    },
    {
      term: 'Anti-entropy.',
      body: 'Background reconciliation between replicas using Merkle trees — compare roots, descend only where hashes differ, so finding one bad key costs a handful of comparisons.',
    },
  ],
  inTheWild: {
    note: '5 ways this bites in production',
    points: [
      '**Nobody writes the merge function, so last-write-wins is chosen by default.** It is the setting you get when the team ships without reading this far, and it silently discards writes under clock skew — which on virtual machines is larger and lumpier than anyone budgets for. The write that vanished leaves no trace anywhere; there is no error to alert on and no counter that goes up.',
      '**Siblings accumulate when the application reads but never writes back.** Each unresolved conflict stays, the next concurrent write branches again, and a key that started as a few hundred bytes becomes a fat object that slows every read of it. Riak operators learned to watch sibling counts as a first-class metric, which tells you how routine the failure is.',
      '**Deleted things come back.** Tombstones are the fix and they are their own problem: keep them too briefly and a delete gets undone by a replica that was offline, keep them too long and you are storing a monument to every row anyone ever removed. Cassandra’s worst read-path pathology is a partition full of tombstones.',
      '**R + W > N is quoted as if it guaranteed reading your writes, and it does not.** Under hinted handoff the nodes that accepted the write may not be among the nodes the read asked, so the overlap the inequality promises can simply be absent. Treat it as a good default, not as a proof.',
      '**Consistent hashing balances keys, never load.** One celebrity key, one hot partition, one node at a hundred percent while the ring average is comfortable — and adding machines does nothing, because the key still hashes to one place. The paper’s own measurement was 10–20% of nodes out of balance, on a workload with no obvious hot spot.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Go leaderless',
        when: 'refusing a write costs more than resolving a conflict, and you can say what merging two versions means for your data. Carts, session state, counters, sensor readings, anything where the arriving fact is worth keeping even if it arrives out of order.',
      },
      {
        choose: 'Keep the leader',
        when: 'there is exactly one right answer and the system is expected to know it. Balances, seat inventory, unique usernames. **A merge function for “did this seat get sold twice” does not exist**, and building one is how you find out you needed Act III.',
      },
      {
        choose: 'Pick a data type that merges itself',
        when: 'you want the availability and not the merge review. A CRDT makes convergence a property of the type rather than of somebody’s code — the constraint being that your value has to fit one, and many values do not.',
      },
      {
        choose: 'Turn the knobs per request',
        when: 'the same data is read in two different moods — a cart page that must render now, and a checkout that must be right. This is where the industry actually landed, and it is worth reaching for before you settle the argument at the level of the whole database.',
      },
    ],
  },
  misconception: {
    think: '“Eventually consistent means the replicas eventually agree, so if I wait long enough I get the right answer.”',
    actually:
      'They do converge, and convergence has nothing to do with being right. Two concurrent writes converge on **whatever the merge rule says**, and if nobody wrote a merge rule then the rule is *keep one, discard the other* — so the system has converged, correctly by its own definition, on a cart missing an item. **Convergence is a property of the replicas; correctness is a property of a function somebody had to write.** The paper is straight about which one it is selling: it promises that an add is never lost, and in the same paragraph says deleted items can resurface. Both sentences describe the same merge, and only one of them tends to survive into the summary.',
  },
  sources: [
    {
      year: '2007',
      title: 'Dynamo: Amazon’s Highly Available Key-value Store — DeCandia et al. (SOSP)',
      url: 'https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf',
      note: 'Read §4.4 first, on versioning — it is the argument, and Figure 3 is the figure redrawn above. Then §4.5–4.7 for the quorum, hinted handoff and Merkle trees. **§6 is the reason to read the paper rather than a summary of it**: real percentiles, the divergent-version census, three partitioning strategies with the first one’s failures described honestly, and a note that bootstrapping took almost a day.',
    },
    {
      year: '2008',
      title: 'Eventually Consistent — Werner Vogels',
      url: 'https://www.allthingsdistributed.com/2008/12/eventually_consistent.html',
      note: 'The co-author explaining the idea to people who do not read SOSP, and the piece that put the phrase into general use. Useful for the vocabulary it sets out — monotonic reads, read-your-writes, session consistency — which is the shape of what you have to build on top when the store gives you none of it.',
    },
    {
      year: '2010',
      title: 'Cassandra: A Decentralized Structured Storage System — Lakshman & Malik',
      url: 'https://www.cs.cornell.edu/projects/ladis2009/papers/lakshman-ladis2009.pdf',
      note: 'Chapter 6 here, and worth having in view already: it takes this ring and puts Bigtable’s data model on top of it. Short, and the interesting reading is which of Dynamo’s decisions it kept and which it declined.',
    },
    {
      year: '2022',
      title: 'Amazon DynamoDB: A Scalable, Predictably Performant, and Fully Managed NoSQL Database Service (USENIX ATC)',
      url: 'https://www.usenix.org/conference/atc22/presentation/elhemali',
      note: 'Fifteen years on, from the same building, and the Epilogue of this book. Read it beside the 2007 paper and notice how much of this chapter it walks back — leaders per partition group, strongly consistent reads on request, heat-based splitting. Nobody wrote a retraction; they just shipped one.',
    },
  ],
  seenIn: [
    { label: 'The Retreat — the Epilogue', to: '/papers/dynamodb', live: true },
    { label: 'Leaderless & quorums — the comic', to: '/ddia/read/replication-quorum', live: true },
    { label: 'Consistent hashing — the comic', to: '/ddia/read/partitioning', live: true },
    { label: 'Interlude: the RUM Triangle', to: '/papers/rum', live: true },
    { label: 'The Lock Everyone Was Secretly Holding — Ch 4', to: '/papers/chubby', live: true },
  ],
  finale: {
    title: 'The pause is gone, and the decision is still here',
    body: 'The interlude promised that N, R and W would turn out to be the RUM triangle with a network in the middle, and now you can see it: how many replicas answer a read, how many acknowledge a write, how many copies exist at all. What the chapter adds is that removing the master removed a wait, not a question. Somebody still has to decide which cart is real — the system just stopped pretending it could. Next, before Act II’s second chapter, one page on the theorem everybody cites for this design and almost nobody states correctly.',
  },
  next: { title: 'Interlude: CAP', slug: 'cap' },
}
