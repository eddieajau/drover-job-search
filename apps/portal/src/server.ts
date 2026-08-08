/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { EventEmitter } from 'node:events'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import fastifyAutoload from '@fastify/autoload'
import sensible from '@fastify/sensible'
import fastifyStatic from '@fastify/static'
import { type DB } from 'db'
import { config } from 'dotenv'
import fastify from 'fastify'
import { createQueueService, type QueueService } from 'workers'

import { createDatabase } from './api/database.js'
import type { BusEvents } from './bus.js'
import { startDetailsWorker } from './workers/details-worker.js'
import { startRankWorker } from './workers/rank-worker.js'

declare module 'fastify' {
  interface FastifyInstance {
    db: DB
    bus: EventEmitter<BusEvents>
    queues: QueueService
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..', '..', '..')

config({ path: join(rootDir, '.env') })

const PORT = Number(process.env.PORT) || 4000
const DEV = process.env.NODE_ENV !== 'production'

const app = fastify({ logger: { base: undefined, level: 'info' } })

await app.register(sensible)

const db = createDatabase()
app.decorate('db', db)

const bus = new EventEmitter<BusEvents>()
app.decorate('bus', bus)

const queues = createQueueService({
  db,
  onEnqueue: (jobId, _stage) => bus.emit('flagged', { jobId }),
})
app.decorate('queues', queues)

const stopDetailsWorker = startDetailsWorker(app.bus, db, app.log)
app.addHook('onClose', () => stopDetailsWorker())
bus.emit('flagged', { jobId: 0 })

const stopRankWorker = startRankWorker(app.bus, db, app.log)
app.addHook('onClose', () => stopRankWorker())
bus.emit('descriptions-ready', { jobId: 0 })

await app.register(fastifyStatic, {
  root: resolve(__dirname, '../www'),
  prefix: '/',
})

await app.register(fastifyAutoload, {
  dir: join(__dirname, 'api', 'routes'),
  routeParams: true,
  options: { prefix: '/api' },
  ignoreFilter: (path: string) => path.endsWith('.test.ts'),
})

app.setNotFoundHandler((req, reply) => {
  if (req.url.startsWith('/api/')) {
    return reply.notFound()
  }
  return reply.sendFile('index.html')
})

await app.listen({ port: PORT, host: DEV ? '127.0.0.1' : '0.0.0.0' })
