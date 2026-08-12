import Database from 'better-sqlite3'
import { describe, it, expect } from 'vitest'

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

  it('defaults jobs.status to new and accepts the five status values', () => {
    const db = createDb(':memory:')
    db.$client
      .prepare(
        "INSERT INTO jobs (provider, provider_job_id, title, company_name, url, location) VALUES ('linkedin', 'job-1', 'Title', 'Acme', 'https://example.com', 'Remote')"
      )
      .run()
    const row = db.$client.prepare('SELECT status FROM jobs WHERE id = 1').get() as { status: string }
    expect(row.status).toBe('new')

    for (const status of ['new', 'discovered', 'applied', 'skipped', 'blocked']) {
      db.$client
        .prepare(
          "INSERT INTO jobs (provider, provider_job_id, title, company_name, url, location, status) VALUES ('linkedin', ?, 'Title', 'Acme', 'https://example.com', 'Remote', ?)"
        )
        .run(`job-${status}`, status)
    }

    db.$client.close()
  })

  it('rejects the dormant jobs.status values bookmarked and archived', () => {
    const db = createDb(':memory:')

    for (const status of ['bookmarked', 'archived']) {
      expect(() =>
        db.$client
          .prepare(
            "INSERT INTO jobs (provider, provider_job_id, title, company_name, url, location, status) VALUES ('linkedin', 'job-x', 'Title', 'Acme', 'https://example.com', 'Remote', ?)"
          )
          .run(status)
      ).toThrow(/CHECK/)
    }

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

  it('creates the signal_rules table with all columns', () => {
    const db = createDb(':memory:')
    const columns = db.$client.prepare('PRAGMA table_info(signal_rules)').all() as { name: string }[]

    expect(columns.map(c => c.name)).toEqual([
      'id',
      'rule_name',
      'rule_category',
      'pattern',
      'signal_type',
      'enabled',
      'created_at',
      'updated_at',
    ])

    db.$client.close()
  })

  it('creates the job_signals table with all columns', () => {
    const db = createDb(':memory:')
    const columns = db.$client.prepare('PRAGMA table_info(job_signals)').all() as { name: string }[]

    expect(columns.map(c => c.name)).toEqual([
      'id',
      'job_id',
      'rule_id',
      'source',
      'signal_type',
      'score',
      'metadata',
      'created_at',
    ])

    db.$client.close()
  })

  it('creates the analysis_queue table with all columns', () => {
    const db = createDb(':memory:')
    const columns = db.$client.prepare('PRAGMA table_info(analysis_queue)').all() as { name: string }[]

    expect(columns.map(c => c.name)).toEqual(['id', 'job_id', 'topic', 'error_message', 'queued_at', 'completed_at'])

    db.$client.close()
  })

  it('creates the documents table with all columns', () => {
    const db = createDb(':memory:')
    const columns = db.$client.prepare('PRAGMA table_info(documents)').all() as { name: string }[]

    expect(columns.map(c => c.name)).toEqual(['id', 'payload', 'created_at'])

    db.$client.close()
  })

  it('creates the tasks table with all columns', () => {
    const db = createDb(':memory:')
    const columns = db.$client.prepare('PRAGMA table_info(tasks)').all() as { name: string }[]

    expect(columns.map(c => c.name)).toEqual([
      'id',
      'topic',
      'input_doc_id',
      'result',
      'error_message',
      'queued_at',
      'completed_at',
    ])

    db.$client.close()
  })

  it('accepts a documents row with a path-like id', () => {
    const db = createDb(':memory:')
    db.$client.prepare("INSERT INTO documents (id, payload) VALUES ('slice_resume/12/input', 'my resume text')").run()
    const row = db.$client.prepare('SELECT id, payload FROM documents WHERE id = ?').get('slice_resume/12/input') as {
      id: string
      payload: string
    }
    expect(row).toEqual({ id: 'slice_resume/12/input', payload: 'my resume text' })

    db.$client.close()
  })

  it('accepts a facts row with a constraint category and rejects unknown categories', () => {
    const db = createDb(':memory:')
    db.$client
      .prepare("INSERT INTO facts (category, label) VALUES ('constraint', 'Open to remote roles; based in Australia')")
      .run()
    const row = db.$client.prepare('SELECT category FROM facts WHERE id = 1').get() as { category: string }
    expect(row.category).toBe('constraint')

    expect(() => db.$client.prepare("INSERT INTO facts (category, label) VALUES ('nonsense', 'x')").run()).toThrow(
      /CHECK/
    )

    db.$client.close()
  })

  it('accepts a tasks row and defaults queued_at', () => {
    const db = createDb(':memory:')
    db.$client.prepare("INSERT INTO tasks (topic, input_doc_id) VALUES ('slice_resume', 'slice_resume/1/input')").run()
    const row = db.$client
      .prepare('SELECT topic, input_doc_id, queued_at, result, error_message FROM tasks WHERE id = 1')
      .get() as {
      topic: string
      input_doc_id: string
      queued_at: string
      result: string | null
      error_message: string | null
    }
    expect(row.topic).toBe('slice_resume')
    expect(row.input_doc_id).toBe('slice_resume/1/input')
    expect(row.queued_at).not.toBeNull()
    expect(row.result).toBeNull()
    expect(row.error_message).toBeNull()

    db.$client.close()
  })

  it('rejects a tasks row with an invalid topic', () => {
    const db = createDb(':memory:')

    expect(() => db.$client.prepare("INSERT INTO tasks (topic) VALUES ('nonsense')").run()).toThrow(/CHECK/)

    db.$client.close()
  })

  it('rejects a tasks row with malformed result JSON', () => {
    const db = createDb(':memory:')

    expect(() =>
      db.$client.prepare("INSERT INTO tasks (topic, result) VALUES ('slice_resume', '{not json')").run()
    ).toThrow(/CHECK/)

    db.$client.close()
  })

  it('defaults signal_type to skill_match and rejects an invalid signal_type', () => {
    const db = createDb(':memory:')
    db.$client
      .prepare("INSERT INTO signal_rules (rule_name, rule_category, pattern) VALUES ('java', 'regex_title', 'java')")
      .run()
    const row = db.$client.prepare('SELECT signal_type FROM signal_rules WHERE id = 1').get() as { signal_type: string }
    expect(row.signal_type).toBe('skill_match')

    expect(() =>
      db.$client
        .prepare(
          "INSERT INTO signal_rules (rule_name, rule_category, pattern, signal_type) VALUES ('noise', 'regex_title', 'foo', 'noise')"
        )
        .run()
    ).toThrow(/CHECK/)

    db.$client.close()
  })

  it('rejects a signal rule with an invalid rule_category', () => {
    const db = createDb(':memory:')

    expect(() =>
      db.$client
        .prepare(
          "INSERT INTO signal_rules (rule_name, rule_category, pattern) VALUES ('bad-category', 'regex_link', 'foo')"
        )
        .run()
    ).toThrow(/CHECK/)

    db.$client.close()
  })

  it('rejects a job signal with an invalid source', () => {
    const db = createDb(':memory:')
    db.$client
      .prepare(
        "INSERT INTO jobs (provider, provider_job_id, title, company_name, url, location) VALUES ('linkedin', 'job-1', 'Title', 'Acme', 'https://example.com', 'Remote')"
      )
      .run()

    expect(() =>
      db.$client
        .prepare(
          "INSERT INTO job_signals (job_id, source, signal_type, score) VALUES (1, 'regex_link', 'skill_match', 5)"
        )
        .run()
    ).toThrow(/CHECK/)

    db.$client.close()
  })

  it('rejects duplicate (job_id, rule_id, source) rows in job_signals', () => {
    const db = createDb(':memory:')
    db.$client
      .prepare(
        "INSERT INTO jobs (provider, provider_job_id, title, company_name, url, location) VALUES ('linkedin', 'job-1', 'Title', 'Acme', 'https://example.com', 'Remote')"
      )
      .run()
    db.$client
      .prepare("INSERT INTO signal_rules (rule_name, rule_category, pattern) VALUES ('java', 'regex_title', 'java')")
      .run()

    const insert = db.$client.prepare(
      "INSERT INTO job_signals (job_id, rule_id, source, signal_type, score) VALUES (1, 1, 'regex_title', 'skill_match', 5)"
    )
    insert.run()
    expect(() => insert.run()).toThrow(/UNIQUE/)

    db.$client.close()
  })

  it('allows duplicate job_id rows in analysis_queue for retries', () => {
    const db = createDb(':memory:')
    db.$client
      .prepare(
        "INSERT INTO jobs (provider, provider_job_id, title, company_name, url, location) VALUES ('linkedin', 'job-1', 'Title', 'Acme', 'https://example.com', 'Remote')"
      )
      .run()

    const insert = db.$client.prepare("INSERT INTO analysis_queue (job_id, topic) VALUES (1, 'fetch_job_details')")
    insert.run()
    insert.run()
    const rows = db.$client.prepare('SELECT COUNT(*) as count FROM analysis_queue').get() as { count: number }
    expect(rows.count).toBe(2)

    db.$client.close()
  })

  it('defaults analysis_queue topic to fetch_job_details and accepts rank', () => {
    const db = createDb(':memory:')
    db.$client
      .prepare(
        "INSERT INTO jobs (provider, provider_job_id, title, company_name, url, location) VALUES ('linkedin', 'job-1', 'Title', 'Acme', 'https://example.com', 'Remote')"
      )
      .run()

    db.$client.prepare("INSERT INTO analysis_queue (job_id, topic) VALUES (1, 'fetch_job_details')").run()
    const row = db.$client.prepare('SELECT topic, error_message FROM analysis_queue WHERE id = 1').get() as {
      topic: string
      error_message: string | null
    }
    expect(row.topic).toBe('fetch_job_details')
    expect(row.error_message).toBeNull()

    db.$client.prepare("UPDATE analysis_queue SET topic = 'rank' WHERE id = 1").run()
    const updated = db.$client.prepare('SELECT topic FROM analysis_queue WHERE id = 1').get() as { topic: string }
    expect(updated.topic).toBe('rank')

    db.$client.close()
  })

  it('rejects an analysis_queue row with an invalid topic', () => {
    const db = createDb(':memory:')
    db.$client
      .prepare(
        "INSERT INTO jobs (provider, provider_job_id, title, company_name, url, location) VALUES ('linkedin', 'job-1', 'Title', 'Acme', 'https://example.com', 'Remote')"
      )
      .run()

    expect(() =>
      db.$client.prepare("INSERT INTO analysis_queue (job_id, topic) VALUES (1, 'invalid_topic')").run()
    ).toThrow(/CHECK/)

    db.$client.close()
  })

  it('stores an error_message on an analysis_queue row', () => {
    const db = createDb(':memory:')
    db.$client
      .prepare(
        "INSERT INTO jobs (provider, provider_job_id, title, company_name, url, location) VALUES ('linkedin', 'job-1', 'Title', 'Acme', 'https://example.com', 'Remote')"
      )
      .run()

    db.$client
      .prepare(
        "INSERT INTO analysis_queue (job_id, topic, error_message) VALUES (1, 'fetch_job_details', 'fetch failed: timeout')"
      )
      .run()
    const row = db.$client.prepare('SELECT error_message FROM analysis_queue WHERE id = 1').get() as {
      error_message: string
    }
    expect(row.error_message).toBe('fetch failed: timeout')

    db.$client.close()
  })

  it('cascades deletes from jobs to job_signals and analysis_queue', () => {
    const db = createDb(':memory:')
    db.$client
      .prepare(
        "INSERT INTO jobs (provider, provider_job_id, title, company_name, url, location) VALUES ('linkedin', 'job-1', 'Title', 'Acme', 'https://example.com', 'Remote')"
      )
      .run()
    db.$client
      .prepare("INSERT INTO signal_rules (rule_name, rule_category, pattern) VALUES ('java', 'regex_title', 'java')")
      .run()
    db.$client
      .prepare(
        "INSERT INTO job_signals (job_id, rule_id, source, signal_type, score) VALUES (1, 1, 'regex_title', 'skill_match', 5)"
      )
      .run()
    db.$client.prepare("INSERT INTO analysis_queue (job_id, topic) VALUES (1, 'fetch_job_details')").run()

    db.$client.prepare('DELETE FROM jobs WHERE id = 1').run()

    expect(db.$client.prepare('SELECT COUNT(*) AS n FROM job_signals').get()).toEqual({ n: 0 })
    expect(db.$client.prepare('SELECT COUNT(*) AS n FROM analysis_queue').get()).toEqual({ n: 0 })

    db.$client.close()
  })

  it('cascades deletes from signal_rules to job_signals', () => {
    const db = createDb(':memory:')
    db.$client
      .prepare(
        "INSERT INTO jobs (provider, provider_job_id, title, company_name, url, location) VALUES ('linkedin', 'job-1', 'Title', 'Acme', 'https://example.com', 'Remote')"
      )
      .run()
    db.$client
      .prepare("INSERT INTO signal_rules (rule_name, rule_category, pattern) VALUES ('java', 'regex_title', 'java')")
      .run()
    db.$client
      .prepare(
        "INSERT INTO job_signals (job_id, rule_id, source, signal_type, score) VALUES (1, 1, 'regex_title', 'skill_match', 5)"
      )
      .run()

    db.$client.prepare('DELETE FROM signal_rules WHERE id = 1').run()

    expect(db.$client.prepare('SELECT COUNT(*) AS n FROM job_signals').get()).toEqual({ n: 0 })

    db.$client.close()
  })
})
