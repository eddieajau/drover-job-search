/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { FactResponse } from '../../../shared/types.js'
import './facts-list.js'
import type { FactsList } from './facts-list.js'

export interface FactsPageEventMap {
  'facts-page:ready': CustomEvent<void>
  'facts-page:filter': CustomEvent<{ category: string; active: string }>
}

export class FactsPage extends HTMLElement {
  #facts: FactResponse[] = []

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
    this.dispatchEvent(new CustomEvent('facts-page:ready', { bubbles: true, composed: true }))
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  setFacts(facts: FactResponse[]): void {
    this.#facts = facts ?? []
    this.#updateHead()
    this.#list()?.setFacts(this.#facts)
  }

  #updateHead(): void {
    const count = this.#facts.length
    const active = this.#facts.filter(f => f.active).length
    const el = this.querySelector<HTMLSpanElement>('.page-count')
    if (el) {
      el.textContent = `${count} facts · ${active} active`
    }
  }

  #list(): FactsList | null {
    return this.querySelector('facts-list')
  }

  setupEventListeners(): void {
    this.cleanup()
    this.addEventListener('change', this.#onFilterChange)
  }

  cleanup(): void {
    this.removeEventListener('change', this.#onFilterChange)
  }

  #onFilterChange = (event: Event): void => {
    const target = event.target as HTMLElement
    if (target.classList.contains('fact-filter')) {
      const category = this.querySelector<HTMLSelectElement>('.fact-filter-category')?.value ?? ''
      const active = this.querySelector<HTMLSelectElement>('.fact-filter-active')?.value ?? ''
      this.dispatchEvent(
        new CustomEvent('facts-page:filter', {
          bubbles: true,
          composed: true,
          detail: { category, active },
        })
      )
    }
  }

  render(): void {
    this.innerHTML = `
      <main class="page">
        <div class="page-head">
          <h1>Facts</h1>
          <span class="page-count"></span>
          <select class="fact-filter fact-filter-category" aria-label="Filter by category">
            <option value="">All categories</option>
            <option value="skill">Skill</option>
            <option value="role">Role</option>
            <option value="precedent_story">Precedent story</option>
            <option value="gap">Gap</option>
            <option value="credential">Credential</option>
            <option value="principle">Principle</option>
          </select>
          <select class="fact-filter fact-filter-active" aria-label="Filter by active">
            <option value="">All</option>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
          <a class="btn primary" href="#facts/edit">New fact</a>
        </div>
        <div class="panel">
          <facts-list></facts-list>
        </div>
      </main>
    `
    this.#updateHead()
  }
}

customElements.define('facts-page', FactsPage)

declare global {
  interface HTMLElementTagNameMap {
    'facts-page': FactsPage
  }
}
