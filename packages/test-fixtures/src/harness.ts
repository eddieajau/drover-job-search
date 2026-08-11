import { EventEmitter } from 'node:events'

import Sensible from '@fastify/sensible'
import { type DB } from 'db'
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import Fastify from 'fastify'
import { vi } from 'vitest'
import { createPublisher, type Publisher } from 'workers'

type BusEventName = 'kick'
type BusEvents = Record<BusEventName, [payload: { topic: 'fetch_job_details' | 'rank' | 'slice_resume' }]>

declare module 'fastify' {
  interface FastifyInstance {
    db: DB
    bus: EventEmitter<BusEvents>
    publisher: Publisher
  }
}

export async function build(route: FastifyPluginAsync, options: { db: DB; prefix?: string }): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(Sensible)
  app.decorate('db', options.db)
  const bus = new EventEmitter<BusEvents>()
  app.decorate('bus', bus)
  app.decorate(
    'publisher',
    createPublisher({ db: options.db, onEnqueue: (_jobId, topic) => bus.emit('kick', { topic }) })
  )
  if (options.prefix === undefined) {
    await app.register(route)
  } else {
    await app.register(route, { prefix: options.prefix })
  }
  await app.ready()
  return app
}

export function mockLogger() {
  return {
    fatal: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(() => mockLogger()),
  }
}

export type MockLogger = ReturnType<typeof mockLogger>
