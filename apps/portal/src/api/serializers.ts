/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Query } from 'db'

export function parseQueryOptions(raw: string | null): Record<string, unknown> | undefined {
  if (!raw) {
    return undefined
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return undefined
  }
}

export interface QueryResponse {
  id: number
  provider: string
  queryText: string
  queryOptions?: Record<string, unknown>
  enabled: boolean | null
  createdAt: string
}

export function toQueryJson(row: Query): QueryResponse {
  const { queryOptions, ...rest } = row
  return { ...rest, queryOptions: parseQueryOptions(queryOptions) }
}
