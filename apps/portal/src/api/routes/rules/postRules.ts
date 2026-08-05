/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { signalRules, type DB } from 'db'
import { asc, eq, notInArray } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

import { toRuleJson } from '../../serializers.js'

interface RulesRouteOptions {
  db: DB
}

interface RuleBody {
  id?: number
  ruleName: string
  ruleCategory: string
  pattern: string
  scoreModifier?: number
  enabled?: boolean
}

const ruleSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ruleName', 'ruleCategory', 'pattern'],
  properties: {
    id: { type: 'integer' },
    ruleName: { type: 'string', minLength: 1 },
    ruleCategory: { type: 'string', enum: ['regex_title', 'regex_company', 'regex_description'] },
    pattern: { type: 'string', minLength: 1 },
    scoreModifier: { type: 'integer' },
    enabled: { type: 'boolean' },
  },
} as const

const bodySchema = {
  type: 'array',
  items: ruleSchema,
} as const

const postRules: FastifyPluginAsync<RulesRouteOptions> = async (app, { db }) => {
  app.post('/', { schema: { body: bodySchema } }, async req => {
    const rules = req.body as RuleBody[]
    const keptIds = new Set<number>()

    for (const rule of rules) {
      const { id, ruleName, ruleCategory, pattern, scoreModifier, enabled } = rule

      if (id !== undefined) {
        const existing = db.select().from(signalRules).where(eq(signalRules.id, id)).get()
        if (!existing) {
          continue
        }
        db.update(signalRules)
          .set({
            ruleName,
            ruleCategory,
            pattern,
            scoreModifier: scoreModifier ?? existing.scoreModifier,
            enabled: enabled ?? existing.enabled,
          })
          .where(eq(signalRules.id, id))
          .run()
        keptIds.add(id)
        continue
      }

      const row = db
        .insert(signalRules)
        .values({
          ruleName,
          ruleCategory,
          pattern,
          scoreModifier: scoreModifier ?? 0,
          enabled: enabled ?? true,
        })
        .returning()
        .get()
      keptIds.add(row.id)
    }

    if (keptIds.size === 0) {
      db.delete(signalRules).run()
    } else {
      db.delete(signalRules)
        .where(notInArray(signalRules.id, [...keptIds]))
        .run()
    }

    const rows = db.select().from(signalRules).orderBy(asc(signalRules.id)).all()
    return rows.map(toRuleJson)
  })
}

export default postRules
