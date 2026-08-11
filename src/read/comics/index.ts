import type { Comic } from '../types'
import { tailLatency } from './tail-latency'
import { storage } from './storage'
import { replicationLeader } from './replication-leader'
import { replicationLag } from './replication-lag'
import { replicationQuorum } from './replication-quorum'
import { partitioning } from './partitioning'
import { partitionKey } from './partition-key'
import { transactions } from './transactions'
import { distributedTroubles } from './distributed-troubles'
import { consensus } from './consensus'
import { shuffle } from './shuffle'
import { streamTable } from './stream-table'

/** Reading order — roughly DDIA (1st edition) chapter order across the live set. */
export const COMICS: Comic[] = [
  tailLatency,
  storage,
  replicationLeader,
  replicationLag,
  replicationQuorum,
  partitioning,
  partitionKey,
  transactions,
  distributedTroubles,
  consensus,
  shuffle,
  streamTable,
]

export const COMIC_BY_SLUG: Record<string, Comic> = Object.fromEntries(COMICS.map((c) => [c.slug, c]))
