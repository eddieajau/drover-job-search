/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { RuleCategory, SignalRule, SignalType } from '../../../shared/types.js'
import { escapeHtml as esc } from '../../escape.js'

export interface RuleDraft {
  id?: number
  ruleName: string
  ruleCategory: RuleCategory
  pattern: string
  signalType: SignalType
  enabled: boolean
}

export interface RulesListEventMap {
  'rules-list:save': CustomEvent<{ rules: RuleDraft[] }>
  'rules-list:trash': CustomEvent<{ id: number; rules: RuleDraft[] }>
  'rules-list:toggle': CustomEvent<{ id: number; enabled: boolean; rules: RuleDraft[] }>
}

const CATEGORIES: RuleCategory[] = ['regex_title', 'regex_company', 'regex_description']
const SIGNAL_TYPES: SignalType[] = ['dealbreaker', 'skill_match', 'company_match']

export class RulesList extends HTMLElement {
  #rules: RuleDraft[] = []
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  setRules(rules: SignalRule[]): void {
    this.#rules = rules.map(r => ({
      id: r.id,
      ruleName: r.ruleName,
      ruleCategory: r.ruleCategory,
      pattern: r.pattern,
      signalType: r.signalType,
      enabled: r.enabled,
    }))
    this.render()
  }

  setupEventListeners(): void {
    this.cleanup()
    this.#abort = new AbortController()
    const opts = { signal: this.#abort.signal }
    this.addEventListener('click', this.#onClick, opts)
    this.addEventListener('change', this.#onChange, opts)
  }

  cleanup(): void {
    this.#abort?.abort()
    this.#abort = null
  }

  #onClick = (event: MouseEvent): void => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
    if (!btn) {
      return
    }
    switch (btn.dataset.action) {
      case 'save-row':
        this.#onSaveRow(btn)
        break
      case 'trash-row':
        this.#onTrashRow(btn)
        break
      case 'add-row':
        this.#onAddRow()
        break
    }
  }

  #onChange = (event: Event): void => {
    const input = event.target as HTMLInputElement
    if (input.dataset.action !== 'toggle-enabled') {
      return
    }
    const id = Number(input.dataset.id)
    const rule = this.#rules.find(r => r.id === id)
    if (!rule) {
      return
    }
    rule.enabled = input.checked
    this.dispatchEvent(
      new CustomEvent('rules-list:toggle', {
        bubbles: true,
        composed: true,
        detail: { id, enabled: input.checked, rules: this.#snapshot() },
      })
    )
  }

  #onSaveRow(btn: HTMLButtonElement): void {
    const row = btn.closest<HTMLElement>('.rule-row')
    if (!row) {
      return
    }
    const id = row.dataset.id ? Number(row.dataset.id) : undefined
    const draft = this.#readRow(row)
    if (!draft) {
      return
    }
    if (id !== undefined) {
      const idx = this.#rules.findIndex(r => r.id === id)
      if (idx >= 0) {
        this.#rules[idx] = { ...draft, id }
      }
    } else {
      this.#rules.push(draft)
      row.remove()
    }
    this.dispatchEvent(
      new CustomEvent('rules-list:save', {
        bubbles: true,
        composed: true,
        detail: { rules: this.#snapshot() },
      })
    )
  }

  #onTrashRow(btn: HTMLButtonElement): void {
    const row = btn.closest<HTMLElement>('.rule-row')
    if (!row) {
      return
    }
    const id = Number(row.dataset.id)
    this.#rules = this.#rules.filter(r => r.id !== id)
    row.remove()
    this.dispatchEvent(
      new CustomEvent('rules-list:trash', {
        bubbles: true,
        composed: true,
        detail: { id, rules: this.#snapshot() },
      })
    )
  }

  #onAddRow(): void {
    const container = this.querySelector('.rules-rows')
    if (!container) {
      return
    }
    const existing = container.querySelector('.rule-row-new')
    if (existing) {
      return
    }
    container.insertAdjacentHTML('beforeend', this.#newRowTemplate())
  }

  #readRow(row: HTMLElement): RuleDraft | null {
    const name = row.querySelector<HTMLInputElement>('.rule-name')?.value.trim() ?? ''
    const category = row.querySelector<HTMLSelectElement>('.rule-category')?.value as RuleCategory
    const signalType = row.querySelector<HTMLSelectElement>('.rule-signal-type')?.value as SignalType
    const pattern = row.querySelector<HTMLInputElement>('.rule-pattern')?.value.trim() ?? ''
    if (!name || !pattern) {
      return null
    }
    return { ruleName: name, ruleCategory: category, signalType, pattern, enabled: true }
  }

  #snapshot(): RuleDraft[] {
    return this.#rules.map(r => ({ ...r }))
  }

  #options(values: readonly string[], selected: string): string {
    return values.map(v => `<option value="${v}" ${v === selected ? 'selected' : ''}>${v}</option>`).join('')
  }

  #categoryOptions(selected: string): string {
    return this.#options(CATEGORIES, selected)
  }

  #signalTypeOptions(selected: string): string {
    return this.#options(SIGNAL_TYPES, selected)
  }

  #newRowTemplate(): string {
    return `
      <div class="rule-row rule-row-new">
        <label class="rule-field">Name
          <input type="text" class="rule-name" />
        </label>
        <label class="rule-field">Category
          <select class="rule-category">${this.#categoryOptions('regex_title')}</select>
        </label>
        <label class="rule-field">Signal Type
          <select class="rule-signal-type">${this.#signalTypeOptions('skill_match')}</select>
        </label>
        <label class="rule-field">Pattern
          <input type="text" class="rule-pattern" />
        </label>
        <button type="button" class="btn" data-action="save-row">Save</button>
      </div>
    `
  }

  render(): void {
    if (this.#rules.length === 0) {
      this.innerHTML = `
        <p class="empty-state">No signal rules yet.</p>
        <div class="rules-rows">
          ${this.#newRowTemplate()}
        </div>
        <button type="button" class="btn" data-action="add-row">Add rule</button>
      `
      return
    }

    this.innerHTML = `
      <div class="rules-rows">
        ${this.#rules
          .map(
            r => `
          <div class="rule-row" data-id="${r.id}">
            <label class="rule-field">Name
              <input type="text" class="rule-name" value="${esc(r.ruleName)}" />
            </label>
            <label class="rule-field">Category
              <select class="rule-category">${this.#categoryOptions(r.ruleCategory)}</select>
            </label>
            <label class="rule-field">Signal Type
              <select class="rule-signal-type">${this.#signalTypeOptions(r.signalType)}</select>
            </label>
            <label class="rule-field">Pattern
              <input type="text" class="rule-pattern" value="${esc(r.pattern)}" />
            </label>
            <label class="rule-enabled">
              <input type="checkbox" data-action="toggle-enabled" data-id="${r.id}" ${r.enabled ? 'checked' : ''} />
              <span>${r.enabled ? 'Enabled' : 'Disabled'}</span>
            </label>
            <button type="button" class="btn" data-action="save-row">Save</button>
            <button type="button" class="btn danger" data-action="trash-row">Trash</button>
          </div>`
          )
          .join('')}
      </div>
      <button type="button" class="btn" data-action="add-row">Add rule</button>
    `
  }
}

customElements.define('rules-list', RulesList)

declare global {
  interface HTMLElementTagNameMap {
    'rules-list': RulesList
  }
}
