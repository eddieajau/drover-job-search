/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export type WorkplaceType = 'onsite' | 'hybrid' | 'remote'

/** Normalise a workplace label (e.g. "On-site", "Remote") to a canonical token. */
export function normaliseWorkplace(raw: string | null): WorkplaceType | null {
  const v = (raw ?? '').trim().toLowerCase()
  if (!v) return null
  if (v.startsWith('remote')) return 'remote'
  if (v.startsWith('hybrid')) return 'hybrid'
  if (v.startsWith('on-site') || v.startsWith('onsite')) return 'onsite'
  return null
}
