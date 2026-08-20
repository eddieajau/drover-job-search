/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import './index.js'
import type { ManualEntryPage } from './index.js'

describe('manual-entry-page', () => {
  let el: ManualEntryPage

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('manual-entry-page')
    document.body.appendChild(el)
  })

  it('renders the page shell with heading "Add Job Manually"', () => {
    expect(el.querySelector('h1')?.textContent).toBe('Add Job Manually')
  })

  it('renders all form fields with correct types', () => {
    expect(el.querySelector<HTMLInputElement>('#manual-title')?.type).toBe('text')
    expect(el.querySelector<HTMLInputElement>('#manual-company')?.type).toBe('text')
    expect(el.querySelector<HTMLInputElement>('#manual-url')?.type).toBe('url')
    expect(el.querySelector<HTMLInputElement>('#manual-location')?.type).toBe('text')
    expect(el.querySelector<HTMLSelectElement>('#manual-workplace')).not.toBeNull()
    expect(el.querySelector<HTMLSelectElement>('#manual-employment')).not.toBeNull()
    expect(el.querySelector<HTMLInputElement>('#manual-posted')?.type).toBe('date')
    expect(el.querySelector<HTMLTextAreaElement>('#manual-description')).not.toBeNull()
    expect(el.querySelector<HTMLSelectElement>('#manual-status')).not.toBeNull()
    expect(el.querySelector<HTMLInputElement>('#manual-date')?.type).toBe('date')
    expect(el.querySelector<HTMLButtonElement>('button[type="submit"]')?.textContent).toBe('Save')
    const cancel = el.querySelector<HTMLAnchorElement>('a.btn[href="#jobs"]')
    expect(cancel?.textContent).toBe('Cancel')
  })

  it('marks title, company, and location as required', () => {
    expect(el.querySelector<HTMLInputElement>('#manual-title')!.required).toBe(true)
    expect(el.querySelector<HTMLInputElement>('#manual-company')!.required).toBe(true)
    expect(el.querySelector<HTMLInputElement>('#manual-location')!.required).toBe(true)
  })

  it('renders the status select with all 7 options defaulting to applied', () => {
    const select = el.querySelector<HTMLSelectElement>('#manual-status')!
    const options = Array.from(select.options).map(o => o.value)
    expect(options).toEqual(['applied', 'interviewing', 'skipped', 'blocked', 'declined', 'unsuccessful', 'successful'])
    expect(select.value).toBe('applied')
  })

  it('renders the workplace type select with blank + 3 options', () => {
    const select = el.querySelector<HTMLSelectElement>('#manual-workplace')!
    const options = Array.from(select.options).map(o => o.value)
    expect(options).toEqual(['', 'onsite', 'hybrid', 'remote'])
  })

  it('renders the employment type select with blank + 6 options', () => {
    const select = el.querySelector<HTMLSelectElement>('#manual-employment')!
    const options = Array.from(select.options).map(o => o.value)
    expect(options).toEqual(['', 'full-time', 'part-time', 'contract', 'temporary', 'casual', 'other'])
  })

  it('renders the description textarea with 6 rows', () => {
    const textarea = el.querySelector<HTMLTextAreaElement>('#manual-description')!
    expect(textarea.getAttribute('rows')).toBe('6')
  })

  it('dispatches manual-entry-page:ready on connect', () => {
    const received = { fired: false }
    document.addEventListener('manual-entry-page:ready', () => {
      received.fired = true
    })
    document.body.appendChild(document.createElement('manual-entry-page'))
    expect(received.fired).toBe(true)
  })

  it('dispatches manual-entry-page:save with form data on submit', () => {
    el.querySelector<HTMLInputElement>('#manual-title')!.value = 'Senior Engineer'
    el.querySelector<HTMLInputElement>('#manual-company')!.value = 'Acme Corp'
    el.querySelector<HTMLInputElement>('#manual-url')!.value = 'https://example.com/job/1'
    el.querySelector<HTMLInputElement>('#manual-location')!.value = 'Sydney'
    el.querySelector<HTMLSelectElement>('#manual-workplace')!.value = 'remote'
    el.querySelector<HTMLSelectElement>('#manual-employment')!.value = 'full-time'
    el.querySelector<HTMLInputElement>('#manual-posted')!.value = '2026-08-01'
    el.querySelector<HTMLTextAreaElement>('#manual-description')!.value = 'Build cool stuff'
    el.querySelector<HTMLSelectElement>('#manual-status')!.value = 'interviewing'
    el.querySelector<HTMLInputElement>('#manual-date')!.value = '2026-08-15'

    const received = {
      fired: false,
      detail: {} as {
        title: string
        companyName: string
        url: string
        location: string
        workplaceType: string
        employmentType: string
        postedAt: string
        description: string
        status: string
        date: string
      },
    }
    el.addEventListener('manual-entry-page:save', event => {
      received.fired = true
      received.detail = (event as CustomEvent).detail
    })

    el.querySelector<HTMLFormElement>('#manual-form')!.dispatchEvent(new Event('submit', { bubbles: true }))

    expect(received.fired).toBe(true)
    expect(received.detail).toEqual({
      title: 'Senior Engineer',
      companyName: 'Acme Corp',
      url: 'https://example.com/job/1',
      location: 'Sydney',
      workplaceType: 'remote',
      employmentType: 'full-time',
      postedAt: '2026-08-01',
      description: 'Build cool stuff',
      status: 'interviewing',
      date: '2026-08-15',
    })
  })

  it('disables the button and shows "Saving…" when setBusy(true)', () => {
    el.setBusy(true)
    const btn = el.querySelector<HTMLButtonElement>('button[type="submit"]')
    expect(btn?.disabled).toBe(true)
    expect(btn?.textContent).toBe('Saving\u2026')
    expect(btn?.getAttribute('aria-busy')).toBe('true')
  })

  it('re-enables the button when setBusy(false)', () => {
    el.setBusy(true)
    el.setBusy(false)
    const btn = el.querySelector<HTMLButtonElement>('button[type="submit"]')
    expect(btn?.disabled).toBe(false)
    expect(btn?.textContent).toBe('Save')
    expect(btn?.getAttribute('aria-busy')).toBeNull()
  })

  it('renders a success banner on showSuccess', () => {
    el.showSuccess('Senior Engineer')
    const banner = el.querySelector('.ingest-result.success')
    expect(banner).not.toBeNull()
    expect(banner?.getAttribute('role')).toBe('status')
    expect(banner?.textContent).toContain('Added "Senior Engineer"')
    expect(banner?.querySelector('a[href="#jobs"]')).not.toBeNull()
  })

  it('renders an error banner on showError', () => {
    el.showError('Something went wrong')
    const banner = el.querySelector('.ingest-result.error')
    expect(banner).not.toBeNull()
    expect(banner?.getAttribute('role')).toBe('status')
    expect(banner?.textContent).toContain('Something went wrong')
  })

  it('sets the date input value via setDate', () => {
    el.setDate('2026-08-15')
    const input = el.querySelector<HTMLInputElement>('#manual-date')
    expect(input?.value).toBe('2026-08-15')
  })

  it('strips the query string from the URL input when it loses focus', () => {
    const input = el.querySelector<HTMLInputElement>('#manual-url')!
    input.value = 'https://example.com/job/1?trk=jobsearch&ref=abc'
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(input.value).toBe('https://example.com/job/1')
  })

  it('leaves the URL input untouched when it has no query string', () => {
    const input = el.querySelector<HTMLInputElement>('#manual-url')!
    input.value = 'https://example.com/job/1'
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(input.value).toBe('https://example.com/job/1')
  })

  it('leaves a blank URL input untouched on blur', () => {
    const input = el.querySelector<HTMLInputElement>('#manual-url')!
    input.value = ''
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(input.value).toBe('')
  })
})
