/**
 * ServiceExtractor - Extracts selected code into a convention-compliant Rails Service Object
 */

import * as path from 'path'
import * as fs from 'fs'

export interface ExtractedServiceResult {
  serviceFilePath: string
  serviceCode: string
  replacementCall: string
}

export class ServiceExtractor {
  extractService(
    serviceName: string,
    selectedCode: string,
    params: string[],
    workspaceRoot: string,
  ): ExtractedServiceResult {
    const className = this.camelize(serviceName)
    const fileName = `${this.underscore(serviceName)}_service.rb`
    const serviceDir = path.join(workspaceRoot, 'app', 'services')
    const serviceFilePath = path.join(serviceDir, fileName)

    const paramList = params.join(', ')
    const initParams = params.map(p => `@${p} = ${p}`).join('\n    ')
    const attrReaders = params.length > 0 ? `\n  attr_reader :${params.join(', :')}\n` : ''

    const serviceCode = `# frozen_string_literal: true

class ${className}Service < ApplicationService
  def self.call(${paramList})
    new(${paramList}).call
  end

  def initialize(${paramList})
    ${initParams}
  end
${attrReaders}
  def call
    ${selectedCode.trim().split('\n').join('\n    ')}
  end
end
`

    const replacementCall = `${className}Service.call(${paramList})`

    return {
      serviceFilePath,
      serviceCode,
      replacementCall,
    }
  }

  saveServiceFile(serviceFilePath: string, content: string): void {
    const dir = path.dirname(serviceFilePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(serviceFilePath, content, 'utf8')
  }

  private camelize(str: string): string {
    return str
      .replace(/_([a-z])/g, (_, g) => g.toUpperCase())
      .replace(/^[a-z]/, g => g.toUpperCase())
      .replace(/Service$/, '')
  }

  private underscore(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/_service$/, '')
  }
}
