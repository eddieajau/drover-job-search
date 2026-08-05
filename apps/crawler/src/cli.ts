/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { eq } from 'drizzle-orm'
import { createDb, queries } from 'db'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { search } from 'provider-linkedin'

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
      console.log(`[${query.id}] ${query.queryText} (enabled: ${query.enabled})`)

      // Parse JSON string safely
      const options = query.queryOptions ? JSON.parse(query.queryOptions) : {}
      console.log(options)

      const result = await search({
        query: query.queryText,
        location: options.location,
        jobage: 14,
        workType: options.workType,
        jobType: options.jobType,
        pages: 10,
      })
      console.log('result', result)
    }
  }

  db.$client.close()
}

main().catch(err => {
  console.error('FATAL ERROR', err)
  process.exit(1)
})
