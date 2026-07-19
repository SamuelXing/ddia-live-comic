import type { TraceNode, TraceSpec } from './TracePlayer'

/* ============================================================
   Dev-only lint for TraceSpecs — the "nothing overlaps a label"
   invariant, executable. Runs when a TracePlayer mounts in dev
   and console.warns any violation:
     - a particle route segment cutting through a node it isn't
       connected to (route it around via waypoints instead)
     - overlapping nodes, or nodes outside the canvas
     - focus / particle ids that don't exist
   Rects are shrunk by MARGIN world units before the segment test,
   so routes hugging a node's edge (deliberate channel routing)
   pass; only paths through a node's body are flagged.
   ============================================================ */

const MARGIN = 1.2

type Pt = [number, number]

function center(n: TraceNode): Pt {
  return [n.x + n.w / 2, n.y + n.h / 2]
}

/** Same edge-port rule TracePlayer draws with, in world coords. */
function edgePt(n: TraceNode, tx: number, ty: number): Pt {
  const [cx, cy] = center(n)
  const dx = tx - cx
  const dy = ty - cy
  if (dx === 0 && dy === 0) return [cx, cy]
  const t = Math.min(dx !== 0 ? n.w / 2 / Math.abs(dx) : Infinity, dy !== 0 ? n.h / 2 / Math.abs(dy) : Infinity)
  return [cx + dx * t, cy + dy * t]
}

/** Does segment a→b pass through the rect (shrunk by MARGIN)? */
function segmentHitsRect(a: Pt, b: Pt, n: TraceNode): boolean {
  const x0 = n.x + MARGIN
  const y0 = n.y + MARGIN
  const x1 = n.x + n.w - MARGIN
  const y1 = n.y + n.h - MARGIN
  if (x1 <= x0 || y1 <= y0) return false
  // Liang-Barsky clip: does any part of the segment lie inside?
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  let t0 = 0
  let t1 = 1
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0
    const r = q / p
    if (p < 0) {
      if (r > t1) return false
      if (r > t0) t0 = r
    } else {
      if (r < t0) return false
      if (r < t1) t1 = r
    }
    return true
  }
  return (
    clip(-dx, a[0] - x0) &&
    clip(dx, x1 - a[0]) &&
    clip(-dy, a[1] - y0) &&
    clip(dy, y1 - a[1]) &&
    t1 > t0
  )
}

function rectsOverlap(a: TraceNode, b: TraceNode): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

export function lintTraceSpec(spec: TraceSpec): string[] {
  const warnings: string[] = []
  const byId: Record<string, TraceNode> = {}
  spec.nodes.forEach((n) => {
    if (byId[n.id]) warnings.push(`duplicate node id "${n.id}"`)
    byId[n.id] = n
  })

  const maxY = (spec.aspect ?? 0.52) * 100
  spec.nodes.forEach((n) => {
    if (n.x < 0 || n.y < 0 || n.x + n.w > 100 || n.y + n.h > maxY)
      warnings.push(`node "${n.id}" leaves the canvas (x 0–100, y 0–${maxY})`)
  })
  for (let i = 0; i < spec.nodes.length; i++)
    for (let j = i + 1; j < spec.nodes.length; j++)
      if (rectsOverlap(spec.nodes[i], spec.nodes[j]))
        warnings.push(`nodes "${spec.nodes[i].id}" and "${spec.nodes[j].id}" overlap`)

  spec.steps.forEach((step, si) => {
    const at = `step ${si + 1} ("${step.title}")`
    step.focus.forEach((id) => {
      if (!byId[id]) warnings.push(`${at}: unknown focus id "${id}"`)
    })
    ;(step.particles ?? []).forEach((p) => {
      const a = byId[p.from]
      const b = byId[p.to]
      if (!a || !b) {
        warnings.push(`${at}: unknown particle endpoint "${!a ? p.from : p.to}"`)
        return
      }
      // rebuild the drawn route: edge port → via… → edge port
      const via: Pt[] = (p.via ?? []).map((v) => [v.x, v.y])
      const firstT = via.length ? via[0] : center(b)
      const lastT = via.length ? via[via.length - 1] : center(a)
      const route: Pt[] = [edgePt(a, firstT[0], firstT[1]), ...via, edgePt(b, lastT[0], lastT[1])]
      for (let s = 0; s < route.length - 1; s++) {
        for (const n of spec.nodes) {
          if (n.id === p.from || n.id === p.to) continue
          if (segmentHitsRect(route[s], route[s + 1], n))
            warnings.push(
              `${at}: route ${p.from}→${p.to} cuts through node "${n.id}" (segment ${s + 1}) — add a via waypoint to route around it`,
            )
        }
      }
    })
  })
  return warnings
}

/** Console-warn all violations for a spec. Call from dev builds only. */
export function lintAndReport(spec: TraceSpec): void {
  const problems = lintTraceSpec(spec)
  if (problems.length)
    console.warn(`[trace-lint] "${spec.title}":\n  - ` + problems.join('\n  - '))
}
