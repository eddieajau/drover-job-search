/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { basename, dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDb, createDbLogger, crawls, jobs, queries } from 'db'
import { desc, eq } from 'drizzle-orm'
import { detail, search, selectJobage } from 'provider-linkedin'
import { fetchJobDetails } from 'workers'

// Resolves .env from the root directory relative to this file
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..', '..', '..')

process.loadEnvFile(join(rootDir, '.env'))

async function main() {
  const args = process.argv.slice(2)
  const isDetail = args.includes('--detail')
  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 10

  const dbPath = process.env.DATABASE

  if (!dbPath) throw new Error('DATABASE path empty')

  const dbFile = isAbsolute(dbPath) ? dbPath : join(rootDir, dbPath)
  const log = createDbLogger({ dbPath: dbFile, scope: 'crawler', level: process.env.LOG_LEVEL ?? 'info' })
  log.info({ database: basename(dbPath) }, 'DATABASE')

  const db = createDb(dbFile)

  if (isDetail) {
    const { processed, failed, skipped } = await fetchJobDetails.drain(db, {
      detailFn: detail,
      limit,
      onProgress: row => log.info({ providerJobId: row.providerJobId }, 'description saved'),
      onError: (row, err) =>
        err === null
          ? log.warn({ providerJobId: row.providerJobId }, 'no description returned; marked done')
          : log.error({ providerJobId: row.providerJobId, err }, 'detail fetch failed; marked done'),
      onSkip: (row, reason) => log.info({ providerJobId: row.providerJobId, reason }, 'job skipped'),
    })
    log.info({ processed, failed, skipped }, 'detail crawl complete')
    await new Promise<void>(resolve => log.flush(() => resolve()))
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
      const anchor = lastCrawl?.crawledAt
      const jobage = selectJobage(anchor)
      log.info({ window: jobage, anchor: anchor ?? 'none' }, 'window')

      const result = await search({
        query: query.queryText,
        location: options.location,
        jobage,
        workType: options.workType,
        jobType: options.jobType,
        strictWorkType: options.strictWorkType,
        pages: 10,
        logger: log,
      })

      const rows = result.results.map(card => ({
        provider: query.provider,
        providerJobId: card.id,
        title: card.title,
        companyName: card.company ?? '',
        url: card.url,
        location: card.location ?? '',
        postedAt: card.date ?? null,
        workplaceType: card.workplace ?? null,
        status: 'new',
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

  await new Promise<void>(resolve => log.flush(() => resolve()))
  db.$client.close()
}

main().catch(err => {
  console.error('fatal error:', err)
  process.exit(1)
})
