/** One place for the handful of facts about this site that live outside the
 *  code: where the source is, and where it is published. The nav, the footer,
 *  and the social-card metadata all read from here so they cannot disagree. */
export const REPO_URL = 'https://github.com/SamuelXing/ddia-live-comic'

/** The canonical origin, used for absolute og:image / og:url.
 *
 *  This is the deployed Worker's hostname. It is NOT a *.pages.dev name:
 *  Cloudflare's connect-to-Git flow creates a Worker, not a Pages project,
 *  so the site lives at <worker>.<account-subdomain>.workers.dev.
 *
 *  Attaching a custom domain later means changing this AND the four absolute
 *  URLs in index.html (og:url, og:image, twitter:image, canonical), which
 *  cannot import from here. Social scrapers reject relative image URLs and
 *  fail silently, so a stale value here costs you the link preview without
 *  any visible error. */
export const SITE_URL = 'https://ddia-live-comic.sam1796896099.workers.dev'
