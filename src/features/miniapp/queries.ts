import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useSession} from '#/state/session'
import {KRAO_GATE_DID} from '#/env'
import {IndexerError} from '#/features/community/api'
import {useRewardsAuth} from '#/features/referral/queries'
import {
  ADMIN_APPROVE,
  ADMIN_LIST_PENDING,
  ADMIN_REVOKE,
  approveRequest,
  getAppRequest,
  INSPECT_SIGNATURE,
  inspectSignatureRequest,
  listApprovedRequest,
  listPendingRequest,
  revokeRequest,
  SIMULATE,
  simulateRequest,
} from './api'
import {type MiniAppView} from './logic'
import {type PreviewRequest} from './preview'

const APP_ROOT = 'krao-miniapp'
const APPROVED_ROOT = 'krao-miniapps-approved'
const PENDING_ROOT = 'krao-miniapps-pending'

/** A token for the indexer, scoped to one method */
export function useIndexerAuth() {
  const getToken = useRewardsAuth()
  return (lxm: string) => getToken(lxm, KRAO_GATE_DID)
}

/**
 * One Mini App by its record uri. `fresh` always asks the indexer again: the
 * runner must not start an app on a status that was true a minute ago.
 */
export function useMiniAppQuery(
  uri: string | undefined,
  {fresh = false}: {fresh?: boolean} = {},
) {
  return useQuery({
    enabled: !!uri,
    staleTime: fresh ? 0 : STALE.MINUTES.ONE,
    gcTime: fresh ? 0 : undefined,
    refetchOnMount: fresh ? 'always' : true,
    retry: (count, err) =>
      !(err instanceof IndexerError && err.status < 500) && count < 2,
    queryKey: createQueryKey(APP_ROOT, {uri: uri ?? '', fresh}),
    queryFn: () => getAppRequest(uri!),
  })
}

/** Approved Mini Apps, newest approval first, in pages of 25 */
export function useApprovedAppsQuery({enabled = true} = {}) {
  return useInfiniteQuery({
    enabled,
    staleTime: STALE.MINUTES.ONE,
    queryKey: createQueryKey(APPROVED_ROOT, {}),
    initialPageParam: undefined as string | undefined,
    queryFn: ({pageParam}) => listApprovedRequest(25, pageParam),
    getNextPageParam: page => page.cursor,
  })
}

/** Why a simulation could not be had: never a reason to block the user */
export function useSimulationQuery(request: PreviewRequest) {
  const getToken = useIndexerAuth()
  const {currentAccount} = useSession()
  return useQuery({
    enabled: !!currentAccount,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    queryKey: createQueryKey('krao-simulation', {
      request: JSON.stringify(request),
    }),
    queryFn: async () => {
      if (request.kind === 'transaction') {
        return simulateRequest(await getToken(SIMULATE), {
          chain: request.chain,
          from: request.from,
          to: request.to,
          data: request.data,
          value: request.value,
          origin: request.origin,
        })
      }
      return inspectSignatureRequest(await getToken(INSPECT_SIGNATURE), {
        chain: request.chain,
        from: request.from,
        method: request.method,
        payload: request.payload,
        origin: request.origin,
      })
    },
  })
}

/** Pending Mini Apps for the safety admins; the indexer says no to anyone else */
export function usePendingAppsQuery({enabled = true} = {}) {
  const getToken = useIndexerAuth()
  const {currentAccount} = useSession()
  return useInfiniteQuery({
    enabled: !!currentAccount && enabled,
    staleTime: STALE.SECONDS.THIRTY,
    retry: false,
    queryKey: createQueryKey(PENDING_ROOT, {did: currentAccount?.did ?? ''}),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({pageParam}) =>
      listPendingRequest(await getToken(ADMIN_LIST_PENDING), pageParam),
    getNextPageParam: page => page.cursor,
  })
}

/** The indexer refuses accounts that are not safety admins */
export function isForbidden(error: unknown): boolean {
  return (
    error instanceof IndexerError &&
    (error.status === 401 || error.status === 403)
  )
}

function useInvalidateApps() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({queryKey: [PENDING_ROOT]})
    void queryClient.invalidateQueries({queryKey: [APPROVED_ROOT]})
    void queryClient.invalidateQueries({queryKey: [APP_ROOT]})
  }
}

/** Approve exactly the version (cid) the admin looked at */
export function useApproveAppMutation() {
  const getToken = useIndexerAuth()
  const invalidate = useInvalidateApps()
  return useMutation({
    mutationFn: async (app: Pick<MiniAppView, 'uri' | 'cid'>) =>
      approveRequest(await getToken(ADMIN_APPROVE), {
        uri: app.uri,
        cid: app.cid,
      }),
    onSettled: invalidate,
  })
}

export function useRevokeAppMutation() {
  const getToken = useIndexerAuth()
  const invalidate = useInvalidateApps()
  return useMutation({
    mutationFn: async (app: {uri: string; reason?: string}) =>
      revokeRequest(await getToken(ADMIN_REVOKE), app),
    onSettled: invalidate,
  })
}
