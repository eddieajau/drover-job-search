/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobs } from 'db'
import { eq, and } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'
import { htmlFetch, parseSeekJob } from 'provider-seek'

const SEEK_URL_RE = /^https?:\/\/au\.seek\.com\/job\/(\d+)$/

type JobStatusValue = 'applied' | 'interviewing' | 'skipped' | 'blocked' | 'declined' | 'unsuccessful' | 'successful'

const ALLOWED_STATUSES: ReadonlySet<string> = new Set<JobStatusValue>([
  'applied',
  'interviewing',
  'skipped',
  'blocked',
  'declined',
  'unsuccessful',
  'successful',
])

function timestampColumn(status: JobStatusValue): string | null {
  switch (status) {
    case 'applied':
      return 'appliedAt'
    case 'interviewing':
      return 'interviewingAt'
    case 'declined':
      return 'declinedAt'
    case 'unsuccessful':
      return 'unsuccessfulAt'
    case 'successful':
      return 'successfulAt'
    case 'skipped':
      return 'skippedAt'
    case 'blocked':
      return null
  }
}

const postJobImport: FastifyPluginAsync = async app => {
  app.post('/', async (req, reply) => {
    const body = (req.body ?? {}) as { url?: string; status?: string; at?: string }

    const url = body.url
    if (typeof url !== 'string') {
      return reply.badRequest('url is required')
    }

    const urlMatch = url.match(SEEK_URL_RE)
    if (!urlMatch) {
      return reply.badRequest('URL must match https://au.seek.com/job/<id>')
    }

    const providerJobId = urlMatch[1]

    const status = body.status
    if (typeof status !== 'string' || !ALLOWED_STATUSES.has(status)) {
      return reply.badRequest('status is required and must be a valid status')
    }

    const existing = app.db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.provider, 'seek'), eq(jobs.providerJobId, providerJobId)))
      .get()
    if (existing) {
      return reply.conflict('Job already imported')
    }

    const html = await htmlFetch(url)
    if (!html) {
      return reply.code(422).send('Could not fetch job page')
    }

    const detail = parseSeekJob(html, url)
    if (!detail) {
      return reply.code(422).send('Could not parse job page')
    }

    const tsCol = timestampColumn(status as JobStatusValue)
    const atValue = body.at ?? new Date().toISOString()

    const base = {
      provider: 'seek' as const,
      providerJobId: detail.id,
      title: detail.title,
      companyName: detail.company,
      url: detail.url,
      location: detail.location ?? '',
      workplaceType: detail.workplaceType,
      employmentType: detail.employmentType,
      postedAt: detail.postedAt,
      description: detail.descriptionHtml,
      status,
    }

    const values = tsCol ? { ...base, [tsCol]: atValue } : base

    const inserted = app.db.insert(jobs).values(values).returning().get()

    app.publisher.publish(inserted.id, 'rank')

    return reply.code(201).send({ id: inserted.id, status, title: detail.title })
  })
}

export default postJobImport
