/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { basename, dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDb } from 'db'
import { pino } from 'pino'
import { rankJobDetails } from 'workers'

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
  const client = rankJobDetails.createOllamaClient(process.env.OLLAMA_BASE_URL, process.env.OLLAMA_MODEL, log)

  const { written, skipped } = await rankJobDetails.drain(db, {
    client,
    onProgress: row => log.debug({ jobId: row.jobId, title: row.title }, 'evaluated'),
    onError: (row, err) =>
      log.warn({ jobId: row.jobId, err: err instanceof Error ? err.message : err }, 'inference skipped'),
  })
  log.info({ written, skipped }, 'inference complete')
  db.$client.close()
}

main().catch(err => {
  log.fatal(err, 'fatal error')
  process.exit(1)
})
