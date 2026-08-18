import { describe, it, expect } from 'vitest'
import { matchActionAtPosition, matchControllerIdentifierAtPosition } from '../src/hotwire/StimulusAttributeParser'

describe('matchControllerIdentifierAtPosition', () => {
  it('resolves the identifier when the cursor is inside a single-value data-controller attribute', () => {
    const line = '  <div data-controller="clipboard">'
    const char = line.indexOf('clipboard') + 3
    expect(matchControllerIdentifierAtPosition(line, char)).toBe('clipboard')
  })

  it('resolves the specific identifier under the cursor in a multi-value attribute', () => {
    const line = '  <div data-controller="dropdown clipboard">'
    const dropdownChar = line.indexOf('dropdown') + 2
    const clipboardChar = line.indexOf('clipboard') + 2
    expect(matchControllerIdentifierAtPosition(line, dropdownChar)).toBe('dropdown')
    expect(matchControllerIdentifierAtPosition(line, clipboardChar)).toBe('clipboard')
  })

  it('returns null when the cursor is outside any data-controller attribute', () => {
    const line = '  <div data-controller="clipboard">Some text</div>'
    expect(matchControllerIdentifierAtPosition(line, line.indexOf('Some text'))).toBeNull()
  })
})

describe('matchActionAtPosition', () => {
  it('resolves identifier and action from a simple data-action attribute', () => {
    const line = '  <button data-action="click->clipboard#copy">Copy</button>'
    const char = line.indexOf('copy">') + 1
    expect(matchActionAtPosition(line, char)).toEqual({ identifier: 'clipboard', action: 'copy' })
  })

  it('resolves the descriptor under the cursor in a multi-action attribute', () => {
    const line = '  <div data-action="click->dropdown#toggle mouseleave->dropdown#hide">'
    const toggleChar = line.indexOf('dropdown#toggle') + 12
    const hideChar = line.indexOf('dropdown#hide') + 12
    expect(matchActionAtPosition(line, toggleChar)).toEqual({ identifier: 'dropdown', action: 'toggle' })
    expect(matchActionAtPosition(line, hideChar)).toEqual({ identifier: 'dropdown', action: 'hide' })
  })

  it('resolves a bare identifier#action descriptor with no event prefix', () => {
    const line = '  <form data-action="clipboard#copy">'
    const char = line.indexOf('clipboard#copy') + 2
    expect(matchActionAtPosition(line, char)).toEqual({ identifier: 'clipboard', action: 'copy' })
  })

  it('returns null when the cursor is outside any data-action attribute', () => {
    const line = '  <button data-action="click->clipboard#copy">Copy</button>'
    expect(matchActionAtPosition(line, line.indexOf('Copy</button>'))).toBeNull()
  })
})
