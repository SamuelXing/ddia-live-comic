# TraceSpec geometry — coordinates, zones, routing

A `TraceSpec` (see [TracePlayer.tsx](../../../../src/components/TracePlayer.tsx))
is zones + nodes + steps. The player draws zones as dashed boxes, nodes as
rounded rects with gradient fills, and animates particles along routed
polylines, one step at a time, with prose synced in the right column.

## Coordinate system

- `x`, `y`, `w`, `h` are **world units**: x spans 0–100 across the canvas
  width; y uses the **same scale** (so shapes stay square-ish).
- The visible y range is `0 … aspect × 100`. Standard `aspect: 0.5` → y 0–50.
- Standard vertical extent: zones at `y: 4, h: 42` (y 4–46), leaving y 0–4 as
  a top channel and y 46–50 as a bottom channel for long return routes.

## The standard three-zone layout

Both flagship anatomy traces use it; start here unless the content demands
otherwise:

| zone | x | w | purpose |
|---|---|---|---|
| left ("Client" / "Transactions") | 2 | 21 | actors |
| middle (the machine) | 27 | 45 | the system's internals |
| right (disk / cluster / housekeeping) | 76 | 22 | where things land |

This leaves two **vertical channels** free of nodes: x ≈ 23–27 (waypoint
x = 25) and x ≈ 72–76 (waypoint x = 74–74.5). Long hops travel these channels
and the top (y ≈ 1.5–2) / bottom (y ≈ 46–47) channels.

Node sizing that reads well at this scale: `w` 16–18, `h` 7–9, two or three
rows per zone at `y ≈ 8, 21, 34`. Keep ≥ 3 units of gap between nodes.

## Routing recipe

1. Adjacent nodes (same row or same column, nothing between): direct particle,
   no `via`.
2. Anything that would cross another node: route through a channel with `via`
   waypoints, e.g. client → middle-zone top row:
   `via: [{ x: 25, y: <source row> }, { x: 25, y: <target row> }]`.
3. Return/ack paths sweep the bottom channel; "trace it back" summary arrows
   sweep top and bottom (see the cascade traces).
4. The player computes edge ports (border point facing the first/last
   waypoint) — you route between node *edges*, not centers. Check that the
   port side is the one you expect; a waypoint too close to a corner can flip
   the port to the wrong face.

## Verification

The lint runs automatically in dev (`[trace-lint]` console warnings, from
[traceLint.ts](../../../../src/components/traceLint.ts)): route-through-node,
node overlap, off-canvas nodes, unknown ids. Rects are shrunk by 1.2 units in
the segment test, so edge-hugging channel routes pass — only body crossings
flag. A silent console is necessary but not sufficient: still eyeball a
screenshot of each step (zone labels sit at the zone's top-left; a top-channel
route can graze them without touching any node).

## Labels are plain text, and short

- Step `title`s render as plain text — HTML entities (`&apos;`) appear
  literally. Use real apostrophes; save HTML for `prose`.
- Zone labels draw at the zone's top-left with no clipping guard. For the
  right zone (x 76, w 22) keep the label ≤ ~15 characters ("Disk",
  "Data in RAM", "Rest of cluster") or it runs off the canvas edge.

## Step & prose conventions

- 6–9 steps. Each step: a strong claim as `title`, 40–90 words of `prose`
  (HTML: `<b>` mechanisms, `<code>` identifiers, `<em>` reframings).
- `focus` = the nodes the reader should look at (they glow); keep it to ≤ 4.
- Colors on particles narrate: use the *destination system's* role color
  (data moving into cache = green, WAL/replication = violet, danger = red).
- Last step earns a synthesis: total cost, the punchline, or "read it
  backwards".
