import { describe, it, expect } from 'vitest'
import { StrongMigrationsAnalyzer } from '../src/rails/StrongMigrationsAnalyzer'

describe('StrongMigrationsAnalyzer', () => {
  const analyzer = new StrongMigrationsAnalyzer()

  it('detects dangerous add_column with default', () => {
    const migration = `
class AddStatusToOrders < ActiveRecord::Migration[7.1]
  def change
    add_column :orders, :status, :string, default: "pending"
  end
end
`
    const dangers = analyzer.analyzeMigration(migration)
    expect(dangers.length).toBe(1)
    expect(dangers[0].ruleId).toBe('MIG-DEFAULT-001')
    expect(dangers[0].severity).toBe('warning')
  })

  it('detects un-concurrent index additions', () => {
    const migration = `
class AddIndexToUsersEmail < ActiveRecord::Migration[7.1]
  def change
    add_index :users, :email
  end
end
`
    const dangers = analyzer.analyzeMigration(migration)
    expect(dangers.length).toBe(1)
    expect(dangers[0].ruleId).toBe('MIG-INDEX-001')
    expect(dangers[0].severity).toBe('error')
  })

  it('passes safe concurrent index migrations', () => {
    const migration = `
class AddIndexToUsersEmail < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!

  def change
    add_index :users, :email, algorithm: :concurrently
  end
end
`
    const dangers = analyzer.analyzeMigration(migration)
    expect(dangers.length).toBe(0)
  })
})
