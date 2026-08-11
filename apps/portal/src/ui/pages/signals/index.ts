/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { SignalRule } from '../../../shared/types.js'
import './rules-list.js'
import type { RulesList } from './rules-list.js'

export interface SignalsPageEventMap {
  'signals-page:ready': CustomEvent<void>
  'signals-page:seed': CustomEvent<void>
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
    const target = event.target as HTMLElement
    if (target.closest('#btn-add-rule')) {
      this.#list()?.focusDraft()
      return
    }
    if (target.closest('#btn-seed-rules')) {
      this.dispatchEvent(new CustomEvent('signals-page:seed', { bubbles: true, composed: true }))
    }
  }

  setSeedBusy(busy: boolean): void {
    const btn = this.querySelector<HTMLButtonElement>('#btn-seed-rules')
    if (!btn) {
      return
    }
    btn.disabled = busy
    btn.textContent = busy ? 'Seeding rules…' : 'Seed rules from gap facts'
  }

  showSeedResult(created: number): void {
    const notice = this.querySelector<HTMLElement>('#seed-notice')
    if (!notice) {
      return
    }
    notice.classList.toggle('is-error', created < 0)
    if (created < 0) {
      notice.textContent = 'Seeding failed.'
    } else if (created === 0) {
      notice.textContent = 'No new rules from gap facts.'
    } else {
      notice.textContent = `Created ${created} rule${created === 1 ? '' : 's'} from gap facts.`
    }
  }

  render(): void {
    this.classList.add('signals-page')
    this.innerHTML = `
      <main class="page">
        <div class="page-head">
          <h1>Signal rules</h1>
          <div class="head-actions">
            <button type="button" class="btn btn-outline" id="btn-seed-rules">Seed rules from gap facts</button>
            <button type="button" class="btn primary" id="btn-add-rule">Add rule</button>
          </div>
        </div>
        <p class="page-sub">Regex rules run on import; dealbreakers gate the shortlist.</p>
        <p id="seed-notice" class="seed-notice" role="status" aria-live="polite"></p>
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
