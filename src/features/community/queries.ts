import {type Client} from '@atproto/lex'
import {
  AtUri,
  type AtUriString,
  type DidString,
  toDatetimeString,
} from '@atproto/syntax'
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {logger} from '#/logger'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useAppviewClient, usePdsClient, useSession} from '#/state/session'
import {KRAO_GATE_DID} from '#/env'
import {useRewardsAuth} from '#/features/referral/queries'
import {app, com, net} from '#/lexicons'
import {indexerFetch} from './api'
import {
  buildAccess,
  buildCommunityFeedRecord,
  type CommunityDraft,
  communityFeedRkey,
  makeCommunityUri,
  parseRules,
} from './logic'

export type CommunityView = net.krao.community.defs.CommunityView & {
  /** The community's feed (a generator at-uri), once the indexer has seen the generator */
  feed?: string
  /** Set on a single community: the service its feed generator has to name */
  feedGeneratorDid?: string
}
export type MemberView = net.krao.community.defs.MemberView & {
  /** Filled in from the appview, one request per 25 members */
  profile?: app.bsky.actor.defs.ProfileViewDetailed
}

const COMMUNITY_KEY_ROOT = 'krao-community'

/** A token for the indexer, scoped to one method */
function useIndexerAuth() {
  const getToken = useRewardsAuth()
  return (lxm: string) => getToken(lxm, KRAO_GATE_DID)
}

const nextCursor = (page: {cursor?: string}) => page.cursor

/** One community, with the viewer's place in it when signed in */
export function useCommunityQuery(uri: string | undefined) {
  const {currentAccount} = useSession()
  const getToken = useIndexerAuth()
  return useQuery({
    enabled: !!uri,
    staleTime: STALE.SECONDS.THIRTY,
    queryKey: createQueryKey(COMMUNITY_KEY_ROOT, {
      kind: 'one',
      uri: uri ?? '',
      viewer: currentAccount?.did ?? '',
    }),
    queryFn: async () => {
      const method = net.krao.community.getCommunity.$lxm
      const res = await indexerFetch<{
        community: CommunityView
        feedGeneratorDid?: string
      }>(method, {
        params: {uri},
        token: currentAccount ? await getToken(method) : undefined,
      })
      return {...res.community, feedGeneratorDid: res.feedGeneratorDid}
    },
    /*
     * A community opened right after it was created may not be indexed yet,
     * so give the indexer a few seconds before showing "doesn't exist"
     */
    retry: (count, error) =>
      (error as {error?: string})?.error === 'NotFound' && count < 5,
    retryDelay: 1000,
  })
}

/** Discover: all communities, searchable, by popularity or newest first */
export function useCommunitiesQuery({
  query,
  sort,
}: {
  query: string
  sort: 'popular' | 'new'
}) {
  return useInfiniteQuery({
    staleTime: STALE.SECONDS.THIRTY,
    queryKey: createQueryKey(COMMUNITY_KEY_ROOT, {kind: 'list', query, sort}),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({pageParam}) =>
      indexerFetch<{communities: CommunityView[]; cursor?: string}>(
        net.krao.community.listCommunities.$lxm,
        {
          params: {
            query: query.trim() || undefined,
            sort,
            limit: 25,
            cursor: pageParam,
          },
        },
      ),
    getNextPageParam: nextCursor,
  })
}

/** Communities the viewer owns or has joined */
export function useMyCommunitiesQuery() {
  const {currentAccount} = useSession()
  const getToken = useIndexerAuth()
  return useInfiniteQuery({
    enabled: !!currentAccount,
    staleTime: STALE.SECONDS.THIRTY,
    queryKey: createQueryKey(COMMUNITY_KEY_ROOT, {
      kind: 'mine',
      viewer: currentAccount?.did ?? '',
    }),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({pageParam}) => {
      const method = net.krao.community.listMyCommunities.$lxm
      return indexerFetch<{communities: CommunityView[]; cursor?: string}>(
        method,
        {
          params: {limit: 50, cursor: pageParam},
          token: await getToken(method),
        },
      )
    },
    getNextPageParam: nextCursor,
  })
}

/** Adds each member's profile, fetched in batches rather than one by one */
async function withProfiles(
  client: Client,
  page: {members: MemberView[]; cursor?: string},
) {
  const dids = page.members.map(m => m.did)
  const byDid = new Map<string, app.bsky.actor.defs.ProfileViewDetailed>()
  for (let i = 0; i < dids.length; i += 25) {
    try {
      const res = await client.call(app.bsky.actor.getProfiles, {
        actors: dids.slice(i, i + 25),
      })
      for (const profile of res.profiles) byDid.set(profile.did, profile)
    } catch {
      // Members without a profile show their DID
    }
  }
  return {
    ...page,
    members: page.members.map(m => ({...m, profile: byDid.get(m.did)})),
  }
}

