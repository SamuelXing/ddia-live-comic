import type { Chapter } from '../types'
import { gfs } from './gfs'
import { mapreduce } from './mapreduce'
import { bigtable } from './bigtable'
import { rum } from './rum'
import { chubby } from './chubby'
import { dynamo } from './dynamo'
import { cap } from './cap'
import { cassandra } from './cassandra'
import { lamport } from './lamport'
import { consensus } from './consensus'
import { zookeeper } from './zookeeper'
import { percolator } from './percolator'
import { spanner } from './spanner'
import { memcache } from './memcache'
import { kafka } from './kafka'
import { aurora } from './aurora'

/** Chapters that exist, in reading order — interludes included, since they are
 *  pages a reader walks through. The season's full map, including everything
 *  unwritten, lives in book.ts (TOC); this is only what is live. */
export const CHAPTERS: Chapter[] = [gfs, mapreduce, bigtable, rum, chubby, dynamo, cap, cassandra, lamport, consensus, zookeeper, percolator, spanner, memcache, kafka, aurora]

export const CHAPTER_BY_SLUG: Record<string, Chapter> = Object.fromEntries(CHAPTERS.map((c) => [c.slug, c]))
