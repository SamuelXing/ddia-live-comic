/* ============================================================
   Order-of-magnitude inputs, shared by every sandbox on the site.

   A continuous slider invites a number nobody has: "557k/s" reads as a
   measurement when it is really a guess, and it multiplies out into
   "2,175.8 MB/s", which is worse — six significant figures of confidence
   built on a shrug. At this level of modelling the *scale* is the answer,
   so inputs snap to a 1-2-5 ladder and derived numbers are rounded to
   two significant figures.

   Not everything becomes a ladder. A count that is genuinely small and
   genuinely exact — 3 brokers, replication factor 2 — has no false
   precision to remove, so those keep every integer. The rule is: ladder
   the quantities you are estimating, not the ones you are choosing.
   ============================================================ */

/** 1-2-5 ladders, named by what they measure. */
export const LAD = {
  /** events, messages, requests per second */
  rate: [1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6, 2e6, 5e6],
  /** smaller per-unit rates — one worker, one connection */
  rateSm: [100, 200, 500, 1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5],
  /** payload sizes in KB */
  kb: [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000],
  /** payload sizes in bytes */
  bytes: [32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536],
  /** capacities in GB */
  gb: [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000],
  /** how many of a thing, when the count is an estimate rather than a choice */
  many: [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000],
  /** backlog / queue depth */
  deep: [0, 1e3, 1e4, 1e5, 5e5, 1e6, 5e6, 1e7],
  /** MB/s of traffic */
  mbs: [10, 20, 50, 100, 200, 500, 1000, 2000, 5000],
  /** hours of retention */
  hours: [1, 2, 6, 12, 24, 48, 72, 168, 336],
  /** shares — 10% granularity is as fine as an estimate deserves */
  pct: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  /** populations — keys, rows, objects */
  count: [1e6, 2e6, 5e6, 1e7, 2e7, 5e7, 1e8, 2e8, 5e8, 1e9, 2e9],
  /** open connections / pool size */
  conns: [100, 200, 500, 1e3, 2e3, 5e3, 1e4, 2e4],
  /** service time per unit of work */
  ms: [1, 2, 5, 10, 20, 50, 100, 200, 500],
  /** small exact counts keep every value: these are choices, not estimates */
  few: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  nodes: [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 30],
  /** RAM ships in powers of two — you pick a machine, you don't estimate it */
  ram: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512],
}

/** nearest rung to an arbitrary value — so a stored default never falls off the ladder */
export function snapIndex(steps: number[], value: number): number {
  let best = 0
  for (let i = 1; i < steps.length; i++) {
    if (Math.abs(steps[i] - value) < Math.abs(steps[best] - value)) best = i
  }
  return best
}

/** A slider that can only stop on a rung. */
export function LadderSlider({
  steps,
  value,
  onChange,
  ariaLabel,
}: {
  steps: number[]
  value: number
  onChange: (n: number) => void
  ariaLabel?: string
}) {
  const i = snapIndex(steps, value)
  return (
    <input
      type="range"
      min={0}
      max={steps.length - 1}
      step={1}
      value={i}
      aria-label={ariaLabel}
      aria-valuetext={String(steps[i])}
      onChange={(e) => onChange(steps[parseInt(e.target.value)])}
    />
  )
}
