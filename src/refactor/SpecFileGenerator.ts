/**
 * SpecFileGenerator - Phase 13: a companion RSpec/Minitest skeleton generated alongside
 * a newly extracted Service/Query Object, so "Extract Service Object" leaves you with
 * something to fill in rather than a class with zero test coverage.
 */

import * as path from 'path'

export type ExtractedKind = 'service' | 'query'

export function specFilePathFor(sourceFilePath: string, workspaceRoot: string, kind: ExtractedKind): string {
  const dir = kind === 'service' ? 'services' : 'queries'
  const baseName = path.basename(sourceFilePath)
  return path.join(workspaceRoot, 'spec', dir, baseName.replace(/\.rb$/, '_spec.rb'))
}

export function buildRspecSkeleton(className: string, kind: ExtractedKind, publicMethodName: string): string {
  const invocation = kind === 'service' ? 'described_class.call' : `described_class.new(...).${publicMethodName}`

  return `# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ${className} do
  describe '.${kind === 'service' ? 'call' : publicMethodName}' do
    it 'TODO: describe the expected behavior' do
      # result = ${invocation}
      pending 'RailsForge generated this spec — fill in the scenario.'
      raise 'not yet implemented'
    end
  end
end
`
}
