/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import './filter-bar.js'
import type { FilterBar } from './filter-bar.js'

describe('filter-bar', () => {
  let el: FilterBar

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('filter-bar')
    document.body.appendChild(el)
  })

  it('dispatches filter-bar:change with the current values', () => {
    const received: { priority: string; status: string; search: string; score: string } = {
      priority: '',
      status: '',
      search: '',
      score: '',
    }
    el.addEventListener('filter-bar:change', event => {
      const detail = (event as CustomEvent<{ priority: string; status: string; search: string; score: string }>).detail
      received.priority = detail.priority
      received.status = detail.status
      received.search = detail.search
      received.score = detail.score
    })

    const priority = el.querySelector<HTMLSelectElement>('#filter-priority')
    if (priority) {
      priority.value = '2'
    }
    el.dispatchEvent(new Event('change', { bubbles: true }))

    expect(received).toEqual({ priority: '2', status: '', search: '', score: '' })
  })

  it('restores filter values via setFilters', () => {
    el.setFilters({ priority: '3', status: 'applied', search: 'engineer', score: 'hot' })
    expect(el.querySelector<HTMLSelectElement>('#filter-priority')?.value).toBe('3')
    expect(el.querySelector<HTMLSelectElement>('#filter-status')?.value).toBe('applied')
    expect(el.querySelector<HTMLInputElement>('#filter-search')?.value).toBe('engineer')
    expect(el.querySelector<HTMLSelectElement>('#filter-score')?.value).toBe('hot')
  })

  it('renders the score-bucket select with expected options', () => {
    const scoreSelect = el.querySelector<HTMLSelectElement>('#filter-score')
    expect(scoreSelect).not.toBeNull()
    const options = Array.from(scoreSelect!.querySelectorAll('option')).map(o => o.value)
    expect(options).toEqual(['', 'hot', 'neutral', 'auto-skip'])
  })

  it('labels the default status option as excluding skipped jobs', () => {
    const statusSelect = el.querySelector<HTMLSelectElement>('#filter-status')
    expect(statusSelect).not.toBeNull()
    const allOption = statusSelect?.querySelector('option[value=""]')
    expect(allOption?.textContent).toBe('All (excl. skipped)')
    expect(allOption?.getAttribute('selected')).not.toBeNull()
  })

  it('dispatches score filter value on change', () => {
    const received: { score: string } = { score: '' }
    el.addEventListener('filter-bar:change', event => {
      received.score = (event as CustomEvent<{ score: string }>).detail.score
    })

    const score = el.querySelector<HTMLSelectElement>('#filter-score')
    if (score) {
      score.value = 'auto-skip'
    }
    el.dispatchEvent(new Event('change', { bubbles: true }))

    expect(received.score).toBe('auto-skip')
  })
})
