/**
 * ProjectGuidelines - Parses `.railsforge.yml`, a project-level config (like `.rubocop.yml`)
 * where a team documents *this repo's* actual architecture instead of RailsForge assuming
 * the Rails-generator defaults (`ApplicationService`/`call`, `app/services`, RSpec, etc.).
 * Every field is optional and independently validated — a malformed or partial file
 * degrades to "that field's default applies" rather than failing the whole file, since
 * this is hand-authored YAML a teammate might get slightly wrong.
 *
 * No `vscode` import, so both the extension host and the standalone MCP server
 * (`get_project_guidelines`) read the exact same parser.
 *
 * Expected shape (every key optional):
 * ```yaml
 * architecture:
 *   service_objects_dir: "app/services"
 *   service_objects_pattern: "inheritance" # or "module", "plain"
 *   service_objects_base_class: "ApplicationService"
 *   service_objects_method_name: "call"    # or "execute", "run"
 *   presenters_dir: "app/presenters"
 *   policy_objects_dir: "app/policies"
 * preferred_libraries:
 *   serializer: "blueprinter"
 *   pagination: "pagy"
 * testing:
 *   framework: "rspec"
 *   test_dir: "spec/"
 *   use_factories: true
 *   factory_dir: "spec/factories"
 * ```
 */

import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'

export type ServiceObjectPattern = 'inheritance' | 'module' | 'plain'

export interface ServiceObjectGuidelines {
  dir?: string
  pattern?: ServiceObjectPattern
  baseClass?: string
  methodName?: string
}

export interface ArchitectureGuidelines {
  serviceObjects?: ServiceObjectGuidelines
  presentersDir?: string
  policyObjectsDir?: string
}

export interface PreferredLibraries {
  serializer?: string
  pagination?: string
}

export interface TestingGuidelines {
  framework?: 'rspec' | 'minitest'
  testDir?: string
  useFactories?: boolean
  factoryDir?: string
}

export interface ProjectGuidelines {
  architecture?: ArchitectureGuidelines
  preferredLibraries?: PreferredLibraries
  testing?: TestingGuidelines
}

export const PROJECT_GUIDELINES_FILENAME = '.railsforge.yml'

export function loadProjectGuidelines(workspaceRoot: string): ProjectGuidelines | null {
  const configPath = path.join(workspaceRoot, PROJECT_GUIDELINES_FILENAME)
  if (!fs.existsSync(configPath)) {return null}
  try {
    return parseProjectGuidelines(fs.readFileSync(configPath, 'utf8'))
  } catch {
    return null
  }
}

export function parseProjectGuidelines(yamlContent: string): ProjectGuidelines {
  let raw: unknown
  try {
    raw = yaml.load(yamlContent)
  } catch {
    return {}
  }
  if (!isRecord(raw)) {return {}}

  const guidelines: ProjectGuidelines = {}

  const architecture = parseArchitecture(raw.architecture)
  if (architecture) {guidelines.architecture = architecture}

  const preferredLibraries = parsePreferredLibraries(raw.preferred_libraries)
  if (preferredLibraries) {guidelines.preferredLibraries = preferredLibraries}

  const testing = parseTesting(raw.testing)
  if (testing) {guidelines.testing = testing}

  return guidelines
}

function parseArchitecture(value: unknown): ArchitectureGuidelines | undefined {
  if (!isRecord(value)) {return undefined}

  const result: ArchitectureGuidelines = {}
  const serviceObjects: ServiceObjectGuidelines = {}
  const dir = str(value.service_objects_dir)
  if (dir) {serviceObjects.dir = dir}
  const pattern = value.service_objects_pattern
  if (pattern === 'inheritance' || pattern === 'module' || pattern === 'plain') {serviceObjects.pattern = pattern}
  const baseClass = str(value.service_objects_base_class)
  if (baseClass) {serviceObjects.baseClass = baseClass}
  const methodName = str(value.service_objects_method_name)
  if (methodName) {serviceObjects.methodName = methodName}
  if (Object.keys(serviceObjects).length > 0) {result.serviceObjects = serviceObjects}

  const presentersDir = str(value.presenters_dir)
  if (presentersDir) {result.presentersDir = presentersDir}
  const policyObjectsDir = str(value.policy_objects_dir)
  if (policyObjectsDir) {result.policyObjectsDir = policyObjectsDir}

  return Object.keys(result).length > 0 ? result : undefined
}

function parsePreferredLibraries(value: unknown): PreferredLibraries | undefined {
  if (!isRecord(value)) {return undefined}

  const result: PreferredLibraries = {}
  const serializer = str(value.serializer)
  if (serializer) {result.serializer = serializer}
  const pagination = str(value.pagination)
  if (pagination) {result.pagination = pagination}

  return Object.keys(result).length > 0 ? result : undefined
}

function parseTesting(value: unknown): TestingGuidelines | undefined {
  if (!isRecord(value)) {return undefined}

  const result: TestingGuidelines = {}
  const framework = value.framework
  if (framework === 'rspec' || framework === 'minitest') {result.framework = framework}
  const testDir = str(value.test_dir)
  if (testDir) {result.testDir = testDir}
  if (typeof value.use_factories === 'boolean') {result.useFactories = value.use_factories}
  const factoryDir = str(value.factory_dir)
  if (factoryDir) {result.factoryDir = factoryDir}

  return Object.keys(result).length > 0 ? result : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}
