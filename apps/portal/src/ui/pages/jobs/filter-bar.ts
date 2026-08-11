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
    const score = this.querySelector<HTMLSelectElement>('#filter-score')
    const sort = this.querySelector<HTMLSelectElement>('#filter-sort')
    if (status) {
      status.value = filters.status
    }
    if (search) {
      search.value = filters.search
    }
    if (score) {
      score.value = filters.score
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
    const score = this.querySelector<HTMLSelectElement>('#filter-score')
    const sort = this.querySelector<HTMLSelectElement>('#filter-sort')
    this.dispatchEvent(
      new CustomEvent('filter-bar:change', {
        bubbles: true,
        composed: true,
        detail: {
          status: status?.value ?? '',
          search: search?.value ?? '',
          score: score?.value ?? '',
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
        <option value="relevant" selected>Relevant (excl. skipped)</option>
        <option value="all">All</option>
        <option value="new">New</option>
        <option value="applied">Applied</option>
        <option value="skipped">Skipped</option>
      </select>
      <select id="filter-score" aria-label="Filter by score bucket">
        <option value="relevant" selected>Relevant (excl. auto-skip)</option>
        <option value="all">All</option>
        <option value="hot">Hot</option>
        <option value="neutral">Neutral</option>
        <option value="auto-skip">Auto-skip</option>
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
