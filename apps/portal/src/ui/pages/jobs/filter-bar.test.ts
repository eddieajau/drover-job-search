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
    const received: { priority: string; status: string; search: string } = {
      priority: '',
      status: '',
      search: '',
    }
    el.addEventListener('filter-bar:change', event => {
      const detail = (event as CustomEvent<{ priority: string; status: string; search: string }>).detail
      received.priority = detail.priority
      received.status = detail.status
      received.search = detail.search
    })

    const priority = el.querySelector<HTMLSelectElement>('#filter-priority')
    if (priority) {
      priority.value = '2'
    }
    el.dispatchEvent(new Event('change', { bubbles: true }))

    expect(received).toEqual({ priority: '2', status: '', search: '' })
  })

  it('restores filter values via setFilters', () => {
    el.setFilters({ priority: '3', status: 'applied', search: 'engineer' })
    expect(el.querySelector<HTMLSelectElement>('#filter-priority')?.value).toBe('3')
    expect(el.querySelector<HTMLSelectElement>('#filter-status')?.value).toBe('applied')
    expect(el.querySelector<HTMLInputElement>('#filter-search')?.value).toBe('engineer')
  })
})
