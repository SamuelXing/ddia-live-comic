import { useEffect, useState } from 'react'
import { encodeScenario, decodeScenario, writeScenario } from './shareState'
import { ShareBtn } from './ShareBtn'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Picker, Info, Num, Slider, Ctl } from './calcUI'
import type { Vals } from './calcModel'
import {
  PATH, GEO, LWORKLOAD, LHW, LINIT, LPRESETS, latency, fmtMs, queueMultiplier, floorMs,
  FIBRE_KM_PER_MS, FIBRE_EXACT_KM_PER_MS, DC_FLOOR_MS, type LReq,
} from './latencyModel'

/* ============================================================
   The latency budget.

   Companion to the capacity calculator, and a deliberately different
   shape. That page divides load by ceilings and tells you what to
   build. This one takes a promise — "200 ms at the p99" — and SPENDS
   it, term by term, until either there is headroom left or there is
   not. The arithmetic lives in latencyModel.ts, pure and unit-tested.

   The thesis: PHYSICS FLOORS · HOPS ADD · UTILIZATION MULTIPLIES ·
   FAN-OUT AMPLIFIES THE TAIL.
   ============================================================ */

const pct = (n: number) => Math.max(0, Math.round(n * 100)) + '%'

/** the colour of a term says whether you can do anything about it */
const KIND_LABEL: Record<string, string> = {
  physics: 'nothing moves this but geography',
  work: 'yours to profile or remove',
  queue: 'yours, by running the tier cooler',
  tail: 'yours, by fanning out less or hedging',
}

const L_INPUTS = [...LWORKLOAD, ...LHW]
const L_PICKS = [
  { key: 'path', options: PATH },
  { key: 'geo', options: GEO },
]

