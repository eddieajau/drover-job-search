/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { type DB } from 'db'
import { build, createTestDb } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import postBus from './postBus.js'

describe('POST /api/bus', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(postBus, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('emits kick with topic fetch_job_details', async () => {
    let received: { topic: string } | undefined
    app.bus.on('kick', payload => {
      received = payload
    })

    const res = await app.inject({ method: 'POST', url: '/', payload: { topic: 'fetch_job_details' } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, topic: 'fetch_job_details' })
    expect(received).toEqual({ topic: 'fetch_job_details' })
  })

  it('emits kick with topic rank', async () => {
    let received: { topic: string } | undefined
    app.bus.on('kick', payload => {
      received = payload
    })

    const res = await app.inject({ method: 'POST', url: '/', payload: { topic: 'rank' } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, topic: 'rank' })
    expect(received).toEqual({ topic: 'rank' })
  })

  it('rejects an unknown topic', async () => {
    const res = await app.inject({ method: 'POST', url: '/', payload: { topic: 'nonsense' } })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('Invalid body: topic must be "fetch_job_details" or "rank"')
  })

  it('rejects a legacy event-based body', async () => {
    const res = await app.inject({ method: 'POST', url: '/', payload: { event: 'flagged' } })
    expect(res.statusCode).toBe(400)
  })

  it('rejects a legacy stage body', async () => {
    const res = await app.inject({ method: 'POST', url: '/', payload: { stage: 'fetch_job_details' } })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('Invalid body: topic must be "fetch_job_details" or "rank"')
  })

  it('rejects a request without a topic', async () => {
    const res = await app.inject({ method: 'POST', url: '/', payload: {} })
    expect(res.statusCode).toBe(400)
  })

  it('rejects a request without a body', async () => {
    const res = await app.inject({ method: 'POST', url: '/' })
    expect(res.statusCode).toBe(400)
  })
})
