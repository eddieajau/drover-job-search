/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import './attention-list.js'
import type { AttentionItem, AttentionList } from './attention-list.js'

function sampleItems(): AttentionItem[] {
  return [
    {
      kind: 'discovered_missing',
      message: '5 discovered jobs missing details',
      detail: 'Sitting in the fetch queue',
    },
    { kind: 'queue_stuck', message: '2 queue items stuck (>24h)', detail: 'Queued for over 24 hours' },
  ]
}

describe('attention-list', () => {
  let el: AttentionList

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('attention-list')
    document.body.appendChild(el)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders the all-clear empty state when data is null', () => {
    el.setData(null)
    expect(el.querySelector('.widget-sub')?.textContent).toBe('All clear')
    expect(el.querySelectorAll('.attention-row').length).toBe(0)
  })

  it('renders the same empty state when data is an empty array', () => {
    el.setData([])
    expect(el.querySelector('.widget-sub')?.textContent).toBe('All clear')
    expect(el.querySelectorAll('.attention-row').length).toBe(0)
  })

  it('renders one attention-row with message and detail', () => {
    el.setData([sampleItems()[0]])
    const rows = el.querySelectorAll('.attention-row')
    expect(rows.length).toBe(1)
    const text = rows[0].querySelector('.attention-text')
    expect(text?.textContent).toContain('5 discovered jobs missing details')
    expect(text?.querySelector('.sub')?.textContent).toBe('Sitting in the fetch queue')
  })

  it('links every row to #queues', () => {
    el.setData(sampleItems())
    const links = el.querySelectorAll<HTMLAnchorElement>('.attention-link')
    expect(links.length).toBe(2)
    for (const link of links) {
      expect(link.getAttribute('href')).toBe('#queues')
    }
  })

  it('shows the item count in widget-sub for multiple items', () => {
    el.setData(sampleItems())
    expect(el.querySelector('.widget-sub')?.textContent).toBe('2 items')

    el.setData([sampleItems()[0]])
    expect(el.querySelector('.widget-sub')?.textContent).toBe('1 item')
  })

  it('uses the kind as the dot colour class', () => {
    el.setData(sampleItems())
    const dots = el.querySelectorAll('.attention-dot')
    expect(dots[0].classList.contains('discovered_missing')).toBe(true)
    expect(dots[1].classList.contains('queue_stuck')).toBe(true)
  })
})
