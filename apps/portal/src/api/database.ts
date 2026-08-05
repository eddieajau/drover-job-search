/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { createDb, type DB } from 'db'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const rootDir = join(here, '..', '..', '..', '..')

export function resolveDatabasePath(): string {
  const dbPath = process.env.DATABASE
  if (!dbPath) {
    throw new Error('DATABASE path empty')
  }
  return isAbsolute(dbPath) ? dbPath : join(rootDir, dbPath)
}

export function createDatabase(dbPath = resolveDatabasePath()): DB {
  return createDb(dbPath)
}
