import { describe, it, expect } from 'vitest'
import { parseSteepGithubOutput } from '../src/types/SteepProvider'

// Real `steep check --format=github` output against a scratch project with a type
// mismatch — verified before writing the parser, not guessed at.
const REAL_STEEP_OUTPUT = `# Type checking files:

.F

::error file=lib/greeter.rb,line=7,endLine=7,col=18,endColumn=20::[Ruby::ArgumentTypeMismatch] Cannot pass a value of type \`::Integer\` as an argument of type \`::String\`%0A  ::Integer <: ::String%0A    ::Numeric <: ::String%0A      ::Object <: ::String%0A        ::BasicObject <: ::String
Detected 1 problem from 1 file
`

const REAL_STEEP_WARNING_OUTPUT = `# Type checking files:

.F

::warning file=lib/greeter.rb,line=6,endLine=6,col=6,endColumn=12::[Ruby::UndeclaredMethodDefinition] Method \`::Greeter#unused\` is not declared in RBS
Detected 1 problem from 1 file
`

describe('parseSteepGithubOutput', () => {
  it('parses an error diagnostic and strips the boxed type-relation trace', () => {
    const diagnostics = parseSteepGithubOutput(REAL_STEEP_OUTPUT)
    expect(diagnostics).toEqual([{
      severity: 'error',
      file: 'lib/greeter.rb',
      line: 7,
      endLine: 7,
      col: 18,
      endColumn: 20,
      message: '[Ruby::ArgumentTypeMismatch] Cannot pass a value of type `::Integer` as an argument of type `::String`',
    }])
  })

  it('parses a warning diagnostic', () => {
    const diagnostics = parseSteepGithubOutput(REAL_STEEP_WARNING_OUTPUT)
    expect(diagnostics[0].severity).toBe('warning')
    expect(diagnostics[0].message).toBe('[Ruby::UndeclaredMethodDefinition] Method `::Greeter#unused` is not declared in RBS')
  })

  it('ignores non-diagnostic lines', () => {
    expect(parseSteepGithubOutput('# Type checking files:\n\n.F\n\nDetected 1 problem from 1 file\n')).toEqual([])
  })

  it('returns an empty list for clean output', () => {
    expect(parseSteepGithubOutput('# Type checking files:\n\n.\n\nNo type error detected.\n')).toEqual([])
  })

  it('preserves a literal percent sign in a message unrelated to escaping', () => {
    const line = '::error file=a.rb,line=1,endLine=1,col=1,endColumn=2::50%25 chance of failure'
    expect(parseSteepGithubOutput(line)[0].message).toBe('50% chance of failure')
  })
})
