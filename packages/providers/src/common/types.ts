/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { EmploymentType } from './employment.js'
import type { SearchLogger } from './fetch.js'
import type { WorkplaceType } from './workplace.js'

/**
 * Provider-derived fields only.
 *
 * The handler supplies `status` and the timestamp — those are request-level
 * concerns, not provider concerns.
 */
export interface ProvidedJob {
  provider: 'seek' | 'linkedin'
  providerJobId: string
  title: string
  companyName: string
  url: string
  location: string
  workplaceType: WorkplaceType | null
  employmentType: EmploymentType | null
  postedAt: string | null
  description: string | null
}

/**
 * Strategy adapter for a single job provider (SEEK, LinkedIn, etc.).
 *
 * The dispatcher iterates an array of these — new providers are added by
 * appending, not by editing `importJob`.
 */
export interface Provider {
  name: string
  isMatch(url: string): boolean
  toJob(url: string, logger?: SearchLogger): Promise<ProvidedJob> | ProvidedJob
}
