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
export interface DbLoggerOpts {
  dbPath: string
  scope?: string
  level?: string
  /** Also tee records to stdout. Defaults to true. */
  console?: boolean
}

/**
 * Build the pino `targets` array for `createDbLogger`. Pure: callers (and
 * unit tests) can inspect the destinations without spawning a worker thread.
 * The SQLite row keeps its `scope` column via the transport; the console
 * line gains pino's default `scope` merge field, which is the desired
 * behaviour.
 */
export function buildTransportTargets(opts: { dbPath: string; console?: boolean; level: string }) {
  const targets: { target: string; level: string; options?: Record<string, unknown> }[] = [
    { target: './logger-transport.js', level: opts.level, options: { dbPath: opts.dbPath } },
  ]
  if (opts.console !== false) {
    targets.push({ target: 'pino/file', level: opts.level, options: { destination: 1 } })
  }
  return targets
}

export function createDbLogger(opts: DbLoggerOpts) {
  return pino({
    base: opts.scope ? { scope: opts.scope } : undefined,
    level: opts.level ?? 'info',
    transport: { targets: buildTransportTargets({ ...opts, level: opts.level ?? 'info' }) },
  })
}
