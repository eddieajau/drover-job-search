/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Query } from '../../../shared/types.js'
import './query-row.js'
import type { QueryRow } from './query-row.js'

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
    this.addEventListener('query-row:toggle', this.#onRowToggle, opts)
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

  #onRowToggle = (event: Event): void => {
    const { query } = (event as CustomEvent<{ query: Query }>).detail
    this.dispatchEvent(
      new CustomEvent('queries-list:toggle', {
        bubbles: true,
        composed: true,
        detail: { query },
      })
    )
  }

  #pageCount(): number {
    return Math.max(1, Math.ceil(this.#queries.length / PAGE_SIZE))
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
      <ul class="query-list"></ul>
    `
    this.querySelector<HTMLUListElement>('ul.query-list')?.replaceChildren(...this.#rows(pageQueries))
  }

  #rows(queries: Query[]): QueryRow[] {
    return queries.map(q => {
      const row = document.createElement('query-row') as QueryRow
      row.setAttribute('query-id', String(q.id))
      row.setAttribute('query-text', q.queryText)
      if (q.queryOptions?.location) {
        row.setAttribute('location', q.queryOptions.location)
      }
      row.toggleAttribute('enabled', q.enabled)
      if (q.queryOptions?.workType) {
        row.setAttribute('work-type', q.queryOptions.workType)
      }
      if (q.queryOptions?.jobType) {
        row.setAttribute('job-type', q.queryOptions.jobType)
      }
      row.setAttribute('added-date', q.createdAt)
      return row
    })
  }
}

customElements.define('queries-list', QueriesList)

declare global {
  interface HTMLElementTagNameMap {
    'queries-list': QueriesList
  }
}
