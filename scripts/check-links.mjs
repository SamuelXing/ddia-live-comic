/**
 * Fetch every URL the site cites and report the ones that are not there.
 *
 * Deliberately NOT a unit test. citations.test.ts explains why, and it is
 * right: a network call in the unit suite is a flake generator, and several
 * legitimate publishers (ACM in particular) refuse any non-browser client.
 * So this is the check:diagrams shape instead — a separate script you run
 * when you add sources, not on every save.
 *
 * It exists because a fabricated URL is indistinguishable from a real one by
 * inspection. A citeseerx link with a plausible-looking document hash sat in
 * a chapter draft next to four correct links and looked exactly as credible;
 * fetching it returned 404. For a book whose whole premise is that the paper
 * is checkable, that is the failure that matters most.
 *
 * Exit codes: 1 if anything is genuinely missing (404/410/DNS/timeout).
 * A 403 is reported but tolerated — publishers block robots, and the link is
 * still correct for a human with a browser.
 */
import { readFileSync, readdirSync } from 'node:fs'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36'
const TIMEOUT_MS = 20000

/* Read the URLs out of the sources with a regex rather than importing the
   modules: the chapters and comics are TSX and would need a compile step, the
   same reason routes.mjs is plain .mjs. A link is a link wherever it sits, so
   over-collecting slightly is the right error to make. */
function sourceFiles() {
  const out = []
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`
      if (e.isDirectory()) walk(p)
      else if (/\.tsx?$/.test(p) && !/\.test\./.test(p)) out.push(p)
    }
  }
  walk('src')
  return out
}

const found = new Map() // url -> Set of files
for (const f of sourceFiles()) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(/\b(?:url|href):\s*'(https:\/\/[^']+)'/g)) {
    if (!found.has(m[1])) found.set(m[1], new Set())
    found.get(m[1]).add(f.replace(/^src\//, ''))
  }
}

const urls = [...found.keys()].sort()
if (!urls.length) {
  console.error('check-links: found no cited URLs at all — the extraction is broken')
  process.exit(1)
}
console.log(`check-links: ${urls.length} cited URLs across the site\n`)

async function probe(url) {
  // HEAD first (cheap); some servers only answer GET, so fall back
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        headers: { 'user-agent': UA, accept: '*/*' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (res.ok || res.status === 403) return res.status
      if (method === 'GET') return res.status
    } catch (err) {
      if (method === 'GET') return err.name === 'TimeoutError' ? 'timeout' : `error: ${err.message}`
    }
  }
}

const dead = []
const blocked = []
let i = 0
// a handful at a time: polite, and fast enough for ~40 links
const queue = [...urls]
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const url = queue.shift()
      const status = await probe(url)
      const where = [...found.get(url)].join(', ')
      i++
      if (status === 403) {
        blocked.push(`  ${url}\n    (${where})`)
      } else if (typeof status !== 'number' || status >= 400) {
        dead.push(`  ${status}  ${url}\n    cited in ${where}`)
      }
    }
  }),
)

if (blocked.length) {
  console.log(`Blocked to robots (${blocked.length}) — fine for a reader, not verifiable here:`)
  console.log(blocked.join('\n') + '\n')
}
if (dead.length) {
  console.error(`DEAD LINKS (${dead.length}):`)
  console.error(dead.join('\n'))
  process.exit(1)
}
console.log(`All ${i} links resolve (or are robot-blocked). No dead citations.`)
