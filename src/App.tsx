import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import ComponentsCatalog from './pages/ComponentsCatalog'
import ClassicModulePage from './pages/ClassicModulePage'
import CalculatorPage from './pages/CalculatorPage'
import KafkaPage from './deepdives/kafka/KafkaPage'
import PostgresPage from './deepdives/postgres/PostgresPage'
import RedisPage from './deepdives/redis/RedisPage'
import FeedSimPage from './sims/feed/FeedSimPage'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/components" element={<ComponentsCatalog />} />
      <Route path="/components/kafka" element={<KafkaPage />} />
      <Route path="/components/postgres" element={<PostgresPage />} />
      <Route path="/components/redis" element={<RedisPage />} />
      <Route path="/components/calculator" element={<CalculatorPage />} />
      <Route path="/components/:key" element={<ClassicModulePage />} />
      <Route path="/sims/feed" element={<FeedSimPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
