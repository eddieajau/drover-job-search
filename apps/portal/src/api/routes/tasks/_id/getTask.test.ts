/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { tasks, type DB } from 'db'
import { eq } from 'drizzle-orm'
import { build, createTestDb } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import getTask from './getTask.js'

describe('GET /api/tasks/:id', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(getTask, { db, prefix: '/:id' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('returns the task state with a parsed result', async () => {
    const { id } = db.insert(tasks).values({ topic: 'slice_resume' }).returning().get()
    db.update(tasks).set({ result: '{"inserted":3,"superseded":1}' }).where(eq(tasks.id, id)).run()

    const res = await app.inject({ method: 'GET', url: `/${id}` })
    expect(res.json().message).toBeUndefined()
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      id,
      topic: 'slice_resume',
      result: { inserted: 3, superseded: 1 },
    })
  })

  it('reports a pending task with a null result', async () => {
    const { id } = db.insert(tasks).values({ topic: 'slice_resume' }).returning().get()

    const res = await app.inject({ method: 'GET', url: `/${id}` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ id, topic: 'slice_resume', completedAt: null, result: null })
  })

  it('reports a failed task with its error message', async () => {
    const { id } = db.insert(tasks).values({ topic: 'slice_resume' }).returning().get()
    db.update(tasks).set({ errorMessage: 'passes failed to parse after retry' }).where(eq(tasks.id, id)).run()

    const res = await app.inject({ method: 'GET', url: `/${id}` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ id, errorMessage: 'passes failed to parse after retry' })
  })

  it('returns 400 on a non-integer id', async () => {
    const res = await app.inject({ method: 'GET', url: '/abc' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 for an unknown id', async () => {
    const res = await app.inject({ method: 'GET', url: '/999' })
    expect(res.statusCode).toBe(404)
  })
})
