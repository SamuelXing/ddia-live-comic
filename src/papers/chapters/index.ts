import type { Chapter } from '../types'
import { bigtable } from './bigtable'

/** Chapters that exist, in reading order. The season's full map — including
 *  everything unwritten — lives in book.ts (TOC); this is only what is live. */
export const CHAPTERS: Chapter[] = [bigtable]

export const CHAPTER_BY_SLUG: Record<string, Chapter> = Object.fromEntries(CHAPTERS.map((c) => [c.slug, c]))
