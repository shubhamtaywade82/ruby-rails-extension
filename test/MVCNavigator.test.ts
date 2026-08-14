import { describe, it, expect } from 'vitest'
import { MVCNavigator } from '../src/rails/MVCNavigator'

describe('MVCNavigator', () => {
  const mvc = new MVCNavigator()
  const root = '/path/to/my_app'

  it('identifies file types from path', () => {
    expect(mvc.identifyFileType('/path/to/my_app/app/models/user.rb')).toBe('model')
    expect(mvc.identifyFileType('/path/to/my_app/app/controllers/users_controller.rb')).toBe('controller')
    expect(mvc.identifyFileType('/path/to/my_app/app/views/users/index.html.erb')).toBe('view')
    expect(mvc.identifyFileType('/path/to/my_app/spec/models/user_spec.rb')).toBe('spec')
  })

  it('calculates companion paths for a model', () => {
    const paths = mvc.getCompanionPaths('/path/to/my_app/app/models/user.rb', root)
    expect(paths.model).toBe('/path/to/my_app/app/models/user.rb')
    expect(paths.controller).toBe('/path/to/my_app/app/controllers/users_controller.rb')
    expect(paths.viewDir).toBe('/path/to/my_app/app/views/users')
    expect(paths.spec).toBe('/path/to/my_app/spec/models/user_spec.rb')
  })

  it('calculates companion paths for a controller', () => {
    const paths = mvc.getCompanionPaths('/path/to/my_app/app/controllers/orders_controller.rb', root)
    expect(paths.model).toBe('/path/to/my_app/app/models/order.rb')
    expect(paths.controller).toBe('/path/to/my_app/app/controllers/orders_controller.rb')
  })
})
