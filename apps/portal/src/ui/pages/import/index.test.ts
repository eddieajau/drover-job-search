/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import './index.js'
import type { ImportPage } from './index.js'

describe('import-page', () => {
  let el: ImportPage

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('import-page')
    document.body.appendChild(el)
  })

  it('renders the page shell with form controls', () => {
    expect(el.querySelector('h1')?.textContent).toBe('Import Job')
    expect(el.querySelector<HTMLInputElement>('#import-url')).not.toBeNull()
    expect(el.querySelector<HTMLSelectElement>('#import-status')).not.toBeNull()
    expect(el.querySelector<HTMLInputElement>('#import-date')).not.toBeNull()
    expect(el.querySelector<HTMLButtonElement>('button[type="submit"]')?.textContent).toBe('Import')
    const cancel = el.querySelector<HTMLAnchorElement>('a.btn[href="#jobs"]')
    expect(cancel?.textContent).toBe('Cancel')
  })

  it('renders the URL input with required pattern', () => {
    const input = el.querySelector<HTMLInputElement>('#import-url')!
    expect(input.required).toBe(true)
    expect(input.pattern).toBe(
      'https?://au\\.seek\\.com/job/\\d+|https?://(?:[a-z]{2,}\\.)?linkedin\\.com/jobs/view/\\d+/?'
    )
    expect(input.type).toBe('url')
  })

  it('renders the provider-agnostic label and placeholder', () => {
    const label = el.querySelector<HTMLLabelElement>('label[for="import-url"]')!
    expect(label.textContent).toBe('Job URL')
    const input = el.querySelector<HTMLInputElement>('#import-url')!
    expect(input.placeholder).toBe('https://au.seek.com/job/… or https://www.linkedin.com/jobs/view/…')
  })

  it('renders the status select with all allowed options', () => {
    const select = el.querySelector<HTMLSelectElement>('#import-status')!
    const options = Array.from(select.options).map(o => o.value)
    expect(options).toEqual(['applied', 'interviewing', 'skipped', 'blocked', 'declined', 'unsuccessful', 'successful'])
    expect(select.value).toBe('applied')
  })

  it('renders the date input', () => {
    const input = el.querySelector<HTMLInputElement>('#import-date')!
    expect(input.type).toBe('date')
  })

  it('dispatches import-page:ready on connect', () => {
    const received = { fired: false }
    document.addEventListener('import-page:ready', () => {
      received.fired = true
    })
    document.body.appendChild(document.createElement('import-page'))
    expect(received.fired).toBe(true)
  })

  it('dispatches import-page:save with form data on submit', () => {
    const urlInput = el.querySelector<HTMLInputElement>('#import-url')!
    urlInput.value = 'https://au.seek.com/job/12345'
    const statusSelect = el.querySelector<HTMLSelectElement>('#import-status')!
    statusSelect.value = 'interviewing'
    const dateInput = el.querySelector<HTMLInputElement>('#import-date')!
    dateInput.value = '2026-01-15'

    const received = { fired: false, detail: {} as { url: string; status: string; date: string } }
    el.addEventListener('import-page:save', event => {
      received.fired = true
      received.detail = (event as CustomEvent).detail
    })

    el.querySelector<HTMLFormElement>('#import-form')!.dispatchEvent(new Event('submit', { bubbles: true }))

    expect(received.fired).toBe(true)
    expect(received.detail).toEqual({
      url: 'https://au.seek.com/job/12345',
      status: 'interviewing',
      date: '2026-01-15',
    })
  })

  it('dispatches import-page:save with a LinkedIn URL on submit', () => {
    const urlInput = el.querySelector<HTMLInputElement>('#import-url')!
    urlInput.value = 'https://www.linkedin.com/jobs/view/4448084368/'

    const received = { fired: false, detail: {} as { url: string; status: string; date: string } }
    el.addEventListener('import-page:save', event => {
      received.fired = true
      received.detail = (event as CustomEvent).detail
    })

    el.querySelector<HTMLFormElement>('#import-form')!.dispatchEvent(new Event('submit', { bubbles: true }))

    expect(received.fired).toBe(true)
    expect(received.detail.url).toBe('https://www.linkedin.com/jobs/view/4448084368/')
    expect(received.detail.status).toBe('applied')
  })

  it('disables the button and shows "Importing\u2026" when setBusy(true)', () => {
    el.setBusy(true)
    const btn = el.querySelector<HTMLButtonElement>('button[type="submit"]')
    expect(btn?.disabled).toBe(true)
    expect(btn?.textContent).toBe('Importing\u2026')
    expect(btn?.getAttribute('aria-busy')).toBe('true')
  })

  it('re-enables the button when setBusy(false)', () => {
    el.setBusy(true)
    el.setBusy(false)
    const btn = el.querySelector<HTMLButtonElement>('button[type="submit"]')
    expect(btn?.disabled).toBe(false)
    expect(btn?.textContent).toBe('Import')
    expect(btn?.getAttribute('aria-busy')).toBeNull()
  })

  it('renders a success banner on showSuccess', () => {
    el.showSuccess('Senior Engineer')
    const banner = el.querySelector('.ingest-result.success')
    expect(banner).not.toBeNull()
    expect(banner?.getAttribute('role')).toBe('status')
    expect(banner?.textContent).toContain('Imported "Senior Engineer"')
    expect(banner?.querySelector('a[href="#jobs"]')).not.toBeNull()
  })

  it('renders an error banner on showError', () => {
    el.showError('Job already imported')
    const banner = el.querySelector('.ingest-result.error')
    expect(banner).not.toBeNull()
    expect(banner?.getAttribute('role')).toBe('status')
    expect(banner?.textContent).toContain('Job already imported')
  })

  it('sets the date input value via setDate', () => {
    el.setDate('2026-08-15')
    const input = el.querySelector<HTMLInputElement>('#import-date')
    expect(input?.value).toBe('2026-08-15')
  })
})
