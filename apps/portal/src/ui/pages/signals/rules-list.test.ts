/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import type { SignalRule } from '../../../shared/types.js'
import './rules-list.js'
import type { RulesList } from './rules-list.js'

function rules(count: number): SignalRule[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    ruleName: `Rule ${i + 1}`,
    ruleCategory: 'regex_title' as const,
    pattern: `pattern-${i + 1}`,
    signalType: 'skill_match' as const,
    enabled: true,
    createdAt: '2026-08-05 00:00:00',
    updatedAt: '2026-08-05 00:00:00',
  }))
}

describe('rules-list', () => {
  let el: RulesList

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('rules-list')
    document.body.appendChild(el)
  })

  it('renders an empty message and an add row when there are no rules', () => {
    el.setRules([])
    expect(el.textContent).toContain('No signal rules yet.')
    expect(el.querySelector('.rule-row-new')).not.toBeNull()
  })

  it('renders rule rows with editable fields', () => {
    el.setRules(rules(2))
    const rows = el.querySelectorAll<HTMLElement>('.rule-row')
    expect(rows.length).toBe(2)
    expect(rows[0]?.querySelector<HTMLInputElement>('.rule-name')?.value).toBe('Rule 1')
    expect(rows[0]?.querySelector<HTMLInputElement>('.rule-pattern')?.value).toBe('pattern-1')
  })

  it('renders the signal-type select and dispatches its value on save', () => {
    el.setRules(rules(1))
    const select = el.querySelector<HTMLSelectElement>('.rule-signal-type')
    expect(select).not.toBeNull()
    expect(select?.querySelectorAll('option').length).toBe(3)
    select!.value = 'dealbreaker'
    let receivedRules: unknown[] | null = null
    el.addEventListener('rules-list:save', event => {
      receivedRules = (event as CustomEvent<{ rules: unknown[] }>).detail.rules
    })
    el.querySelector<HTMLButtonElement>('[data-action="save-row"]')?.click()
    const draft = (receivedRules as Array<{ signalType?: string }> | null)?.[0]
    expect(draft?.signalType).toBe('dealbreaker')
  })

  it('defaults a new row signal-type to skill_match', () => {
    el.setRules([])
    el.querySelector<HTMLButtonElement>('[data-action="add-row"]')?.click()
    const select = el.querySelector<HTMLSelectElement>('.rule-row-new .rule-signal-type')
    expect(select?.value).toBe('skill_match')
  })

  it('dispatches rules-list:toggle from the enabled checkbox', () => {
    el.setRules(rules(1))
    let received: { id: number; enabled: boolean } | null = null
    el.addEventListener('rules-list:toggle', event => {
      const detail = (event as CustomEvent<{ id: number; enabled: boolean }>).detail
      received = { id: detail.id, enabled: detail.enabled }
    })
    const input = el.querySelector<HTMLInputElement>('input[data-action="toggle-enabled"]')
    if (input) {
      input.checked = false
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
    expect(received).toEqual({ id: 1, enabled: false })
  })

  it('dispatches rules-list:trash when the trash button is clicked', () => {
    el.setRules(rules(2))
    let receivedId: number | null = null
    el.addEventListener('rules-list:trash', event => {
      receivedId = (event as CustomEvent<{ id: number }>).detail.id
    })
    el.querySelector<HTMLButtonElement>('[data-action="trash-row"]')?.click()
    expect(receivedId).toBe(1)
    expect(el.querySelectorAll('.rule-row').length).toBe(1)
  })

  it('dispatches rules-list:save when the save button is clicked', () => {
    el.setRules(rules(1))
    let receivedRules: unknown[] | null = null
    el.addEventListener('rules-list:save', event => {
      receivedRules = (event as CustomEvent<{ rules: unknown[] }>).detail.rules
    })
    el.querySelector<HTMLInputElement>('.rule-name')!.value = 'Updated Rule'
    el.querySelector<HTMLButtonElement>('[data-action="save-row"]')?.click()
    expect(receivedRules).not.toBeNull()
    expect((receivedRules as Array<{ ruleName: string }> | null)?.[0]?.ruleName).toBe('Updated Rule')
  })

  it('shows an add-row button and creates a new empty row', () => {
    el.setRules(rules(1))
    expect(el.querySelector('[data-action="add-row"]')).not.toBeNull()
    el.querySelector<HTMLButtonElement>('[data-action="add-row"]')?.click()
    expect(el.querySelector('.rule-row-new')).not.toBeNull()
  })
})
