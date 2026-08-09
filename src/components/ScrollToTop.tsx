import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

/* A new page should start at the top.

   React Router swaps the component tree but never touches the scroll
   position, so following a link from halfway down the catalog dropped you
   halfway down the deep-dive — chapter 7 of Postgres, before you had read
   chapter 1. Only two pages scrolled themselves; every other route inherited
   wherever the previous one happened to be.

   Keyed on pathname, deliberately not on hash: the deep-dive tables of
   contents are real `#anchor` links, and resetting on every hash change
   would yank the reader back to the top the instant they clicked one. When a
   hash IS present — a shared deep link — the anchor wins and we leave the
   scroll alone, since the browser has already put us there. */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useLayoutEffect(() => {
    if (hash) {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
      return
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])

  return null
}
