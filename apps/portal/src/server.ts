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
import fastify from 'fastify'
import { detail } from 'provider-linkedin'
import {
  createFetchJobDetailsConsumer,
  createPublisher,
  createRankConsumer,
  createRunSignalRulesConsumer,
  createSliceConsumer,
  type Publisher,
} from 'workers'

import { createDatabase } from './api/database.js'
import type { BusEvents } from './bus.js'

declare module 'fastify' {
  interface FastifyInstance {
    db: DB
    bus: EventEmitter<BusEvents>
    queues: Publisher
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..', '..', '..')

process.loadEnvFile(join(rootDir, '.env'))

const PORT = Number(process.env.PORT) || 4000
const DEV = process.env.NODE_ENV !== 'production'

const app = fastify({ logger: { base: undefined, level: 'info' } })

await app.register(sensible)

const db = createDatabase()
app.decorate('db', db)

const bus = new EventEmitter<BusEvents>()
app.decorate('bus', bus)

const publisher = createPublisher({
  db,
  onEnqueue: (_jobId, topic) => bus.emit('kick', { topic }),
})
app.decorate('publisher', publisher)

const details = createFetchJobDetailsConsumer({
  db,
  log: app.log,
  detailFn: detail,
  onDrained: () => bus.emit('kick', { topic: 'rank' }),
})
const onKickDetails = ({ topic }: { topic: string }) => {
  if (topic === 'fetch_job_details') details.kick()
}
bus.on('kick', onKickDetails)
app.addHook('onClose', () => {
  bus.off('kick', onKickDetails)
  details.stop()
})
bus.emit('kick', { topic: 'fetch_job_details' })

const rank = createRankConsumer({
  db,
  log: app.log,
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
  ollamaModel: process.env.OLLAMA_MODEL,
})
const onKickRank = ({ topic }: { topic: string }) => {
  if (topic === 'rank') rank.kick()
}
bus.on('kick', onKickRank)
app.addHook('onClose', () => {
  bus.off('kick', onKickRank)
  rank.stop()
})
bus.emit('kick', { topic: 'rank' })

const signalRules = createRunSignalRulesConsumer({
  db,
  log: app.log,
  onDrained: () => bus.emit('kick', { topic: 'rank' }),
})
const onKickSignalRules = ({ topic }: { topic: string }) => {
  if (topic === 'run_signal_rules') signalRules.kick()
}
bus.on('kick', onKickSignalRules)
app.addHook('onClose', () => {
  bus.off('kick', onKickSignalRules)
  signalRules.stop()
})
bus.emit('kick', { topic: 'run_signal_rules' })

const slice = createSliceConsumer({
  db,
  log: app.log,
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
  ollamaModel: process.env.OLLAMA_MODEL,
})
const onKickSlice = ({ topic }: { topic: string }) => {
  if (topic === 'slice_resume') slice.kick()
}
bus.on('kick', onKickSlice)
app.addHook('onClose', () => {
  bus.off('kick', onKickSlice)
  slice.stop()
})
bus.emit('kick', { topic: 'slice_resume' })

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
