/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { basename } from 'node:path'

import { pino } from 'pino'
import { rankJobDetails } from 'workers'

import { openDb, resolveDbPath } from '../env.js'

export async function runInference(_args: string[]): Promise<void> {
  const dbFile = resolveDbPath()
  const log = pino({ base: undefined, level: process.env.LOG_LEVEL ?? 'info' })
  log.info({ database: basename(dbFile) }, 'DATABASE')

  const db = openDb()
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
