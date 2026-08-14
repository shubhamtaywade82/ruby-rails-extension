/**
 * ViewPartialResolver - Resolves Rails view partials and template paths
 */

import * as path from 'path'
import * as fs from 'fs'

export class ViewPartialResolver {
  private readonly extensions = ['.html.erb', '.erb', '.html.haml', '.haml', '.html.slim', '.slim']

  resolvePartialPath(
    renderPath: string,
    currentFilePath: string,
    workspaceRoot: string,
  ): string | null {
    const clean = renderPath.replace(/['":]/g, '').trim()
    if (!clean) {return null}

    let targetDir: string
    let partialName: string

    if (clean.includes('/')) {
      const parts = clean.split('/')
      partialName = `_${parts.pop()}`
      targetDir = path.join(workspaceRoot, 'app', 'views', ...parts)
    } else {
      const currentDir = path.dirname(currentFilePath)
      targetDir = currentDir.includes('/app/views')
        ? currentDir
        : path.join(workspaceRoot, 'app', 'views')
      partialName = `_${clean}`
    }

    for (const ext of this.extensions) {
      const fullPath = path.join(targetDir, `${partialName}${ext}`)
      if (fs.existsSync(fullPath)) {
        return fullPath
      }
    }

    // Fallback: Check non-partial
    const baseName = clean.includes('/') ? clean.split('/').pop()! : clean
    for (const ext of this.extensions) {
      const fullPath = path.join(targetDir, `${baseName}${ext}`)
      if (fs.existsSync(fullPath)) {
        return fullPath
      }
    }

    return null
  }
}
