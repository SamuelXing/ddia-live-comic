import type { ComputeResult, InputDef, Values } from '../types'
import { fmt } from '../format'
import { LAD } from '../ladder'

/* The scale-out sandbox. S3 has exactly one horizontal knob — how many
   partitioned prefixes the load spreads across — and one lever that beats
   it, which is not sending the request at all. The bill is the third
   output because on this tier it is a capacity signal, not an afterthought. */

const GET_CEIL = 5500
const PUT_CEIL = 3500
const STORAGE_GB_MO = 0.023
const GET_PER_1K = 0.0004
const PUT_PER_1K = 0.005
const EGRESS_GB = 0.09 // transfer out to the internet, first tier, order-of-magnitude
const SEC_PER_MO = 2592000

export const scaleOutInputs: InputDef[] = [
  { id: 'req', label: 'Request rate', steps: LAD.rate, val: 2e4, hint: 'Total object operations per second at peak.', fmt: (v) => fmt.compact(v) + '/s' },
  { id: 'getPct', label: 'Read (GET) share', steps: LAD.pct, val: 80, hint: 'Reads and writes have separate per-prefix ceilings — 5,500 and 3,500.', fmt: (v) => v + '% GET' },
  { id: 'prefixes', label: 'Key prefixes', steps: LAD.many, val: 10, hint: 'How many partitioned prefixes the keys spread across. The only horizontal knob S3 gives you.', fmt: (v) => fmt.int(v) },
  { id: 'cdn', label: 'CDN hit rate', steps: LAD.pct, val: 0, hint: 'Share of reads served at the edge and never sent to the bucket. The lever that beats prefixes.', fmt: (v) => v + '%' },
  { id: 'obj', label: 'Average object size', steps: [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 5000, 10000, 100000], val: 200, hint: 'Decides whether you are request-bound or byte-bound — and decides the bill.', fmt: (v) => fmt.bytes(v * 1024) },
  { id: 'store', label: 'Total stored', steps: LAD.gb, val: 500, hint: 'Effectively unlimited. It only ever drives cost.', fmt: (v) => (v >= 1000 ? fmt.n1(v / 1000) + ' PB' : v + ' TB') },
]

