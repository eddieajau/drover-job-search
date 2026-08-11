/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { tasks, type DB } from 'db'
import { eq } from 'drizzle-orm'
import { createTestDb } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { attachInputDoc, completeTask, enqueueTask, failTask, selectPendingTasks } from './tasks.js'

describe('task queue helpers', () => {
  let db: DB

  beforeEach(() => {
    db = createTestDb()
  })

  afterEach(() => {
    db.$client.close()
  })

  describe('enqueueTask', () => {
    it('inserts a pending row and returns its id', () => {
      const id = enqueueTask(db, { topic: 'slice_resume' })

      const row = db.select().from(tasks).where(eq(tasks.id, id)).get()!
      expect(row.topic).toBe('slice_resume')
      expect(row.completedAt).toBeNull()
      expect(row.errorMessage).toBeNull()
      expect(row.inputDocId).toBeNull()
    })
  })

  describe('attachInputDoc', () => {
    it('sets input_doc_id on the task', () => {
      const id = enqueueTask(db, { topic: 'slice_resume' })

      attachInputDoc(db, id, 'slice_resume/1/input')

      const row = db.select().from(tasks).where(eq(tasks.id, id)).get()!
      expect(row.inputDocId).toBe('slice_resume/1/input')
    })
  })

  describe('selectPendingTasks', () => {
    it('selects rows for the requested topic with completed_at null, ordered by id', () => {
      enqueueTask(db, { topic: 'slice_resume' })
      enqueueTask(db, { topic: 'slice_resume' })
      enqueueTask(db, { topic: 'slice_resume' })

      const rows = selectPendingTasks(db, 'slice_resume')

      expect(rows.map(r => r.id)).toEqual([1, 2, 3])
    })

    it('excludes completed rows', () => {
      const first = enqueueTask(db, { topic: 'slice_resume' })
      enqueueTask(db, { topic: 'slice_resume' })
      completeTask(db, first, { inserted: 1 })

      const rows = selectPendingTasks(db, 'slice_resume')

      expect(rows.map(r => r.id)).toEqual([2])
    })

    it('excludes failed rows', () => {
      const first = enqueueTask(db, { topic: 'slice_resume' })
      enqueueTask(db, { topic: 'slice_resume' })
      failTask(db, first, 'boom')

      const rows = selectPendingTasks(db, 'slice_resume')

      expect(rows.map(r => r.id)).toEqual([2])
    })

    it('caps rows when a limit is given', () => {
      enqueueTask(db, { topic: 'slice_resume' })
      enqueueTask(db, { topic: 'slice_resume' })

      const rows = selectPendingTasks(db, 'slice_resume', 1)

      expect(rows).toHaveLength(1)
      expect(rows[0].id).toBe(1)
    })
  })

  describe('completeTask', () => {
    it('stamps completed_at, stores the JSON result, and clears error_message', () => {
      const id = enqueueTask(db, { topic: 'slice_resume' })
      db.update(tasks).set({ errorMessage: 'boom' }).where(eq(tasks.id, id)).run()

      completeTask(db, id, { inserted: 42, superseded: 3 })

      const row = db.select().from(tasks).where(eq(tasks.id, id)).get()!
      expect(row.completedAt).not.toBeNull()
      expect(row.result).toBe('{"inserted":42,"superseded":3}')
      expect(row.errorMessage).toBeNull()
    })
  })

  describe('failTask', () => {
    it('records the message, stamps completed_at, and removes the row from the pending set', () => {
      const id = enqueueTask(db, { topic: 'slice_resume' })

      failTask(db, id, 'ollama unavailable')

      const row = db.select().from(tasks).where(eq(tasks.id, id)).get()!
      expect(row.errorMessage).toBe('ollama unavailable')
      expect(row.completedAt).not.toBeNull()

      const pending = selectPendingTasks(db, 'slice_resume')
      expect(pending).toHaveLength(0)
    })
  })
})
