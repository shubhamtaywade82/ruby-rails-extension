/**
 * PersistentDependencyGraph - Phase 11: cycle detection + richer edges (constructor
 * injection vs hard-coded, `include`/`prepend`/`extend`) over the AST-backed
 * `dependencies` table, instead of MinimalDependencyGraph's line-regex approach.
 * Kept as a separate class rather than replacing MinimalDependencyGraph, which stays
 * in place (and in use) as the zero-dependency fallback when the persistent index
 * isn't available for some reason.
 */

import { SqliteDatabase } from './database'

export interface PersistentDependencyEdge {
  from: string
  to: string
  kind: 'call' | 'include'
  line: number
  hardCoded: boolean
  filePath: string
}

export class PersistentDependencyGraph {
  constructor(private db: SqliteDatabase) {}

  getCollaborators(name: string): PersistentDependencyEdge[] {
    return this.queryEdges('from_name', name)
  }

  getCallers(name: string): PersistentDependencyEdge[] {
    return this.queryEdges('to_name', name)
  }

  getHardCodedCollaborators(name: string): PersistentDependencyEdge[] {
    return this.getCollaborators(name).filter(e => e.hardCoded)
  }

  private queryEdges(column: 'from_name' | 'to_name', value: string): PersistentDependencyEdge[] {
    const rows = this.db
      .prepare(`SELECT from_name, to_name, kind, line, hard_coded, file_path FROM dependencies WHERE ${column} = ?`)
      .all(value) as Array<{ from_name: string; to_name: string; kind: string; line: number; hard_coded: number; file_path: string }>

    return rows.map(r => ({
      from: r.from_name,
      to: r.to_name,
      kind: r.kind as 'call' | 'include',
      line: r.line,
      hardCoded: r.hard_coded === 1,
      filePath: r.file_path,
    }))
  }

  /**
   * Detects circular dependencies (A depends on B depends on ... depends on A) via DFS
   * over the full `from -> to` edge set. Only symbols known to the index (i.e. that
   * appear as a `from_name` somewhere) are used as cycle-search roots.
   */
  findCycles(): string[][] {
    const rows = this.db.prepare('SELECT DISTINCT from_name, to_name FROM dependencies').all() as Array<{ from_name: string; to_name: string }>
    const adjacency = new Map<string, Set<string>>()
    for (const row of rows) {
      const set = adjacency.get(row.from_name) ?? new Set<string>()
      set.add(row.to_name)
      adjacency.set(row.from_name, set)
    }

    const visited = new Set<string>()
    const stack: string[] = []
    const onStack = new Set<string>()
    const cycles: string[][] = []

    const dfs = (node: string): void => {
      visited.add(node)
      stack.push(node)
      onStack.add(node)

      for (const neighbor of adjacency.get(node) ?? []) {
        if (!visited.has(neighbor)) {
          dfs(neighbor)
        } else if (onStack.has(neighbor)) {
          const start = stack.indexOf(neighbor)
          if (start !== -1) {cycles.push([...stack.slice(start), neighbor])}
        }
      }

      stack.pop()
      onStack.delete(node)
    }

    for (const node of adjacency.keys()) {
      if (!visited.has(node)) {dfs(node)}
    }

    return dedupeCycles(cycles)
  }
}

function dedupeCycles(cycles: string[][]): string[][] {
  const seen = new Set<string>()
  const result: string[][] = []

  for (const cycle of cycles) {
    const withoutClosingNode = cycle.slice(0, -1)
    const minIndex = withoutClosingNode.indexOf([...withoutClosingNode].sort()[0])
    const rotated = [...withoutClosingNode.slice(minIndex), ...withoutClosingNode.slice(0, minIndex)]
    const key = rotated.join('->')
    if (seen.has(key)) {continue}
    seen.add(key)
    result.push([...rotated, rotated[0]])
  }

  return result
}
