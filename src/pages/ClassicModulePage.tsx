import { Link, useParams } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import ModulePanel from '../deepdives/ModulePanel'
import { CLASSIC_MODULES } from '../deepdives/catalog'
import NotFound from './NotFound'
import '../styles/deepdives.css'

export default function ClassicModulePage() {
  const { key } = useParams()
  const module = key ? CLASSIC_MODULES[key] : undefined
  if (!module) return <NotFound />

  return (
    <div className="dd-page">
      <SiteNav />
      <main className="wrap" style={{ paddingTop: 30, paddingBottom: 80 }}>
        <p style={{ fontSize: 13, margin: '0 0 18px' }}>
          <Link to="/components">← All components</Link>
          <span style={{ color: 'var(--muted)', marginLeft: 10 }}>
            classic page — flagship redesign coming
          </span>
        </p>
        <ModulePanel module={module} />
      </main>
      <SiteFooter />
    </div>
  )
}
