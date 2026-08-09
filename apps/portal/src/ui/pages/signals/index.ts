/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { SignalRule } from '../../../shared/types.js'
import './rules-list.js'
import type { RulesList } from './rules-list.js'

export interface SignalsPageEventMap {
  'signals-page:ready': CustomEvent<void>
}

export class SignalsPage extends HTMLElement {
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
    this.dispatchEvent(new CustomEvent('signals-page:ready', { bubbles: true, composed: true }))
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  setRules(rules: SignalRule[]): void {
    this.#list()?.setRules(rules)
  }

  #list(): RulesList | null {
    return this.querySelector('rules-list')
  }

  setupEventListeners(): void {
    this.cleanup()
    this.#abort = new AbortController()
    this.addEventListener('click', this.#onClick, { signal: this.#abort.signal })
  }

  cleanup(): void {
    this.#abort?.abort()
    this.#abort = null
  }

  #onClick = (event: MouseEvent): void => {
    if (!(event.target as HTMLElement).closest('#btn-add-rule')) {
      return
    }
    this.#list()?.focusDraft()
  }

  render(): void {
    this.classList.add('signals-page')
    this.innerHTML = `
      <main class="page">
        <div class="page-head">
          <h1>Signal rules</h1>
          <button type="button" class="btn primary" id="btn-add-rule">Add rule</button>
        </div>
        <p class="page-sub">Regex rules run on import; dealbreakers gate the shortlist.</p>
        <div class="legend">
          <span><i class="dot dot-dealbreaker" aria-hidden="true"></i>dealbreaker</span>
          <span><i class="dot dot-skill" aria-hidden="true"></i>skill_match</span>
          <span><i class="dot dot-company" aria-hidden="true"></i>company_match</span>
        </div>
        <rules-list></rules-list>
      </main>
    `
  }
}

customElements.define('signals-page', SignalsPage)

declare global {
  interface HTMLElementTagNameMap {
    'signals-page': SignalsPage
  }
}
