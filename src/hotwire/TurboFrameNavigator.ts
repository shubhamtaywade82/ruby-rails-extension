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

  indexTemplateFrames(filePath: string, content: string): void {
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
