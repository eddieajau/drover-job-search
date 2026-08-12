/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { pino } from 'pino'

/**
 * A pino logger whose records are persisted to the `logs` table. The
 * transport runs in a worker thread and opens its own better-sqlite3 handle
 * (the main-thread `db.$client` is not transferable across that boundary).
 */
export function createDbLogger(opts: { dbPath: string; scope?: string; level?: string }) {
  return pino({
    base: opts.scope ? { scope: opts.scope } : undefined,
    level: opts.level ?? 'info',
    transport: { target: './logger-transport.js', options: { dbPath: opts.dbPath } },
  })
}
