/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import './app-shell.js'
import type { AppShell } from './app-shell.js'

function createShell(): AppShell {
  const el = document.createElement('app-shell')
  document.body.appendChild(el)
  return el
}

describe('app-shell', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    window.location.hash = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
    window.location.hash = ''
  })

  it('renders the topnav with brand, three nav links, and a theme-toggle', () => {
    const el = createShell()
    expect(el.querySelector('.topnav')).not.toBeNull()
    expect(el.querySelector('.brand')?.textContent).toBe('Drover')
    const links = el.querySelectorAll<HTMLAnchorElement>('.site-nav-link')
    expect(links.length).toBe(3)
    expect(links[0]?.getAttribute('href')).toBe('#jobs')
    expect(links[1]?.getAttribute('href')).toBe('#queries')
    expect(links[2]?.getAttribute('href')).toBe('#signals')
    expect(el.querySelectorAll('theme-toggle').length).toBe(1)
    expect(el.querySelector('#page-mount')).not.toBeNull()
  })

  it('syncNav sets aria-current on the matching link only', () => {
    const el = createShell()
    el.syncNav('queries')
    expect(el.querySelector('[data-view="queries"]')?.getAttribute('aria-current')).toBe('page')
    expect(el.querySelector('[data-view="jobs"]')?.getAttribute('aria-current')).toBeNull()
    expect(el.querySelector('[data-view="signals"]')?.getAttribute('aria-current')).toBeNull()
  })

  it('mounts jobs-page by default and marks Jobs active', () => {
    const el = createShell()
    expect(el.querySelector('jobs-page')).not.toBeNull()
    expect(el.querySelector('queries-page')).toBeNull()
    expect(el.querySelector('[data-view="jobs"]')?.getAttribute('aria-current')).toBe('page')
    expect(el.querySelector('[data-view="queries"]')?.getAttribute('aria-current')).toBeNull()
  })

  it('mounts queries-page for the queries hash and marks Queries active', () => {
    window.location.hash = '#queries'
    const el = createShell()
    expect(el.querySelector('queries-page')).not.toBeNull()
    expect(el.querySelector('jobs-page')).toBeNull()
    expect(el.querySelector('[data-view="queries"]')?.getAttribute('aria-current')).toBe('page')
    expect(el.querySelector('[data-view="jobs"]')?.getAttribute('aria-current')).toBeNull()
  })

  it('mounts signals-page for the signals hash and marks Signals active', () => {
    window.location.hash = '#signals'
    const el = createShell()
    expect(el.querySelector('signals-page')).not.toBeNull()
    expect(el.querySelector('jobs-page')).toBeNull()
    expect(el.querySelector('[data-view="signals"]')?.getAttribute('aria-current')).toBe('page')
    expect(el.querySelector('[data-view="jobs"]')?.getAttribute('aria-current')).toBeNull()
  })

  it('remounts the page when the hash changes to a different view', () => {
    const el = createShell()
    expect(el.querySelector('jobs-page')).not.toBeNull()

    window.location.hash = '#queries'
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    expect(el.querySelector('queries-page')).not.toBeNull()
    expect(el.querySelector('jobs-page')).toBeNull()
    expect(el.querySelector('[data-view="queries"]')?.getAttribute('aria-current')).toBe('page')
  })

  it('keeps the mounted page when the hash stays within the same view', () => {
    window.location.hash = '#jobs'
    const el = createShell()
    const first = el.querySelector('jobs-page')

    window.location.hash = '#jobs'
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    expect(el.querySelector('jobs-page')).toBe(first)
  })

  it('mounts query-edit-page for an edit hash and keeps Queries active', () => {
    window.location.hash = '#queries/edit?id=1'
    const el = createShell()
    expect(el.querySelector('query-edit-page')).not.toBeNull()
    expect(el.querySelector('jobs-page')).toBeNull()
    expect(el.querySelector('queries-page')).toBeNull()
    expect(el.querySelector('[data-view="queries"]')?.getAttribute('aria-current')).toBe('page')
  })

  it('mounts query-edit-page for the new query hash', () => {
    window.location.hash = '#queries/edit'
    const el = createShell()
    expect(el.querySelector('query-edit-page')).not.toBeNull()
  })

  it('falls back to jobs for unknown hashes', () => {
    window.location.hash = '#bogus'
    const el = createShell()
    expect(el.querySelector('jobs-page')).not.toBeNull()
    expect(el.querySelector('[data-view="jobs"]')?.getAttribute('aria-current')).toBe('page')
  })
})
