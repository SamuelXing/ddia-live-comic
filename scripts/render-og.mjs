/**
 * One social card per page, in the site's own skin.
 *
 * Every route already carries its own title and description (scripts/routes.mjs)
 * and has since the per-route emitter shipped — but all 58 of them sat on one
 * picture, which was the DDIA book's card, still counting eleven comics. A link
 * to the papers book unfurled as a different book.
 *
 * Cards are rendered from that same table, so the picture cannot say something
 * the page does not. Routes that share an entry object — every /ddia/x page has
 * a legacy /x twin pointing at the SAME object — share one card by identity, so
 * 58 routes need 29 files.
 *
 * NOT part of `npm run build`. The build runs on Cloudflare, which has no
 * browser; this needs a real Chrome. So it is a local step (`npm run og`) whose
 * output is committed to public/og/, and the build only copies files. The
 * emitter fails the build if a route's card is missing, which is what keeps the
 * two in step without putting Chrome in CI.
 *
 * Usage: npm run og   (override the binary with CHROME_PATH=/path/to/chrome)
 */
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROUTES, SITE_TITLE, cards } from './routes.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'og')
const exe = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const font = (file) =>
  'data:font/woff2;base64,' + readFileSync(join(ROOT, 'node_modules', file)).toString('base64')

const FONTS = {
  display: font('@fontsource/playfair-display/files/playfair-display-latin-800-normal.woff2'),
  body: font('@fontsource/newsreader/files/newsreader-latin-400-normal.woff2'),
  mono: font('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2'),
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/* Which book a route belongs to. The kicker names it, so a shared link says
   which shelf it came off before anyone reads the title. */
function section(path) {
  if (path.startsWith('/ddia')) return { kicker: 'DDIA, as a live comic', accent: '#3f6191' }
  if (path.startsWith('/papers')) return { kicker: 'The Papers That Broke the Database', accent: '#3f6191' }
  if (path.startsWith('/calculator')) return { kicker: 'The shared instrument', accent: '#bd5f3d' }
  return { kicker: 'Books with working parts', accent: '#bd5f3d' }
}

function card({ title, desc, kicker, accent }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:PF;src:url(${FONTS.display}) format('woff2');font-weight:800}
  @font-face{font-family:NR;src:url(${FONTS.body}) format('woff2');font-weight:400}
  @font-face{font-family:JB;src:url(${FONTS.mono}) format('woff2');font-weight:400}
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:#f2ece1;
    /* the halftone the whole site is printed on */
    background-image:radial-gradient(#c9bda6 1.4px,transparent 1.5px);background-size:19px 19px;
    display:flex;align-items:center;justify-content:center;font-family:NR,Georgia,serif}
  .card{width:1076px;height:508px;background:#f7f4ef;border:5px solid #1a1a1a;
    box-shadow:14px 14px 0 ${accent};padding:52px 58px;display:flex;flex-direction:column}
  .k{font-family:JB,monospace;font-size:21px;letter-spacing:.19em;text-transform:uppercase;
    color:#8a8177;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  h1{font-family:PF,Georgia,serif;font-weight:800;font-size:68px;line-height:1.06;
    letter-spacing:-.02em;color:#16130f;margin-top:26px;
    /* two lines is the budget; a third would push the dek off the card */
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  h1.long{font-size:54px}
  p{font-size:29px;line-height:1.42;color:#45403a;margin-top:22px;
    display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  .foot{margin-top:auto;border-top:3px solid #1a1a1a;padding-top:18px;display:flex;
    justify-content:space-between;align-items:baseline;
    font-family:JB,monospace;font-size:20px;color:#8a8177}
  .foot b{color:${accent};font-weight:400}
  </style></head><body><div class="card">
    <div class="k">${esc(kicker)}</div>
    <h1 class="${title.length > 34 ? 'long' : ''}">${esc(title)}</h1>
    <p>${esc(desc)}</p>
    <div class="foot"><span><b>${esc(SITE_TITLE)}</b> — read it, then push on it until it breaks</span><span>systemscomic.com</span></div>
  </div></body></html>`
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ executablePath: exe })
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })

let n = 0
for (const { name, entry, path } of cards()) {
  const { kicker, accent } = section(path)
  await page.setContent(
    card({ title: entry.title ?? SITE_TITLE, desc: entry.desc, kicker, accent }),
    { waitUntil: 'load' },
  )
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: join(OUT, name + '.png') })
  n++
}
await browser.close()
console.log(`Social cards: ${n} rendered for ${Object.keys(ROUTES).length} routes → public/og/`)
