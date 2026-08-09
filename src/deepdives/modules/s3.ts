import type { ModuleDef, Values, ComputeResult } from '../types'
import { fmt } from '../format'
import { LAD } from '../ladder'

function compute(v: Values): ComputeResult {
  const GET_CEIL = 5500
  const PUT_CEIL = 3500
  const gets = (v.req * v.getPct) / 100
  const puts = v.req - gets
  const perPrefixGet = gets / v.prefixes
  const perPrefixPut = puts / v.prefixes
  const getPct = (perPrefixGet / GET_CEIL) * 100
  const putPct = (perPrefixPut / PUT_CEIL) * 100
  const prefixesNeeded = Math.max(Math.ceil(gets / GET_CEIL), Math.ceil(puts / PUT_CEIL), 1)
  const bw = (v.req * v.obj) / 1024 // MB/s
  // rough monthly cost: storage + requests (Standard, order-of-magnitude)
  const storeCost = v.store * 1024 * 0.023 // $/GB-mo
  const reqCost = ((gets / 1000) * 0.0004 + (puts / 1000) * 0.005) * 2592000 // per month
  const monthly = storeCost + reqCost

  const meters = [
    {
      label: 'Per-prefix GET rate',
      valTxt: fmt.compact(perPrefixGet) + ' / 5,500',
      pct: getPct,
      detail: `${fmt.compact(gets)}/s reads ÷ ${v.prefixes} prefixes. S3 gives ~5,500 GET/s per prefix before 503 SlowDown — spread keys to add more.`,
    },
    {
      label: 'Per-prefix PUT rate',
      valTxt: fmt.compact(perPrefixPut) + ' / 3,500',
      pct: putPct,
      detail: `${fmt.compact(puts)}/s writes ÷ ${v.prefixes} prefixes vs ~3,500 PUT/s per prefix. Writes hit the wall sooner than reads.`,
    },
    {
      label: 'Prefixes required',
      valTxt: prefixesNeeded + ' prefixes',
      pct: v.prefixes >= prefixesNeeded ? 60 : 100,
      detail:
        v.prefixes >= prefixesNeeded
          ? `Your ${v.prefixes} prefixes cover the load.`
          : `Need ≥ ${prefixesNeeded} prefixes to stay under the per-prefix ceilings — add a hashed path component to your keys.`,
    },
  ]

  let verdict: ComputeResult['verdict']
  if (getPct >= 100 || putPct >= 100)
    verdict = {
      s: 'crit',
      t: `<b>Prefix throttling.</b> A single prefix is over its request ceiling, so S3 returns <code>503 SlowDown</code>. Spread keys across <b>≥ ${prefixesNeeded} prefixes</b> (hash a path segment) and S3 partitions the load — each prefix adds another 3,500 write / 5,500 read per second.`,
    }
  else if (getPct >= 75 || putPct >= 75)
    verdict = {
      s: 'warn',
      t: `<b>Approaching prefix limits.</b> You're using most of a prefix's request budget. Add prefixes proactively — throttling shows up as latency and 503s under spikes, not gradually.`,
    }
  else
    verdict = {
      s: 'good',
      t: `<b>Well within limits.</b> Request rate is comfortably spread across prefixes. Remember S3's real gotchas aren't capacity — they're the ~tens-of-ms latency floor (cache hot objects behind a CDN) and the request/egress cost line.`,
    }

  return {
    tiles: [
      { k: 'Aggregate bandwidth', v: bw >= 1000 ? fmt.sig(bw / 1000) : fmt.sig(bw), u: bw >= 1000 ? 'GB/s' : 'MB/s' },
      { k: 'Prefixes needed', v: fmt.int(prefixesNeeded), u: 'to avoid throttling' },
      { k: 'Est. monthly cost', v: fmt.usd(monthly), u: 'storage + requests*' },
      { k: 'Stored', v: v.store + ' TB', u: '(effectively unlimited)' },
    ],
    meters,
    verdict,
  }
}

