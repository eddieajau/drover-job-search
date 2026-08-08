/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { FactResponse } from '../shared/types.js'

let registered = false

export function initFactsMediator(): void {
  if (registered) {
    return
  }
  registered = true
  window.addEventListener('facts-page:ready', handleFactsReady)
  window.addEventListener('facts-page:filter', handleFilter)

  if (document.querySelector('facts-page')) {
    void handleFactsReady()
  }
}

export function _resetFactsMediatorForTesting(): void {
  if (registered) {
    window.removeEventListener('facts-page:ready', handleFactsReady)
    window.removeEventListener('facts-page:filter', handleFilter)
  }
  registered = false
}

async function handleFactsReady(): Promise<void> {
  await refreshFacts()
}

async function handleFilter(event: Event): Promise<void> {
  const { category, active } = (event as CustomEvent<{ category: string; active: string }>).detail
  await refreshFacts(category, active)
}

async function refreshFacts(category?: string, active?: string): Promise<void> {
  const page = document.querySelector('facts-page')
  if (!page) {
    return
  }
  try {
    const params = new URLSearchParams()
    if (category) {
      params.set('category', category)
    }
    if (active) {
      params.set('active', active)
    }
    const query = params.toString()
    const url = query ? `/api/facts?${query}` : '/api/facts'
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error('Failed to load facts')
    }
    const facts = (await response.json()) as FactResponse[]
    page.setFacts(facts)
  } catch {
    page.setFacts([])
  }
}
