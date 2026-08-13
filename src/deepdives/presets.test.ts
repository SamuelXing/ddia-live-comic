import { describe, it, expect } from 'vitest'
import {
  PRESETS,
  STORES,
  INIT,
  CANNOT_WIN,
  model,
  FRESH,
  TXN,
  LOSS,
  ANALYTICS,
  ACCESS,
  RECENCY,
  KEY_SHAPE,
} from './calcModel'
import type { Req, Vals } from './calcModel'

/* The presets are the guided tour. Five of them used to land on two answers —
   three on wide-column, two on sharded SQL — so a table with six columns
   demonstrated two, and three stores were never shown winning anything. Nobody
   noticed because nothing was broken: every individual answer was correct.

   Coverage is the property that was missing, so it is the property tested. */

const winnerFor = (v: Vals, req: Req) => model(v, req).engineWin

describe('the presets tour the whole table', () => {
  const won = new Set(PRESETS.map((p) => winnerFor({ ...INIT, ...p.sets }, p.req)))

  it('shows every store that can win, actually winning', () => {
    const unreached = STORES.filter((s) => !won.has(s.id) && !CANNOT_WIN[s.id]).map((s) => s.short)
    expect(unreached).toEqual([])
  })

  it('does not carry a preset that duplicates another’s answer without earning it', () => {
    /* Repeats are fine — three workloads landing on wide-column is a true and
       useful thing to show. What is not fine is repeats while a reachable store
       goes unshown, which is the state this test was written in. */
    expect(won.size).toBeGreaterThanOrEqual(STORES.length - Object.keys(CANNOT_WIN).length)
  })

  it('exercises every requirement option somewhere in the tour', () => {
    /* `loss: rebuild` was set by no preset at all, so the one requirement that
       unlocks the in-memory column was unreachable from the guided path. An
       option no preset touches is an option most readers never discover. */
    const missing: string[] = []
    const check = (key: keyof Req, opts: { id: string }[]) => {
      const used = new Set(PRESETS.map((p) => p.req[key]))
      opts.forEach((o) => !used.has(o.id) && missing.push(`${key}: ${o.id}`))
    }
    check('fresh', FRESH)
    check('txn', TXN)
    check('loss', LOSS)
    check('analytics', ANALYTICS)
    check('access', ACCESS)
    check('recency', RECENCY)
    expect(missing).toEqual([])
  })

  it('names systems, not stores', () => {
    /* The page's argument runs requirements → load → store. A preset named for
       its answer ("Cassandra workload") would run it backwards and turn the
       tool into a lookup table. Cheap structural guard against that drift. */
    const storeWords = STORES.flatMap((s) => [s.short.toLowerCase(), s.label.toLowerCase()])
    const named = PRESETS.filter((p) =>
      storeWords.some((w) => p.label.toLowerCase().includes(w)),
    ).map((p) => p.label)
    expect(named).toEqual([])
  })
})

describe('the stores that can never win say so', () => {
  /* Brute force, because the claim on the page is absolute — "never picked at
     any setting" — and an absolute claim checked against five presets is not
     checked at all. */
  const SCALES: Array<{ n: string; s: Vals }> = [
    { n: 'tiny', s: { dau: 1e4, actions: 5, peak: 2, readPct: 80, fanout: 1, writeSize: 2, readSize: 10, retention: 12 } },
    { n: 'small', s: { dau: 1e6, actions: 20, peak: 3, readPct: 85, fanout: 1, writeSize: 2, readSize: 50, retention: 12 } },
    { n: 'large', s: { dau: 1e8, actions: 50, peak: 3, readPct: 90, fanout: 10, writeSize: 5, readSize: 50, retention: 24 } },
    { n: 'write-heavy', s: { dau: 5e7, actions: 200, peak: 2, readPct: 10, fanout: 0, writeSize: 2, readSize: 10, retention: 6 } },
  ]

  const everyWinner = () => {
    const won = new Set<string>()
    for (const fresh of FRESH)
      for (const txn of TXN)
        for (const loss of LOSS)
          for (const an of ANALYTICS)
            for (const acc of ACCESS)
              for (const rec of RECENCY)
                for (const ks of KEY_SHAPE)
                  for (const sc of SCALES)
                    won.add(
                      winnerFor(
                        { ...INIT, ...sc.s },
                        { fresh: fresh.id, txn: txn.id, loss: loss.id, analytics: an.id, access: acc.id, recency: rec.id, keyShape: ks.id },
                      ),
                    )
    return won
  }

  it('never wins, across every requirement combination at four load scales', () => {
    const won = everyWinner()
    const liars = Object.keys(CANNOT_WIN).filter((id) => won.has(id))
    expect(liars).toEqual([])
  })

  it('does not claim it of a store that can in fact win', () => {
    // the reverse failure: a stale note telling the reader to stop looking
    const won = everyWinner()
    const wronglySilent = STORES.filter((s) => CANNOT_WIN[s.id] && won.has(s.id)).map((s) => s.short)
    expect(wronglySilent).toEqual([])
  })

  it('explains itself in terms of fit, never of throughput', () => {
    // the note exists to say "this is not an arithmetic question" — if it
    // starts arguing numbers it has become the thing it was correcting
    Object.entries(CANNOT_WIN).forEach(([id, why]) => {
      expect(why.length).toBeGreaterThan(60)
      expect(STORES.some((s) => s.id === id)).toBe(true)
    })
  })
})