export function useMembersQuery(uri: string | undefined) {
  const client = useAppviewClient()
  return useInfiniteQuery({
    enabled: !!uri,
    staleTime: STALE.SECONDS.THIRTY,
    queryKey: createQueryKey(COMMUNITY_KEY_ROOT, {
      kind: 'members',
      uri: uri ?? '',
    }),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({pageParam}) =>
      withProfiles(
        client,
        await indexerFetch<{members: MemberView[]; cursor?: string}>(
          net.krao.community.getMembers.$lxm,
          {params: {community: uri, limit: 50, cursor: pageParam}},
        ),
      ),
    getNextPageParam: nextCursor,
  })
}

/** Accounts waiting for approval; the indexer refuses anyone but staff */
export function usePendingMembersQuery(uri: string, enabled: boolean) {
  const {currentAccount} = useSession()
  const client = useAppviewClient()
  const getToken = useIndexerAuth()
  return useInfiniteQuery({
    enabled: enabled && !!currentAccount,
    staleTime: STALE.SECONDS.FIFTEEN,
    queryKey: createQueryKey(COMMUNITY_KEY_ROOT, {
      kind: 'pending',
      uri,
      viewer: currentAccount?.did ?? '',
    }),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({pageParam}) => {
      const method = net.krao.community.getPendingMembers.$lxm
      return withProfiles(
        client,
        await indexerFetch<{members: MemberView[]; cursor?: string}>(method, {
          params: {community: uri, limit: 50, cursor: pageParam},
          token: await getToken(method),
        }),
      )
    },
    getNextPageParam: nextCursor,
    retry: false,
  })
}

/** Posts as the appview returns them, in the order of `uris` */
export async function hydratePosts(client: Client, uris: string[]) {
  const byUri = new Map<string, app.bsky.feed.defs.PostView>()
  for (let i = 0; i < uris.length; i += 25) {
    const res = await client.call(app.bsky.feed.getPosts, {
      uris: uris.slice(i, i + 25) as AtUriString[],
    })
    for (const post of res.posts) byUri.set(post.uri, post)
  }
  return uris.flatMap(uri => byUri.get(uri) ?? [])
}

/**
 * A community's feed: the indexer lists the submitted posts (minus hidden
 * ones) and the appview supplies the posts themselves.
 */
export function useCommunityFeedQuery(uri: string | undefined) {
  const client = useAppviewClient()
  return useInfiniteQuery({
    enabled: !!uri,
    staleTime: STALE.SECONDS.THIRTY,
    queryKey: createQueryKey(COMMUNITY_KEY_ROOT, {
      kind: 'feed',
      uri: uri ?? '',
    }),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({pageParam}) => {
      const res = await indexerFetch<{
        feed: net.krao.community.defs.FeedItem[]
        cursor?: string
      }>(net.krao.community.getFeed.$lxm, {
        params: {community: uri, limit: 30, cursor: pageParam},
      })
      return {
        posts: await hydratePosts(
          client,
          res.feed.map(item => item.post),
        ),
        cursor: res.cursor,
      }
    },
    getNextPageParam: nextCursor,
  })
}

/** Everything about communities is stale once the viewer acts */
function useInvalidateCommunities() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({queryKey: [COMMUNITY_KEY_ROOT]})
}

type Pds = ReturnType<typeof usePdsClient>

const now = () => toDatetimeString(new Date())

/**
 * The records of one collection in the viewer's own repo that satisfy
 * `match`: how a moderator finds the record to delete when undoing an action.
 */
async function findOwnRecords(
  pdsClient: Pds,
  did: string,
  collection: string,
  match: (value: Record<string, unknown>) => boolean,
) {
  const found: string[] = []
  let cursor: string | undefined
  do {
    const page = await pdsClient.call(com.atproto.repo.listRecords, {
      repo: did as DidString,
      collection: collection as `${string}.${string}.${string}`,
      limit: 100,
      cursor,
    })
    for (const record of page.records) {
      if (match(record.value)) {
        found.push(record.uri)
      }
    }
    cursor = page.cursor
  } while (cursor)
  return found
}

async function deleteByUri(pdsClient: Pds, did: string, uri: string) {
  const parsed = new AtUri(uri)
  await pdsClient.call(com.atproto.repo.deleteRecord, {
    repo: did as DidString,
    collection: parsed.collection as `${string}.${string}.${string}`,
    rkey: parsed.rkey,
  })
}

