/** The one title used when nothing more specific applies, and the suffix every
 *  other title carries so a browser tab still says what site it belongs to. */
export const SITE_TITLE = 'DDIA, as a live comic'
const FULL = `${SITE_TITLE} — an illustrated companion to Designing Data-Intensive Applications`

/* Static routes. Comics are resolved from their slug instead, so adding a
   comic never means remembering to add it here too. */
const STATIC: Record<string, string> = {
  '/': FULL,
  '/read': 'Read the ideas',
  '/components': 'Component deep-dives',
  '/components/kafka': 'Kafka, taken apart',
  '/components/postgres': 'Postgres, taken apart',
  '/components/redis': 'Redis, taken apart',
  '/components/rabbitmq': 'RabbitMQ, taken apart',
  '/components/web': 'The web tier, taken apart',
  '/components/s3': 'S3 and object storage, taken apart',
  '/calculator/capacity': 'Capacity calculator',
  '/calculator/latency': 'The latency budget',
  '/sims/feed': 'Feed at Scale — simulation',
  '/sims/observability': 'Observability at Scale — simulation',
}

/**
 * The document title for a path.
 *
 * This exists because of sharing. `document.title` was set once in index.html
 * and never changed, so every route reported the homepage's title — which meant
 * a tweet about the quorum comic was labelled "an illustrated companion to
 * Designing Data-Intensive Applications", and every browser tab and history
 * entry said the same thing. A share button that mislabels the page is not a
 * working share button.
 *
 * Note what this does NOT fix: link previews. Scrapers do not run JavaScript,
 * so the og: tags in index.html are still the homepage's for every URL. That
 * needs a per-route HTML file emitted at build time, which is its own job.
 */
export function titleForPath(path: string): string | null {
  const clean = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
  if (STATIC[clean]) return STATIC[clean] === FULL ? FULL : `${STATIC[clean]} · ${SITE_TITLE}`

  /* A comic titles itself, from the object it already holds.
     Looking the title up here instead meant importing COMIC_BY_SLUG, which
     drags all eleven comics and their diagrams into the eagerly-loaded App
     chunk: the bundle went 171 kB -> 389 kB and route-level code splitting
     stopped meaning anything. `null` says "somebody else owns this one". */
  if (/^\/read\/[^/]+$/.test(clean)) return null

  return FULL
}
