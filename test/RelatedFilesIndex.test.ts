import { describe, it, expect } from 'vitest'
import { ProjectPatternIndexer } from '../src/patterns/ProjectPatternIndexer'
import { RelatedFilesIndex } from '../src/graph/RelatedFilesIndex'

const files: Record<string, string> = {
  '/repo/app/services/create_order_service.rb': `
class CreateOrderService < ApplicationService
  def call
    Order.create!(user: @user)
  end
end
`,
  '/repo/app/policies/order_policy.rb': `
class OrderPolicy < ApplicationPolicy
  def show?
    true
  end
end
`,
  '/repo/app/queries/active_users_query.rb': `
class ActiveUsersQuery
  def call
    User.where(active: true)
  end
end
`,
}

function buildIndex(): { indexer: ProjectPatternIndexer; related: RelatedFilesIndex } {
  const indexer = new ProjectPatternIndexer()
  for (const [path, content] of Object.entries(files)) {
    indexer.indexFile(path, content)
  }
  const related = new RelatedFilesIndex(indexer, path => files[path])
  return { indexer, related }
}

describe('RelatedFilesIndex', () => {
  it('finds patterns related to a model by name match', () => {
    const { related } = buildIndex()
    const relations = related.getModelRelations('Order')

    expect(relations.patternsByType.policy?.map(p => p.name)).toEqual(['OrderPolicy'])
  })

  it('finds patterns related to a model by ActiveRecord usage in the body', () => {
    const { related } = buildIndex()
    const relations = related.getModelRelations('Order')

    expect(relations.patternsByType.service?.map(p => p.name)).toEqual(['CreateOrderService'])
  })

  it('does not relate unrelated patterns', () => {
    const { related } = buildIndex()
    const relations = related.getModelRelations('Order')

    expect(relations.patternsByType.query).toBeUndefined()
  })

  it('tracks spec counts by described class name', () => {
    const { related } = buildIndex()
    related.indexSpecFile('/repo/spec/services/create_order_service_spec.rb', 'RSpec.describe CreateOrderService do\nend\n')
    related.indexSpecFile('/repo/spec/services/create_order_service_spec2.rb', 'describe CreateOrderService do\nend\n')

    expect(related.getSpecCount('CreateOrderService')).toBe(2)

    related.removeSpecFile('/repo/spec/services/create_order_service_spec.rb')
    expect(related.getSpecCount('CreateOrderService')).toBe(1)
  })
})
