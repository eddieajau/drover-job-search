/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { basename } from 'node:path'

import { crawls, createDbLogger, jobs, queries } from 'db'
import { desc, eq } from 'drizzle-orm'
import { search, selectJobage } from 'provider-linkedin'

import { openDb, resolveDbPath } from '../env.js'

export async function runCrawl(_args: string[]): Promise<void> {
  const dbFile = resolveDbPath()
  const log = createDbLogger({ dbPath: dbFile, scope: 'crawler', level: process.env.LOG_LEVEL ?? 'info' })
  log.info({ database: basename(dbFile) }, 'DATABASE')

  const db = openDb()

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
        queryId: query.id,
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
