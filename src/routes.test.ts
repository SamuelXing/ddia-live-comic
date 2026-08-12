import { describe, it, expect } from 'vitest'
import { ROUTES } from '../scripts/routes.mjs'
import type { RouteMeta } from '../scripts/routes.mjs'
import { COMICS } from './read/comics'
import { CHAPTERS } from './papers/chapters'
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
    const chapterPaths = CHAPTERS.map((c) => `/papers/${c.slug}`).sort()
    const tablePaths = Object.keys(ROUTES)
      .filter((p) => p.startsWith('/papers/'))
      .sort()
    expect(tablePaths).toEqual(chapterPaths)
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
