/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobs } from 'db'
import { eq, and } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'
import { detail } from 'provider-linkedin'
import { htmlFetch, parseSeekJob } from 'provider-seek'
import { toMarkdown } from 'workers'

const SEEK_URL_RE = /^https?:\/\/au\.seek\.com\/job\/(\d+)$/
const LINKEDIN_URL_RE = /^https?:\/\/(?:[a-z]{2,}\.)?linkedin\.com\/jobs\/view\/(\d{6,})\/?$/

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
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

function normaliseEmploymentType(raw: string | null): string | null {
  if (!raw) return null
  const key = raw.trim().toLowerCase()
  return EMPLOYMENT_TYPE_MAP[key] ?? null
}

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

    const seekMatch = url.match(SEEK_URL_RE)
    const linkedinMatch = url.match(LINKEDIN_URL_RE)

    let provider: 'seek' | 'linkedin'
    let providerJobId: string
    if (seekMatch) {
      provider = 'seek'
      providerJobId = seekMatch[1]
    } else if (linkedinMatch) {
      provider = 'linkedin'
      providerJobId = linkedinMatch[1]
    } else {
      return reply.badRequest('URL must be a Seek or LinkedIn job URL')
    }

    const status = body.status
    if (typeof status !== 'string' || !ALLOWED_STATUSES.has(status)) {
      return reply.badRequest('status is required and must be a valid status')
    }

    const existing = app.db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.provider, provider), eq(jobs.providerJobId, providerJobId)))
      .get()
    if (existing) {
      return reply.conflict('Job already imported')
    }

    const tsCol = timestampColumn(status as JobStatusValue)
    const atValue = body.at ?? new Date().toISOString()

    let base: {
      provider: 'seek' | 'linkedin'
      providerJobId: string
      title: string
      companyName: string
      url: string
      location: string
      workplaceType: string | null
      employmentType: string | null
      postedAt: string | null
      description: string | null
      status: string
    }

    if (provider === 'seek') {
      const html = await htmlFetch(url)
      if (!html) {
        return reply.code(422).send('Could not fetch job page')
      }

      const detail = parseSeekJob(html, url)
      if (!detail) {
        return reply.code(422).send('Could not parse job page')
      }

      base = {
        provider: 'seek',
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
    } else {
      const linkedinDetail = await detail({ id: providerJobId })
      if (!linkedinDetail) {
        return reply.code(422).send('Could not fetch job page')
      }
      if (linkedinDetail.closed) {
        return reply.code(422).send('This job is no longer accepting applications')
      }

      base = {
        provider: 'linkedin',
        providerJobId: linkedinDetail.id,
        title: linkedinDetail.title,
        companyName: linkedinDetail.company ?? '',
        url: linkedinDetail.url,
        location: linkedinDetail.location ?? '',
        workplaceType: linkedinDetail.workplaceType,
        employmentType: normaliseEmploymentType(linkedinDetail.employmentType),
        postedAt: linkedinDetail.date,
        description: linkedinDetail.description ? toMarkdown(linkedinDetail.description) : null,
        status,
      }
    }

    const values = tsCol ? { ...base, [tsCol]: atValue } : base

    const inserted = app.db.insert(jobs).values(values).returning().get()

    app.publisher.publish(inserted.id, 'rank')

    return reply.code(201).send({ id: inserted.id, status, title: base.title })
  })
}

export default postJobImport
