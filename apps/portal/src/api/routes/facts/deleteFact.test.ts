/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { facts, type DB } from 'db'
import { eq } from 'drizzle-orm'
import { build, createTestDb, seedFact } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import deleteFact from './deleteFact.js'

describe('DELETE /api/facts/:id', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(deleteFact, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('deletes a fact and returns 204', async () => {
    const inserted = seedFact(db, { category: 'skill', label: 'TypeScript' })

    const res = await app.inject({ method: 'DELETE', url: `/${inserted.id}` })
    expect(res.statusCode).toBe(204)

    const row = db.select().from(facts).where(eq(facts.id, inserted.id)).get()
    expect(row).toBeUndefined()
  })

  it('returns 404 for an unknown id', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/999' })
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for an invalid id', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/abc' })
    expect(res.statusCode).toBe(400)
  })
})
