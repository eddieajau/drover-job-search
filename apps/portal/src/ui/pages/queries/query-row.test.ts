/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import type { Query } from '../../../shared/types.js'
import './query-row.js'
import type { QueryRow } from './query-row.js'

function createRow(attrs: Record<string, string> = {}): QueryRow {
  const row = document.createElement('query-row') as QueryRow
  for (const [key, value] of Object.entries(attrs)) {
    row.setAttribute(key, value)
  }
  document.body.appendChild(row)
  return row
}

describe('query-row', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders the row grid with text, location, chips, date and Edit link', () => {
    const row = createRow({
      'query-id': '3',
      'query-text': 'Staff Engineer',
      location: 'Brisbane, QLD, Australia',
      'work-type': 'hybrid',
      'job-type': 'fulltime,contract',
      enabled: '',
      'added-date': '2026-07-12',
    })

    expect(row.querySelector('.query-row')?.classList.contains('is-disabled')).toBe(false)
    expect(row.querySelector('.query-text')?.textContent).toBe('Staff Engineer')
    expect(row.querySelector<HTMLAnchorElement>('.query-text')?.getAttribute('href')).toBe('#queries/edit?id=3')
    expect(row.querySelector('.query-loc')?.textContent).toBe('Brisbane, QLD, Australia')
    const chips = Array.from(row.querySelectorAll('.query-chips .chip'), chip => chip.textContent)
    expect(chips).toEqual(['Hybrid', 'Full-time', 'Contract'])
    expect(row.querySelector('.query-date')?.textContent).toBe('Added 2026-07-12')
    expect(row.querySelector<HTMLAnchorElement>('.row-edit')?.getAttribute('href')).toBe('#queries/edit?id=3')
  })

  it('renders a checked toggle-switch when enabled', () => {
    const row = createRow({ 'query-id': '1', 'query-text': 'Engineer', enabled: '' })
    expect(row.querySelector<HTMLInputElement>('toggle-switch input')?.checked).toBe(true)
  })

  it('adds the is-disabled class and an unchecked switch when disabled', () => {
    const row = createRow({ 'query-id': '2', 'query-text': 'Developer' })
    expect(row.querySelector('.query-row')?.classList.contains('is-disabled')).toBe(true)
    expect(row.querySelector<HTMLInputElement>('toggle-switch input')?.checked).toBe(false)
  })

  it('dispatches query-row:toggle with a reconstructed Query when the switch is toggled', () => {
    const row = createRow({
      'query-id': '5',
      'query-text': 'Platform Engineer',
      location: 'Melbourne',
      'work-type': 'hybrid',
      'job-type': 'fulltime,contract',
      enabled: '',
      'added-date': '2026-07-18',
    })

    const received: Array<{ query: Query }> = []
    row.addEventListener('query-row:toggle', event => {
      received.push((event as CustomEvent<{ query: Query }>).detail)
    })

    const input = row.querySelector<HTMLInputElement>('toggle-switch input')
    input?.click()

    expect(received.length).toBe(1)
    expect(received[0]?.query.id).toBe(5)
    expect(received[0]?.query.queryText).toBe('Platform Engineer')
    expect(received[0]?.query.enabled).toBe(false)
    expect(received[0]?.query.queryOptions).toEqual({
      location: 'Melbourne',
      workType: 'hybrid',
      jobType: 'fulltime,contract',
    })
  })
})
