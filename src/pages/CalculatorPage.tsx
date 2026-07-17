import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import Calculator from '../deepdives/Calculator'
import '../styles/deepdives.css'

export default function CalculatorPage() {
  return (
    <div className="dd-page">
      <SiteNav />
      <main className="wrap" style={{ paddingTop: 30, paddingBottom: 80 }}>
        <p style={{ fontSize: 13, margin: '0 0 18px' }}>
          <Link to="/components">← All components</Link>
        </p>
        <Calculator />
      </main>
      <SiteFooter />
    </div>
  )
}
