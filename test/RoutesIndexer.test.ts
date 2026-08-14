import { describe, it, expect } from 'vitest'
import { RoutesIndexer } from '../src/rails/RoutesIndexer'

describe('RoutesIndexer', () => {
  it('parses Rails routes table and resolves named helpers', () => {
    const routesOutput = `
                  Prefix Verb   URI Pattern                   Controller#Action
                    root GET    /                             home#index
                   users GET    /users(.:format)              users#index
                         POST   /users(.:format)              users#create
               edit_user GET    /users/:id/edit(.:format)     users#edit
                    user GET    /users/:id(.:format)          users#show
                         PATCH  /users/:id(.:format)          users#update
                         DELETE /users/:id(.:format)          users#destroy
`
    const indexer = new RoutesIndexer()
    indexer.parseRoutesTable(routesOutput)

    const allRoutes = indexer.getAllRoutes()
    expect(allRoutes.length).toBe(7)

    const usersHelper = indexer.findHelper('users_path')
    expect(usersHelper).toBeDefined()
    expect(usersHelper?.controller).toBe('users')
    expect(usersHelper?.action).toBe('index')

    const editHelper = indexer.findHelper('edit_user_url')
    expect(editHelper).toBeDefined()
    expect(editHelper?.action).toBe('edit')

    const searchResults = indexer.searchRoutes('users')
    expect(searchResults.length).toBe(6)
  })
})
