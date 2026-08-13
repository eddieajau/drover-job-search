/**
 * The pino worker-thread transport cannot run under vitest: pino resolves
 * the transport `target` via `createRequire`, which cannot resolve the `.ts`
 * source ("unable to determine transport target"). The transport is therefore
 * exercised in-process instead — `pino(logger, sink)` writes the same
 * serialized records into the transport sink directly, covering `toBody`,
 * level conversion, and the `logs` INSERT/CHECK constraints without spawning
 * a worker. The worker wiring itself is verified by the crawler (ticket 105).
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import pino from 'pino'
import { describe, expect, it } from 'vitest'

import { createDb } from './connection.js'
import createTransport, { toBody } from './logger-transport.js'
import { buildTransportTargets } from './logger.js'

describe('buildTransportTargets', () => {
  it('returns the SQLite target and a stdout target by default', () => {
    expect(buildTransportTargets({ dbPath: 'x', level: 'info' })).toEqual([
      { target: './logger-transport.js', level: 'info', options: { dbPath: 'x' } },
      { target: 'pino/file', level: 'info', options: { destination: 1 } },
    ])
  })

  it('omits the stdout target when console is false', () => {
    expect(buildTransportTargets({ dbPath: 'x', level: 'debug', console: false })).toEqual([
      { target: './logger-transport.js', level: 'debug', options: { dbPath: 'x' } },
    ])
  })
})

describe('toBody', () => {
  it('keeps time and merge fields but drops level and scope', () => {
    const body = JSON.parse(
      toBody({
        level: 30,
        time: 1786519013328,
        scope: 'crawler',
        page: 2,
        url: 'https://example.com/seeMoreJobPostings',
        msg: 'search page',
      })
    )
    expect(body).toEqual({
      time: 1786519013328,
      page: 2,
      url: 'https://example.com/seeMoreJobPostings',
      msg: 'search page',
    })
  })
})

describe('logs table', () => {
  it('is created by createDb', () => {
    const db = createDb(':memory:')
    const names = (
      db.$client.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as {
        name: string
      }[]
    ).map(t => t.name)

    expect(names).toContain('logs')
    db.$client.close()
  })

  it('round-trips the six standard pino level integers', () => {
    const db = createDb(':memory:')
    for (const level of [10, 20, 30, 40, 50, 60]) {
      db.$client
        .prepare('INSERT INTO logs (level, scope, body) VALUES (?, ?, ?)')
        .run(level, 'test', JSON.stringify({ msg: 'record', time: 1 }))
    }

    const levels = (db.$client.prepare('SELECT level FROM logs ORDER BY id').all() as { level: number }[]).map(
      r => r.level
    )
    expect(levels).toEqual([10, 20, 30, 40, 50, 60])
    db.$client.close()
  })

  it('rejects an unknown level', () => {
    const db = createDb(':memory:')
    expect(() => db.$client.prepare("INSERT INTO logs (level, scope, body) VALUES (25, 'test', '{}')").run()).toThrow(
      /CHECK/
    )
    db.$client.close()
  })

  it('rejects a non-JSON body', () => {
    const db = createDb(':memory:')
    expect(() =>
      db.$client.prepare("INSERT INTO logs (level, scope, body) VALUES (30, 'test', 'not-json')").run()
    ).toThrow(/CHECK/)
    db.$client.close()
  })
})

describe('db logger transport', () => {
  it('persists pino records to the logs table ordered by ts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'drover-logs-'))
    const dbPath = join(dir, 'test.db')
    createDb(dbPath).$client.close()

    const sink = await createTransport({ dbPath })
    const log = pino({ base: { scope: 'crawler' } }, sink)

    log.info({ page: 2, url: 'https://example.com/seeMoreJobPostings' }, 'search page')
    log.warn({ providerJobId: 'job-1' }, 'throttled')

    sink.end()
    await new Promise<void>(resolve => sink.once('close', resolve))

    const db = createDb(dbPath)
    const stored = db.$client.prepare('SELECT level, scope, body FROM logs ORDER BY ts, id').all() as {
      level: number
      scope: string | null
      body: string
    }[]
    expect(stored).toHaveLength(2)
    expect(stored[0].level).toBe(30)
    expect(stored[0].scope).toBe('crawler')
    expect(JSON.parse(stored[0].body)).toMatchObject({ page: 2, msg: 'search page' })
    expect(stored[1].level).toBe(40)
    expect(stored[1].scope).toBe('crawler')
    expect(JSON.parse(stored[1].body)).toMatchObject({ providerJobId: 'job-1', msg: 'throttled' })

    db.$client.close()
    rmSync(dir, { recursive: true, force: true })
  })
})
