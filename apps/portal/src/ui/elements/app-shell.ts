/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import './pager.js'
import './theme-toggle.js'
import type { NavigationState } from '../navigation-state.js'
import { parseHash } from '../navigation-state.js'
import '../pages/jobs/index.js'
import '../pages/queries/index.js'
import '../pages/queries/query-edit-page.js'
import '../pages/signals/index.js'
import '../pages/queues/index.js'
import '../pages/facts/index.js'

type PageTag =
  | 'jobs-page'
  | 'queries-page'
  | 'query-edit-page'
  | 'signals-page'
  | 'queues-page'
  | 'facts-page'
  | 'fact-edit-page'

function pageFor(state: NavigationState | null): PageTag {
  if (state?.view === 'queries') {
    return 'queries-page'
  }
  if (state?.view === 'query-edit') {
    return 'query-edit-page'
  }
  if (state?.view === 'signals') {
    return 'signals-page'
  }
  if (state?.view === 'queues') {
    return 'queues-page'
  }
  if (state?.view === 'facts') {
    return 'facts-page'
  }
  if (state?.view === 'fact-edit') {
    return 'fact-edit-page'
  }
  return 'jobs-page'
}

function navViewFor(state: NavigationState | null): 'jobs' | 'queries' | 'signals' | 'queues' | 'facts' {
  if (state?.view === 'queries' || state?.view === 'query-edit') {
    return 'queries'
  }
  if (state?.view === 'signals') {
    return 'signals'
  }
  if (state?.view === 'queues') {
    return 'queues'
  }
  if (state?.view === 'facts' || state?.view === 'fact-edit') {
    return 'facts'
  }
  return 'jobs'
}

export class AppShell extends HTMLElement {
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
    this.syncView()
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  setupEventListeners(): void {
    this.cleanup()
    this.#abort = new AbortController()
    window.addEventListener('hashchange', this.#onHashChange, { signal: this.#abort.signal })
  }

  cleanup(): void {
    this.#abort?.abort()
    this.#abort = null
  }

  #onHashChange = (): void => {
    this.syncView()
  }

  syncView(): void {
    const state = parseHash(window.location.hash)
    this.mountPage(pageFor(state))
    this.syncNav(navViewFor(state))
  }

  mountPage(tag: PageTag): void {
    const mount = this.querySelector<HTMLElement>('#page-mount')
    if (!mount) {
      return
    }
    if (mount.firstElementChild?.tagName.toLowerCase() === tag) {
      return
    }
    mount.replaceChildren()
    mount.appendChild(document.createElement(tag))
  }

  syncNav(current: 'jobs' | 'queries' | 'signals' | 'queues' | 'facts'): void {
    for (const link of this.querySelectorAll<HTMLAnchorElement>('.site-nav-link')) {
      if (link.dataset.view === current) {
        link.setAttribute('aria-current', 'page')
      } else {
        link.removeAttribute('aria-current')
      }
    }
  }

  render(): void {
    this.innerHTML = `
      <header class="topnav">
        <a class="brand" href="#jobs">Drover</a>
        <nav class="nav" aria-label="Primary">
          <a class="site-nav-link" href="#jobs" data-view="jobs">Jobs</a>
          <a class="site-nav-link" href="#queries" data-view="queries">Queries</a>
          <a class="site-nav-link" href="#facts" data-view="facts">Facts</a>
          <a class="site-nav-link" href="#signals" data-view="signals">Signals</a>
          <a class="site-nav-link" href="#queues" data-view="queues">Queues</a>
        </nav>
        <theme-toggle></theme-toggle>
      </header>
      <main class="portal-main">
        <div id="page-mount"></div>
      </main>
    `
  }
}

customElements.define('app-shell', AppShell)

declare global {
  interface HTMLElementTagNameMap {
    'app-shell': AppShell
  }
}
