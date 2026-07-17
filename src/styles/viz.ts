/* ============================================================
   The single source of truth for CATEGORICAL canvas colors.
   Validated with the dataviz palette checker against our dark
   surface (#0d0f14): lightness band ✓, chroma floor ✓, contrast
   ✓, CVD separation in the floor band — legal because every node
   in our diagrams carries a direct text label (secondary encoding).

   Keep these in sync with the --stateless/--queue/--cache/... role
   tokens in tokens.css (same hexes).
   ============================================================ */
export const VIZ = {
  blue: '#3987e5', // stateless · web · client
  amber: '#c98500', // queue · broker
  red: '#e5533b', // cache · hot · critical
  violet: '#9085e9', // data · db · replication
  green: '#1aa46e', // store · good
  cyan: '#0f9fc2', // edge · CDN

  // surfaces & ink for canvas drawing
  surface: '#0d0f14',
  nodeFillTop: '#20283a',
  nodeFillBottom: '#161c29',
  nodeDead: '#221520',
  strokeSoft: 'rgba(255,255,255,.13)',
  ink: '#eef1f7',
  inkDim: '#aab2c5',
  inkMuted: '#8b93a6',
  inkDead: '#6b7488',
} as const

/** A gentle top→bottom node gradient (depth without heaviness). */
export function nodeGradient(
  ctx: CanvasRenderingContext2D,
  _x: number,
  y: number,
  h: number,
  tint: string,
  intensity = 0.16,
): CanvasGradient {
  const g = ctx.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, mixHex(VIZ.nodeFillTop, tint, intensity))
  g.addColorStop(1, mixHex(VIZ.nodeFillBottom, tint, intensity * 0.6))
  return g
}

export function mixHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a)
  const pb = hexToRgb(b)
  return `rgb(${Math.round(pa[0] + (pb[0] - pa[0]) * t)},${Math.round(pa[1] + (pb[1] - pa[1]) * t)},${Math.round(pa[2] + (pb[2] - pa[2]) * t)})`
}

export function hexToRgb(h: string): [number, number, number] {
  h = h.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
