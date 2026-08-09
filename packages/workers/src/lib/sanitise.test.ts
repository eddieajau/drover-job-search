/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { describe, it, expect } from 'vitest'

import { sanitise } from './sanitise.js'

describe('sanitise', () => {
  it('decodes HTML entities to text', () => {
    expect(sanitise('Senior&amp;Backend')).toBe('Senior&Backend')
    expect(sanitise('&lt;script&gt;')).toBe('<script>')
    expect(sanitise('&quot;hello&quot;')).toBe('"hello"')
    expect(sanitise('it&#39;s')).toBe("it's")
    expect(sanitise('foo&nbsp;bar')).toBe('foo bar')
  })

  it('strips zero-width and invisible control characters', () => {
    expect(sanitise('hello\u200Bworld')).toBe('helloworld')
    expect(sanitise('a\uFEFFb')).toBe('ab')
    expect(sanitise('soft\u00ADhyphen')).toBe('softhyphen')
    expect(sanitise('bidi\u200Emark')).toBe('bidimark')
  })

  it('strips bidi formatting characters', () => {
    expect(sanitise('\u202Ahidden\u202C')).toBe('hidden')
    expect(sanitise('\u2066iso\u2069')).toBe('iso')
  })

  it('collapses whitespace', () => {
    expect(sanitise('hello   world')).toBe('hello world')
    expect(sanitise('  leading')).toBe('leading')
    expect(sanitise('trailing  ')).toBe('trailing')
    expect(sanitise('a\n\n\tb')).toBe('a b')
  })

  it('caps length at maxLen', () => {
    const long = 'a'.repeat(5000)
    expect(sanitise(long).length).toBe(4000)
    expect(sanitise(long, 100).length).toBe(100)
  })

  it('handles combined input', () => {
    const input = '  Senior&nbsp;Java\u200BDeveloper &amp; Lead  '
    expect(sanitise(input)).toBe('Senior JavaDeveloper & Lead')
  })
})
