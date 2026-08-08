/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { type DB } from 'db'
import { build, createTestDb, seedFact } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import getFacts from './getFacts.js'

describe('GET /api/facts', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(getFacts, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('returns all facts ordered by id', async () => {
    seedFact(db, { category: 'skill', label: 'TypeScript' })
    seedFact(db, { category: 'role', label: 'Tech Lead' })

    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(2)
    expect(body[0]).toMatchObject({ category: 'skill', label: 'TypeScript' })
    expect(body[1]).toMatchObject({ category: 'role', label: 'Tech Lead' })
  })

  it('filters by id', async () => {
    const inserted = seedFact(db, { category: 'skill', label: 'TypeScript' })

    const res = await app.inject({ method: 'GET', url: `/?id=${inserted.id}` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ id: inserted.id, label: 'TypeScript' })
  })

  it('returns 404 for an unknown id', async () => {
    const res = await app.inject({ method: 'GET', url: '/?id=999' })
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for an invalid id', async () => {
    const res = await app.inject({ method: 'GET', url: '/?id=abc' })
    expect(res.statusCode).toBe(400)
  })

  it('filters by category', async () => {
    seedFact(db, { category: 'skill', label: 'TypeScript' })
    seedFact(db, { category: 'role', label: 'Tech Lead' })

    const res = await app.inject({ method: 'GET', url: '/?category=skill' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(1)
    expect(body[0].label).toBe('TypeScript')
  })

  it('returns 400 for an invalid category', async () => {
    const res = await app.inject({ method: 'GET', url: '/?category=bogus' })
    expect(res.statusCode).toBe(400)
  })

  it('filters by active', async () => {
    seedFact(db, { category: 'skill', label: 'Active Skill', active: true })
    seedFact(db, { category: 'skill', label: 'Inactive Skill', active: false })

    const res = await app.inject({ method: 'GET', url: '/?active=1' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(1)
    expect(body[0].label).toBe('Active Skill')
  })

  it('returns 400 for an invalid active value', async () => {
    const res = await app.inject({ method: 'GET', url: '/?active=yes' })
    expect(res.statusCode).toBe(400)
  })

  it('searches by q on label and detail', async () => {
    seedFact(db, { category: 'skill', label: 'TypeScript', detail: '5 years experience' })
    seedFact(db, { category: 'skill', label: 'Python', detail: 'TypeScript migration' })
    seedFact(db, { category: 'role', label: 'Tech Lead' })

    const res = await app.inject({ method: 'GET', url: '/?q=TypeScript' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(2)
  })
})
