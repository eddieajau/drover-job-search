/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { facts } from 'db'
import { eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

import { toFactJson } from '../../serializers.js'

const VALID_CATEGORIES = ['skill', 'role', 'precedent_story', 'gap', 'credential', 'principle'] as const
const VALID_EVIDENCE_TYPES = ['fast_pivot', 'genuine_precedent', 'genuine_gap'] as const
const VALID_CONFIDENCES = ['stated', 'inferred', 'stretch'] as const

interface PatchFactBody {
  label?: string
  category?: string
  detail?: string
  evidenceType?: string
  startedAt?: string
  endedAt?: string
  period?: string
  confidence?: string
  active?: boolean
}

const bodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    label: { type: 'string', minLength: 1 },
    category: { type: 'string', enum: [...VALID_CATEGORIES] },
    detail: { type: 'string' },
    evidenceType: { type: 'string', enum: [...VALID_EVIDENCE_TYPES] },
    startedAt: { type: 'string' },
    endedAt: { type: 'string' },
    period: { type: 'string' },
    confidence: { type: 'string', enum: [...VALID_CONFIDENCES] },
    active: { type: 'boolean' },
  },
} as const

const patchFact: FastifyPluginAsync = async app => {
  app.patch('/:id', { schema: { body: bodySchema } }, async (req, reply) => {
    const factId = Number.parseInt((req.params as { id: string }).id, 10)
    if (!Number.isInteger(factId) || factId <= 0) {
      return reply.badRequest('Invalid path parameter: id')
    }

    const existing = app.db.select().from(facts).where(eq(facts.id, factId)).get()
    if (!existing) {
      return reply.notFound(`Fact ${factId} not found`)
    }

    const body = req.body as PatchFactBody
    const values: Partial<typeof facts.$inferInsert> = {}

    if (body.label !== undefined) values.label = body.label
    if (body.category !== undefined) values.category = body.category
    if (body.detail !== undefined) values.detail = body.detail
    if (body.evidenceType !== undefined) values.evidenceType = body.evidenceType
    if (body.startedAt !== undefined) values.startedAt = body.startedAt
    if (body.endedAt !== undefined) values.endedAt = body.endedAt
    if (body.period !== undefined) values.period = body.period
    if (body.confidence !== undefined) values.confidence = body.confidence
    if (body.active !== undefined) values.active = body.active

    app.db.update(facts).set(values).where(eq(facts.id, factId)).run()

    const row = app.db.select().from(facts).where(eq(facts.id, factId)).get()
    if (!row) {
      return reply.internalServerError('Failed to reload fact')
    }
    return toFactJson(row)
  })
}

export default patchFact
