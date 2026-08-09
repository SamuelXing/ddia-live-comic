import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import ComponentsCatalog from './pages/ComponentsCatalog'
import ClassicModulePage from './pages/ClassicModulePage'
import CalculatorPage from './pages/CalculatorPage'
import KafkaPage from './deepdives/kafka/KafkaPage'
import PostgresPage from './deepdives/postgres/PostgresPage'
import RedisPage from './deepdives/redis/RedisPage'
import RabbitMQPage from './deepdives/rabbitmq/RabbitMQPage'
import FeedSimPage from './sims/feed/FeedSimPage'
import ObservabilityPage from './sims/observability/ObservabilityPage'
import ReadIndexPage from './read/IndexPage'
import ReadPage from './read/ReadPage'
import NotFound from './pages/NotFound'
import ScrollToTop from './components/ScrollToTop'

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/components" element={<ComponentsCatalog />} />
        <Route path="/components/kafka" element={<KafkaPage />} />
        <Route path="/components/postgres" element={<PostgresPage />} />
        <Route path="/components/redis" element={<RedisPage />} />
        <Route path="/components/rabbitmq" element={<RabbitMQPage />} />
        {/* Two tools, one nav item. Each tab is a real route so it can be
            linked and shared; a tab held only in component state cannot. */}
        <Route path="/calculator" element={<Navigate to="/calculator/capacity" replace />} />
        <Route path="/calculator/capacity" element={<CalculatorPage tab="capacity" />} />
        <Route path="/calculator/latency" element={<CalculatorPage tab="latency" />} />
        {/* the calculator used to live under /components */}
        <Route path="/components/calculator" element={<Navigate to="/calculator/capacity" replace />} />
        <Route path="/components/:key" element={<ClassicModulePage />} />
        <Route path="/sims/feed" element={<FeedSimPage />} />
        <Route path="/sims/observability" element={<ObservabilityPage />} />
        <Route path="/read" element={<ReadIndexPage />} />
        <Route path="/read/:slug" element={<ReadPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}
