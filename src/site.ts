/** One place for the handful of facts about this site that live outside the
 *  code: where the source is, and where it is published. The nav, the footer,
 *  and the social-card metadata all read from here so they cannot disagree. */
export const REPO_URL = 'https://github.com/SamuelXing/ddia-live-comic'

/** The canonical origin, used for absolute og:image / og:url. Update this in
 *  one place after the first deploy assigns a hostname (or when a custom
 *  domain is attached) — social scrapers reject relative image URLs, so this
 *  has to be absolute or link previews silently render without an image. */
export const SITE_URL = 'https://ddia-live-comic.pages.dev'
