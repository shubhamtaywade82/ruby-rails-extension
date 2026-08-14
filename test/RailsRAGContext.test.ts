import { describe, it, expect } from 'vitest'
import { RailsRAGContext } from '../src/agent/RailsRAGContext'
import { SchemaIndexer } from '../src/rails/SchemaIndexer'
import { RoutesIndexer } from '../src/rails/RoutesIndexer'

describe('RailsRAGContext', () => {
  const schema = new SchemaIndexer()
  schema.parseSchema(`
create_table "users", force: :cascade do |t|
  t.string "email"
  t.string "name"
end
`)

  const routes = new RoutesIndexer()
  routes.parseRoutesTable(`
users GET /users users#index
`)

  const rag = new RailsRAGContext(schema, routes)

  it('builds grounded prompt with matching ActiveRecord schema and routes', () => {
    const prompt = rag.buildGroundedPrompt('users email', 'user = User.find_by(email: params[:email])')

    expect(prompt).toContain('Grounded ActiveRecord Schema')
    expect(prompt).toContain('**users**: email:string, name:string')
    expect(prompt).toContain('`GET /users` => `users#index`')
    expect(prompt).toContain('user = User.find_by(email: params[:email])')
  })
})
