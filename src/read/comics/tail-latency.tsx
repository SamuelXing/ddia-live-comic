import type { Comic } from '../types'
import { TailDiagram, FanoutTailDiagram, HedgeDiagram, SilenceDiagram, CoordinatedOmissionDiagram } from '../diagrams'

export const tailLatency: Comic = {
  slug: 'tail-latency',
  chapter: 'Chapter 1 · Reliable, Scalable, Maintainable',
  chapterNo: 'Ch 1',
  title: 'Tail Latency',
  dek: 'The average response time is the number everyone reports and almost nobody experiences. Here is where the pain actually lives, why fan-out multiplies it, and the one fix that does not require making anything faster.',
  minutes: 6,
  caption:
    'Every dashboard leads with **average response time**. It is the wrong number — not slightly wrong, but wrong in a specific, predictable direction. Latency distributions have a **long right tail**: most requests are quick, a few are dramatically slow, and the average is dragged toward a value that describes almost nobody. The users who feel your system are the ones in that tail, and at scale they are not a rounding error.',
  steps: [
    {
      n: 'Step 01',
      title: 'The average is nobody’s experience',
      accent: 'terra',
      rung: 'Rung 1 · Intuition',
      diagram: <TailDiagram />,
      body: [
        'Latency is not a bell curve. It has a floor — no request beats the speed of light — and no ceiling: a request can always be stuck behind a garbage collection pause, a slow disk, a retry, or a noisy neighbour on the same box.',
        'That asymmetry drags the **mean above the median**. Report "our average is 120 ms" and you are describing a request that happens less often than you think, while saying nothing at all about the ones that hurt.',
      ],
      callout: {
        kind: 'bad',
        big: 'the tell',
        text: 'If your mean is meaningfully higher than your median, you do not have a slow system. You have a system with a tail — and they need completely different fixes.',
      },
      think: {
        q: 'If the mean is misleading, why not just report the median instead and be done with it?',
        a: 'Because the median is the number that is deliberately blind to the tail — it tells you what a *typical* request costs, which is exactly the half of the story you already believe. The reason to reach for percentiles is not that the median lies; it is that **you need both**. The median tells you whether the system is fast. The p99 tells you whether it is fast *reliably*, and those are separate engineering problems with separate causes: the median moves when you make work cheaper, the tail moves when you remove variance.',
      },
    },
    {
      n: 'Step 02',
      title: 'Percentiles, and who is actually in them',
      accent: 'denim',
      rung: 'Rung 2 · Mechanism',
      body: [
        'A **percentile** is the answer to "sort every response time and walk this far up the list." The p50 is the median; the p99 is the response time 1 in 100 requests exceeds; the p999 is 1 in 1,000.',
        'The uncomfortable part is *who* those requests belong to. They are rarely random. The slowest requests are usually the ones carrying the most data — the customer with the largest cart, the account with the most history, the tenant with the most rows. Amazon observed exactly this: the requests at the high percentiles tend to come from the customers with the most purchases, which is to say **the most valuable customers you have**.',
        'So "we are only failing the 99th percentile" is not the reassurance it sounds like. It frequently means you are failing your heaviest users, every single time.',
      ],
      deeper: {
        summary: 'Why you cannot average percentiles across servers',
        body: [
          'A percentile is a property of a *distribution*, not a quantity you can add up. Averaging the p99 of ten servers does not give you the p99 of the fleet — the fleet p99 is usually worse, because the server with the bad tail contributes requests that no average of summaries preserves.',
          'The only correct aggregation is to keep the distributions themselves — histograms, t-digests, HDR histograms — and merge those. Any monitoring system that stores pre-computed percentiles per host and then averages them is quietly reporting a number that does not exist.',
        ],
      },
    },
    {
      n: 'Step 03',
      title: 'Fan-out turns a rare problem into the common case',
      accent: 'terra',
      rung: 'Rung 1 · Intuition',
      diagram: <FanoutTailDiagram />,
      body: [
        'Now let one user request fan out across many backends — shards of a search index, replicas of a store, services in a chain — and wait for all of them. Your latency is no longer any one backend. It is the **slowest** one.',
        'The arithmetic is unforgiving and you can do it on paper. If one backend is slow for 1% of requests, the chance that *none* of 100 are slow is `0.99¹⁰⁰ = 0.366`. So **63% of requests touch at least one slow backend**.',
        'A fleet where 99% of requests are fast produces a service where most requests are slow. Nothing broke. No server is misbehaving. The tail was simply multiplied by the architecture.',
      ],
      code: {
        file: 'the arithmetic',
        lines: [
          { t: 'P(no backend is slow)  = (1 - 0.01) ** 100  = 0.366' },
          { t: 'P(at least one slow)   = 1 - 0.366          = 0.634', hl: 'bad' },
          { t: '' },
          { t: '# and to hit a p99 across 100 backends you now need' },
          { t: '# each ONE of them at 0.99 ** (1/100) = p99.99', hl: 'bad' },
        ],
      },
      callout: {
        kind: 'bad',
        big: '63%',
        text: 'This is called tail latency amplification, and it is why large fan-out systems obsess over the tail while single-server systems can mostly ignore it.',
      },
      think: {
        q: 'Your search backend has a p50 of 5 ms and a p99 of 50 ms. You fan out to 100 shards. Would it help more to halve the median, or to halve the gap between median and p99?',
        a: 'Halve the **gap**, and it is not close. At 100-way fan-out you need each shard\'s p99.99, not its p50 — so the median is nearly invisible in the result. Fitting a tail through those two points, the fan-out p99 lands near `5 + 2 × (50 − 5) = 95 ms`; halving the median moves that to about 93 ms, while halving the tail gap moves it to about 50 ms. **The median is what you feel on one request; the gap is what you feel on a hundred.** This is why "make the slow path less slow" beats "make the fast path faster" in every fan-out system.',
      },
    },
    {
      n: 'Fix 01',
      title: 'Hedged requests: stop making things faster',
      accent: 'denim',
      rung: 'Rung 2 · Mechanism',
      diagram: <HedgeDiagram />,
      body: [
        'Here is the move that feels like cheating. Send the request. If it has not come back by the time it crosses its **p95**, send a second copy to a different replica, and take whichever answers first.',
        'Nothing got faster. No code was optimized, no hardware bought. But the request now only needs **one** of two attempts to avoid the tail — and the odds of two independent copies both being unlucky are the product of two small numbers.',
        'Dean and Barroso measured this on a Google benchmark: a 99th percentile of **1,800 ms fell to 74 ms** by hedging after the p95, at a cost of about **2% extra requests**. The tail is not made of slow work. It is made of *bad luck*, and you can buy your way out of bad luck cheaply.',
      ],
      callout: {
        kind: 'good',
        big: 'why it works',
        text: 'Optimization reduces the median. Redundancy reduces the variance. The tail is a variance problem, so redundancy is the tool — which is why this works even when every server is healthy.',
      },
      deeper: {
        summary: 'The version that does not double your load',
        body: [
          'Firing the hedge at the p95 means only ~5% of requests ever send a second copy, so the extra load is small and bounded. Firing it at the p50 would double your traffic for a much smaller gain — the knob matters.',
          'The stronger variant is a **tied request**: send both copies immediately, but have each one tell the other which queue it landed in, so whichever starts first cancels its twin. You get the redundancy without paying for duplicate work, at the cost of the servers needing to talk to each other.',
        ],
      },
    },
    {
      n: 'Step 04',
      title: 'The cache you added did nothing for this',
      accent: 'terra',
      rung: 'Rung 3 · Consequence',
      body: [
        'A cache is the reflex fix for slowness, and against the tail it is close to useless — for a reason that is exact rather than empirical.',
        'Suppose 90% of reads hit memory in 10 µs and 10% miss to disk at 100 µs. The **mean** collapses beautifully: `0.9 × 10 + 0.1 × 100 = 19 µs`. But a p99 request is, by definition, in the slowest 1% — and 10% of requests are misses. **The p99 request is a miss.** Your tail did not move at all.',
        'The tail only starts noticing the cache when the miss rate drops below 1%, which is a far harder engineering problem than it sounds. Caches are a throughput tool and a mean-latency tool. They are not a tail tool.',
      ],
      code: {
        file: 'the boundary',
        lines: [
          { t: 'hit rate 90%  ->  mean 19 us   p99 = 100 us  (a miss)', hl: 'bad' },
          { t: 'hit rate 95%  ->  mean 14 us   p99 = 100 us  (a miss)', hl: 'bad' },
          { t: 'hit rate 99%  ->  mean 10.9 us p99 =  10 us  (a hit)', hl: 'good' },
        ],
      },
    },
    {
      n: 'Step 05',
      title: 'Where the tail comes from: queues, not slow code',
      accent: 'terra',
      rung: 'Rung 3 · Consequence',
      diagram: <SilenceDiagram />,
      body: [
        'If your servers are healthy and your code is fast, where does the tail actually come from? Mostly from **waiting**, and waiting grows non-linearly with how busy a machine is.',
        'A server at 50% utilization makes a request wait about as long as it takes to serve. At 90% it waits nine times that. At 99%, ninety-nine times. The work did not change; the queue in front of it did — which is why a capacity dashboard reporting "we are at 80%, plenty of room" and a latency dashboard reporting a catastrophe are both telling the truth.',
        'And it compounds: one slow request at the head of a queue delays every request behind it, however fast those would have been. That is **head-of-line blocking**, and it is how a single unlucky garbage collection turns into a hundred slow responses.',
      ],
      callout: {
        kind: 'bad',
        big: 'the trap',
        text: 'Running hot is efficient and it is where tails are born. Utilization is a latency decision disguised as a cost decision.',
      },
    },
  ],
  bubbles: [
    { term: 'percentile', body: 'Sort every response time and walk this far up the list. The p99 is the time that 1 in 100 requests exceeds — a property of the distribution, not a number you can average across servers.' },
    { term: 'tail latency amplification', body: 'When one request needs many backends, the slowest one decides. Rare slowness at each backend becomes common slowness overall: 1% slow across 100 backends means 63% of requests wait.' },
    { term: 'hedged request', body: 'Send a duplicate once the first copy passes a high percentile, and take whichever returns first. Buys tail latency with a small amount of extra load rather than with optimization.' },
    { term: 'head-of-line blocking', body: 'One slow item at the front of a queue delays everything behind it, however cheap those items are. Turns a single unlucky pause into a burst of slow responses.' },
  ],
  inTheWild: {
    points: [
      {
        t: '**Your load generator is probably lying to you.** Most benchmarks send the next request only after the previous one returns — so when the system stalls, the generator stalls politely with it and simply never records the requests it should have sent. Gil Tene named this **coordinated omission**, and it can hide an order of magnitude of tail.',
        figure: <CoordinatedOmissionDiagram />,
      },
      '**Where you measure changes the answer.** Server-side timing starts when the request is dequeued, which excludes the queue it just sat in — the exact thing you are hunting. Client-side timing includes the network, the retries, and the connection setup, and is the only number that matches what a user felt.',
      '**Tails are made by things you do not control.** A garbage collection pause, a background compaction, a noisy neighbour on shared hardware, a periodic log rotation, a CPU dropping into a lower power state. This is why the tail is a variance problem rather than a performance problem, and why redundancy beats optimization against it.',
      '**Percentiles need enough samples to mean anything.** A p999 over 200 requests is describing a single request. Windows short enough to alert on are frequently too short to compute the percentile you are alerting on.',
      '**The p99 of your service is not the p99 your user feels.** A user session is many requests. At 100 requests per session, the chance of hitting at least one p99 request is the same arithmetic as fan-out: 63%.',
    ],
  },
  tradeoffs: {
    title: 'Which number to chase',
    rows: [
      { choose: 'The median', when: 'the system is uniformly slow, the mean and median agree, and the work itself is the cost. Profile and make the work cheaper.' },
      { choose: 'The tail (p99, p999)', when: 'the mean sits well above the median, or one request fans out. Hunt variance: queueing, pauses, retries, shared hardware.' },
      { choose: 'Lower utilization', when: 'the tail is queueing rather than work. The cheapest tail fix there is, and it costs money rather than engineering time.' },
      { choose: 'Hedging or tied requests', when: 'the slowness is bad luck rather than load, and a duplicate is cheap. Buys the tail without making anything faster.' },
      { choose: 'Nothing', when: 'the request is asynchronous and nobody is waiting on it. A batch job does not have a tail problem; it has a throughput problem.' },
    ],
  },
  misconception: {
    think: 'The p99 means 1% of my users have a bad time. That is a rounding error — I will fix it later.',
    actually:
      'A user session is not one request. If a session makes 100 requests, the chance it contains at least one p99 request is `1 − 0.99¹⁰⁰ = 63%`. The p99 is not the experience of 1% of your users; on that arithmetic it is an experience most of your sessions contain. It is the same equation as tail latency amplification, applied to a person instead of a fan-out — and it is the reason the tail is worth chasing at all.',
  },
  sources: [
    {
      year: '2013',
      title: 'Dean & Barroso — The Tail at Scale (CACM)',
      url: 'https://research.google/pubs/the-tail-at-scale/',
      note: 'The origin of the 63% example and of hedged and tied requests, with the 1,800 ms → 74 ms measurement.',
    },
    {
      title: 'Designing Data-Intensive Applications (1st ed.), Ch 1',
      note: 'Percentiles, tail latency amplification, and the observation that the slowest requests belong to the customers with the most data.',
    },
    {
      title: 'Gil Tene — How NOT to Measure Latency',
      note: 'Coordinated omission: why most load generators systematically under-report the tail they were built to find.',
    },
  ],
  seenIn: [
    { label: 'The latency budget — spend a p99 target, term by term', to: '/calculator/latency', live: true },
    { label: 'Capacity planning — the ceilings the queue forms in front of', to: '/calculator/capacity', live: true },
    { label: 'Redis — one core, one command at a time, and what queues behind it', to: '/components/redis', live: true },
    { label: 'Why it’s hard — timeouts, and a healthy server declared dead', to: '/read/distributed-troubles', live: true },
  ],
  finale: {
    title: 'The tail is variance, not slowness',
    body: 'Almost every instinct about performance is aimed at the median: profile the code, cache the result, buy a faster machine. None of those move a tail, because a tail is not made of expensive work — it is made of waiting, pauses and bad luck. The fixes that do move it look strange by comparison: run the machine cooler, send a request twice, cut the fan-out. And the reason to bother is arithmetic rather than perfectionism. Fan out a hundred ways, or let one user make a hundred requests, and the same equation says the same thing both times: what happens 1% of the time happens to 63% of them.',
  },
  next: { slug: 'storage', title: 'B-trees vs LSM-trees' },
}
