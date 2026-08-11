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
    expect(el.querySelector<HTMLButtonElement>('#btn-seed-rules')?.textContent).toContain('Seed rules from gap facts')
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

  it('dispatches signals-page:seed when the seed button is clicked', () => {
    let fired = false
    el.addEventListener('signals-page:seed', () => {
      fired = true
    })
    el.querySelector<HTMLButtonElement>('#btn-seed-rules')?.click()
    expect(fired).toBe(true)
  })

  it('setSeedBusy disables the seed button and swaps its label', () => {
    el.setSeedBusy(true)
    const btn = el.querySelector<HTMLButtonElement>('#btn-seed-rules')
    expect(btn?.disabled).toBe(true)
    expect(btn?.textContent).toContain('Seeding rules')
    el.setSeedBusy(false)
    expect(btn?.disabled).toBe(false)
    expect(btn?.textContent).toContain('Seed rules from gap facts')
  })

  it('showSeedResult renders the created count in the live region', () => {
    const notice = el.querySelector<HTMLElement>('#seed-notice')
    expect(notice?.getAttribute('aria-live')).toBe('polite')
    el.showSeedResult(2)
    expect(notice?.textContent).toContain('Created 2 rules from gap facts')
    el.showSeedResult(1)
    expect(notice?.textContent).toContain('Created 1 rule from gap facts')
    el.showSeedResult(0)
    expect(notice?.textContent).toContain('No new rules from gap facts')
    el.showSeedResult(-1)
    expect(notice?.textContent).toContain('Seeding failed')
  })
})
