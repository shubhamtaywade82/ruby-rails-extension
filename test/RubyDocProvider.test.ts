import { describe, it, expect } from 'vitest'
import { parseMethodPage } from '../src/docs/RubyDocProvider'

// Trimmed from a real `curl https://www.rubydoc.info/gems/sidekiq/Sidekiq/Client`
// response — verifies against actual YARD template markup, not a guess at it.
const SIDEKIQ_CLIENT_PAGE = `
<div id="instance_method_details" class="method_details_list">
  <h2>Instance Method Details</h2>

  <div class="method_details first">
  <h3 class="signature first" id="initialize-instance_method">
    <strong>initialize</strong>(pool: nil, config: nil)  &#x21d2; <tt>Client</tt>
  </h3>
  <div class="docstring">
    <div class="discussion">
      <p>Sidekiq::Client is responsible for pushing job payloads to Redis.
Requires the :pool or :config keyword argument.</p>
    </div>
  </div>
  <div class="tags">
    <p class="tag_title">Parameters:</p>
    <ul class="param">
      <li>
        <span class='name'>pool</span>
        <span class='type'>(<tt>ConnectionPool</tt>)</span>
        &mdash;
        <div class='inline'><p>explicit Redis pool to use</p></div>
      </li>
      <li>
        <span class='name'>config</span>
        <span class='type'>(<tt>Sidekiq::Config</tt>)</span>
        &mdash;
        <div class='inline'><p>use the pool and middleware from the given Sidekiq container</p></div>
      </li>
    </ul>
    <p class="tag_title">Returns:</p>
    <ul class="return">
      <li>
        <span class='type'>(<tt>Client</tt>)</span>
        &mdash;
        <div class='inline'><p>a new instance of Client</p></div>
      </li>
    </ul>
  </div>
  <table class="source_code">
    <tr>
      <td><pre class="lines">42\n43</pre></td>
      <td><pre class="code"><span class="info file"># File 'lib/sidekiq/client.rb', line 42</span></pre></td>
    </tr>
  </table>
  </div>

  <div class="method_details ">
  <h3 class="signature " id="push-instance_method">
    <strong>push</strong>(item)  &#x21d2; <tt>String</tt>
  </h3>
  <div class="docstring">
    <div class="discussion">
    </div>
  </div>
  <div class="tags">
  </div>
  </div>
</div>
`

describe('parseMethodPage', () => {
  it('extracts signature, description, params, return type, and source location', () => {
    const entry = parseMethodPage(SIDEKIQ_CLIENT_PAGE, 'sidekiq', '7.2.0', 'Sidekiq::Client', 'initialize', 'https://www.rubydoc.info/gems/sidekiq/7.2.0/Sidekiq/Client')

    expect(entry).not.toBeNull()
    expect(entry!.signature).toContain('initialize(pool: nil, config: nil)')
    expect(entry!.description).toContain('Sidekiq::Client is responsible for pushing job payloads to Redis.')
    expect(entry!.params).toEqual([
      { name: 'pool', type: 'ConnectionPool', description: 'explicit Redis pool to use' },
      { name: 'config', type: 'Sidekiq::Config', description: 'use the pool and middleware from the given Sidekiq container' },
    ])
    expect(entry!.returnType).toBe('Client')
    expect(entry!.sourceLocation).toBe('lib/sidekiq/client.rb:42')
  })

  it('does not bleed content from the next method block', () => {
    const entry = parseMethodPage(SIDEKIQ_CLIENT_PAGE, 'sidekiq', '7.2.0', 'Sidekiq::Client', 'initialize', 'url')
    expect(entry!.description).not.toContain('a new instance of Client')
  })

  it('returns null when the method id is not present on the page', () => {
    const entry = parseMethodPage(SIDEKIQ_CLIENT_PAGE, 'sidekiq', '7.2.0', 'Sidekiq::Client', 'nonexistent_method', 'url')
    expect(entry).toBeNull()
  })

  it('handles a method with no docstring or params gracefully', () => {
    const entry = parseMethodPage(SIDEKIQ_CLIENT_PAGE, 'sidekiq', '7.2.0', 'Sidekiq::Client', 'push', 'url')
    expect(entry).not.toBeNull()
    expect(entry!.description).toBeNull()
    expect(entry!.params).toEqual([])
    expect(entry!.returnType).toBeNull()
  })
})
