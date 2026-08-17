/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { _resetImportMediatorForTesting, initImportMediator } from './import-mediator.js'
import './pages/import/index.js'
import type { ImportPage } from './pages/import/index.js'

function mockFetch(_routes: Record<string, unknown>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(init.body as string) as { url: string; status: string }
        if (body.url === 'https://au.seek.com/job/duplicate') {
          return { ok: false, status: 409, text: async () => 'Job already imported' }
        }
        if (body.url === 'https://au.seek.com/job/bad') {
          return { ok: false, status: 422, text: async () => 'Could not parse job page' }
        }
        return {
          ok: true,
          json: async () => ({ id: 1, status: body.status, title: 'Senior Engineer' }),
        }
      }
      return { ok: false, status: 404 }
    })
  )
}

describe('import-mediator', () => {
  afterEach(() => {
    _resetImportMediatorForTesting()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('sets the date input to today when import-page becomes ready', async () => {
    mockFetch({})
    initImportMediator()
    const page = document.createElement('import-page') as ImportPage
    document.body.appendChild(page)

    await new Promise(resolve => setTimeout(resolve, 0))

    const dateInput = page.querySelector<HTMLInputElement>('#import-date')
    const today = new Date()
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    expect(dateInput?.value).toBe(expected)
  })

  it('POSTs /api/jobs/import on save and shows success banner', async () => {
    mockFetch({})
    initImportMediator()
    const page = document.createElement('import-page') as ImportPage
    document.body.appendChild(page)
    await new Promise(resolve => setTimeout(resolve, 0))

    window.dispatchEvent(
      new CustomEvent('import-page:save', {
        detail: { url: 'https://au.seek.com/job/12345', status: 'applied', date: '2026-01-15' },
      })
    )
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/jobs/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://au.seek.com/job/12345', status: 'applied', at: '2026-01-15' }),
    })

    const banner = page.querySelector('.ingest-result.success')
    expect(banner).not.toBeNull()
    expect(banner?.textContent).toContain('Senior Engineer')
  })

  it('shows error banner on 409 conflict', async () => {
    mockFetch({})
    initImportMediator()
    const page = document.createElement('import-page') as ImportPage
    document.body.appendChild(page)
    await new Promise(resolve => setTimeout(resolve, 0))

    window.dispatchEvent(
      new CustomEvent('import-page:save', {
        detail: { url: 'https://au.seek.com/job/duplicate', status: 'applied', date: '2026-01-15' },
      })
    )
    await new Promise(resolve => setTimeout(resolve, 0))

    const banner = page.querySelector('.ingest-result.error')
    expect(banner).not.toBeNull()
    expect(banner?.textContent).toContain('Job already imported')
  })

  it('shows error banner on other errors', async () => {
    mockFetch({})
    initImportMediator()
    const page = document.createElement('import-page') as ImportPage
    document.body.appendChild(page)
    await new Promise(resolve => setTimeout(resolve, 0))

    window.dispatchEvent(
      new CustomEvent('import-page:save', {
        detail: { url: 'https://au.seek.com/job/bad', status: 'applied', date: '2026-01-15' },
      })
    )
    await new Promise(resolve => setTimeout(resolve, 0))

    const banner = page.querySelector('.ingest-result.error')
    expect(banner).not.toBeNull()
    expect(banner?.textContent).toContain('Could not parse job page')
  })

  it('shows error banner on network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Network error')
      })
    )
    initImportMediator()
    const page = document.createElement('import-page') as ImportPage
    document.body.appendChild(page)
    await new Promise(resolve => setTimeout(resolve, 0))

    window.dispatchEvent(
      new CustomEvent('import-page:save', {
        detail: { url: 'https://au.seek.com/job/12345', status: 'applied', date: '2026-01-15' },
      })
    )
    await new Promise(resolve => setTimeout(resolve, 0))

    const banner = page.querySelector('.ingest-result.error')
    expect(banner).not.toBeNull()
    expect(banner?.textContent).toContain('Network error')
  })

  it('sets busy during POST and re-enables after', async () => {
    let resolvePost: (() => void) | undefined
    const postPromise = new Promise<void>(resolve => {
      resolvePost = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          await postPromise
          return {
            ok: true,
            json: async () => ({ id: 1, status: 'applied', title: 'Engineer' }),
          }
        }
        return { ok: false, status: 404 }
      })
    )

    initImportMediator()
    const page = document.createElement('import-page') as ImportPage
    document.body.appendChild(page)
    await new Promise(resolve => setTimeout(resolve, 0))

    window.dispatchEvent(
      new CustomEvent('import-page:save', {
        detail: { url: 'https://au.seek.com/job/12345', status: 'applied', date: '2026-01-15' },
      })
    )
    await new Promise(resolve => setTimeout(resolve, 0))

    const btn = page.querySelector<HTMLButtonElement>('button[type="submit"]')
    expect(btn?.disabled).toBe(true)
    expect(btn?.getAttribute('aria-busy')).toBe('true')

    resolvePost!()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(btn?.disabled).toBe(false)
    expect(btn?.getAttribute('aria-busy')).toBeNull()
  })
})
