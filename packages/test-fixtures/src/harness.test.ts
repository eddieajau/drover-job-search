import { jobs, type DB } from 'db'
import type { FastifyPluginAsync } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { build, createTestDb, mockLogger, seedDatabase } from './index.js'

const stubRoute: FastifyPluginAsync = async fastify => {
  fastify.get('/ping', async () => ({ ok: true }))
  fastify.get('/boom', async (_request, reply) => reply.badRequest('nope'))
  fastify.get('/count', async () => ({
    jobs: fastify.db.select().from(jobs).all().length,
  }))
}

const paramRoute: FastifyPluginAsync = async fastify => {
  fastify.get('/', async request => {
    const { id } = request.params as { id: string }
    return { id }
  })
}

describe('build', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = seedDatabase(createTestDb())
    app = await build(stubRoute, { db })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('returns a ready instance whose route is injectable at its path', async () => {
    const response = await app.inject({ method: 'GET', url: '/ping' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ok: true })
  })

  it('registers fastifySensible reply helpers', async () => {
    const response = await app.inject({ method: 'GET', url: '/boom' })
    expect(response.statusCode).toBe(400)
    expect(response.json().message).toBe('nope')
  })

  it('decorates fastify.db with the supplied database', async () => {
    expect(app.db).toBe(db)
    const response = await app.inject({ method: 'GET', url: '/count' })
    expect(response.json()).toEqual({ jobs: 2 })
  })

  it('decorates fastify.bus with an EventEmitter', () => {
    expect(app.bus).toBeDefined()
  })

  it('registers the route under an optional prefix so route params reach the handler', async () => {
    const prefixed = await build(paramRoute, { db, prefix: '/jobs/:id' })
    const response = await prefixed.inject({ method: 'GET', url: '/jobs/42' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ id: '42' })
    await prefixed.close()
  })
})

describe('mockLogger', () => {
  it('records calls on each level', () => {
    const logger = mockLogger()
    logger.error('boom')
    expect(logger.error).toHaveBeenCalledOnce()
    expect(logger.error).toHaveBeenCalledWith('boom')
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('spawns fresh child loggers', () => {
    const logger = mockLogger()
    const child = logger.child({ requestId: 'r1' })
    expect(child).not.toBe(logger)
    child.info('child logged')
    expect(child.info).toHaveBeenCalledWith('child logged')
    expect(logger.info).not.toHaveBeenCalled()
  })
})
