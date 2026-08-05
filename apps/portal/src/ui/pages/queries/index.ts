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
  connectedCallback(): void {
    this.render()
    this.dispatchEvent(new CustomEvent('queries-page:ready', { bubbles: true, composed: true }))
  }

  setQueries(queries: Query[]): void {
    this.#list()?.setQueries(queries)
  }

  #list(): QueriesList | null {
    return this.querySelector('queries-list')
  }

  render(): void {
    this.classList.add('queries-page')
    this.innerHTML = `
      <h1 class="page-title">Queries</h1>
      <a class="btn new-query" href="#queries/edit">New query</a>
      <queries-list></queries-list>
    `
  }
}

customElements.define('queries-page', QueriesPage)

declare global {
  interface HTMLElementTagNameMap {
    'queries-page': QueriesPage
  }
}
