import { describe, it, expect } from 'vitest'
import { ROUTES, cardFor, cards } from '../scripts/routes.mjs'
import type { RouteMeta } from '../scripts/routes.mjs'
import { COMICS } from './read/comics'
import { CHAPTERS } from './papers/chapters'
import { SEASONS, seasonPath } from './papers/book'
import { titleForPath } from './routeTitle'
// Vite's ?raw, not node:fs — the app tsconfig has no node types, and pulling
// them in for one test would widen the app project's ambient types.
import appSource from './App.tsx?raw'

/* `scripts/routes.mjs` duplicates every comic's title, because the post-build
   emitter is a plain Node script and cannot import a .ts module that pulls in
   JSX. Duplication is only acceptable while something proves it has not
   drifted — a link preview that confidently describes the wrong page is worse
   than a generic one, because nobody would think to check it. */

describe('the route table still matches the site', () => {
  it('every comic has an entry, and none is invented', () => {
    const comicPaths = COMICS.map((c) => `/ddia/read/${c.slug}`).sort()
    const tablePaths = Object.keys(ROUTES).filter((p) => p.startsWith('/ddia/read/')).sort()
    expect(tablePaths).toEqual(comicPaths)
  })

  it('every comic entry carries that comic’s own title', () => {
    const wrong: string[] = []
    COMICS.forEach((c) => {
      const entry = ROUTES[`/ddia/read/${c.slug}`]
      if (entry.title !== c.title) wrong.push(`${c.slug}: table says "${entry.title}", comic says "${c.title}"`)
    })
    expect(wrong).toEqual([])
  })

  it('every papers chapter has an entry with its own title, and none is invented', () => {
    /* Same drift guard as the comics: the .mjs table duplicates chapter titles
       because the emitter cannot import JSX modules. */
    /* Paths under /papers/ that are not chapters, listed by hand on purpose:
       the point of this assertion is that a path nobody meant to add fails it,
       so exceptions have to be typed out rather than pattern-matched away. */
    const notChapters = ['/papers/season/2']
    const expected = [...CHAPTERS.map((c) => `/papers/${c.slug}`), ...notChapters].sort()
    const tablePaths = Object.keys(ROUTES)
      .filter((p) => p.startsWith('/papers/'))
      .sort()
    expect(tablePaths).toEqual(expected)
    const wrong: string[] = []
    CHAPTERS.forEach((c) => {
      const entry = ROUTES[`/papers/${c.slug}`]
      if (entry.title !== c.title) wrong.push(`${c.slug}: table says "${entry.title}", chapter says "${c.title}"`)
    })
    expect(wrong).toEqual([])
  })

  it('every /ddia page keeps its legacy (pre-bookshelf) alias', () => {
    const missing = Object.keys(ROUTES)
      .filter((p) => p.startsWith('/ddia/'))
      .filter((p) => !(p.replace('/ddia', '') in ROUTES))
    expect(missing).toEqual([])
  })

  it('gives every season a page — in the route table and in the router', () => {
    /* Adding a season is three edits in three files: SEASONS, the route table,
       and App.tsx. Miss the second and the season previews as the homepage;
       miss the third and every link to it renders the chapter 404, because
       /papers/season/3 falls through to the :slug catch-all. Neither failure
       shows up until somebody clicks the hand-off at the foot of season 2. */
    const paths = SEASONS.map((s) => seasonPath(s.n))
    expect(paths.length).toBeGreaterThan(1)
    expect(paths.filter((p) => !(p in ROUTES))).toEqual([])
    const routed = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1])
    expect(paths.filter((p) => !routed.includes(p))).toEqual([])
  })

  it('every route the app can render has an entry', () => {
    /* Parsed from App.tsx rather than hand-listed: a route added there without
       a description would otherwise ship previewing as the homepage, which is
       the exact bug this whole mechanism exists to fix. */
    /* A route whose element is <Navigate> renders nothing and needs no
       description — it hands the reader to a path that has one. That used to
       be a hand-listed exception for /calculator, which is the kind of list
       that grows quietly: three season redirects arrived at once. Read the
       element instead of naming the paths. */
    const routes = [...appSource.matchAll(/<Route\s+path="([^"]+)"\s+element=\{<(\w+)/g)]
    expect(routes.length, 'the Route regex stopped matching App.tsx').toBeGreaterThan(20)
    const missing = routes
      .filter(([, , el]) => el !== 'Navigate')
      .map(([, p]) => p)
      .filter(
        (p) =>
          p !== '*' &&
          !p.includes(':') && // /read/:slug is covered by the comic entries above
          !(p in ROUTES),
      )
    expect(missing).toEqual([])
  })
})

