/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import './queue-health.js'
import type { QueueHealth, QueueHealthData } from './queue-health.js'

function sampleHealthy(): QueueHealthData {
  return {
    pending: { fetch_job_details: 0, rank: 0 },
    done: 87,
    total: 312,
  }
}

function sampleBusy(): QueueHealthData {
  return {
    pending: { fetch_job_details: 5, rank: 2 },
    done: 87,
    total: 312,
  }
}

describe('queue-health', () => {
  let el: QueueHealth

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('queue-health')
    document.body.appendChild(el)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders skeleton rows with dashes when no data set', () => {
    const values = el.querySelectorAll('.mini-value')
    expect(values.length).toBe(4)
    expect(values[0].textContent).toBe('—')
  })

  it('renders no health chip when data is null', () => {
    expect(el.querySelector('.health-chip')).toBeNull()
  })

  it('renders 4 mini-row items when data is set', () => {
    el.setData(sampleHealthy())
    expect(el.querySelectorAll('.mini-row').length).toBe(4)
  })

  it('shows Healthy chip when both pending queues are 0', () => {
    el.setData(sampleHealthy())
    const chip = el.querySelector('.health-chip')
    expect(chip).not.toBeNull()
    expect(chip?.textContent).toBe('Healthy')
    expect(chip?.classList.contains('healthy')).toBe(true)
  })

  it('shows Busy chip when fetch_job_details is > 0', () => {
    el.setData(sampleBusy())
    const chip = el.querySelector('.health-chip')
    expect(chip).not.toBeNull()
    expect(chip?.textContent).toBe('Busy')
    expect(chip?.classList.contains('busy')).toBe(true)
  })

  it('shows Busy chip when rank is > 0', () => {
    el.setData({ pending: { fetch_job_details: 0, rank: 1 }, done: 10, total: 50 })
    const chip = el.querySelector('.health-chip')
    expect(chip?.textContent).toBe('Busy')
  })

  it('displays correct values for each row', () => {
    el.setData(sampleBusy())
    const values = el.querySelectorAll('.mini-value')
    expect(values[0].textContent).toBe('2')
    expect(values[1].textContent).toBe('5')
    expect(values[2].textContent).toBe('87')
    expect(values[3].textContent).toBe('312')
  })

  it('displays correct labels for each row', () => {
    el.setData(sampleHealthy())
    const labels = el.querySelectorAll('.mini-label')
    expect(labels[0].textContent).toBe('Rank pending')
    expect(labels[1].textContent).toBe('Fetch details pending')
    expect(labels[2].textContent).toBe('Completed, last 7d')
    expect(labels[3].textContent).toBe('Total processed')
  })

  it('re-renders when setData is called multiple times', () => {
    el.setData(sampleHealthy())
    expect(el.querySelector('.health-chip')?.textContent).toBe('Healthy')

    el.setData(sampleBusy())
    expect(el.querySelector('.health-chip')?.textContent).toBe('Busy')

    el.setData(null)
    expect(el.querySelector('.health-chip')).toBeNull()
  })
})
