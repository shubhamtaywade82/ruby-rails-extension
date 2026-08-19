import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { describe, it, expect } from 'vitest'
import { parseProjectGuidelines, loadProjectGuidelines } from '../src/config/ProjectGuidelines'

const FULL_YAML = `
architecture:
  service_objects_dir: "app/services"
  service_objects_pattern: "inheritance"
  service_objects_base_class: "ApplicationService"
  service_objects_method_name: "call"
  presenters_dir: "app/presenters"
  policy_objects_dir: "app/policies"

preferred_libraries:
  serializer: "blueprinter"
  pagination: "pagy"

testing:
  framework: "rspec"
  test_dir: "spec/"
  use_factories: true
  factory_dir: "spec/factories"
`

describe('parseProjectGuidelines', () => {
  it('parses a full config matching the documented schema', () => {
    const guidelines = parseProjectGuidelines(FULL_YAML)
    expect(guidelines).toEqual({
      architecture: {
        serviceObjects: {
          dir: 'app/services',
          pattern: 'inheritance',
          baseClass: 'ApplicationService',
          methodName: 'call',
        },
        presentersDir: 'app/presenters',
        policyObjectsDir: 'app/policies',
      },
      preferredLibraries: {
        serializer: 'blueprinter',
        pagination: 'pagy',
      },
      testing: {
        framework: 'rspec',
        testDir: 'spec/',
        useFactories: true,
        factoryDir: 'spec/factories',
      },
    })
  })

  it('parses a partial config (only what a team bothered to override)', () => {
    const guidelines = parseProjectGuidelines('architecture:\n  service_objects_base_class: "Interactor"\n')
    expect(guidelines).toEqual({
      architecture: { serviceObjects: { baseClass: 'Interactor' } },
    })
  })

  it('returns an empty object for empty content', () => {
    expect(parseProjectGuidelines('')).toEqual({})
  })

  it('returns an empty object for invalid YAML rather than throwing', () => {
    expect(parseProjectGuidelines('architecture: [unterminated')).toEqual({})
  })

  it('returns an empty object when the document is a scalar/list, not a mapping', () => {
    expect(parseProjectGuidelines('- just\n- a\n- list\n')).toEqual({})
  })

  it('drops an invalid enum value instead of accepting it', () => {
    const guidelines = parseProjectGuidelines('architecture:\n  service_objects_pattern: "not_a_real_pattern"\n')
    expect(guidelines.architecture?.serviceObjects?.pattern).toBeUndefined()
  })

  it('drops a wrong-typed field instead of accepting it', () => {
    const guidelines = parseProjectGuidelines('testing:\n  use_factories: "yes"\n')
    expect(guidelines.testing?.useFactories).toBeUndefined()
  })

  it('trims whitespace-only strings to undefined', () => {
    const guidelines = parseProjectGuidelines('architecture:\n  presenters_dir: "   "\n')
    expect(guidelines.architecture).toBeUndefined()
  })
})

describe('loadProjectGuidelines', () => {
  it('returns null when .railsforge.yml does not exist', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'railsforge-guidelines-'))
    expect(loadProjectGuidelines(tmpDir)).toBeNull()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('reads and parses an existing .railsforge.yml', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'railsforge-guidelines-'))
    fs.writeFileSync(path.join(tmpDir, '.railsforge.yml'), FULL_YAML)
    const guidelines = loadProjectGuidelines(tmpDir)
    expect(guidelines?.architecture?.serviceObjects?.baseClass).toBe('ApplicationService')
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})
