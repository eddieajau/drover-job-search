/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Query } from '../../../shared/types.js'
import '../../elements/pager.js'
import type { Pager } from '../../elements/pager.js'
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
    this.addEventListener('pager:change', this.#onPagerChange, opts)
    this.addEventListener('query-row:toggle', this.#onRowToggle, opts)
  }

  cleanup(): void {
    this.#abort?.abort()
    this.#abort = null
  }

  #onPagerChange = (event: Event): void => {
    const { page } = (event as CustomEvent<{ page: number; pageSize: number }>).detail
    if (page === this.#page) {
      return
    }
    this.#page = page
    this.render()
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

  render(): void {
    if (this.#queries.length === 0) {
      this.innerHTML = '<p class="empty-state">No queries registered yet.</p>'
      return
    }

    const start = (this.#page - 1) * PAGE_SIZE
    const pageQueries = this.#queries.slice(start, start + PAGE_SIZE)

    this.innerHTML = `
      <div class="panel-foot">
        <pager-nav></pager-nav>
        <span class="count">${this.#queries.length} queries</span>
      </div>
      <ul class="query-list"></ul>
    `
    this.querySelector<HTMLUListElement>('ul.query-list')?.replaceChildren(...this.#rows(pageQueries))
    this.#syncPager()
  }

  #syncPager(): void {
    const pager = this.querySelector<Pager>('pager-nav')
    pager?.setAttribute('page', String(this.#page))
    pager?.setAttribute('page-size', String(PAGE_SIZE))
    pager?.setAttribute('total', String(this.#queries.length))
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
