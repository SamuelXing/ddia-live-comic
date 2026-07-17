/** A slider input for a deep-dive sandbox. */
export interface InputDef {
  id: string
  label: string
  min: number
  max: number
  step: number
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

/** [limit name, rough value, why it matters] */
export type LimitRow = [string, string, string]
/** [failure name, description] */
export type FailRow = [string, string]

/** The body of one explorable component (or one variant of a dual module). */
export interface ModuleContent {
  /** Present on variants (e.g. "Kafka" / "RabbitMQ"). */
  name?: string
  /** HTML intro paragraphs. */
  intro: string
  inputs: InputDef[]
  compute: (v: Values) => ComputeResult
  limits: LimitRow[]
  fails: FailRow[]
  /** HTML strings, ordered cheapest-first. */
  ladder: string[]
}

/** A deep-dive module: header + either a single body or toggled variants. */
export interface ModuleDef {
  key: string
  tab: string
  emoji: string
  title: string
  kicker: string
  /** HTML lede paragraph. */
  lede: string
  content?: ModuleContent
  variants?: Record<string, ModuleContent & { name: string }>
}
