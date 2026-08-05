/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import sensible from '@fastify/sensible'
import { createDb, signalRules, type DB } from 'db'
import fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import getRules from './getRules.js'

describe('GET /api/rules', () => {
  let db: DB
  let app: FastifyInstance

  beforeEach(async () => {
    db = createDb(':memory:')
    app = fastify()
    await app.register(sensible)
    await app.register(getRules, { db })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('returns an empty list when no rules exist', async () => {
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('returns all rules ordered by id', async () => {
    db.insert(signalRules)
      .values([
        { ruleName: 'Java', ruleCategory: 'regex_title', pattern: '(?i)\\bjava\\b', scoreModifier: 5 },
        { ruleName: 'Recruiter', ruleCategory: 'regex_company', pattern: '(?i)recruit', scoreModifier: -10 },
        { ruleName: 'Blockchain', ruleCategory: 'regex_description', pattern: '(?i)\\bblockchain\\b' },
      ])
      .run()

    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(3)
    expect(body.map((rule: { id: number }) => rule.id)).toEqual([1, 2, 3])
    expect(body[0]).toMatchObject({
      ruleName: 'Java',
      ruleCategory: 'regex_title',
      pattern: '(?i)\\bjava\\b',
      scoreModifier: 5,
      enabled: true,
    })
  })
})
