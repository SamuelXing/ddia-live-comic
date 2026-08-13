/** One place for the handful of facts about this site that live outside the
 *  code: where the source is, and where it is published. The nav, the footer,
 *  and the social-card metadata all read from here so they cannot disagree. */
export const REPO_URL = 'https://github.com/SamuelXing/systems-comic'

/** The canonical origin, used for absolute og:image / og:url.
 *
 *  The custom domain — not the Worker's own hostname. The site is still
 *  served by the Worker underneath, and that URL keeps working, but every
 *  absolute URL we publish should name the domain people link to and
 *  bookmark. Publishing both splits search results and shared links across
 *  two hosts for the same content.
 *
 *  Changing this means changing the four absolute URLs in index.html
 *  (og:url, og:image, twitter:image, canonical) at the same time, because a
 *  static index cannot import from here. Scrapers reject a URL they cannot
 *  fetch and fail silently, so a stale value costs the link preview with no
 *  visible error anywhere. */
export const SITE_URL = 'https://systemscomic.com'
