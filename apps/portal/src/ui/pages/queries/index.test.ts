/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import type { Query } from '../../../shared/types.js'
import './index.js'
import type { QueriesPage } from './index.js'

function queries(count = 1): Query[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    provider: 'linkedin',
    queryText: i === 0 ? 'Staff Engineer' : `Query ${i + 1}`,
    queryOptions: { location: 'Sydney' },
    enabled: i < 2,
    createdAt: '2026-08-05 00:00:00',
  }))
}

describe('queries-page', () => {
  let el: QueriesPage

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('queries-page')
    document.body.appendChild(el)
  })

  it('renders the page shell with head and panel', () => {
    expect(el.querySelector('.page > .page-head h1')?.textContent).toBe('Queries')
    expect(el.querySelector('.page-count')?.textContent).toBe('0 queries · 0 enabled')
    expect(el.querySelector('.page-head .btn.primary')?.getAttribute('href')).toBe('#queries/edit')
    expect(el.querySelector('.panel > queries-list')).not.toBeNull()
  })

  it('reflects counts from setQueries in the head', () => {
    el.setQueries(queries(3))
    expect(el.querySelector('.page-count')?.textContent).toBe('3 queries · 2 enabled')
  })

  it('dispatches queries-page:ready on connect', () => {
    const received = { fired: false }
    document.addEventListener('queries-page:ready', () => {
      received.fired = true
    })
    document.body.appendChild(document.createElement('queries-page'))
    expect(received.fired).toBe(true)
  })

  it('passes queries through to the list', () => {
    el.setQueries(queries())
    expect(el.querySelector('queries-list')?.textContent).toContain('Staff Engineer')
  })
})
