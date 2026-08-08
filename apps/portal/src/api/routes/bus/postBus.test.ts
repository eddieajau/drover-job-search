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

  it('emits flagged with the jobId 0 sentinel', async () => {
    let received: { jobId: number } | undefined
    app.bus.on('flagged', payload => {
      received = payload
    })

    const res = await app.inject({ method: 'POST', url: '/', payload: { event: 'flagged' } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, event: 'flagged' })
    expect(received).toEqual({ jobId: 0 })
  })

  it('emits descriptions-ready with the jobId 0 sentinel', async () => {
    let received: { jobId: number } | undefined
    app.bus.on('descriptions-ready', payload => {
      received = payload
    })

    const res = await app.inject({ method: 'POST', url: '/', payload: { event: 'descriptions-ready' } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, event: 'descriptions-ready' })
    expect(received).toEqual({ jobId: 0 })
  })

  it('rejects an unknown event name', async () => {
    const res = await app.inject({ method: 'POST', url: '/', payload: { event: 'nonsense' } })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('Invalid body: event must be "flagged" or "descriptions-ready"')
  })

  it('rejects a request without an event', async () => {
    const res = await app.inject({ method: 'POST', url: '/', payload: {} })
    expect(res.statusCode).toBe(400)
  })

  it('rejects a request without a body', async () => {
    const res = await app.inject({ method: 'POST', url: '/' })
    expect(res.statusCode).toBe(400)
  })
})
