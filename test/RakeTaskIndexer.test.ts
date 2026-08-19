import { describe, it, expect } from 'vitest'
import { parseRakeTaskList } from '../src/rake/RakeTaskIndexer'

// Real `rake -T` output against a scratch Rakefile with a namespace, a top-level task,
// and a parameterized task — verified before writing the parser, not guessed.
const REAL_RAKE_T_OUTPUT = `rake about        # List versions of all Rails frameworks and the environment
rake db:migrate   # Migrate the database
rake db:rollback  # Rolls the schema back to the previous version
rake greet[name]  # A parameterized task
`

describe('parseRakeTaskList', () => {
  it('parses namespaced, top-level, and parameterized tasks', () => {
    const tasks = parseRakeTaskList(REAL_RAKE_T_OUTPUT)
    expect(tasks).toEqual([
      { name: 'about', namespace: null, description: 'List versions of all Rails frameworks and the environment' },
      { name: 'db:migrate', namespace: 'db', description: 'Migrate the database' },
      { name: 'db:rollback', namespace: 'db', description: 'Rolls the schema back to the previous version' },
      { name: 'greet[name]', namespace: null, description: 'A parameterized task' },
    ])
  })

  it('ignores non-task lines and blank lines', () => {
    const tasks = parseRakeTaskList('\nsome warning to stderr-like noise\nrake about  # desc\n\n')
    expect(tasks).toEqual([{ name: 'about', namespace: null, description: 'desc' }])
  })

  it('returns an empty list for empty output', () => {
    expect(parseRakeTaskList('')).toEqual([])
  })
})
