import {type Client} from '@atproto/lex'
import {afterEach, describe, expect, it, jest} from '@jest/globals'

import {pushLanguageTag, setPushLanguage} from '../language'

describe('pushLanguageTag', () => {
  it('passes plausible BCP-47 tags through', () => {
    expect(pushLanguageTag('vi')).toBe('vi')
    expect(pushLanguageTag('en')).toBe('en')
    expect(pushLanguageTag('pt-BR')).toBe('pt-BR')
    expect(pushLanguageTag('zh-Hans-CN')).toBe('zh-Hans-CN')
  })

  it('normalises underscores', () => {
    expect(pushLanguageTag('pt_BR')).toBe('pt-BR')
  })

  it('falls back to English for anything else', () => {
    expect(pushLanguageTag(undefined)).toBe('en')
    expect(pushLanguageTag('')).toBe('en')
    expect(pushLanguageTag('not a tag')).toBe('en')
    expect(pushLanguageTag('x'.repeat(40))).toBe('en')
  })
})

describe('setPushLanguage', () => {
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  const pdsClient = () => {
    const call = jest.fn<() => Promise<{token: string}>>(() =>
      Promise.resolve({token: 'service-token'}),
    )
    return {call, client: {call} as unknown as Client}
  }

  it('asks the PDS for a rewards service token, then posts the language', async () => {
    const {call, client} = pdsClient()
    const fetchMock = jest.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify({language: 'vi'}), {status: 200}),
      ),
    )
    globalThis.fetch = fetchMock

    await setPushLanguage(client, 'vi')

    expect(call).toHaveBeenCalledTimes(1)
    const [, params] = call.mock.calls[0] as unknown as [
      unknown,
      {aud: string; lxm: string},
    ]
    expect(params.lxm).toBe('net.krao.push.setLanguage')
    expect(params.aud).toMatch(/^did:web:/)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url as string).toContain('/xrpc/net.krao.push.setLanguage')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>).authorization).toBe(
      'Bearer service-token',
    )
    expect(JSON.parse(init?.body as string)).toEqual({language: 'vi'})
  })

  it('rejects when the service refuses', async () => {
    const {client} = pdsClient()
    globalThis.fetch = jest.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify({error: 'AuthRequired'}), {status: 401}),
      ),
    )
    await expect(setPushLanguage(client, 'en')).rejects.toThrow()
  })
})
