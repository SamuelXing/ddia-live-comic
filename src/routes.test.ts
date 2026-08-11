import { describe, it, expect } from 'vitest'
import { ROUTES } from '../scripts/routes.mjs'
import type { RouteMeta } from '../scripts/routes.mjs'
import { COMICS } from './read/comics'
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
    const comicPaths = COMICS.map((c) => `/read/${c.slug}`).sort()
    const tablePaths = Object.keys(ROUTES).filter((p) => p.startsWith('/read/')).sort()
    expect(tablePaths).toEqual(comicPaths)
  })

  it('every comic entry carries that comic’s own title', () => {
    const wrong: string[] = []
    COMICS.forEach((c) => {
      const entry = ROUTES[`/read/${c.slug}`]
      if (entry.title !== c.title) wrong.push(`${c.slug}: table says "${entry.title}", comic says "${c.title}"`)
    })
    expect(wrong).toEqual([])
  })

  it('every route the app can render has an entry', () => {
    /* Parsed from App.tsx rather than hand-listed: a route added there without
       a description would otherwise ship previewing as the homepage, which is
       the exact bug this whole mechanism exists to fix. */
    const paths = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1])
    const missing = paths.filter(
      (p) =>
        p !== '*' &&
        !p.includes(':') && // /read/:slug is covered by the comic entries above
        p !== '/calculator' && // redirects to /calculator/capacity
        p !== '/components/calculator' && // legacy redirect
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
    expect(titleForPath('/read')).toBe('Read the ideas · DDIA, as a live comic')
    expect(titleForPath('/components/kafka')).toBe('Kafka, taken apart · DDIA, as a live comic')
    // the comic titles itself — see the note in routeTitle.ts
    expect(titleForPath('/read/replication-quorum')).toBeNull()
    // unknown paths fall back rather than rendering "undefined"
    expect(titleForPath('/nope')).toContain('DDIA, as a live comic')
    expect(titleForPath('/read/')).toBe('Read the ideas · DDIA, as a live comic')
  })
})
