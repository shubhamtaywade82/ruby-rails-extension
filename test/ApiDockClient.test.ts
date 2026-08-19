import { describe, it, expect } from 'vitest'
import { extractSummary, extractTopNote } from '../src/docs/ApiDockClient'

const SAMPLE_PAGE = `
<html>
<body>
  <h1>update_attribute</h1>
  <div id="method-description">
    <p>Updates a single attribute and saves the record without going through the normal validation procedure.</p>
  </div>
  <div id="notes">
    <h2>5 Notes</h2>
    <div class="note" id="note-1">
      <div class="meta">Ariejan · Aug 11, 2008</div>
      <p>8 thanks</p>
      <p>Watch out, this skips validations entirely! Use update_attributes instead if you need them.</p>
    </div>
    <div class="note" id="note-2">
      <p>Another less popular note about edge cases.</p>
    </div>
  </div>
  <div id="related-methods">
    <h2>Instance methods</h2>
  </div>
</body>
</html>
`

describe('extractSummary', () => {
  it('extracts and strips the method description', () => {
    expect(extractSummary(SAMPLE_PAGE)).toBe(
      'Updates a single attribute and saves the record without going through the normal validation procedure.',
    )
  })

  it('returns null when no description section is present', () => {
    expect(extractSummary('<html><body>no docs here</body></html>')).toBeNull()
  })

  it('truncates an overly long description', () => {
    const longText = 'a'.repeat(600)
    const html = `<div id="text">${longText}</div><div id="notes"></div>`
    const result = extractSummary(html)
    expect(result).not.toBeNull()
    expect(result!.length).toBeLessThanOrEqual(501)
    expect(result!.endsWith('…')).toBe(true)
  })
})

describe('extractTopNote', () => {
  it('skips vote-count fragments and returns the first real note', () => {
    expect(extractTopNote(SAMPLE_PAGE)).toBe(
      'Watch out, this skips validations entirely! Use update_attributes instead if you need them.',
    )
  })

  it('returns null when there is no notes section', () => {
    expect(extractTopNote('<html><body>no notes</body></html>')).toBeNull()
  })
})
