/**
 * QueryExtractor - Extracts complex ActiveRecord queries into Rails Query Objects
 */

import * as path from 'path'
import * as fs from 'fs'

export interface ExtractedQueryResult {
  queryFilePath: string
  queryCode: string
  replacementCall: string
}

export class QueryExtractor {
  extractQuery(
    queryName: string,
    baseModel: string,
    selectedQuery: string,
    params: string[],
    workspaceRoot: string,
  ): ExtractedQueryResult {
    const className = this.camelize(queryName)
    const fileName = `${this.underscore(queryName)}_query.rb`
    const queryDir = path.join(workspaceRoot, 'app', 'queries')
    const queryFilePath = path.join(queryDir, fileName)

    const paramList = ['relation = ' + baseModel + '.all', ...params].join(', ')
    const initParams = ['@relation = relation', ...params.map(p => `@${p} = ${p}`)].join('\n    ')
    const attrReaders = `\n  attr_reader :relation${params.length > 0 ? ', :' + params.join(', :') : ''}\n`

    const queryCode = `# frozen_string_literal: true

class ${className}Query
  def self.call(${paramList})
    new(${paramList}).call
  end

  def initialize(${paramList})
    ${initParams}
  end
${attrReaders}
  def call
    relation.${selectedQuery.trim()}
  end
end
`

    const replacementCall = `${className}Query.call`

    return {
      queryFilePath,
      queryCode,
      replacementCall,
    }
  }

  saveQueryFile(queryFilePath: string, content: string): void {
    const dir = path.dirname(queryFilePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(queryFilePath, content, 'utf8')
  }

  private camelize(str: string): string {
    return str
      .replace(/_([a-z])/g, (_, g) => g.toUpperCase())
      .replace(/^[a-z]/, g => g.toUpperCase())
      .replace(/Query$/, '')
  }

  private underscore(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/_query$/, '')
  }
}
