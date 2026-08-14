/**
 * ValueObjectExtractor - Generates immutable Value Objects using Ruby Data.define / Struct
 */

import * as fs from 'fs'
import * as path from 'path'

export interface ValueObjectResult {
  filePath: string
  code: string
}

export class ValueObjectExtractor {
  extractValueObject(
    valueName: string,
    attributes: string[],
    workspaceRoot: string,
  ): ValueObjectResult {
    const className = this.toPascalCase(valueName)
    const fileName = this.toSnakeCase(className) + '.rb'
    const valuesDir = path.join(workspaceRoot, 'app', 'values')

    if (!fs.existsSync(valuesDir)) {
      fs.mkdirSync(valuesDir, { recursive: true })
    }

    const targetPath = path.join(valuesDir, fileName)
    const code = this.generateValueObjectCode(className, attributes)
    fs.writeFileSync(targetPath, code, 'utf8')

    return { filePath: targetPath, code }
  }

  private generateValueObjectCode(className: string, attributes: string[]): string {
    const attrs = attributes.length > 0 ? attributes.map(a => `:${a}`).join(', ') : ':amount, :currency'

    return `# frozen_string_literal: true

# Immutable Value Object representing ${className}
class ${className} < Data.define(${attrs})
  def to_s
    "#{${attributes[0] ?? 'amount'}} #{${attributes[1] ?? 'currency'}}"
  end
end
`
  }

  private toPascalCase(str: string): string {
    return str
      .split(/[_-]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')
  }

  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .replace(/([a-z\d])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toLowerCase()
  }
}
