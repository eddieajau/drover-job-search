/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { basename, dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDb } from 'db'
import { pino } from 'pino'

import { evaluateJob, selectJobsForEval } from './evaluate.js'
import { createOllamaClient } from './ollama.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..', '..', '..')

process.loadEnvFile(join(rootDir, '.env'))

const log = pino({ base: undefined, level: process.env.LOG_LEVEL ?? 'info' })

async function main() {
  const dbPath = process.env.DATABASE

  if (!dbPath) throw new Error('DATABASE path empty')
  log.info({ database: basename(dbPath) }, 'DATABASE')

  const db = createDb(isAbsolute(dbPath) ? dbPath : join(rootDir, dbPath))
  const client = createOllamaClient(process.env.OLLAMA_BASE_URL, process.env.OLLAMA_MODEL, log)

  const pending = selectJobsForEval(db)
  log.info({ pending: pending.length }, 'jobs to evaluate')

  let written = 0
  let skipped = 0

  for (const job of pending) {
    const result = await evaluateJob(db, job.id, client, log)
    if (result === 'written') written++
    else skipped++
  }

  log.info({ written, skipped, total: pending.length }, 'inference complete')
  db.$client.close()
}

main().catch(err => {
  log.fatal(err, 'fatal error')
  process.exit(1)
})
