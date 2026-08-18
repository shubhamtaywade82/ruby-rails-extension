import { describe, it, expect } from 'vitest'
import { extractRenderPathAtPosition } from '../src/rails/ViewPartialResolver'

describe('extractRenderPathAtPosition', () => {
  it('resolves the path from a plain render call', () => {
    const line = '  <%= render "shared/navbar" %>'
    const char = line.indexOf('shared/navbar') + 3
    expect(extractRenderPathAtPosition(line, char)).toBe('shared/navbar')
  })

  it('resolves the path from a render partial: call with locals', () => {
    const line = '  <%= render partial: "users/card", locals: { user: user } %>'
    const char = line.indexOf('users/card') + 3
    expect(extractRenderPathAtPosition(line, char)).toBe('users/card')
  })

  it('resolves the path from a parenthesized render call', () => {
    const line = '  <%= render(partial: "users/card") %>'
    const char = line.indexOf('users/card') + 3
    expect(extractRenderPathAtPosition(line, char)).toBe('users/card')
  })

  it('returns null when the cursor is outside the render path', () => {
    const line = '  <%= render "shared/navbar" %>'
    expect(extractRenderPathAtPosition(line, 1)).toBeNull()
  })

  it('returns null when the line has no render call', () => {
    const line = '  <p>Just some text</p>'
    expect(extractRenderPathAtPosition(line, 5)).toBeNull()
  })
})
