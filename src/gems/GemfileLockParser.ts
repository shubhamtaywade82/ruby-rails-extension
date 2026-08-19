/**
 * GemfileLockParser - Pure parsing of a Gemfile.lock's locked gem versions.
 *
 * RubyDoc.info documentation is immutable per gem version, so "which exact
 * version does this project use" has to come from Gemfile.lock (never a
 * gemspec's version *constraint*, which can span a whole range). Handles the
 * GEM/GIT/PATH sections identically since Bundler indents locked specs the
 * same way in all three: exactly 4 spaces, vs. 6+ for a spec's own
 * dependencies — that indentation difference is what distinguishes a locked
 * gem line from a dependency line below it.
 */

const LOCKED_SPEC_LINE = /^ {4}(\S+) \(([^)]+)\)$/gm

/** Maps every locked gem name to its exact version, e.g. "pundit" -> "2.3.1". */
export function parseGemfileLock(content: string): Map<string, string> {
  const versions = new Map<string, string>()
  LOCKED_SPEC_LINE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = LOCKED_SPEC_LINE.exec(content)) !== null) {
    const [, name, version] = match
    versions.set(name, version)
  }
  return versions
}
