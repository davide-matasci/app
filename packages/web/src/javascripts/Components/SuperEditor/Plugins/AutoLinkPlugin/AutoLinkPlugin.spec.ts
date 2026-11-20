import { emailMatcher, urlMatcher } from './AutoLinkPlugin'

describe('auto-link matchers', () => {
  it.each([
    ['See https://example.com/docs/page.', 'https://example.com/docs/page'],
    ['(see https://en.wikipedia.org/wiki/Foo)', 'https://en.wikipedia.org/wiki/Foo'],
    ['https://en.wikipedia.org/wiki/Foo_(bar) is it', 'https://en.wikipedia.org/wiki/Foo_(bar)'],
    ['go to www.example.com, then', 'www.example.com'],
  ])('URL in %j → %s', (text, expected) => {
    expect(urlMatcher(text)?.text).toBe(expected)
  })

  it('finds an email inside a sentence', () => {
    expect(emailMatcher('Mail me at bob@example.com today')).toEqual({
      index: 11,
      length: 15,
      text: 'bob@example.com',
      url: 'mailto:bob@example.com',
    })
  })
})
