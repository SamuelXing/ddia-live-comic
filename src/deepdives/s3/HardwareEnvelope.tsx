import { useState } from 'react'
import { fmt } from '../format'
import { LAD, LadderSlider } from '../ladder'

/* ============================================================
   The envelope for a service you do not own. S3 has no instance
   shape to pick — so the shape is YOUR client, and the ceilings
   are the service's published rate limits plus a price list.

   Model (r ops/s, g% of them GETs, s = object size, P prefixes,
   L = first-byte latency, D = TB stored):
     per-prefix GET  = r·g / P            vs 5,500/s
     per-prefix PUT  = r·(1−g) / P        vs 3,500/s
     bandwidth       = r · s              vs the client NIC
     in flight       = r · L/1000         vs the SDK pool
     parts           = ceil(s / 16 MB)    vs 10,000
   Rate ceilings: AWS S3 "Best practices design patterns".
   Prices: us-east-1 S3 Standard list, order-of-magnitude.
   ============================================================ */

interface Shape {
  name: string
  nicGbps: number
  note: string
}

const SHAPES: Shape[] = [
  { name: 'Small instance', nicGbps: 5, note: '2 vCPU · up to 5 Gbps' },
  { name: 'Network optimized', nicGbps: 25, note: '8 vCPU · 25 Gbps' },
  { name: 'Big data node', nicGbps: 100, note: '48 vCPU · 100 Gbps' },
  { name: 'Fleet of 20', nicGbps: 500, note: '20 × 25 Gbps aggregate' },
]

const GET_CEIL = 5500 // GET/HEAD per second per partitioned prefix
const PUT_CEIL = 3500 // PUT/COPY/POST/DELETE per second per partitioned prefix
const SDK_POOL = 50 // default max connections in the AWS SDKs (10 in boto3, 50 in the Java SDK)
const MAX_PARTS = 10000 // multipart upload hard limit
const PART_MB = 16 // a sane default part size
const STORAGE_GB_MO = 0.023 // $/GB-month, S3 Standard
const GET_PER_1K = 0.0004 // $/1,000 GET
const PUT_PER_1K = 0.005 // $/1,000 PUT
const SEC_PER_MO = 2592000

/* Request charges are fractions of a cent per gigabyte at ordinary object
   sizes, and fmt.usd rounds those to "$0" — which turns the one comparison
   this widget exists to make into nonsense. Below a cent, print two
   significant figures instead. */
function money(n: number): string {
  if (n === 0) return '$0'
  if (n < 0.01) return '$' + fmt.sig(n, 2)
  return fmt.usd(n)
}

