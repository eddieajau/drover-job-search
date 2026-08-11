/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import type { FactResponse } from '../../../shared/types.js'
import type { ToggleSwitch } from '../../elements/toggle-switch.js'
import './fact-edit-page.js'
import type { FactEditPage } from './fact-edit-page.js'

function fact(): FactResponse {
  return {
    id: 5,
    category: 'skill',
    label: 'TypeScript',
    detail: 'Five years of daily TS.',
    evidenceType: 'fast_pivot',
    startedAt: '2021-01-01',
    endedAt: '2025-12-31',
    period: '5y',
    confidence: 'inferred',
    active: true,
    createdAt: '2026-08-05 00:00:00',
    updatedAt: '2026-08-05 00:00:00',
  }
}

describe('fact-edit-page', () => {
  let el: FactEditPage

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('fact-edit-page')
    document.body.appendChild(el)
  })

  it('dispatches fact-edit-page:ready on connect', () => {
    const received = { fired: false }
    document.addEventListener('fact-edit-page:ready', () => {
      received.fired = true
    })
    document.body.appendChild(document.createElement('fact-edit-page'))
    expect(received.fired).toBe(true)
  })

  it('renders a blank form for a new fact, active by default', () => {
    el.setState({})
    expect(el.querySelector<HTMLInputElement>('#edit-fact-label')?.value).toBe('')
    expect(el.querySelector<ToggleSwitch>('toggle-switch#edit-fact-active')?.checked).toBe(true)
    expect(el.querySelector('h1')?.textContent).toBe('New fact')
  })

  it('renders the page shell with crumb, h1, form card and actions', () => {
    el.setState({})
    const crumb = el.querySelector<HTMLAnchorElement>('.crumb')
    expect(crumb?.getAttribute('href')).toBe('#facts')
    expect(crumb?.textContent).toContain('Facts')
    expect(el.querySelector('h1')?.textContent).toBe('New fact')
    expect(el.querySelector('form.form')).not.toBeNull()
    const actions = el.querySelector('.form-actions')
    expect(actions?.querySelector<HTMLButtonElement>('#btn-save-fact')?.textContent).toBe('Save fact')
    expect(actions?.querySelector<HTMLAnchorElement>('a[href="#facts"]')?.textContent).toBe('Cancel')
  })

  it('prefills the form for an existing fact', () => {
    el.setState({ fact: fact() })
    expect(el.querySelector<HTMLInputElement>('#edit-fact-label')?.value).toBe('TypeScript')
    expect(el.querySelector<HTMLSelectElement>('#edit-fact-category')?.value).toBe('skill')
    expect(el.querySelector<HTMLTextAreaElement>('#edit-fact-detail')?.value).toBe('Five years of daily TS.')
    expect(el.querySelector<HTMLSelectElement>('#edit-fact-evidence')?.value).toBe('fast_pivot')
    expect(el.querySelector<HTMLInputElement>('input[name="fact-confidence"]:checked')?.value).toBe('inferred')
    expect(el.querySelector<HTMLInputElement>('#edit-fact-started')?.value).toBe('2021-01-01')
    expect(el.querySelector<HTMLInputElement>('#edit-fact-ended')?.value).toBe('2025-12-31')
    expect(el.querySelector<HTMLInputElement>('#edit-fact-period')?.value).toBe('5y')
    expect(el.querySelector<ToggleSwitch>('toggle-switch#edit-fact-active')?.checked).toBe(true)
    expect(el.querySelector('h1')?.textContent).toBe('Edit fact')
  })

  it('renders the label field with required marker', () => {
    el.setState({ fact: fact() })
    const field = el.querySelector('#edit-fact-label')?.closest('.field')
    const label = field?.querySelector('.field-label.req')
    expect(label?.getAttribute('for')).toBe('edit-fact-label')
    expect(label?.textContent).toBe('Label')
  })

  it('renders seven category options including constraint', () => {
    el.setState({ fact: fact() })
    const options = el.querySelectorAll<HTMLOptionElement>('#edit-fact-category option')
    expect(options.length).toBe(7)
    expect(options[0]?.value).toBe('skill')
    expect(options[5]?.value).toBe('principle')
    expect(options[6]?.value).toBe('constraint')
  })

  it('renders the evidence-type select with a blank option and three values', () => {
    el.setState({ fact: fact() })
    const options = el.querySelectorAll<HTMLOptionElement>('#edit-fact-evidence option')
    expect(options.length).toBe(4)
    expect(options[0]?.value).toBe('')
    expect(options[0]?.textContent).toContain('none')
    expect(options[1]?.value).toBe('fast_pivot')
  })

  it('renders confidence as radio check-pills inside a fieldset', () => {
    el.setState({ fact: fact() })
    const fieldset = el.querySelector<HTMLFieldSetElement>('fieldset.field')
    expect(fieldset?.querySelector('legend')?.textContent).toBe('Confidence')
    const radios = fieldset?.querySelectorAll<HTMLInputElement>('input[type="radio"][name="fact-confidence"]')
    expect(radios?.length).toBe(3)
    expect(radios?.[0]?.value).toBe('stated')
    expect(radios?.[1]?.value).toBe('inferred')
    expect(radios?.[2]?.value).toBe('stretch')
  })

  it('places started-at and ended-at date inputs in a field-grid', () => {
    el.setState({ fact: fact() })
    const grid = el.querySelector('.field-grid')
    expect(grid).not.toBeNull()
    expect(grid?.querySelector<HTMLInputElement>('#edit-fact-started')?.type).toBe('date')
    expect(grid?.querySelector<HTMLInputElement>('#edit-fact-ended')?.type).toBe('date')
  })

  it('renders the period field with a hint', () => {
    el.setState({ fact: fact() })
    const field = el.querySelector('#edit-fact-period')?.closest('.field')
    expect(field?.querySelector('.hint')?.textContent).toContain('2y3m')
  })

  it('renders the active control as a toggle-switch switch-field', () => {
    el.setState({ fact: fact() })
    const field = el.querySelector('.switch-field')
    expect(field).not.toBeNull()
    expect(field?.querySelector<ToggleSwitch>('toggle-switch#edit-fact-active')).not.toBeNull()
    expect(field?.querySelector('.switch-text .field-label')?.textContent).toBe('Active')
    expect(field?.querySelector('.switch-text .hint')?.textContent).toContain('Inactive facts')
  })

  it('dispatches fact-edit-page:save with the edited values', () => {
    el.setState({ fact: fact() })
    const received = { fired: false }
    el.addEventListener('fact-edit-page:save', event => {
      received.fired = true
      expect((event as CustomEvent).detail).toEqual({
        id: 5,
        label: 'TypeScript',
        category: 'skill',
        detail: 'Five years of daily TS.',
        evidenceType: 'fast_pivot',
        confidence: 'inferred',
        startedAt: '2021-01-01',
        endedAt: '2025-12-31',
        period: '5y',
        active: true,
      })
    })
    el.querySelector<HTMLButtonElement>('#btn-save-fact')?.click()
    expect(received.fired).toBe(true)
  })

  it('dispatches fact-edit-page:save without id for a new fact', () => {
    el.setState({})
    el.querySelector<HTMLInputElement>('#edit-fact-label')!.value = 'TypeScript'
    const received = { fired: false }
    el.addEventListener('fact-edit-page:save', event => {
      received.fired = true
      expect((event as CustomEvent).detail.id).toBeUndefined()
    })
    el.querySelector<HTMLButtonElement>('#btn-save-fact')?.click()
    expect(received.fired).toBe(true)
  })

  it('does not dispatch save when the label is empty', () => {
    el.setState({})
    const received = { fired: false }
    el.addEventListener('fact-edit-page:save', () => {
      received.fired = true
    })
    el.querySelector<HTMLButtonElement>('#btn-save-fact')?.click()
    expect(received.fired).toBe(false)
  })

  it('reflects a toggle-switch change in the saved active flag', () => {
    el.setState({ fact: fact() })
    const received = { active: true }
    el.addEventListener('fact-edit-page:save', event => {
      received.active = (event as CustomEvent).detail.active
    })
    el.querySelector<ToggleSwitch>('toggle-switch#edit-fact-active')?.querySelector('input')?.click()
    el.querySelector<HTMLButtonElement>('#btn-save-fact')?.click()
    expect(received.active).toBe(false)
  })

  it('renders an unchecked switch for an inactive fact', () => {
    el.setState({ fact: { ...fact(), active: false } })
    expect(el.querySelector<ToggleSwitch>('toggle-switch#edit-fact-active')?.checked).toBe(false)
  })

  it('flows the selected confidence radio into the saved confidence', () => {
    el.setState({})
    el.querySelector<HTMLInputElement>('input[name="fact-confidence"][value="stretch"]')!.checked = true
    el.querySelector<HTMLInputElement>('#edit-fact-label')!.value = 'Some fact'
    const received = { confidence: '' }
    el.addEventListener('fact-edit-page:save', event => {
      received.confidence = (event as CustomEvent).detail.confidence
    })
    el.querySelector<HTMLButtonElement>('#btn-save-fact')?.click()
    expect(received.confidence).toBe('stretch')
  })
})
