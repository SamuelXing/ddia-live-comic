import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop'
import { titleForPath } from './routeTitle'
import SiteNav from './components/SiteNav'

/* Every route is a separate chunk. Without this the whole site — every idea
   comic, six deep-dives with their traces, two calculators, two sims — ships
   as one bundle, so a reader who followed a link to a single comic downloads
   all of it. The nav and the scroll handler stay eager: they are on every page
   and they are what the fallback below renders. */
const Bookshelf = lazy(() => import('./pages/Bookshelf'))
const Home = lazy(() => import('./pages/Home'))
const ComponentsCatalog = lazy(() => import('./pages/ComponentsCatalog'))
const AppsCatalog = lazy(() => import('./pages/AppsCatalog'))
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
const PapersIndexPage = lazy(() => import('./papers/IndexPage'))
const PaperPage = lazy(() => import('./papers/PaperPage'))
const K8sIndexPage = lazy(() => import('./k8s/IndexPage'))
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

/** Legacy deep links: preserve the slug/name while moving under /ddia.
 *  Old URLs live in shared links and search results forever — they redirect,
 *  and the route table keeps entries for them so their previews stay right. */
function LegacyRead() {
  const { slug } = useParams()
  return <Navigate to={`/ddia/read/${slug}`} replace />
}
function LegacyComponent() {
  const { name } = useParams()
  /* the calculator once lived at /components/calculator — it is its own tool now */
  return <Navigate to={name === 'calculator' ? '/calculator/capacity' : `/ddia/components/${name}`} replace />
}
/** The simulations have moved twice: /sims/x → /ddia/sims/x → /ddia/apps/x.
 *  Both older spellings still land, and both keep their route-table entries so
 *  a link shared from either era still previews as itself. */
function LegacySim() {
  const { name } = useParams()
  return <Navigate to={`/ddia/apps/${name}`} replace />
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <RouteTitle />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* the bookshelf — each book lives isolated under its own prefix */}
          <Route path="/" element={<Bookshelf />} />

          {/* Book A — DDIA, as a live comic */}
          <Route path="/ddia" element={<Home />} />
          <Route path="/ddia/read" element={<ReadIndexPage />} />
          <Route path="/ddia/read/:slug" element={<ReadPage />} />
          <Route path="/ddia/components" element={<ComponentsCatalog />} />
          <Route path="/ddia/components/kafka" element={<KafkaPage />} />
          <Route path="/ddia/components/postgres" element={<PostgresPage />} />
          <Route path="/ddia/components/redis" element={<RedisPage />} />
          <Route path="/ddia/components/rabbitmq" element={<RabbitMQPage />} />
          <Route path="/ddia/components/web" element={<WebPage />} />
          <Route path="/ddia/components/s3" element={<S3Page />} />
          <Route path="/ddia/apps" element={<AppsCatalog />} />
          <Route path="/ddia/apps/feed" element={<FeedSimPage />} />
          <Route path="/ddia/apps/observability" element={<ObservabilityPage />} />

          {/* Book B — the papers storybook */}
          {/* One season per page. Season 1 keeps the bare /papers — it is the
              book's front door and every existing link points at it. The extra
              path segment on the others is what keeps them from colliding with
              the :slug catch-all below, which is why it is /papers/season/2 and
              not /papers/season-2. */}
          <Route path="/papers" element={<PapersIndexPage season={1} />} />
          <Route path="/papers/season" element={<Navigate to="/papers" replace />} />
          <Route path="/papers/season/1" element={<Navigate to="/papers" replace />} />
          <Route path="/papers/season/2" element={<PapersIndexPage season={2} />} />
          <Route path="/papers/:slug" element={<PaperPage />} />

          {/* Book C — Kubernetes. Contents only for now; the chapter
              route arrives with the first chapter rather than before it, so
              there is no /k8s/<slug> that 404s from a link somebody shared. */}
          <Route path="/k8s" element={<K8sIndexPage />} />

          {/* Shared tools. Two tabs, each a real route so it can be linked. */}
          <Route path="/calculator" element={<Navigate to="/calculator/capacity" replace />} />
          <Route path="/calculator/capacity" element={<CalculatorPage tab="capacity" />} />
          <Route path="/calculator/latency" element={<CalculatorPage tab="latency" />} />

          {/* Legacy URLs from before the bookshelf split — redirect forever */}
          <Route path="/read" element={<Navigate to="/ddia/read" replace />} />
          <Route path="/read/:slug" element={<LegacyRead />} />
          <Route path="/components" element={<Navigate to="/ddia/components" replace />} />
          <Route path="/components/:name" element={<LegacyComponent />} />
          <Route path="/sims/:name" element={<LegacySim />} />
          <Route path="/ddia/sims" element={<Navigate to="/ddia/apps" replace />} />
          <Route path="/ddia/sims/:name" element={<LegacySim />} />
          <Route path="/apps" element={<Navigate to="/ddia/apps" replace />} />
          <Route path="/apps/:name" element={<LegacySim />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  )
}
