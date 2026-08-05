/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDb } from './connection.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..', '..', '..')

process.loadEnvFile(join(rootDir, '.env'))

const dbPath = process.env.DATABASE ?? 'drover.db'
const fullPath = isAbsolute(dbPath) ? dbPath : join(rootDir, dbPath)

const db = createDb(fullPath)
db.$client.close()

console.log(`Schema applied to ${fullPath}`)
