/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { describe, expect, it } from 'vitest'

import { toMarkdown } from './markdown.js'

describe('toMarkdown', () => {
  it('converts inline and block structure to markdown', () => {
    expect(toMarkdown('<strong>bold</strong>')).toBe('**bold**')
    expect(toMarkdown('<em>italic</em>')).toBe('*italic*')
    expect(toMarkdown('<h2>heading</h2>')).toBe('## heading')
    expect(toMarkdown('<a href="https://x.com">link</a>')).toBe('[link](https://x.com)')
    expect(toMarkdown('<ul><li>a</li><li>b</li></ul>')).toBe('-   a\n-   b')
  })

  it('strips scripts, styles, and comments before converting', () => {
    expect(toMarkdown('<script>alert("x")</script><p>ok</p>')).toBe('ok')
    expect(toMarkdown('<style>.x{}</style><p>ok</p>')).toBe('ok')
    expect(toMarkdown('<!-- hidden comment --><p>ok</p>')).toBe('ok')
  })

  it('drops hidden elements', () => {
    expect(toMarkdown('<div hidden>secret</div><p>visible</p>')).toBe('visible')
    expect(toMarkdown('<span aria-hidden="true">decor</span><p>kept</p>')).toBe('kept')
    expect(toMarkdown('<p style="display:none">gone</p><p>kept</p>')).toBe('kept')
    expect(toMarkdown('<div style="width:0;height:0">zero</div><p>x</p>')).toBe('x')
  })

  it('keeps structural tags intact for turndown', () => {
    expect(toMarkdown('<p>We do <strong>stuff</strong> at <em>Acme</em>.</p>')).toBe('We do **stuff** at *Acme*.')
  })

  it('passes plain text through unchanged', () => {
    expect(toMarkdown('Full job description text')).toBe('Full job description text')
  })
})
