import {AtUri, toDatetimeString} from '@atproto/syntax'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {createBatchLoader} from '#/lib/batchLoader'
import {compressIfNeeded} from '#/lib/media/manip'
import {type PickerImage} from '#/lib/media/picker.shared'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {usePdsClient, useSession} from '#/state/session'
import {KRAO_GATE_DID, KRAO_GATE_URL} from '#/env'
import {com, net} from '#/lexicons'

export type TokenBalanceCondition = {
  $type: 'net.krao.gate.defs#tokenBalance'
  asset: string
  minAmount: string
}
export type NftHoldingCondition = {
  $type: 'net.krao.gate.defs#nftHolding'
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

/** Gated media as getContent returns it: a signed URL valid for minutes */
export type GatedMedia = {
  url: string
  mimeType: string
  alt?: string
  aspectRatio?: {width: number; height: number}
}

export type GatedContent = {
  uri: string
  text?: string
  media?: GatedMedia[]
}

/** The gate service's limits, see net.krao.gate.uploadMedia */
const GATED_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const GATED_VIDEO_MAX_BYTES = 50 * 1024 * 1024
/** Most images and videos one post's gated content can hold */
export const GATED_IMAGES_MAX = 4

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
  }: {
    params?: Record<string, string | string[]>
    body?: unknown
    token?: string
  },
): Promise<T> {
  const url = new URL(`/xrpc/${method}`, KRAO_GATE_URL)
  for (const [k, v] of Object.entries(params ?? {})) {
    for (const item of [v].flat()) url.searchParams.append(k, item)
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
 * Uploads an image or video to the gate service. It is stored there only,
 * never as a blob in the user's public repo. Images are compressed to fit;
 * videos (MP4 or WebM) are sent as they are.
 */
async function uploadGatedMedia(media: PickerImage, token: string) {
  const isVideo = media.mime.startsWith('video/')
  if (isVideo && media.size > GATED_VIDEO_MAX_BYTES) {
    throw new GateError(undefined, 'Gated videos can be at most 50 MB')
  }
  const compressed = isVideo
    ? media
    : await compressIfNeeded(media, {
        maxDimension: 2000,
        maxSize: GATED_IMAGE_MAX_BYTES - 64 * 1024,
      })
  const blob = await (await fetch(compressed.path)).blob()
  const res = await fetch(
    new URL('/xrpc/net.krao.gate.uploadMedia', KRAO_GATE_URL).toString(),
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': compressed.mime,
      },
      body: blob,
    },
  )
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    message?: string
    media?: GatedMedia
  }
  if (!res.ok || !data.media) {
    throw new GateError(data.error, data.message ?? 'Upload failed')
  }
  return {
    ...data.media,
    ...(compressed.width && compressed.height
      ? {aspectRatio: {width: compressed.width, height: compressed.height}}
      : {}),
  }
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

/** Rule lookups made together (eg for a page of feed posts) share a request */
const loadGateRule = createBatchLoader<string, GateRule>({
  maxBatchSize: 25,
  load: async uris => {
    const {rules} = await gateFetch<{rules: GateRule[]}>(
      'net.krao.gate.getRules',
      {params: {uris}},
    )
    return new Map(rules.map(r => [r.subject, r]))
  },
})

/** The token gate on a post, if any */
export function useGateRuleQuery(uri: string) {
  return useQuery({
    staleTime: STALE.MINUTES.ONE,
    queryKey: gateRuleQueryKey(uri),
    queryFn: async () => (await loadGateRule(uri)) ?? null,
  })
}

/**
 * Remove the token gate from one of the user's posts by deleting its rule
 * record; the gate service then drops the gated content.
 */
export function useRemoveGateMutation() {
  const {currentAccount} = useSession()
  const pdsClient = usePdsClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ruleUri}: {ruleUri: string; postUri: string}) => {
      if (!currentAccount) throw new Error('Not signed in')
      await pdsClient.delete(net.krao.gate.rule, {
        repo: currentAccount.did,
        rkey: new AtUri(ruleUri).rkey,
      })
    },
    onSuccess: (_data, {postUri}) => {
      // The indexer drops the rule a moment after the record is deleted
      queryClient.setQueryData(gateRuleQueryKey(postUri), null)
      setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: gateRuleQueryKey(postUri),
        })
      }, 2000)
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
      gateFetch<GatedContent>('net.krao.gate.getContent', {
        params: {uri},
        token: await getToken(net.krao.gate.getContent.$lxm),
      }),
  })
}

/**
 * Attach token-gated text and images to one of the user's posts: store them
 * on the gate service first, then publish the public net.krao.gate.rule
 * record. With `replaceRuleUri`, the post's existing gate is replaced: its
 * content is overwritten and its rule record rewritten in place.
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
      images = [],
      alts = {},
      condition,
      replaceRuleUri,
    }: {
      post: {uri: string; cid: string}
      text: string
      images?: PickerImage[]
      /** Alt text by image path */
      alts?: Record<string, string>
      condition: GateCondition
      replaceRuleUri?: string
    }) => {
      if (!currentAccount) throw new Error('Not signed in')
      const media: GatedMedia[] = []
      for (const image of images) {
        const uploaded = await uploadGatedMedia(
          image,
          await getToken('net.krao.gate.uploadMedia'),
        )
        const alt = alts[image.path]?.trim()
        media.push(alt ? {...uploaded, alt} : uploaded)
      }
      await gateFetch('net.krao.gate.putContent', {
        token: await getToken(net.krao.gate.putContent.$lxm),
        body: {uri: post.uri, text, media: media.length ? media : undefined},
      })
      const rule = {
        subject: post as never,
        conditions: [condition] as never,
        match: 'all',
        service: KRAO_GATE_DID as `did:${string}:${string}`,
        createdAt: toDatetimeString(new Date()),
      }
      if (replaceRuleUri) {
        await pdsClient.put(net.krao.gate.rule, rule, {
          repo: currentAccount.did,
          rkey: new AtUri(replaceRuleUri).rkey,
        })
      } else {
        await pdsClient.create(net.krao.gate.rule, rule)
      }
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
