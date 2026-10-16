import {useInfiniteQuery, useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useAppviewClient} from '#/state/session'
import {indexerFetch} from '#/features/community/api'
import {hydratePosts} from '#/features/community/queries'
import {normalizeSymbol, type PricePoint} from './logic'

/*
 * The token methods are not in the vendored lexicons yet, so the shapes are
 * typed here. They are public reads: no auth.
 */

export type TokenView = {
  /** CAIP-19 asset id */
  id: string
  symbol: string
  name: string
  decimals: number
  chain: string
  address: string
  logo?: string
  /** Decimal string */
  priceUsd?: string
  /** Decimal string, in percent */
  change24h?: string
  updatedAt?: string
}

export type PriceRange = '1d' | '7d' | '30d'

const LIST_TOKENS = 'net.krao.token.listTokens'
const GET_TOKEN = 'net.krao.token.getToken'
const GET_PRICE_HISTORY = 'net.krao.token.getPriceHistory'
const GET_FEED = 'net.krao.token.getFeed'

const TOKEN_KEY_ROOT = 'krao-token'

/** The approved tokens: the only symbols that become links */
export function useTokenCatalogQuery({enabled = true} = {}) {
  return useQuery({
    enabled,
    staleTime: STALE.MINUTES.FIVE,
    queryKey: createQueryKey(TOKEN_KEY_ROOT, {kind: 'catalog'}),
    queryFn: async () => {
      const res = await indexerFetch<{tokens: TokenView[]}>(LIST_TOKENS)
      return res.tokens
    },
    select: tokens =>
      new Map(tokens.map(token => [normalizeSymbol(token.symbol), token])),
    retry: false,
  })
}

/** A token, with a price that is fresher than the catalog's */
export function useTokenQuery(symbol: string) {
  return useQuery({
    staleTime: STALE.MINUTES.ONE,
    queryKey: createQueryKey(TOKEN_KEY_ROOT, {
      kind: 'one',
      symbol: normalizeSymbol(symbol),
    }),
    queryFn: async () => {
      const res = await indexerFetch<{token: TokenView}>(GET_TOKEN, {
        params: {symbol: normalizeSymbol(symbol)},
      })
      return res.token
    },
  })
}

export function usePriceHistoryQuery(symbol: string, range: PriceRange) {
  return useQuery({
    staleTime: STALE.MINUTES.FIVE,
    queryKey: createQueryKey(TOKEN_KEY_ROOT, {
      kind: 'history',
      symbol: normalizeSymbol(symbol),
      range,
    }),
    queryFn: async () => {
      const res = await indexerFetch<{points: PricePoint[]}>(
        GET_PRICE_HISTORY,
        {params: {symbol: normalizeSymbol(symbol), range}},
      )
      return res.points
    },
  })
}

/** Posts that mention the cashtag: the indexer lists them, the appview hydrates */
export function useTokenFeedQuery(symbol: string) {
  const client = useAppviewClient()
  return useInfiniteQuery({
    staleTime: STALE.SECONDS.THIRTY,
    queryKey: createQueryKey(TOKEN_KEY_ROOT, {
      kind: 'feed',
      symbol: normalizeSymbol(symbol),
    }),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({pageParam}) => {
      const res = await indexerFetch<{
        feed: {post: string}[]
        cursor?: string
      }>(GET_FEED, {
        params: {
          symbol: normalizeSymbol(symbol),
          limit: 30,
          cursor: pageParam,
        },
      })
      return {
        posts: await hydratePosts(
          client,
          res.feed.map(item => item.post),
        ),
        cursor: res.cursor,
      }
    },
    getNextPageParam: page => page.cursor,
  })
}
