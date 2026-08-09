/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import type { SignalRule } from '../../../shared/types.js'
import './index.js'
import type { SignalsPage } from './index.js'

function rule(id: number): SignalRule {
  return {
    id,
    ruleName: `Rule ${id}`,
    ruleCategory: 'regex_title',
    pattern: 'x',
    signalType: 'skill_match',
    enabled: true,
    createdAt: '2026-08-05 00:00:00',
    updatedAt: '2026-08-05 00:00:00',
  }
}

describe('signals-page', () => {
  let el: SignalsPage

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('signals-page')
    document.body.appendChild(el)
  })

  it('renders the page shell with head, sub, legend, and rules-list', () => {
    expect(el.querySelector<HTMLHeadingElement>('h1')?.textContent).toBe('Signal rules')
    expect(el.querySelector<HTMLButtonElement>('#btn-add-rule')?.textContent).toContain('Add rule')
    expect(el.querySelector('.page-sub')?.textContent).toContain('dealbreakers gate the shortlist')
    expect(el.querySelectorAll('.legend .dot').length).toBe(3)
    expect(el.querySelector('rules-list')).not.toBeNull()
  })

  it('marks the legend dots as decorative', () => {
    const dots = el.querySelectorAll('.legend .dot')
    dots.forEach(dot => {
      expect(dot.getAttribute('aria-hidden')).toBe('true')
    })
  })

  it('forwards rules to the rules-list', () => {
    el.setRules([rule(1)])
    const list = el.querySelector('rules-list')
    expect(list?.querySelector('.rule-row')).not.toBeNull()
    expect(list?.textContent).toContain('1 rules · 1 enabled')
  })

  it('focuses the draft name input when Add rule is clicked', () => {
    el.querySelector<HTMLButtonElement>('#btn-add-rule')?.click()
    expect(document.activeElement).toBe(el.querySelector('#rule-draft .rule-name'))
  })
})
