/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { JobSortKey, JobsFilters } from '../../jobs-view.js'

export interface FilterBarEventMap {
  'filter-bar:change': CustomEvent<JobsFilters>
}

export class FilterBar extends HTMLElement {
  #abort: AbortController | null = null
  #debounceTimer: ReturnType<typeof setTimeout> | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
  }

  disconnectedCallback(): void {
    this.cleanup()
    if (this.#debounceTimer !== null) {
      clearTimeout(this.#debounceTimer)
      this.#debounceTimer = null
    }
  }

  setFilters(filters: JobsFilters): void {
    const status = this.querySelector<HTMLSelectElement>('#filter-status')
    const search = this.querySelector<HTMLInputElement>('#filter-search')
    const sort = this.querySelector<HTMLSelectElement>('#filter-sort')
    if (status) {
      status.value = filters.status
    }
    if (search) {
      search.value = filters.search
    }
    if (sort) {
      sort.value = filters.sort ?? 'score'
    }
  }

  setupEventListeners(): void {
    this.cleanup()
    this.#abort = new AbortController()
    const opts = { signal: this.#abort.signal }
    this.addEventListener('change', this.#onChange, opts)
    this.querySelector('#filter-search')?.addEventListener('input', this.#onInput, opts)
  }

  cleanup(): void {
    this.#abort?.abort()
    this.#abort = null
  }

  #onChange = (): void => {
    this.#dispatchChange()
  }

  #onInput = (): void => {
    if (this.#debounceTimer !== null) {
      clearTimeout(this.#debounceTimer)
    }
    this.#debounceTimer = setTimeout(() => {
      this.#debounceTimer = null
      this.#dispatchChange()
    }, 250)
  }

  #dispatchChange(): void {
    const status = this.querySelector<HTMLSelectElement>('#filter-status')
    const search = this.querySelector<HTMLInputElement>('#filter-search')
    const sort = this.querySelector<HTMLSelectElement>('#filter-sort')
    this.dispatchEvent(
      new CustomEvent('filter-bar:change', {
        bubbles: true,
        composed: true,
        detail: {
          status: (status?.value ?? 'new') as JobsFilters['status'],
          search: search?.value ?? '',
          sort: (sort?.value ?? 'score') as JobSortKey,
        },
      })
    )
  }

  render(): void {
    this.classList.add('filters')
    this.innerHTML = `
      <input type="text" id="filter-search" placeholder="Search titles..." />
      <select id="filter-status" aria-label="Filter by status">
        <option value="new" selected>New</option>
        <option value="discovered">Discovered</option>
        <option value="applied">Applied</option>
        <option value="skipped">Skipped</option>
        <option value="blocked">Blocked</option>
        <option value="declined">Declined</option>
      </select>
      <select id="filter-sort" aria-label="Sort jobs by">
        <option value="score" selected>Score ↓</option>
        <option value="posted">Posted ↓</option>
        <option value="company">Company A→Z</option>
      </select>
    `
  }
}

customElements.define('filter-bar', FilterBar)

declare global {
  interface HTMLElementTagNameMap {
    'filter-bar': FilterBar
  }
}
