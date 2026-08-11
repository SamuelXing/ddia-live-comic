/**
 * Per-route HTML, emitted after the Vite build.
 *
 * Why this exists: link previews. A scraper does not run JavaScript, so it only
 * ever sees the one `index.html` Vite emits — which means every URL on the site
 * unfurled with the homepage's title, description and card. A link to the
 * quorum comic looked identical to the front door, and #40 shipped share
 * buttons whose links all previewed the same.
 *
 * The fix that does NOT work is setting the tags from React: by the time that
 * runs, the scraper has already read and discarded the page.
 *
 * So: copy the built index.html once per known route, patch the handful of tags
 * that differ, and write it to `dist/<route>/index.html`. Cloudflare's static
 * asset server prefers a real file over the SPA fallback, so `/read/x` serves
 * `/read/x/index.html` — correct tags for the scraper, and the same SPA boots
 * for the human. Unknown paths still hit `not_found_handling`, so nothing about
 * the fallback changes.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { ROUTES, fullTitle, SITE_TITLE } from './routes.mjs'

const DIST = 'dist'
const SITE_URL = 'https://systemscomic.com'

const html = readFileSync(join(DIST, 'index.html'), 'utf8')

/** Replace the CONTENT of a meta tag, matched by its name/property. */
function meta(src, attr, key, value) {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`)
  if (!re.test(src)) throw new Error(`emit-routes: no <meta ${attr}="${key}"> in index.html`)
  return src.replace(re, `$1${escape(value)}$2`)
}
function escape(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

let written = 0
for (const [path, entry] of Object.entries(ROUTES)) {
  if (path === '/') continue // the root file is already correct
  const title = fullTitle(entry)
  const url = SITE_URL + path

  let out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${escape(title)}</title>`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
  out = meta(out, 'name', 'description', entry.desc)
  out = meta(out, 'property', 'og:title', title)
  out = meta(out, 'property', 'og:description', entry.desc)
  out = meta(out, 'property', 'og:url', url)
  out = meta(out, 'name', 'twitter:title', title)
  out = meta(out, 'name', 'twitter:description', entry.desc)

  // og:type: the homepage is a site, everything else is a document
  out = out.replace(/(<meta property="og:type" content=")[^"]*(")/, `$1article$2`)

  /* `<route>.html`, NOT `<route>/index.html`. Both are served, but the
     directory form makes Cloudflare 307 to a trailing slash first — so every
     shared link would silently become `/read/x/`, and a scraper would take an
     extra hop to find its tags. Verified against `wrangler dev`, which is the
     same asset router production runs. */
  const file = join(DIST, path.slice(1) + '.html')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, out)
  written++
}

// A route table that silently stops matching the site is worse than none: the
// previews would look right and describe the wrong page.
if (written < 20) throw new Error(`emit-routes: only ${written} routes written — the table looks truncated`)
console.log(`Per-route HTML: ${written} routes emitted with their own title, description and card tags.`)
console.log(`  (site title: ${SITE_TITLE})`)