export const s3Module: ModuleDef = {
  key: 's3',
  tab: 'S3',
  emoji: '🪣',
  title: 'S3 / object storage',
  kicker: 'Effectively infinite — with rules',
  lede: `Object storage is the one tier that scales for you: storage is <b>effectively unlimited</b>, durability is famously high, and throughput grows automatically. You don't provision it. But "no capacity planning" isn't "no limits" — S3 has a <b>per-prefix request rate</b>, a <b>latency floor</b> that makes it wrong for hot small reads, and a <b>cost model</b> where requests and egress, not storage, often dominate the bill.`,
  content: {
    intro: `<p>S3 stores <b>objects</b> (blobs + metadata) in buckets, addressed by key, over HTTP. There's no server you scale — AWS spreads objects across a massive fleet automatically. Storage and aggregate bandwidth are, for practical purposes, unbounded, and objects are replicated across availability zones for very high durability.</p>
  <p>The limit that surprises people is <b>request rate per prefix</b>. S3 scales throughput per <em>key prefix</em>: you get about <b>3,500 write (PUT/POST/DELETE) and 5,500 read (GET/HEAD) requests per second, per prefix</b>. One prefix under sustained higher load throttles with <code>503 SlowDown</code>. The fix is to <b>spread keys across many prefixes</b> (e.g. a hashed path component) so S3 partitions the load — each prefix independently gives you another 3,500/5,500.</p>
  <p>The other two boundaries: <b>latency</b> — first-byte is tens to ~100+ ms, so S3 is wrong as a low-latency key-value store; put a CDN (CloudFront) or cache in front for hot objects. And <b>large-object throughput</b> — use <b>multipart upload</b> to parallelize big objects across many connections and to make uploads resumable. Reads are now <b>strongly consistent</b> (read-after-write), removing an old footgun.</p>`,
    inputs: [
      { id: 'req', label: 'Request rate', steps: LAD.rate, val: 1e5, hint: 'Total object operations per second.', fmt: (v) => fmt.compact(v) + '/s' },
      { id: 'prefixes', label: 'Key prefixes', steps: LAD.many, val: 20, hint: 'Distinct prefixes S3 can partition load across. More = more capacity.', fmt: (v) => fmt.int(v) },
      { id: 'getPct', label: 'Read (GET) share', steps: LAD.pct, val: 80, hint: 'Reads vs writes — different per-prefix ceilings (5,500 vs 3,500).', fmt: (v) => v + '% GET' },
      { id: 'obj', label: 'Avg object size', steps: [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 5000, 10000, 100000, 1000000], val: 200, hint: 'Drives bandwidth and whether you need multipart.', fmt: (v) => fmt.bytes(v * 1024) },
      { id: 'store', label: 'Total stored', steps: LAD.gb, val: 500, hint: 'Storage is effectively unlimited — this just drives cost.', fmt: (v) => v + ' TB' },
    ],
    compute,
    limits: [
      ['Storage', 'Effectively unlimited', 'No provisioning; objects up to 5 TB each. You never "run out".'],
      ['Requests / prefix', '~3,500 write / 5,500 read per s', 'The real scaling knob — spread keys across prefixes to multiply it.'],
      ['Latency', '~tens–100+ ms first byte', 'Not a low-latency KV store. Front hot objects with a CDN or cache.'],
      ['Object size', 'Up to 5 TB', 'Single PUT limited to 5 GB; beyond that (and for speed/resumability) use multipart upload.'],
      ['Consistency', 'Strong read-after-write', 'A new object is immediately readable — the old eventual-consistency caveat is gone.'],
      ['Cost shape', 'Requests & egress dominate', 'Storage is cheap; per-request charges and data-transfer-out are where big bills come from.'],
    ],
    fails: [
      ['Sequential-key hot prefix', 'Keys like <code>2026-07-09/…</code> concentrate today\'s traffic on one prefix and throttle. Prefix with a hash so load spreads.'],
      ['Using S3 as a hot KV store', 'Per-object latency makes S3 a poor cache/session store; small hot reads belong in Redis or behind CloudFront.'],
      ['Egress bill shock', 'Serving lots of data straight from S3 to users racks up transfer-out charges; a CDN both offloads requests and cuts egress cost.'],
      ['LIST at scale', 'Listing a bucket with millions of objects is slow and paginated; keep an index (in a DB) instead of listing to find things.'],
      ['Tiny-object overhead', 'Millions of small objects mean request cost and per-object overhead dominate; batch/pack them or use a different store.'],
    ],
    ladder: [
      "<b>Let S3 scale storage &amp; bandwidth</b> — you don't provision it; it grows automatically.",
      '<b>Spread key prefixes</b> (hash a path segment) so request rate scales past the per-prefix ceiling.',
      '<b>Use multipart upload</b> for large objects to parallelize and make transfers resumable.',
      '<b>Put a CDN in front</b> for hot objects — offloads requests, hides latency, and slashes egress cost.',
      "<b>Manage cost with lifecycle rules</b> — tier cold data to cheaper classes and expire what you don't need.",
    ],
  },
}
