import type { Comic } from '../types'
import { partitioning } from './partitioning'
import { replicationLeader } from './replication-leader'
import { replicationLag } from './replication-lag'
import { replicationQuorum } from './replication-quorum'

/** Reading order across the v1 slice. */
export const COMICS: Comic[] = [replicationLeader, replicationLag, replicationQuorum, partitioning]

export const COMIC_BY_SLUG: Record<string, Comic> = Object.fromEntries(COMICS.map((c) => [c.slug, c]))
