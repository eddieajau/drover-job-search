/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { signalRules, type DB } from 'db'
import { asc } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

import { toRuleJson } from '../../serializers.js'

interface RulesRouteOptions {
  db: DB
}

const getRules: FastifyPluginAsync<RulesRouteOptions> = async (app, { db }) => {
  app.get('/', async () => {
    const rows = db.select().from(signalRules).orderBy(asc(signalRules.id)).all()
    return rows.map(toRuleJson)
  })
}

export default getRules
