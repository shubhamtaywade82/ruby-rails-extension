/**
 * ViewComponentResolver - Resolves ViewComponent classes and matching template files
 */

import * as path from 'path'
import * as fs from 'fs'

export interface ComponentFiles {
  classFile: string
  templateFile?: string
}

export class ViewComponentResolver {
  private readonly templateExtensions = ['.html.erb', '.erb', '.html.haml', '.html.slim']

  resolveComponent(componentName: string, workspaceRoot: string): ComponentFiles | null {
    const clean = componentName.replace(/Component$/, '').trim()
    const fileName = `${this.underscore(clean)}_component`
    const compDir = path.join(workspaceRoot, 'app', 'components')
    const classFile = path.join(compDir, `${fileName}.rb`)

    if (!fs.existsSync(classFile)) {
      return null
    }

    let templateFile: string | undefined
    for (const ext of this.templateExtensions) {
      const candidate = path.join(compDir, `${fileName}${ext}`)
      if (fs.existsSync(candidate)) {
        templateFile = candidate
        break
      }
    }

    return { classFile, templateFile }
  }

  private underscore(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
  }
}
