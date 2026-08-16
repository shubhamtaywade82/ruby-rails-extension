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

const RUBY_KEYWORDS = new Set([
  'def', 'end', 'if', 'elsif', 'else', 'unless', 'case', 'when', 'while', 'until',
  'begin', 'rescue', 'ensure', 'do', 'then', 'class', 'module', 'return', 'yield',
  'self', 'nil', 'true', 'false', 'and', 'or', 'not', 'in', 'next', 'break', 'redo',
  'retry', 'super', 'private', 'protected', 'public',
])

const KNOWN_RAILS_LOCALS = new Set(['params', 'current_user', 'current_account', 'request', 'session', 'cookies'])

export class ServiceExtractor {
  /**
   * Best-effort detection of local variables the selected code reads but doesn't itself
   * assign, so the extracted service's `call`/`initialize` signature doesn't silently
   * depend on the caller's locals. Heuristic (no full Ruby parse): a name counts as "used"
   * if it's a known Rails local (params, current_user, ...) or the receiver of a `.` call,
   * and it's excluded if the selection itself assigns it first.
   */
  detectFreeVariables(code: string): string[] {
    const assigned = new Set<string>()
    const assignRegex = /\b([a-z_][a-z0-9_]*)\s*=(?!=)/g
    let match: RegExpExecArray | null
    while ((match = assignRegex.exec(code)) !== null) {
      assigned.add(match[1])
    }

    const used = new Set<string>()
    const identifierRegex = /\b([a-z_][a-z0-9_]*)\b/g
    while ((match = identifierRegex.exec(code)) !== null) {
      const name = match[1]
      if (RUBY_KEYWORDS.has(name) || assigned.has(name)) {continue}

      const isReceiver = new RegExp(`\\b${name}\\.`).test(code)
      if (isReceiver || KNOWN_RAILS_LOCALS.has(name)) {
        used.add(name)
      }
    }

    return Array.from(used)
  }

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
