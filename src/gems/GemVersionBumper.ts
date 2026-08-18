/**
 * GemVersionBumper - Pure logic for reading/bumping the VERSION constant in a
 * standard Bundler-generated gem's version.rb file (lib/{gem_name}/version.rb),
 * backing the "RailsForge: Bump Gem Version" command (gem-type projects only).
 */

export type VersionBumpPart = 'major' | 'minor' | 'patch'

const VERSION_ASSIGNMENT = /VERSION\s*=\s*["']([^"']+)["']/

export function parseVersion(content: string): string | null {
  return VERSION_ASSIGNMENT.exec(content)?.[1] ?? null
}

/**
 * Numeric semver-style bump only (no pre-release/build metadata handling — a gem's
 * version.rb is almost always a plain `MAJOR.MINOR.PATCH`, and anything fancier is
 * safer left to the maintainer to edit by hand).
 */
export function bumpVersion(version: string, part: VersionBumpPart): string {
  const parts = version.split('.').map(n => parseInt(n, 10))
  while (parts.length < 3) {parts.push(0)}
  const [major, minor, patch] = parts

  if (part === 'major') {return `${major + 1}.0.0`}
  if (part === 'minor') {return `${major}.${minor + 1}.0`}
  return `${major}.${minor}.${patch + 1}`
}

export function replaceVersionInContent(content: string, newVersion: string): string {
  return content.replace(VERSION_ASSIGNMENT, match => match.replace(/["']([^"']+)["']/, `"${newVersion}"`))
}
