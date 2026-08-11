/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { facts } from 'db'
import type { FastifyPluginAsync } from 'fastify'

import { toFactJson } from '../../serializers.js'

const VALID_CATEGORIES = ['skill', 'role', 'precedent_story', 'gap', 'credential', 'principle', 'constraint'] as const
const VALID_EVIDENCE_TYPES = ['fast_pivot', 'genuine_precedent', 'genuine_gap'] as const
const VALID_CONFIDENCES = ['stated', 'inferred', 'stretch'] as const

interface FactBody {
  label: string
  category: string
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
  required: ['label', 'category'],
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

const postFacts: FastifyPluginAsync = async app => {
  app.post('/', { schema: { body: bodySchema } }, async (req, reply) => {
    const { label, category, detail, evidenceType, startedAt, endedAt, period, confidence, active } =
      req.body as FactBody

    const row = app.db
      .insert(facts)
      .values({
        label,
        category,
        detail: detail ?? null,
        evidenceType: evidenceType ?? null,
        startedAt: startedAt ?? null,
        endedAt: endedAt ?? null,
        period: period ?? null,
        confidence: confidence ?? 'stated',
        active: active ?? true,
      })
      .returning()
      .get()

    return reply.code(201).send(toFactJson(row))
  })
}

export default postFacts
