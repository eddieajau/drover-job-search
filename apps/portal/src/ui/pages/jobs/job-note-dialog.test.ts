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
    el.open({ jobId: 7, kind: 'applied' })

    const dialog = el.querySelector<HTMLDialogElement>('dialog')
    expect(dialog?.hasAttribute('open')).toBe(true)
    const dateField = el.querySelector<HTMLElement>('[data-note-date]')
    expect(dateField?.hasAttribute('hidden')).toBe(false)
    const dateInput = el.querySelector<HTMLInputElement>('#note-date')
    expect(dateInput?.value).toBe(todayIso())
  })

  it('shows the date field for declined', () => {
    el.open({ jobId: 7, kind: 'declined' })

    const dateField = el.querySelector<HTMLElement>('[data-note-date]')
    expect(dateField?.hasAttribute('hidden')).toBe(false)
  })

  it('shows the date field defaulting to today for interviewing', () => {
    el.open({ jobId: 7, kind: 'interviewing' })

    const dialog = el.querySelector<HTMLDialogElement>('dialog')
    expect(dialog?.hasAttribute('open')).toBe(true)
    const dateField = el.querySelector<HTMLElement>('[data-note-date]')
    expect(dateField?.hasAttribute('hidden')).toBe(false)
    const dateInput = el.querySelector<HTMLInputElement>('#note-date')
    expect(dateInput?.value).toBe(todayIso())
  })

  it('uses the passed date for back-capture', () => {
    el.open({ jobId: 7, kind: 'applied', date: '2026-07-01' })

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

  it('moves focus into the note textarea on open', () => {
    el.open({ jobId: 7, kind: 'general' })

    expect(document.activeElement).toBe(el.querySelector<HTMLTextAreaElement>('#note-text'))
  })

  it('dispatches job-note:save with the typed detail on Save', () => {
    el.open({ jobId: 7, kind: 'applied', date: '2026-08-01' })
    let received: JobNoteDialogDetail | undefined
    el.addEventListener('job-note:save', event => {
      received = (event as CustomEvent<JobNoteDialogDetail>).detail
    })
    const textarea = el.querySelector<HTMLTextAreaElement>('#note-text')
    if (textarea) {
      textarea.value = 'Applied via portal'
    }
    el.querySelector<HTMLButtonElement>('#note-save')?.click()

    expect(received).toEqual({ jobId: 7, kind: 'applied', date: '2026-08-01', note: 'Applied via portal' })
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

    expect(received).toEqual({ jobId: 7, kind: 'general', date: undefined, note: 'Remind me to follow up' })
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
