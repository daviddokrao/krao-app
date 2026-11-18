import {useInfiniteQuery, useMutation, useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useSession} from '#/state/session'
import {KRAO_GATE_URL} from '#/env'
import {net} from '#/lexicons'
import {ServiceError, serviceFetch} from '../api'
import {useGateAuth} from '../queries'

/*
 * net.krao.gate.moderation.*: moderators read the gated content of a post
 * (a report may be about something behind a gate). The gate service lets
 * only the moderators it trusts in, logs every read and answers anyone else
 * with 403.
 */

export type ModeratedContent = {
  uri: string
  text?: string
  media?: {
    url: string
    mimeType: string
    alt?: string
    aspectRatio?: {width: number; height: number}
  }[]
}

export type AccessLogEntry = {
  id: number
  moderator: string
  uri: string
  reason?: string
  accessedAt: string
}

type AccessLogPage = {entries: AccessLogEntry[]; cursor?: string}

const LOG_METHOD = net.krao.gate.moderation.listAccessLog.$lxm
const CONTENT_METHOD = net.krao.gate.moderation.getContent.$lxm

/**
 * Whether the viewer is a gate moderator: asks for one log entry; a 403 (or
 * 401) means no. `undefined` while loading or when the service is down.
 */
export function useIsGateModeratorQuery() {
  const {currentAccount} = useSession()
  const getToken = useGateAuth()
  return useQuery({
    enabled: !!currentAccount,
    staleTime: STALE.MINUTES.FIVE,
    retry: false,
    queryKey: createQueryKey('gate-moderator', {
      did: currentAccount?.did ?? '',
    }),
    queryFn: async () => {
      try {
        await serviceFetch<AccessLogPage>(KRAO_GATE_URL, LOG_METHOD, {
          params: {limit: '1'},
          token: await getToken(LOG_METHOD),
        })
        return true
      } catch (err) {
        if (err instanceof ServiceError && [401, 403].includes(err.status)) {
          return false
        }
        throw err
      }
    },
  })
}

/** Reads a post's gated content; the reason goes in the access log */
export function useModerationContentMutation() {
  const getToken = useGateAuth()
  return useMutation({
    mutationFn: async ({uri, reason}: {uri: string; reason: string}) =>
      serviceFetch<ModeratedContent>(KRAO_GATE_URL, CONTENT_METHOD, {
        params: {uri, reason},
        token: await getToken(CONTENT_METHOD),
      }),
  })
}

export const accessLogKey = () => createQueryKey('gate-access-log', {})

export function useAccessLogQuery({enabled}: {enabled: boolean}) {
  const getToken = useGateAuth()
  return useInfiniteQuery({
    enabled,
    staleTime: STALE.SECONDS.THIRTY,
    queryKey: accessLogKey(),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({pageParam}): Promise<AccessLogPage> =>
      serviceFetch<AccessLogPage>(KRAO_GATE_URL, LOG_METHOD, {
        params: {limit: '25', ...(pageParam ? {cursor: pageParam} : {})},
        token: await getToken(LOG_METHOD),
      }),
    getNextPageParam: (page: AccessLogPage) => page.cursor,
  })
}
