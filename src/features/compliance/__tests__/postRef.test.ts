import {describe, expect, it} from '@jest/globals'

import {parsePostRef} from '../moderation/postRef'

describe('parsePostRef', () => {
  it('reads AT URIs', () => {
    expect(parsePostRef('at://did:plc:abc/app.bsky.feed.post/3kabc')).toEqual({
      uri: 'at://did:plc:abc/app.bsky.feed.post/3kabc',
    })
    expect(parsePostRef('at://ana.test/app.bsky.feed.post/3kabc')).toEqual({
      name: 'ana.test',
      rkey: '3kabc',
    })
  })

  it('reads post links with a handle or a DID', () => {
    expect(
      parsePostRef('https://krao.net/profile/ana.test/post/3kabc'),
    ).toEqual({name: 'ana.test', rkey: '3kabc'})
    expect(
      parsePostRef(' https://krao.net/profile/did:plc:abc/post/3kabc/ '),
    ).toEqual({uri: 'at://did:plc:abc/app.bsky.feed.post/3kabc'})
  })

  it('rejects anything else', () => {
    for (const bad of [
      '',
      'hello',
      'https://krao.net/profile/ana.test',
      'at://did:plc:abc/app.bsky.feed.like/3kabc',
      'at://did:plc:abc',
    ]) {
      expect(parsePostRef(bad)).toBeNull()
    }
  })
})
