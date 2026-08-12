/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import Database from 'better-sqlite3'
import build from 'pino-abstract-transport'

export function toBody(record: Record<string, unknown>): string {
  const { level: _level, time, ...rest } = record
  return JSON.stringify({ time, ...rest })
}

export default async function (opts: { dbPath: string }) {
  const db = new Database(opts.dbPath)
  db.pragma('journal_mode = WAL')
  const insert = db.prepare('INSERT INTO logs (level, body) VALUES (?, ?)')
  return build(
    async function (source: AsyncIterable<Record<string, unknown>>) {
      for await (const record of source) {
        insert.run(Number(record.level), toBody(record))
      }
    },
    {
      close: async () => {
        db.close()
      },
    }
  )
}
