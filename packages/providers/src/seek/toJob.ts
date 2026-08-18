/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { ProviderError, toMarkdown, type ProvidedJob } from '../common/index.js'
import { parseSeekJob } from './parse.js'

/**
 * Turn already-fetched Seek HTML into a `ProvidedJob` with a markdown
 * description.
 *
 * The **dispatcher** (ticket 131) owns the 422 for an empty `htmlFetch`
 * response; `toJob` receives already-fetched HTML so it only owns the
 * parse-fail path.
 */
export function toJob(html: string, url: string): ProvidedJob {
  const detail = parseSeekJob(html, url)
  if (!detail) {
    throw new ProviderError('parse_failed', 'Could not parse job page')
  }

  return {
    provider: 'seek',
    providerJobId: detail.id,
    title: detail.title,
    companyName: detail.company,
    url: detail.url,
    location: detail.location ?? '',
    workplaceType: detail.workplaceType,
    employmentType: detail.employmentType,
    postedAt: detail.postedAt,
    description: detail.descriptionHtml ? toMarkdown(detail.descriptionHtml) : null,
  }
}
