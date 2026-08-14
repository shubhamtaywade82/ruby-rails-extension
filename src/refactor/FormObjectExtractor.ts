/**
 * FormObjectExtractor - Generates ActiveModel Form Objects to decouple complex controller logic
 */

import * as fs from 'fs'
import * as path from 'path'

export interface FormObjectResult {
  filePath: string
  code: string
}

export class FormObjectExtractor {
  extractFormObject(
    formName: string,
    attributes: string[],
    workspaceRoot: string,
  ): FormObjectResult {
    const className = this.toPascalCase(formName.replace(/(_form|Form)$/, '')) + 'Form'
    const fileName = this.toSnakeCase(className) + '.rb'
    const formsDir = path.join(workspaceRoot, 'app', 'forms')

    if (!fs.existsSync(formsDir)) {
      fs.mkdirSync(formsDir, { recursive: true })
    }

    const targetPath = path.join(formsDir, fileName)
    const code = this.generateFormCode(className, attributes)
    fs.writeFileSync(targetPath, code, 'utf8')

    return { filePath: targetPath, code }
  }

  private generateFormCode(className: string, attributes: string[]): string {
    const attrLines = attributes.length > 0
      ? attributes.map(a => `  attribute :${a}, :string`).join('\n')
      : '  # attribute :first_name, :string\n  # attribute :email, :string'

    return `# frozen_string_literal: true

class ${className}
  include ActiveModel::Model
  include ActiveModel::Attributes

${attrLines}

  validates :email, presence: true if defined?(email)

  def save
    return false unless valid?

    ActiveRecord::Base.transaction do
      # Persistence logic across models
    end
    true
  rescue ActiveRecord::RecordInvalid => e
    errors.add(:base, e.message)
    false
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
