/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { QueueSummaryResponse } from '../../../shared/types.js'
import './index.js'
import type { QueuesPage } from './index.js'

function summary(): QueueSummaryResponse {
  return {
    pending: { fetch_job_details: 1, rank: 2 },
    done: 3,
    failed: 0,
    total: 6,
    recent: [
      {
        id: 1,
        jobId: 10,
        title: 'Staff Engineer',
        companyName: 'Acme',
        providerJobId: 'job-1',
        topic: 'fetch_job_details',
        queuedAt: '2026-08-08 09:00:00',
        completedAt: null,
        errorMessage: null,
      },
    ],
  }
}

describe('queues-page', () => {
  let el: QueuesPage

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('queues-page')
    document.body.appendChild(el)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders the page shell with head and panel', () => {
    expect(el.querySelector('.page > .page-head h1')?.textContent).toBe('Queues')
    expect(el.querySelector('.page-count')?.textContent).toBe('0 pending · 0 done')
    expect(el.querySelector('.panel > ul.queue-list')).not.toBeNull()
  })

  it('renders head counts and rows from setSummary', () => {
    el.setSummary(summary())
    expect(el.querySelector('.page-count')?.textContent).toBe('3 pending · 3 done')
    expect(el.querySelectorAll('.queue-list li').length).toBe(1)
    expect(el.querySelector('.queue-row .queue-title')?.textContent).toBe('Staff Engineer')
  })

  it('shows a done tick only for completed rows', () => {
    el.setSummary({
      ...summary(),
      recent: [
        {
          id: 2,
          jobId: 11,
          title: 'Platform Engineer',
          companyName: 'Beta',
          providerJobId: 'job-2',
          topic: 'rank',
          queuedAt: '2026-08-08 08:00:00',
          completedAt: '2026-08-08 09:30:00',
          errorMessage: null,
        },
      ],
    })
    const row = el.querySelector<HTMLElement>('.queue-row')
    expect(row?.classList.contains('is-done')).toBe(true)
    expect(el.querySelector('.queue-done')).not.toBeNull()
    expect(el.querySelector('.queue-failed')).toBeNull()
  })

  it('renders a failed marker with the error message for failed rows', () => {
    el.setSummary({
      ...summary(),
      recent: [
        {
          id: 3,
          jobId: 12,
          title: 'Backend Engineer',
          companyName: 'Gamma',
          providerJobId: 'job-3',
          topic: 'rank',
          queuedAt: '2026-08-08 07:00:00',
          completedAt: '2026-08-08 07:05:00',
          errorMessage: 'Ollama connection refused',
        },
      ],
    })
    const row = el.querySelector<HTMLElement>('.queue-row')
    expect(row?.classList.contains('is-failed')).toBe(true)
    expect(row?.classList.contains('is-done')).toBe(false)
    const marker = el.querySelector<HTMLElement>('.queue-failed')
    expect(marker).not.toBeNull()
    expect(marker?.textContent).toBe('failed ✗')
    expect(marker?.getAttribute('title')).toBe('Ollama connection refused')
    expect(el.querySelector('.queue-done')).toBeNull()
  })

  it('surfaces the failed count in the head when there are failures', () => {
    el.setSummary({ ...summary(), failed: 2 })
    expect(el.querySelector('.page-count')?.textContent).toBe('3 pending · 3 done · 2 failed')
  })

  it('renders the topic-rank badge class for rank rows', () => {
    el.setSummary({
      ...summary(),
      recent: [
        {
          id: 2,
          jobId: 11,
          title: 'Platform Engineer',
          companyName: 'Beta',
          providerJobId: 'job-2',
          topic: 'rank',
          queuedAt: '2026-08-08 08:00:00',
          completedAt: null,
          errorMessage: null,
        },
      ],
    })
    const badge = el.querySelector<HTMLElement>('.queue-row .badge')
    expect(badge?.classList.contains('topic-rank')).toBe(true)
    expect(badge?.textContent).toBe('rank')
  })

  it('renders an empty state when there are no recent rows', () => {
    el.setSummary({ pending: { fetch_job_details: 0, rank: 0 }, done: 0, failed: 0, total: 0, recent: [] })
    expect(el.querySelector('.queue-empty')).not.toBeNull()
  })

  it('dispatches queues-page:ready on connect', () => {
    const received = { fired: false }
    document.addEventListener('queues-page:ready', () => {
      received.fired = true
    })
    document.body.appendChild(document.createElement('queues-page'))
    expect(received.fired).toBe(true)
  })

  it('renders two kick buttons in the head-actions', () => {
    const details = el.querySelector<HTMLButtonElement>('[data-action="kick-details"]')
    const rank = el.querySelector<HTMLButtonElement>('[data-action="kick-rank"]')
    expect(details?.textContent).toBe('Run fetch-details')
    expect(rank?.textContent).toBe('Run rank')
  })

  it('dispatches queues-page:kick with topic fetch_job_details on Run fetch-details click', () => {
    let detail: { topic: string } | undefined
    const handler = (e: Event) => {
      detail = (e as CustomEvent).detail
    }
    document.addEventListener('queues-page:kick', handler)

    el.querySelector<HTMLButtonElement>('[data-action="kick-details"]')?.click()
    expect(detail).toEqual({ topic: 'fetch_job_details' })

    document.removeEventListener('queues-page:kick', handler)
  })

  it('dispatches queues-page:kick with topic rank on Run rank click', () => {
    let detail: { topic: string } | undefined
    const handler = (e: Event) => {
      detail = (e as CustomEvent).detail
    }
    document.addEventListener('queues-page:kick', handler)

    el.querySelector<HTMLButtonElement>('[data-action="kick-rank"]')?.click()
    expect(detail).toEqual({ topic: 'rank' })

    document.removeEventListener('queues-page:kick', handler)
  })

  it('disables the details button and sets aria-busy via setKickBusy', () => {
    el.setKickBusy('fetch_job_details', true)
    const btn = el.querySelector<HTMLButtonElement>('[data-action="kick-details"]')
    expect(btn?.disabled).toBe(true)
    expect(btn?.getAttribute('aria-busy')).toBe('true')
  })

  it('disables the rank button and sets aria-busy via setKickBusy', () => {
    el.setKickBusy('rank', true)
    const btn = el.querySelector<HTMLButtonElement>('[data-action="kick-rank"]')
    expect(btn?.disabled).toBe(true)
    expect(btn?.getAttribute('aria-busy')).toBe('true')
  })

  it('re-enables the button via setKickBusy false', () => {
    el.setKickBusy('fetch_job_details', true)
    el.setKickBusy('fetch_job_details', false)
    const btn = el.querySelector<HTMLButtonElement>('[data-action="kick-details"]')
    expect(btn?.disabled).toBe(false)
    expect(btn?.getAttribute('aria-busy')).toBe('false')
  })

  describe('auto-refresh interval', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('dispatches queues-page:tick every 5 seconds', () => {
      vi.useFakeTimers()
      document.body.innerHTML = ''
      const fresh = document.createElement('queues-page')
      document.body.appendChild(fresh)

      let ticks = 0
      const handler = () => {
        ticks++
      }
      document.addEventListener('queues-page:tick', handler)

      vi.advanceTimersByTime(5000)
      expect(ticks).toBe(1)

      vi.advanceTimersByTime(5000)
      expect(ticks).toBe(2)

      document.removeEventListener('queues-page:tick', handler)
      document.body.innerHTML = ''
    })

    it('stops the interval on disconnect', () => {
      vi.useFakeTimers()
      document.body.innerHTML = ''
      const fresh = document.createElement('queues-page')
      document.body.appendChild(fresh)

      let ticks = 0
      const handler = () => {
        ticks++
      }
      document.addEventListener('queues-page:tick', handler)

      document.body.removeChild(fresh)
      vi.advanceTimersByTime(10000)
      expect(ticks).toBe(0)

      document.removeEventListener('queues-page:tick', handler)
    })
  })
})
