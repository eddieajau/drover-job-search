/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import type { Query } from '../../../shared/types.js'
import './query-row.js'
import './queries-list.js'
import type { QueriesList } from './queries-list.js'

function queries(count: number): Query[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    provider: 'linkedin',
    queryText: `Staff Engineer ${i + 1}`,
    queryOptions: i % 2 === 0 ? { location: 'Sydney' } : undefined,
    enabled: true,
    createdAt: '2026-08-05 00:00:00',
  }))
}

describe('queries-list', () => {
  let el: QueriesList

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('queries-list')
    document.body.appendChild(el)
  })

  it('renders an empty message when there are no queries', () => {
    el.setQueries([])
    expect(el.textContent).toContain('No queries registered yet.')
  })

  it('renders query rows as query-row elements with edit links', () => {
    el.setQueries(queries(2))
    const rows = el.querySelectorAll('query-row')
    expect(rows.length).toBe(2)
    expect(rows[0]?.querySelector('.query-text')?.textContent).toBe('Staff Engineer 1')
    expect(rows[0]?.querySelector('.query-loc')?.textContent).toBe('Sydney')
    expect(rows[0]?.querySelector<HTMLAnchorElement>('.query-text')?.getAttribute('href')).toBe('#queries/edit?id=1')
  })

  it('renders a pager-nav in the panel-foot with correct attributes and count', () => {
    el.setQueries(queries(12))
    const pager = el.querySelector('.panel-foot pager-nav')
    expect(pager).not.toBeNull()
    expect(pager?.getAttribute('page')).toBe('1')
    expect(pager?.getAttribute('page-size')).toBe('10')
    expect(pager?.getAttribute('total')).toBe('12')
    expect(pager?.querySelector('.pager-info')?.textContent).toContain('Page 1 of 2')
    expect(el.querySelector('.panel-foot .count')?.textContent).toBe('12 queries')
    expect(el.querySelectorAll('query-row').length).toBe(10)
  })

  it('advances the page slice when pager:change is dispatched', () => {
    el.setQueries(queries(12))
    el.dispatchEvent(new CustomEvent('pager:change', { bubbles: true, detail: { page: 2, pageSize: 10 } }))
    expect(el.querySelector('.panel-foot pager-nav')?.getAttribute('page')).toBe('2')
    expect(el.querySelector('.panel-foot pager-nav')?.querySelector('.pager-info')?.textContent).toContain(
      'Page 2 of 2'
    )
    expect(el.querySelectorAll('query-row').length).toBe(2)
    expect(el.querySelector('query-row')?.textContent).toContain('Staff Engineer 11')
    expect(el.querySelector('.panel-foot .count')?.textContent).toBe('12 queries')
  })

  it('resets to the first page when queries are reloaded', () => {
    el.setQueries(queries(12))
    el.dispatchEvent(new CustomEvent('pager:change', { bubbles: true, detail: { page: 2, pageSize: 10 } }))
    expect(el.querySelector('.panel-foot pager-nav')?.getAttribute('page')).toBe('2')
    el.setQueries(queries(12))
    expect(el.querySelector('.panel-foot pager-nav')?.getAttribute('page')).toBe('1')
    expect(el.querySelector('.panel-foot pager-nav')?.querySelector('.pager-info')?.textContent).toContain(
      'Page 1 of 2'
    )
  })

  it('forwards query-row:toggle as queries-list:toggle', () => {
    el.setQueries(queries(1))
    const received = { query: null as Query | null }
    el.addEventListener('queries-list:toggle', event => {
      received.query = (event as CustomEvent<{ query: Query }>).detail.query
    })
    const input = el.querySelector<HTMLInputElement>('query-row toggle-switch input')
    if (input) {
      input.checked = false
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
    expect(received.query?.id).toBe(1)
    expect(received.query?.enabled).toBe(false)
  })
})
