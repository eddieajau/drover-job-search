/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { FactResponse } from '../../../shared/types.js'
import '../../elements/pager.js'
import type { Pager } from '../../elements/pager.js'
import './fact-row.js'
import type { FactRow } from './fact-row.js'

const PAGE_SIZE = 10

export class FactsList extends HTMLElement {
  #facts: FactResponse[] = []
  #page = 1
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  setFacts(facts: FactResponse[]): void {
    this.#facts = facts ?? []
    this.#page = 1
    this.render()
  }

  setupEventListeners(): void {
    this.cleanup()
    this.#abort = new AbortController()
    const opts = { signal: this.#abort.signal }
    this.addEventListener('pager:change', this.#onPagerChange, opts)
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

  render(): void {
    if (this.#facts.length === 0) {
      this.innerHTML = '<p class="empty-state">No facts yet.</p>'
      return
    }

    const start = (this.#page - 1) * PAGE_SIZE
    const pageFacts = this.#facts.slice(start, start + PAGE_SIZE)

    this.innerHTML = `
      <div class="panel-foot">
        <pager-nav></pager-nav>
        <span class="count">${this.#facts.length} facts</span>
      </div>
      <ul class="fact-list"></ul>
    `
    this.querySelector<HTMLUListElement>('ul.fact-list')?.replaceChildren(...this.#rows(pageFacts))
    this.#syncPager()
  }

  #syncPager(): void {
    const pager = this.querySelector<Pager>('pager-nav')
    pager?.setAttribute('page', String(this.#page))
    pager?.setAttribute('page-size', String(PAGE_SIZE))
    pager?.setAttribute('total', String(this.#facts.length))
  }

  #rows(facts: FactResponse[]): FactRow[] {
    return facts.map(f => {
      const row = document.createElement('fact-row') as FactRow
      row.setAttribute('fact-id', String(f.id))
      row.setAttribute('label', f.label)
      row.setAttribute('category', f.category)
      if (f.evidenceType) {
        row.setAttribute('evidence-type', f.evidenceType)
      }
      row.setAttribute('confidence', f.confidence)
      if (f.period) {
        row.setAttribute('period', f.period)
      }
      if (f.startedAt) {
        row.setAttribute('started-at', f.startedAt)
      }
      if (f.endedAt) {
        row.setAttribute('ended-at', f.endedAt)
      }
      return row
    })
  }
}

customElements.define('facts-list', FactsList)

declare global {
  interface HTMLElementTagNameMap {
    'facts-list': FactsList
  }
}
