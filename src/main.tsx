import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

/* Every stylesheet is imported here, in one place, in cascade order — and
   NOT from the page that uses it.

   Page stylesheets used to be imported by their pages. That was fine while
   every route was statically imported, because the whole graph resolved
   before main.tsx's own imports ran, so comic-theme.css genuinely came last.
   The moment routes became lazy, a page's CSS started arriving whenever that
   route loaded — i.e. AFTER the theme — and every override in comic-theme.css
   that merely TIED on specificity silently lost. It flipped
   `.tbl-anchor td {white-space: normal}` against
   `.dd-page .tbl td:first-child {white-space: nowrap}`, both (0,3,1), and the
   label column stopped wrapping and overlapped the column beside it.

   Load order is not a place to keep intent. comic-theme.css is last because
   it has the final say; that is now stated here rather than emerging from
   which route someone happened to open first.

   Cost is ~12 kB gzip of CSS that is no longer route-split. Every route uses
   most of it anyway, and the JS split is where the real weight was.
   comic-theme.css also @imports every @fontsource face, so typefaces are
   global from here too. */
import './styles/global.css'
import './styles/deepdives.css'
import './styles/flagship.css'
import './styles/comic.css'
import './styles/sim.css'
import './styles/comic-theme.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
