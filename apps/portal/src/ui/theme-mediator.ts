/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

let registered = false
let theme: 'light' | 'dark' = 'light'

export function initThemeMediator(): void {
  if (registered) {
    return
  }
  registered = true
  window.addEventListener('theme-toggle:requesttoggle', handleRequest)
  theme = resolveInitialTheme()
  applyTheme(theme)
  applyToElements()
}

export function _resetThemeMediatorForTesting(): void {
  if (registered) {
    window.removeEventListener('theme-toggle:requesttoggle', handleRequest)
  }
  registered = false
  theme = 'light'
  document.documentElement.removeAttribute('data-theme')
  try {
    localStorage.removeItem('drover-theme')
  } catch {
    // localStorage may be unavailable in some test environments
  }
}

function resolveInitialTheme(): 'light' | 'dark' {
  let stored: string | null = null
  try {
    stored = localStorage.getItem('drover-theme')
  } catch {
    // localStorage may throw in private browsing or restricted contexts
  }
  if (stored === 'light' || stored === 'dark') {
    return stored
  }
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

function applyTheme(next: 'light' | 'dark'): void {
  theme = next
  document.documentElement.setAttribute('data-theme', next)
  try {
    localStorage.setItem('drover-theme', next)
  } catch {
    // localStorage may throw in private browsing or restricted contexts
  }
}

function applyToElements(): void {
  for (const el of document.querySelectorAll('theme-toggle')) {
    el.setAttribute('theme', theme)
  }
}

function handleRequest(event: Event): void {
  const { current } = (event as CustomEvent<{ current: 'light' | 'dark' }>).detail
  const next: 'light' | 'dark' = current === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  applyToElements()
}
