import { NavLink } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import Calculator from '../deepdives/Calculator'
import LatencyCalculator from '../deepdives/LatencyCalculator'
import '../styles/deepdives.css'

/* Two calculators, one nav item. They answer the same question from opposite
   sides — "will this design carry the load" and "will it answer in time" — and
   every fix in one is a cost in the other, which is the reason to keep them
   adjacent rather than merged. */
const TABS = [
  { to: '/calculator/capacity', label: 'Capacity', sub: 'what it needs' },
  { to: '/calculator/latency', label: 'Latency', sub: 'where the time goes' },
]

export default function CalculatorPage({ tab }: { tab: 'capacity' | 'latency' }) {
  return (
    <div className="dd-page">
      <SiteNav />
      <main className="wrap" style={{ paddingTop: 30, paddingBottom: 80 }}>
        <nav className="calc-tabs" aria-label="Which calculator">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} className={({ isActive }) => 'calc-tab' + (isActive ? ' on' : '')}>
              {t.label}
              <span>{t.sub}</span>
            </NavLink>
          ))}
        </nav>
        {tab === 'capacity' ? <Calculator /> : <LatencyCalculator />}
      </main>
      <SiteFooter />
    </div>
  )
}
