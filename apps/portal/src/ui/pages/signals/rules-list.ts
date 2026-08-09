/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { RuleCategory, SignalRule, SignalType } from '../../../shared/types.js'
import { escapeHtml as esc } from '../../escape.js'
import '../../elements/toggle-switch.js'

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
const ACCENT_CLASSES = SIGNAL_TYPES.map(type => `t-${type}`)

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

  focusDraft(): void {
    this.querySelector<HTMLInputElement>('#rule-draft .rule-name')?.focus()
  }

  setupEventListeners(): void {
    this.cleanup()
    this.#abort = new AbortController()
    const opts = { signal: this.#abort.signal }
    this.addEventListener('click', this.#onClick, opts)
    this.addEventListener('change', this.#onChange, opts)
    this.addEventListener('toggle-switch:change', this.#onToggle, opts)
    this.addEventListener('focusin', this.#onFocusIn, opts)
    this.addEventListener('focusout', this.#onFocusOut, opts)
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
      case 'save-draft':
        this.#onSaveDraft()
        break
      case 'cancel-draft':
        this.#onCancelDraft()
        break
    }
  }

  #onChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement
    if (!target.classList.contains('rule-signal-type')) {
      return
    }
    const row = target.closest<HTMLElement>('.rule-row')
    if (!row) {
      return
    }
    row.classList.remove(...ACCENT_CLASSES)
    row.classList.add(`t-${target.value}`)
  }

  #onToggle = (event: Event): void => {
    const { checked } = (event as CustomEvent<{ checked: boolean }>).detail
    const row = (event.target as HTMLElement).closest<HTMLElement>('.rule-row')
    if (!row?.dataset.id) {
      return
    }
    const id = Number(row.dataset.id)
    const rule = this.#rules.find(r => r.id === id)
    if (!rule) {
      return
    }
    rule.enabled = checked
    row.classList.toggle('is-disabled', !checked)
    this.dispatchEvent(
      new CustomEvent('rules-list:toggle', {
        bubbles: true,
        composed: true,
        detail: { id, enabled: checked, rules: this.#snapshot() },
      })
    )
  }

  #onFocusIn = (event: Event): void => {
    ;(event.target as HTMLElement).closest<HTMLElement>('.rule-row')?.classList.add('is-editing')
  }

  #onFocusOut = (event: Event): void => {
    ;(event.target as HTMLElement).closest<HTMLElement>('.rule-row')?.classList.remove('is-editing')
  }

  #onSaveRow(btn: HTMLButtonElement): void {
    const row = btn.closest<HTMLElement>('.rule-row')
    if (!row?.dataset.id) {
      return
    }
    const id = Number(row.dataset.id)
    const draft = this.#readRow(row)
    if (!draft) {
      return
    }
    const idx = this.#rules.findIndex(r => r.id === id)
    if (idx >= 0) {
      this.#rules[idx] = { ...draft, id, enabled: this.#rules[idx].enabled }
    }
    this.render()
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
    if (!row?.dataset.id) {
      return
    }
    const id = Number(row.dataset.id)
    this.#rules = this.#rules.filter(r => r.id !== id)
    this.render()
    this.dispatchEvent(
      new CustomEvent('rules-list:trash', {
        bubbles: true,
        composed: true,
        detail: { id, rules: this.#snapshot() },
      })
    )
  }

  #onSaveDraft(): void {
    const draftRow = this.querySelector<HTMLElement>('#rule-draft')
    if (!draftRow) {
      return
    }
    const draft = this.#readRow(draftRow)
    if (!draft) {
      return
    }
    this.#rules.push(draft)
    this.render()
    this.dispatchEvent(
      new CustomEvent('rules-list:save', {
        bubbles: true,
        composed: true,
        detail: { rules: this.#snapshot() },
      })
    )
  }

  #onCancelDraft(): void {
    const draftRow = this.querySelector<HTMLElement>('#rule-draft')
    if (!draftRow) {
      return
    }
    this.#clearRowInputs(draftRow)
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

  #clearRowInputs(row: HTMLElement): void {
    const name = row.querySelector<HTMLInputElement>('.rule-name')
    const pattern = row.querySelector<HTMLInputElement>('.rule-pattern')
    if (name) {
      name.value = ''
    }
    if (pattern) {
      pattern.value = ''
    }
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

  #draftTemplate(): string {
    return `
      <div class="draft rule-grid" id="rule-draft">
        <span></span>
        <input class="input rule-name" type="text" placeholder="Rule name" aria-label="Rule name" />
        <select class="select rule-category" aria-label="Category">${this.#categoryOptions('regex_title')}</select>
        <select class="select rule-signal-type" aria-label="Signal type">${this.#signalTypeOptions('skill_match')}</select>
        <input class="input rule-pattern" type="text" placeholder="regex pattern" aria-label="Pattern" />
        <div class="draft-actions">
          <button type="button" class="btn btn-primary btn-sm" data-action="save-draft">Save rule</button>
          <button type="button" class="btn btn-sm" data-action="cancel-draft">Cancel</button>
        </div>
      </div>
    `
  }

  #rowTemplate(r: RuleDraft): string {
    const disabledClass = r.enabled ? '' : ' is-disabled'
    return `
      <div class="rule-row t-${r.signalType} rule-grid${disabledClass}" data-id="${r.id}">
        <toggle-switch ${r.enabled ? 'checked' : ''} label="Enable rule: ${esc(r.ruleName)}"></toggle-switch>
        <input class="input rule-name" type="text" value="${esc(r.ruleName)}" aria-label="Rule name" />
        <select class="select rule-category" aria-label="Category">${this.#categoryOptions(r.ruleCategory)}</select>
        <select class="select rule-signal-type" aria-label="Signal type">${this.#signalTypeOptions(r.signalType)}</select>
        <input class="input rule-pattern" type="text" value="${esc(r.pattern)}" aria-label="Pattern" />
        <div class="rule-actions">
          <button type="button" class="btn btn-sm" data-action="save-row">Save</button>
          <button type="button" class="btn btn-sm btn-danger" data-action="trash-row">Delete</button>
        </div>
      </div>
    `
  }

  render(): void {
    const enabled = this.#rules.filter(r => r.enabled).length
    const empty = this.#rules.length === 0 ? '<p class="empty-state">No signal rules yet.</p>' : ''
    const rows = this.#rules.map(r => this.#rowTemplate(r)).join('')

    this.innerHTML = `
      ${this.#draftTemplate()}
      <div class="panel">
        <div class="rules-header rule-grid">
          <span></span>
          <span>Name</span>
          <span>Category</span>
          <span>Signal type</span>
          <span class="col-pattern">Pattern</span>
          <span></span>
        </div>
        ${empty}
        ${rows}
        <div class="panel-foot">${this.#rules.length} rules · ${enabled} enabled</div>
      </div>
    `
  }
}

customElements.define('rules-list', RulesList)

declare global {
  interface HTMLElementTagNameMap {
    'rules-list': RulesList
  }
}
