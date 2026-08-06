/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { type DB } from 'db'
import { build, createTestDb, RULE_JAVA, seedDatabase, seedRule } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import getRules from './getRules.js'

describe('GET /api/rules', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(getRules, { db, prefix: '/' })
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
    seedDatabase(db)
    seedRule(db, { ruleName: 'Blockchain', ruleCategory: 'regex_description', pattern: '(?i)\\bblockchain\\b' })

    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(3)
    expect(body.map((rule: { id: number }) => rule.id)).toEqual([1, 2, 3])
    expect(body[0]).toMatchObject({
      ...RULE_JAVA,
      enabled: true,
    })
  })
})
