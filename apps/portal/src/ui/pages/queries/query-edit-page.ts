/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Query } from '../../../shared/types.js'
import { escapeHtml as esc } from '../../escape.js'
import '../../elements/toggle-switch.js'

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
  #enabled = true
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
    this.#enabled = state.query?.enabled !== false
    this.render()
  }

  setupEventListeners(): void {
    this.cleanup()
    this.#abort = new AbortController()
    const opts = { signal: this.#abort.signal }
    this.addEventListener('click', this.#onClick, opts)
    this.addEventListener('toggle-switch:change', this.#onSwitchChange, opts)
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

  #onSwitchChange = (event: Event): void => {
    this.#enabled = (event as CustomEvent<{ checked: boolean }>).detail.checked
  }

  #onSave(): void {
    const qInput = this.querySelector<HTMLInputElement>('#edit-q-text')
    const locInput = this.querySelector<HTMLInputElement>('#edit-q-location')
    const workSelect = this.querySelector<HTMLSelectElement>('#edit-q-work-type')
    const jobChecks = this.querySelectorAll<HTMLInputElement>('input[name="q-job-type"]:checked')
    if (!qInput) {
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
          enabled: this.#enabled,
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
        <label class="check-pill">
          <input type="checkbox" name="q-job-type" value="${jt}" ${jobTypes.includes(jt) ? 'checked' : ''} />
          <span>${label(jt)}</span>
        </label>`
    ).join('')

    this.innerHTML = `
      <main class="page">
        <a class="crumb" href="#queries">← Queries</a>
        <h1>${editing ? 'Edit query' : 'New query'}</h1>
        <form class="form">
          <div class="field">
            <label class="field-label req" for="edit-q-text">Query text</label>
            <input class="input" type="text" id="edit-q-text" value="${esc(query?.queryText ?? '')}" placeholder="e.g. Staff Engineer" />
            <p class="hint">Keywords sent to the provider.</p>
          </div>
          <div class="field">
            <label class="field-label" for="edit-q-location">Location</label>
            <input class="input" type="text" id="edit-q-location" value="${esc(query?.queryOptions?.location ?? '')}" placeholder="e.g. Brisbane, QLD, Australia" />
            <p class="hint">Leave empty to search anywhere.</p>
          </div>
          <div class="field-grid">
            <div class="field">
              <label class="field-label" for="edit-q-work-type">Work type</label>
              <select class="select" id="edit-q-work-type">${workOptions}</select>
            </div>
            <fieldset class="field">
              <legend class="field-label">Job type</legend>
              <div class="pills">${jobChecks}</div>
            </fieldset>
          </div>
          <div class="field switch-field">
            <toggle-switch id="edit-q-enabled" label="Enabled"${this.#enabled ? ' checked' : ''}></toggle-switch>
            <div class="switch-text">
              <label class="field-label" for="edit-q-enabled">Enabled</label>
              <p class="hint">Disabled queries are kept but excluded from searches.</p>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn primary" id="btn-save-query">Save query</button>
            <a class="btn" href="#queries">Cancel</a>
          </div>
        </form>
      </main>
    `
  }
}

customElements.define('query-edit-page', QueryEditPage)

declare global {
  interface HTMLElementTagNameMap {
    'query-edit-page': QueryEditPage
  }
}
