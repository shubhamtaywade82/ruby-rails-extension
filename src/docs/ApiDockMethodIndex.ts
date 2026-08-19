/**
 * ApiDockMethodIndex - Maps a bare method name (the word a user hovers over)
 * to the apidock.com Class/method path that documents it, for the curated set
 * of Rails/ActiveRecord/ActiveSupport/Ruby-core/RSpec methods most likely to
 * carry a useful "gotcha" community note (deprecated behavior, skipped
 * callbacks/validations, surprising defaults, etc.).
 *
 * This is necessarily a curated guess, not a real type-resolved symbol table
 * (RailsForge has no full Ruby type inference) — apidock.com class paths are
 * best-effort and a lookup that 404s just yields no hover contribution
 * (ApiDockClient degrades to null). `railsForge.apidock.customMappings` lets
 * a project extend or override entries without a RailsForge release.
 *
 * No `vscode` import, so it can run inside the standalone MCP server process
 * (see src/mcp/server.ts's file header) as well as the extension host.
 */

import { ApiDockNamespace, ApiDockLookup } from './ApiDockClient'

export interface ApiDockMapping {
  keyword: string
  namespace: ApiDockNamespace
  className: string
  methodName: string
}

const DEFAULT_MAPPINGS: ApiDockMapping[] = [
  // ActiveRecord: persistence & lifecycle gotchas
  { keyword: 'has_secure_password', namespace: 'rails', className: 'ActiveModel/SecurePassword/ClassMethods', methodName: 'has_secure_password' },
  { keyword: 'update_attribute', namespace: 'rails', className: 'ActiveRecord/Base', methodName: 'update_attribute' },
  { keyword: 'update_attributes', namespace: 'rails', className: 'ActiveRecord/Base', methodName: 'update_attributes' },
  { keyword: 'update_column', namespace: 'rails', className: 'ActiveRecord/Persistence', methodName: 'update_column' },
  { keyword: 'update_columns', namespace: 'rails', className: 'ActiveRecord/Persistence', methodName: 'update_columns' },
  { keyword: 'save', namespace: 'rails', className: 'ActiveRecord/Base', methodName: 'save' },
  { keyword: 'destroy', namespace: 'rails', className: 'ActiveRecord/Base', methodName: 'destroy' },
  { keyword: 'touch', namespace: 'rails', className: 'ActiveRecord/Persistence', methodName: 'touch' },
  { keyword: 'validates', namespace: 'rails', className: 'ActiveModel/Validations/ClassMethods', methodName: 'validates' },
  { keyword: 'before_action', namespace: 'rails', className: 'AbstractController/Callbacks/ClassMethods', methodName: 'before_action' },
  { keyword: 'has_many', namespace: 'rails', className: 'ActiveRecord/Associations/ClassMethods', methodName: 'has_many' },
  { keyword: 'belongs_to', namespace: 'rails', className: 'ActiveRecord/Associations/ClassMethods', methodName: 'belongs_to' },
  { keyword: 'has_one', namespace: 'rails', className: 'ActiveRecord/Associations/ClassMethods', methodName: 'has_one' },
  { keyword: 'delegate', namespace: 'rails', className: 'Module', methodName: 'delegate' },
  { keyword: 'find_by', namespace: 'rails', className: 'ActiveRecord/FinderMethods', methodName: 'find_by' },
  { keyword: 'find_or_create_by', namespace: 'rails', className: 'ActiveRecord/Relation', methodName: 'find_or_create_by' },
  { keyword: 'where', namespace: 'rails', className: 'ActiveRecord/QueryMethods', methodName: 'where' },
  { keyword: 'pluck', namespace: 'rails', className: 'ActiveRecord/Calculations', methodName: 'pluck' },
  { keyword: 'includes', namespace: 'rails', className: 'ActiveRecord/QueryMethods', methodName: 'includes' },
  { keyword: 'joins', namespace: 'rails', className: 'ActiveRecord/QueryMethods', methodName: 'joins' },
  { keyword: 'respond_to', namespace: 'rails', className: 'ActionController/MimeResponds', methodName: 'respond_to' },
  { keyword: 'strong_parameters', namespace: 'rails', className: 'ActionController/StrongParameters', methodName: 'permit' },
  { keyword: 'permit', namespace: 'rails', className: 'ActionController/Parameters', methodName: 'permit' },
  { keyword: 'require', namespace: 'rails', className: 'ActionController/Parameters', methodName: 'require' },

  // Ruby core
  { keyword: 'attr_accessor', namespace: 'ruby', className: 'Module', methodName: 'attr_accessor' },
  { keyword: 'freeze', namespace: 'ruby', className: 'Object', methodName: 'freeze' },
  { keyword: 'dup', namespace: 'ruby', className: 'Object', methodName: 'dup' },
  { keyword: 'clone', namespace: 'ruby', className: 'Object', methodName: 'clone' },
  { keyword: 'tap', namespace: 'ruby', className: 'Object', methodName: 'tap' },
  { keyword: 'each_with_object', namespace: 'ruby', className: 'Enumerable', methodName: 'each_with_object' },
  { keyword: 'inject', namespace: 'ruby', className: 'Enumerable', methodName: 'inject' },
  { keyword: 'method_missing', namespace: 'ruby', className: 'BasicObject', methodName: 'method_missing' },

  // RSpec
  { keyword: 'let', namespace: 'rspec', className: 'RSpec/Core/MemoizedHelpers/ClassMethods', methodName: 'let' },
  { keyword: 'before', namespace: 'rspec', className: 'RSpec/Core/Hooks', methodName: 'before' },
  { keyword: 'expect', namespace: 'rspec', className: 'RSpec/Expectations/ExpectationTarget', methodName: 'expect' },
  { keyword: 'allow', namespace: 'rspec', className: 'RSpec/Mocks/ExampleMethods', methodName: 'allow' },
  { keyword: 'double', namespace: 'rspec', className: 'RSpec/Mocks/ExampleMethods', methodName: 'double' },
]

export class ApiDockMethodIndex {
  private mappings: Map<string, ApiDockMapping>

  constructor(customMappings: ApiDockMapping[] = []) {
    this.mappings = new Map(DEFAULT_MAPPINGS.map(m => [m.keyword, m]))
    // Applied after the defaults so a project's railsForge.apidock.customMappings
    // can both add new keywords and override a built-in one's class/method path.
    for (const mapping of customMappings) {
      this.mappings.set(mapping.keyword, mapping)
    }
  }

  lookup(keyword: string): ApiDockLookup | null {
    const mapping = this.mappings.get(keyword)
    if (!mapping) {return null}
    return { namespace: mapping.namespace, className: mapping.className, methodName: mapping.methodName }
  }
}
