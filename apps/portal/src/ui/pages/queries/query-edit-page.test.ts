/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import type { Query } from '../../../shared/types.js'
import './query-edit-page.js'
import type { QueryEditPage } from './query-edit-page.js'

function query(): Query {
  return {
    id: 1,
    provider: 'linkedin',
    queryText: 'Staff Engineer',
    queryOptions: { location: 'Brisbane', workType: 'hybrid', jobType: 'fulltime,contract' },
    enabled: true,
    createdAt: '2026-08-05 00:00:00',
  }
}

describe('query-edit-page', () => {
  let el: QueryEditPage

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('query-edit-page')
    document.body.appendChild(el)
  })

  it('dispatches query-edit-page:ready on connect', () => {
    const received = { fired: false }
    document.addEventListener('query-edit-page:ready', () => {
      received.fired = true
    })
    document.body.appendChild(document.createElement('query-edit-page'))
    expect(received.fired).toBe(true)
  })

  it('renders a blank form for a new query, enabled by default', () => {
    el.setState({})
    expect(el.querySelector('#edit-q-text')?.getAttribute('value')).toBe('')
    expect(el.querySelector<HTMLInputElement>('#edit-q-enabled')?.checked).toBe(true)
    expect(el.querySelector('#btn-delete-query')).toBeNull()
    expect(el.querySelector('.page-title')?.textContent).toBe('New Query')
  })

  it('prefills the form for an existing query', () => {
    el.setState({ query: query() })
    expect(el.querySelector<HTMLInputElement>('#edit-q-text')?.value).toBe('Staff Engineer')
    expect(el.querySelector<HTMLInputElement>('#edit-q-location')?.value).toBe('Brisbane')
    expect(el.querySelector<HTMLSelectElement>('#edit-q-work-type')?.value).toBe('hybrid')
    expect(el.querySelector<HTMLInputElement>('#edit-q-enabled')?.checked).toBe(true)
    expect(el.querySelector('.page-title')?.textContent).toBe('Edit Query')
  })

  it('dispatches query-edit-page:save with the edited values', () => {
    el.setState({ query: query() })
    const received = { fired: false }
    el.addEventListener('query-edit-page:save', event => {
      received.fired = true
      expect((event as CustomEvent).detail).toEqual({
        id: 1,
        queryText: 'Staff Engineer',
        queryOptions: { location: 'Brisbane', workType: 'hybrid', jobType: 'fulltime,contract' },
        enabled: true,
      })
    })
    el.querySelector<HTMLButtonElement>('#btn-save-query')?.click()
    expect(received.fired).toBe(true)
  })

  it('dispatches query-edit-page:save without id for a new query', () => {
    el.setState({})
    el.querySelector<HTMLInputElement>('#edit-q-text')!.value = 'Staff Engineer'
    const received = { fired: false }
    el.addEventListener('query-edit-page:save', event => {
      received.fired = true
      expect((event as CustomEvent).detail.id).toBeUndefined()
    })
    el.querySelector<HTMLButtonElement>('#btn-save-query')?.click()
    expect(received.fired).toBe(true)
  })

  it('does not dispatch save when the query text is empty', () => {
    el.setState({})
    const received = { fired: false }
    el.addEventListener('query-edit-page:save', () => {
      received.fired = true
    })
    el.querySelector<HTMLButtonElement>('#btn-save-query')?.click()
    expect(received.fired).toBe(false)
  })

  it('reports an unchecked enabled box', () => {
    el.setState({ query: query() })
    const received = { enabled: true }
    el.addEventListener('query-edit-page:save', event => {
      received.enabled = (event as CustomEvent).detail.enabled
    })
    const checkbox = el.querySelector<HTMLInputElement>('#edit-q-enabled')
    if (checkbox) {
      checkbox.checked = false
    }
    el.querySelector<HTMLButtonElement>('#btn-save-query')?.click()
    expect(received.enabled).toBe(false)
  })
})
