/** A slider input for a deep-dive sandbox. `steps` is a ladder (see ladder.tsx):
 *  the input can only stop on a rung, because these are estimates and a
 *  continuous slider invites precision nobody has. */
export interface InputDef {
  id: string
  label: string
  steps: number[]
  val: number
  hint: string
  fmt: (v: number) => string
}

/** Current slider values keyed by input id. */
export type Values = Record<string, number>

export interface Tile {
  k: string
  v: string
  u: string
}

export interface Meter {
  label: string
  valTxt: string
  pct: number
  detail: string
  /** When true, a LOW pct is bad (e.g. % of working set cached). */
  invert?: boolean
}

export interface Verdict {
  s: 'good' | 'warn' | 'crit'
  /** HTML string — our own authored content. */
  t: string
}

export interface ComputeResult {
  tiles: Tile[]
  meters: Meter[]
  verdict: Verdict
}

/** One sandbox: the sliders, and the pure function they feed. Every flagship
 *  chapter 5 is this shape, and it is deliberately the *only* shape — the
 *  maths lives in an exported `compute`, never inside JSX, so the future
 *  Topology Composer can import it without rendering anything. */
export interface SandboxContent {
  inputs: InputDef[]
  compute: (v: Values) => ComputeResult
}
