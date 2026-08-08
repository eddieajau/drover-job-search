/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { FactResponse } from '../../../shared/types.js'
import { escapeHtml as esc } from '../../escape.js'
import '../../elements/toggle-switch.js'

export interface FactEditPageState {
  fact?: FactResponse
}

export interface FactEditPageEventMap {
  'fact-edit-page:ready': CustomEvent<void>
  'fact-edit-page:save': CustomEvent<{
    id?: number
    label: string
    category: string
    detail: string
    evidenceType: string
    confidence: string
    startedAt: string
    endedAt: string
    period: string
    active: boolean
  }>
}

const CATEGORIES = ['skill', 'role', 'precedent_story', 'gap', 'credential', 'principle'] as const
const EVIDENCE_TYPES = ['fast_pivot', 'genuine_precedent', 'genuine_gap'] as const
const CONFIDENCES = ['stated', 'inferred', 'stretch'] as const

const CATEGORY_LABELS: Record<string, string> = {
  skill: 'Skill',
  role: 'Role',
  precedent_story: 'Precedent story',
  gap: 'Gap',
  credential: 'Credential',
  principle: 'Principle',
}

const EVIDENCE_LABELS: Record<string, string> = {
  fast_pivot: 'Fast pivot',
  genuine_precedent: 'Genuine precedent',
  genuine_gap: 'Genuine gap',
}

function label(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export class FactEditPage extends HTMLElement {
  #fact: FactResponse | undefined = undefined
  #active = true
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
    this.dispatchEvent(new CustomEvent('fact-edit-page:ready', { bubbles: true, composed: true }))
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  setState(state: FactEditPageState): void {
    this.#fact = state.fact
    this.#active = state.fact?.active !== false
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
    if ((event.target as HTMLElement).closest('#btn-save-fact')) {
      this.#onSave()
    }
  }

  #onSwitchChange = (event: Event): void => {
    this.#active = (event as CustomEvent<{ checked: boolean }>).detail.checked
  }

  #onSave(): void {
    const labelInput = this.querySelector<HTMLInputElement>('#edit-fact-label')
    if (!labelInput) {
      return
    }
    const labelValue = labelInput.value.trim()
    if (!labelValue) {
      return
    }
    const categorySelect = this.querySelector<HTMLSelectElement>('#edit-fact-category')
    const detailInput = this.querySelector<HTMLTextAreaElement>('#edit-fact-detail')
    const evidenceSelect = this.querySelector<HTMLSelectElement>('#edit-fact-evidence')
    const confidenceRadio = this.querySelector<HTMLInputElement>('input[name="fact-confidence"]:checked')
    const startedInput = this.querySelector<HTMLInputElement>('#edit-fact-started')
    const endedInput = this.querySelector<HTMLInputElement>('#edit-fact-ended')
    const periodInput = this.querySelector<HTMLInputElement>('#edit-fact-period')

    this.dispatchEvent(
      new CustomEvent('fact-edit-page:save', {
        bubbles: true,
        composed: true,
        detail: {
          id: this.#fact?.id,
          label: labelValue,
          category: categorySelect?.value ?? 'skill',
          detail: detailInput?.value.trim() ?? '',
          evidenceType: evidenceSelect?.value ?? '',
          confidence: confidenceRadio?.value ?? 'stated',
          startedAt: startedInput?.value ?? '',
          endedAt: endedInput?.value ?? '',
          period: periodInput?.value.trim() ?? '',
          active: this.#active,
        },
      })
    )
  }

  render(): void {
    this.classList.add('fact-edit-page')
    const fact = this.#fact
    const editing = fact != null

    const categoryOptions = CATEGORIES.map(
      cat => `
          <option value="${cat}" ${cat === (fact?.category ?? 'skill') ? 'selected' : ''}>${CATEGORY_LABELS[cat] ?? label(cat)}</option>`
    ).join('')

    const evidenceOptions = ['', ...EVIDENCE_TYPES]
      .map(
        opt => `
          <option value="${opt}" ${opt === (fact?.evidenceType ?? '') ? 'selected' : ''}>${opt === '' ? '— none —' : (EVIDENCE_LABELS[opt] ?? label(opt))}</option>`
      )
      .join('')

    const confidenceRadios = CONFIDENCES.map(
      conf => `
        <label class="check-pill">
          <input type="radio" name="fact-confidence" value="${conf}" ${conf === (fact?.confidence ?? 'stated') ? 'checked' : ''} />
          <span>${label(conf)}</span>
        </label>`
    ).join('')

    this.innerHTML = `
      <main class="page">
        <a class="crumb" href="#facts">← Facts</a>
        <h1>${editing ? 'Edit fact' : 'New fact'}</h1>
        <form class="form">
          <div class="field">
            <label class="field-label req" for="edit-fact-label">Label</label>
            <input class="input" type="text" id="edit-fact-label" value="${esc(fact?.label ?? '')}" required />
          </div>
          <div class="field">
            <label class="field-label" for="edit-fact-category">Category</label>
            <select class="select" id="edit-fact-category">${categoryOptions}</select>
          </div>
          <div class="field">
            <label class="field-label" for="edit-fact-detail">Detail</label>
            <textarea class="input" id="edit-fact-detail" rows="4">${esc(fact?.detail ?? '')}</textarea>
          </div>
          <div class="field">
            <label class="field-label" for="edit-fact-evidence">Evidence type</label>
            <select class="select" id="edit-fact-evidence">${evidenceOptions}</select>
          </div>
          <fieldset class="field">
            <legend class="field-label">Confidence</legend>
            <div class="pills">${confidenceRadios}</div>
          </fieldset>
          <div class="field-grid">
            <div class="field">
              <label class="field-label" for="edit-fact-started">Started at</label>
              <input class="input" type="date" id="edit-fact-started" value="${esc(fact?.startedAt ?? '')}" />
            </div>
            <div class="field">
              <label class="field-label" for="edit-fact-ended">Ended at</label>
              <input class="input" type="date" id="edit-fact-ended" value="${esc(fact?.endedAt ?? '')}" />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="edit-fact-period">Period</label>
            <input class="input" type="text" id="edit-fact-period" value="${esc(fact?.period ?? '')}" />
            <p class="hint">e.g. 2y3m — used when exact dates aren't known.</p>
          </div>
          <div class="field switch-field">
            <toggle-switch id="edit-fact-active" label="Active"${this.#active ? ' checked' : ''}></toggle-switch>
            <div class="switch-text">
              <label class="field-label" for="edit-fact-active">Active</label>
              <p class="hint">Inactive facts are kept but hidden from the default list.</p>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn primary" id="btn-save-fact">Save fact</button>
            <a class="btn" href="#facts">Cancel</a>
          </div>
        </form>
      </main>
    `
  }
}

customElements.define('fact-edit-page', FactEditPage)

declare global {
  interface HTMLElementTagNameMap {
    'fact-edit-page': FactEditPage
  }
}
