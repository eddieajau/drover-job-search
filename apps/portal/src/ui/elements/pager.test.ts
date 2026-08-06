/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import './pager.js'
import type { Pager } from './pager.js'

function createPager(): Pager {
  const el = document.createElement('pager-nav')
  document.body.appendChild(el)
  return el
}

describe('pager', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders the page indicator from attributes', () => {
    const el = createPager()
    el.setAttribute('page', '2')
    el.setAttribute('page-size', '10')
    el.setAttribute('total', '25')
    expect(el.querySelector('.pager-info')?.textContent).toBe('Page 2 of 3')
    expect(el.querySelector<HTMLButtonElement>('#pager-prev')?.disabled).toBe(false)
    expect(el.querySelector<HTMLButtonElement>('#pager-next')?.disabled).toBe(false)
  })

  it('disables prev on the first page', () => {
    const el = createPager()
    el.setAttribute('page', '1')
    el.setAttribute('page-size', '10')
    el.setAttribute('total', '25')
    expect(el.querySelector<HTMLButtonElement>('#pager-prev')?.disabled).toBe(true)
    expect(el.querySelector<HTMLButtonElement>('#pager-next')?.disabled).toBe(false)
  })

  it('disables next on the last page', () => {
    const el = createPager()
    el.setAttribute('page', '3')
    el.setAttribute('page-size', '10')
    el.setAttribute('total', '25')
    expect(el.querySelector<HTMLButtonElement>('#pager-prev')?.disabled).toBe(false)
    expect(el.querySelector<HTMLButtonElement>('#pager-next')?.disabled).toBe(true)
  })

  it('dispatches pager:change with the next page on next click', () => {
    const el = createPager()
    el.setAttribute('page', '2')
    el.setAttribute('page-size', '10')
    el.setAttribute('total', '25')

    const received: Array<CustomEvent<{ page: number; pageSize: number }>> = []
    el.addEventListener('pager:change', event => {
      received.push(event as CustomEvent<{ page: number; pageSize: number }>)
    })
    el.querySelector<HTMLButtonElement>('#pager-next')?.click()

    expect(received.length).toBe(1)
    expect(received[0]?.detail).toEqual({ page: 3, pageSize: 10 })
  })

  it('resets to page 1 with the new size when the size select changes', () => {
    const el = createPager()
    el.setAttribute('page', '2')
    el.setAttribute('page-size', '10')
    el.setAttribute('total', '25')

    const received: Array<CustomEvent<{ page: number; pageSize: number }>> = []
    el.addEventListener('pager:change', event => {
      received.push(event as CustomEvent<{ page: number; pageSize: number }>)
    })
    const select = el.querySelector<HTMLSelectElement>('#pager-size')
    if (select) {
      select.value = '25'
    }
    select?.dispatchEvent(new Event('change', { bubbles: true }))

    expect(received.length).toBe(1)
    expect(received[0]?.detail).toEqual({ page: 1, pageSize: 25 })
  })
})