export function computeScaleOut(v: Values): ComputeResult {
  const gets = (v.req * v.getPct) / 100
  const puts = v.req - gets
  const originGets = gets * (1 - v.cdn / 100)

  const perPrefixGet = originGets / v.prefixes
  const perPrefixPut = puts / v.prefixes
  const getPct = (perPrefixGet / GET_CEIL) * 100
  const putPct = (perPrefixPut / PUT_CEIL) * 100
  const prefixesNeeded = Math.max(Math.ceil(originGets / GET_CEIL), Math.ceil(puts / PUT_CEIL), 1)

  const objGB = v.obj / 1048576
  const egressGB = originGets * objGB * SEC_PER_MO
  const storageCost = v.store * 1024 * STORAGE_GB_MO
  const reqCost = ((originGets / 1000) * GET_PER_1K + (puts / 1000) * PUT_PER_1K) * SEC_PER_MO
  const egressCost = egressGB * EGRESS_GB
  const monthly = storageCost + reqCost + egressCost
  const reqShare = (reqCost / Math.max(1e-9, monthly)) * 100
  const servedGB = gets * objGB * SEC_PER_MO
  const costPerGB = monthly / Math.max(1e-9, servedGB)

  const meters = [
    {
      label: 'Per-prefix GET rate',
      valTxt: fmt.sig(perPrefixGet) + ' / ' + fmt.int(GET_CEIL) + '/s',
      pct: getPct,
      detail:
        v.cdn > 0
          ? `${fmt.compact(gets)}/s of reads, ${v.cdn}% absorbed at the edge, so ${fmt.compact(originGets)}/s reach the bucket ÷ ${fmt.int(v.prefixes)} prefixes.`
          : `${fmt.compact(gets)}/s of reads ÷ ${fmt.int(v.prefixes)} prefixes, every one of them reaching the bucket.`,
    },
    {
      label: 'Per-prefix PUT rate',
      valTxt: fmt.sig(perPrefixPut) + ' / ' + fmt.int(PUT_CEIL) + '/s',
      pct: putPct,
      detail: `${fmt.compact(puts)}/s of writes ÷ ${fmt.int(v.prefixes)} prefixes. A CDN cannot help here — writes always reach the bucket, and their ceiling is the lower of the two.`,
    },
    {
      label: 'Prefix coverage',
      valTxt: fmt.int(v.prefixes) + ' have / ' + fmt.int(prefixesNeeded) + ' needed',
      pct: (prefixesNeeded / Math.max(1, v.prefixes)) * 100,
      detail:
        v.prefixes >= prefixesNeeded
          ? `Covered. Remember the ceiling is per partitioned prefix: S3 splits partitions gradually in response to load, so a brand-new key layout throttles for a while before it settles.`
          : `Need ≥ ${fmt.int(prefixesNeeded)} prefixes. Add a hashed leading path segment — each new prefix is another 5,500 reads and 3,500 writes per second, and there is no limit on how many a bucket may have.`,
    },
    {
      label: 'Requests as a share of the bill',
      valTxt: Math.round(reqShare) + '% of ' + fmt.usd(monthly) + '/mo',
      pct: reqShare,
      detail: `${fmt.usd(storageCost)} storage + ${fmt.usd(reqCost)} requests + ${fmt.usd(egressCost)} egress. On this tier the invoice is a capacity signal: a request charge this size means the objects are too small, and an egress charge this size means something is missing in front of the bucket.`,
    },
  ]

  let verdict: ComputeResult['verdict']
  if (getPct >= 100 || putPct >= 100)
    verdict = {
      s: 'crit',
      t: `<b>Throttling — S3 returns <code>503 SlowDown</code>.</b> A single prefix is over its ceiling, and the retries this provokes land on the <em>same</em> overloaded prefix, which is Chapter 6&apos;s cascade. Spread across <b>≥ ${fmt.int(prefixesNeeded)} prefixes</b> and back off with jitter while S3 repartitions — the scaling is gradual, so the correct design still throttles on its first day.`,
    }
  else if (getPct >= 75 || putPct >= 75)
    verdict = {
      s: 'warn',
      t: `<b>Close to a per-prefix ceiling.</b> Throttling does not arrive gradually — it arrives as a spike of 503s the first time traffic moves. Add prefixes now, while it is a key-naming change rather than an incident.`,
    }
  else if (reqShare >= 50)
    verdict = {
      s: 'warn',
      t: `<b>You are paying for requests, not storage.</b> ${Math.round(reqShare)}% of ${fmt.usd(monthly)}/month is per-request charges, which is the signature of objects that are too small — at ${fmt.bytes(v.obj * 1024)} the fixed per-request cost has nothing to amortize against. Pack small objects together, or put a cache in front. Capacity is not your problem here and never will be.`,
    }
  else if (v.cdn < 50 && egressCost > storageCost)
    verdict = {
      s: 'warn',
      t: `<b>Egress is outrunning storage</b> — ${fmt.usd(egressCost)}/month to send bytes out against ${fmt.usd(storageCost)}/month to keep them. Access is always skewed, so a CDN in front of the hot fraction cuts request charges, egress charges, <em>and</em> the latency floor at the same time. It is the only lever on this page that improves all three.`,
    }
  else
    verdict = {
      s: 'good',
      t: `<b>Comfortable, and the shape is right.</b> ${fmt.int(v.prefixes)} prefixes cover ${fmt.compact(v.req)}/s, the edge absorbs ${v.cdn}% of reads, and you are serving about ${fmt.usd(costPerGB)} per GB all-in. Notice that nothing here was a capacity decision — every knob was a <em>key-naming</em>, <em>object-size</em>, or <em>caching</em> decision. That is the whole difference between operating a service and operating a machine.`,
    }

  return {
    tiles: [
      { k: 'Prefixes needed', v: fmt.int(prefixesNeeded), u: `have ${fmt.int(v.prefixes)}` },
      { k: 'Reaching the bucket', v: fmt.compact(originGets + puts), u: `of ${fmt.compact(v.req)}/s` },
      { k: 'Est. monthly', v: fmt.usd(monthly), u: 'storage + reqs + egress' },
      { k: 'Cost per GB served', v: fmt.usd(costPerGB), u: 'all-in' },
    ],
    meters,
    verdict,
  }
}
