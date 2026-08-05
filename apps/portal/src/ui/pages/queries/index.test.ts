/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'
import type { Query } from '../../../shared/types.js'
import './index.js'
import type { QueriesPage } from './index.js'

function queries(): Query[] {
  return [
    {
      id: 1,
      provider: 'linkedin',
      queryText: 'Staff Engineer',
      queryOptions: { location: 'Sydney' },
      enabled: true,
      createdAt: '2026-08-05 00:00:00',
    },
  ]
}

describe('queries-page', () => {
  let el: QueriesPage

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('queries-page')
    document.body.appendChild(el)
  })

  it('renders the title, new query link and list', () => {
    expect(el.querySelector('.page-title')?.textContent).toBe('Queries')
    expect(el.querySelector('a.new-query')?.getAttribute('href')).toBe('#queries/edit')
    expect(el.querySelector('queries-list')).not.toBeNull()
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
