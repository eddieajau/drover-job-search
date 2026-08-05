/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import sensible from '@fastify/sensible'
import fastifyStatic from '@fastify/static'
import { config } from 'dotenv'
import fastify from 'fastify'

import { createDatabase } from './api/database.js'
import getJobs from './api/routes/jobs/index.js'
import getQueries from './api/routes/queries/index.js'
import postQuery from './api/routes/query/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..', '..', '..')

config({ path: join(rootDir, '.env') })

const PORT = Number(process.env.PORT) || 4000
const DEV = process.env.NODE_ENV !== 'production'

const app = fastify({ logger: { level: 'info' } })

await app.register(sensible)

const db = createDatabase()

await app.register(fastifyStatic, {
  root: resolve(__dirname, '../www'),
  prefix: '/',
})

await app.register(getJobs, { prefix: '/api/jobs', db })
await app.register(getQueries, { prefix: '/api/queries', db })
await app.register(postQuery, { prefix: '/api/query', db })

app.setNotFoundHandler((req, reply) => {
  if (req.url.startsWith('/api/')) {
    return reply.notFound()
  }
  return reply.sendFile('index.html')
})

await app.listen({ port: PORT, host: DEV ? '127.0.0.1' : '0.0.0.0' })
