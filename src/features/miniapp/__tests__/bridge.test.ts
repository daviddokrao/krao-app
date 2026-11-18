import {describe, expect, it, jest} from '@jest/globals'

import {
  BridgeError,
  createBridge,
  effectivePermissions,
  type Handlers,
  isTrustedSender,
  MAX_MESSAGE_BYTES,
  messageText,
  parseIncoming,
  utf8Length,
  validateParams,
} from '../bridge'
import {type Permission} from '../logic'

const ORIGIN = 'https://app.example'
const FRAME = {name: 'frame'}
const ADDRESS = '0x' + 'ab'.repeat(20)

type Sent = {message: Record<string, unknown>; target: string}

function setup(
  overrides: {
    permissions?: Permission[]
    approved?: boolean
    handlers?: Partial<Handlers>
  } = {},
) {
  const sent: Sent[] = []
  const handlers: Handlers = {
    getContext: jest.fn(() =>
      Promise.resolve({user: {did: 'did:plc:me', handle: 'me'}}),
    ),
    requestWallet: jest.fn(() =>
      Promise.resolve({address: ADDRESS, chain: 'eip155:8453'}),
    ),
    signMessage: jest.fn(() => Promise.resolve({signature: '0xsig'})),
    sendTransaction: jest.fn(() => Promise.resolve({hash: '0xhash'})),
    close: jest.fn(),
    ...overrides.handlers,
  }
  const permissions = new Set<Permission>(
    overrides.permissions ?? ['identity', 'wallet', 'sign', 'transaction'],
  )
  const state = {approved: overrides.approved ?? true}
  const onReady = jest.fn()
  const bridge = createBridge({
    origin: ORIGIN,
    frame: () => FRAME,
    isApproved: () => state.approved,
    permissions: () => permissions,
    handlers,
    send: (message, target) => sent.push({message, target}),
    onReady,
  })
  const post = (
    data: unknown,
    event: {origin?: string; source?: unknown} = {},
  ) =>
    bridge.handleMessage({
      data,
      origin: event.origin ?? ORIGIN,
      source: 'source' in event ? event.source : FRAME,
    })
  return {bridge, handlers, sent, post, state, onReady, permissions}
}

const req = (id: string, method: string, params?: unknown) => ({
  krao: 1,
  id,
  method,
  ...(params === undefined ? {} : {params}),
})

describe('isTrustedSender', () => {
  const base = {
    source: FRAME,
    frame: FRAME,
    origin: ORIGIN,
    expectedOrigin: ORIGIN,
  }
  it('accepts the frame window at the manifest origin', () => {
    expect(isTrustedSender(base)).toBe(true)
  })
  it('rejects another window', () => {
    expect(isTrustedSender({...base, source: {name: 'other'}})).toBe(false)
  })
  it('rejects another origin, including a look-alike', () => {
    expect(isTrustedSender({...base, origin: 'https://evil.example'})).toBe(
      false,
    )
    expect(
      isTrustedSender({...base, origin: 'https://app.example.evil.io'}),
    ).toBe(false)
    expect(isTrustedSender({...base, origin: 'http://app.example'})).toBe(false)
  })
  it('rejects a missing source or frame', () => {
    expect(isTrustedSender({...base, source: null})).toBe(false)
    expect(isTrustedSender({...base, frame: null, source: null})).toBe(false)
    expect(isTrustedSender({...base, frame: undefined})).toBe(false)
  })
  it('never matches an opaque origin', () => {
    expect(
      isTrustedSender({...base, origin: 'null', expectedOrigin: 'null'}),
    ).toBe(false)
    expect(isTrustedSender({...base, expectedOrigin: ''})).toBe(false)
  })
})

describe('messageText and size', () => {
  it('counts UTF-8 bytes', () => {
    expect(utf8Length('abc')).toBe(3)
    expect(utf8Length('é')).toBe(2)
    expect(utf8Length('€')).toBe(3)
    expect(utf8Length('😀')).toBe(4)
  })
  it('drops a message over 64 KB', () => {
    const big = {
      krao: 1,
      id: '1',
      method: 'signMessage',
      params: {message: 'a'.repeat(MAX_MESSAGE_BYTES)},
    }
    expect(messageText(big)).toBeUndefined()
    expect(messageText('x'.repeat(MAX_MESSAGE_BYTES + 1))).toBeUndefined()
  })
  it('counts bytes, not characters', () => {
    // 30000 euro signs are 90000 bytes in UTF-8 but 30000 characters
    expect(messageText({s: '€'.repeat(30000)})).toBeUndefined()
    expect(messageText({s: '€'.repeat(1000)})).toBeDefined()
  })
  it('drops what cannot be serialized', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(messageText(cyclic)).toBeUndefined()
    expect(messageText({n: BigInt(1)})).toBeUndefined()
    expect(messageText(undefined)).toBeUndefined()
  })
})

