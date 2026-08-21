// Adapted from linkedin-search-cli (MIT License).
// Original: https://github.com/MadsLorentzen/ai-job-search/tree/main/.agents/skills/linkedin-search/cli
//
// Copyright (c) 2025 MadsLorentzen
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import {
  normaliseEmploymentType,
  ProviderError,
  silentLogger,
  toMarkdown,
  type ProvidedJob,
  type SearchLogger,
} from '../common/index.js'
import { detail } from './detail.js'
import { type JobDetail } from './parse.js'

function toProvidedJob(d: JobDetail): ProvidedJob {
  return {
    provider: 'linkedin',
    providerJobId: d.id,
    title: d.title,
    companyName: d.company ?? '',
    url: d.url,
    location: d.location ?? '',
    workplaceType: d.workplaceType,
    employmentType: normaliseEmploymentType(d.employmentType),
    postedAt: d.date,
    description: d.description ? toMarkdown(d.description) : null,
  }
}

/**
 * Fetch and parse a LinkedIn job into a `ProvidedJob` with a markdown
 * description.
 *
 * The **dispatcher** (ticket 131) maps `ProviderError` codes to HTTP
 * status; `toJob` owns the fetch-fail, closed, and map-to-ProvidedJob
 * paths only.
 */
export async function toJob(url: string, logger: SearchLogger = silentLogger): Promise<ProvidedJob> {
  const d = await detail({ id: url, logger })

  if (!d) {
    throw new ProviderError('fetch_failed', 'Could not fetch job page')
  }

  if (d.closed) {
    throw new ProviderError('job_closed', 'This job is no longer accepting applications')
  }

  return toProvidedJob(d)
}
