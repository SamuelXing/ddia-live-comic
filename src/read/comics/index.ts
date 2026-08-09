import type { Comic } from '../types'
import { tailLatency } from './tail-latency'
import { storage } from './storage'
import { replicationLeader } from './replication-leader'
import { replicationLag } from './replication-lag'
import { replicationQuorum } from './replication-quorum'
import { partitioning } from './partitioning'
import { transactions } from './transactions'
import { distributedTroubles } from './distributed-troubles'
import { consensus } from './consensus'

/** Reading order — roughly DDIA chapter order across the live set. */
export const COMICS: Comic[] = [
  tailLatency,
  storage,
  replicationLeader,
  replicationLag,
  replicationQuorum,
  partitioning,
  transactions,
  distributedTroubles,
  consensus,
]

export const COMIC_BY_SLUG: Record<string, Comic> = Object.fromEntries(COMICS.map((c) => [c.slug, c]))