export default function HardwareEnvelope() {
  /* The landing state puts exactly one meter in the red, and it is the
     surprising one: at a ~100 ms floor, a default SDK connection pool caps a
     client at ~500 ops/s no matter how large the instance. Everything else
     starts comfortable so the reader can push each ceiling deliberately. */
  const [shapeIdx, setShapeIdx] = useState(1)
  const [rate, setRate] = useState(5e3)
  const [getPct, setGetPct] = useState(80)
  const [objKB, setObjKB] = useState(200)
  const [prefixes, setPrefixes] = useState(10)
  const [latMs, setLatMs] = useState(100)
  const [storedTB, setStoredTB] = useState(500)

  const sh = SHAPES[shapeIdx]
  const nicMBs = sh.nicGbps * 125

  const gets = (rate * getPct) / 100
  const puts = rate - gets
  const perPrefixGet = gets / prefixes
  const perPrefixPut = puts / prefixes
  const bwMBs = (rate * objKB) / 1024
  const inFlight = (rate * latMs) / 1000
  const objMB = objKB / 1024
  const parts = Math.max(1, Math.ceil(objMB / PART_MB))

  const storageCost = storedTB * 1024 * STORAGE_GB_MO
  const reqCost = ((gets / 1000) * GET_PER_1K + (puts / 1000) * PUT_PER_1K) * SEC_PER_MO
  const total = storageCost + reqCost
  const reqShare = (reqCost / Math.max(1e-9, total)) * 100
  /* What one GET costs per GB moved — the small-object tax, stated in the same
     unit as the storage price so the two are directly comparable. */
  const costPerGBRead = GET_PER_1K / 1000 / (objKB / 1048576)

  const rows = [
    { label: 'Per-prefix GET rate', used: perPrefixGet, cap: GET_CEIL, unit: '/s', why: `${fmt.compact(gets)}/s of reads ÷ ${fmt.int(prefixes)} prefixes. The ceiling is per partitioned prefix, and there is no limit on how many prefixes a bucket may have.` },
    { label: 'Per-prefix PUT rate', used: perPrefixPut, cap: PUT_CEIL, unit: '/s', why: `${fmt.compact(puts)}/s of writes ÷ ${fmt.int(prefixes)} prefixes. Writes hit the wall before reads do — 3,500 against 5,500.` },
    { label: 'Client bandwidth', used: bwMBs, cap: nicMBs, unit: 'MB/s', why: `${fmt.compact(rate)}/s × ${fmt.bytes(objKB * 1024)}. Once objects are large this is what binds, and it is your NIC — not S3 — doing the binding.` },
    { label: 'Requests in flight', used: inFlight, cap: SDK_POOL, unit: 'concurrent', why: `Little's Law again: ${fmt.compact(rate)}/s × ${latMs} ms = ${fmt.sig(inFlight)} concurrent requests. SDK connection pools default to 10–50, which is the quiet reason so many S3 clients plateau far below the service's limits.` },
    { label: 'Multipart parts', used: parts, cap: MAX_PARTS, unit: 'parts', why: `${fmt.bytes(objKB * 1024)} ÷ ${PART_MB} MB parts. A 5 TB object needs parts of at least ~512 MB to stay under the 10,000-part limit.` },
  ]

  const worst = rows.reduce((a, b) => (b.used / b.cap > a.used / a.cap ? b : a), rows[0])
  const worstPct = (worst.used / worst.cap) * 100
  const prefixesNeeded = Math.max(Math.ceil(gets / GET_CEIL), Math.ceil(puts / PUT_CEIL), 1)

  const explain: Record<string, string> = {
    'Per-prefix GET rate': `Spread reads across at least ${fmt.int(prefixesNeeded)} prefixes — a hashed leading path segment is the standard move. Each prefix is another 5,500 reads a second, and the ceiling on prefixes is that there isn't one.`,
    'Per-prefix PUT rate': `Writes throttle first. Spread across at least ${fmt.int(prefixesNeeded)} prefixes, and remember S3 repartitions gradually — you get 503s during the ramp even when the target design is correct.`,
    'Client bandwidth': 'You are byte-bound, not request-bound, which is the comfortable side of this page. Add clients or a bigger NIC; parallelism across parts and byte ranges is what turns aggregate bandwidth into useful throughput.',
    'Requests in flight': 'Raise the SDK connection pool and the concurrency setting. This is the single most common reason a client reports "S3 is slow" while sitting far below every published limit — you are queueing at your own pool, not at the service.',
    'Multipart parts': `At this object size you need parts larger than ${PART_MB} MB to stay under 10,000. Part size is not a tuning knob at the top end, it is a correctness constraint.`,
  }

  const verdict =
    worstPct >= 100
      ? { s: 'crit', t: `<b>${worst.label} is over the ceiling</b> (${Math.round(worstPct)}%). ${explain[worst.label]}` }
      : worstPct >= 75
        ? { s: 'warn', t: `<b>${worst.label} binds first</b>, at ${Math.round(worstPct)}%. ${explain[worst.label]}` }
        : {
            s: 'good',
            t: `<b>Inside every ceiling.</b> Binding constraint: ${worst.label} at ${Math.round(worstPct)}%. Note what is <em>not</em> a constraint anywhere on this widget — capacity. You will never fill S3, and no meter here will ever be about how much you stored. <b>The envelope of a managed service is a rate limit and a price list.</b>`,
          }

  return (
    <div className="hwv card" style={{ padding: 0 }}>
      <div className="sandbox">
        <div className="sb-controls">
          <p className="sb-title">Your client, and the access pattern</p>
          <div className="ctl">
            <div className="ctl-top"><span className="ctl-label">Client shape</span></div>
            <div className="hw-shapes">
              {SHAPES.map((s, i) => (
                <button key={s.name} className={'hw-shape' + (i === shapeIdx ? ' on' : '')} onClick={() => setShapeIdx(i)}>
                  <b>{s.name}</b>
                  <span>{s.note}</span>
                </button>
              ))}
            </div>
          </div>
          {[
            { label: 'Request rate', val: rate, set: setRate, steps: LAD.rate, fmtV: (v: number) => fmt.compact(v) + '/s', hint: 'Total object operations per second across the workload.' },
            { label: 'Read (GET) share', val: getPct, set: setGetPct, steps: LAD.pct, fmtV: (v: number) => v + '% GET', hint: 'Reads and writes have different ceilings — 5,500 against 3,500.' },
            { label: 'Average object size', val: objKB, set: setObjKB, steps: [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 5000, 10000, 100000, 1000000, 5000000], fmtV: (v: number) => fmt.bytes(v * 1024), hint: 'The most consequential number on this page. It decides request-bound vs byte-bound, and it decides the bill.' },
            { label: 'Key prefixes', val: prefixes, set: setPrefixes, steps: LAD.many, fmtV: (v: number) => fmt.int(v), hint: 'Distinct partitioned prefixes S3 can spread the load across. This is your only horizontal knob.' },
            { label: 'First-byte latency', val: latMs, set: setLatMs, steps: LAD.ms, fmtV: (v: number) => v + ' ms', hint: 'The structural floor: DNS, TLS, signature, policy, index lookup, fan-out read.' },
            { label: 'Total stored', val: storedTB, set: setStoredTB, steps: LAD.gb, fmtV: (v: number) => (v >= 1000 ? fmt.n1(v / 1000) + ' PB' : v + ' TB'), hint: 'Effectively unlimited — this only ever drives cost, never capacity.' },
          ].map((c) => (
            <div className="ctl" key={c.label}>
              <div className="ctl-top">
                <span className="ctl-label">{c.label}</span>
                <span className="ctl-val">{c.fmtV(c.val)}</span>
              </div>
              <LadderSlider steps={c.steps} value={c.val} onChange={c.set} ariaLabel={c.label} />
              <div className="ctl-hint">{c.hint}</div>
            </div>
          ))}
        </div>
        <div className="sb-out">
          <p className="sb-title">Load vs the service ceilings</p>
          {rows.map((r) => {
            const pct = (r.used / r.cap) * 100
            const st = pct >= 100 ? 'crit' : pct >= 75 ? 'warn' : 'good'
            return (
              <div className="meter" key={r.label}>
                <div className="meter-top">
                  <span className="meter-label">{r.label}</span>
                  <span className={`meter-num st-${st}`}>
                    {fmt.sig(r.used)} / {fmt.int(r.cap)} {r.unit}
                  </span>
                </div>
                <div className="meter-bar">
                  <div className={`meter-fill fill-${st}`} style={{ width: Math.min(100, pct) + '%' }} />
                </div>
                <div className="meter-detail">{r.why}</div>
              </div>
            )
          })}
          <div className="meter">
            <div className="meter-top">
              <span className="meter-label">The small-object tax</span>
              <span className="meter-num">{money(costPerGBRead)} / GB read</span>
            </div>
            <div className="meter-detail">
              At {fmt.bytes(objKB * 1024)} per object, request charges alone come to{' '}
              <b>{money(costPerGBRead)} per GB read</b> — against <b>${STORAGE_GB_MO}/GB-month</b>{' '}
              to store it. Below ~100 KB the per-request charge starts to dwarf storage entirely:
              reading a 4 KB object <em>once</em> costs about four times what keeping it for a month
              does. This month: {fmt.usd(storageCost)} storage + {fmt.usd(reqCost)} requests, so{' '}
              <b>{Math.round(reqShare)}% of the bill is requests</b>.
            </div>
          </div>
          <div className={`verdict v-${verdict.s}`}>
            <span className="vi">{verdict.s === 'good' ? '✓' : verdict.s === 'warn' ? '▲' : '✕'}</span>
            <span dangerouslySetInnerHTML={{ __html: verdict.t }} />
          </div>
        </div>
      </div>
    </div>
  )
}
