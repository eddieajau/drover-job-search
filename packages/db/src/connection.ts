/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import { analysisQueue, crawls, documents, jobSignals, jobs, queries, signalRules, tasks, TABLE_DDL } from './schema.js'

const SCHEMA = { queries, jobs, crawls, signalRules, jobSignals, analysisQueue, documents, tasks }

export type DB = ReturnType<typeof drizzle<typeof SCHEMA>>

export function createDb(dbPath: string): DB {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- better-sqlite3 Database lacks schema index signature
  const rawDb = new Database(dbPath) as any
  rawDb.pragma('journal_mode = WAL')
  rawDb.pragma('foreign_keys = ON')
  rawDb.exec(TABLE_DDL)
  return drizzle(rawDb, { schema: SCHEMA })
}
