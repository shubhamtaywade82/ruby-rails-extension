/**
 * GemNameParser - Pure cursor-position parsing for `gem "name"` declarations
 * in a Gemfile, so GemLensProvider can resolve exactly the gem name the
 * cursor is hovering over.
 */

const GEM_DECLARATION = /\bgem\s+["']([a-zA-Z0-9_.-]+)["']/g

/**
 * Given a line from a Gemfile and a 0-based character offset, returns the gem
 * name under the cursor if it's inside a `gem "name"` / `gem 'name'` call, or
 * null otherwise.
 */
export function extractGemNameAtPosition(line: string, char: number): string | null {
  GEM_DECLARATION.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = GEM_DECLARATION.exec(line)) !== null) {
    const name = match[1]
    const start = match.index + match[0].lastIndexOf(name)
    const end = start + name.length
    if (char >= start && char <= end) {
      return name
    }
  }
  return null
}