export default function LatencyCalculator() {
  // read the link in the initialiser, so the page never paints the default
  // budget and then jumps to the shared one
  const [shared] = useState(() =>
    decodeScenario(L_INPUTS, typeof window === 'undefined' ? '' : window.location.search, L_PICKS),
  )
  const [v, setV] = useState<Vals>(() => ({ ...LINIT, ...shared.vals }))
  const [path, setPath] = useState(shared.picks.path ?? 'read')
  const [geo, setGeo] = useState(shared.picks.geo ?? 'country')
  const [preset, setPreset] = useState<string | null>(null)
  const [showHw, setShowHw] = useState(false)
  const req: LReq = { path, geo }

  const query = encodeScenario(L_INPUTS, v, [
    { key: 'path', value: path, def: 'read' },
    { key: 'geo', value: geo, def: 'country' },
  ])
  useEffect(() => writeScenario(query), [query])

  const set = (id: string) => (n: number) => {
    setPreset(null)
    setV((s) => ({ ...s, [id]: n }))
  }
  const applyPreset = (id: string) => {
    const p = LPRESETS.find((x) => x.id === id)!
    setPreset(id)
    setPath(p.req.path)
    setGeo(p.req.geo)
    setV((s) => {
      const n = { ...s }
      LWORKLOAD.forEach((i) => (n[i.id] = i.val))
      return { ...n, ...p.sets }
    })
  }
  const resetAll = () => {
    setV(LINIT)
    setPath('read')
    setGeo('country')
    setPreset(null)
  }
  const atDefaults =
    Object.keys(LINIT).every((k) => v[k] === LINIT[k]) && path === 'read' && geo === 'country'

  const m = latency(v, req)
  const over = m.left < 0
  const active = LPRESETS.find((p) => p.id === preset) ?? null

  /* ---------- what would actually help, priced ---------- */
  const cooler = v.util > 50 ? (v.appMs * v.hops + m.storeP99) * (m.qm - queueMultiplier(50)) : 0
  const closer = m.geo.id === 'dc' ? 0 : m.floor - floorMs(GEO[Math.max(0, GEO.findIndex((g) => g.id === m.geo.id) - 1)].km, v.route)
  const fewerHops = v.hops > 1 ? v.appMs + DC_FLOOR_MS : 0
  const lessFanout = m.tailCost
  const fixes = [
    { id: 'cool', on: cooler > 0, ms: cooler, what: `Run the tier at 50% instead of ${v.util}%`,
      why: `queueing is a multiplier on work you already do, so it is the only term that improves without changing a single line of code. Dropping to 50% takes the response multiplier from ×${(Math.round(m.qm * 100) / 100).toLocaleString()} to ×2.` },
    { id: 'close', on: closer > 0, ms: closer, what: `Move the data one step closer than ${m.geo.label.toLowerCase()}`,
      why: 'the floor is not a performance problem, it is a placement problem. A read replica or an edge cache in the user’s region is the only thing that moves it, and it buys the same milliseconds for every request forever.' },
    { id: 'hops', on: fewerHops > 0, ms: fewerHops, what: 'Remove one service from the chain',
      why: 'each service costs its own work plus a datacenter round trip plus its share of queueing. Collapsing two services that always call each other is usually the cheapest millisecond on this list.' },
    { id: 'fan', on: lessFanout > 0, ms: lessFanout, what: 'Hedge the fan-out, or query fewer shards',
      why: 'a hedged request — send a second copy once the first passes its p95 and take whichever returns — cuts the tail without cutting the fan-out, because it only needs ONE of them to be fast. Dean & Barroso report this taking a 99th percentile from 1,800 ms to 74 ms.' },
    { id: 'code', on: v.appMs > 1, ms: (v.appMs / 2) * v.hops, what: 'Halve your own service time',
      why: 'the honest baseline for comparison. Profiling is real work and it moves a real term — but notice where it sits on this list relative to simply running the tier cooler.' },
  ].filter((f) => f.on).sort((a, b) => b.ms - a.ms)

  /* ---------- what will not help, which is the more useful half ---------- */
  const wont: { what: string; why: ReactNode }[] = []
  if (!m.isWrite && m.cache.tailIsMiss)
    wont.push({
      what: 'Raising the cache hit rate',
      why: (
        <>
          At {v.cacheHit}% hits the mean is {fmtMs(m.cache.mean)}, but{' '}
          <Num how={`1 − ${v.cacheHit}% = ${100 - v.cacheHit}% of requests miss, and that is more than 1%`}>
            a p99 request is still a miss
          </Num>{' '}
          — so the 99th percentile stays at {fmtMs(m.diskMs)} no matter how good the hit rate gets, right up until
          it passes 99%. Caches are a throughput and mean-latency tool. They are not a tail tool.
        </>
      ),
    })
  if (m.floor > v.budget * 0.4)
    wont.push({
      what: 'More machines, bigger machines, faster code',
      why: (
        <>
          <Num how={`2 × ${m.geo.km.toLocaleString()} km ÷ ${FIBRE_KM_PER_MS} km/ms × ${v.route}`}>{fmtMs(m.floor)}</Num>{' '}
          of this budget is the speed of light in fibre, which is{' '}
          {pct(m.floor / v.budget)} of it. No amount of capacity touches that number — only moving the data closer
          to the user does.
        </>
      ),
    })
  if (v.fanout > 1)
    wont.push({
      what: 'Making the median backend faster',
      why: (
        <>
          A {v.fanout}-way fan-out needs one server’s{' '}
          <Num how={`0.99^(1/${v.fanout}) = ${(Math.round(m.needed * 1e6) / 1e4).toFixed(3)}%`}>
            p{(Math.round(m.needed * 1e6) / 1e4).toFixed(2)}
          </Num>
          , not its median — and{' '}
          <Num how={`1 − (1 − 1%)^${v.fanout}`}>{pct(m.slowChance)}</Num> of requests already touch at least one slow
          backend. Tightening the tail is what helps here; a faster median is nearly invisible.
        </>
      ),
    })
  if (v.util >= 80)
    wont.push({
      what: 'Reading the capacity page as reassurance',
      why: (
        <>
          At {v.util}% the response multiplier is{' '}
          <Num how={`1 ÷ (1 − ${v.util}%)`}>×{Math.round(m.qm * 10) / 10}</Num>. A capacity page can honestly report
          that you are inside every ceiling while this page reports that the tier is unusable — both are right, and
          this is the one they do not agree on.
        </>
      ),
    })

  const scale = Math.max(v.budget, m.spent)

  return (
    <section className="calc-page">
      <p className="h-kicker">Latency budget</p>
      <h1 className="title">Where does the time actually go?</h1>
      <p className="lede">
        <b>Physics floors, hops add, utilization multiplies, fan-out amplifies the tail.</b> State the
        promise you are making — a p99 target — and this page <em>spends</em> it, term by term, until
        there is headroom left or there is not. The capacity page asks whether the system can carry the
        load. This one asks whether it can answer in time, and the two frequently disagree.
      </p>

      <div className="calc-scope">
        <div className="scope-col in">
          <span className="scope-h">What it computes</span>
          <p>
            <b>A budget, spent in closed form.</b> The speed of light in fibre for your geography · a
            datacenter round trip per service in the chain · your own service time · the storage hop ·
            the queueing multiplier at your utilization · what a fan-out adds to the tail. Then it names
            the largest term, and prices the fixes against each other.
          </p>
        </div>
        <div className="scope-col out">
          <span className="scope-h">What it does not</span>
          <p>
            <b>It does not predict your p99.</b> A queueing network with assumed arrival and service
            distributions produces a confident number that is frequently wrong, and this page would
            rather be checkable than confident. Treat every term as the order of magnitude that term
            costs, and the ranking between them as the actual output.
          </p>
        </div>
      </div>

      <div className="calc-pure">
        <span className="scope-h">How the answer is produced</span>
        <p>
          <b>Every term is one line of arithmetic.</b>{' '}
          <code>floor = 2 × km ÷ 200 km/ms × route</code> ·{' '}
          <code>queue = work × (1 ÷ (1 − ρ) − 1)</code> ·{' '}
          <code>P(at least one slow) = 1 − (1 − p)ⁿ</code> ·{' '}
          <code>p99 of n needs one server’s 0.99^(1/n)</code>. The hardware constants are the same
          objects the capacity page uses, imported rather than restated, so fsync cannot mean 300 µs on
          one page and something else on the other. The single place a distribution is assumed rather
          than measured — the tail shape used to turn a fan-out percentile into milliseconds — is
          marked <span className="src-a">assumed</span> and shown with its formula.
        </p>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="sandbox">
          <div className="sb-controls">
            <div className="sb-head">
              <p className="sb-title" style={{ margin: 0 }}>Start from a typical request</p>
              <div className="sb-actions">
                <ShareBtn query={query} />
                <button className="reset-btn" onClick={resetAll} disabled={atDefaults}>Reset all</button>
              </div>
            </div>
            <div className="ctl">
              <Picker options={LPRESETS} value={preset ?? ''} onPick={applyPreset} />
              <div className="ctl-hint">
                {active ? active.info : 'One click moves every slider below — nothing hidden. Adjust from there.'}
              </div>
            </div>

            <p className="sb-title" style={{ marginTop: 18 }}>The request</p>
            <Ctl label="What you are timing" info={PATH.find((o) => o.id === path)!.info} hint={PATH.find((o) => o.id === path)!.info.split('.')[0] + '.'}>
              <Picker options={PATH} value={path} onPick={(id) => { setPreset(null); setPath(id) }} />
            </Ctl>
            <Ctl label="How far the data is" info={GEO.find((o) => o.id === geo)!.info} hint={GEO.find((o) => o.id === geo)!.info.split('.')[0] + '.'}>
              <Picker options={GEO} value={geo} onPick={(id) => { setPreset(null); setGeo(id) }} />
            </Ctl>

            <p className="sb-title" style={{ marginTop: 18 }}>The path it takes</p>
            {LWORKLOAD.map((inp) => (
              <Ctl key={inp.id} label={inp.label} info={inp.info} hint={inp.hint} val={inp.fmt(v[inp.id])}>
                <Slider inp={inp} value={v[inp.id]} set={set(inp.id)} />
              </Ctl>
            ))}

            <button className="hw-toggle" onClick={() => setShowHw((s) => !s)}>
              {showHw ? '▾' : '▸'} The hardware underneath
            </button>
            {showHw && (
              <div className="hw-body">
                <p className="hw-note">
                  The same measured constants the capacity page uses — one definition, imported, so the
                  two pages cannot drift apart.
                </p>
                {LHW.map((inp) => (
                  <div className="ctl" key={inp.id}>
                    <div className="ctl-top">
                      <span className="ctl-label">
                        {inp.label}{' '}
                        <span className={inp.src === 'napkin' ? 'src-n' : 'src-a'}>
                          {inp.src === 'napkin' ? 'measured' : 'assumed'}
                        </span>
                        <Info text={inp.info} />
                      </span>
                      <span className="ctl-val">{inp.fmt(v[inp.id])}</span>
                    </div>
                    <Slider inp={inp} value={v[inp.id]} set={set(inp.id)} />
                    <div className="ctl-hint">{inp.hint}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sb-out">
            <p className="sb-title">The budget, spent</p>
            <div className={'budget' + (over ? ' over' : '')}>
              <div className="bud-bar">
                {m.terms.filter((t) => t.ms > 0).map((t) => (
                  <span
                    key={t.id}
                    className={'bud-seg k-' + t.kind}
                    style={{ width: (t.ms / scale) * 100 + '%' }}
                    title={`${t.label} — ${fmtMs(t.ms)} (${t.how})`}
                  />
                ))}
                <span className="bud-target" style={{ left: (v.budget / scale) * 100 + '%' }} />
              </div>
              <div className="bud-read">
                <b>{fmtMs(m.spent)}</b> spent of {v.budget} ms
                {over ? (
                  <span className="bud-over"> — {fmtMs(-m.left)} over</span>
                ) : (
                  <span className="bud-left"> — {fmtMs(m.left)} left</span>
                )}
                <span className="bud-worst">largest term: {m.worst.label.toLowerCase()}</span>
              </div>
            </div>

            {/* the terms table has a min-width floor (two columns cannot wrap),
                so it needs its own scroll box or it widens the whole page */}
            <div className="dc-scroll">
            <table className="tbl tbl-terms">
              <thead>
                <tr>
                  <th>Where it goes</th>
                  <th>Cost</th>
                  <th>Share</th>
                  <th>The arithmetic</th>
                </tr>
              </thead>
              <tbody>
                {m.terms.map((t) => (
                  <tr key={t.id}>
                    <td>
                      {t.label}
                      <Info text={`${t.why} (${KIND_LABEL[t.kind]})`} />
                    </td>
                    <td>{t.ms > 0 ? <Num how={t.why}>{fmtMs(t.ms)}</Num> : '—'}</td>
                    <td className="use">{t.ms > 0 ? pct(t.ms / m.spent) : '—'}</td>
                    <td className="how">{t.how}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <p className="tbl-note">
              The floor is the only term nothing but geography moves — {fmtMs(m.irreducible)} of this
              budget is already spent before your code runs. Everything below it is yours.
            </p>
            <p className="tbl-note">
              <b>Where those two constants come from.</b> The distance is a great-circle figure for a
              named pair — {m.geo.pair}, {m.geo.km.toLocaleString()} km — doubled because a request goes
              there and comes back. The <b>200 km/ms</b> is derived rather than remembered: light in a
              vacuum is a measured <b>299,792 km/s</b>, silica single-mode fibre has a refractive index
              near <b>1.47</b>, and light in a medium travels at <code>c ÷ n</code> — so 299,792 ÷ 1.47
              ÷ 1,000 = <b>{Math.round(FIBRE_EXACT_KM_PER_MS * 10) / 10} km/ms</b>, which this page
              rounds down to 200. The routing factor on top is the one part that is a{' '}
              <span className="src-a">modelling choice</span>: real fibre follows seabeds and roads
              rather than great circles, and ×1.4 is what puts New York–London at 78 ms against its
              measured 70–80.
            </p>

            <p className="sb-title">What would actually help, in order</p>
            {fixes.map((f) => (
              <div className="rec" key={f.id}>
                <div className="rec-h">
                  <span className="rec-tag">saves {fmtMs(f.ms)}</span>
                  <b>{f.what}</b>
                </div>
                <p className="rec-b">{f.why}</p>
              </div>
            ))}

            {wont.length > 0 && (
              <>
                <p className="sb-title">What will not help — and this is the useful half</p>
                {wont.map((w) => (
                  <div className="rec rec-off" key={w.what}>
                    <div className="rec-h">
                      <span className="rec-tag off">no effect</span>
                      <b>{w.what}</b>
                    </div>
                    <div className="rec-trig">{w.why}</div>
                  </div>
                ))}
              </>
            )}

            <p className="sb-title">The two calculators disagree here</p>
            <div className="dc-quiet">
              <b>Every fix the capacity page recommends is a hop.</b> A log absorbs your write peak{' '}
              <em>and</em> adds latency to every write. A cache cuts database load <em>and</em> leaves your
              p99 exactly where it was until the hit rate passes 99%. Sharding cuts per-node load{' '}
              <em>and</em> turns one lookup into a scatter-gather whose p99 is the slowest shard. That
              tension is the real lesson, so the two pages are worth reading against each other rather
              than in sequence.{' '}
              <Link to="/calculator/capacity">Capacity planning →</Link>
            </div>

            <p className="sb-title">The shape of it</p>
            <div className="tiles">
              <div className="tile">
                <div className="k">Queue multiplier</div>
                <div className="v">×{Math.round(m.qm * 10) / 10}</div>
                <div className="u">at {v.util}% utilization</div>
              </div>
              <div className="tile">
                <div className="k">Physics floor</div>
                <div className="v">{fmtMs(m.floor)}</div>
                <div className="u">{pct(m.floor / v.budget)} of budget</div>
              </div>
              <div className="tile">
                <div className="k">Touches a slow backend</div>
                <div className="v">{pct(m.slowChance)}</div>
                <div className="u">1 − 0.99^{v.fanout}</div>
              </div>
              <div className="tile">
                <div className="k">p99 of the fan-out</div>
                <div className="v">{fmtMs(m.fanP99)}</div>
                <div className="u">one backend: {fmtMs(v.p99)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <details className="calc-help">
        <summary>
          <span className="chev">▸</span> Checked against published measurements
        </summary>
        <div className="calc-help-b">
          <p>
            The same discipline as the capacity page: a pure module, unit tests whose expected values were
            worked out by hand, and anchors pinned to figures other people published. An anchor validates
            the formula that runs through it, not the whole model.
          </p>
          <div className="dc-scroll">
            <table className="tbl tbl-anchor">
              <thead>
                <tr>
                  <th>What this page computes</th>
                  <th>What is published</th>
                  <th>Verdict</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    Fan-out tail: 1 − 0.99<sup>100</sup> = <b>63.4%</b> of requests touch a slow backend
                  </td>
                  <td>
                    Dean &amp; Barroso, <em>The Tail at Scale</em> (CACM 2013), work the identical example
                    and state <b>63%</b>: a service where 1 in 100 requests exceeds 1 s, fanned out to 100
                    servers, serves most requests slowly.
                  </td>
                  <td className="ok">matches</td>
                </tr>
                <tr>
                  <td>
                    New York to London: 2 × 5,585 km ÷ 200 km/ms = <b>55.9 ms</b>, ×1.4 routing ={' '}
                    <b>78 ms</b>
                  </td>
                  <td>
                    Light in fibre is about two-thirds of c. Measured transatlantic round trips run{' '}
                    <b>70–80 ms</b> — the routing factor is doing exactly the work it claims to.
                  </td>
                  <td className="ok">matches</td>
                </tr>
                <tr>
                  <td>
                    Inside one datacenter the floor is <b>{DC_FLOOR_MS} ms</b>, not the wire
                  </td>
                  <td>
                    napkin-math measures a round trip within one datacenter at <b>~500 µs</b>. At 1 km the
                    wire itself is 0.01 ms, so switching, serialization and the kernel are the entire cost.
                  </td>
                  <td className="ok">matches</td>
                </tr>
                <tr>
                  <td>
                    A hedged request cuts the tail without cutting the fan-out
                  </td>
                  <td>
                    Dean &amp; Barroso measured a Google benchmark going from a <b>1,800 ms</b> 99th
                    percentile to <b>74 ms</b> by sending a second copy after the first passed its p95 —
                    for 2% extra requests.
                  </td>
                  <td className="ok">corroborates</td>
                </tr>
                <tr>
                  <td>
                    Queueing: response = service ÷ (1 − ρ), so 90% utilization is <b>×10</b>
                  </td>
                  <td>
                    Standard M/M/1. Real systems have bursty arrivals and heavy-tailed service times, which
                    makes the true curve <em>worse</em> than this, not better — so the shape holds even
                    where the exact factor does not.
                  </td>
                  <td className="warn">shape, not a prediction</td>
                </tr>
                <tr>
                  <td>
                    Turning a fan-out percentile into milliseconds
                  </td>
                  <td>
                    This is the one place a distribution is assumed: an exponential tail fitted through
                    your p50 and p99. The <em>probability</em> above needs no such assumption; the
                    millisecond figure does. At n = 100 it works out to doubling the tail excess over the
                    median.
                  </td>
                  <td className="warn">assumed</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="calc-src">
            Sources:{' '}
            <a href="https://research.google/pubs/the-tail-at-scale/" target="_blank" rel="noreferrer">
              Dean &amp; Barroso, The Tail at Scale
            </a>{' '}
            ·{' '}
            <a href="https://github.com/sirupsen/napkin-math" target="_blank" rel="noreferrer">
              sirupsen/napkin-math
            </a>{' '}
            (MIT). The honest gap: every term here is a median-plus-tail sketch, not a queueing-network
            solution. It is built to tell you which term to attack, not what your p99 will be next Tuesday.
          </p>
        </div>
      </details>

      <div className="note">
        <b>Why this is a separate page.</b> Capacity is division — load over ceiling, monotone, safe to
        extrapolate. Latency is not: it is a hockey stick that goes vertical well before the ceiling the
        other page measures against. At 43% of a ceiling you are already waiting three-quarters of your
        service time in a queue, which is why “we are only at 80% CPU” is a statement about latency rather
        than comfort. Merging the two into one panel would imply they behave alike, and the single most
        important fact here is that they do not.
      </div>
    </section>
  )
}
