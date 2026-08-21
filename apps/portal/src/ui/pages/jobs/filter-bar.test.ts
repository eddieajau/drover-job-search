/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
    const received: { status: string; search: string; sort: string } = {
      status: '',
      search: '',
      sort: '',
    }
    el.addEventListener('filter-bar:change', event => {
      const detail = (event as CustomEvent<{ status: string; search: string; sort: string }>).detail
      received.status = detail.status
      received.search = detail.search
      received.sort = detail.sort
    })

    el.dispatchEvent(new Event('change', { bubbles: true }))

    expect(received).toEqual({ status: 'new', search: '', sort: 'score' })
  })

  it('restores filter values via setFilters', () => {
    el.setFilters({ status: 'discovered', search: 'engineer', sort: 'company' })
    expect(el.querySelector<HTMLSelectElement>('#filter-status')?.value).toBe('discovered')
    expect(el.querySelector<HTMLInputElement>('#filter-search')?.value).toBe('engineer')
    expect(el.querySelector<HTMLSelectElement>('#filter-sort')?.value).toBe('company')
  })

  it('renders the search input above the two filter selects', () => {
    const elementChildren = Array.from(el.childNodes).filter(
      (node): node is Element => node.nodeType === Node.ELEMENT_NODE
    )
    const ids = elementChildren.map(node => node.id)
    expect(ids).toEqual(['filter-search', 'filter-status', 'filter-sort'])
  })

  it('renders the status select with exactly ten options in order', () => {
    const statusSelect = el.querySelector<HTMLSelectElement>('#filter-status')
    expect(statusSelect).not.toBeNull()
    const options = Array.from(statusSelect!.querySelectorAll('option')).map(o => o.value)
    expect(options).toEqual([
      'all',
      'new',
      'discovered',
      'applied',
      'interviewing',
      'skipped',
      'blocked',
      'declined',
      'unsuccessful',
      'successful',
    ])
  })

  it('labels the status options with the All / New / Discovered / Applied / Interviewing / Skipped / Blocked / Declined / Unsuccessful / Successful names', () => {
    const statusSelect = el.querySelector<HTMLSelectElement>('#filter-status')
    expect(statusSelect).not.toBeNull()
    const labels = Array.from(statusSelect!.querySelectorAll('option')).map(o => o.textContent)
    expect(labels).toEqual([
      'All',
      'New',
      'Discovered',
      'Applied',
      'Interviewing',
      'Skipped',
      'Blocked',
      'Declined',
      'Unsuccessful',
      'Successful',
    ])
  })

  it('defaults the status select to New', () => {
    const statusSelect = el.querySelector<HTMLSelectElement>('#filter-status')
    const defaultOption = statusSelect?.querySelector('option[value="new"]')
    expect(defaultOption?.textContent).toBe('New')
    expect(defaultOption?.getAttribute('selected')).not.toBeNull()
    expect(statusSelect?.value).toBe('new')
  })

  it('renders no score-bucket select', () => {
    expect(el.querySelector('#filter-score')).toBeNull()
  })

  it('dispatches a change without a score field', () => {
    let received: { score?: string } = {}
    el.addEventListener('filter-bar:change', event => {
      received = (event as CustomEvent<{ score?: string }>).detail
    })

    el.dispatchEvent(new Event('change', { bubbles: true }))

    expect(received).not.toHaveProperty('score')
  })

  it('renders the sort select with four options and no triage', () => {
    const sortSelect = el.querySelector<HTMLSelectElement>('#filter-sort')
    expect(sortSelect).not.toBeNull()
    const options = Array.from(sortSelect!.querySelectorAll('option')).map(o => o.value)
    expect(options).toEqual(['score', 'posted', 'applied', 'company'])
    expect(sortSelect?.querySelector('option[value="triage"]')).toBeNull()
  })

  it('dispatches filter-bar:change with sort applied when Applied option is selected', () => {
    let received: { sort: string } | undefined
    el.addEventListener('filter-bar:change', event => {
      received = (event as CustomEvent<{ sort: string }>).detail
    })

    const sortSelect = el.querySelector<HTMLSelectElement>('#filter-sort')!
    sortSelect.value = 'applied'
    el.dispatchEvent(new Event('change', { bubbles: true }))

    expect(received?.sort).toBe('applied')
  })

  it('setFilters with a non-default sort updates the select value', () => {
    el.setFilters({ status: 'new', search: '', sort: 'posted' })
    expect(el.querySelector<HTMLSelectElement>('#filter-sort')?.value).toBe('posted')
  })

  it('setFilters with defaults updates status and sort', () => {
    el.setFilters({ status: 'new', search: '', sort: 'score' })
    expect(el.querySelector<HTMLSelectElement>('#filter-status')?.value).toBe('new')
    expect(el.querySelector<HTMLSelectElement>('#filter-sort')?.value).toBe('score')
  })

  it('dispatches filter-bar:change with status blocked when Blocked option is selected', () => {
    let received: { status: string } | undefined
    el.addEventListener('filter-bar:change', event => {
      received = (event as CustomEvent<{ status: string }>).detail
    })

    const statusSelect = el.querySelector<HTMLSelectElement>('#filter-status')!
    statusSelect.value = 'blocked'
    el.dispatchEvent(new Event('change', { bubbles: true }))

    expect(received).toEqual({ status: 'blocked', search: '', sort: 'score' })
  })

  it('dispatches filter-bar:change with status declined when Declined option is selected', () => {
    let received: { status: string } | undefined
    el.addEventListener('filter-bar:change', event => {
      received = (event as CustomEvent<{ status: string }>).detail
    })

    const statusSelect = el.querySelector<HTMLSelectElement>('#filter-status')!
    statusSelect.value = 'declined'
    el.dispatchEvent(new Event('change', { bubbles: true }))

    expect(received).toEqual({ status: 'declined', search: '', sort: 'score' })
  })

  it('dispatches filter-bar:change with status unsuccessful when Unsuccessful option is selected', () => {
    let received: { status: string } | undefined
    el.addEventListener('filter-bar:change', event => {
      received = (event as CustomEvent<{ status: string }>).detail
    })

    const statusSelect = el.querySelector<HTMLSelectElement>('#filter-status')!
    statusSelect.value = 'unsuccessful'
    el.dispatchEvent(new Event('change', { bubbles: true }))

    expect(received).toEqual({ status: 'unsuccessful', search: '', sort: 'score' })
  })

  it('dispatches filter-bar:change with status successful when Successful option is selected', () => {
    let received: { status: string } | undefined
    el.addEventListener('filter-bar:change', event => {
      received = (event as CustomEvent<{ status: string }>).detail
    })

    const statusSelect = el.querySelector<HTMLSelectElement>('#filter-status')!
    statusSelect.value = 'successful'
    el.dispatchEvent(new Event('change', { bubbles: true }))

    expect(received).toEqual({ status: 'successful', search: '', sort: 'score' })
  })

  it('dispatches filter-bar:change with status interviewing when Interviewing option is selected', () => {
    let received: { status: string } | undefined
    el.addEventListener('filter-bar:change', event => {
      received = (event as CustomEvent<{ status: string }>).detail
    })

    const statusSelect = el.querySelector<HTMLSelectElement>('#filter-status')!
    statusSelect.value = 'interviewing'
    el.dispatchEvent(new Event('change', { bubbles: true }))

    expect(received).toEqual({ status: 'interviewing', search: '', sort: 'score' })
  })
})

