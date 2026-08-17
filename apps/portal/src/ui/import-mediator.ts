/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { ImportPage } from './pages/import/index.js'

function todayIso(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

let registered = false

export function initImportMediator(): void {
  if (registered) {
    return
  }
  registered = true
  window.addEventListener('import-page:ready', onReady)
  window.addEventListener('import-page:save', onSave)

  const existing = getPage()
  if (existing) {
    onReady(existing)
  }
}

export function _resetImportMediatorForTesting(): void {
  if (registered) {
    window.removeEventListener('import-page:ready', onReady)
    window.removeEventListener('import-page:save', onSave)
  }
  registered = false
}

function getPage(): ImportPage | null {
  return (document.getElementsByTagName('import-page')[0] as ImportPage | undefined) ?? null
}

function resolvePage(event?: Event): ImportPage | null {
  const target = event?.target as ImportPage | null
  if (target && target.tagName === 'IMPORT-PAGE') {
    return target
  }
  return getPage()
}

function onReady(event: Event | ImportPage): void {
  const page = (event as ImportPage).tagName === 'IMPORT-PAGE' ? (event as ImportPage) : resolvePage(event as Event)
  if (!page) {
    return
  }
  page.setDate(todayIso())
}

async function onSave(event: Event): Promise<void> {
  const detail = (event as CustomEvent<{ url: string; status: string; date: string }>).detail
  const page = resolvePage(event)
  if (!page) {
    return
  }

  page.setBusy(true)

  try {
    const response = await fetch('/api/jobs/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: detail.url, status: detail.status, at: detail.date }),
    })

    if (response.ok) {
      const data = (await response.json()) as { title: string }
      page.showSuccess(data.title)
    } else if (response.status === 409) {
      page.showError('Job already imported')
    } else {
      const body = await response.text()
      page.showError(body || 'Import failed')
    }
  } catch {
    page.showError('Network error')
  } finally {
    page.setBusy(false)
  }
}
