/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { describe, expect, it } from 'vitest'

import { escapeHtml } from './escape.js'

describe('escapeHtml', () => {
  it('escapes &, <, >, quotes and apostrophes', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;')
  })

  it('passes through safe text unchanged', () => {
    expect(escapeHtml('Hello world')).toBe('Hello world')
    expect(escapeHtml('')).toBe('')
    expect(escapeHtml('section 1: Introduction')).toBe('section 1: Introduction')
  })

  it('handles all special characters together', () => {
    const input = 'a & b < c > d " e \' f'
    const expected = 'a &amp; b &lt; c &gt; d &quot; e &#39; f'
    expect(escapeHtml(input)).toBe(expected)
  })
})
