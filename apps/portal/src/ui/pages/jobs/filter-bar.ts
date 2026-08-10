/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { JobsFilters } from '../../jobs-view.js'

export interface FilterBarEventMap {
  'filter-bar:change': CustomEvent<JobsFilters>
}

export class FilterBar extends HTMLElement {
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  setFilters(filters: JobsFilters): void {
    const priority = this.querySelector<HTMLSelectElement>('#filter-priority')
    const status = this.querySelector<HTMLSelectElement>('#filter-status')
    const search = this.querySelector<HTMLInputElement>('#filter-search')
    const score = this.querySelector<HTMLSelectElement>('#filter-score')
    if (priority) {
      priority.value = filters.priority
    }
    if (status) {
      status.value = filters.status
    }
    if (search) {
      search.value = filters.search
    }
    if (score) {
      score.value = filters.score
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
    this.#dispatchChange()
  }

  #dispatchChange(): void {
    const priority = this.querySelector<HTMLSelectElement>('#filter-priority')
    const status = this.querySelector<HTMLSelectElement>('#filter-status')
    const search = this.querySelector<HTMLInputElement>('#filter-search')
    const score = this.querySelector<HTMLSelectElement>('#filter-score')
    this.dispatchEvent(
      new CustomEvent('filter-bar:change', {
        bubbles: true,
        composed: true,
        detail: {
          priority: priority?.value ?? '',
          status: status?.value ?? '',
          search: search?.value ?? '',
          score: score?.value ?? '',
        },
      })
    )
  }

  render(): void {
    this.classList.add('filters')
    this.innerHTML = `
      <input type="text" id="filter-search" placeholder="Search titles..." />
      <select id="filter-priority" aria-label="Filter by priority">
        <option value="">All priorities</option>
        <option value="1">P1 — Principal/Staff</option>
        <option value="2">P2 — Architect/Lead</option>
        <option value="3">P3 — Engineer</option>
        <option value="4">P4 — PM/Delivery</option>
      </select>
      <select id="filter-status" aria-label="Filter by status">
        <option value="" selected>All (excl. skipped)</option>
        <option value="new">New</option>
        <option value="applied">Applied</option>
        <option value="skipped">Skipped</option>
      </select>
      <select id="filter-score" aria-label="Filter by score bucket">
        <option value="" selected>All</option>
        <option value="hot">Hot</option>
        <option value="neutral">Neutral</option>
        <option value="auto-skip">Auto-skip</option>
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
