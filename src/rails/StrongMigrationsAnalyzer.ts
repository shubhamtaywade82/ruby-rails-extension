/**
 * StrongMigrationsAnalyzer - Detects dangerous ActiveRecord migration operations
 * Based on strong_migrations best practices for zero-downtime deploys.
 */

export interface MigrationDanger {
  ruleId: string
  title: string
  line: number
  description: string
  recommendation: string
  severity: 'error' | 'warning'
}

export class StrongMigrationsAnalyzer {
  analyzeMigration(code: string): MigrationDanger[] {
    const dangers: MigrationDanger[] = []
    const lines = code.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNum = i + 1

      this.checkAddColumnDefault(line, lineNum, dangers)
      this.checkAddIndexConcurrently(line, lineNum, dangers)
      this.checkRemoveColumn(line, lineNum, dangers)
      this.checkChangeColumn(line, lineNum, dangers)
      this.checkRenameColumnOrTable(line, lineNum, dangers)
    }

    return dangers
  }

  private checkAddColumnDefault(line: string, lineNum: number, list: MigrationDanger[]): void {
    if (/\badd_column\b/.test(line) && /default:\s*[^,\n]+/.test(line) && !/null:\s*false/.test(line)) {
      list.push({
        ruleId: 'MIG-DEFAULT-001',
        title: 'Adding column with default may lock large tables',
        line: lineNum,
        description: 'Adding a column with a default value writes to every row, holding an exclusive table lock.',
        recommendation: 'Add the column without a default first, then backfill in batches, then set the default.',
        severity: 'warning',
      })
    }
  }

  private checkAddIndexConcurrently(line: string, lineNum: number, list: MigrationDanger[]): void {
    if (/\badd_index\b/.test(line) && !/algorithm:\s*:concurrently/.test(line)) {
      list.push({
        ruleId: 'MIG-INDEX-001',
        title: 'Adding index without algorithm: :concurrently',
        line: lineNum,
        description: 'Standard add_index blocks all writes to the table until indexing finishes.',
        recommendation: 'Use disable_ddl_transaction! and add algorithm: :concurrently.',
        severity: 'error',
      })
    }
  }

  private checkRemoveColumn(line: string, lineNum: number, list: MigrationDanger[]): void {
    if (/\bremove_column\b/.test(line)) {
      list.push({
        ruleId: 'MIG-REMOVE-001',
        title: 'Removing column without prior ignore',
        line: lineNum,
        description: 'ActiveRecord caches column names. Removing a column while old code is running causes 500 errors.',
        recommendation: 'First add self.ignored_columns += ["col"] to the model in a prior deploy, then remove the column.',
        severity: 'warning',
      })
    }
  }

  private checkChangeColumn(line: string, lineNum: number, list: MigrationDanger[]): void {
    if (/\bchange_column\b/.test(line)) {
      list.push({
        ruleId: 'MIG-CHANGE-001',
        title: 'Changing column type locks table',
        line: lineNum,
        description: 'change_column requires a full table rewrite in Postgres/MySQL.',
        recommendation: 'Create a new column with the desired type, backfill data, and switch references.',
        severity: 'error',
      })
    }
  }

  private checkRenameColumnOrTable(line: string, lineNum: number, list: MigrationDanger[]): void {
    if (/\brename_column\b|\brename_table\b/.test(line)) {
      list.push({
        ruleId: 'MIG-RENAME-001',
        title: 'Renaming column/table breaks zero-downtime deployments',
        line: lineNum,
        description: 'Renaming immediately breaks any active application servers running previous code.',
        recommendation: 'Add new column, sync writes, backfill, switch reads, then drop old column.',
        severity: 'warning',
      })
    }
  }
}
