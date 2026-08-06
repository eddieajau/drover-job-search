/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import './elements/theme-toggle.js'
import { _resetThemeMediatorForTesting, initThemeMediator } from './theme-mediator.js'

function createLocalStorageMock(): Storage {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  }
}

describe('theme-mediator', () => {
  let storage: Storage

  beforeEach(() => {
    document.body.innerHTML = ''
    document.documentElement.removeAttribute('data-theme')
    storage = createLocalStorageMock()
    vi.stubGlobal('localStorage', storage)
  })

  afterEach(() => {
    _resetThemeMediatorForTesting()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('applies dark from matchMedia when no stored preference exists', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
    } as unknown as MediaQueryList)

    document.body.innerHTML = '<theme-toggle></theme-toggle>'
    initThemeMediator()

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    const toggle = document.querySelector('theme-toggle')
    expect(toggle?.getAttribute('theme')).toBe('dark')
  })

  it('applies light from matchMedia when prefers-color-scheme is not dark', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
    } as unknown as MediaQueryList)

    document.body.innerHTML = '<theme-toggle></theme-toggle>'
    initThemeMediator()

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    const toggle = document.querySelector('theme-toggle')
    expect(toggle?.getAttribute('theme')).toBe('light')
  })

  it('prefers stored localStorage value over matchMedia', () => {
    storage.setItem('drover-theme', 'light')
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
    } as unknown as MediaQueryList)

    document.body.innerHTML = '<theme-toggle></theme-toggle>'
    initThemeMediator()

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    const toggle = document.querySelector('theme-toggle')
    expect(toggle?.getAttribute('theme')).toBe('light')
  })

  it('toggles from light to dark on request event', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
    } as unknown as MediaQueryList)

    document.body.innerHTML = '<theme-toggle></theme-toggle>'
    initThemeMediator()

    window.dispatchEvent(new CustomEvent('theme-toggle:requesttoggle', { detail: { current: 'light' } }))

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(storage.getItem('drover-theme')).toBe('dark')
    const toggle = document.querySelector('theme-toggle')
    expect(toggle?.getAttribute('theme')).toBe('dark')
  })

  it('toggles from dark to light on request event', () => {
    storage.setItem('drover-theme', 'dark')

    document.body.innerHTML = '<theme-toggle></theme-toggle>'
    initThemeMediator()

    window.dispatchEvent(new CustomEvent('theme-toggle:requesttoggle', { detail: { current: 'dark' } }))

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(storage.getItem('drover-theme')).toBe('light')
    const toggle = document.querySelector('theme-toggle')
    expect(toggle?.getAttribute('theme')).toBe('light')
  })

  it('reset removes the listener so subsequent events do not mutate state', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
    } as unknown as MediaQueryList)

    initThemeMediator()
    _resetThemeMediatorForTesting()

    document.documentElement.setAttribute('data-theme', 'light')
    window.dispatchEvent(new CustomEvent('theme-toggle:requesttoggle', { detail: { current: 'light' } }))

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('is idempotent — calling init twice registers one listener', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
    } as unknown as MediaQueryList)

    document.body.innerHTML = '<theme-toggle></theme-toggle>'
    initThemeMediator()
    initThemeMediator()

    window.dispatchEvent(new CustomEvent('theme-toggle:requesttoggle', { detail: { current: 'light' } }))

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(storage.getItem('drover-theme')).toBe('dark')
  })

  it('broadcasts theme to all mounted toggles', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
    } as unknown as MediaQueryList)

    document.body.innerHTML = '<theme-toggle></theme-toggle><theme-toggle></theme-toggle>'
    initThemeMediator()

    const toggles = document.querySelectorAll('theme-toggle')
    expect(toggles.length).toBe(2)
    for (const toggle of toggles) {
      expect(toggle.getAttribute('theme')).toBe('dark')
    }
  })
})
