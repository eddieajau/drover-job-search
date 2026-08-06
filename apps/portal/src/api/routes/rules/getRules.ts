/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { signalRules } from 'db'
import { asc } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

import { toRuleJson } from '../../serializers.js'

const getRules: FastifyPluginAsync = async app => {
  app.get('/', async () => {
    const rows = app.db.select().from(signalRules).orderBy(asc(signalRules.id)).all()
    return rows.map(toRuleJson)
  })
}

export default getRules
