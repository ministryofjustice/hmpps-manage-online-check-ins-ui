import escapeHtml from './escapeHtml'

describe('escapeHtml', () => {
  it('escapes the characters that are special in HTML', () => {
    expect(escapeHtml(`<script>alert("x" & 'y')</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;',
    )
  })

  it('leaves ordinary text alone', () => {
    expect(escapeHtml('Joe')).toBe('Joe')
  })
})
