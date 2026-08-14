/**
 * SchemaIndexer - In-memory index of Rails database schema (db/schema.rb)
 */

export interface SchemaColumn {
  name: string
  type: string
  nullable: boolean
  default?: string
  array?: boolean
}

export interface SchemaTable {
  name: string
  columns: Map<string, SchemaColumn>
  indexes: string[]
  foreignKeys: Array<{ toTable: string; column: string }>
}

export class SchemaIndexer {
  private tables: Map<string, SchemaTable> = new Map()

  parseSchema(content: string): void {
    this.tables.clear()
    const lines = content.split('\n')
    let currentTable: SchemaTable | null = null

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('create_table')) {
        currentTable = this.startTable(trimmed)
      } else if (trimmed.startsWith('t.') && currentTable) {
        this.parseColumnLine(trimmed, currentTable)
      } else if (trimmed === 'end' && currentTable) {
        this.tables.set(currentTable.name, currentTable)
        currentTable = null
      }
    }
  }

  private startTable(line: string): SchemaTable | null {
    const match = /create_table\s+["']([^"']+)["']/.exec(line)
    if (!match) {return null}
    return {
      name: match[1],
      columns: new Map(),
      indexes: [],
      foreignKeys: [],
    }
  }

  private parseColumnLine(line: string, table: SchemaTable): void {
    const match = /t\.(\w+)\s+["']([^"']+)["'](?:,\s*(.*))?/.exec(line)
    if (!match) {return}

    const [, type, name, options] = match
    const nullable = !(options && /null:\s*false/.test(options))
    const defaultMatch = options ? /default:\s*([^,\n]+)/.exec(options) : null

    table.columns.set(name, {
      name,
      type,
      nullable,
      default: defaultMatch ? defaultMatch[1].trim() : undefined,
    })
  }

  getTable(tableName: string): SchemaTable | undefined {
    return this.tables.get(tableName)
  }

  getModelColumns(modelName: string): SchemaColumn[] {
    const tableName = this.pluralize(this.underscore(modelName))
    const table = this.tables.get(tableName)
    return table ? Array.from(table.columns.values()) : []
  }

  getAllTables(): SchemaTable[] {
    return Array.from(this.tables.values())
  }

  private underscore(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
  }

  private pluralize(str: string): string {
    if (str.endsWith('y') && !/[aeiou]y$/.test(str)) {
      return str.slice(0, -1) + 'ies'
    }
    return str.endsWith('s') ? str : `${str}s`
  }
}
