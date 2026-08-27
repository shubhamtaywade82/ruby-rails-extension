import { describe, it, expect } from 'vitest'
import { PatternCatalogTreeProvider, PatternItem } from '../src/views/PatternCatalogTreeProvider'

describe('PatternCatalogTreeProvider', () => {
  const provider = new PatternCatalogTreeProvider()

  it('should return root categories', async () => {
    const children = await provider.getChildren()
    expect(children.length).toBe(4)
    const labels = children.map(c => c.label)
    expect(labels).toContain('Rails Idiomatic Patterns')
    expect(labels).toContain('Behavioral Patterns')
    expect(labels).toContain('Structural Patterns')
    expect(labels).toContain('Creational Patterns')
  })

  it('should return rails patterns', async () => {
    const item = new PatternItem('Rails Idiomatic Patterns', 1)
    const children = await provider.getChildren(item)
    expect(children.length).toBe(5)
    expect(children[0].label).toBe('Service Object')
    expect(children.some(c => c.label === 'Query Object')).toBe(true)
  })

  it('should return behavioral patterns', async () => {
    const item = new PatternItem('Behavioral Patterns', 1)
    const children = await provider.getChildren(item)
    expect(children.length).toBe(3)
    expect(children[0].label).toBe('Strategy Pattern')
  })

  it('should return structural patterns', async () => {
    const item = new PatternItem('Structural Patterns', 1)
    const children = await provider.getChildren(item)
    expect(children.length).toBe(3)
    expect(children[0].label).toBe('Adapter Pattern')
  })

  it('should return creational patterns', async () => {
    const item = new PatternItem('Creational Patterns', 1)
    const children = await provider.getChildren(item)
    expect(children.length).toBe(3)
    expect(children[0].label).toBe('Factory Method')
  })

  it('should return empty for unknown category', async () => {
    const item = new PatternItem('Unknown', 1)
    const children = await provider.getChildren(item)
    expect(children).toEqual([])
  })

  it('getTreeItem should return the element itself', () => {
    const item = new PatternItem('test', 0)
    expect(provider.getTreeItem(item)).toBe(item)
  })
})
