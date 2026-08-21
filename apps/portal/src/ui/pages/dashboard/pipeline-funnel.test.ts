/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import './pipeline-funnel.js'
import type { PipelineFunnel, PipelineData } from './pipeline-funnel.js'

function samplePipeline(): PipelineData {
  return { applied: 12, interviewing: 4, successful: 1, unsuccessful: 3, declined: 2 }
}

describe('pipeline-funnel', () => {
  let el: PipelineFunnel

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('pipeline-funnel')
    document.body.appendChild(el)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  function fillFor(label: string): HTMLElement | null {
    for (const row of el.querySelectorAll<HTMLElement>('.funnel-row')) {
      if (row.querySelector('.funnel-label')?.textContent === label) {
        return row.querySelector<HTMLElement>('.funnel-fill')
      }
    }
    return null
  }

  it('renders skeleton rows with dashes when no data set', () => {
    expect(el.querySelectorAll('.funnel-row').length).toBe(5)
    expect(el.querySelector('.funnel-count')?.textContent).toBe('—')
    expect(el.querySelector('.funnel-note')?.textContent).toContain('—')
  })

  it('renders 5 rows plus divider and note when data is set', () => {
    el.setData(samplePipeline())
    expect(el.querySelectorAll('.funnel-row').length).toBe(5)
    expect(el.querySelector('.funnel-divider')?.textContent).toBe('Closed')
    expect(el.querySelector('.funnel-note')).not.toBeNull()
  })

  it('renders labels in funnel order', () => {
    el.setData(samplePipeline())
    const labels = [...el.querySelectorAll('.funnel-label')].map(n => n.textContent)
    expect(labels).toEqual(['Applied', 'Interviewing', 'Successful', 'Unsuccessful', 'Declined'])
  })

  it('renders correct counts', () => {
    el.setData(samplePipeline())
    const counts = [...el.querySelectorAll('.funnel-count')].map(n => n.textContent)
    expect(counts).toEqual(['12', '4', '1', '3', '2'])
  })

  it('gives the widest active stage a full-width bar', () => {
    el.setData(samplePipeline())
    expect(fillFor('Applied')?.style.width).toBe('100%')
  })

  it('scales remaining bars against the active maximum', () => {
    el.setData(samplePipeline())
    expect(fillFor('Interviewing')?.style.width).toBe('33%')
    expect(fillFor('Successful')?.style.width).toBe('8%')
    expect(fillFor('Unsuccessful')?.style.width).toBe('25%')
    expect(fillFor('Declined')?.style.width).toBe('17%')
  })

  it('renders zero-width bars when all active stages are empty', () => {
    el.setData({ applied: 0, interviewing: 0, successful: 0, unsuccessful: 3, declined: 2 })
    for (const label of ['Applied', 'Interviewing', 'Successful']) {
      expect(fillFor(label)?.style.width).toBe('0%')
    }
  })

  it('colours active stages and greys closed outcomes', () => {
    el.setData(samplePipeline())
    expect(fillFor('Applied')?.classList.contains('applied')).toBe(true)
    expect(fillFor('Interviewing')?.classList.contains('interviewing')).toBe(true)
    expect(fillFor('Successful')?.classList.contains('successful')).toBe(true)
    expect(fillFor('Unsuccessful')?.classList.contains('outcome')).toBe(true)
    expect(fillFor('Declined')?.classList.contains('outcome')).toBe(true)
  })

  it('shows conversion rates in the footer', () => {
    el.setData(samplePipeline())
    expect(el.querySelector('.funnel-note')?.textContent).toBe(
      'Applied → interviewing 33% · Interviewing → successful 25%'
    )
  })

  it('re-renders when setData is called multiple times', () => {
    el.setData(samplePipeline())
    expect(el.querySelector('.funnel-note')?.textContent).toContain('33%')

    el.setData(null)
    expect(el.querySelector('.funnel-count')?.textContent).toBe('—')
  })
})
