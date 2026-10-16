import {describe, expect, it} from '@jest/globals'

import {
  buildMiniAppEmbed,
  canRunApp,
  isSameOriginAsHost,
  knownPermissions,
  manifestOrigin,
  miniAppPath,
  miniAppRefFromEmbed,
  miniAppUri,
  parseMiniAppLink,
  parseMiniAppUri,
} from '../logic'

const URI = 'at://did:plc:dev123/net.krao.miniapp.app/3kabc'

describe('canRunApp', () => {
  it('runs only an approved app', () => {
    expect(canRunApp({status: 'approved'})).toBe(true)
    for (const status of ['pending', 'revoked', 'invalid'] as const) {
      expect(canRunApp({status})).toBe(false)
    }
    expect(canRunApp(undefined)).toBe(false)
  })
})

describe('manifestOrigin', () => {
  it('takes the origin of an https url that matches the indexer', () => {
    expect(
      manifestOrigin({
        url: 'https://app.example/play?x=1',
        origin: 'https://app.example',
      }),
    ).toBe('https://app.example')
  })

  it('refuses when the indexer origin is not the url origin', () => {
    expect(
      manifestOrigin({
        url: 'https://app.example/',
        origin: 'https://other.example',
      }),
    ).toBeUndefined()
    expect(
      manifestOrigin({
        url: 'https://app.example.evil.io/',
        origin: 'https://app.example',
      }),
    ).toBeUndefined()
  })

  it('refuses plain http except on this machine', () => {
    expect(
      manifestOrigin({
        url: 'http://app.example/',
        origin: 'http://app.example',
      }),
    ).toBeUndefined()
    expect(
      manifestOrigin({
        url: 'http://localhost:2595/',
        origin: 'http://localhost:2595',
      }),
    ).toBe('http://localhost:2595')
    expect(
      manifestOrigin({
        url: 'http://127.0.0.1:2595/',
        origin: 'http://127.0.0.1:2595',
      }),
    ).toBe('http://127.0.0.1:2595')
  })

  it('refuses other schemes, credentials and junk', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,hi',
      'file:///etc/passwd',
      'https://user:pw@app.example/',
      'not a url',
      '',
    ]) {
      expect(
        manifestOrigin({url, origin: 'https://app.example'}),
      ).toBeUndefined()
    }
  })
})

describe('isSameOriginAsHost', () => {
  it('compares whole origins', () => {
    expect(isSameOriginAsHost('https://krao.net', 'https://krao.net')).toBe(
      true,
    )
    expect(isSameOriginAsHost('https://app.krao.net', 'https://krao.net')).toBe(
      false,
    )
    expect(isSameOriginAsHost('http://krao.net', 'https://krao.net')).toBe(
      false,
    )
  })
})

describe('knownPermissions', () => {
  it('keeps the ones this client knows, in a fixed order, once', () => {
    expect(
      knownPermissions(['transaction', 'admin', 'identity', 'identity']),
    ).toEqual(['identity', 'transaction'])
  })
})

describe('Mini App uris and links', () => {
  it('builds and parses a record uri', () => {
    expect(miniAppUri('did:plc:dev123', '3kabc')).toBe(URI)
    expect(parseMiniAppUri(URI)).toEqual({
      did: 'did:plc:dev123',
      rkey: '3kabc',
    })
  })

  it('refuses other collections and shapes', () => {
    expect(
      parseMiniAppUri('at://did:plc:x/app.bsky.feed.post/3k'),
    ).toBeUndefined()
    expect(
      parseMiniAppUri('at://did:plc:x/net.krao.miniapp.app'),
    ).toBeUndefined()
    expect(parseMiniAppUri('https://x.example')).toBeUndefined()
  })

  it('makes the in-app path', () => {
    expect(miniAppPath(URI)).toBe('/miniapp/did:plc:dev123/3kabc')
    expect(miniAppPath('at://did:plc:x/app.bsky.feed.post/3k')).toBeUndefined()
  })

  it('reads pasted links', () => {
    expect(parseMiniAppLink('/miniapp/did:plc:dev123/3kabc')).toBe(URI)
    expect(
      parseMiniAppLink('https://krao.net/miniapp/did:plc:dev123/3kabc'),
    ).toBe(URI)
    expect(parseMiniAppLink(` ${URI} `)).toBe(URI)
    expect(parseMiniAppLink('https://krao.net/profile/x')).toBeUndefined()
    expect(parseMiniAppLink('/miniapp/did:plc:dev123')).toBeUndefined()
    expect(parseMiniAppLink('')).toBeUndefined()
    expect(parseMiniAppLink('/miniapp/%E0%A4%A/x')).toBeUndefined()
  })
})

describe('the post embed', () => {
  it('round-trips', () => {
    const embed = buildMiniAppEmbed({uri: URI, cid: 'bafycid'})
    expect(embed).toEqual({
      $type: 'net.krao.embed.miniapp',
      app: {uri: URI, cid: 'bafycid'},
    })
    expect(miniAppRefFromEmbed(embed)).toEqual({uri: URI, cid: 'bafycid'})
  })

  it('ignores other embeds and malformed ones', () => {
    expect(miniAppRefFromEmbed(undefined)).toBeUndefined()
    expect(miniAppRefFromEmbed('x')).toBeUndefined()
    expect(
      miniAppRefFromEmbed({
        $type: 'app.bsky.embed.images',
        app: {uri: URI, cid: 'c'},
      }),
    ).toBeUndefined()
    expect(
      miniAppRefFromEmbed({$type: 'net.krao.embed.miniapp', app: {uri: URI}}),
    ).toBeUndefined()
    expect(
      miniAppRefFromEmbed({
        $type: 'net.krao.embed.miniapp',
        app: {uri: 'at://did:plc:x/app.bsky.feed.post/3k', cid: 'c'},
      }),
    ).toBeUndefined()
  })
})
