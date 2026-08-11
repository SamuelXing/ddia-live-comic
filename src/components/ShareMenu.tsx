import { useEffect, useRef, useState } from 'react'
import { SITE_URL } from '../site'

/* Share to social.
 *
 * Plain `<a href>` intent links, no SDK. Every platform offers a share widget
 * that wants a script tag; loading one would make this the first third-party
 * request on a site that currently ships nothing but its own bytes, and those
 * widgets track the reader whether or not they click. An intent URL does the
 * same job with a link.
 *
 * The link shared is the CURRENT page, not the homepage — a reader who found
 * the quorum comic worth sharing means that comic. On the calculators that
 * also carries the scenario, because the query string is part of the URL.
 */

interface Target {
  id: string
  label: string
  /** built from the live page URL and title */
  href: (url: string, title: string) => string
}

const TARGETS: Target[] = [
  {
    id: 'x',
    label: 'X',
    href: (u, t) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
  },
  {
    id: 'hn',
    label: 'Hacker News',
    href: (u, t) => `https://news.ycombinator.com/submitlink?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}`,
  },
  {
    id: 'reddit',
    label: 'Reddit',
    href: (u, t) => `https://www.reddit.com/submit?url=${encodeURIComponent(u)}&title=${encodeURIComponent(t)}`,
  },
  {
    id: 'li',
    label: 'LinkedIn',
    href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}`,
  },
]

/** The page as a sharer should see it: the real origin in production, and the
 *  canonical domain when running locally so a copied link is never localhost. */
function currentUrl(): string {
  if (typeof window === 'undefined') return SITE_URL
  const { origin, pathname, search } = window.location
  const base = origin.startsWith('http://localhost') || origin.startsWith('http://127.') ? SITE_URL : origin
  return base + pathname + search
}

export default function ShareMenu() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const box = useRef<HTMLDivElement | null>(null)

  /* Close on outside click and on Escape. A menu that can only be dismissed by
     clicking its own trigger is a trap for keyboard users. */
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const url = currentUrl()
  const title = typeof document === 'undefined' ? 'DDIA, as a live comic' : document.title

  /* `navigator.share` being a function does NOT mean "this is a phone" —
     desktop Chrome and Edge both expose it. Branching on it made the button do
     nothing at all on desktop: the native call neither opened anything useful
     nor rejected, so the fallback never ran and the menu never appeared.
     The menu now always opens. Where a real share sheet exists it is offered
     as one more item, so phones still reach the apps they actually use and
     nothing is ever hidden behind a capability check. */
  const native = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  return (
    <div className="gn-share" ref={box}>
      <button
        type="button"
        className="gn-link gn-share-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Share this page"
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M11.5 1a2.5 2.5 0 0 0-2.45 3l-3.2 1.86a2.5 2.5 0 1 0 0 4.28l3.2 1.86a2.5 2.5 0 1 0 .62-1.1L6.47 9.05a2.5 2.5 0 0 0 0-2.1l3.2-1.85A2.5 2.5 0 1 0 11.5 1z" />
        </svg>
        <span className="lbl">Share</span>
      </button>

      {open && (
        <div className="gn-share-menu" role="menu">
          {TARGETS.map((t) => (
            <a
              key={t.id}
              role="menuitem"
              href={t.href(url, title)}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => setOpen(false)}
            >
              {t.label}
            </a>
          ))}
          {native && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                navigator.share({ title, url }).catch(() => {})
                setOpen(false)
              }}
            >
              More apps…
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className={copied ? 'ok' : ''}
            onClick={() => {
              navigator.clipboard?.writeText(url).then(
                () => {
                  setCopied(true)
                  window.setTimeout(() => {
                    setCopied(false)
                    setOpen(false)
                  }, 1200)
                },
                () => setOpen(false),
              )
            }}
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      )}
    </div>
  )
}
