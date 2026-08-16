import { describe, it, expect } from 'vitest'
import { ProjectPatternIndexer } from '../src/patterns/ProjectPatternIndexer'
import { MinimalDependencyGraph } from '../src/graph/MinimalDependencyGraph'

const files: Record<string, string> = {
  '/repo/app/services/create_order_service.rb': `
class CreateOrderService < ApplicationService
  def call
    order = Order.create!
    PaymentGatewayService.call(order: order)
    order
  end
end
`,
  '/repo/app/services/payment_gateway_service.rb': `
class PaymentGatewayService < ApplicationService
  def call
    true
  end
end
`,
  '/repo/app/services/injected_service.rb': `
class InjectedService < ApplicationService
  def initialize(payment_gateway: PaymentGatewayService)
    @payment_gateway = payment_gateway
  end

  def call
    @payment_gateway.call
  end
end
`,
}

function buildGraph(): MinimalDependencyGraph {
  const indexer = new ProjectPatternIndexer()
  for (const [path, content] of Object.entries(files)) {
    indexer.indexFile(path, content)
  }
  const graph = new MinimalDependencyGraph(indexer, path => files[path])
  graph.rebuild()
  return graph
}

describe('MinimalDependencyGraph', () => {
  it('flags a direct ClassName.call(...) reference as a hard-coded collaborator', () => {
    const graph = buildGraph()
    const hardCoded = graph.getHardCodedCollaborators('CreateOrderService')

    expect(hardCoded).toHaveLength(1)
    expect(hardCoded[0].to).toBe('PaymentGatewayService')
  })

  it('does not flag a collaborator that is already constructor-injected', () => {
    const graph = buildGraph()
    const hardCoded = graph.getHardCodedCollaborators('InjectedService')

    expect(hardCoded).toHaveLength(0)
  })

  it('tracks callers of a given pattern', () => {
    const graph = buildGraph()
    const callers = graph.getCallers('PaymentGatewayService')

    expect(callers.map(c => c.from)).toContain('CreateOrderService')
  })
})
