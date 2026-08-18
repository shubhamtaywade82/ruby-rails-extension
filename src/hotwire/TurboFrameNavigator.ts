/**
 * TurboFrameNavigator - Indexes and resolves Turbo Frame tags across Rails templates
 */

export interface TurboFrameLocation {
  id: string
  filePath: string
  line: number
}

export class TurboFrameNavigator {
  private frameMap: Map<string, TurboFrameLocation[]> = new Map()

  /** Removes all indexed frames for a file so it can be safely re-indexed on save. */
  removeFile(filePath: string): void {
    for (const [id, locations] of this.frameMap) {
      const remaining = locations.filter(loc => loc.filePath !== filePath)
      if (remaining.length > 0) {
        this.frameMap.set(id, remaining)
      } else {
        this.frameMap.delete(id)
      }
    }
  }

  indexTemplateFrames(filePath: string, content: string): void {
    this.removeFile(filePath)
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNum = i + 1

      const rubyMatch = /turbo_frame_tag\s+["':]([a-zA-Z0-9_-]+)/.exec(line)
      if (rubyMatch) {
        this.addFrame(rubyMatch[1], filePath, lineNum)
      }

      const htmlMatch = /<turbo-frame\s+id=["']([a-zA-Z0-9_-]+)["']/.exec(line)
      if (htmlMatch) {
        this.addFrame(htmlMatch[1], filePath, lineNum)
      }
    }
  }

  private addFrame(id: string, filePath: string, line: number): void {
    const list = this.frameMap.get(id) ?? []
    list.push({ id, filePath, line })
    this.frameMap.set(id, list)
  }

  findFrameLocations(id: string): TurboFrameLocation[] {
    return this.frameMap.get(id) ?? []
  }

  getAllFrames(): string[] {
    return Array.from(this.frameMap.keys())
  }
}

/**
 * Given a line of markup/ERB and a 0-based character offset, returns the Turbo
 * Frame id under the cursor if it's inside a `turbo_frame_tag "id"` call or a
 * `<turbo-frame id="id">` tag, or null otherwise. Used by TurboFrameDefinitionProvider
 * to resolve exactly the id the cursor is sitting on.
 */
export function extractFrameIdAtPosition(line: string, char: number): string | null {
  const patterns = [
    /turbo_frame_tag\s+["':]([a-zA-Z0-9_-]+)/g,
    /<turbo-frame\s+id=["']([a-zA-Z0-9_-]+)["']/g,
  ]

  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(line)) !== null) {
      const id = match[1]
      const start = match.index + match[0].lastIndexOf(id)
      const end = start + id.length
      if (char >= start && char <= end) {
        return id
      }
    }
  }
  return null
}
