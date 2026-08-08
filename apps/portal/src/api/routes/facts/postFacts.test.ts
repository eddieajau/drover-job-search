/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { type DB } from 'db'
import { build, createTestDb } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import postFacts from './postFacts.js'

describe('POST /api/facts', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(postFacts, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('creates a fact', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { label: 'TypeScript', category: 'skill', detail: '5 years' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({
      label: 'TypeScript',
      category: 'skill',
      detail: '5 years',
      confidence: 'stated',
      active: true,
    })
  })

  it('creates a fact with all optional fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        label: 'Tech Lead',
        category: 'role',
        detail: 'Led team of 8',
        evidenceType: 'genuine_precedent',
        startedAt: '2020-01',
        endedAt: '2023-06',
        period: '3.5 years',
        confidence: 'inferred',
        active: false,
      },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({
      label: 'Tech Lead',
      category: 'role',
      evidenceType: 'genuine_precedent',
      startedAt: '2020-01',
      endedAt: '2023-06',
      period: '3.5 years',
      confidence: 'inferred',
      active: false,
    })
  })

  it('rejects a missing label', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { category: 'skill' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects a missing category', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { label: 'TypeScript' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects an invalid category', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { label: 'TypeScript', category: 'bogus' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects an empty label', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { label: '', category: 'skill' },
    })
    expect(res.statusCode).toBe(400)
  })
})
