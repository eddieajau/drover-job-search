/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import type { FactResponse } from '../../../shared/types.js'
import './fact-row.js'
import './facts-list.js'
import type { FactsList } from './facts-list.js'

function facts(count: number): FactResponse[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    category: 'skill',
    label: `TypeScript ${i + 1}`,
    detail: null,
    evidenceType: null,
    startedAt: null,
    endedAt: null,
    period: null,
    confidence: 'high',
    active: true,
    createdAt: '2026-08-05 00:00:00',
    updatedAt: '2026-08-05 00:00:00',
  }))
}

describe('facts-list', () => {
  let el: FactsList

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('facts-list')
    document.body.appendChild(el)
  })

  it('renders an empty message when there are no facts', () => {
    el.setFacts([])
    expect(el.textContent).toContain('No facts yet.')
  })

  it('renders fact rows as fact-row elements with edit links', () => {
    el.setFacts(facts(2))
    const rows = el.querySelectorAll('fact-row')
    expect(rows.length).toBe(2)
    expect(rows[0]?.querySelector('.fact-text')?.textContent).toBe('TypeScript 1')
    expect(rows[0]?.querySelector<HTMLAnchorElement>('.fact-text')?.getAttribute('href')).toBe('#facts/edit?id=1')
  })

  it('renders a pager-nav in the panel-foot with correct attributes and count', () => {
    el.setFacts(facts(12))
    const pager = el.querySelector('.panel-foot pager-nav')
    expect(pager).not.toBeNull()
    expect(pager?.getAttribute('page')).toBe('1')
    expect(pager?.getAttribute('page-size')).toBe('10')
    expect(pager?.getAttribute('total')).toBe('12')
    expect(pager?.querySelector('.pager-info')?.textContent).toContain('Page 1 of 2')
    expect(el.querySelector('.panel-foot .count')?.textContent).toBe('12 facts')
    expect(el.querySelectorAll('fact-row').length).toBe(10)
  })

  it('advances the page slice when pager:change is dispatched', () => {
    el.setFacts(facts(12))
    el.dispatchEvent(new CustomEvent('pager:change', { bubbles: true, detail: { page: 2, pageSize: 10 } }))
    expect(el.querySelector('.panel-foot pager-nav')?.getAttribute('page')).toBe('2')
    expect(el.querySelector('.panel-foot pager-nav')?.querySelector('.pager-info')?.textContent).toContain(
      'Page 2 of 2'
    )
    expect(el.querySelectorAll('fact-row').length).toBe(2)
    expect(el.querySelector('fact-row')?.textContent).toContain('TypeScript 11')
    expect(el.querySelector('.panel-foot .count')?.textContent).toBe('12 facts')
  })

  it('resets to the first page when facts are reloaded', () => {
    el.setFacts(facts(12))
    el.dispatchEvent(new CustomEvent('pager:change', { bubbles: true, detail: { page: 2, pageSize: 10 } }))
    expect(el.querySelector('.panel-foot pager-nav')?.getAttribute('page')).toBe('2')
    el.setFacts(facts(12))
    expect(el.querySelector('.panel-foot pager-nav')?.getAttribute('page')).toBe('1')
    expect(el.querySelector('.panel-foot pager-nav')?.querySelector('.pager-info')?.textContent).toContain(
      'Page 1 of 2'
    )
  })
})
