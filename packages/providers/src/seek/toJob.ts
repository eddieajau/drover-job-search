/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { htmlFetch, ProviderError, toMarkdown, type ProvidedJob, type SearchLogger } from '../common/index.js'
import { parseSeekJob } from './parse.js'

/**
 * Fetch SEEK HTML for a job URL, parse it, and return a `ProvidedJob`
 * with a markdown description.
 *
 * Throws `ProviderError` on fetch failure or parse failure.
 */
export async function toJob(url: string, _logger?: SearchLogger): Promise<ProvidedJob> {
  const html = await htmlFetch(url, _logger)
  if (!html) {
    throw new ProviderError('fetch_failed', 'Could not fetch job page')
  }

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
