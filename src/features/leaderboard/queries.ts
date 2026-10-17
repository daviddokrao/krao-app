import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useSession} from '#/state/session'
import {useRewardsAuth} from '../referral/queries'
import {
  GET_LEADERBOARD,
  getLeaderboard,
  type Leaderboard,
  SET_LEADERBOARD_OPT_IN,
  setLeaderboardOptIn,
} from './api'

const leaderboardQueryKeyRoot = 'leaderboard'
const createLeaderboardQueryKey = (did: string) =>
  createQueryKey(leaderboardQueryKeyRoot, {did})

/** This week's leaderboard and where the viewer stands */
export function useLeaderboardQuery() {
  const {currentAccount} = useSession()
  const getToken = useRewardsAuth()
  return useQuery({
    enabled: !!currentAccount,
    staleTime: STALE.MINUTES.ONE,
    queryKey: createLeaderboardQueryKey(currentAccount?.did ?? ''),
    queryFn: async () => getLeaderboard(await getToken(GET_LEADERBOARD)),
  })
}

/** Shows or hides the viewer on the leaderboard */
export function useLeaderboardOptInMutation() {
  const {currentAccount} = useSession()
  const queryClient = useQueryClient()
  const getToken = useRewardsAuth()
  const queryKey = createLeaderboardQueryKey(currentAccount?.did ?? '')
  return useMutation({
    mutationFn: async (optIn: boolean) =>
      setLeaderboardOptIn(await getToken(SET_LEADERBOARD_OPT_IN), optIn),
    onSuccess: ({optIn}) => {
      // Show the new choice at once; the refetch brings the rank
      queryClient.setQueryData<Leaderboard>(queryKey, old =>
        old
          ? {...old, viewer: {points: 0, ...old.viewer, optedIn: optIn}}
          : old,
      )
    },
    onSettled: () => queryClient.invalidateQueries({queryKey}),
  })
}
