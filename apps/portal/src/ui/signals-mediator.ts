/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { JobSignal, SignalRule } from '../shared/types.js'
import type { JobsPage } from './pages/jobs/index.js'
import type { SignalsPage } from './pages/signals/index.js'
import type { RuleDraft } from './pages/signals/rules-list.js'

let registered = false

export function initSignalsMediator(): void {
  if (registered) {
    return
  }
  registered = true
  window.addEventListener('signals-page:ready', handleSignalsReady)
  window.addEventListener('signals-page:seed', handleSeed)
  window.addEventListener('rules-list:save', handleSave)
  window.addEventListener('rules-list:trash', handleTrash)
  window.addEventListener('rules-list:toggle', handleToggle)
  window.addEventListener('job-list:select', handleJobSelect)
  window.addEventListener('jobs-page:selected', handleInitialSelect)
  window.addEventListener('job-meta:flag', handleFlag)
  window.addEventListener('job-meta:rank', handleRank)
  window.addEventListener('job-card:flag', handleFlag)
}

export function _resetSignalsMediatorForTesting(): void {
  if (registered) {
    window.removeEventListener('signals-page:ready', handleSignalsReady)
    window.removeEventListener('signals-page:seed', handleSeed)
    window.removeEventListener('rules-list:save', handleSave)
    window.removeEventListener('rules-list:trash', handleTrash)
    window.removeEventListener('rules-list:toggle', handleToggle)
    window.removeEventListener('job-list:select', handleJobSelect)
    window.removeEventListener('jobs-page:selected', handleInitialSelect)
    window.removeEventListener('job-meta:flag', handleFlag)
    window.removeEventListener('job-meta:rank', handleRank)
    window.removeEventListener('job-card:flag', handleFlag)
  }
  registered = false
}

async function handleSignalsReady(): Promise<void> {
  const page = document.querySelector('signals-page')
  if (!page) {
    return
  }
  await loadRules(page)
}

async function handleSeed(): Promise<void> {
  const page = document.querySelector('signals-page')
  if (!page) {
    return
  }
  page.setSeedBusy(true)
  try {
    const response = await fetch('/api/rules/seed-from-facts', { method: 'POST' })
    if (!response.ok) {
      throw new Error('Failed to seed rules')
    }
    const { created } = (await response.json()) as { created: number }
    await loadRules(page)
    page.showSeedResult(created)
  } catch {
    page.showSeedResult(-1)
  } finally {
    page.setSeedBusy(false)
  }
}

async function loadRules(page: SignalsPage): Promise<void> {
  try {
    const response = await fetch('/api/rules')
    if (!response.ok) {
      throw new Error('Failed to load rules')
    }
    const rules = (await response.json()) as SignalRule[]
    page.setRules(rules)
  } catch {
    page.setRules([])
  }
}

async function handleSave(event: Event): Promise<void> {
  const { rules } = (event as CustomEvent<{ rules: RuleDraft[] }>).detail
  await syncRules(rules)
}

async function handleTrash(event: Event): Promise<void> {
  const { rules } = (event as CustomEvent<{ rules: RuleDraft[] }>).detail
  await syncRules(rules)
}

async function handleToggle(event: Event): Promise<void> {
  const { rules } = (event as CustomEvent<{ rules: RuleDraft[] }>).detail
  await syncRules(rules)
}

async function syncRules(rules: RuleDraft[]): Promise<void> {
  try {
    const response = await fetch('/api/rules', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(rules),
    })
    if (!response.ok) {
      throw new Error('Failed to save rules')
    }
    const saved = (await response.json()) as SignalRule[]
    const page = document.querySelector('signals-page')
    page?.setRules(saved)
  } catch {
    // Leave the UI unchanged on failure
  }
}

async function handleJobSelect(event: Event): Promise<void> {
  const { providerJobId, provider } = (event as CustomEvent<{ jobId: number; providerJobId: string; provider: string }>)
    .detail
  const page = document.querySelector('jobs-page')
  if (!page || !providerJobId) {
    return
  }
  await fetchAndSetJobMeta(providerJobId, provider, page)
}

async function handleInitialSelect(event: Event): Promise<void> {
  const { providerJobId, provider } = (event as CustomEvent<{ providerJobId: string; provider: string }>).detail
  const page = document.querySelector('jobs-page')
  if (!page || !providerJobId) {
    return
  }
  await fetchAndSetJobMeta(providerJobId, provider, page)
}

async function fetchAndSetJobMeta(providerJobId: string, provider: string | undefined, page: JobsPage): Promise<void> {
  let signals: JobSignal[] = []
  let queued = false

  const params = new URLSearchParams({ providerJobId })
  if (provider) {
    params.set('provider', provider)
  }
  const qs = params.toString()

  try {
    const [signalsRes, queueRes] = await Promise.all([fetch(`/api/signals?${qs}`), fetch(`/api/analysis-queue?${qs}`)])
    if (signalsRes.ok) {
      signals = (await signalsRes.json()) as JobSignal[]
    }
    if (queueRes.ok) {
      const data = (await queueRes.json()) as { queued?: boolean }
      queued = data.queued !== false
    }
  } catch {
    // Show empty state on failure
  }

  page.setJobMeta(providerJobId, signals, queued)
}

async function handleFlag(event: Event): Promise<void> {
  const { jobId, providerJobId } = (event as CustomEvent<{ jobId: number; providerJobId: string }>).detail
  try {
    const response = await fetch(`/api/jobs/${jobId}/flag`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topics: ['fetch_job_details', 'rank'] }),
    })
    if (!response.ok) {
      return
    }
  } catch {
    return
  }
  const page = document.querySelector('jobs-page')
  if (page) {
    page.setJobMeta(providerJobId, [], true)
  }
  window.dispatchEvent(new CustomEvent('jobs:refresh-request'))
}

async function handleRank(event: Event): Promise<void> {
  const { jobId, providerJobId } = (event as CustomEvent<{ jobId: number; providerJobId: string }>).detail
  try {
    const response = await fetch(`/api/jobs/${jobId}/flag`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic: 'rank' }),
    })
    if (!response.ok) {
      return
    }
  } catch {
    return
  }
  const page = document.querySelector('jobs-page')
  if (page) {
    page.setJobMeta(providerJobId, [], true)
  }
  window.dispatchEvent(new CustomEvent('jobs:refresh-request'))
}
