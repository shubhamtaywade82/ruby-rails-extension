/**
 * RBSIndex - Parses `.rbs` signature files (RBS: Ruby's type signature language) into a
 * lookup table of method signatures, verified against real output from `rbs prototype rb`
 * before writing this parser — e.g. `def greet: (untyped name, ?loud: bool) -> untyped`
 * and `def self.default: () -> untyped` for a class method.
 *
 * Line-based/regex parsing (same pragmatic choice as RoutesIndexer/SchemaIndexer
 * elsewhere in this codebase, not a full RBS grammar): tracks `class`/`module` nesting
 * via a simple stack and matches `def` lines directly. Deliberately doesn't attempt
 * multi-line method overloads (a signature continued onto further lines prefixed with
 * `|`) — those are rare hand-written RBS, and a skipped overload just means one fewer
 * hover result, not a parse failure.
 *
 * No `vscode` import, matching every other indexer in this codebase — usable from a
 * hover/definition provider today, and from the standalone MCP server if a
 * `get_rbs_signature` tool is added later.
 */

import * as fs from 'fs'
import * as path from 'path'

export interface RBSMethod {
  className: string
  methodName: string
  isSelf: boolean
  signature: string
  filePath: string
  line: number
}

const CLASS_OR_MODULE = /^(?:class|module)\s+([\w:]+)/
const END = /^end\b/
const DEF = /^def\s+(self\.)?([A-Za-z_]\w*[?!=]?)\s*:\s*(.+)$/

export function parseRbs(content: string, filePath: string): RBSMethod[] {
  const methods: RBSMethod[] = []
  const stack: string[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    const classMatch = CLASS_OR_MODULE.exec(line)
    if (classMatch) {
      stack.push(classMatch[1])
      continue
    }
    if (END.test(line)) {
      stack.pop()
      continue
    }

    const defMatch = DEF.exec(line)
    if (defMatch && stack.length > 0) {
      const [, selfPrefix, methodName, signature] = defMatch
      methods.push({
        className: stack[stack.length - 1],
        methodName,
        isSelf: Boolean(selfPrefix),
        signature: signature.trim(),
        filePath,
        line: i,
      })
    }
  }

  return methods
}

export class RBSIndex {
  private methods: RBSMethod[] = []
  private byMethodName = new Map<string, RBSMethod[]>()

  /** Walks `sigDir` (default "sig", RBS' conventional directory) for `**\/*.rbs` and indexes every method found. */
  loadFromWorkspace(workspaceRoot: string, sigDir = 'sig'): void {
    this.methods = []
    this.byMethodName.clear()

    const root = path.join(workspaceRoot, sigDir)
    if (!fs.existsSync(root)) {return}

    this.walk(root)
    for (const method of this.methods) {
      const list = this.byMethodName.get(method.methodName) ?? []
      list.push(method)
      this.byMethodName.set(method.methodName, list)
    }
  }

  private walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        this.walk(full)
      } else if (entry.name.endsWith('.rbs')) {
        try {
          this.methods.push(...parseRbs(fs.readFileSync(full, 'utf8'), full))
        } catch {
          // Skip an unreadable/unparseable file rather than failing the whole index.
        }
      }
    }
  }

  get isEmpty(): boolean {
    return this.methods.length === 0
  }

  /** Signature(s) for a bare method name — a project can define the same method name on several classes, so this returns every match. */
  lookup(methodName: string): RBSMethod[] {
    return this.byMethodName.get(methodName) ?? []
  }

  /** The single best match for `className#methodName` (or `.methodName` for a self method), preferring an exact class match over any other same-named method. */
  lookupExact(className: string, methodName: string, isSelf: boolean): RBSMethod | null {
    const candidates = this.byMethodName.get(methodName) ?? []
    return candidates.find(m => m.className === className && m.isSelf === isSelf) ?? null
  }
}
