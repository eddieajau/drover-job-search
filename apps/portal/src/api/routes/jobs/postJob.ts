/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { randomUUID } from 'node:crypto'

import { jobs, jobStatusEvents } from 'db'
import type { FastifyPluginAsync } from 'fastify'

const STATUS_VALUES = [
  'applied',
  'interviewing',
  'skipped',
  'blocked',
  'declined',
  'unsuccessful',
  'successful',
] as const
type Status = (typeof STATUS_VALUES)[number]

const bodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'companyName', 'location', 'status'],
  properties: {
    title: { type: 'string' },
    companyName: { type: 'string' },
    url: { type: 'string' },
    location: { type: 'string' },
    workplaceType: { type: 'string', enum: ['onsite', 'hybrid', 'remote'] },
    employmentType: { type: 'string', enum: ['full-time', 'part-time', 'contract', 'temporary', 'casual', 'other'] },
    postedAt: { type: 'string', format: 'date' },
    description: { type: 'string' },
    status: { type: 'string', enum: [...STATUS_VALUES] },
    at: { type: 'string', format: 'date' },
  },
} as const

type ManualBody = {
  title: string
  companyName: string
  url?: string
  location: string
  workplaceType?: string
  employmentType?: string
  postedAt?: string
  description?: string
  status: Status
  at?: string
}

const postJob: FastifyPluginAsync = async app => {
  app.post('/', { schema: { body: bodySchema } }, async (req, reply) => {
    const { status, at, url: rawUrl, ...fields } = req.body as ManualBody

    const providerJobId = randomUUID().replace(/-/g, '')
    const url = rawUrl || `manual://${providerJobId}`

    const atValue = at ?? new Date().toISOString().slice(0, 10)
    const isTerminal = status === 'successful' || status === 'unsuccessful' || status === 'skipped'

    const values = {
      provider: 'manual' as const,
      providerJobId,
      title: fields.title,
      companyName: fields.companyName,
      url,
      location: fields.location,
      workplaceType: fields.workplaceType ?? null,
      employmentType: fields.employmentType ?? null,
      postedAt: fields.postedAt ?? null,
      description: fields.description ?? null,
      status,
      ...(isTerminal ? { closedAt: atValue } : {}),
    }

    const inserted = app.db.transaction(tx => {
      const row = tx.insert(jobs).values(values).returning().get()

      tx.insert(jobStatusEvents)
        .values({
          jobId: row.id,
          status,
          occurredAt: atValue,
          actor: 'human',
          note: null,
        })
        .run()

      return row
    })

    app.publisher.publish(inserted.id, 'rank')

    return reply.code(201).send({ id: inserted.id, status, title: fields.title })
  })
}

export default postJob
