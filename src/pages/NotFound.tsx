import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav'

export default function NotFound() {
  return (
    <>
      <SiteNav />
      <div className="nf">
        <h1>404</h1>
        <p>This node isn&apos;t in the topology.</p>
        <Link className="btn btn-primary" to="/">
          Back to the hub
        </Link>
      </div>
    </>
  )
}
