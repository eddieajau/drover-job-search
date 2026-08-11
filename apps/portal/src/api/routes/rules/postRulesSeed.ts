/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { facts, signalRules } from 'db'
import { and, eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'
import { recomputeRule, rulesFromGapFacts } from 'signal-engine'

const postRulesSeed: FastifyPluginAsync = async app => {
  app.post('/seed-from-facts', async (_req, reply) => {
    const gapFacts = app.db
      .select()
      .from(facts)
      .where(and(eq(facts.category, 'gap'), eq(facts.active, true)))
      .all()
    const existing = app.db.select({ ruleName: signalRules.ruleName }).from(signalRules).all()
    const drafts = rulesFromGapFacts(
      gapFacts,
      existing.map(row => row.ruleName)
    )

    let created = 0
    for (const draft of drafts) {
      const row = app.db.insert(signalRules).values(draft).returning().get()
      recomputeRule(app.db, row)
      created++
    }

    return reply.code(201).send({ created })
  })
}

export default postRulesSeed
