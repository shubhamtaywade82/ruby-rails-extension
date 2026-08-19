import { describe, it, expect } from 'vitest'
import { decodeHtmlEntities, stripHtmlTags, normalizeWhitespace } from '../src/util/HtmlText'

describe('decodeHtmlEntities', () => {
  it('decodes known entities', () => {
    expect(decodeHtmlEntities('a &amp; b &lt;tag&gt; &quot;q&quot; &#39;s&#39;')).toBe('a & b <tag> "q" \'s\'')
  })

  it('does not cascade-decode a safely double-encoded entity into a live tag (CodeQL: double escaping/unescaping)', () => {
    // "&amp;lt;script&amp;gt;" is "<script>" that was entity-encoded TWICE over — one
    // correct decode pass should only undo one layer, leaving "&lt;script&gt;" as
    // literal, inert text, never resurrecting an actual "<script>" tag.
    const result = decodeHtmlEntities('&amp;lt;script&amp;gt;')
    expect(result).toBe('&lt;script&gt;')
    expect(result).not.toContain('<script>')
  })

  it('leaves an unknown entity-like sequence untouched', () => {
    expect(decodeHtmlEntities('&unknown;')).toBe('&unknown;')
  })
})

describe('stripHtmlTags', () => {
  it('strips a well-formed tag', () => {
    expect(stripHtmlTags('<p>hello</p>')).toBe(' hello ')
  })

  it('replaces a tag with a space by default so words do not glue together', () => {
    expect(stripHtmlTags('<p>a</p><p>b</p>')).toBe(' a  b ')
  })

  it('removes a tag with no replacement when asked, preserving inner whitespace', () => {
    expect(stripHtmlTags('<pre>line1\nline2</pre>', '')).toBe('line1\nline2')
  })

  it('fully removes a malformed/nested tag span that a single pass would leave live (CodeQL: incomplete sanitization)', () => {
    // A single `.replace(/<[^>]*>/g, ...)` pass over "<scr<script>ipt>" would consume up
    // to the *first* ">" (i.e. "<scr<script>"), leaving a dangling "ipt>" — not a live
    // tag in this particular case, but the general failure mode is a single pass leaving
    // some `<...>` span behind after a removal reshapes the string. Looping to a fixed
    // point guarantees nothing tag-shaped survives, however the input is nested.
    const result = stripHtmlTags('<scr<script>ipt>alert(1)</script>')
    expect(result).not.toMatch(/<script/i)
    // No complete "<...>" tag survives — a lone stray ">" left over from a consumed
    // opening tag (e.g. from "<scr<script>") is inert text, not a live tag.
    expect(result).not.toMatch(/<[^>]*>/)
  })

  it('terminates (does not loop forever) on input with no tags at all', () => {
    expect(stripHtmlTags('plain text, no tags')).toBe('plain text, no tags')
  })
})

describe('normalizeWhitespace', () => {
  it('collapses runs of whitespace and trims', () => {
    expect(normalizeWhitespace('  a   b\n\nc  ')).toBe('a b c')
  })
})