/** Creates a community (its slug is the record key) or saves the owner's edit */
export function useSaveCommunityMutation() {
  const {currentAccount} = useSession()
  const pdsClient = usePdsClient()
  const invalidate = useInvalidateCommunities()
  const getToken = useIndexerAuth()
  return useMutation({
    mutationFn: async ({
      draft,
      existingUri,
    }: {
      draft: CommunityDraft
      /** Set when editing */
      existingUri?: string
    }) => {
      if (!currentAccount) throw new Error('Not signed in')
      const did = currentAccount.did
      const rules = parseRules(draft.rulesText)
      const chatJoinLink = draft.chatJoinLink.trim()
      const fields = {
        name: draft.name.trim(),
        rules,
        access: buildAccess(draft),
        chatJoinLink: chatJoinLink || undefined,
      }
      if (existingUri) {
        const rkey = new AtUri(existingUri).rkey
        // Keep what the app does not edit (the avatar, the creation date)
        const current = await pdsClient.call(com.atproto.repo.getRecord, {
          repo: did,
          collection: 'net.krao.community.profile',
          rkey,
        })
        await pdsClient.call(com.atproto.repo.putRecord, {
          repo: did,
          collection: 'net.krao.community.profile',
          rkey,
          record: {
            ...(current.value as Record<string, unknown>),
            $type: 'net.krao.community.profile',
            ...fields,
            // An empty link removes it
            chatJoinLink: fields.chatJoinLink,
          },
        })
        return existingUri
      }
      await pdsClient.call(com.atproto.repo.createRecord, {
        repo: did,
        collection: 'net.krao.community.profile',
        rkey: draft.slug,
        record: {
          $type: 'net.krao.community.profile',
          ...fields,
          createdAt: now(),
        },
        validate: true,
      })
      const uri = makeCommunityUri(did, draft.slug)
      // Not awaited: the indexer needs a moment to index the new community
      void createFeedWhenIndexed({
        pdsClient,
        did,
        uri,
        slug: draft.slug,
        name: fields.name,
        getToken,
      })
      return uri
    },
    onSuccess: () => {
      void invalidate()
    },
  })
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * A new community gets its feed generator too. The generator has to name the
 * indexer's feed service, which only the community response tells, so wait
 * for the indexer to know the community. Failing is fine: the owner can
 * turn the feed on from the community page.
 */
async function createFeedWhenIndexed({
  pdsClient,
  did,
  uri,
  slug,
  name,
  getToken,
}: {
  pdsClient: Pds
  did: string
  uri: string
  slug: string
  name: string
  getToken: (lxm: string) => Promise<string>
}) {
  const method = net.krao.community.getCommunity.$lxm
  for (let attempt = 0; attempt < 8; attempt++) {
    await sleep(1500)
    try {
      const res = await indexerFetch<{feedGeneratorDid?: string}>(method, {
        params: {uri},
        token: await getToken(method),
      })
      if (!res.feedGeneratorDid) return
      await createCommunityFeed({
        pdsClient,
        did,
        slug,
        name,
        feedGeneratorDid: res.feedGeneratorDid,
      })
      return
    } catch (e) {
      if ((e as {error?: string})?.error !== 'NotFound') {
        logger.debug('community feed not created', {error: String(e)})
        return
      }
    }
  }
}

async function createCommunityFeed({
  pdsClient,
  did,
  slug,
  name,
  description,
  feedGeneratorDid,
}: {
  pdsClient: Pds
  did: string
  slug: string
  name: string
  description?: string
  feedGeneratorDid: string
}) {
  await pdsClient.call(com.atproto.repo.createRecord, {
    repo: did as DidString,
    collection: 'app.bsky.feed.generator',
    rkey: communityFeedRkey(slug),
    record: buildCommunityFeedRecord({
      name,
      description,
      did: feedGeneratorDid,
      createdAt: now(),
    }),
  })
}

/** The owner turns on the community's feed (a generator record in their repo) */
export function useEnableCommunityFeedMutation() {
  const {currentAccount} = useSession()
  const pdsClient = usePdsClient()
  const invalidate = useInvalidateCommunities()
  return useMutation({
    mutationFn: async ({
      community,
      description,
    }: {
      community: CommunityView
      description?: string
    }) => {
      if (!currentAccount) throw new Error('Not signed in')
      if (!community.feedGeneratorDid) {
        throw new Error('The community feed is not available yet')
      }
      await createCommunityFeed({
        pdsClient,
        did: currentAccount.did,
        slug: community.slug,
        name: community.name,
        description,
        feedGeneratorDid: community.feedGeneratorDid,
      })
    },
    onSuccess: async () => {
      /*
       * The indexer sees the generator record a moment later; refresh now
       * and again shortly, so the pin button shows up without a reload
       */
      await invalidate()
      setTimeout(() => void invalidate(), 4000)
    },
  })
}

/** Join (open communities), ask to join (approval) or try to qualify */
export function useJoinCommunityMutation() {
  const pdsClient = usePdsClient()
  const invalidate = useInvalidateCommunities()
  return useMutation({
    mutationFn: async ({community}: {community: string}) => {
      await pdsClient.create(net.krao.community.membership, {
        subject: community as AtUriString,
        createdAt: now(),
      })
    },
    onSettled: () => {
      /*
       * The indexer reads the new record from the firehose a moment later, so
       * the viewer state is refreshed now and once more shortly after
       */
      void invalidate()
      setTimeout(() => void invalidate(), 2500)
    },
  })
}

/** Leave, or withdraw a request, by deleting the membership record */
export function useLeaveCommunityMutation() {
  const {currentAccount} = useSession()
  const pdsClient = usePdsClient()
  const invalidate = useInvalidateCommunities()
  return useMutation({
    mutationFn: async ({
      community,
      membership,
    }: {
      community: string
      membership?: string
    }) => {
      if (!currentAccount) throw new Error('Not signed in')
      /*
       * All of the viewer's memberships of the community, in case a retry
       * wrote a second record
       */
      const uris = new Set(
        await findOwnRecords(
          pdsClient,
          currentAccount.did,
          'net.krao.community.membership',
          value => value.subject === community,
        ),
      )
      if (membership) uris.add(membership)
      for (const uri of uris) {
        await deleteByUri(pdsClient, currentAccount.did, uri)
      }
    },
    onSettled: () => {
      void invalidate()
      setTimeout(() => void invalidate(), 2500)
    },
  })
}

/** Moderation records are written to the moderator's own repo */
export function useModerationMutations() {
  const {currentAccount} = useSession()
  const pdsClient = usePdsClient()
  const invalidate = useInvalidateCommunities()
  const refresh = () => {
    void invalidate()
    setTimeout(() => void invalidate(), 2500)
  }
  const approve = useMutation({
    mutationFn: async ({
      community,
      subject,
    }: {
      community: string
      subject: string
    }) => {
      await pdsClient.create(net.krao.community.approval, {
        community: community as AtUriString,
        subject: subject as DidString,
        createdAt: now(),
      })
    },
    onSettled: refresh,
  })
  const ban = useMutation({
    mutationFn: async ({
      community,
      subject,
      reason,
    }: {
      community: string
      subject: string
      reason?: string
    }) => {
      await pdsClient.create(net.krao.community.ban, {
        community: community as AtUriString,
        subject: subject as DidString,
        reason: reason?.trim() || undefined,
        createdAt: now(),
      })
    },
    onSettled: refresh,
  })
  const hidePost = useMutation({
    mutationFn: async ({
      community,
      post,
    }: {
      community: string
      post: string
    }) => {
      const res = await pdsClient.create(net.krao.community.hide, {
        community: community as AtUriString,
        post: post as AtUriString,
        createdAt: now(),
      })
      return res.uri
    },
    onSettled: refresh,
  })
  const unhidePost = useMutation({
    mutationFn: async ({hideUri}: {hideUri: string}) => {
      if (!currentAccount) throw new Error('Not signed in')
      await deleteByUri(pdsClient, currentAccount.did, hideUri)
    },
    onSettled: refresh,
  })
  const addModerator = useMutation({
    mutationFn: async ({
      community,
      subject,
    }: {
      community: string
      subject: string
    }) => {
      await pdsClient.create(net.krao.community.moderator, {
        community: community as AtUriString,
        subject: subject as DidString,
        createdAt: now(),
      })
    },
    onSettled: refresh,
  })
  const removeModerator = useMutation({
    mutationFn: async ({
      community,
      subject,
    }: {
      community: string
      subject: string
    }) => {
      if (!currentAccount) throw new Error('Not signed in')
      const uris = await findOwnRecords(
        pdsClient,
        currentAccount.did,
        'net.krao.community.moderator',
        value => value.community === community && value.subject === subject,
      )
      for (const uri of uris) {
        await deleteByUri(pdsClient, currentAccount.did, uri)
      }
    },
    onSettled: refresh,
  })
  return {approve, ban, hidePost, unhidePost, addModerator, removeModerator}
}

/** The pages of an infinite query as one list */
export function flattenPages<T, K extends string>(
  data: InfiniteData<{[P in K]: T[]}> | undefined,
  key: K,
): T[] {
  return data?.pages.flatMap(page => page[key]) ?? []
}
