import { ROUTES, fullTitle, SITE_TITLE } from '../scripts/routes.mjs'

export { SITE_TITLE }

/**
 * The document title for a path.
 *
 * The table lives in `scripts/routes.mjs` because the post-build emitter needs
 * it too, and a Node script cannot import a .ts module that pulls in JSX. One
 * table, two readers — rather than the same titles written down twice.
 *
 * A comic returns `null`: it titles itself from the object it already holds.
 * Resolving it here would mean importing COMIC_BY_SLUG into the eagerly-loaded
 * App chunk, which drags all eleven comics and their diagrams along and took
 * the bundle from 171 kB to 389 kB.
 */
export function titleForPath(path: string): string | null {
  const clean = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
  if (/^\/read\/[^/]+$/.test(clean)) return null
  const entry = ROUTES[clean as keyof typeof ROUTES]
  return fullTitle(entry)
}
