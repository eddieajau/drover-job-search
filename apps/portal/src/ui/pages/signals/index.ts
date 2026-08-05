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
  connectedCallback(): void {
    this.render()
    this.dispatchEvent(new CustomEvent('signals-page:ready', { bubbles: true, composed: true }))
  }

  setRules(rules: SignalRule[]): void {
    this.#list()?.setRules(rules)
  }

  #list(): RulesList | null {
    return this.querySelector('rules-list')
  }

  render(): void {
    this.classList.add('signals-page')
    this.innerHTML = `
      <h1 class="page-title">Signal Rules</h1>
      <rules-list></rules-list>
    `
  }
}

customElements.define('signals-page', SignalsPage)

declare global {
  interface HTMLElementTagNameMap {
    'signals-page': SignalsPage
  }
}
