/** Types for `routes.mjs`. It is plain JavaScript because a post-build Node
 *  script has to read it without a compile step; this keeps the app's side of
 *  the import type-checked anyway. */
export interface RouteMeta {
  /** null on the homepage, which uses the full site title */
  title: string | null
  desc: string
}
export declare const SITE_TITLE: string
export declare const SITE_DESC: string
export declare const ROUTES: Record<string, RouteMeta>
export declare function fullTitle(entry?: RouteMeta): string

export function cardName(path: string): string
export function cardFor(path: string): string | undefined
export function cards(): { name: string; entry: RouteMeta; path: string }[]
