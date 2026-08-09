import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

/* comic-theme.css @imports every @fontsource face, so the typefaces are
   already global from here. Home, the comic reader, and the read index used
   to import the same ten files again in JS; that duplication only pulled the
   font CSS into three route chunks once the routes were split. */
import './styles/global.css'
import './styles/comic-theme.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
