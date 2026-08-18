import { describe, it, expect } from 'vitest'
import { TurboFrameNavigator, extractFrameIdAtPosition } from '../src/hotwire/TurboFrameNavigator'

describe('TurboFrameNavigator', () => {
  const nav = new TurboFrameNavigator()

  it('indexes ERB turbo_frame_tag helper and HTML turbo-frame tags', () => {
    const template = `
<div class="container">
  <%= turbo_frame_tag "cart_items" do %>
    <p>Items in cart</p>
  <% end %>

  <turbo-frame id="user_profile">
    <h2>Profile</h2>
  </turbo-frame>
</div>
`
    nav.indexTemplateFrames('/app/views/orders/show.html.erb', template)

    const cartFrames = nav.findFrameLocations('cart_items')
    expect(cartFrames.length).toBe(1)
    expect(cartFrames[0].filePath).toBe('/app/views/orders/show.html.erb')
    expect(cartFrames[0].line).toBe(3)

    const profileFrames = nav.findFrameLocations('user_profile')
    expect(profileFrames.length).toBe(1)
    expect(profileFrames[0].line).toBe(7)
  })

  it('re-indexing a file replaces its previous frames instead of duplicating them', () => {
    const nav2 = new TurboFrameNavigator()
    nav2.indexTemplateFrames('/app/views/orders/show.html.erb', '<turbo-frame id="cart">')
    nav2.indexTemplateFrames('/app/views/orders/show.html.erb', '<turbo-frame id="cart">')

    expect(nav2.findFrameLocations('cart').length).toBe(1)
  })

  it('removeFile clears every frame indexed for that file', () => {
    const nav3 = new TurboFrameNavigator()
    nav3.indexTemplateFrames('/app/views/orders/show.html.erb', '<turbo-frame id="cart">')
    nav3.removeFile('/app/views/orders/show.html.erb')

    expect(nav3.findFrameLocations('cart')).toEqual([])
  })
})

describe('extractFrameIdAtPosition', () => {
  it('resolves the id when the cursor is inside a turbo_frame_tag call', () => {
    const line = '  <%= turbo_frame_tag "cart_items" do %>'
    const char = line.indexOf('cart_items') + 3
    expect(extractFrameIdAtPosition(line, char)).toBe('cart_items')
  })

  it('resolves the id when the cursor is inside a <turbo-frame id="..."> tag', () => {
    const line = '  <turbo-frame id="user_profile">'
    const char = line.indexOf('user_profile') + 3
    expect(extractFrameIdAtPosition(line, char)).toBe('user_profile')
  })

  it('returns null when the cursor is outside any turbo frame reference', () => {
    const line = '  <turbo-frame id="user_profile">'
    expect(extractFrameIdAtPosition(line, 1)).toBeNull()
  })
})
