/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDb } from 'db'
import { pino } from 'pino'

import { runEnabledRules } from './rules.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..', '..', '..')

process.loadEnvFile(join(rootDir, '.env'))

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })

async function main() {
  const dbPath = process.env.DATABASE

  if (!dbPath) throw new Error('DATABASE path empty')
  log.info({ database: isAbsolute(dbPath) ? dbPath : join(rootDir, dbPath) }, 'DATABASE')

  const db = createDb(isAbsolute(dbPath) ? dbPath : join(rootDir, dbPath))

  const summary = runEnabledRules(db, log)

  if (Object.keys(summary).length === 0) {
    log.warn('No enabled signal rules found')
  } else {
    for (const [ruleName, matched] of Object.entries(summary)) {
      log.info({ rule_name: ruleName, matched }, 'rule applied')
    }
  }

  db.$client.close()
}

main().catch(err => {
  log.fatal(err, 'fatal error')
  process.exit(1)
})
