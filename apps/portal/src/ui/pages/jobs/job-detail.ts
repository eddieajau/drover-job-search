/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { escapeHtml as esc } from '../../escape.js'
import type { JobWithStatus } from '../../jobs-view.js'

export class JobDetail extends HTMLElement {
  #job: JobWithStatus | null = null

  connectedCallback(): void {
    this.render()
  }

  showJob(job: JobWithStatus | null): void {
    this.#job = job
    this.render()
  }

  render(): void {
    if (!this.#job) {
      this.innerHTML = '<div class="detail-empty">Select a job to view details</div>'
      return
    }
    const job = this.#job
    const status = job._status
    this.innerHTML = `
      <div class="detail-header">
        <h2>${esc(job.title)}</h2>
        <div class="company">${esc(job.companyName)}</div>
        <div class="meta">
          <span>${esc(job.location)}</span>
          <span>Posted ${esc(job.postedAt || 'unknown')}</span>
          <span class="priority-badge p${job.priority}">P${job.priority}</span>
          <span>${esc(job.category)}</span>
          ${status !== 'new' ? `<span>${esc(status)}</span>` : ''}
        </div>
      </div>
      <div class="detail-description">
        ${job.descriptionHtml ?? '<em>No description in search results.</em>'}
      </div>
    `
  }
}

customElements.define('job-detail', JobDetail)

declare global {
  interface HTMLElementTagNameMap {
    'job-detail': JobDetail
  }
}
