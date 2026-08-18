/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { EmploymentType } from './employment.js'
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
