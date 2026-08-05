/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Query } from '../../../shared/types.js'
import { escapeHtml as esc } from '../../escape.js'

const PAGE_SIZE = 10

export interface QueriesListEventMap {
  'queries-list:toggle': CustomEvent<{ query: Query }>
}

export class QueriesList extends HTMLElement {
  #queries: Query[] = []
  #page = 1
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  setQueries(queries: Query[]): void {
    this.#queries = queries ?? []
    this.#page = 1
    this.render()
  }

  setupEventListeners(): void {
    this.cleanup()
    this.#abort = new AbortController()
    const opts = { signal: this.#abort.signal }
    this.addEventListener('click', this.#onClick, opts)
    this.addEventListener('change', this.#onChange, opts)
  }

  cleanup(): void {
    this.#abort?.abort()
    this.#abort = null
  }

  #onClick = (event: MouseEvent): void => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
    if (!btn) {
      return
    }
    switch (btn.dataset.action) {
      case 'prev-page':
        if (this.#page > 1) {
          this.#page -= 1
          this.render()
        }
        break
      case 'next-page':
        if (this.#page < this.#pageCount()) {
          this.#page += 1
          this.render()
        }
        break
    }
  }

  #onChange = (event: Event): void => {
    const input = event.target as HTMLInputElement
    if (input.dataset.action !== 'toggle-enabled') {
      return
    }
    const id = Number(input.dataset.id)
    const query = this.#queries.find(q => q.id === id)
    if (query) {
      this.dispatchEvent(
        new CustomEvent('queries-list:toggle', {
          bubbles: true,
          composed: true,
          detail: { query: { ...query, enabled: input.checked } },
        })
      )
    }
  }

  #pageCount(): number {
    return Math.max(1, Math.ceil(this.#queries.length / PAGE_SIZE))
  }

  #editHref(id: number): string {
    return `#queries/edit?id=${id}`
  }

  render(): void {
    if (this.#queries.length === 0) {
      this.innerHTML = '<p class="empty-state">No queries registered yet.</p>'
      return
    }

    const pageCount = this.#pageCount()
    const start = (this.#page - 1) * PAGE_SIZE
    const pageQueries = this.#queries.slice(start, start + PAGE_SIZE)

    this.innerHTML = `
      <div class="pagination">
        <button type="button" class="btn" data-action="prev-page" ${this.#page <= 1 ? 'disabled' : ''}>Prev</button>
        <span class="pagination-info">Page ${this.#page} of ${pageCount} (${this.#queries.length} queries)</span>
        <button type="button" class="btn" data-action="next-page" ${this.#page >= pageCount ? 'disabled' : ''}>Next</button>
      </div>
      <ul class="query-list">
        ${pageQueries
          .map(
            q => `
          <li class="query-row ${q.enabled ? '' : 'query-row-disabled'}">
            <label class="query-enabled">
              <input type="checkbox" data-action="toggle-enabled" data-id="${q.id}" ${q.enabled ? 'checked' : ''} />
              <span class="query-enabled-label">${q.enabled ? 'Enabled' : 'Disabled'}</span>
            </label>
            <a class="query-row-text" href="${this.#editHref(q.id)}">
              ${esc(q.queryText)}${q.queryOptions?.location ? ` <em class="query-location">(${esc(q.queryOptions.location)})</em>` : ''}
            </a>
            <span class="query-row-meta">
              ${q.queryOptions?.workType ? `<span>${esc(q.queryOptions.workType)}</span>` : ''}
              ${q.queryOptions?.jobType ? `<span>${esc(q.queryOptions.jobType)}</span>` : ''}
            </span>
          </li>`
          )
          .join('')}
      </ul>
    `
  }
}

customElements.define('queries-list', QueriesList)

declare global {
  interface HTMLElementTagNameMap {
    'queries-list': QueriesList
  }
}
