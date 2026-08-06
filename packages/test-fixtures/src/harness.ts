import Sensible from '@fastify/sensible'
import { type DB } from 'db'
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import Fastify from 'fastify'
import { vi } from 'vitest'

declare module 'fastify' {
  interface FastifyInstance {
    db: DB
  }
}

export async function build(route: FastifyPluginAsync, options: { db: DB; prefix?: string }): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(Sensible)
  app.decorate('db', options.db)
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
