/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDb, type DB } from 'db'

// Resolves .env and DATABASE paths from the repo root, three levels up
// from apps/cli/src/env.ts.
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
export const rootDir = join(__dirname, '..', '..', '..')

process.loadEnvFile(join(rootDir, '.env'))

export function resolveDbPath(): string {
  const dbPath = process.env.DATABASE
  if (!dbPath) throw new Error('DATABASE path empty')
  return isAbsolute(dbPath) ? dbPath : join(rootDir, dbPath)
}

export function openDb(): DB {
  return createDb(resolveDbPath())
}
