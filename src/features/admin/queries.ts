import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useSession} from '#/state/session'
import {RewardsError, rewardsFetch} from '#/features/referral/api'
import {useRewardsAuth} from '#/features/referral/queries'
import {
  type AdminRole,
  type AuditEntry,
  auditParams,
  type AuditService,
  normalizeRoles,
  type RoleMember,
} from './logic'

/*
 * net.krao.admin.*: the roles of Krao's admin area and its shared log. The
 * rewards service checks the caller's role on every call.
 */

const ADMIN = 'net.krao.admin'
const ROOT = 'krao-admin'

/** The service says no to anyone without the role */
export function isForbidden(error: unknown): boolean {
  return (
    error instanceof RewardsError &&
    (error.status === 401 || error.status === 403)
  )
}

function useAdminCall() {
  const getToken = useRewardsAuth()
  return async <T>(
    method: string,
    opts: {params?: Record<string, string>; body?: unknown} = {},
  ) => rewardsFetch<T>(method, {...opts, token: await getToken(method)})
}

/**
 * The viewer's roles; empty for everyone else, and also when the service
 * cannot be asked (no entry point is better than a broken one).
 */
export function useMyRolesQuery() {
  const {currentAccount} = useSession()
  const call = useAdminCall()
  return useQuery({
    enabled: !!currentAccount,
    staleTime: STALE.MINUTES.ONE,
    retry: false,
    queryKey: createQueryKey(ROOT, {
      kind: 'my-roles',
      did: currentAccount?.did ?? '',
    }),
    queryFn: async () => {
      try {
        const res = await call<{roles?: unknown}>(`${ADMIN}.getMyRoles`)
        return normalizeRoles(res.roles)
      } catch {
        return []
      }
    },
  })
}

export function useRolesListQuery() {
  const {currentAccount} = useSession()
  const call = useAdminCall()
  return useQuery({
    enabled: !!currentAccount,
    staleTime: STALE.SECONDS.FIFTEEN,
    retry: false,
    queryKey: createQueryKey(ROOT, {
      kind: 'members',
      did: currentAccount?.did ?? '',
    }),
    queryFn: async () =>
      (await call<{members: RoleMember[]}>(`${ADMIN}.listRoles`)).members,
  })
}

/** Grants or withdraws a role; the lists and the viewer's roles are redone */
export function useSetRoleMutation() {
  const call = useAdminCall()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {did: string; role: AdminRole; enabled: boolean}) =>
      call<unknown>(`${ADMIN}.setRole`, {body: input}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({queryKey: [ROOT]})
    },
  })
}

type AuditPage = {entries: AuditEntry[]; cursor?: string}

/** The shared log, newest first, in pages of 50 */
export function useAuditLogQuery(filter: {
  service?: AuditService
  actor?: string
}) {
  const {currentAccount} = useSession()
  const call = useAdminCall()
  return useInfiniteQuery({
    enabled: !!currentAccount,
    staleTime: STALE.SECONDS.FIFTEEN,
    retry: false,
    queryKey: createQueryKey(ROOT, {
      kind: 'audit',
      did: currentAccount?.did ?? '',
      service: filter.service ?? '',
      actor: filter.actor ?? '',
    }),
    initialPageParam: undefined as string | undefined,
    queryFn: ({pageParam}) =>
      call<AuditPage>(`${ADMIN}.getAuditLog`, {
        params: auditParams({...filter, cursor: pageParam}),
      }),
    getNextPageParam: page => page.cursor,
    select: data => data.pages.flatMap(page => page.entries),
  })
}
