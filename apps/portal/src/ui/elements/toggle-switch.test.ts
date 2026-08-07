/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import './toggle-switch.js'
import type { ToggleSwitch } from './toggle-switch.js'

function createSwitch(attrs: Record<string, string> = {}): ToggleSwitch {
  const el = document.createElement('toggle-switch')
  for (const [name, value] of Object.entries(attrs)) {
    el.setAttribute(name, value)
  }
  document.body.appendChild(el)
  return el
}

describe('toggle-switch', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('is unchecked by default', () => {
    const el = createSwitch()
    const input = el.querySelector('input')
    expect(input?.checked).toBe(false)
    expect(input?.hasAttribute('checked')).toBe(false)
  })

  it('checks the inner checkbox when the checked attribute is present', () => {
    const el = createSwitch({ checked: '' })
    const input = el.querySelector('input')
    expect(input?.checked).toBe(true)
    expect(input?.matches(':checked')).toBe(true)
  })

  it('styles the track when checked', () => {
    const el = createSwitch({ checked: '' })
    expect(el.querySelector('.switch input:checked + .track')).not.toBeNull()
  })

  it('dispatches toggle-switch:change with { checked } on toggle', () => {
    const el = createSwitch()
    const received: Array<CustomEvent<{ checked: boolean }>> = []
    el.addEventListener('toggle-switch:change', event => {
      received.push(event as CustomEvent<{ checked: boolean }>)
    })

    el.querySelector('input')?.click()

    expect(received.length).toBe(1)
    expect(received[0]?.detail).toEqual({ checked: true })
  })

  it('sets aria-label from the label attribute', () => {
    const el = createSwitch({ label: 'Enabled' })
    expect(el.querySelector('input')?.getAttribute('aria-label')).toBe('Enabled')
  })

  it('re-renders when the checked attribute changes without reconnect', () => {
    const el = createSwitch()
    expect(el.querySelector('input')?.checked).toBe(false)

    el.setAttribute('checked', '')
    expect(el.querySelector('input')?.checked).toBe(true)

    el.removeAttribute('checked')
    expect(el.querySelector('input')?.checked).toBe(false)
  })

  it('reflects state via the checked setter', () => {
    const el = createSwitch()
    el.checked = true
    expect(el.querySelector('input')?.checked).toBe(true)
    el.checked = false
    expect(el.querySelector('input')?.checked).toBe(false)
  })

  it('does not dispatch events after disconnect', () => {
    const el = createSwitch()
    const received: Event[] = []
    el.addEventListener('toggle-switch:change', event => {
      received.push(event)
    })

    el.remove()
    el.querySelector('input')?.click()

    expect(received.length).toBe(0)
  })
})
