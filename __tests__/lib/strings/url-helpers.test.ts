import {describe, expect, it} from '@jest/globals'

import {
  getChatInviteCodeFromUrl,
  isPossiblyAUrl,
  isTrustedUrl,
  linkRequiresWarning,
  splitApexDomain,
} from '../../../src/lib/strings/url-helpers'

describe('linkRequiresWarning', () => {
  type Case = [string, string, boolean]

  const cases: Case[] = [
    ['http://example.com', 'http://example.com', false],
    ['http://example.com', 'example.com', false],
    ['http://example.com', 'example.com/page', false],
    ['http://example.com', '', true],
    ['http://example.com', 'other.com', true],
    ['http://example.com', 'http://other.com', true],
    ['http://example.com', 'some label', true],
    ['http://example.com', 'example.com more', true],
    ['http://example.com', 'http://example.co', true],
    ['http://example.co', 'http://example.com', true],
    ['http://example.com', 'example.co', true],
    ['http://example.co', 'example.com', true],
    ['http://site.pages.dev', 'http://site.page', true],
    ['http://site.page', 'http://site.pages.dev', true],
    ['http://site.pages.dev', 'site.page', true],
    ['http://site.page', 'site.pages.dev', true],
    ['http://site.pages.dev', 'http://site.pages', true],
    ['http://site.pages', 'http://site.pages.dev', true],
    ['http://site.pages.dev', 'site.pages', true],
    ['http://site.pages', 'site.pages.dev', true],
    ['http://krao.net/profile/bob.test/post/3kbeuduu7m22v', 'my post', false],
    ['https://krao.net/profile/bob.test/post/3kbeuduu7m22v', 'my post', false],
    ['http://krao.net/', 'bluesky', false],
    ['https://krao.net/', 'bluesky', false],
    [
      'http://krao.net/profile/bob.test/post/3kbeuduu7m22v',
      'http://krao.net/profile/bob.test/post/3kbeuduu7m22v',
      false,
    ],
    [
      'https://krao.net/profile/bob.test/post/3kbeuduu7m22v',
      'http://krao.net/profile/bob.test/post/3kbeuduu7m22v',
      false,
    ],
    [
      'http://krao.net/',
      'http://krao.net/profile/bob.test/post/3kbeuduu7m22v',
      false,
    ],
    [
      'https://krao.net/',
      'http://krao.net/profile/bob.test/post/3kbeuduu7m22v',
      false,
    ],
    [
      'http://krao.net/profile/bob.test/post/3kbeuduu7m22v',
      'https://google.com',
      true,
    ],
    [
      'https://krao.net/profile/bob.test/post/3kbeuduu7m22v',
      'https://google.com',
      true,
    ],
    ['http://krao.net/', 'https://google.com', true],
    ['https://krao.net/', 'https://google.com', true],

    // case insensitive
    ['https://Example.com', 'example.com', false],
    ['https://example.com', 'Example.com', false],

    // bad uri inputs, default to true
    ['', '', true],
    ['example.com', 'example.com', true],
    ['/profile', 'Username', false],
    ['#', 'Show More', false],
    ['https://docs.krao.net', 'https://docs.krao.net', false],
    ['https://krao.net/compose/intent?text=test', 'Compose a post', false],
  ]

  it.each(cases)(
    'given input uri %p and text %p, returns %p',
    (uri, text, expected) => {
      const output = linkRequiresWarning(uri, text)
      expect(output).toEqual(expected)
    },
  )
})

describe('isPossiblyAUrl', () => {
  type Case = [string, boolean]
  const cases: Case[] = [
    ['', false],
    ['text', false],
    ['some text', false],
    ['some text', false],
    ['some domain.com', false],
    ['domain.com', true],
    [' domain.com', true],
    ['domain.com ', true],
    [' domain.com ', true],
    ['http://domain.com', true],
    [' http://domain.com', true],
    ['http://domain.com ', true],
    [' http://domain.com ', true],
    ['https://domain.com', true],
    [' https://domain.com', true],
    ['https://domain.com ', true],
    [' https://domain.com ', true],
    ['http://domain.com/foo', true],
    ['http://domain.com stuff', true],
  ]

  it.each(cases)('given input uri %p, returns %p', (str, expected) => {
    const output = isPossiblyAUrl(str)
    expect(output).toEqual(expected)
  })
})

