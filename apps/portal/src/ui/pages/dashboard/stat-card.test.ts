/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import './stat-card.js'
import type { StatCard } from './stat-card.js'

describe('stat-card', () => {
  let el: StatCard

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('stat-card')
    document.body.appendChild(el)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders the label and a numeric value', () => {
    el.setData({ label: 'Applied · 14d', value: 14 })
    expect(el.querySelector('.stat-label')?.textContent).toBe('Applied · 14d')
    expect(el.querySelector('.stat-value')?.textContent).toBe('14')
  })

  it('renders a string value', () => {
    el.setData({ label: 'Interview rate', value: '15%' })
    expect(el.querySelector('.stat-value')?.textContent).toBe('15%')
  })

  it('renders an up delta with a plus sign', () => {
    el.setData({ label: 'Applied', value: 14, delta: { value: 2, direction: 'up' } })
    const delta = el.querySelector('.stat-delta')
    expect(delta?.classList.contains('up')).toBe(true)
    expect(delta?.textContent).toBe('+2')
  })

  it('renders a down delta with a minus sign', () => {
    el.setData({ label: 'Applied', value: 5, delta: { value: 3, direction: 'down' } })
    const delta = el.querySelector('.stat-delta')
    expect(delta?.classList.contains('down')).toBe(true)
    expect(delta?.textContent).toBe('-3')
  })

  it('omits the delta element when absent', () => {
    el.setData({ label: 'Applied', value: 14 })
    expect(el.querySelector('.stat-delta')).toBeNull()
  })

  it('renders the note when present', () => {
    el.setData({ label: 'Applied', value: 14, note: 'vs prior 14 days' })
    expect(el.querySelector('.stat-note')?.textContent).toBe('vs prior 14 days')
  })

  it('omits the note when absent', () => {
    el.setData({ label: 'Applied', value: 14 })
    expect(el.querySelector('.stat-note')).toBeNull()
  })

  it('marks the host needs-action when requested', () => {
    el.setData({ label: 'Hot', value: 3, needsAction: true })
    expect(el.classList.contains('needs-action')).toBe(true)
  })

  it('does not mark the host needs-action by default', () => {
    el.setData({ label: 'Applied', value: 14 })
    expect(el.classList.contains('needs-action')).toBe(false)
  })

  it('renders an empty card skeleton before data arrives', () => {
    expect(el.classList.contains('stat-card')).toBe(true)
    expect(el.querySelector('.stat-label')).not.toBeNull()
    expect(el.querySelector('.stat-value')?.textContent).toBe('')
  })
})
