/** Number/byte/currency formatting shared by all deep-dive modules. */
export const fmt = {
  int: (n: number) => Math.round(n).toLocaleString('en-US'),
  n1: (n: number) => (Math.round(n * 10) / 10).toLocaleString('en-US'),
  /** Round to `d` significant figures. Derived numbers inherit the precision of
   *  their inputs, and sandbox inputs are order-of-magnitude estimates — so
   *  "2,175.8 MB/s" claims four digits of confidence that no slider supplied.
   *  Two significant figures is what an estimate can honestly carry. */
  sig: (n: number, d = 2): string => {
    if (!isFinite(n) || n === 0) return '0'
    const mag = Math.floor(Math.log10(Math.abs(n)))
    const f = Math.pow(10, d - 1 - mag)
    const r = Math.round(n * f) / f
    return r.toLocaleString('en-US', { maximumFractionDigits: Math.max(0, d - 1 - mag) })
  },
  /** MB/s, stepping up to GB/s once the number outgrows four digits */
  mbs: (n: number): string => (n >= 1000 ? fmt.sig(n / 1000) + ' GB/s' : fmt.sig(n) + ' MB/s'),
  compact: (n: number): string => {
    if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + 'B'
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M'
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k'
    return Math.round(n).toString()
  },
  bytes: (b: number): string => {
    const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
    let i = 0
    while (b >= 1024 && i < u.length - 1) {
      b /= 1024
      i++
    }
    return (b >= 100 ? Math.round(b) : Math.round(b * 10) / 10) + ' ' + u[i]
  },
  usd: (n: number) =>
    n >= 1000 ? '$' + fmt.compact(n) : '$' + (Math.round(n * 100) / 100).toLocaleString('en-US'),
}

export const clampPct = (p: number) => Math.max(0, Math.min(100, p))

export function statusFromPct(p: number): 'good' | 'warn' | 'crit' {
  return p >= 100 ? 'crit' : p >= 75 ? 'warn' : 'good'
}
