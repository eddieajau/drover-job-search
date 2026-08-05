/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export class JobStats extends HTMLElement {
  setStats(total: number, newCount: number): void {
    this.classList.add('stats')
    this.innerHTML = `<span>${total} total</span><span>${newCount} new</span>`
  }
}

customElements.define('job-stats', JobStats)

declare global {
  interface HTMLElementTagNameMap {
    'job-stats': JobStats
  }
}
