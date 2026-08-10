/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { facts, type DB } from 'db'
import { build, createTestDb, seedFact } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import postFactsIngest from './postFactsIngest.js'

const mockGenerate = vi.fn()

vi.mock('workers', async () => {
  const actual = await vi.importActual<typeof import('workers')>('workers')
  return {
    ...actual,
    rankJobDetails: {
      ...actual.rankJobDetails,
      createOllamaClient: () => ({ generate: mockGenerate }),
    },
  }
})

describe('POST /api/facts/ingest', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(postFactsIngest, { db, prefix: '/' })
    mockGenerate.mockReset()
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('returns 201 with inserted count and rows appear in facts', async () => {
    mockGenerate.mockResolvedValue(
      JSON.stringify({
        facts: [
          {
            label: 'TypeScript',
            category: 'skill',
            detail: '5 years experience',
            evidence_type: 'genuine_precedent',
            started_at: '2019-01',
            ended_at: '2024-01',
            period: '5 years',
            confidence: 'inferred',
          },
          { label: 'Tech Lead', category: 'role' },
          { label: 'AWS Cert', category: 'credential', confidence: 'stated' },
        ],
      })
    )

    const res = await app.inject({
      method: 'POST',
      url: '/ingest',
      payload: { resume: 'Experienced TypeScript developer and tech lead.' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ inserted: 3 })

    const rows = db.select().from(facts).all()
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ label: 'TypeScript', category: 'skill', confidence: 'inferred' })
    expect(rows[1]).toMatchObject({ label: 'Tech Lead', category: 'role', confidence: 'inferred' })
    expect(rows[2]).toMatchObject({ label: 'AWS Cert', category: 'credential', confidence: 'stated' })
  })

  it('skips rows with unknown category and logs a warning', async () => {
    mockGenerate.mockResolvedValue(
      JSON.stringify({
        facts: [
          { label: 'TypeScript', category: 'skill' },
          { label: 'Unknown', category: 'bogus_category' },
        ],
      })
    )

    const res = await app.inject({
      method: 'POST',
      url: '/ingest',
      payload: { resume: 'Some resume text' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ inserted: 1 })

    const rows = db.select().from(facts).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].label).toBe('TypeScript')
  })

  it('merges against existing facts: duplicate skipped, conflict superseded, new inserted', async () => {
    seedFact(db, { category: 'skill', label: 'TypeScript', detail: '10 years', confidence: 'stated' })
    const conflicting = seedFact(db, {
      category: 'role',
      label: 'Tech Lead',
      startedAt: '2019-01',
      confidence: 'stated',
    })

    mockGenerate.mockResolvedValue(
      JSON.stringify({
        facts: [
          { label: 'TypeScript', category: 'skill', detail: '10 years' },
          { label: 'Tech Lead', category: 'role', started_at: '2020-01', ended_at: '2023-12' },
          { label: 'AWS Cert', category: 'credential' },
        ],
      })
    )

    const res = await app.inject({
      method: 'POST',
      url: '/ingest',
      payload: { resume: 'Experienced TypeScript developer and tech lead.' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ inserted: 2 })

    const rows = db.select().from(facts).all()
    expect(rows).toHaveLength(4)

    const typeScriptRows = rows.filter(r => r.label === 'TypeScript')
    expect(typeScriptRows).toHaveLength(1)
    expect(typeScriptRows[0].active).toBe(true)

    const techLeadRows = rows.filter(r => r.label === 'Tech Lead')
    expect(techLeadRows).toHaveLength(2)
    const superseded = techLeadRows.find(r => r.id === conflicting.id)
    expect(superseded?.active).toBe(false)
    const replacement = techLeadRows.find(r => r.id !== conflicting.id)
    expect(replacement?.active).toBe(true)
    expect(replacement?.confidence).toBe('inferred')
    expect(replacement?.startedAt).toBe('2020-01')
    expect(replacement?.endedAt).toBe('2023-12')

    const awsRows = rows.filter(r => r.label === 'AWS Cert')
    expect(awsRows).toHaveLength(1)
    expect(awsRows[0].active).toBe(true)
  })

  it('returns 422 when LLM response is malformed', async () => {
    mockGenerate.mockResolvedValue('not valid json')

    const res = await app.inject({
      method: 'POST',
      url: '/ingest',
      payload: { resume: 'Some resume text' },
    })

    expect(res.statusCode).toBe(422)
    expect(res.json()).toEqual({ error: 'ingestion produced no facts' })

    const rows = db.select().from(facts).all()
    expect(rows).toHaveLength(0)
  })

  it('returns 422 when LLM response has no facts', async () => {
    mockGenerate.mockResolvedValue(JSON.stringify({ facts: [] }))

    const res = await app.inject({
      method: 'POST',
      url: '/ingest',
      payload: { resume: 'Some resume text' },
    })

    expect(res.statusCode).toBe(422)
    expect(res.json()).toEqual({ error: 'ingestion produced no facts' })
  })

  it('returns 422 when all facts have unknown categories', async () => {
    mockGenerate.mockResolvedValue(
      JSON.stringify({
        facts: [
          { label: 'Bad1', category: 'unknown1' },
          { label: 'Bad2', category: 'unknown2' },
        ],
      })
    )

    const res = await app.inject({
      method: 'POST',
      url: '/ingest',
      payload: { resume: 'Some resume text' },
    })

    expect(res.statusCode).toBe(422)

    const rows = db.select().from(facts).all()
    expect(rows).toHaveLength(0)
  })

  it('rejects an empty resume', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ingest',
      payload: { resume: '' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('rejects a missing resume field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ingest',
      payload: {},
    })

    expect(res.statusCode).toBe(400)
  })
})
