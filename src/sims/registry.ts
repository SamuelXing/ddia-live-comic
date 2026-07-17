/* ============================================================
   App-simulation registry.
   To add a new simulation: create src/sims/<name>/ with a model,
   an engine (or reuse FeedEngine patterns), and a page component;
   add a route in App.tsx; then register it here.
   ============================================================ */

export type SimStatus = 'live' | 'next' | 'soon'

export interface SimEntry {
  id: string
  emoji: string
  name: string
  status: SimStatus
  /** Router path for live sims. */
  path?: string
  desc: string
  tags: string[]
  accent: string
}

export const SIMS: SimEntry[] = [
  {
    id: 'feed',
    emoji: '📱',
    name: 'Social Feed',
    status: 'live',
    path: '/sims/feed',
    desc: 'Timelines, posts, likes, fan-out. The canonical read-heavy app — meet the celebrity fan-out problem and the write wall.',
    tags: ['fan-out on write', 'hot keys', 'read replicas', 'sharding'],
    accent: '#3987e5',
  },
  {
    id: 'checkout',
    emoji: '🛒',
    name: 'E-commerce Checkout',
    status: 'next',
    desc: 'Cart, inventory, payment, orders. Inventory contention, flash-sale spikes, and keeping the write path consistent under load.',
    tags: ['inventory contention', 'flash sales', 'sagas', 'idempotency'],
    accent: '#25b866',
  },
  {
    id: 'delivery',
    emoji: '🍔',
    name: 'Food Delivery',
    status: 'soon',
    desc: 'Order → kitchen → courier → payment. The microservices.io FTGO example — choreographed multi-service Sagas and their failure modes.',
    tags: ['sagas', 'choreography', 'geo-matching', 'event-driven'],
    accent: '#e6a72a',
  },
  {
    id: 'chat',
    emoji: '💬',
    name: 'Chat / Messaging',
    status: 'soon',
    desc: 'Real-time delivery, presence, conversation fan-out over websockets. Where connection scaling and ordering become the hard problems.',
    tags: ['websockets', 'connection scale', 'ordering', 'presence'],
    accent: '#37b6c4',
  },
  {
    id: 'stream',
    emoji: '🎬',
    name: 'Video Streaming',
    status: 'soon',
    desc: 'Upload, transcode pipeline, CDN delivery, adaptive bitrate. S3/CDN economics and async job queues at scale.',
    tags: ['transcode queue', 'CDN', 'object storage', 'bandwidth'],
    accent: '#9085e9',
  },
]

export const STATUS_META: Record<SimStatus, { cls: string; label: string; foot: string }> = {
  live: { cls: 'status-live', label: 'Live', foot: 'Open simulation →' },
  next: { cls: 'status-next', label: 'Next up', foot: 'In development' },
  soon: { cls: 'status-soon', label: 'Planned', foot: 'On the roadmap' },
}
