/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { type DB } from 'db'
import { build, createTestDb, seedFact } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import patchFact from './patchFact.js'

describe('PATCH /api/facts/:id', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(patchFact, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('updates supplied fields', async () => {
    const inserted = seedFact(db, { category: 'skill', label: 'TypeScript', detail: '3 years' })

    const res = await app.inject({
      method: 'PATCH',
      url: `/${inserted.id}`,
      payload: { label: 'Advanced TypeScript', active: false },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      id: inserted.id,
      label: 'Advanced TypeScript',
      detail: '3 years',
      active: false,
    })
  })

  it('returns 404 for an unknown id', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/999',
      payload: { label: 'x' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for an invalid id', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/abc',
      payload: { label: 'x' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns the reloaded row', async () => {
    const inserted = seedFact(db, { category: 'skill', label: 'TypeScript' })

    const res = await app.inject({
      method: 'PATCH',
      url: `/${inserted.id}`,
      payload: { confidence: 'inferred' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      id: inserted.id,
      label: 'TypeScript',
      confidence: 'inferred',
    })
  })
})
