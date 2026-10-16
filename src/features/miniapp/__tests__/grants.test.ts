import {beforeEach, describe, expect, it, jest} from '@jest/globals'

const mockStore = new Map<string, unknown>()

jest.mock('#/storage', () => ({
  device: {
    get: (key: string[]) => mockStore.get(key.join('.')),
    set: (key: string[], value: unknown) => mockStore.set(key.join('.'), value),
  },
}))

import {clearGrant, getGrant, saveGrant} from '../grants'

const URI = 'at://did:plc:dev/net.krao.miniapp.app/3k'

describe('Mini App grants', () => {
  beforeEach(() => {
    mockStore.clear()
  })

  it('has nothing before the person answers', () => {
    expect(getGrant('did:plc:me', URI, 'cid1')).toBeUndefined()
  })

  it('remembers the permissions per account, app and version', () => {
    saveGrant('did:plc:me', URI, 'cid1', ['identity', 'wallet'])
    expect(getGrant('did:plc:me', URI, 'cid1')).toEqual(['identity', 'wallet'])
    // Another account asks again
    expect(getGrant('did:plc:you', URI, 'cid1')).toBeUndefined()
    // An edited app (new cid) asks again
    expect(getGrant('did:plc:me', URI, 'cid2')).toBeUndefined()
    // Another app asks again
    expect(
      getGrant(
        'did:plc:me',
        'at://did:plc:dev/net.krao.miniapp.app/3z',
        'cid1',
      ),
    ).toBeUndefined()
  })

  it('replaces the grant of an older version', () => {
    saveGrant('did:plc:me', URI, 'cid1', ['identity'])
    saveGrant('did:plc:me', URI, 'cid2', ['identity', 'sign'])
    expect(getGrant('did:plc:me', URI, 'cid1')).toBeUndefined()
    expect(getGrant('did:plc:me', URI, 'cid2')).toEqual(['identity', 'sign'])
  })

  it('keeps the grants of other accounts when one changes', () => {
    saveGrant('did:plc:me', URI, 'cid1', ['identity'])
    saveGrant('did:plc:you', URI, 'cid1', ['wallet'])
    saveGrant('did:plc:me', URI, 'cid2', ['sign'])
    expect(getGrant('did:plc:you', URI, 'cid1')).toEqual(['wallet'])
  })

  it('can be cleared', () => {
    saveGrant('did:plc:me', URI, 'cid1', ['identity'])
    clearGrant('did:plc:me', URI)
    expect(getGrant('did:plc:me', URI, 'cid1')).toBeUndefined()
  })

  it('drops permissions it does not know', () => {
    mockStore.set('kraoMiniAppGrants', [
      {
        did: 'did:plc:me',
        uri: URI,
        cid: 'c',
        permissions: ['identity', 'root'],
        grantedAt: 1,
      },
    ])
    expect(getGrant('did:plc:me', URI, 'c')).toEqual(['identity'])
  })
})
