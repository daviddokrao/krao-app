import {toDatetimeString} from '@atproto/syntax'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {usePdsClient, useSession} from '#/state/session'
import {KRAO_GATE_DID, KRAO_GATE_URL} from '#/env'
import {com, io} from '#/lexicons'

export type TokenBalanceCondition = {
  $type: 'io.krao.gate.defs#tokenBalance'
  asset: string
  minAmount: string
}
export type NftHoldingCondition = {
  $type: 'io.krao.gate.defs#nftHolding'
  chain: string
  contract: string
  tokenId?: string
}
export type GateCondition = TokenBalanceCondition | NftHoldingCondition

export type GateRule = {
  uri: string
  subject: string
  conditions: GateCondition[]
  match: 'all' | 'any'
  service: string
  hasContent?: boolean
}

export class GateError extends Error {
  constructor(
    public error: string | undefined,
    message: string,
  ) {
    super(message)
  }
}

async function gateFetch<T>(
  method: string,
  {
    params,
    body,
    token,
  }: {params?: Record<string, string>; body?: unknown; token?: string},
): Promise<T> {
  const url = new URL(`/xrpc/${method}`, KRAO_GATE_URL)
  for (const [k, v] of Object.entries(params ?? {})) {
    url.searchParams.append(k, v)
  }
  const res = await fetch(url.toString(), {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(body ? {'content-type': 'application/json'} : {}),
      ...(token ? {authorization: `Bearer ${token}`} : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    message?: string
  }
  if (!res.ok) {
    throw new GateError(data.error, data.message ?? `${method} failed`)
  }
  return data as T
}

/**
 * A short-lived token from the user's PDS proving who they are to the gate
 * service, scoped to one method.
 */
function useServiceAuth() {
  const pdsClient = usePdsClient()
  return async (lxm: string) => {
    const {token} = await pdsClient.call(com.atproto.server.getServiceAuth, {
      aud: KRAO_GATE_DID,
      lxm: lxm as `${string}.${string}.${string}`,
    })
    return token
  }
}

const gateRuleQueryKey = (uri: string) => createQueryKey('gate-rule', {uri})

/** The token gate on a post, if any */
export function useGateRuleQuery(uri: string) {
  return useQuery({
    staleTime: STALE.MINUTES.ONE,
    queryKey: gateRuleQueryKey(uri),
    queryFn: async () => {
      const {rules} = await gateFetch<{rules: GateRule[]}>(
        'io.krao.gate.getRules',
        {params: {uris: uri}},
      )
      return rules.find(r => r.subject === uri) ?? null
    },
  })
}

const gatedContentQueryKey = (uri: string, viewer: string) =>
  createQueryKey('gated-content', {uri, viewer})

/**
 * The gated part of a post. Fails with GateError 'NotEligible' when the
 * viewer's linked wallets don't meet the gate.
 */
export function useGatedContentQuery(uri: string, enabled: boolean) {
  const {currentAccount} = useSession()
  const getToken = useServiceAuth()
  return useQuery({
    enabled: enabled && !!currentAccount,
    staleTime: STALE.SECONDS.THIRTY,
    retry: false,
    queryKey: gatedContentQueryKey(uri, currentAccount?.did ?? ''),
    queryFn: async () =>
      gateFetch<{uri: string; text?: string}>('io.krao.gate.getContent', {
        params: {uri},
        token: await getToken(io.krao.gate.getContent.$lxm),
      }),
  })
}

/**
 * Attach token-gated text to one of the user's posts: store the text on the
 * gate service first, then publish the public io.krao.gate.rule record.
 */
export function useCreateGateMutation() {
  const {currentAccount} = useSession()
  const pdsClient = usePdsClient()
  const queryClient = useQueryClient()
  const getToken = useServiceAuth()
  return useMutation({
    mutationFn: async ({
      post,
      text,
      condition,
    }: {
      post: {uri: string; cid: string}
      text: string
      condition: GateCondition
    }) => {
      if (!currentAccount) throw new Error('Not signed in')
      await gateFetch('io.krao.gate.putContent', {
        token: await getToken(io.krao.gate.putContent.$lxm),
        body: {uri: post.uri, text},
      })
      await pdsClient.create(io.krao.gate.rule, {
        subject: post as never,
        conditions: [condition] as never,
        match: 'all',
        service: KRAO_GATE_DID as `did:${string}:${string}`,
        createdAt: toDatetimeString(new Date()),
      })
    },
    onSuccess: (_data, {post}) => {
      for (const delay of [1000, 3000]) {
        setTimeout(() => {
          void queryClient.invalidateQueries({
            queryKey: gateRuleQueryKey(post.uri),
          })
        }, delay)
      }
    },
  })
}
