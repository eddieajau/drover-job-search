/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { basename, dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDb, crawls, jobs, queries } from 'db'
import { desc, eq, max } from 'drizzle-orm'
import { pino } from 'pino'
import { detail, search, selectJobage } from 'provider-linkedin'

import { processDetailQueue } from './process-detail.js'

// Resolves .env from the root directory relative to this file
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..', '..', '..')

process.loadEnvFile(join(rootDir, '.env'))

const log = pino({ base: undefined, level: process.env.LOG_LEVEL ?? 'info' })

async function main() {
  const args = process.argv.slice(2)
  const isDetail = args.includes('--detail')
  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 10

  const dbPath = process.env.DATABASE

  if (!dbPath) throw new Error('DATABASE path empty')
  log.info({ database: basename(dbPath) }, 'DATABASE')

  const db = createDb(isAbsolute(dbPath) ? dbPath : join(rootDir, dbPath))

  if (isDetail) {
    const { processed, failed } = await processDetailQueue(db, detail, limit, log)
    log.info({ processed, failed }, 'detail crawl complete')
    db.$client.close()
    return
  }

  const qList = db.select().from(queries).where(eq(queries.enabled, true)).all()

  if (qList.length === 0) {
    log.warn('No enabled queries found')
  } else {
    for (const query of qList) {
      log.info(`[${query.id}] ${query.queryText}`)

      // Parse JSON string safely
      const options = query.queryOptions ? JSON.parse(query.queryOptions) : {}

      const lastCrawl = db
        .select()
        .from(crawls)
        .where(eq(crawls.queryId, query.id))
        .orderBy(desc(crawls.id))
        .limit(1)
        .get()
      const fallbackAnchor = db
        .select({ latest: max(jobs.createdAt) })
        .from(jobs)
        .where(eq(jobs.provider, query.provider))
        .get()
      const anchor = lastCrawl?.crawledAt ?? fallbackAnchor?.latest
      const jobage = selectJobage(anchor)
      log.info({ window: jobage, anchor: anchor ?? 'none' }, 'window')

      const result = await search({
        query: query.queryText,
        location: options.location,
        jobage,
        workType: options.workType,
        jobType: options.jobType,
        pages: 10,
      })

      const rows = result.results.map(card => ({
        provider: query.provider,
        providerJobId: card.id,
        title: card.title,
        companyName: card.company ?? '',
        url: card.url,
        location: card.location ?? '',
        postedAt: card.date ?? null,
      }))
      const inserted = rows.length > 0 ? db.insert(jobs).values(rows).onConflictDoNothing().run().changes : 0
      log.info({ found: rows.length, inserted }, 'search complete')

      db.insert(crawls)
        .values({
          queryId: query.id,
          windowDays: jobage,
          foundCount: rows.length,
          insertedCount: inserted,
        })
        .run()
    }
  }

  db.$client.close()
}

main().catch(err => {
  log.fatal(err, 'fatal error')
  process.exit(1)
})
