import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop'
import { titleForPath } from './routeTitle'
import SiteNav from './components/SiteNav'

/* Every route is a separate chunk. Without this the whole site — every idea
   comic, six deep-dives with their traces, two calculators, two sims — ships
   as one bundle, so a reader who followed a link to a single comic downloads
   all of it. The nav and the scroll handler stay eager: they are on every page
   and they are what the fallback below renders. */
const Home = lazy(() => import('./pages/Home'))
const ComponentsCatalog = lazy(() => import('./pages/ComponentsCatalog'))
const CalculatorPage = lazy(() => import('./pages/CalculatorPage'))
const KafkaPage = lazy(() => import('./deepdives/kafka/KafkaPage'))
const PostgresPage = lazy(() => import('./deepdives/postgres/PostgresPage'))
const RedisPage = lazy(() => import('./deepdives/redis/RedisPage'))
const RabbitMQPage = lazy(() => import('./deepdives/rabbitmq/RabbitMQPage'))
const WebPage = lazy(() => import('./deepdives/web/WebPage'))
const S3Page = lazy(() => import('./deepdives/s3/S3Page'))
const FeedSimPage = lazy(() => import('./sims/feed/FeedSimPage'))
const ObservabilityPage = lazy(() => import('./sims/observability/ObservabilityPage'))
const ReadIndexPage = lazy(() => import('./read/IndexPage'))
const ReadPage = lazy(() => import('./read/ReadPage'))
const NotFound = lazy(() => import('./pages/NotFound'))

/** Shown while a route chunk loads. It draws the real nav so the page frame
 *  does not jump, and nothing else — a spinner that appears for 80 ms reads
 *  as a glitch, not as progress. */
function RouteFallback() {
  return (
    <div className="gn">
      <SiteNav />
      <div style={{ minHeight: '70vh' }} />
    </div>
  )
}


/** Keeps document.title describing the page you are actually on. Sharing reads
 *  it, and so do browser tabs, bookmarks and history — all of which said the
 *  same sentence on every route until now. */
function RouteTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    const t = titleForPath(pathname)
    if (t) document.title = t
  }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <RouteTitle />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/components" element={<ComponentsCatalog />} />
          <Route path="/components/kafka" element={<KafkaPage />} />
          <Route path="/components/postgres" element={<PostgresPage />} />
          <Route path="/components/redis" element={<RedisPage />} />
          <Route path="/components/rabbitmq" element={<RabbitMQPage />} />
          <Route path="/components/web" element={<WebPage />} />
          <Route path="/components/s3" element={<S3Page />} />
          {/* Two tools, one nav item. Each tab is a real route so it can be
              linked and shared; a tab held only in component state cannot. */}
          <Route path="/calculator" element={<Navigate to="/calculator/capacity" replace />} />
          <Route path="/calculator/capacity" element={<CalculatorPage tab="capacity" />} />
          <Route path="/calculator/latency" element={<CalculatorPage tab="latency" />} />
          {/* the calculator used to live under /components */}
          <Route path="/components/calculator" element={<Navigate to="/calculator/capacity" replace />} />
          <Route path="/sims/feed" element={<FeedSimPage />} />
          <Route path="/sims/observability" element={<ObservabilityPage />} />
          <Route path="/read" element={<ReadIndexPage />} />
          <Route path="/read/:slug" element={<ReadPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  )
}
