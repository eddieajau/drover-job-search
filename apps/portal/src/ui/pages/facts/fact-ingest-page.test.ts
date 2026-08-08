/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import './fact-ingest-page.js'
import type { FactIngestPage } from './fact-ingest-page.js'

describe('fact-ingest-page', () => {
  let el: FactIngestPage

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('fact-ingest-page')
    document.body.appendChild(el)
  })

  it('renders the page shell with breadcrumb, textarea, and button', () => {
    const crumb = el.querySelector<HTMLAnchorElement>('.crumb')
    expect(crumb?.getAttribute('href')).toBe('#facts')
    expect(crumb?.textContent).toContain('Facts')
    expect(el.querySelector('h1')?.textContent).toBe('Import resume')
    expect(el.querySelector<HTMLTextAreaElement>('#ingest-resume')).not.toBeNull()
    expect(el.querySelector<HTMLButtonElement>('#btn-ingest')?.textContent).toBe('Ingest')
    const actions = el.querySelector('.form-actions')
    expect(actions?.querySelector<HTMLAnchorElement>('a.btn[href="#facts"]')?.textContent).toBe('Cancel')
  })

  it('renders the label with required marker and hint', () => {
    const field = el.querySelector('#ingest-resume')?.closest('.field')
    const label = field?.querySelector('.field-label.req')
    expect(label?.getAttribute('for')).toBe('ingest-resume')
    expect(label?.textContent).toBe('Resume text')
    expect(field?.querySelector('.hint')?.textContent).toContain('LLM slices')
  })

  it('dispatches fact-ingest-page:ready on connect', () => {
    const received = { fired: false }
    document.addEventListener('fact-ingest-page:ready', () => {
      received.fired = true
    })
    document.body.appendChild(document.createElement('fact-ingest-page'))
    expect(received.fired).toBe(true)
  })

  it('disables the button and shows "Ingesting\u2026" when setBusy(true)', () => {
    el.setBusy(true)
    const btn = el.querySelector<HTMLButtonElement>('#btn-ingest')
    expect(btn?.disabled).toBe(true)
    expect(btn?.textContent).toBe('Ingesting\u2026')
    expect(btn?.getAttribute('aria-busy')).toBe('true')
  })

  it('re-enables the button when setBusy(false)', () => {
    el.setBusy(true)
    el.setBusy(false)
    const btn = el.querySelector<HTMLButtonElement>('#btn-ingest')
    expect(btn?.disabled).toBe(false)
    expect(btn?.textContent).toBe('Ingest')
    expect(btn?.getAttribute('aria-busy')).toBeNull()
  })

  it('renders a success banner with a #facts link on setResult({ inserted: 5 })', () => {
    el.setResult({ inserted: 5 })
    const banner = el.querySelector('.ingest-result.success')
    expect(banner).not.toBeNull()
    expect(banner?.getAttribute('role')).toBe('status')
    expect(banner?.textContent).toContain('Inserted 5 facts')
    expect(banner?.querySelector('a[href="#facts"]')).not.toBeNull()
  })

  it('renders an error banner on setResult({ error: "..." })', () => {
    el.setResult({ error: 'something went wrong' })
    const banner = el.querySelector('.ingest-result.error')
    expect(banner).not.toBeNull()
    expect(banner?.getAttribute('role')).toBe('status')
    expect(banner?.textContent).toContain('something went wrong')
  })

  it('keeps the textarea and button mounted after setResult', () => {
    el.setResult({ inserted: 3 })
    expect(el.querySelector<HTMLTextAreaElement>('#ingest-resume')).not.toBeNull()
    expect(el.querySelector<HTMLButtonElement>('#btn-ingest')).not.toBeNull()
  })

  it('dispatches fact-ingest-page:ingest with resume text when #btn-ingest is clicked', () => {
    const textarea = el.querySelector<HTMLTextAreaElement>('#ingest-resume')!
    textarea.value = 'My resume text here'
    const received = { fired: false, resume: '' }
    el.addEventListener('fact-ingest-page:ingest', event => {
      received.fired = true
      received.resume = (event as CustomEvent).detail.resume
    })
    el.querySelector<HTMLButtonElement>('#btn-ingest')?.click()
    expect(received.fired).toBe(true)
    expect(received.resume).toBe('My resume text here')
  })

  it('does not dispatch when the textarea is empty', () => {
    const textarea = el.querySelector<HTMLTextAreaElement>('#ingest-resume')!
    textarea.value = ''
    const received = { fired: false }
    el.addEventListener('fact-ingest-page:ingest', () => {
      received.fired = true
    })
    el.querySelector<HTMLButtonElement>('#btn-ingest')?.click()
    expect(received.fired).toBe(false)
  })

  it('does not dispatch when the textarea has only whitespace', () => {
    const textarea = el.querySelector<HTMLTextAreaElement>('#ingest-resume')!
    textarea.value = '   \n  '
    const received = { fired: false }
    el.addEventListener('fact-ingest-page:ingest', () => {
      received.fired = true
    })
    el.querySelector<HTMLButtonElement>('#btn-ingest')?.click()
    expect(received.fired).toBe(false)
  })
})
