/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import './job-stats.js'
import type { JobStats } from './job-stats.js'

describe('job-stats', () => {
  let el: JobStats

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('job-stats')
    document.body.appendChild(el)
  })

  it('renders totals and the new count', () => {
    el.setStats(10, 3)
    expect(el.textContent).toContain('10 total')
    expect(el.textContent).toContain('3 new')
  })
})
