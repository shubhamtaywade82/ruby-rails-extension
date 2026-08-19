/**
 * HtmlText - Shared, safe HTML-to-plain-text primitives for the doc-scraping clients
 * (ApiDockClient, DevDocsOfflineIndex, RubyDocProvider): third-party HTML gets reduced to
 * plain text before ever reaching a `vscode.MarkdownString` or an MCP tool's JSON
 * response. Extracted after CodeQL flagged the same two issues in three separate
 * hand-rolled copies of this logic:
 *
 * - Entity decoding must be one single-pass regex + lookup, not several sequential
 *   `.replace()` calls chained together. Chaining them (`&amp;` → `&`, then the *result*
 *   re-scanned for `&lt;` → `<`) lets an already-safely-double-encoded string like
 *   `&amp;lt;script&amp;gt;` cascade through two decode steps into a live `<script>` tag.
 *   A single linear pass only ever expands each entity once.
 * - Tag stripping must repeat until a fixed point, not stop after one `.replace()` pass —
 *   a single pass can't guarantee a malformed/nested span doesn't leave a live tag behind
 *   (CodeQL's "incomplete multi-character sanitization"); looping until nothing changes
 *   closes that gap.
 */

const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&#39;': '\'',
  '&quot;': '"',
  '&mdash;': '—',
  '&ndash;': '–',
  '&copy;': '©',
  '&#x21d2;': '⇒',
}

const ENTITY_PATTERN = /&(?:nbsp|amp|lt|gt|#39|quot|mdash|ndash|copy|#x21d2);/g

export function decodeHtmlEntities(text: string): string {
  return text.replace(ENTITY_PATTERN, match => HTML_ENTITIES[match] ?? match)
}

/**
 * Strips `<...>` tags, looping until none remain. `replacement` defaults to a space so
 * adjacent block-level tags (`<p>a</p><p>b</p>`) don't glue words together; pass `''` to
 * preserve exact original spacing/newlines instead (e.g. for `<pre>` source code, where
 * collapsing whitespace would corrupt it).
 */
export function stripHtmlTags(fragment: string, replacement = ' '): string {
  let text = fragment
  let previous: string
  do {
    previous = text
    text = text.replace(/<[^>]*>/g, replacement)
  } while (text !== previous)
  return text
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}
