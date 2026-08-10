/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Query } from '../../../shared/types.js'
import { escapeHtml as esc } from '../../escape.js'
import '../../elements/toggle-switch.js'

export interface QueryRowEventMap {
  'query-row:toggle': CustomEvent<{ query: Query }>
}

type QueryRowAttribute = 'query-id' | 'query-text' | 'location' | 'enabled' | 'work-type' | 'job-type' | 'added-date'

const TOKEN_LABELS: Record<string, string> = {
  fulltime: 'Full-time',
  contract: 'Contract',
  parttime: 'Part-time',
  hybrid: 'Hybrid',
  remote: 'Remote',
  onsite: 'Onsite',
}

export class QueryRow extends HTMLElement {
  static observedAttributes: QueryRowAttribute[] = [
    'query-id',
    'query-text',
    'location',
    'enabled',
    'work-type',
    'job-type',
    'added-date',
  ]

  #queryId = 0
  #queryText = ''
  #location = ''
  #enabled = false
  #workType = ''
  #jobType = ''
  #addedDate = ''
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  attributeChangedCallback(name: QueryRowAttribute, _oldValue: string | null, newValue: string | null): void {
    switch (name) {
      case 'query-id':
        this.#queryId = Number(newValue)
        break
      case 'query-text':
        this.#queryText = newValue ?? ''
        break
      case 'location':
        this.#location = newValue ?? ''
        break
      case 'enabled':
        this.#enabled = newValue !== null
        break
      case 'work-type':
        this.#workType = newValue ?? ''
        break
      case 'job-type':
        this.#jobType = newValue ?? ''
        break
      case 'added-date':
        this.#addedDate = newValue ?? ''
        break
    }
    if (this.isConnected) {
      this.render()
    }
  }

  setupEventListeners(): void {
    this.cleanup()
    this.#abort = new AbortController()
    const opts = { signal: this.#abort.signal }
    this.addEventListener('toggle-switch:change', this.#onToggle, opts)
  }

  cleanup(): void {
    this.#abort?.abort()
    this.#abort = null
  }

  #onToggle = (event: Event): void => {
    const { checked } = (event as CustomEvent<{ checked: boolean }>).detail
    this.dispatchEvent(
      new CustomEvent<QueryRowEventMap['query-row:toggle'] extends CustomEvent<infer D> ? D : never>(
        'query-row:toggle',
        {
          bubbles: true,
          composed: true,
          detail: { query: this.#reconstructQuery(checked) },
        }
      )
    )
  }

  #reconstructQuery(enabled: boolean): Query {
    return {
      id: this.#queryId,
      provider: 'linkedin',
      queryText: this.#queryText,
      queryOptions: {
        location: this.#location || undefined,
        workType: this.#workType || undefined,
        jobType: this.#jobType || undefined,
      },
      enabled,
      createdAt: this.#addedDate,
    }
  }

  #tokenLabel(value: string): string {
    return TOKEN_LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1)
  }

  render(): void {
    const disabled = this.#enabled ? '' : ' is-disabled'
    const editHref = `#queries/edit?id=${this.#queryId}`
    const workChips = this.#workType
      .split(',')
      .filter(Boolean)
      .map(value => `<span class="chip">${esc(this.#tokenLabel(value))}</span>`)
      .join('')
    const jobChips = this.#jobType
      .split(',')
      .filter(Boolean)
      .map(value => `<span class="chip">${esc(this.#tokenLabel(value))}</span>`)
      .join('')

    this.innerHTML = `
      <div class="query-row${disabled}">
        <toggle-switch ${this.#enabled ? 'checked' : ''} label="Enable query: ${esc(this.#queryText)}"></toggle-switch>
        <div class="query-main">
          <a class="query-text" href="${esc(editHref)}">${esc(this.#queryText)}</a>
          <div class="query-loc">${esc(this.#location)}</div>
        </div>
        <div class="query-chips">${workChips}${jobChips}</div>
        <span class="query-date">Added ${esc(this.#addedDate)}</span>
        <a class="row-edit" href="${esc(editHref)}">Edit</a>
      </div>
    `
  }
}

customElements.define('query-row', QueryRow)

declare global {
  interface HTMLElementTagNameMap {
    'query-row': QueryRow
  }
}
