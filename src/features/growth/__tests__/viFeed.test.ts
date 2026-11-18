import {isVietnamese, toDidFeedUri} from '../viFeed'

describe('isVietnamese', () => {
  it('matches vi and regional variants only', () => {
    expect(isVietnamese('vi')).toBe(true)
    expect(isVietnamese('vi-VN')).toBe(true)
    expect(isVietnamese('VI')).toBe(true)
    expect(isVietnamese('en')).toBe(false)
    expect(isVietnamese('')).toBe(false)
  })
})

describe('toDidFeedUri', () => {
  const resolve = jest.fn((h: string) =>
    Promise.resolve(h === 'krao.net' ? 'did:plc:abc' : undefined),
  )

  it('keeps a DID-owned feed without resolving', async () => {
    const uri = 'at://did:plc:abc/app.bsky.feed.generator/vi'
    expect(await toDidFeedUri(uri, resolve)).toBe(uri)
    expect(resolve).not.toHaveBeenCalled()
  })

  it('resolves a handle owner', async () => {
    expect(
      await toDidFeedUri('at://krao.net/app.bsky.feed.generator/vi', resolve),
    ).toBe('at://did:plc:abc/app.bsky.feed.generator/vi')
  })

  it('returns undefined for empty, invalid or unresolved', async () => {
    expect(await toDidFeedUri('', resolve)).toBeUndefined()
    expect(await toDidFeedUri('not a uri', resolve)).toBeUndefined()
    expect(
      await toDidFeedUri(
        'at://nope.example/app.bsky.feed.generator/x',
        resolve,
      ),
    ).toBeUndefined()
  })
})
