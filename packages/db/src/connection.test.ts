import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { createDb } from './connection.js'

describe('createDb', () => {
  it('creates an in-memory database', () => {
    const db = createDb(':memory:')

    // Access the underlying better-sqlite3 instance via $client
    expect(db.$client).toBeInstanceOf(Database)
    expect(db.$client.open).toBe(true)

    db.$client.close()
  })

  it('creates tables', () => {
    const db = createDb(':memory:')
    const tables = db.$client
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[]
    const names = tables.map(t => t.name)

    expect(names).toContain('queries')
    expect(names).toContain('jobs')
    expect(names).toContain('crawls')

    db.$client.close()
  })

  it('creates the jobs table with all columns', () => {
    const db = createDb(':memory:')
    const columns = db.$client.prepare('PRAGMA table_info(jobs)').all() as { name: string }[]

    expect(columns.map(c => c.name)).toEqual([
      'id',
      'provider',
      'provider_job_id',
      'title',
      'company_name',
      'url',
      'location',
      'workplace_type',
      'employment_type',
      'posted_at',
      'description',
      'salary_min',
      'salary_max',
      'salary_currency',
      'salary_period',
      'is_salary_estimated',
      'salary_raw',
      'category',
      'priority',
      'status',
      'processed_by',
      'skip_reason',
      'created_at',
      'applied_at',
      'skipped_at',
      'updated_at',
    ])

    db.$client.close()
  })

  it('creates the queries table with all columns', () => {
    const db = createDb(':memory:')
    const columns = db.$client.prepare('PRAGMA table_info(queries)').all() as { name: string }[]

    expect(columns.map(c => c.name)).toEqual(['id', 'provider', 'query_text', 'query_options', 'enabled', 'created_at'])

    db.$client.close()
  })

  it('creates the crawls table with all columns', () => {
    const db = createDb(':memory:')
    const columns = db.$client.prepare('PRAGMA table_info(crawls)').all() as { name: string }[]

    expect(columns.map(c => c.name)).toEqual([
      'id',
      'query_id',
      'window_days',
      'found_count',
      'inserted_count',
      'crawled_at',
    ])

    db.$client.close()
  })
})
