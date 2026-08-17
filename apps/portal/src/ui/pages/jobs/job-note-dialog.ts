/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { JobNote } from '../../../shared/types.js'

export interface JobNoteDialogEventMap {
  'job-note:save': CustomEvent<JobNoteDialogDetail>
}

export interface JobNoteDialogDetail {
  jobId: number
  kind: JobNote['kind']
  date?: string
  note: string
}

const KIND_TITLES: Record<JobNote['kind'], string> = {
  applied: 'Mark applied',
  interviewing: 'Mark interviewing',
  declined: 'Mark declined',
  general: 'Add note',
}

export function todayIso(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export class JobNoteDialog extends HTMLElement {
  #jobId = 0
  #kind: JobNote['kind'] = 'general'
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  open(options: { jobId: number; kind: JobNote['kind']; date?: string }): void {
    this.#jobId = options.jobId
    this.#kind = options.kind

    const title = this.querySelector<HTMLElement>('#note-title')
    if (title) {
      title.textContent = KIND_TITLES[options.kind]
    }

    const dateField = this.querySelector<HTMLElement>('[data-note-date]')
    const dateInput = this.querySelector<HTMLInputElement>('#note-date')
    const noteInput = this.querySelector<HTMLTextAreaElement>('#note-text')
    if (dateField) {
      dateField.hidden = options.kind === 'general'
    }
    if (dateInput) {
      dateInput.value = options.kind === 'general' ? '' : (options.date ?? todayIso())
    }
    if (noteInput) {
      noteInput.value = ''
    }

    const dialog = this.querySelector<HTMLDialogElement>('dialog')
    dialog?.showModal()
    noteInput?.focus()
  }

  setupEventListeners(): void {
    this.cleanup()
    this.#abort = new AbortController()
    const opts = { signal: this.#abort.signal }
    this.addEventListener('click', this.#onClick, opts)
    this.addEventListener('keydown', this.#onKeydown, opts)
  }

  cleanup(): void {
    this.#abort?.abort()
    this.#abort = null
  }

  #onClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement
    if (target.closest('#note-save')) {
      this.#save()
      return
    }
    if (target.closest('#note-cancel')) {
      this.querySelector<HTMLDialogElement>('dialog')?.close()
    }
  }

  #onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.querySelector<HTMLDialogElement>('dialog')?.close()
    }
  }

  #save(): void {
    const noteInput = this.querySelector<HTMLTextAreaElement>('#note-text')
    const dateInput = this.querySelector<HTMLInputElement>('#note-date')
    const date = this.#kind === 'general' ? undefined : dateInput?.value || undefined
    this.dispatchEvent(
      new CustomEvent<JobNoteDialogDetail>('job-note:save', {
        bubbles: true,
        composed: true,
        detail: { jobId: this.#jobId, kind: this.#kind, date, note: noteInput?.value ?? '' },
      })
    )
    this.querySelector<HTMLDialogElement>('dialog')?.close()
  }

  render(): void {
    this.innerHTML = `
      <dialog class="note-dialog" aria-label="Job note">
        <h3 class="note-title" id="note-title">Add note</h3>
        <div class="note-field" data-note-date>
          <label for="note-date">Date</label>
          <input type="date" id="note-date" class="input" />
        </div>
        <div class="note-field">
          <label for="note-text">Note</label>
          <textarea id="note-text" class="input" rows="4" placeholder="What happened on this job?"></textarea>
        </div>
        <div class="note-actions">
          <button type="button" class="btn" id="note-cancel">Cancel</button>
          <button type="button" class="btn btn-primary" id="note-save">Save</button>
        </div>
      </dialog>
    `
  }
}

customElements.define('job-note-dialog', JobNoteDialog)

declare global {
  interface HTMLElementTagNameMap {
    'job-note-dialog': JobNoteDialog
  }
}
