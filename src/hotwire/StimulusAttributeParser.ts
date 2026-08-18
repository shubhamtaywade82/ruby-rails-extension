/**
 * StimulusAttributeParser - Pure cursor-position parsing for Stimulus HTML attributes
 * (data-controller, data-action) so a DefinitionProvider can resolve exactly the
 * identifier/action the cursor is sitting on, even when an attribute lists several
 * space-separated values.
 */

export interface StimulusActionMatch {
  identifier: string
  action: string
}

/**
 * Given a line of markup and a 0-based character offset, returns the Stimulus
 * controller identifier under the cursor if it's inside a `data-controller="..."`
 * attribute value, honoring multiple space-separated identifiers.
 */
export function matchControllerIdentifierAtPosition(line: string, char: number): string | null {
  const attrRegex = /data-controller=["']([^"']*)["']/g
  let match: RegExpExecArray | null

  while ((match = attrRegex.exec(line)) !== null) {
    const value = match[1]
    const valueStart = match.index + match[0].indexOf(value)
    const valueEnd = valueStart + value.length
    if (char < valueStart || char > valueEnd) {continue}

    const offset = char - valueStart
    let cursor = 0
    for (const identifier of value.split(/\s+/).filter(Boolean)) {
      const start = value.indexOf(identifier, cursor)
      const end = start + identifier.length
      if (offset >= start && offset <= end) {
        return identifier
      }
      cursor = end
    }
    return value.split(/\s+/).filter(Boolean)[0] ?? null
  }
  return null
}

/**
 * Given a line of markup and a 0-based character offset, returns the
 * {identifier, action} pair under the cursor if it's inside a `data-action="..."`
 * attribute value (e.g. `click->foo#bar`), honoring multiple space-separated
 * action descriptors.
 */
export function matchActionAtPosition(line: string, char: number): StimulusActionMatch | null {
  const attrRegex = /data-action=["']([^"']*)["']/g
  let match: RegExpExecArray | null

  while ((match = attrRegex.exec(line)) !== null) {
    const value = match[1]
    const valueStart = match.index + match[0].indexOf(value)
    const valueEnd = valueStart + value.length
    if (char < valueStart || char > valueEnd) {continue}

    const offset = char - valueStart
    let cursor = 0
    for (const descriptor of value.split(/\s+/).filter(Boolean)) {
      const start = value.indexOf(descriptor, cursor)
      const end = start + descriptor.length
      if (offset >= start && offset <= end) {
        return parseActionDescriptor(descriptor)
      }
      cursor = end
    }
  }
  return null
}

function parseActionDescriptor(descriptor: string): StimulusActionMatch | null {
  // Formats: "identifier#action", "event->identifier#action", "event:opts->identifier#action"
  const match = /(?:^|->)([a-zA-Z0-9_-]+)#([a-zA-Z0-9_]+)$/.exec(descriptor)
  if (!match) {return null}
  return { identifier: match[1], action: match[2] }
}
