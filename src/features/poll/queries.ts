import {AtUri, toDatetimeString} from '@atproto/syntax'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {createBatchLoader} from '#/lib/batchLoader'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {usePdsClient, useSession} from '#/state/session'
import {KRAO_GATE_DID} from '#/env'
import {indexerFetch} from '#/features/community/api'
import {useRewardsAuth} from '#/features/referral/queries'
import {com, net} from '#/lexicons'

export type PollView = net.krao.poll.defs.PollView

const pollKey = (post: string, viewer: string) =>
  createQueryKey('krao-poll', {post, viewer})

type TokenGetter = (lxm: string, aud?: string) => Promise<string>

/*
 * Polls asked for together (the posts of a feed page) share one request. The
 * loader is per viewer, because the response carries the viewer's own vote.
 */
const authByViewer = new Map<string, TokenGetter>()
const loaders = new Map<string, ReturnType<typeof createPollLoader>>()

function createPollLoader(viewer: string) {
  return createBatchLoader<string, PollView>({
    maxBatchSize: 25,
    load: async posts => {
      const method = net.krao.poll.getPolls.$lxm
      const getToken = authByViewer.get(viewer)
      const {polls} = await indexerFetch<{polls: PollView[]}>(method, {
        params: {posts},
        token:
          viewer && getToken
            ? await getToken(method, KRAO_GATE_DID)
            : undefined,
      })
      return new Map(polls.map(p => [p.post, p]))
    },
  })
}

/** The poll attached to a post, if it has one */
export function usePollQuery(post: string) {
  const {currentAccount} = useSession()
  const getToken = useRewardsAuth()
  const viewer = currentAccount?.did ?? ''
  return useQuery({
    staleTime: STALE.SECONDS.THIRTY,
    queryKey: pollKey(post, viewer),
    queryFn: async () => {
      authByViewer.set(viewer, getToken)
      let loader = loaders.get(viewer)
      if (!loader) {
        loader = createPollLoader(viewer)
        loaders.set(viewer, loader)
      }
      return (await loader(post)) ?? null
    },
  })
}

/**
 * Casts the viewer's vote: a net.krao.poll.vote record in their repo. A vote
 * is final; the indexer counts only the first one of an account.
 */
export function useVoteMutation() {
  const {currentAccount} = useSession()
  const pdsClient = usePdsClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      poll,
      option,
      fallbackCid,
    }: {
      poll: PollView
      option: number
      /** The post's cid, used if the poll record's cid cannot be read */
      fallbackCid?: string
    }) => {
      const parsed = new AtUri(poll.uri)
      let cid = fallbackCid
      try {
        const record = await pdsClient.call(com.atproto.repo.getRecord, {
          repo: parsed.host,
          collection: 'net.krao.poll.poll',
          rkey: parsed.rkey,
        })
        cid = record.cid ?? cid
      } catch {
        // The indexer matches votes by the poll's uri, not its cid
      }
      if (!cid) throw new Error('Could not find the poll')
      const res = await pdsClient.create(net.krao.poll.vote, {
        poll: {uri: poll.uri, cid},
        option,
        createdAt: toDatetimeString(new Date()),
      })
      return res.uri
    },
    onSuccess: (voteUri, {poll, option}) => {
      if (!currentAccount) return
      const key = pollKey(poll.post, currentAccount.did)
      // Until the indexer has read the vote, it shows as being counted
      queryClient.setQueryData<PollView | null>(key, old =>
        old ? {...old, viewer: {uri: voteUri, option, status: 'pending'}} : old,
      )
      for (const delay of [1500, 4000, 10000]) {
        setTimeout(() => {
          void queryClient.invalidateQueries({queryKey: key})
        }, delay)
      }
    },
  })
}
