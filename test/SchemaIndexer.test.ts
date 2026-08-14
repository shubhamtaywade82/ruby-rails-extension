import { describe, it, expect } from 'vitest'
import { SchemaIndexer } from '../src/rails/SchemaIndexer'

describe('SchemaIndexer', () => {
  it('parses tables and columns from db/schema.rb content', () => {
    const schema = `
ActiveRecord::Schema[7.1].define(version: 2026_01_01_000000) do
  create_table "users", force: :cascade do |t|
    t.string "email", null: false
    t.string "first_name"
    t.string "last_name"
    t.integer "role", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "orders", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.decimal "total_amount", precision: 10, scale: 2
    t.string "status", default: "pending"
  end
end
`
    const indexer = new SchemaIndexer()
    indexer.parseSchema(schema)

    const usersTable = indexer.getTable('users')
    expect(usersTable).toBeDefined()
    expect(usersTable?.columns.size).toBe(6)

    const emailCol = usersTable?.columns.get('email')
    expect(emailCol).toBeDefined()
    expect(emailCol?.type).toBe('string')
    expect(emailCol?.nullable).toBe(false)

    const userCols = indexer.getModelColumns('User')
    expect(userCols.length).toBe(6)
  })
})
