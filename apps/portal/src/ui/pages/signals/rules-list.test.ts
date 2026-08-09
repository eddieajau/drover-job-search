/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import type { SignalRule } from '../../../shared/types.js'
import './rules-list.js'
import type { RulesList } from './rules-list.js'

function rules(count: number, overrides: Partial<SignalRule> = {}): SignalRule[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    ruleName: `Rule ${i + 1}`,
    ruleCategory: 'regex_title' as const,
    pattern: `pattern-${i + 1}`,
    signalType: 'skill_match' as const,
    enabled: true,
    createdAt: '2026-08-05 00:00:00',
    updatedAt: '2026-08-05 00:00:00',
    ...overrides,
  }))
}

describe('rules-list', () => {
  let el: RulesList

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('rules-list')
    document.body.appendChild(el)
  })

  it('renders the draft row, header, and empty state when there are no rules', () => {
    el.setRules([])
    expect(el.querySelector('#rule-draft')).not.toBeNull()
    expect(el.querySelector('.rules-header')).not.toBeNull()
    expect(el.textContent).toContain('No signal rules yet.')
    expect(el.textContent).toContain('0 rules · 0 enabled')
  })

  it('renders rule rows with editable fields and the accent class', () => {
    el.setRules(rules(2))
    const rows = el.querySelectorAll<HTMLElement>('.rule-row')
    expect(rows.length).toBe(2)
    expect(rows[0]?.querySelector<HTMLInputElement>('.rule-name')?.value).toBe('Rule 1')
    expect(rows[0]?.querySelector<HTMLInputElement>('.rule-pattern')?.value).toBe('pattern-1')
    expect(rows[0]?.classList.contains('t-skill_match')).toBe(true)
  })

  it('renders the signal-type select with all three options and defaults the draft to skill_match', () => {
    el.setRules(rules(1))
    const select = el.querySelector<HTMLSelectElement>('.rule-signal-type')
    expect(select).not.toBeNull()
    expect(select?.querySelectorAll('option').length).toBe(3)
    expect(el.querySelector<HTMLSelectElement>('#rule-draft .rule-signal-type')?.value).toBe('skill_match')
  })

  it('saves a new rule from the draft row and dispatches rules-list:save', () => {
    el.setRules([])
    let received: unknown[] | null = null
    el.addEventListener('rules-list:save', event => {
      received = (event as CustomEvent<{ rules: unknown[] }>).detail.rules
    })

    const name = el.querySelector<HTMLInputElement>('#rule-draft .rule-name')
    const pattern = el.querySelector<HTMLInputElement>('#rule-draft .rule-pattern')
    name!.value = 'no-java'
    pattern!.value = '\\bjava\\b'
    el.querySelector<HTMLButtonElement>('[data-action="save-draft"]')?.click()

    expect((received as Array<{ ruleName: string; signalType: string }> | null)?.[0]?.ruleName).toBe('no-java')
    expect((received as Array<{ ruleName: string; signalType: string }> | null)?.[0]?.signalType).toBe('skill_match')
    expect(el.querySelectorAll('.rule-row').length).toBe(1)
    expect(el.querySelector<HTMLInputElement>('#rule-draft .rule-name')?.value).toBe('')
  })

  it('does not save a draft with an empty name or pattern', () => {
    el.setRules([])
    let fired = false
    el.addEventListener('rules-list:save', () => {
      fired = true
    })
    el.querySelector<HTMLButtonElement>('[data-action="save-draft"]')?.click()
    expect(fired).toBe(false)
  })

  it('cancels clears the draft fields', () => {
    el.setRules([])
    const name = el.querySelector<HTMLInputElement>('#rule-draft .rule-name')
    name!.value = 'no-java'
    el.querySelector<HTMLButtonElement>('[data-action="cancel-draft"]')?.click()
    expect(name?.value).toBe('')
  })

  it('dispatches rules-list:save when Save is clicked on a row', () => {
    el.setRules(rules(1))
    let received: unknown[] | null = null
    el.addEventListener('rules-list:save', event => {
      received = (event as CustomEvent<{ rules: unknown[] }>).detail.rules
    })
    el.querySelector<HTMLInputElement>('.rule-row .rule-name')!.value = 'Updated Rule'
    el.querySelector<HTMLButtonElement>('[data-action="save-row"]')?.click()
    expect((received as Array<{ ruleName: string }> | null)?.[0]?.ruleName).toBe('Updated Rule')
  })

  it('preserves the enabled flag when an existing row is saved', () => {
    el.setRules(rules(1, { enabled: false }))
    let received: unknown[] | null = null
    el.addEventListener('rules-list:save', event => {
      received = (event as CustomEvent<{ rules: unknown[] }>).detail.rules
    })
    el.querySelector<HTMLInputElement>('.rule-row .rule-name')!.value = 'Still disabled'
    el.querySelector<HTMLButtonElement>('[data-action="save-row"]')?.click()
    expect((received as Array<{ enabled: boolean }> | null)?.[0]?.enabled).toBe(false)
  })

  it('dispatches rules-list:trash when Delete is clicked and removes the row', () => {
    el.setRules(rules(2))
    let receivedId: number | null = null
    el.addEventListener('rules-list:trash', event => {
      receivedId = (event as CustomEvent<{ id: number }>).detail.id
    })
    el.querySelector<HTMLButtonElement>('[data-action="trash-row"]')?.click()
    expect(receivedId).toBe(1)
    expect(el.querySelectorAll('.rule-row').length).toBe(1)
  })

  it('dispatches rules-list:toggle from the enable switch and flips is-disabled', () => {
    el.setRules(rules(1))
    let received: { id: number; enabled: boolean } | null = null
    el.addEventListener('rules-list:toggle', event => {
      const detail = (event as CustomEvent<{ id: number; enabled: boolean }>).detail
      received = { id: detail.id, enabled: detail.enabled }
    })
    const input = el.querySelector<HTMLInputElement>('toggle-switch input')
    input!.checked = false
    input!.dispatchEvent(new Event('change', { bubbles: true }))
    expect(received).toEqual({ id: 1, enabled: false })
    expect(el.querySelector('.rule-row')?.classList.contains('is-disabled')).toBe(true)
  })

  it('accents a row by signal type and flips the accent when the select changes', () => {
    el.setRules(rules(1, { signalType: 'dealbreaker' }))
    const row = el.querySelector<HTMLElement>('.rule-row')!
    expect(row.classList.contains('t-dealbreaker')).toBe(true)
    const select = row.querySelector<HTMLSelectElement>('.rule-signal-type')!
    select.value = 'company_match'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    expect(row.classList.contains('t-company_match')).toBe(true)
    expect(row.classList.contains('t-dealbreaker')).toBe(false)
  })

  it('adds and removes is-editing on focus', () => {
    el.setRules(rules(1))
    const row = el.querySelector<HTMLElement>('.rule-row')!
    const input = row.querySelector<HTMLInputElement>('.rule-name')!
    input.dispatchEvent(new Event('focusin', { bubbles: true }))
    expect(row.classList.contains('is-editing')).toBe(true)
    input.dispatchEvent(new Event('focusout', { bubbles: true }))
    expect(row.classList.contains('is-editing')).toBe(false)
  })

  it('renders the footer count', () => {
    const five = [...rules(5)]
    five[0] = { ...five[0], enabled: false }
    five[1] = { ...five[1], enabled: false }
    el.setRules(five)
    expect(el.textContent).toContain('5 rules · 3 enabled')
  })

  it('focusDraft focuses the draft name input', () => {
    el.setRules([])
    el.focusDraft()
    expect(document.activeElement).toBe(el.querySelector('#rule-draft .rule-name'))
  })
})
