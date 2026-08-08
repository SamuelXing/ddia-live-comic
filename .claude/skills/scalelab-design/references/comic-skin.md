# The graphic-novel skin (Layer 1 reading + whole-app house style)

The project is **"DDIA, as a live comic"** — an unofficial, illustrated companion to
*Designing Data-Intensive Applications*. Its house style is a technical **graphic
novel**: warm paper, solid ink borders, hard offset shadows, editorial + comic
lettering. Two things wear it:

- **Layer 1 — the idea comics** (`/read`, `/read/:slug`): the core product. A DDIA idea
  told as a comic-panel reading page.
- **The rest of the app** (home, deep-dives, sims): converted to the same skin so the
  whole thing reads as one book.

## The mental model — Idea → Component → Architecture

1. **Ideas** (Layer 1, new): one concept, drawn as a comic. `src/read/`.
2. **Components** (Layer 2): a machine = a bundle of ideas. The deep-dives.
3. **Architectures** (Layer 3): a system = ideas at scale. The sims.

Cross-links tie them: a comic's `seenIn` points **down** to components; a deep-dive's
`<IdeaStrip>` points **up** to the comics it embodies; the Feed sim links to "ideas in play."

## The skin

Defined in [src/styles/comic.css](../../../src/styles/comic.css), scoped under **`.gn`** so
it can never leak into the dark app tokens.

- **Palette (paper):** `--paper #f7f4ef`, `--paper-2 #fffdf8`, ink `#16130f`, ink-line
  `#1a1a1a`, rule `#ded7ca`.
- **Two accents, and they carry meaning — do not use them decoratively:**
  - **denim `#3f6191`** = *built / live / the fix*.
  - **terra `#bd5f3d`** = *the gap / the pain / start-here*.
  Everything else is ink on paper. (On the idea index: terra marks the "first build"
  and the unbuilt concept lens; denim marks live comics.)
- **Fonts (self-hosted via `@fontsource`, no runtime network):** Playfair Display
  (display/headings), Comic Neue (narration boxes, speech bubbles, step badges),
  Newsreader (body reading), JetBrains Mono (labels, code, meta).
- **Craft:** 2px solid ink borders, **hard offset shadows** (`3px 3px 0 #1a1a1a`, no blur),
  squared corners, a subtle halftone (`radial-gradient` dots) **only** on mastheads and
  stat callouts — never behind reading text. Snappy hover: `translate(-4px,-4px)` + bigger
  hard shadow, ~.12s. Reveal panels with an `IntersectionObserver` that adds `.in`
  (respect `prefers-reduced-motion`).

## Converting a dark page to comic — the token flip

The deep-dive and sim pages are fully **token-driven**, so we re-skin them without touching
JSX via [src/styles/comic-theme.css](../../../src/styles/comic-theme.css) (imported once in
`main.tsx`, scoped to `.dd-page` / `.sim-page`):

- Redefine the design tokens (`--bg`, `--card`, `--ink`, `--accent`, `--radius`, `--shadow`,
  fonts…) to the comic palette. **Set `color: var(--ink)` on the page container** — headings
  inherit color from `<body>` (computed white) and won't otherwise flip.
- Override rules use `.dd-page[class]` / `.sim-page[class]` to win on specificity regardless
  of bundle order.
- **Canvas stays dark.** Every live visualization (TracePlayer, the sim `#viz`, thumbnails)
  keeps its dark surface and is framed as an inked **"figure panel"** — a night-scene panel
  among the light ones. This preserves the dataviz-validated `VIZ` palette (see
  [palette.md](palette.md)); never re-theme the canvas to paper.

Rule of thumb: **paper when you read, dark when you drive.** The chrome is paper; the
instruments are dark figures.

## Authoring an idea comic

Comics are data, not bespoke JSX. Add one file to `src/read/comics/` exporting a `Comic`
([src/read/types.ts](../../../src/read/types.ts)) and register it in `comics/index.ts`.

```ts
export const myIdea: Comic = {
  slug, chapter: 'Chapter N · Topic', chapterNo: 'Ch N',
  title, dek, minutes,
  caption,                 // the narration box; **bold**, *italic*, `mono` via rich()
  steps: [{ n:'Step 01', title, accent:'terra'|'denim', body:['…'], code?, callout?, diagram? }],
  bubbles: [{ term, body }],   // speech bubbles (side definitions)
  seenIn: [{ label, to?, live? }],  // down-links to components/sims
  finale: { title, body },
  next?: { slug, title },
}
```

- **Story arc, not a list.** Naïve approach → where it breaks (terra) → the fix (denim).
  Match the two-accent meaning to the beats.
- **Copy uses `rich()`** — `**bold**` load-bearing claims, `*italic*` reframes, `` `mono` ``
  for code/identifiers. No HTML in the strings.
- **Diagrams** are small inline SVGs in `src/read/diagrams.tsx` using the paper palette
  (denim/terra/ink). A step with a `diagram` spans full width automatically.
- **Always `seenIn`.** A comic that doesn't land in a real machine is incomplete — that
  down-link is the whole point of the layered model.

## Depth without density — make readers *think*, not memorize

A comic must clear **two bars at once**: the concept is easy to understand, *and* the reader
is pushed to reason about the messy real-engineering problem (variance, failure modes, the
call an engineer actually makes) — not just remember the idea. The governing rule:

> **Depth of thinking ≠ density of prose.** Provoke hard thinking with plain, story-first
> language. Name the jargon *last*, once the reader already feels the problem.

Three optional fields on `Comic` / `Step` carry the depth. All are authored in the same plain
voice as the body, and the two heavy ones are **collapsible so the default read stays the easy
story** (progressive disclosure — skimmers see one inviting teaser line, the curious click):

- **`Step.think?: { q, a }`** — a Socratic prompt on a key step. Pose a *genuine* question the
  reader can chew on, hide the answer (`Reveal ▸`). Renders with the **gold** "Think it through"
  accent (a third accent, used *only* here — distinct from denim/terra). Put it on the step
  where the idea is most temptingly over-trusted.
- **`Comic.inTheWild?: { note, points }`** — collapsed by default. 4 production complications,
  each a *story first* ("Delete a key while one replica is offline; it comes back holding the
  old value and hands it right back — the thing you deleted reappears"), the term named gently
  at the end in parens (`a tombstone`). One idea per bullet. `note` is the teaser line.
- **`Comic.tradeoffs?: { title, rows[] }`** — collapsed by default. A real decision framework:
  each row is `{ choose, when }` where `choose` is a **plain-language verb phrase** ("Keep both,
  merge later"), and the jargon lives quietly in the `when` clause ("…the bookkeeping is called
  *version vectors*"). Turns "I know the idea" into "I can make the call."

**The readability test (apply to every depth edit):** read the expanded content cold. If a
sentence stacks two-plus unexplained terms, or a `choose` label *is* the jargon, rewrite it —
concrete scenario first, term last. The reference implementation is
[replication-quorum.tsx](../../../src/read/comics/replication-quorum.tsx); match its register.
Renderer + styles: `think`/`wild`/`tradeoffs` in [Comic.tsx](../../../src/read/Comic.tsx) and
`.gn-think` / `.gn-wild` / `.gn-tradeoffs` in [comic.css](../../../src/styles/comic.css).

## Verifying

Same bar as the rest of the system: `npm run build` clean, then headless-Chrome screenshots
of the comic **and** the converted pages in the real app (dev server) — check heading colors
actually flipped (the `<body>` inheritance trap), canvas figures stayed dark, and nothing
overlaps. Both `.gn` and `comic-theme` respect `prefers-reduced-motion`.