describe('every description is fit for a link preview', () => {
  it('is present, and short enough not to be truncated mid-thought', () => {
    const bad: string[] = []
    Object.entries(ROUTES).forEach(([path, e]: [string, RouteMeta]) => {
      if (!e.desc || e.desc.length < 40) bad.push(`${path}: too short (${e.desc?.length ?? 0})`)
      // most scrapers cut somewhere near 200; past that the last clause is lost
      if (e.desc.length > 200) bad.push(`${path}: ${e.desc.length} chars, will be truncated`)
    })
    expect(bad).toEqual([])
  })

  it('does not reuse the site description on a specific page', () => {
    // a preview that says the same thing everywhere is the bug, not the fix
    const generic = ROUTES['/'].desc
    const lazy = Object.entries(ROUTES).filter(([p, e]: [string, RouteMeta]) => p !== '/' && e.desc === generic)
    expect(lazy.map(([p]) => p)).toEqual([])
  })
})

describe('titleForPath agrees with the table', () => {
  it('names static routes and defers on comics', () => {
    expect(titleForPath('/ddia/read')).toBe('Read the ideas · systems comic')
    expect(titleForPath('/ddia/components/kafka')).toBe('Kafka, taken apart · systems comic')
    // the comic titles itself — see the note in routeTitle.ts
    expect(titleForPath('/ddia/read/replication-quorum')).toBeNull()
    // legacy deep links self-title after the client redirect, same as new ones
    expect(titleForPath('/read/replication-quorum')).toBeNull()
    // unknown paths fall back rather than rendering "undefined"
    expect(titleForPath('/nope')).toContain('systems comic')
    expect(titleForPath('/read/')).toBe('Read the ideas · systems comic')
  })
})

/* Social cards. The words varied per route long before the picture did — all 58
   sat on the DDIA book's card, so a link to the papers book unfurled as a
   different book. The images themselves are rendered by `npm run og` and
   committed (the deploy build has no browser), and the emitter fails the build
   when a route has no file. What is checked here is the mapping: that every
   route resolves to a card, that a legacy alias shares its canonical's rather
   than getting a stale duplicate, and that the names stay filesystem-safe. */
describe('every route has a social card', () => {
  it('resolves one for every path in the table', () => {
    const missing = Object.keys(ROUTES).filter((p) => !cardFor(p))
    expect(missing).toEqual([])
  })

  it('gives a legacy alias the same card as its canonical', () => {
    const twins = Object.keys(ROUTES)
      .filter((p) => p.startsWith('/ddia/'))
      .map((p) => [p, p.replace(/^\/ddia/, '')] as const)
      .filter(([, legacy]) => legacy in ROUTES)
    expect(twins.length).toBeGreaterThan(10)
    const split = twins.filter(([canon, legacy]) => cardFor(canon) !== cardFor(legacy))
    expect(split).toEqual([])
  })

  it('names every card safely and uniquely', () => {
    /* Read one name per distinct ENTRY, not off cards() — which de-duplicates
       by name, so two different pages colliding on one filename came back as a
       single row and the uniqueness assertion below could not fail. It could
       not fail for four months, and then `/papers/season-2` (the close) and
       `/papers/season/2` (the contents) both slugified to `papers-season-2`:
       one PNG, and whichever page the renderer wrote last decided what both of
       them unfurled as in a link preview. Nothing else notices — the emitter
       only checks that a file of that name exists, and it did. */
    const byEntry = new Map<object, string>()
    for (const [path, entry] of Object.entries(ROUTES))
      if (!byEntry.has(entry)) byEntry.set(entry, cardFor(path)!)
    const names = [...byEntry.values()]

    expect(names.filter((n) => !/^[a-z0-9-]+$/.test(n))).toEqual([])
    const collisions = names.filter((n, i) => names.indexOf(n) !== i)
    expect(collisions).toEqual([])
  })

  it('renders one card per distinct page, not per URL', () => {
    // 58 routes, roughly half of them legacy twins — if this ever equals the
    // route count, the aliases have stopped sharing and half the cards are dupes
    expect(cards().length).toBeLessThan(Object.keys(ROUTES).length)
    expect(cards().length).toBeGreaterThan(20)
  })
})

/* Every "seen in" rail is a set of internal links typed by hand, and a typo in
   one is invisible: the rail renders, the link looks right, and it 404s only
   when somebody clicks it. Four invented paths shipped into a draft of Act V
   at once — /ddia/deepdive/kafka rather than /ddia/components/kafka, and a
   caching comic that has never existed — which is the same failure the link
   checker catches for external URLs, on the half of the links that checker
   cannot see. */
describe('every internal link points at a page that exists', () => {
  const links = [
    ...COMICS.flatMap((c) => c.seenIn.map((s) => ({ where: `comic:${c.slug}`, to: s.to }))),
    ...CHAPTERS.flatMap((c) => c.seenIn.map((s) => ({ where: `paper:${c.slug}`, to: s.to }))),
  ].filter((l): l is { where: string; to: string } => typeof l.to === 'string' && l.to.startsWith('/'))

  it('finds the links to check', () => {
    expect(links.length).toBeGreaterThan(30)
  })

  it('resolves every one against the route table', () => {
    const bad = links.filter((l) => !(l.to.replace(/#.*$/, '') in ROUTES)).map((l) => `${l.where} → ${l.to}`)
    expect(bad).toEqual([])
  })
})
