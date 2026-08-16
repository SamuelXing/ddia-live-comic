import type { Chapter } from '../types'
import TracePlayer from '../../components/TracePlayer'
import DesignIt from '../DesignIt'
import { ChubbyTrafficDiagram } from '../diagrams'
import { chubbySessionTrace } from './chubby-trace'

/* Closes Act I. The chapter deliberately does NOT re-derive fencing tokens —
   the DDIA book's distributed-troubles comic argues that in full, with code,
   a callout and a fold-out. Here the sequencer is named, linked, and the space
   is spent on what is Chubby's alone: that the algorithm was already known and
   the packaging was the contribution. */

export const chubby: Chapter = {
  slug: 'chubby',
  act: 'Act I · The Web Breaks the Box',
  paperNo: 'Paper 4',
  title: 'The Lock Everyone Was Secretly Holding',
  dek: 'Every system in this act has a master, and none of the papers say who appoints it. This one does — and its real contribution is not an algorithm but a decision about how to ship one.',
  minutes: 15,
  paper: {
    title: 'The Chubby lock service for loosely-coupled distributed systems',
    authors: 'Mike Burrows',
    venue: 'OSDI',
    year: '2006',
    url: 'https://static.googleusercontent.com/media/research.google.com/en//archive/chubby-osdi06.pdf',
  },
  caption:
    'Three chapters in, and something has been quietly holding the whole act up. GFS has **one master**, and it survives because when that master stops answering, another takes over. Bigtable has one master too, and its tablet servers hold **leases** that expire. Every design so far runs on the same move — *appoint somebody, and notice when they stop answering* — and not one of those papers explains who does the appointing, or what stops two machines both believing they got the job. The trace in Chapter 1 said a server’s lease *“expires in Chubby”* and moved on. **This is the thing it was pointing at.**',
  steps: [
    {
      n: 'Step 01',
      title: 'The requirement is smaller than it sounds, and much harder',
      accent: 'terra',
      rung: 'Rung 1 · The constraint',
      body: [
        'Write down what is actually needed and it looks trivial: **pick one machine out of five, and let everybody find out which.** Electing a leader is easy if you are allowed to be wrong — take the lowest IP, take the longest uptime, take whoever shouts first. The requirement that makes it hard is the second half: **never two at once**, not even for a second, not even while the network is misbehaving and each side of a partition is quietly certain.',
        'And notice the shape of the problem, because it decides everything later. This is not one team’s need. GFS needs it. Bigtable needs it — the paper says so, and lists three separate uses: elect the master, let the master find its tablet servers, let clients find the master. Both also want somewhere to keep a small amount of data that everybody agrees on, *“the root of their distributed data structures.”* A dozen more teams need the same thing, and **every one of their systems already exists and already has users.**',
        'That last clause is doing more work than it appears to. A thing every team needs, in a company where every team already shipped, is not primarily an algorithms problem. **It is a distribution problem** — in the sense of getting something into other people’s hands.',
      ],
      code: {
        file: 'who_appoints_the_master.txt',
        lines: [
          { t: 'GFS      — one master, appointed by ???', hl: 'bad' },
          { t: 'Bigtable — one master, appointed by ???', hl: 'bad' },
          { t: '         — tablet servers hold leases from ???', hl: 'bad' },
          { t: '' },
          { t: 'both also want: a well-known place to keep' },
          { t: 'a small file everyone agrees on' },
          { t: '' },
          { t: '# and a dozen other teams want exactly this,' },
          { t: '# for systems that already shipped' },
        ],
      },
    },
    {
      n: 'Step 02',
      title: 'You are the designer',
      rung: 'Rung 2 · Design it yourself',
      span: 2,
      body: [
        'It is 2005. Paxos has been published for years — twice, in fact, and Chapter 8 will read it properly. So the interesting decisions here are not about how consensus works. They are about **who runs it, and how anyone gets to use it.**',
      ],
      diagram: (
        <DesignIt
          spec={{
            constraints: [
              '**The need:** several systems, each wanting exactly one master, and never two — including during a network partition, when both halves feel fine',
              '**The customers:** teams whose systems are already built, already running, and were not designed with any of this in mind',
              '**The scale:** tens of thousands of clients per cell — the paper reports **90,000 talking to a single master** — on machines no better than the clients’ own',
              '**The shape of the data:** tiny. Who is the master, where does a service live, one line of configuration. It changes rarely and it must never be wrong',
              '**The tolerance:** these systems can wait a few seconds for an answer. What they cannot survive is two answers',
            ],
            questions: [
              {
                q: 'Five identical servers. Exactly one must be master, and never two — including when the network splits them three against two. How?',
                options: [
                  {
                    label: 'A config file an operator edits',
                    verdict: 'dead',
                    why: 'The human is now the failure detector, and a human notices in minutes on a good day. Worse, two operators can edit two copies of that file during the same incident, which is the exact failure you were trying to rule out — now with more confidence behind it.',
                  },
                  {
                    label: 'Lowest IP address wins, or longest uptime',
                    verdict: 'dead',
                    why: 'Any rule computed **locally** gives a confident answer on both sides of a partition. Three machines pick one winner, two machines pick another, and both are correctly following the rule. Uniqueness is a global property and cannot be decided from local information — that is the whole of it.',
                  },
                  {
                    label: 'Whoever grabs a row in a database first',
                    verdict: 'dead',
                    why: 'You have moved the problem one building over. That database has a primary, and something has to elect *it*, and that something needs the same guarantee. It is a real answer only if somebody else has already solved this, in which case ask them what they built.',
                  },
                  {
                    label: 'A majority of the five agrees, and the winner holds a lease',
                    verdict: 'move',
                    why: 'A majority cannot exist twice at once — that is the one property that survives a partition, and the whole reason consensus is worth its complexity. Pair it with a **lease** so mastership expires on its own rather than needing anyone to revoke it, and a dead master stops being master without anybody being reachable.',
                  },
                ],
              },
              {
                q: 'So it is Paxos underneath. It has been published since 1989 and almost nothing at Google runs it. How do you actually get it into a dozen existing systems?',
                options: [
                  {
                    label: 'Ship a consensus library each team links into their binary',
                    verdict: 'dead',
                    why: 'The answer that should win, and did not — Google shipped exactly this library, standalone, and it went largely unused. A consensus library assumes your service can be **restructured as a state machine**, and services are written first and made highly available later, once the prototype has users. You cannot retrofit something that dictates the shape of a program into a program that already has one.',
                  },
                  {
                    label: 'Have each team implement it from the paper',
                    verdict: 'dead',
                    why: 'The same team went on to write an entire second paper about how much harder building a working Paxos was than the algorithm suggests — incomplete specifications, fault-tolerance bugs, the gap between pseudocode and a production system. A dozen independent attempts at that is a dozen subtly different distributed-systems bugs.',
                  },
                  {
                    label: 'Build it into the file system, so nobody needs a second thing',
                    verdict: 'dead',
                    why: 'Now every team that wants agreement has to go through a file system to get it, and — the circular part — **GFS’s own master is one of the things that needs electing.** A component cannot be the foundation of the mechanism that appoints it.',
                  },
                  {
                    label: 'Run one service, and let everyone call it',
                    verdict: 'move',
                    why: 'A service can be added to a system that already works, on a Wednesday, by someone with other things to do. The paper puts a number on it: to elect a master that then writes to an existing file server takes **two statements and one RPC parameter** — acquire a lock, pass the acquisition count with your write, and add an if-statement at the far end that rejects a low one.',
                  },
                ],
              },
              {
                q: '90,000 clients want to know who the master is. The answer changes about once every 18 days. What do they do in between?',
                options: [
                  {
                    label: 'Ask every few seconds',
                    verdict: 'dead',
                    why: 'Load scales with clients times poll rate, and essentially every answer is identical to the last one. This is not hypothetical: the paper describes developers writing loops that poll a file by opening and closing it repeatedly, and the eventual fix being *to make repeated opens cheap* rather than to win the argument.',
                  },
                  {
                    label: 'Clients cache, and the master invalidates before acknowledging a write',
                    verdict: 'move',
                    why: 'Steady-state traffic for unchanged data goes to **zero**, which is what lets one ordinary machine face 90,000 clients. The master keeps a list of who is caching what — hundreds of thousands of entries — and a write blocks until the invalidations are out. You have moved the cost onto writes, and writes are the rare thing.',
                  },
                  {
                    label: 'Push every change to every client as it happens',
                    verdict: 'dead',
                    why: 'You now need to know who is listening and to keep trying until they hear, which is a subscription system with delivery guarantees. Chubby offers events and people did try to use them this way; the paper is blunt that it is slow and inefficient for all but the most trivial cases.',
                  },
                  {
                    label: 'Replicate the whole namespace to every client',
                    verdict: 'dead',
                    why: 'Ninety thousand copies of data that must never be wrong, and keeping them in agreement is the original problem again, at a hundred times the scale and with no majority to appeal to.',
                  },
                ],
              },
            ],
            reveal: {
              title: 'You just re-derived §2.1 — the quietest important section in Act I',
              body: [
                'Nothing in the machine is new, and Burrows says so in the abstract: the design *“is based on well-known ideas.”* Paxos underneath, leases, a namespace shaped like a small file system, caching with invalidation. If you were grading it as an algorithms paper you would not publish it.',
                '**The contribution is the packaging, and the argument for it is not about correctness.** It is that developers do not plan for availability up front, that they add it once a system matters, and that at that point the code has not been structured for a consensus protocol and never will be. A library demands to be designed in. A service can be phoned up later. That is the entire case, and it is an argument about people.',
                'Which makes this the mirror of Chapter 2. There, the *pattern* was the contribution and the product that grew around it — Hadoop — was mostly a distraction. Here the algorithm was already sitting in a published paper doing nothing, and **the product was the contribution.** Both chapters are really about the same question, asked from opposite ends: *what has to be true for an idea to get used?*',
              ],
            },
          }}
        />
      ),
    },
    {
      n: 'Step 03',
      title: 'One session, and the fail-over it exists to survive',
      accent: 'denim',
      rung: 'Rung 3 · The reveal',
      span: 2,
      body: [
        'Watch what the client does in **step 5**, because it is the opposite of what most systems do when a dependency goes quiet. It does not retry harder, it does not fail its callers, and it does not guess. It empties its cache, blocks, tells the application it is unsure, and waits — and a large fraction of Chubby’s design exists to make that pause survivable rather than fatal.',
        'And step 7 is the honest ending: sometimes the pause is not survived, and then the guarantee has to hold anyway.',
      ],
      diagram: (
        <div className="gn-figure">
          <TracePlayer spec={chubbySessionTrace} />
        </div>
      ),
    },
    {
      n: 'Step 04',
      title: 'What it was used for, versus what it was called',
      rung: 'Rung 4 · The measurement',
      body: [
        'The paper takes a snapshot of a typical cell, and it is the most quietly devastating table in Act I. **Ninety-three percent of the traffic is KeepAlive** — clients saying nothing except *still here.* `Acquire`, the operation the entire service is named after, is **31 requests per million.**',
        'Look at what the files are, too. Sixty percent of open files are naming-related, ninety percent of stored files are **under a kilobyte**, and the paper reports elsewhere that the global cell holds things like pointers to Bigtable cells and configuration for other systems. A lock service had become the place Google looked things up.',
        'The right reading is not that the design failed. It is that **a system offering “one answer everyone can see, that is never wrong” will be used for every question of that shape**, whatever the sign on the door says. Naming is exactly that shape. So is configuration. So is service discovery. The team noticed, wrote it down as data rather than as a confession, and built the caching layer the new workload demanded.',
      ],
      diagram: <ChubbyTrafficDiagram />,
      think: {
        q: 'Chubby’s clients are individual processes rather than machines — the paper stresses this. Why does that distinction matter enough to say out loud?',
        a: 'Because it breaks the estimate everyone arrives with. You size a coordination service by counting machines, and get a number like *a few thousand*; the real number is **processes**, and one machine runs many. That is how you get 90,000 clients on a master whose hardware is identical to theirs. The general form is worth keeping: **whenever a service is called by processes rather than by hosts, your capacity model is off by whatever the average process-per-host count is** — and that number grows quietly, every time someone splits a binary in two.',
      },
    },
    {
      n: 'Step 05',
      title: 'Coarse on purpose — and what a lock cannot do',
      rung: 'Rung 5 · The design choices that look like limitations',
      body: [
        '**Chubby’s locks are held for hours or days, not milliseconds**, and that is a choice with consequences running all the way down. Lock traffic stays tiny, so a handful of ordinary machines serve tens of thousands of clients. Locks must survive a lock-server fail-over — losing one means an expensive recovery somewhere — and surviving them is affordable precisely *because* they are rare. Fine-grained locking would invert every one of those: brief unavailability would stall everyone, and the transaction rate would grow with the combined rate of every client. The paper simply declines to be that.',
        '**The locks are advisory, not mandatory.** Holding the lock on file `F` is neither required in order to read `F`, nor does it stop anyone else. That sounds like a hole and is a deliberate one: mandatory locks would make data unreadable to debugging tools and administrators exactly when someone is trying to work out what went wrong.',
        'And then the limit no lock service can design its way out of. A process that holds a lock can be **paused** — garbage collection, a scheduler, a sick disk — long enough for its lease to expire and someone else to take over, then wake up with no idea any time passed and write. Chubby’s answer is the **sequencer**: an opaque string naming this lock and this acquisition, which the holder passes to whatever it is writing to, and which that service validates against the highest it has seen. **The check has to live at the resource**, because the lock service is not in the room when the write happens. This is a fencing token, and the DDIA book argues it out in full with code — the link is at the foot of this chapter rather than a second telling here.',
      ],
      deeper: {
        summary: 'The workaround they shipped because the correct fix required everyone else to change.',
        body: [
          'Sequencers are correct and they are cheap — the paper notes the mechanism needs only a string added to affected messages, and is easy to explain to developers. But they require **the protected service to be modified**, and, in Burrows’ words, important protocols evolve slowly. A correct answer that needs a dozen other teams to ship something is not, on its own, a plan.',
          'So Chubby also offers **lock-delay**. When a lock is released normally it is immediately available; when it becomes free because the holder *died or became unreachable*, the service refuses to hand it out for a configurable period, up to about a minute. The paused zombie is likely to have noticed and given up by then.',
          'It is explicitly imperfect and it protects unmodified clients and servers from the everyday version of the problem. Worth admiring rather than sniffing at: the design ships the correct mechanism **and** a weaker one that works without anybody else’s cooperation, and is honest in print about which is which. Most systems ship one and imply it is the other.',
        ],
      },
    },
    {
      n: 'Step 06',
      title: 'The bill',
      accent: 'terra',
      rung: 'Rung 6 · What it costs to be everyone’s dependency',
      body: [
        '**When it is down, everything that leans on it is down**, and the leaning is worse than it looks. The paper describes a system of *hundreds of machines* that kicked off a recovery procedure taking tens of minutes whenever Chubby elected a new master — turning a fourteen-second fail-over into a hundred-machine outage lasting half an hour. Nothing was broken. Every component behaved as designed. **A shared dependency converts your smallest incident into everybody’s largest one**, and the amplification factor is set by code you have never read.',
        '**The abuse is real and none of it is malicious.** One team wrote a module storing upload metadata; two other teams reused it for a much larger population, and a single **1.5 MB file was being rewritten in full on every user action** — eventually consuming more space than every other Chubby client combined. The fixes are unglamorous and instructive: a hard **256 KB file-size limit**, making repeated opens cheap instead of arguing with developers, and reviewing how a team plans to use the service *before* granting namespace access. Governance as a design feature, in a systems paper.',
        '**And it is slow on purpose.** Availability and easy-to-understand semantics were the goals; throughput and storage capacity were explicitly secondary. Anything on the hot path of a request does not belong here — which is a rule people rediscover every few years by putting one there.',
      ],
      callout: {
        kind: 'bad',
        big: 'ONE FAIL-OVER, A HUNDRED MACHINES',
        text: 'A 14-second election became tens of minutes of recovery across hundreds of machines, because the clients treated an available service as an always-available one. Your dependency’s failure budget is only yours if you spend it deliberately.',
      },
    },
    {
      n: 'Step 07',
      title: 'What it begat — and where it stands in 2026',
      rung: 'Rung 7 · Descendants',
      body: [
        'Inside Google, this closes Act I: it is the thing GFS and Bigtable were both quietly standing on, and every appointment in those two chapters is a lease from a cell like this one. The team also wrote the paper nobody expected — an engineering account of what building a real Paxos actually took, which is the honest companion to every clean consensus proof and is linked below.',
        'Outside, **ZooKeeper** (2010) is the open re-implementation, and it is what the world actually ran: Hadoop, HBase, Kafka, Solr, Mesos. It is not a copy. There is no lock primitive — you build one out of ephemeral sequential nodes, which is more assembly required and more flexibility — and reads are served locally and can be stale unless you explicitly ask them not to be. That gets its own chapter, **Ch 9.**',
        '**etcd** (2013) is the current default, with Raft underneath instead of Paxos, largely because Kubernetes is built on it: every object in a cluster is a key in etcd, and leader election between controllers is a lease on a key. Consul occupies the same slot elsewhere. The interface has drifted from files toward keys, and the guarantee has not moved at all.',
        '**2026 status: the packaging argument won so completely that the algorithm became a checkbox.** Almost nobody implements consensus; almost everybody depends on someone who did, usually without naming it — *“we use etcd for leader election”* is a sentence that passes code review unexplained. And the failure Burrows documented is the one that still takes providers offline: the shared coordination service wobbles, and the blast radius is everything that trusted it. Which is why it now comes with a status page of its own.',
      ],
    },
  ],
  bubbles: [
    {
      term: 'Cell.',
      body: 'One Chubby deployment: five replicas, one of them master. Most live in a single datacentre; a global cell has its five spread across the world.',
    },
    {
      term: 'Lease.',
      body: 'Time-limited mastership. The master holds one from the replicas; a client holds one for its session. Expiry is how the system removes someone nobody can reach.',
    },
    {
      term: 'Session.',
      body: 'The relationship a client keeps alive with KeepAlive calls. Locks, cached files and open handles all hang off it, so surviving a fail-over means surviving one thing rather than many.',
    },
    {
      term: 'Jeopardy.',
      body: 'The state a client enters when its lease runs out and it does not know why. Cache emptied, calls blocked, application told — then a 45-second grace period to find a new master.',
    },
    {
      term: 'Sequencer.',
      body: 'An opaque string naming a lock and its acquisition count. Passed to the service being protected, which rejects anything older than the newest it has seen. A fencing token.',
    },
    {
      term: 'Ephemeral file.',
      body: 'A file that disappears when the session that made it ends. Presence becomes liveness, which is how a master discovers who is still alive without asking.',
    },
  ],
  inTheWild: {
    note: '5 ways this bites in production',
    points: [
      '**The coordination service becomes the outage.** Every incident review of a large cluster eventually reaches a line like *"etcd was slow, so the controllers could not renew their leases, so they all stood down."* The dependency is invisible in the architecture diagram because it is in every box.',
      '**Clients treat "highly available" as "always available".** The paper names this as its first lesson learned, and it has aged perfectly. If your recovery path on losing coordination is more expensive than the outage itself, you have built the hundred-machine amplifier deliberately.',
      '**Session expiry is not the same as the process dying**, and code frequently assumes it is. The zombie is real, it is common under garbage collection and CPU throttling, and if your resource does not check a fencing token then your locks are advice you are hoping everyone takes.',
      '**Everybody stores a bit too much in it.** Configuration turns into state, state turns into a small database, and someone rewrites a megabyte on every user action. Both Chubby and etcd have hard size limits for this reason, and both of them acquired the limit *after* meeting the problem.',
      '**Watches and invalidation are cheap until a herd wakes up.** Ten thousand clients caching one file all get invalidated by one write, and all come back at once. The mitigations are the usual ones — jitter, backoff, proxies — and the paper reaches for proxies specifically, because they let one process face the master on behalf of thousands.',
    ],
  },
  tradeoffs: {
    title: 'what this chapter teaches you to choose',
    rows: [
      {
        choose: 'Reach for a coordination service',
        when: 'you need agreement about something small, rare and load-bearing — who is primary, where a service lives, which schema version is current. That is what these things are excellent at, and the cost is one more thing that must be up.',
      },
      {
        choose: 'Embed a consensus library instead',
        when: 'you are building the storage system itself and its replication *is* the product. Then the coupling that makes a library hard to adopt is coupling you want, and Chapter 8 is your chapter rather than this one.',
      },
      {
        choose: 'Fence the resource',
        when: 'correctness depends on only one actor writing. A lock alone cannot deliver that — a paused holder wakes up and acts — so the check belongs at the thing being written to. **If you cannot fence, you have an optimisation, not a guarantee.**',
      },
      {
        choose: 'Keep it off the hot path',
        when: 'the alternative is tempting: it is right there, it is consistent, it is easy to call. It is also deliberately slow and shared by everyone, and per-request traffic against a coordination service is the most reliably regretted decision in this chapter.',
      },
    ],
  },
  misconception: {
    think: '“Paxos is notoriously hard to implement, so Google implemented it once, correctly, and let everyone share it. That is what Chubby is for.”',
    actually:
      'Difficulty is real — the same team wrote a whole paper about how much harder a working Paxos is than the published algorithm — but it is not the argument, and the evidence is in the paper itself: **Google also shipped a standalone consensus library, independent of Chubby, and it went largely unused.** So "implement it once and share it" was available, taken, and still lost. What a library cannot do is arrive late. Services get built first and made highly available afterwards, by which point the code is not structured as a state machine and nobody is going to restructure it. **The winning argument was about adoption, not about correctness** — which is a strange thing for a distributed systems paper to be right about, and the reason this one is worth reading.',
  },
  sources: [
    {
      year: '2006',
      title: 'The Chubby lock service for loosely-coupled distributed systems — Burrows (OSDI)',
      url: 'https://static.googleusercontent.com/media/research.google.com/en//archive/chubby-osdi06.pdf',
      note: 'Read §2.1 first — it is a page, it is the argument, and it is the part that got imitated. Then §2.4 (locks and sequencers) and §2.8–2.9 (sessions and fail-over). **The best section is §4**, "Use, surprises and design errors": real numbers, real abuse, and lessons written by someone with nothing left to prove. Very few systems papers report what their users actually did with the thing.',
    },
    {
      year: '2007',
      title: 'Paxos Made Live: An Engineering Perspective — Chandra, Griesemer & Redstone',
      url: 'https://static.googleusercontent.com/media/research.google.com/en//archive/paxos_made_live.pdf',
      note: 'The Chubby team on what it actually took to build the consensus layer underneath: the gap between an algorithm that is proven and a system that runs. Read it as the companion volume to any clean Paxos proof, and as the strongest evidence for this chapter’s argument — these are the people best placed to write the library, and they still concluded a service was the way to ship it.',
    },
    {
      year: '2010',
      title: 'ZooKeeper: Wait-free coordination for Internet-scale systems (USENIX ATC)',
      url: 'https://www.usenix.org/legacy/event/atc10/tech/full_papers/Hunt.pdf',
      note: 'The open descendant, and Chapter 9 here. Worth reading beside Chubby specifically for what it changed: no lock primitive, a wait-free API, and reads served locally. Every one of those is a deliberate disagreement, and each has a cost you can name.',
    },
  ],
  seenIn: [
    { label: 'Fencing tokens — the comic', to: '/ddia/read/distributed-troubles', live: true },
    { label: 'Consensus — the comic', to: '/ddia/read/consensus', live: true },
    { label: 'The File System That Refused to Edit — Ch 1', to: '/papers/gfs', live: true },
    { label: 'The Database GFS Deserved — Ch 3', to: '/papers/bigtable', live: true },
  ],
  finale: {
    title: 'Act I ran on one machine being allowed to decide',
    body: 'Look back across four chapters and the same move is under all of them. One master holds the file catalogue. One master schedules the tasks. One tablet server owns a key range. One replica holds the lease. Nobody votes on anything except *who gets to be the one*, and even that is delegated to a service built for it. It works, it is cheap, and it produces a system that is unavailable exactly when the appointment cannot be made. Next: a company whose shopping cart may not stop taking writes, ever, decides that is an unacceptable trade — and throws out the master that this entire act was built on.',
  },
  next: { title: 'Dynamo — The Cart That Must Not Close', unwritten: true },
}