describe('splitApexDomain', () => {
  type Case = [string, string, string]
  const cases: Case[] = [
    ['', '', ''],
    ['example.com', '', 'example.com'],
    ['foo.example.com', 'foo.', 'example.com'],
    ['foo.bar.example.com', 'foo.bar.', 'example.com'],
    ['example.co.uk', '', 'example.co.uk'],
    ['foo.example.co.uk', 'foo.', 'example.co.uk'],
    ['example.nonsense', '', 'example.nonsense'],
    ['foo.example.nonsense', '', 'foo.example.nonsense'],
    ['foo.bar.example.nonsense', '', 'foo.bar.example.nonsense'],
    ['example.com.example.com', 'example.com.', 'example.com'],
  ]

  it.each(cases)(
    'given input uri %p, returns %p,%p',
    (str, expected1, expected2) => {
      const output = splitApexDomain(str)
      expect(output[0]).toEqual(expected1)
      expect(output[1]).toEqual(expected2)
    },
  )
})

describe('isTrustedUrl', () => {
  const cases = [
    ['#', true],
    ['#profile', true],
    ['/', true],
    ['/profile', true],
    ['/profile/', true],
    ['/profile/bob.test', true],
    ['https://krao.net', true],
    ['https://krao.net/', true],
    ['https://krao.net/profile/bob.test', true],
    ['https://www.krao.net', true],
    ['https://www.krao.net/', true],
    ['https://docs.krao.net', true],
    ['https://bsky.social', false],
    ['https://bsky.social/blog', false],
    ['https://blueskyweb.xyz', false],
    ['https://blueskyweb.zendesk.com', false],
    ['http://krao.net', true],
    ['http://bsky.social', false],
    ['http://blueskyweb.xyz', false],
    ['http://blueskyweb.zendesk.com', false],
    ['https://google.com', false],
    ['https://docs.google.com', false],
    ['https://google.com/#', false],
    ['https://blueskywebxzendesk.com', false],
  ]

  it.each(cases)('given input uri %p, returns %p', (str, expected) => {
    const output = isTrustedUrl(str)
    expect(output).toEqual(expected)
  })
})

describe('getChatInviteCodeFromUrl', () => {
  type Case = [string, string | undefined]

  const cases: Case[] = [
    ['https://krao.net/chat/abcdefg', 'abcdefg'],
    ['https://krao.net/chat/abcdefghij', 'abcdefghij'],
    // http is not recognized as a krao.net url
    ['http://krao.net/chat/abcdefg', undefined],
    ['https://krao.net/chat/abcdefg?utm=foo', 'abcdefg'],
    ['https://krao.net/chat/abcdefg#section', 'abcdefg'],
    ['/chat/abcdefg', 'abcdefg'],
    ['/chat/abcdefg?utm=foo', 'abcdefg'],
    ['/chat/abcdefg#section', 'abcdefg'],

    // too short
    ['https://krao.net/chat/abcdef', undefined],
    ['/chat/abcdef', undefined],
    // too long
    ['https://krao.net/chat/abcdefghijk', undefined],
    ['/chat/abcdefghijk', undefined],
    // invalid characters
    ['https://krao.net/chat/abc-def', undefined],
    ['/chat/abc def', undefined],
    // trailing path
    ['https://krao.net/chat/abcdefg/extra', undefined],
    ['/chat/abcdefg/extra', undefined],
    // wrong path
    ['https://krao.net/profile/abcdefg', undefined],
    ['https://krao.net/chat', undefined],
    // wrong host
    ['https://example.com/chat/abcdefg', undefined],
    // not a url, not a path
    ['chat/abcdefg', undefined],
    ['abcdefg', undefined],
    ['', undefined],
    // malformed url
    ['https://[invalid/chat/abcdefg', undefined],
  ]

  it.each(cases)('given input %p, returns %p', (input, expected) => {
    expect(getChatInviteCodeFromUrl(input)).toEqual(expected)
  })
})
