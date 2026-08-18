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

import { htmlFetch, silentLogger, type SearchLogger } from '../common/index.js'
import { DETAIL_URL, parseJobDetail, type JobDetail } from './parse.js'

export interface DetailOpts {
  id: string
  logger?: SearchLogger
}

/** Accept a raw job ID, a job-view URL, or a job URN. */
function normalizeId(input: string): string | null {
  const urn = input.match(/urn:li:jobPosting:(\d+)/)
  if (urn) return urn[1]
  const url = input.match(/-(\d{6,})(?:[/?]|$)/) || input.match(/\/(\d{6,})(?:[/?]|$)/)
  if (url) return url[1]
  const bare = input.match(/^\d{6,}$/)
  if (bare) return input
  return null
}

export async function detail(opts: DetailOpts): Promise<JobDetail | null> {
  const id = normalizeId(opts.id)
  if (!id) throw new Error(`Could not parse a job ID from "${opts.id}"`)

  const html = await htmlFetch(`${DETAIL_URL}/${id}`, opts.logger ?? silentLogger)
  if (!html) return null
  return parseJobDetail(html, id)
}
