/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Query } from '../../../shared/types.js'
import './queries-list.js'
import type { QueriesList } from './queries-list.js'

export interface QueriesPageEventMap {
  'queries-page:ready': CustomEvent<void>
}

export class QueriesPage extends HTMLElement {
  #queries: Query[] = []

  connectedCallback(): void {
    this.render()
    this.dispatchEvent(new CustomEvent('queries-page:ready', { bubbles: true, composed: true }))
  }

  setQueries(queries: Query[]): void {
    this.#queries = queries ?? []
    this.#updateHead()
    this.#list()?.setQueries(this.#queries)
  }

  #updateHead(): void {
    const count = this.#queries.length
    const enabled = this.#queries.filter(q => q.enabled).length
    const el = this.querySelector<HTMLSpanElement>('.page-count')
    if (el) {
      el.textContent = `${count} queries · ${enabled} enabled`
    }
  }

  #list(): QueriesList | null {
    return this.querySelector('queries-list')
  }

  render(): void {
    this.innerHTML = `
      <main class="page">
        <div class="page-head">
          <h1>Queries</h1>
          <span class="page-count"></span>
          <a class="btn primary" href="#queries/edit">New query</a>
        </div>
        <div class="panel">
          <queries-list></queries-list>
        </div>
      </main>
    `
    this.#updateHead()
  }
}

customElements.define('queries-page', QueriesPage)

declare global {
  interface HTMLElementTagNameMap {
    'queries-page': QueriesPage
  }
}
