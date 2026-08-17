/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import './job-note-dialog.js'
import type { JobNoteDialog, JobNoteDialogDetail } from './job-note-dialog.js'
import { todayIso } from './job-note-dialog.js'

describe('job-note-dialog', () => {
  let el: JobNoteDialog

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('job-note-dialog')
    document.body.appendChild(el)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('shows the date field defaulting to today for applied', () => {
    el.open({ jobId: 7, kind: 'applied', mode: 'status' })

    const dialog = el.querySelector<HTMLDialogElement>('dialog')
    expect(dialog?.hasAttribute('open')).toBe(true)
    const dateField = el.querySelector<HTMLElement>('[data-note-date]')
    expect(dateField?.hasAttribute('hidden')).toBe(false)
    const dateInput = el.querySelector<HTMLInputElement>('#note-date')
    expect(dateInput?.value).toBe(todayIso())
  })

  it('shows the date field for declined', () => {
    el.open({ jobId: 7, kind: 'declined', mode: 'status' })

    const dateField = el.querySelector<HTMLElement>('[data-note-date]')
    expect(dateField?.hasAttribute('hidden')).toBe(false)
  })

  it('shows the date field defaulting to today for interviewing', () => {
    el.open({ jobId: 7, kind: 'interviewing', mode: 'status' })

    const dialog = el.querySelector<HTMLDialogElement>('dialog')
    expect(dialog?.hasAttribute('open')).toBe(true)
    const dateField = el.querySelector<HTMLElement>('[data-note-date]')
    expect(dateField?.hasAttribute('hidden')).toBe(false)
    const dateInput = el.querySelector<HTMLInputElement>('#note-date')
    expect(dateInput?.value).toBe(todayIso())
  })

  it('uses the passed date for back-capture', () => {
    el.open({ jobId: 7, kind: 'applied', date: '2026-07-01', mode: 'status' })

    const dateInput = el.querySelector<HTMLInputElement>('#note-date')
    expect(dateInput?.value).toBe('2026-07-01')
  })

  it('hides the date field for general', () => {
    el.open({ jobId: 7, kind: 'general' })

    const dateField = el.querySelector<HTMLElement>('[data-note-date]')
    expect(dateField?.hasAttribute('hidden')).toBe(true)
    const dateInput = el.querySelector<HTMLInputElement>('#note-date')
    expect(dateInput?.value).toBe('')
  })

  it('shows the kind select in note mode and hides it in status mode', () => {
    el.open({ jobId: 7, kind: 'general', mode: 'note' })
    const kindSelect = el.querySelector<HTMLSelectElement>('#note-kind')
    expect(kindSelect?.hidden).toBe(false)

    el.open({ jobId: 7, kind: 'applied', mode: 'status' })
    expect(kindSelect?.hidden).toBe(true)
  })

  it('hides the date field in note mode regardless of kind', () => {
    el.open({ jobId: 7, kind: 'applied', mode: 'note' })
    const dateField = el.querySelector<HTMLElement>('[data-note-date]')
    expect(dateField?.hasAttribute('hidden')).toBe(true)
  })

  it('defaults the kind select to general in note mode', () => {
    el.open({ jobId: 7, kind: 'general', mode: 'note' })
    const kindSelect = el.querySelector<HTMLSelectElement>('#note-kind')
    expect(kindSelect?.value).toBe('general')
  })

  it('sets the kind select to the given kind in note mode', () => {
    el.open({ jobId: 7, kind: 'interviewing', mode: 'note' })
    const kindSelect = el.querySelector<HTMLSelectElement>('#note-kind')
    expect(kindSelect?.value).toBe('interviewing')
  })

  it('updates the title when the kind select changes in note mode', () => {
    el.open({ jobId: 7, kind: 'general', mode: 'note' })
    const kindSelect = el.querySelector<HTMLSelectElement>('#note-kind')
    if (kindSelect) {
      kindSelect.value = 'interviewing'
      kindSelect.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const title = el.querySelector<HTMLElement>('#note-title')
    expect(title?.textContent).toBe('Mark interviewing')
  })

  it('dispatches job-note:save with mode note and the chosen kind', () => {
    el.open({ jobId: 7, kind: 'general', mode: 'note' })
    let received: JobNoteDialogDetail | undefined
    el.addEventListener('job-note:save', event => {
      received = (event as CustomEvent<JobNoteDialogDetail>).detail
    })

    const kindSelect = el.querySelector<HTMLSelectElement>('#note-kind')
    if (kindSelect) {
      kindSelect.value = 'interviewing'
      kindSelect.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const textarea = el.querySelector<HTMLTextAreaElement>('#note-text')
    if (textarea) {
      textarea.value = 'Phone screen on 5 Aug'
    }
    el.querySelector<HTMLButtonElement>('#note-save')?.click()

    expect(received).toEqual({
      jobId: 7,
      kind: 'interviewing',
      date: undefined,
      note: 'Phone screen on 5 Aug',
      mode: 'note',
    })
  })

  it('dispatches job-note:save with mode status for status-mode opens', () => {
    el.open({ jobId: 7, kind: 'applied', date: '2026-08-01', mode: 'status' })
    let received: JobNoteDialogDetail | undefined
    el.addEventListener('job-note:save', event => {
      received = (event as CustomEvent<JobNoteDialogDetail>).detail
    })
    const textarea = el.querySelector<HTMLTextAreaElement>('#note-text')
    if (textarea) {
      textarea.value = 'Applied via portal'
    }
    el.querySelector<HTMLButtonElement>('#note-save')?.click()

    expect(received).toEqual({
      jobId: 7,
      kind: 'applied',
      date: '2026-08-01',
      note: 'Applied via portal',
      mode: 'status',
    })
  })

  it('moves focus into the note textarea on open', () => {
    el.open({ jobId: 7, kind: 'general' })

    expect(document.activeElement).toBe(el.querySelector<HTMLTextAreaElement>('#note-text'))
  })

  it('dispatches job-note:save with the typed detail on Save', () => {
    el.open({ jobId: 7, kind: 'applied', date: '2026-08-01', mode: 'status' })
    let received: JobNoteDialogDetail | undefined
    el.addEventListener('job-note:save', event => {
      received = (event as CustomEvent<JobNoteDialogDetail>).detail
    })
    const textarea = el.querySelector<HTMLTextAreaElement>('#note-text')
    if (textarea) {
      textarea.value = 'Applied via portal'
    }
    el.querySelector<HTMLButtonElement>('#note-save')?.click()

    expect(received).toEqual({
      jobId: 7,
      kind: 'applied',
      date: '2026-08-01',
      note: 'Applied via portal',
      mode: 'status',
    })
    const dialog = el.querySelector<HTMLDialogElement>('dialog')
    expect(dialog?.hasAttribute('open')).toBe(false)
  })

  it('omits the date from a general save detail', () => {
    el.open({ jobId: 7, kind: 'general' })
    let received: JobNoteDialogDetail | undefined
    el.addEventListener('job-note:save', event => {
      received = (event as CustomEvent<JobNoteDialogDetail>).detail
    })
    const textarea = el.querySelector<HTMLTextAreaElement>('#note-text')
    if (textarea) {
      textarea.value = 'Remind me to follow up'
    }
    el.querySelector<HTMLButtonElement>('#note-save')?.click()

    expect(received).toEqual({
      jobId: 7,
      kind: 'general',
      date: undefined,
      note: 'Remind me to follow up',
      mode: 'note',
    })
  })

  it('closes on Cancel without dispatching a save event', () => {
    el.open({ jobId: 7, kind: 'general' })
    let fired = false
    el.addEventListener('job-note:save', () => {
      fired = true
    })

    el.querySelector<HTMLButtonElement>('#note-cancel')?.click()

    const dialog = el.querySelector<HTMLDialogElement>('dialog')
    expect(dialog?.hasAttribute('open')).toBe(false)
    expect(fired).toBe(false)
  })

  it('closes on Escape without dispatching a save event', () => {
    el.open({ jobId: 7, kind: 'general' })
    let fired = false
    el.addEventListener('job-note:save', () => {
      fired = true
    })

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    const dialog = el.querySelector<HTMLDialogElement>('dialog')
    expect(dialog?.hasAttribute('open')).toBe(false)
    expect(fired).toBe(false)
  })
})
