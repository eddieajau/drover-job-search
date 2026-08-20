/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { escapeHtml as esc } from '../../escape.js'

export interface ManualEntryPageEventMap {
  'manual-entry-page:ready': CustomEvent<void>
  'manual-entry-page:save': CustomEvent<{
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
  }>
}

export class ManualEntryPage extends HTMLElement {
  #busy = false
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
    this.dispatchEvent(new CustomEvent('manual-entry-page:ready', { bubbles: true, composed: true }))
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  setBusy(busy: boolean): void {
    this.#busy = busy
    const btn = this.querySelector<HTMLButtonElement>('button[type="submit"]')
    if (!btn) {
      return
    }
    btn.disabled = busy
    if (busy) {
      btn.setAttribute('aria-busy', 'true')
      btn.textContent = 'Saving\u2026'
    } else {
      btn.removeAttribute('aria-busy')
      btn.textContent = 'Save'
    }
  }

  setDate(date: string): void {
    const input = this.querySelector<HTMLInputElement>('#manual-date')
    if (input) {
      input.value = date
    }
  }

  showSuccess(title: string): void {
    const result = this.querySelector<HTMLElement>('#manual-result')
    if (result) {
      result.innerHTML = `<div class="ingest-result success" role="status">Added "${esc(title)}". <a href="#jobs">View jobs</a></div>`
    }
  }

  showError(message: string): void {
    const result = this.querySelector<HTMLElement>('#manual-result')
    if (result) {
      result.innerHTML = `<div class="ingest-result error" role="status">${esc(message)}</div>`
    }
  }

  setupEventListeners(): void {
    this.cleanup()
    this.#abort = new AbortController()
    const opts = { signal: this.#abort.signal }
    this.addEventListener('submit', this.#onSubmit, opts)
    this.addEventListener('focusout', this.#onUrlBlur, opts)
  }

  #onUrlBlur = (event: FocusEvent): void => {
    if (!(event.target instanceof HTMLInputElement) || event.target.id !== 'manual-url') {
      return
    }
    const raw = event.target.value
    if (!raw) {
      return
    }
    try {
      const url = new URL(raw)
      url.search = ''
      event.target.value = url.toString()
    } catch {
      // Not a parseable URL — leave it untouched for the user to fix.
    }
  }

  cleanup(): void {
    this.#abort?.abort()
    this.#abort = null
  }

  #onSubmit = (event: Event): void => {
    event.preventDefault()
    const form = event.target as HTMLFormElement
    const title = (form.querySelector<HTMLInputElement>('#manual-title')?.value ?? '').trim()
    const companyName = (form.querySelector<HTMLInputElement>('#manual-company')?.value ?? '').trim()
    const url = (form.querySelector<HTMLInputElement>('#manual-url')?.value ?? '').trim()
    const location = (form.querySelector<HTMLInputElement>('#manual-location')?.value ?? '').trim()
    const workplaceType = form.querySelector<HTMLSelectElement>('#manual-workplace')?.value ?? ''
    const employmentType = form.querySelector<HTMLSelectElement>('#manual-employment')?.value ?? ''
    const postedAt = form.querySelector<HTMLInputElement>('#manual-posted')?.value ?? ''
    const description = (form.querySelector<HTMLTextAreaElement>('#manual-description')?.value ?? '').trim()
    const status = form.querySelector<HTMLSelectElement>('#manual-status')?.value ?? 'applied'
    const date = form.querySelector<HTMLInputElement>('#manual-date')?.value ?? ''

    if (!title || !companyName || !location) {
      return
    }

    this.dispatchEvent(
      new CustomEvent('manual-entry-page:save', {
        bubbles: true,
        composed: true,
        detail: {
          title,
          companyName,
          url,
          location,
          workplaceType,
          employmentType,
          postedAt,
          description,
          status,
          date,
        },
      })
    )
  }

  render(): void {
    this.innerHTML = `
      <main class="page">
        <h1>Add Job Manually</h1>
        <form id="manual-form" class="form">
          <div class="field">
            <label class="field-label req" for="manual-title">Job Title</label>
            <input class="input" type="text" id="manual-title" required />
          </div>
          <div class="field">
            <label class="field-label req" for="manual-company">Company</label>
            <input class="input" type="text" id="manual-company" required />
          </div>
          <div class="field">
            <label class="field-label" for="manual-url">URL</label>
            <input class="input" type="url" id="manual-url" placeholder="https://\u2026" />
          </div>
          <div class="field">
            <label class="field-label req" for="manual-location">Location</label>
            <input class="input" type="text" id="manual-location" required />
          </div>
          <div class="field">
            <label class="field-label" for="manual-workplace">Workplace Type</label>
            <select class="input" id="manual-workplace">
              <option value=""></option>
              <option value="onsite">Onsite</option>
              <option value="hybrid">Hybrid</option>
              <option value="remote">Remote</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="manual-employment">Employment Type</label>
            <select class="input" id="manual-employment">
              <option value=""></option>
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="temporary">Temporary</option>
              <option value="casual">Casual</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="manual-posted">Posted Date</label>
            <input class="input" type="date" id="manual-posted" />
          </div>
          <div class="field">
            <label class="field-label" for="manual-description">Description</label>
            <textarea class="input" id="manual-description" rows="6"></textarea>
          </div>
          <div class="field">
            <label class="field-label req" for="manual-status">Starting Status</label>
            <select class="input" id="manual-status">
              <option value="applied" selected>Applied</option>
              <option value="interviewing">Interviewing</option>
              <option value="skipped">Skipped</option>
              <option value="blocked">Blocked</option>
              <option value="declined">Declined</option>
              <option value="unsuccessful">Unsuccessful</option>
              <option value="successful">Successful</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label req" for="manual-date">Date</label>
            <input class="input" type="date" id="manual-date" required />
          </div>
          <div class="form-actions">
            <button type="submit" class="btn primary"${this.#busy ? ' disabled aria-busy="true"' : ''}>${this.#busy ? 'Saving\u2026' : 'Save'}</button>
            <a class="btn" href="#jobs">Cancel</a>
          </div>
        </form>
        <div id="manual-result"></div>
      </main>
    `
  }
}

customElements.define('manual-entry-page', ManualEntryPage)

declare global {
  interface HTMLElementTagNameMap {
    'manual-entry-page': ManualEntryPage
  }
}
