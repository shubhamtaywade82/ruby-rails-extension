/**
 * EnvironmentDetector - Deterministic discovery of Ruby, Rails, and Gemfile ecosystem
 */

import * as fs from 'fs'
import * as path from 'path'

/**
 * Broad shape of the project, used to adapt which features are relevant:
 * - `monolith`: a full Rails app (views, helpers, asset pipeline)
 * - `api_only`: a Rails app with `config.api_only = true` (or an
 *   `ApplicationController < ActionController::API`) — no views/helpers
 * - `gem`: a non-Rails Ruby project with a `.gemspec`
 * - `script`: any other non-Rails Ruby codebase
 */
export type ProjectType = 'monolith' | 'api_only' | 'gem' | 'script'

export function formatProjectType(type: ProjectType): string {
  switch (type) {
    case 'monolith': return 'Monolith (full MVC)'
    case 'api_only': return 'API-only'
    case 'gem': return 'Gem'
    case 'script': return 'Script'
  }
}

export interface ProjectEnvironment {
  rubyVersion: string
  /** True only when `rails` is an actual Gemfile.lock dependency — a plain gem/script isn't a Rails app. */
  hasRails: boolean
  railsVersion: string
  majorRailsVersion: number
  projectType: ProjectType
  hasHotwire: boolean
  hasTurbo: boolean
  hasStimulus: boolean
  hasPundit: boolean
  hasViewComponent: boolean
  hasStrongMigrations: boolean
  hasBrakeman: boolean
  hasPry: boolean
  testFramework: 'rspec' | 'minitest'
  binstubs: Set<string>
}

export class EnvironmentDetector {
  detectEnvironment(workspaceRoot: string): ProjectEnvironment {
    const rubyVersion = this.detectRubyVersion(workspaceRoot)
    const gemfileLockContent = this.readGemfileLock(workspaceRoot)
    const detectedRailsVersion = this.extractGemVersion(gemfileLockContent, 'rails')
    const hasRails = detectedRailsVersion !== null
    const railsVersion = detectedRailsVersion ?? ''
    const majorRails = hasRails ? parseInt(railsVersion.split('.')[0], 10) || 7 : 0

    const hasTurbo = gemfileLockContent.includes('turbo-rails')
    const hasStimulus = gemfileLockContent.includes('stimulus-rails')
    const hasHotwire = hasTurbo || hasStimulus || majorRails >= 7
    const hasPundit = gemfileLockContent.includes('pundit')
    const hasViewComponent = gemfileLockContent.includes('view_component')
    const hasStrongMigrations = gemfileLockContent.includes('strong_migrations')
    const hasBrakeman = gemfileLockContent.includes('brakeman')
    const hasPry = gemfileLockContent.includes('pry')
    const testFramework = gemfileLockContent.includes('rspec-rails') ? 'rspec' : 'minitest'
    const binstubs = this.detectBinstubs(workspaceRoot)
    const projectType = this.detectProjectType(workspaceRoot, hasRails)

    return {
      rubyVersion,
      hasRails,
      railsVersion,
      majorRailsVersion: majorRails,
      projectType,
      hasHotwire,
      hasTurbo,
      hasStimulus,
      hasPundit,
      hasViewComponent,
      hasStrongMigrations,
      hasBrakeman,
      hasPry,
      testFramework,
      binstubs,
    }
  }

  getCommandPrefix(binName: string, env: ProjectEnvironment, workspaceRoot: string): string {
    if (env.binstubs.has(binName)) {
      const binstubPath = path.join(workspaceRoot, 'bin', binName)
      if (fs.existsSync(binstubPath)) {
        return `bin/${binName}`
      }
    }
    return `bundle exec ${binName}`
  }

  private detectRubyVersion(root: string): string {
    const dotRubyVersion = path.join(root, '.ruby-version')
    if (fs.existsSync(dotRubyVersion)) {
      const val = fs.readFileSync(dotRubyVersion, 'utf8').trim()
      if (val) {return val.replace(/^ruby-/, '')}
    }

    const toolVersions = path.join(root, '.tool-versions')
    if (fs.existsSync(toolVersions)) {
      const lines = fs.readFileSync(toolVersions, 'utf8').split('\n')
      for (const line of lines) {
        if (line.startsWith('ruby ')) {
          return line.replace('ruby ', '').trim()
        }
      }
    }

    const dotRbenv = path.join(root, '.rbenv-version')
    if (fs.existsSync(dotRbenv)) {
      return fs.readFileSync(dotRbenv, 'utf8').trim()
    }

    return '3.3.0'
  }

  private readGemfileLock(root: string): string {
    const lockPath = path.join(root, 'Gemfile.lock')
    if (fs.existsSync(lockPath)) {
      return fs.readFileSync(lockPath, 'utf8')
    }
    return ''
  }

  private extractGemVersion(gemfileLock: string, gemName: string): string | null {
    const regex = new RegExp(`^\\s+${gemName}\\s+\\(([0-9.]+)\\)`, 'm')
    const match = regex.exec(gemfileLock)
    return match ? match[1] : null
  }

  private detectProjectType(root: string, hasRails: boolean): ProjectType {
    if (hasRails) {
      return this.isApiOnly(root) ? 'api_only' : 'monolith'
    }
    return this.hasGemspec(root) ? 'gem' : 'script'
  }

  private isApiOnly(root: string): boolean {
    const applicationConfigPath = path.join(root, 'config', 'application.rb')
    if (fs.existsSync(applicationConfigPath)) {
      const content = fs.readFileSync(applicationConfigPath, 'utf8')
      if (/config\.api_only\s*=\s*true/.test(content)) {return true}
    }

    const applicationControllerPath = path.join(root, 'app', 'controllers', 'application_controller.rb')
    if (fs.existsSync(applicationControllerPath)) {
      const content = fs.readFileSync(applicationControllerPath, 'utf8')
      if (/class\s+ApplicationController\s*<\s*ActionController::API/.test(content)) {return true}
    }

    return false
  }

  private hasGemspec(root: string): boolean {
    if (!fs.existsSync(root)) {return false}
    return fs.readdirSync(root).some(f => f.endsWith('.gemspec'))
  }

  private detectBinstubs(root: string): Set<string> {
    const set = new Set<string>()
    const binDir = path.join(root, 'bin')
    if (fs.existsSync(binDir)) {
      const files = fs.readdirSync(binDir)
      for (const f of files) {
        set.add(f)
      }
    }
    return set
  }
}
