/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

/**
 * Values permitted by the `check_employment_type` constraint on the `jobs`
 * table (packages/db/src/schema.ts).
 */
export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'temporary' | 'casual' | 'other'

export const EMPLOYMENT_TYPE_MAP: Record<string, EmploymentType> = {
  'full-time': 'full-time',
  'full time': 'full-time',
  'part-time': 'part-time',
  'part time': 'part-time',
  contract: 'contract',
  temporary: 'temporary',
  casual: 'casual',
  internship: 'other',
  other: 'other',
}

export function normaliseEmploymentType(raw: string | null): EmploymentType | null {
  if (!raw) return null
  const key = raw.trim().toLowerCase()
  return EMPLOYMENT_TYPE_MAP[key] ?? null
}
