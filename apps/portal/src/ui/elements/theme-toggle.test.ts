/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import './theme-toggle.js'
import type { ThemeToggle } from './theme-toggle.js'

function createToggle(): ThemeToggle {
  const el = document.createElement('theme-toggle')
  document.body.appendChild(el)
  return el
}

describe('theme-toggle', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('renders "Light mode" with aria-pressed="false" when theme is dark', () => {
    const el = document.createElement('theme-toggle')
    el.setAttribute('theme', 'dark')
    document.body.appendChild(el)
    const btn = el.querySelector('button')
    expect(btn?.textContent?.trim()).toBe('Light mode')
    expect(btn?.getAttribute('aria-pressed')).toBe('true')
  })

  it('renders "Dark mode" with aria-pressed="false" when theme is light', () => {
    const el = createToggle()
    const btn = el.querySelector('button')
    expect(btn?.textContent?.trim()).toBe('Dark mode')
    expect(btn?.getAttribute('aria-pressed')).toBe('false')
  })

  it('dispatches theme-toggle:requesttoggle with current theme on click', () => {
    const el = document.createElement('theme-toggle')
    el.setAttribute('theme', 'dark')
    document.body.appendChild(el)

    const received: Array<CustomEvent<{ current: 'light' | 'dark' }>> = []
    el.addEventListener('theme-toggle:requesttoggle', event => {
      received.push(event as CustomEvent<{ current: 'light' | 'dark' }>)
    })
    el.querySelector('button')?.click()

    expect(received.length).toBe(1)
    expect(received[0]?.detail).toEqual({ current: 'dark' })
  })

  it('re-renders the label when the theme attribute changes after connect', () => {
    const el = createToggle()
    expect(el.querySelector('button')?.textContent?.trim()).toBe('Dark mode')

    el.setAttribute('theme', 'dark')
    expect(el.querySelector('button')?.textContent?.trim()).toBe('Light mode')
    expect(el.querySelector('button')?.getAttribute('aria-pressed')).toBe('true')
  })

  it('does not dispatch events after disconnect', () => {
    const el = createToggle()
    const received: Event[] = []
    el.addEventListener('theme-toggle:requesttoggle', event => {
      received.push(event)
    })

    el.remove()
    el.querySelector('button')?.click()

    expect(received.length).toBe(0)
  })

  it('never reads localStorage or matchMedia', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem')
    const matchMediaSpy = vi.spyOn(window, 'matchMedia')

    const el = document.createElement('theme-toggle')
    el.setAttribute('theme', 'dark')
    document.body.appendChild(el)
    el.querySelector('button')?.click()

    const elementCalls = getItemSpy.mock.calls.filter(call => call[0] === 'drover-theme')
    expect(elementCalls.length).toBe(0)
    expect(matchMediaSpy).not.toHaveBeenCalled()
  })

  it('never writes data-theme on documentElement', () => {
    const setAttributeSpy = vi.spyOn(document.documentElement, 'setAttribute')

    const el = createToggle()
    el.querySelector('button')?.click()

    const themeCalls = setAttributeSpy.mock.calls.filter(call => call[0] === 'data-theme')
    expect(themeCalls.length).toBe(0)
  })
})
