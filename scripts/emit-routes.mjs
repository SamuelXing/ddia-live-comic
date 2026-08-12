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
const emitted = []
for (const [path, entry] of Object.entries(ROUTES)) {
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
  if (path !== '/') out = out.replace(/(<meta property="og:type" content=")[^"]*(")/, `$1article$2`)

  /* `<route>.html`, NOT `<route>/index.html`. Both are served, but the
     directory form makes Cloudflare 307 to a trailing slash first — so every
     shared link would silently become `/read/x/`, and a scraper would take an
     extra hop to find its tags. Verified against `wrangler dev`, which is the
     same asset router production runs. */
  /* The root is `dist/index.html` itself, and it used to be skipped here under
     the comment "the root file is already correct". True when the site was one
     book and index.html's tags WERE the homepage's. The site became a shelf,
     the tags stayed, and the front door — the URL anyone actually shares — went
     on describing a different site for as long as nobody looked. The root is
     not a special case; it is the route most likely to be read. */
  const file = path === '/' ? join(DIST, 'index.html') : join(DIST, path.slice(1) + '.html')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, out)
  emitted.push({ path, file, title, desc: entry.desc })
  written++
}

// A route table that silently stops matching the site is worse than none: the
// previews would look right and describe the wrong page.
if (written < 20) throw new Error(`emit-routes: only ${written} routes written — the table looks truncated`)

/* Exact, not a floor. The bug was one route quietly skipped, and a floor cannot
   see a skip — the other 57 still clear it. */
const expected = Object.keys(ROUTES).length
if (written !== expected)
  throw new Error(`emit-routes: ${written} files for ${expected} routes — one is being skipped`)

/* The template is now only what an UNKNOWN url gets — the SPA fallback. Smaller
   surface than the front door, drifts the same way, held to the same table. */
const tpl = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const tplTitle = tpl.match(/<title>([^<]*)<\/title>/)?.[1]
const rootTitle = escape(fullTitle(ROUTES['/']))
if (tplTitle !== rootTitle)
  throw new Error(
    `emit-routes: index.html's fallback title is "${tplTitle}" but the table says "${rootTitle}" — ` +
      'an unknown URL would announce a site this is not',
  )

/* Read back what was written, rather than trusting that writing it worked. The
   bug this exists for was not a wrong value in the table — the table was right.
   It was a file that never got patched, so it kept the build template's tags
   and looked fine to every check that only ever read the table. A guard that
   inspects the input and not the artifact would have passed all year. */
const stale = []
for (const { path, file, title, desc } of emitted) {
  const got = readFileSync(file, 'utf8')
  const gotTitle = got.match(/<title>([^<]*)<\/title>/)?.[1]
  const gotDesc = got.match(/<meta name="description" content="([^"]*)"/)?.[1]
  if (gotTitle !== escape(title)) stale.push(`${path}: title is "${gotTitle}", table says "${title}"`)
  if (gotDesc !== escape(desc)) stale.push(`${path}: description does not match the table`)
}
if (stale.length) throw new Error('emit-routes: emitted files do not match the table:\n  ' + stale.join('\n  '))
console.log(`Per-route HTML: ${written} routes emitted with their own title, description and card tags.`)
console.log(`  (site title: ${SITE_TITLE})`)
