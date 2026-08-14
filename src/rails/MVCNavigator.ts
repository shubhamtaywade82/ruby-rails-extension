/**
 * MVCNavigator - Calculates companion Rails files (Model, Controller, View, Spec, Service)
 */

import * as path from 'path'

export type RailsFileType =
  | 'model'
  | 'controller'
  | 'view'
  | 'helper'
  | 'spec'
  | 'service'
  | 'serializer'
  | 'policy'
  | 'migration'
  | 'unknown'

export interface ResourceInfo {
  type: RailsFileType
  singularName: string
  pluralName: string
  modulePrefix?: string
}

export class MVCNavigator {
  identifyFileType(filePath: string): RailsFileType {
    const normalized = filePath.replace(/\\/g, '/')
    if (normalized.includes('/app/models/')) {return 'model'}
    if (normalized.includes('/app/controllers/')) {return 'controller'}
    if (normalized.includes('/app/views/')) {return 'view'}
    if (normalized.includes('/app/helpers/')) {return 'helper'}
    if (normalized.includes('/app/services/')) {return 'service'}
    if (normalized.includes('/app/serializers/')) {return 'serializer'}
    if (normalized.includes('/app/policies/')) {return 'policy'}
    if (normalized.includes('/spec/') || normalized.includes('/test/')) {return 'spec'}
    if (normalized.includes('/db/migrate/')) {return 'migration'}
    return 'unknown'
  }

  extractResourceInfo(filePath: string): ResourceInfo | null {
    const type = this.identifyFileType(filePath)
    if (type === 'unknown') {return null}

    const baseName = path.basename(filePath, path.extname(filePath))
    let cleanName = baseName.replace(/(_controller|_spec|_test|_helper|_service|_serializer|_policy)$/, '')
    cleanName = cleanName.replace(/\.html$/, '')

    const singular = this.singularize(cleanName)
    const plural = this.pluralize(cleanName)

    return {
      type,
      singularName: singular,
      pluralName: plural,
    }
  }

  getCompanionPaths(filePath: string, workspaceRoot: string): Record<string, string> {
    const info = this.extractResourceInfo(filePath)
    if (!info) {return {}}

    const { singularName, pluralName } = info
    return {
      model: path.join(workspaceRoot, 'app', 'models', `${singularName}.rb`),
      controller: path.join(workspaceRoot, 'app', 'controllers', `${pluralName}_controller.rb`),
      viewDir: path.join(workspaceRoot, 'app', 'views', pluralName),
      spec: path.join(workspaceRoot, 'spec', 'models', `${singularName}_spec.rb`),
      requestSpec: path.join(workspaceRoot, 'spec', 'requests', `${pluralName}_spec.rb`),
      helper: path.join(workspaceRoot, 'app', 'helpers', `${pluralName}_helper.rb`),
      service: path.join(workspaceRoot, 'app', 'services', `${singularName}_service.rb`),
    }
  }

  private singularize(str: string): string {
    if (str.endsWith('ies')) {return str.slice(0, -3) + 'y'}
    if (str.endsWith('s') && !str.endsWith('ss')) {return str.slice(0, -1)}
    return str
  }

  private pluralize(str: string): string {
    if (str.endsWith('y') && !/[aeiou]y$/.test(str)) {
      return str.slice(0, -1) + 'ies'
    }
    return str.endsWith('s') ? str : `${str}s`
  }
}
