/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { escapeHtml as esc } from '../../escape.js'

type FactRowAttribute =
  | 'fact-id'
  | 'label'
  | 'category'
  | 'evidence-type'
  | 'confidence'
  | 'period'
  | 'started-at'
  | 'ended-at'

const CATEGORY_LABELS: Record<string, string> = {
  skill: 'Skill',
  role: 'Role',
  precedent_story: 'Precedent story',
  gap: 'Gap',
  credential: 'Credential',
  principle: 'Principle',
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export class FactRow extends HTMLElement {
  static observedAttributes: FactRowAttribute[] = [
    'fact-id',
    'label',
    'category',
    'evidence-type',
    'confidence',
    'period',
    'started-at',
    'ended-at',
  ]

  #factId = 0
  #label = ''
  #category = ''
  #evidenceType = ''
  #confidence = ''
  #period = ''
  #startedAt = ''
  #endedAt = ''

  connectedCallback(): void {
    this.render()
  }

  attributeChangedCallback(name: FactRowAttribute, _oldValue: string | null, newValue: string | null): void {
    switch (name) {
      case 'fact-id':
        this.#factId = Number(newValue)
        break
      case 'label':
        this.#label = newValue ?? ''
        break
      case 'category':
        this.#category = newValue ?? ''
        break
      case 'evidence-type':
        this.#evidenceType = newValue ?? ''
        break
      case 'confidence':
        this.#confidence = newValue ?? ''
        break
      case 'period':
        this.#period = newValue ?? ''
        break
      case 'started-at':
        this.#startedAt = newValue ?? ''
        break
      case 'ended-at':
        this.#endedAt = newValue ?? ''
        break
    }
    if (this.isConnected) {
      this.render()
    }
  }

  #formatDate(): string {
    if (this.#period) {
      return this.#period
    }
    if (this.#startedAt && this.#endedAt) {
      return `${this.#startedAt} – ${this.#endedAt}`
    }
    if (this.#startedAt) {
      return `since ${this.#startedAt}`
    }
    return ''
  }

  render(): void {
    const editHref = `#facts/edit?id=${this.#factId}`
    const categoryLabel = CATEGORY_LABELS[this.#category] ?? this.#category
    const confidenceLabel = CONFIDENCE_LABELS[this.#confidence] ?? this.#confidence
    const dateStr = this.#formatDate()
    const evidenceChip = this.#evidenceType ? `<span class="chip">${esc(this.#evidenceType)}</span>` : ''
    const confidenceBadge = confidenceLabel ? `<span class="chip">${esc(confidenceLabel)}</span>` : ''
    const dateLine = dateStr ? `<span class="fact-date">${esc(dateStr)}</span>` : ''

    this.innerHTML = `
      <div class="fact-row">
        <div class="fact-main">
          <a class="fact-text" href="${esc(editHref)}">${esc(this.#label)}</a>
          <div class="fact-meta">
            <span class="chip">${esc(categoryLabel)}</span>
            ${evidenceChip}
            ${confidenceBadge}
            ${dateLine}
          </div>
        </div>
        <a class="row-edit" href="${esc(editHref)}">Edit</a>
      </div>
    `
  }
}

customElements.define('fact-row', FactRow)

declare global {
  interface HTMLElementTagNameMap {
    'fact-row': FactRow
  }
}
