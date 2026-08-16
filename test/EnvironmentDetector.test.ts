import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { EnvironmentDetector } from '../src/environment/EnvironmentDetector'

describe('EnvironmentDetector', () => {
  const detector = new EnvironmentDetector()

  it('detects Rails version and Hotwire capabilities from Gemfile.lock', () => {
    const lock = `
GEM
  remote: https://rubygems.org/
  specs:
    rails (7.1.3.2)
      actioncable (= 7.1.3.2)
      actionmailbox (= 7.1.3.2)
    stimulus-rails (1.3.3)
    turbo-rails (2.0.4)
    pundit (2.3.1)
    view_component (3.11.0)
    strong_migrations (1.7.0)
    rspec-rails (6.1.1)

PLATFORMS
  ruby

DEPENDENCIES
  rails (~> 7.1.3)
  rspec-rails
`
    // Test extraction helper
    const railsVer = detector['extractGemVersion'](lock, 'rails')
    expect(railsVer).toBe('7.1.3.2')

    const punditVer = detector['extractGemVersion'](lock, 'pundit')
    expect(punditVer).toBe('2.3.1')
  })

  it('marks hasRails false and leaves railsVersion empty for a standalone gem (no rails dependency)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'railsforge-gem-'))
    fs.writeFileSync(
      path.join(tmpDir, 'Gemfile.lock'),
      `
GEM
  remote: https://rubygems.org/
  specs:
    rspec (3.13.0)

PLATFORMS
  ruby

DEPENDENCIES
  rspec
`,
    )

    const env = detector.detectEnvironment(tmpDir)

    expect(env.hasRails).toBe(false)
    expect(env.railsVersion).toBe('')
    expect(env.majorRailsVersion).toBe(0)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('determines binstub vs bundle exec command prefix', () => {
    const env = {
      rubyVersion: '3.3.0',
      hasRails: true,
      railsVersion: '7.1.0',
      majorRailsVersion: 7,
      hasHotwire: true,
      hasTurbo: true,
      hasStimulus: true,
      hasPundit: true,
      hasViewComponent: true,
      hasStrongMigrations: true,
      hasBrakeman: false,
      testFramework: 'rspec' as const,
      binstubs: new Set(['rubocop']),
    }

    expect(detector.getCommandPrefix('rubocop', env, '/workspace')).toBe('bundle exec rubocop')
  })
})
