/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { basename } from 'node:path'

import { createDbLogger } from 'db'
import { detail } from 'provider-linkedin'
import { fetchJobDetails } from 'workers'

import { openDb, resolveDbPath } from '../env.js'

export async function runCrawlDetails(args: string[]): Promise<void> {
  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 10

  const dbFile = resolveDbPath()
  const log = createDbLogger({ dbPath: dbFile, scope: 'crawler', level: process.env.LOG_LEVEL ?? 'info' })
  log.info({ database: basename(dbFile) }, 'DATABASE')

  const db = openDb()

  const { processed, failed, skipped } = await fetchJobDetails.drain(db, {
    detailFn: detail,
    limit,
    onProgress: row => log.debug({ providerJobId: row.providerJobId }, 'description saved'),
    onError: (row, err) =>
      err === null
        ? log.warn({ providerJobId: row.providerJobId }, 'no description returned; marked done')
        : log.error({ providerJobId: row.providerJobId, err }, 'detail fetch failed; marked done'),
    onSkip: (row, reason) => log.debug({ providerJobId: row.providerJobId, reason }, 'job skipped'),
  })
  log.info({ processed, failed, skipped }, 'detail crawl complete')
  await new Promise<void>(resolve => log.flush(() => resolve()))
  db.$client.close()
}