describe('filter-bar debounce', () => {
  let el: FilterBar

  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
    el = document.createElement('filter-bar')
    document.body.appendChild(el)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces input events by 250ms', () => {
    let callCount = 0
    el.addEventListener('filter-bar:change', () => {
      callCount++
    })

    const search = el.querySelector<HTMLInputElement>('#filter-search')
    if (search) {
      search.value = 'go'
      search.dispatchEvent(new Event('input', { bubbles: true }))
      search.value = 'goo'
      search.dispatchEvent(new Event('input', { bubbles: true }))
    }

    expect(callCount).toBe(0)

    vi.advanceTimersByTime(250)

    expect(callCount).toBe(1)
  })

  it('fires change event immediately on Enter even with pending debounce', () => {
    let callCount = 0
    el.addEventListener('filter-bar:change', () => {
      callCount++
    })

    const search = el.querySelector<HTMLInputElement>('#filter-search')
    if (search) {
      search.value = 'go'
      search.dispatchEvent(new Event('input', { bubbles: true }))
      search.dispatchEvent(new Event('change', { bubbles: true }))
    }

    expect(callCount).toBe(1)

    vi.advanceTimersByTime(250)

    expect(callCount).toBe(2)
  })

  it('clears pending timer on disconnectedCallback', () => {
    let callCount = 0
    el.addEventListener('filter-bar:change', () => {
      callCount++
    })

    const search = el.querySelector<HTMLInputElement>('#filter-search')
    if (search) {
      search.value = 'go'
      search.dispatchEvent(new Event('input', { bubbles: true }))
    }

    document.body.removeChild(el)

    vi.advanceTimersByTime(250)

    expect(callCount).toBe(0)
  })
})
