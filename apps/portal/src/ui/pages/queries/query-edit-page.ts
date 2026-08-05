/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Query } from '../../../shared/types.js'
import { escapeHtml as esc } from '../../escape.js'

export interface QueryEditPageState {
  query?: Query
}

export interface QueryEditPageEventMap {
  'query-edit-page:ready': CustomEvent<void>
  'query-edit-page:save': CustomEvent<{
    id?: number
    queryText: string
    queryOptions: {
      location?: string
      workType?: string
      jobType?: string
    }
    enabled: boolean
  }>
}

const WORK_TYPES = ['hybrid', 'remote', 'onsite'] as const
const JOB_TYPES = ['fulltime', 'contract', 'parttime'] as const

function label(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export class QueryEditPage extends HTMLElement {
  #query: Query | undefined = undefined
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
    this.dispatchEvent(new CustomEvent('query-edit-page:ready', { bubbles: true, composed: true }))
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  setState(state: QueryEditPageState): void {
    this.#query = state.query
    this.render()
  }

  setupEventListeners(): void {
    this.cleanup()
    this.#abort = new AbortController()
    this.addEventListener('click', this.#onClick, { signal: this.#abort.signal })
  }

  cleanup(): void {
    this.#abort?.abort()
    this.#abort = null
  }

  #onClick = (event: MouseEvent): void => {
    if ((event.target as HTMLElement).closest('#btn-save-query')) {
      this.#onSave()
    }
  }

  #onSave(): void {
    const qInput = this.querySelector<HTMLInputElement>('#edit-q-text')
    const locInput = this.querySelector<HTMLInputElement>('#edit-q-location')
    const workSelect = this.querySelector<HTMLSelectElement>('#edit-q-work-type')
    const jobChecks = this.querySelectorAll<HTMLInputElement>('input[name="q-job-type"]:checked')
    const enabledCheck = this.querySelector<HTMLInputElement>('#edit-q-enabled')
    if (!qInput || !enabledCheck) {
      return
    }
    const queryText = qInput.value.trim()
    if (!queryText) {
      return
    }
    this.dispatchEvent(
      new CustomEvent('query-edit-page:save', {
        bubbles: true,
        composed: true,
        detail: {
          id: this.#query?.id,
          queryText,
          queryOptions: {
            location: locInput?.value.trim() || undefined,
            workType: workSelect?.value || undefined,
            jobType:
              Array.from(jobChecks)
                .map(cb => cb.value)
                .join(',') || undefined,
          },
          enabled: enabledCheck.checked,
        },
      })
    )
  }

  render(): void {
    this.classList.add('query-edit-page')
    const query = this.#query
    const editing = query != null
    const jobTypes = (query?.queryOptions?.jobType ?? '').split(',').filter(Boolean)

    const workOptions = ['', ...WORK_TYPES]
      .map(
        opt => `
          <option value="${opt}" ${opt === (query?.queryOptions?.workType ?? '') ? 'selected' : ''}>${opt === '' ? 'Work type — any' : label(opt)}</option>`
      )
      .join('')
    const jobChecks = JOB_TYPES.map(
      jt => `
        <label><input type="checkbox" name="q-job-type" value="${jt}" ${jobTypes.includes(jt) ? 'checked' : ''} /> ${label(jt)}</label>`
    ).join('')

    this.innerHTML = `
      <h1 class="page-title">${editing ? 'Edit Query' : 'New Query'}</h1>
      <div class="query-edit-form">
        <label class="field">Query text
          <input type="text" id="edit-q-text" value="${esc(query?.queryText ?? '')}" placeholder="e.g. Staff Engineer" />
        </label>
        <label class="field">Location
          <input type="text" id="edit-q-location" value="${esc(query?.queryOptions?.location ?? '')}" placeholder="e.g. Brisbane, QLD, Australia" />
        </label>
        <label class="field">Work type
          <select id="edit-q-work-type">${workOptions}</select>
        </label>
        <fieldset class="job-type-group">
          <legend>Job type</legend>
          ${jobChecks}
        </fieldset>
        <label class="field enabled-field">
          <input type="checkbox" id="edit-q-enabled" ${query?.enabled !== false ? 'checked' : ''} /> Enabled
        </label>
        <div class="form-actions">
          <button type="button" class="btn primary" id="btn-save-query">Save</button>
          <a class="btn" href="#queries">Cancel</a>
        </div>
      </div>
    `
  }
}

customElements.define('query-edit-page', QueryEditPage)

declare global {
  interface HTMLElementTagNameMap {
    'query-edit-page': QueryEditPage
  }
}
