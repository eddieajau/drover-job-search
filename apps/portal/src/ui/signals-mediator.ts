/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { JobSignal, SignalRule } from '../shared/types.js'
import type { RuleDraft } from './pages/signals/rules-list.js'

let registered = false

export function initSignalsMediator(): void {
  if (registered) {
    return
  }
  registered = true
  window.addEventListener('signals-page:ready', handleSignalsReady)
  window.addEventListener('rules-list:save', handleSave)
  window.addEventListener('rules-list:trash', handleTrash)
  window.addEventListener('rules-list:toggle', handleToggle)
  window.addEventListener('job-list:select', handleJobSelect)
  window.addEventListener('job-signals-panel:flag', handleFlag)
}

export function _resetSignalsMediatorForTesting(): void {
  if (registered) {
    window.removeEventListener('signals-page:ready', handleSignalsReady)
    window.removeEventListener('rules-list:save', handleSave)
    window.removeEventListener('rules-list:trash', handleTrash)
    window.removeEventListener('rules-list:toggle', handleToggle)
    window.removeEventListener('job-list:select', handleJobSelect)
    window.removeEventListener('job-signals-panel:flag', handleFlag)
  }
  registered = false
}

async function handleSignalsReady(): Promise<void> {
  const page = document.querySelector('signals-page')
  if (!page) {
    return
  }
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
  const { jobId } = (event as CustomEvent<{ jobId: string }>).detail
  const page = document.querySelector('jobs-page')
  if (!page || !jobId) {
    return
  }

  let signals: JobSignal[] = []
  let queued = false

  try {
    const [signalsRes, queueRes] = await Promise.all([
      fetch(`/api/signals?providerJobId=${encodeURIComponent(jobId)}`),
      fetch(`/api/analysis-queue?providerJobId=${encodeURIComponent(jobId)}`),
    ])
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

  page.setJobSignals(jobId, signals, queued)
}

async function handleFlag(event: Event): Promise<void> {
  const { providerJobId } = (event as CustomEvent<{ providerJobId: string }>).detail
  try {
    await fetch('/api/analysis-queue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerJobId }),
    })
  } catch {
    return
  }
  const page = document.querySelector('jobs-page')
  if (page) {
    page.setJobSignals(providerJobId, [], true)
  }
}
