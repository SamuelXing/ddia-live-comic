import { describe, it, expect } from 'vitest'
import { model, consequences, INIT, STORES, type Req, type Vals } from './calcModel'

/* Every recommendation must be reachable.

   A card that can never fire is dead weight pretending to be advice, and a
   card that ALWAYS fires is not advice either. This sweeps the requirement
   axes and one workload knob at a time, and asserts each component both
   appears and disappears somewhere in that space.

   It also encodes the distinction the "not yet" cards now make explicit:
   some components are gated by a THRESHOLD you can cross by turning a slider
   (cache, CDN, shard), and others by a REQUIREMENT no amount of workload
   tuning will reach (a connection tier needs push; an analytical store needs
   someone to ask for aggregates). Both are reachable — but only one is
   reachable from the workload sliders, which is why the cards say which. */

const REQ_AXES = {
  fresh: ['pull', 'push'],
  txn: ['single', 'multi'],
  loss: ['keep', 'rebuild'],
  analytics: ['no', 'yes'],
  access: ['point', 'range'],
  recency: ['stale', 'current'],
  keyShape: ['monotonic', 'scattered'],
}
const WORKLOAD_AXES: Record<string, number[]> = {
  dau: [1e4, 1e6, 5e7, 5e8],
  actions: [1, 20, 200],
  peak: [1, 3, 10],
  readPct: [0, 50, 85, 99],
  fanout: [0, 1, 100, 1000],
  online: [1, 10, 50],
  writeSize: [1, 50, 5000],
  readSize: [1, 50, 2000],
  retention: [1, 12, 60],
  derived: [0, 1, 3],
}

type Needs = Record<string, boolean>
function sweep(): { needs: Needs; label: string }[] {
  const out: { needs: Needs; label: string }[] = []
  const run = (req: Req, v: Vals, label: string) => {
    const m = model(v, req)
    const holds = m.tCols.find((t) => t.id === m.transportWin)!.holds
    out.push({ needs: consequences(v, req, m, holds).needs, label })
  }
  for (const fresh of REQ_AXES.fresh)
    for (const txn of REQ_AXES.txn)
      for (const loss of REQ_AXES.loss)
        for (const analytics of REQ_AXES.analytics)
          for (const access of REQ_AXES.access)
            for (const recency of REQ_AXES.recency)
              for (const keyShape of REQ_AXES.keyShape)
                run({ fresh, txn, loss, analytics, access, recency, keyShape }, { ...INIT },
                    `${fresh}/${txn}/${loss}/${analytics}/${access}/${recency}/${keyShape}`)
  for (const fresh of REQ_AXES.fresh)
    for (const [key, vals] of Object.entries(WORKLOAD_AXES))
      for (const val of vals)
        run({ fresh, txn: 'single', loss: 'keep', analytics: 'no', access: 'point', recency: 'stale', keyShape: 'monotonic' },
            { ...INIT, [key]: val }, `${fresh} + ${key}=${val}`)
  return out
}

const ALL = sweep()
const COMPONENTS = Object.keys(ALL[0].needs)

describe('every recommendation is reachable', () => {
  it.each(COMPONENTS)('%s fires somewhere in the space', (key) => {
    const hit = ALL.find((r) => r.needs[key])
    expect(hit, `${key} never fires — it is dead advice`).toBeTruthy()
  })
  it.each(COMPONENTS)('%s also stays quiet somewhere', (key) => {
    const miss = ALL.find((r) => !r.needs[key])
    expect(miss, `${key} always fires — it is not a recommendation, it is a constant`).toBeTruthy()
  })
})

describe('requirement-gated components cannot be reached by workload alone', () => {
  const pullOnly = ALL.filter((r) => r.label.startsWith('pull'))
  it('a connection tier never appears while nothing must be pushed', () => {
    // this is why its "not yet" card names the requirement instead of a number:
    // every workload slider in the sweep leaves it at zero
    expect(pullOnly.some((r) => r.needs.connTier)).toBe(false)
  })
  it('but flipping the requirement does reach it', () => {
    expect(ALL.some((r) => r.label.startsWith('push') && r.needs.connTier)).toBe(true)
  })
})

describe('no dead columns in the store table', () => {
  /* A store that can never be the answer is a dangling option. Two of them
     genuinely cannot win a CAPACITY argument — a document store's numbers match
     sharded SQL almost exactly, and a column store is a sidecar — so the rule is
     not "everything must win", it is "anything that cannot win must say what it
     is chosen for instead". */
  const winners = new Set<string>()
  for (const txn of ['single', 'multi'])
    for (const loss of ['keep', 'rebuild'])
      for (const access of ['point', 'range'])
       for (const keyShape of ['monotonic', 'scattered'])
        for (const [k, vals] of Object.entries({
          dau: [1e4, 1e5, 1e6, 5e7, 5e8], readPct: [0, 50, 99], fanout: [0, 1, 100],
          writeSize: [1, 50, 5000], retention: [1, 12, 60], actions: [1, 20, 200], peak: [1, 3],
        }))
          for (const val of vals)
            winners.add(model({ ...INIT, [k]: val } as Vals,
              { fresh: 'pull', txn, loss, analytics: 'no', access, recency: 'stale', keyShape } as Req).engineWin)

  it.each(STORES.map((s) => [s.id, s] as const))('%s is either winnable or explains itself', (id, store) => {
    if (winners.has(id)) return
    expect(store.chooseFor.length, `${id} never wins and gives no reason to pick it`).toBeGreaterThan(60)
  })

  it('at least the obvious three are winnable', () => {
    for (const id of ['sql', 'sqlShard', 'wide']) expect(winners.has(id), `${id} never wins`).toBe(true)
  })
})