describe('parseIncoming', () => {
  it('reads a request, also as a JSON string (native)', () => {
    const msg = req('a', 'getContext')
    expect(parseIncoming(msg)).toEqual({
      type: 'request',
      id: 'a',
      method: 'getContext',
      params: undefined,
    })
    expect(parseIncoming(JSON.stringify(msg))).toMatchObject({type: 'request'})
  })
  it('reads the ready event and ignores other events', () => {
    expect(parseIncoming({krao: 1, event: 'ready'})).toEqual({type: 'ready'})
    expect(parseIncoming({krao: 1, event: 'something'})).toEqual({
      type: 'ignore',
    })
  })
  it.each([
    ['no protocol marker', {id: '1', method: 'getContext'}],
    ['wrong version', {krao: 2, id: '1', method: 'getContext'}],
    ['string version', {krao: '1', id: '1', method: 'getContext'}],
    ['array', [1, 2]],
    ['null', null],
    ['number', 5],
    ['not JSON', 'hello'],
    ['numeric id', {krao: 1, id: 5, method: 'getContext'}],
    ['empty id', {krao: 1, id: '', method: 'getContext'}],
    ['huge id', {krao: 1, id: 'x'.repeat(101), method: 'getContext'}],
    ['no method', {krao: 1, id: '1'}],
    ['object method', {krao: 1, id: '1', method: {a: 1}}],
  ])('ignores %s', (_name, data) => {
    expect(parseIncoming(data)).toEqual({type: 'ignore'})
  })
})

describe('validateParams', () => {
  it('requires a message to sign', () => {
    expect(validateParams('signMessage', {message: 'hi'})).toEqual({
      message: 'hi',
    })
    for (const bad of [
      undefined,
      {},
      {message: ''},
      {message: 5},
      {message: 'a'.repeat(10_001)},
    ]) {
      expect(() => validateParams('signMessage', bad)).toThrow(BridgeError)
    }
  })
  it('requires params to be an object', () => {
    expect(() => validateParams('signMessage', 'hi')).toThrow(BridgeError)
    expect(() => validateParams('signMessage', ['hi'])).toThrow(BridgeError)
  })
  it('checks and normalizes a transaction', () => {
    expect(validateParams('sendTransaction', {to: ADDRESS})).toEqual({
      to: ADDRESS,
    })
    expect(
      validateParams('sendTransaction', {
        to: ADDRESS,
        data: '0xa9059cbb',
        value: '100000000000000',
      }),
    ).toEqual({to: ADDRESS, data: '0xa9059cbb', value: '100000000000000'})
    // Hex values become decimal, empty data is dropped, zero is kept
    expect(
      validateParams('sendTransaction', {
        to: ADDRESS,
        data: '0x',
        value: '0x10',
      }),
    ).toEqual({to: ADDRESS, value: '16'})
    expect(
      validateParams('sendTransaction', {to: ADDRESS, value: '0'}),
    ).toEqual({to: ADDRESS, value: '0'})
  })
  it.each([
    ['no to', {}],
    ['short address', {to: '0x1234'}],
    ['ens name', {to: 'vitalik.eth'}],
    ['non-hex address', {to: '0x' + 'zz'.repeat(20)}],
    ['odd-length data', {to: ADDRESS, data: '0xabc'}],
    ['data without 0x', {to: ADDRESS, data: 'abcd'}],
    ['huge data', {to: ADDRESS, data: '0x' + 'ab'.repeat(24_001)}],
    ['numeric value', {to: ADDRESS, value: 5}],
    ['negative value', {to: ADDRESS, value: '-1'}],
    ['decimal value', {to: ADDRESS, value: '1.5'}],
    ['long value', {to: ADDRESS, value: '1'.repeat(41)}],
    ['bigint-like object', {to: ADDRESS, value: {hex: '0x1'}}],
  ])('rejects %s', (_name, params) => {
    expect(() => validateParams('sendTransaction', params)).toThrow(
      expect.objectContaining({code: 'InvalidParams'}),
    )
  })
})

describe('effectivePermissions', () => {
  it('is what the manifest declares and the person granted', () => {
    expect([
      ...effectivePermissions(['identity', 'sign'], ['identity', 'wallet']),
    ]).toEqual(['identity'])
  })
  it('ignores what it does not know', () => {
    expect([...effectivePermissions(['admin'], ['admin'])]).toEqual([])
  })
})

