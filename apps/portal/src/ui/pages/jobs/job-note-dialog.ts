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
  mode: 'status' | 'note'
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
  #mode: 'status' | 'note' = 'note'
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  open(options: { jobId: number; kind: JobNote['kind']; date?: string; mode?: 'status' | 'note' }): void {
    this.#jobId = options.jobId
    this.#kind = options.kind
    this.#mode = options.mode ?? 'note'

    const isNoteMode = this.#mode === 'note'

    const title = this.querySelector<HTMLElement>('#note-title')
    if (title) {
      title.textContent = isNoteMode ? (KIND_TITLES[options.kind] ?? 'Add note') : KIND_TITLES[options.kind]
    }

    const kindSelect = this.querySelector<HTMLSelectElement>('#note-kind')
    if (kindSelect) {
      kindSelect.hidden = !isNoteMode
      kindSelect.value = options.kind
    }

    const dateField = this.querySelector<HTMLElement>('[data-note-date]')
    const dateInput = this.querySelector<HTMLInputElement>('#note-date')
    const noteInput = this.querySelector<HTMLTextAreaElement>('#note-text')
    if (dateField) {
      dateField.hidden = isNoteMode || options.kind === 'general'
    }
    if (dateInput) {
      dateInput.value = isNoteMode || options.kind === 'general' ? '' : (options.date ?? todayIso())
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
    this.addEventListener('change', this.#onChange, opts)
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

  #onChange = (event: Event): void => {
    const target = event.target as HTMLElement
    if (target.id === 'note-kind') {
      const select = target as HTMLSelectElement
      this.#kind = select.value as JobNote['kind']
      const title = this.querySelector<HTMLElement>('#note-title')
      if (title) {
        title.textContent = KIND_TITLES[this.#kind] ?? 'Add note'
      }
    }
  }

  #save(): void {
    const noteInput = this.querySelector<HTMLTextAreaElement>('#note-text')
    const dateInput = this.querySelector<HTMLInputElement>('#note-date')
    const date = this.#mode === 'status' && this.#kind !== 'general' ? dateInput?.value || undefined : undefined
    this.dispatchEvent(
      new CustomEvent<JobNoteDialogDetail>('job-note:save', {
        bubbles: true,
        composed: true,
        detail: { jobId: this.#jobId, kind: this.#kind, date, note: noteInput?.value ?? '', mode: this.#mode },
      })
    )
    this.querySelector<HTMLDialogElement>('dialog')?.close()
  }

  render(): void {
    this.innerHTML = `
      <dialog class="note-dialog" aria-label="Job note">
        <h3 class="note-title" id="note-title">Add note</h3>
        <div class="note-field">
          <label for="note-kind">Kind</label>
          <select id="note-kind" class="input" hidden>
            <option value="general">Note</option>
            <option value="applied">Applied</option>
            <option value="interviewing">Interviewing</option>
            <option value="declined">Declined</option>
          </select>
        </div>
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
