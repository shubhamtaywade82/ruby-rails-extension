import { describe, it, expect } from 'vitest'
import { TurboFrameNavigator } from '../src/hotwire/TurboFrameNavigator'

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
})
