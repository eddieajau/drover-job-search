/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import type { FactResponse } from '../../../shared/types.js'
import './index.js'
import type { FactsPage } from './index.js'

function facts(count = 1): FactResponse[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    category: i % 2 === 0 ? 'skill' : 'role',
    label: i === 0 ? 'TypeScript' : `Fact ${i + 1}`,
    detail: null,
    evidenceType: null,
    startedAt: null,
    endedAt: null,
    period: null,
    confidence: 'high',
    active: i < 2,
    createdAt: '2026-08-05 00:00:00',
    updatedAt: '2026-08-05 00:00:00',
  }))
}

describe('facts-page', () => {
  let el: FactsPage

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('facts-page')
    document.body.appendChild(el)
  })

  it('renders the page shell with head and panel', () => {
    expect(el.querySelector('.page > .page-head h1')?.textContent).toBe('Facts')
    expect(el.querySelector('.page-count')?.textContent).toBe('0 facts · 0 active')
    expect(el.querySelector('.page-head .btn.primary')?.getAttribute('href')).toBe('#facts/edit')
    expect(el.querySelector('.panel > facts-list')).not.toBeNull()
  })

  it('reflects counts from setFacts in the head', () => {
    el.setFacts(facts(3))
    expect(el.querySelector('.page-count')?.textContent).toBe('3 facts · 2 active')
  })

  it('dispatches facts-page:ready on connect', () => {
    const received = { fired: false }
    document.addEventListener('facts-page:ready', () => {
      received.fired = true
    })
    document.body.appendChild(document.createElement('facts-page'))
    expect(received.fired).toBe(true)
  })

  it('passes facts through to the list', () => {
    el.setFacts(facts())
    expect(el.querySelector('facts-list')?.textContent).toContain('TypeScript')
  })

  it('renders category and active filter selects', () => {
    expect(el.querySelector('.fact-filter-category')).not.toBeNull()
    expect(el.querySelector('.fact-filter-active')).not.toBeNull()
  })

  it('dispatches facts-page:filter when a filter select changes', () => {
    const received: Array<{ category: string; active: string }> = []
    el.addEventListener('facts-page:filter', event => {
      received.push((event as CustomEvent).detail)
    })
    const categorySelect = el.querySelector<HTMLSelectElement>('.fact-filter-category')
    if (categorySelect) {
      categorySelect.value = 'skill'
      categorySelect.dispatchEvent(new Event('change', { bubbles: true }))
    }
    expect(received.length).toBe(1)
    expect(received[0]?.category).toBe('skill')
  })
})
