import type { ModuleDef } from './types'
import { webModule } from './modules/web'
import { s3Module } from './modules/s3'

/* ============================================================
   Component catalog.
   flagship = full seven-chapter treatment (anatomy trace,
   hardware envelope, papers). classic = sandbox-style page,
   awaiting its flagship redesign. planned = on the roadmap.
   ============================================================ */

export type ComponentStatus = 'flagship' | 'classic' | 'planned'

export interface CatalogEntry {
  key: string
  name: string
  emoji: string
  color: string
  status: ComponentStatus
  desc: string
  /** For paper-driven components: the primary source it will be built from. */
  paper?: string
}

export const CATALOG: CatalogEntry[] = [
  { key: 'kafka', name: 'Apache Kafka', emoji: '📨', color: '#e6a72a', status: 'flagship', desc: 'The distributed log. Follow one append-only file as it turns into throughput, replay, and exactly-once — then find the wall where it stops.' },
  { key: 'postgres', name: 'PostgreSQL', emoji: '🐘', color: '#9085e9', status: 'flagship', desc: 'The relational anchor. One UPDATE from SQL text to fsync, MVCC versions aging under vacuum, and the day Notion outgrew a single primary.' },
  { key: 'redis', name: 'Redis', emoji: '⚡', color: '#e5533b', status: 'flagship', desc: 'The in-memory data-structure server. One command through the single-threaded loop, the fork-and-copy persistence spike, and the hot key no shard can fix.' },
  { key: 'web', name: 'Web / App tier', emoji: '🖥️', color: '#3987e5', status: 'classic', desc: "Stateless scale-out, Little's Law, and the connection fan-out trap." },
  { key: 'rabbitmq', name: 'RabbitMQ', emoji: '🐰', color: '#37b6c4', status: 'flagship', desc: 'The smart broker. A message through exchange, binding, and prefetch; the one-core-per-queue ceiling; and the honest moment you hand off to Kafka.' },
  { key: 's3', name: 'S3 / Object storage', emoji: '🪣', color: '#25b866', status: 'classic', desc: 'Per-prefix request limits, the latency floor, and the cost shape.' },
  { key: 'cassandra', name: 'Cassandra', emoji: '💍', color: '#5aa2f0', status: 'planned', desc: 'The Dynamo ring meets the Bigtable storage engine: consistent hashing, LSM trees, memtables → SSTables, compaction, tombstones, tunable consistency.', paper: 'Lakshman & Malik, LADIS ’09 + Dynamo ’07' },
  { key: 'dynamodb', name: 'DynamoDB', emoji: '🧿', color: '#e6a72a', status: 'planned', desc: 'Quorums (R+W>N), sloppy quorums & hinted handoff, adaptive capacity, and what a fully-managed Dynamo descendant changed.', paper: 'DeCandia et al. ’07 + USENIX ATC ’22' },
  { key: 'flink', name: 'Apache Flink', emoji: '🌊', color: '#e5533b', status: 'planned', desc: 'Streaming dataflow with exactly-once state: the barrier-snapshot (asynchronous Chandy-Lamport) checkpoint algorithm, animated.', paper: 'Carbone et al. ’15 (ABS) + IEEE ’15' },
  { key: 'etcd', name: 'etcd / Raft', emoji: '🗳️', color: '#9085e9', status: 'planned', desc: 'The coordination layer everything depends on: leader election, log replication, and why quorums make writes slow but safe.', paper: 'Ongaro & Ousterhout, USENIX ATC ’14' },
  { key: 'webruntimes', name: 'Inside a web server', emoji: '🧵', color: '#25b866', status: 'planned', desc: 'Concurrency models across languages — thread-per-request vs event loop vs goroutines vs async runtimes — with TechEmpower benchmark data.', paper: 'TechEmpower Framework Benchmarks' },
]

export const CLASSIC_MODULES: Record<string, ModuleDef> = {
  web: webModule,
  s3: s3Module,
}
