import { snapIndex } from './ladder'
import type { Inp, Opt, Vals } from './calcModel'

/* Shareable scenarios.
 *
 * The calculator's central claim is that it is a pure function of its inputs:
 * same inputs, same answer, every number a division printed beside it. That
 * claim was untestable by a reader, because there was no way to hand somebody
 * the inputs. A verdict could be reasoned about but not sent.
 *
 * Design decisions worth stating, because each rules out an easier option:
 *
 *  - Readable query params, not an encoded blob. `?dau=1e8&access=range` can
 *    be read, edited and argued with in a chat window. A base64 payload would
 *    be shorter and completely opaque, which is the wrong trade for a page
 *    whose whole pitch is that nothing is hidden.
 *  - Only values that DIFFER from the defaults are emitted. Twenty-four
 *    sliders would otherwise produce a URL nobody would paste, and the diff
 *    is also the interesting part: it says what this scenario changed.
 *  - Every incoming number is snapped to its ladder. A hand-edited
 *    `?fsync=999` must not render the thumb on 1000 while the label reads 999
 *    — the panel would contradict itself before you touched it, which is the
 *    exact bug `inputs.test.ts` exists to prevent for defaults.
 *  - Anything unrecognised is dropped rather than throwing. A truncated or
 *    mangled link should open the default scenario, not a blank page.
 */

/** A picker: some state that is one of a fixed set of option ids. */
export interface PickSpec {
  key: string
  options: Opt[]
  value: string
  set: (v: string) => void
}

/** Numbers are written in the shortest form that still round-trips, so the
 *  ladders' big values (5e8 daily users) do not spend 9 characters. */
function num(n: number): string {
  const exp = n.toExponential()
  return exp.length < String(n).length ? exp.replace('e+', 'e') : String(n)
}

/** Build the query string for a scenario — defaults omitted. */
export function encodeScenario(
  inputs: Inp[],
  v: Vals,
  picks: { key: string; value: string; def: string }[],
  /** ids the page computes for itself — see DECIDED in calcModel. Writing them
   *  into the link puts a derived value in the reader's hands as though they
   *  had chosen it, and it turns "I changed one requirement" into a URL
   *  carrying amplification constants nobody touched. */
  omit: ReadonlySet<string> = new Set(),
): string {
  const p = new URLSearchParams()
  inputs.forEach((inp) => {
    if (omit.has(inp.id)) return
    const cur = v[inp.id]
    if (cur !== undefined && cur !== inp.val) p.set(inp.id, num(cur))
  })
  picks.forEach(({ key, value, def }) => {
    if (value !== def) p.set(key, value)
  })
  return p.toString()
}

export interface Decoded {
  vals: Vals
  picks: Record<string, string>
  /** how many params were understood — lets a caller skip applying an empty link */
  applied: number
}

/** Read a scenario back. Unknown keys, unparseable numbers and illegal option
 *  ids are all ignored; everything else is snapped onto its ladder. */
export function decodeScenario(
  inputs: Inp[],
  search: string,
  picks: { key: string; options: Opt[] }[],
  omit: ReadonlySet<string> = new Set(),
): Decoded {
  const p = new URLSearchParams(search)
  const vals: Vals = {}
  const out: Record<string, string> = {}
  let applied = 0

  inputs.forEach((inp) => {
    if (omit.has(inp.id)) return
    const raw = p.get(inp.id)
    // `Number('')` is 0, not NaN — so a truncated link ending in `?dau` would
    // otherwise read as "daily users = the bottom rung" rather than as absent.
    if (raw === null || raw.trim() === '') return
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    // snap: a value between rungs would render the thumb on one number while
    // the label printed another
    vals[inp.id] = inp.steps[snapIndex(inp.steps, n)]
    applied++
  })

  picks.forEach(({ key, options }) => {
    const raw = p.get(key)
    if (raw === null) return
    if (!options.some((o) => o.id === raw)) return
    out[key] = raw
    applied++
  })

  return { vals, picks: out, applied }
}

/** Replace the query string without touching history. Dragging a slider must
 *  not push an entry per frame — the back button has to remain a way out of
 *  the page, not an undo log. */
export function writeScenario(search: string) {
  const url = search ? `${window.location.pathname}?${search}` : window.location.pathname
  window.history.replaceState(null, '', url)
}