describe('bridge', () => {
  it('answers getContext addressed to the manifest origin', async () => {
    const {post, sent, handlers} = setup()
    await post(req('1', 'getContext'))
    expect(handlers.getContext).toHaveBeenCalledTimes(1)
    expect(sent).toEqual([
      {
        message: {
          krao: 1,
          id: '1',
          result: {user: {did: 'did:plc:me', handle: 'me'}},
        },
        target: ORIGIN,
      },
    ])
  })

  it('ignores messages from another window or origin without a reply', async () => {
    const {post, sent, handlers} = setup()
    await post(req('1', 'getContext'), {source: {name: 'popup'}})
    await post(req('2', 'getContext'), {origin: 'https://evil.example'})
    await post(req('3', 'getContext'), {source: null})
    expect(sent).toEqual([])
    expect(handlers.getContext).not.toHaveBeenCalled()
  })

  it('ignores garbage and oversize messages without a reply', async () => {
    const {post, sent, handlers} = setup()
    await post('nope')
    await post({krao: 1, id: 7, method: 'getContext'})
    await post(
      req('x', 'signMessage', {message: 'a'.repeat(MAX_MESSAGE_BYTES)}),
    )
    expect(sent).toEqual([])
    expect(handlers.signMessage).not.toHaveBeenCalled()
  })

  it('tells ready to the host', async () => {
    const {post, onReady, sent} = setup()
    await post({krao: 1, event: 'ready'})
    expect(onReady).toHaveBeenCalledTimes(1)
    expect(sent).toEqual([])
  })

  it('refuses an unknown method', async () => {
    const {post, sent} = setup()
    await post(req('1', 'eth_sendTransaction'))
    await post(req('2', 'constructor'))
    await post(req('3', '__proto__'))
    expect(sent.map(s => (s.message.error as {code: string}).code)).toEqual([
      'Unsupported',
      'Unsupported',
      'Unsupported',
    ])
  })

  it('refuses everything for an app that is not approved', async () => {
    const {post, sent, handlers, state} = setup()
    state.approved = false
    await post(req('1', 'getContext'))
    await post(req('2', 'sendTransaction', {to: ADDRESS}))
    expect(sent.map(s => (s.message.error as {code: string}).code)).toEqual([
      'NotApproved',
      'NotApproved',
    ])
    expect(handlers.getContext).not.toHaveBeenCalled()
    expect(handlers.sendTransaction).not.toHaveBeenCalled()
  })

  it.each<
    [
      'getContext' | 'requestWallet' | 'signMessage' | 'sendTransaction',
      Permission,
      unknown,
    ]
  >([
    ['getContext', 'identity', undefined],
    ['requestWallet', 'wallet', undefined],
    ['signMessage', 'sign', {message: 'hi'}],
    ['sendTransaction', 'transaction', {to: ADDRESS}],
  ])('%s needs the %s permission', async (method, needed, params) => {
    const all: Permission[] = ['identity', 'wallet', 'sign', 'transaction']
    const {post, sent, handlers} = setup({
      permissions: all.filter(p => p !== needed),
    })
    await post(req('1', method, params))
    expect(sent[0].message.error).toMatchObject({code: 'PermissionDenied'})
    expect(handlers[method]).not.toHaveBeenCalled()
  })

  it('lets close through without a permission and answers', async () => {
    const {post, sent, handlers} = setup({permissions: []})
    await post(req('1', 'close'))
    expect(handlers.close).toHaveBeenCalledTimes(1)
    expect(sent[0].message).toEqual({krao: 1, id: '1', result: {}})
  })

  it('does not call a handler with invalid params', async () => {
    const {post, sent, handlers} = setup()
    await post(req('1', 'sendTransaction', {to: 'nope'}))
    await post(req('2', 'signMessage', {}))
    expect(sent.map(s => (s.message.error as {code: string}).code)).toEqual([
      'InvalidParams',
      'InvalidParams',
    ])
    expect(handlers.sendTransaction).not.toHaveBeenCalled()
    expect(handlers.signMessage).not.toHaveBeenCalled()
  })

  it('passes normalized params to the handler', async () => {
    const {post, handlers} = setup()
    await post(
      req('1', 'sendTransaction', {to: ADDRESS, value: '0x10', extra: 'x'}),
    )
    expect(handlers.sendTransaction).toHaveBeenCalledWith({
      to: ADDRESS,
      value: '16',
    })
  })

  it('allows one signing request at a time', async () => {
    let release: (v: {signature: string}) => void = () => {}
    const signMessage = jest
      .fn<Handlers['signMessage']>()
      .mockImplementationOnce(
        () => new Promise<{signature: string}>(r => (release = r)),
      )
      .mockResolvedValue({signature: '0xlater'})
    const {post, sent, handlers} = setup({handlers: {signMessage}})
    const first = post(req('1', 'signMessage', {message: 'one'}))
    // A second request of any signing kind, while the first waits
    await post(req('2', 'signMessage', {message: 'two'}))
    await post(req('3', 'sendTransaction', {to: ADDRESS}))
    await post(req('4', 'requestWallet'))
    expect(handlers.signMessage).toHaveBeenCalledTimes(1)
    expect(handlers.sendTransaction).not.toHaveBeenCalled()
    expect(handlers.requestWallet).not.toHaveBeenCalled()
    expect(sent.map(s => s.message.id)).toEqual(['2', '3', '4'])
    expect(
      sent.every(s => (s.message.error as {code: string}).code === 'Failed'),
    ).toBe(true)

    release({signature: '0xsig'})
    await first
    expect(sent[3].message).toEqual({
      krao: 1,
      id: '1',
      result: {signature: '0xsig'},
    })
    // Free again
    await post(req('5', 'signMessage', {message: 'three'}))
    expect(handlers.signMessage).toHaveBeenCalledTimes(2)
  })

  it('does not block getContext while a signature waits', async () => {
    const {post, sent} = setup({
      handlers: {
        signMessage: jest.fn(() => new Promise<{signature: string}>(() => {})),
      },
    })
    void post(req('1', 'signMessage', {message: 'one'}))
    await post(req('2', 'getContext'))
    expect(sent[0].message).toMatchObject({id: '2', result: expect.anything()})
  })

  it('frees the slot when a request fails or is rejected', async () => {
    const signMessage = jest
      .fn<Handlers['signMessage']>()
      .mockRejectedValueOnce(new BridgeError('UserRejected'))
      .mockResolvedValueOnce({signature: '0xok'})
    const {post, sent} = setup({handlers: {signMessage}})
    await post(req('1', 'signMessage', {message: 'one'}))
    await post(req('2', 'signMessage', {message: 'two'}))
    expect(sent[0].message).toEqual({
      krao: 1,
      id: '1',
      error: {code: 'UserRejected'},
    })
    expect(sent[1].message).toMatchObject({
      id: '2',
      result: {signature: '0xok'},
    })
  })

  it('hides the text of unexpected errors from the Mini App', async () => {
    const {post, sent} = setup({
      handlers: {
        getContext: jest.fn(() =>
          Promise.reject(new Error('secret internal detail at /home/x')),
        ),
      },
    })
    await post(req('1', 'getContext'))
    expect(sent[0].message.error).toEqual({code: 'Failed'})
  })

  it('passes along the message of a BridgeError', async () => {
    const {post, sent} = setup({
      handlers: {
        requestWallet: jest.fn(() =>
          Promise.reject(
            new BridgeError('Failed', 'No wallet is linked to this account'),
          ),
        ),
      },
    })
    await post(req('1', 'requestWallet'))
    expect(sent[0].message.error).toEqual({
      code: 'Failed',
      message: 'No wallet is linked to this account',
    })
  })

  it('reads the permissions and approval at each request', async () => {
    const {post, sent, permissions, state} = setup({permissions: []})
    await post(req('1', 'getContext'))
    permissions.add('identity')
    await post(req('2', 'getContext'))
    state.approved = false
    await post(req('3', 'getContext'))
    expect(
      sent.map(s =>
        'error' in s.message ? (s.message.error as {code: string}).code : 'ok',
      ),
    ).toEqual(['PermissionDenied', 'ok', 'NotApproved'])
  })

  it('stops answering after dispose', async () => {
    const {bridge, post, sent, handlers} = setup()
    bridge.dispose()
    await post(req('1', 'getContext'))
    expect(sent).toEqual([])
    expect(handlers.getContext).not.toHaveBeenCalled()
  })

  it('does not answer a request finished after dispose', async () => {
    let release: (v: unknown) => void = () => {}
    const {bridge, post, sent} = setup({
      handlers: {getContext: jest.fn(() => new Promise(r => (release = r)))},
    })
    const pending = post(req('1', 'getContext'))
    bridge.dispose()
    release({})
    await pending
    expect(sent).toEqual([])
  })
})
