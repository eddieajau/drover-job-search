/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import type { Query } from '../../../shared/types.js'
import type { ToggleSwitch } from '../../elements/toggle-switch.js'
import './query-edit-page.js'
import type { QueryEditPage } from './query-edit-page.js'

function query(): Query {
  return {
    id: 1,
    provider: 'linkedin',
    queryText: 'Staff Engineer',
    queryOptions: { location: 'Brisbane', workType: 'hybrid', jobType: 'fulltime,contract' },
    enabled: true,
    createdAt: '2026-08-05 00:00:00',
  }
}

describe('query-edit-page', () => {
  let el: QueryEditPage

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('query-edit-page')
    document.body.appendChild(el)
  })

  it('dispatches query-edit-page:ready on connect', () => {
    const received = { fired: false }
    document.addEventListener('query-edit-page:ready', () => {
      received.fired = true
    })
    document.body.appendChild(document.createElement('query-edit-page'))
    expect(received.fired).toBe(true)
  })

  it('renders a blank form for a new query, enabled by default', () => {
    el.setState({})
    expect(el.querySelector('#edit-q-text')?.getAttribute('value')).toBe('')
    expect(el.querySelector<ToggleSwitch>('toggle-switch#edit-q-enabled')?.checked).toBe(true)
    expect(el.querySelector('#btn-delete-query')).toBeNull()
    expect(el.querySelector('h1')?.textContent).toBe('New query')
  })

  it('renders the page shell with crumb, h1, form card and actions', () => {
    el.setState({})
    const crumb = el.querySelector<HTMLAnchorElement>('.crumb')
    expect(crumb?.getAttribute('href')).toBe('#queries')
    expect(crumb?.textContent).toContain('Queries')
    expect(el.querySelector('h1')?.textContent).toBe('New query')
    expect(el.querySelector('form.form')).not.toBeNull()
    const actions = el.querySelector('.form-actions')
    expect(actions?.querySelector<HTMLButtonElement>('#btn-save-query')?.textContent).toBe('Save query')
    expect(actions?.querySelector<HTMLAnchorElement>('a[href="#queries"]')?.textContent).toBe('Cancel')
  })

  it('prefills the form for an existing query', () => {
    el.setState({ query: query() })
    expect(el.querySelector<HTMLInputElement>('#edit-q-text')?.value).toBe('Staff Engineer')
    expect(el.querySelector<HTMLInputElement>('#edit-q-location')?.value).toBe('Brisbane')
    expect(el.querySelector<HTMLInputElement>('input[name="q-work-type"][value="hybrid"]')?.checked).toBe(true)
    expect(el.querySelector<HTMLInputElement>('input[name="q-work-type"][value="remote"]')?.checked).toBe(false)
    expect(el.querySelector<ToggleSwitch>('toggle-switch#edit-q-enabled')?.checked).toBe(true)
    expect(el.querySelector('h1')?.textContent).toBe('Edit query')
  })

  it('renders the query text field with required marker and hint', () => {
    el.setState({ query: query() })
    const field = el.querySelector('#edit-q-text')?.closest('.field')
    const label = field?.querySelector('.field-label.req')
    expect(label?.getAttribute('for')).toBe('edit-q-text')
    expect(label?.textContent).toBe('Query text')
    expect(field?.querySelector('.hint')?.textContent).toBe('Keywords sent to the provider.')
  })

  it('renders the location field with hint', () => {
    el.setState({ query: query() })
    const field = el.querySelector('#edit-q-location')?.closest('.field')
    expect(field?.querySelector('.field-label')?.textContent).toBe('Location')
    expect(field?.querySelector('.hint')?.textContent).toBe('Leave empty to search anywhere.')
  })

  it('places the work-type pills and job-type pills in the field-grid', () => {
    el.setState({ query: query() })
    const grid = el.querySelector('.field-grid')
    expect(grid).not.toBeNull()
    const workField = grid?.querySelector<HTMLFieldSetElement>('fieldset.field')
    expect(workField?.querySelector('.field-label')?.textContent).toBe('Work type')
    expect(workField?.querySelectorAll('.check-pill input[name="q-work-type"]')).toHaveLength(3)
    const jobField = grid?.querySelectorAll<HTMLFieldSetElement>('fieldset.field')[1]
    expect(jobField?.querySelector('.field-label')?.textContent).toBe('Job type')
    expect(jobField?.querySelectorAll('.check-pill input[name="q-job-type"]')).toHaveLength(3)
  })

  it('renders the enabled control as a toggle-switch switch-field', () => {
    el.setState({ query: query() })
    const field = el.querySelector('.switch-field')
    expect(field).not.toBeNull()
    expect(field?.querySelector<ToggleSwitch>('toggle-switch#edit-q-enabled')).not.toBeNull()
    expect(field?.querySelector('.switch-text .field-label')?.textContent).toBe('Enabled')
    expect(field?.querySelector('.switch-text .hint')?.textContent).toBe(
      'Disabled queries are kept but excluded from searches.'
    )
  })

  it('dispatches query-edit-page:save with the edited values', () => {
    el.setState({ query: query() })
    const received = { fired: false }
    el.addEventListener('query-edit-page:save', event => {
      received.fired = true
      expect((event as CustomEvent).detail).toEqual({
        id: 1,
        queryText: 'Staff Engineer',
        queryOptions: { location: 'Brisbane', workType: 'hybrid', jobType: 'fulltime,contract' },
        enabled: true,
      })
    })
    el.querySelector<HTMLButtonElement>('#btn-save-query')?.click()
    expect(received.fired).toBe(true)
  })

  it('dispatches query-edit-page:save without id for a new query', () => {
    el.setState({})
    el.querySelector<HTMLInputElement>('#edit-q-text')!.value = 'Staff Engineer'
    const received = { fired: false }
    el.addEventListener('query-edit-page:save', event => {
      received.fired = true
      expect((event as CustomEvent).detail.id).toBeUndefined()
    })
    el.querySelector<HTMLButtonElement>('#btn-save-query')?.click()
    expect(received.fired).toBe(true)
  })

  it('does not dispatch save when the query text is empty', () => {
    el.setState({})
    const received = { fired: false }
    el.addEventListener('query-edit-page:save', () => {
      received.fired = true
    })
    el.querySelector<HTMLButtonElement>('#btn-save-query')?.click()
    expect(received.fired).toBe(false)
  })

  it('reflects a toggle-switch change in the saved enabled flag', () => {
    el.setState({ query: query() })
    const received = { enabled: true }
    el.addEventListener('query-edit-page:save', event => {
      received.enabled = (event as CustomEvent).detail.enabled
    })
    el.querySelector<ToggleSwitch>('toggle-switch#edit-q-enabled')?.querySelector('input')?.click()
    el.querySelector<HTMLButtonElement>('#btn-save-query')?.click()
    expect(received.enabled).toBe(false)
  })

  it('renders an unchecked switch for a disabled query', () => {
    el.setState({ query: { ...query(), enabled: false } })
    expect(el.querySelector<ToggleSwitch>('toggle-switch#edit-q-enabled')?.checked).toBe(false)
  })

  it('flows checked job-type pills into the saved jobType', () => {
    el.setState({})
    el.querySelector<HTMLInputElement>('input[name="q-job-type"][value="fulltime"]')!.checked = true
    el.querySelector<HTMLInputElement>('input[name="q-job-type"][value="contract"]')!.checked = true
    const received = { jobType: '' }
    el.addEventListener('query-edit-page:save', event => {
      received.jobType = (event as CustomEvent).detail.queryOptions.jobType
    })
    el.querySelector<HTMLInputElement>('#edit-q-text')!.value = 'Staff Engineer'
    el.querySelector<HTMLButtonElement>('#btn-save-query')?.click()
    expect(received.jobType).toBe('fulltime,contract')
  })

  it('flows checked work-type pills into a comma-joined workType', () => {
    el.setState({})
    el.querySelector<HTMLInputElement>('input[name="q-work-type"][value="remote"]')!.checked = true
    el.querySelector<HTMLInputElement>('input[name="q-work-type"][value="hybrid"]')!.checked = true
    const received = { workType: '' }
    el.addEventListener('query-edit-page:save', event => {
      received.workType = (event as CustomEvent).detail.queryOptions.workType
    })
    el.querySelector<HTMLInputElement>('#edit-q-text')!.value = 'Staff Engineer'
    el.querySelector<HTMLButtonElement>('#btn-save-query')?.click()
    expect(received.workType).toBe('hybrid,remote')
  })
})
