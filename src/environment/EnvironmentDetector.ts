/**
 * EnvironmentDetector - Deterministic discovery of Ruby, Rails, and Gemfile ecosystem
 */

import * as fs from 'fs'
import * as path from 'path'

export interface ProjectEnvironment {
  rubyVersion: string
  /** True only when `rails` is an actual Gemfile.lock dependency — a plain gem/script isn't a Rails app. */
  hasRails: boolean
  railsVersion: string
  majorRailsVersion: number
  hasHotwire: boolean
  hasTurbo: boolean
  hasStimulus: boolean
  hasPundit: boolean
  hasViewComponent: boolean
  hasStrongMigrations: boolean
  hasBrakeman: boolean
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
    const testFramework = gemfileLockContent.includes('rspec-rails') ? 'rspec' : 'minitest'
    const binstubs = this.detectBinstubs(workspaceRoot)

    return {
      rubyVersion,
      hasRails,
      railsVersion,
      majorRailsVersion: majorRails,
      hasHotwire,
      hasTurbo,
      hasStimulus,
      hasPundit,
      hasViewComponent,
      hasStrongMigrations,
      hasBrakeman,
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
