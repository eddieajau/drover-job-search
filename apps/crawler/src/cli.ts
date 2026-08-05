/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { desc, eq, max } from 'drizzle-orm'
import { createDb, crawls, jobs, queries } from 'db'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { search, selectJobage } from 'provider-linkedin'

// Resolves .env from the root directory relative to this file
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..', '..', '..')

process.loadEnvFile(join(rootDir, '.env'))

async function main() {
  const dbPath = process.env.DATABASE

  if (!dbPath) throw new Error('DATABASE path empty')
  console.log('DATABASE', isAbsolute(dbPath) ? dbPath : join(rootDir, dbPath))

  const db = createDb(isAbsolute(dbPath) ? dbPath : join(rootDir, dbPath))

  const qList = db.select().from(queries).where(eq(queries.enabled, true)).all()

  if (qList.length === 0) {
    console.log('No enabled queries found')
  } else {
    for (const query of qList) {
      console.log(`[${query.id}] ${query.queryText}`)

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
      console.log(`  window: ${jobage}d (anchor: ${anchor ?? 'none'})`)

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
      console.log(`  found ${rows.length}, inserted ${inserted}`)

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
  console.error('FATAL ERROR', err)
  process.exit(1)
})
