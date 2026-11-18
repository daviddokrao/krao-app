import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {
  type CommonNavigatorParams,
  type NavigationProp,
} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useProfileQuery} from '#/state/queries/profile'
import {useResolveDidQuery} from '#/state/queries/resolve-uri'
import {useSession} from '#/state/session'
import {Post} from '#/view/com/post/Post'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import * as Layout from '#/components/Layout'
import {InlineLinkText} from '#/components/Link'
import {ListFooter} from '#/components/Lists'
import {Loader} from '#/components/Loader'
import * as ProfileCard from '#/components/ProfileCard'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {PinFeedButton} from '#/features/growth/PinFeedButton'
import {useAccessText, useReasonText} from './components/accessText'
import {CommunityAvatar, MemberCount} from './components/CommunityCard'
import {kraoComposer} from './composer/store'
import {
  type AccessMode,
  canModerate,
  getMembershipAction,
  isOwner,
  joinPrivacyNotice,
  makeCommunityUri,
} from './logic'
import {
  type CommunityView,
  flattenPages,
  type MemberView,
  useCommunityFeedQuery,
  useCommunityQuery,
  useEnableCommunityFeedMutation,
  useJoinCommunityMutation,
  useLeaveCommunityMutation,
  useMembersQuery,
  useModerationMutations,
  usePendingMembersQuery,
} from './queries'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Community'>

type Tab = 'posts' | 'members' | 'pending'

export function CommunityScreen({route}: Props) {
  const {name, slug} = route.params
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const resolved = useResolveDidQuery(name)
  const uri = resolved.data ? makeCommunityUri(resolved.data, slug) : undefined
  const community = useCommunityQuery(uri)

  return (
    <Layout.Screen testID="communityScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            {community.data?.name ?? <Trans>Community</Trans>}
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot>
          {isOwner(community.data?.viewer) && (
            <Button
              testID="editCommunityButton"
              label={l`Edit community`}
              color="secondary"
              size="small"
              onPress={() =>
                navigation.navigate('CommunityEdit', {name, slug})
              }>
              <ButtonIcon icon={PencilIcon} />
              <ButtonText>
                <Trans>Edit</Trans>
              </ButtonText>
            </Button>
          )}
        </Layout.Header.Slot>
      </Layout.Header.Outer>
      {community.data ? (
        <CommunityBody community={community.data} />
      ) : community.isError || resolved.isError ? (
        <View style={[a.p_xl, a.gap_md]}>
          <Admonition type="error">
            {community.error &&
            'error' in community.error &&
            community.error.error === 'NotFound' ? (
              <Trans>This community doesn’t exist.</Trans>
            ) : (
              cleanError(community.error ?? resolved.error)
            )}
          </Admonition>
          <Button
            label={l`Try again`}
            color="secondary"
            size="small"
            style={[a.self_start]}
            onPress={() => void community.refetch()}>
            <ButtonText>
              <Trans>Try again</Trans>
            </ButtonText>
          </Button>
        </View>
      ) : (
        <View style={[a.p_xl, a.align_center]}>
          <Loader size="xl" />
        </View>
      )}
    </Layout.Screen>
  )
}

function CommunityBody({community}: {community: CommunityView}) {
  const {t: l} = useLingui()
  const [tab, setTab] = useState<Tab>('posts')
  const viewer = community.viewer
  const mod = canModerate(viewer)
  const mode = community.access.mode as AccessMode
  const showPending = mod && mode === 'approval'

  const feed = useCommunityFeedQuery(community.uri)
  const members = useMembersQuery(tab === 'members' ? community.uri : undefined)
  const pending = usePendingMembersQuery(
    community.uri,
    showPending && tab === 'pending',
  )
  const moderation = useModerationMutations()
  const banPrompt = Prompt.usePromptControl()
  const [banTarget, setBanTarget] = useState<{did: string; label: string}>()

  const active = tab === 'posts' ? feed : tab === 'members' ? members : pending
  const data: unknown[] =
    tab === 'posts'
      ? flattenPages(feed.data, 'posts')
      : tab === 'members'
        ? flattenPages(members.data, 'members')
        : flattenPages(pending.data, 'members')

  const onHide = (post: string) => {
    moderation.hidePost.mutate(
      {community: community.uri, post},
      {
        onSuccess: hideUri => {
          Toast.show(
            <Toast.Outer>
              <Toast.Icon />
              <Toast.Text>{l`Post hidden from this community`}</Toast.Text>
              <Toast.Action
                label={l`Undo`}
                onPress={() => moderation.unhidePost.mutate({hideUri})}>
                <Trans>Undo</Trans>
              </Toast.Action>
            </Toast.Outer>,
            {type: 'success'},
          )
        },
        onError: err => Toast.show(cleanError(err), {type: 'error'}),
      },
    )
  }

  const header = (
    <View>
      <CommunityHeader community={community} />
      <View style={[a.px_xl, a.pb_md]}>
        <SegmentedControl.Root
          label={l`Community sections`}
          type="tabs"
          value={tab}
          onChange={setTab}>
          <SegmentedControl.Item value="posts" label={l`Posts`}>
            <SegmentedControl.ItemText>
              <Trans>Posts</Trans>
            </SegmentedControl.ItemText>
          </SegmentedControl.Item>
          <SegmentedControl.Item value="members" label={l`Members`}>
            <SegmentedControl.ItemText>
              <Trans>Members</Trans>
            </SegmentedControl.ItemText>
          </SegmentedControl.Item>
          {showPending && (
            <SegmentedControl.Item value="pending" label={l`Requests`}>
              <SegmentedControl.ItemText>
                <Trans>Requests</Trans>
              </SegmentedControl.ItemText>
            </SegmentedControl.Item>
          )}
        </SegmentedControl.Root>
      </View>
    </View>
  )

  return (
    <>
      <List
        data={data}
        keyExtractor={(item: unknown, index: number) =>
          tab === 'posts'
            ? (item as {uri: string}).uri
            : `${(item as MemberView).did}-${index}`
        }
        renderItem={({item, index}: {item: unknown; index: number}) =>
          tab === 'posts' ? (
            <FeedPost
              post={item as Parameters<typeof Post>[0]['post']}
              hideTopBorder={index === 0}
              canHide={mod}
              onHide={onHide}
            />
          ) : (
            <MemberRow
              member={item as MemberView}
              community={community}
              pendingTab={tab === 'pending'}
              onBan={(did, label) => {
                setBanTarget({did, label})
                banPrompt.open()
              }}
            />
          )
        }
        ListHeaderComponent={header}
        ListEmptyComponent={
          active.isLoading ? (
            <View style={[a.p_xl, a.align_center]}>
              <Loader size="xl" />
            </View>
          ) : active.isError ? (
            <View style={[a.p_xl, a.gap_md]}>
              <Admonition type="error">{cleanError(active.error)}</Admonition>
              <Button
                label={l`Try again`}
                color="secondary"
                size="small"
                style={[a.self_start]}
                onPress={() => void active.refetch()}>
                <ButtonText>
                  <Trans>Try again</Trans>
                </ButtonText>
              </Button>
            </View>
          ) : (
            <EmptyTab tab={tab} community={community} />
          )
        }
        ListFooterComponent={
          data.length > 0 ? (
            <ListFooter
              isFetchingNextPage={active.isFetchingNextPage}
              hasNextPage={active.hasNextPage}
              error={active.isError ? cleanError(active.error) : undefined}
              onRetry={() => active.fetchNextPage()}
              height={120}
            />
          ) : undefined
        }
        onEndReached={() => {
          if (active.hasNextPage && !active.isFetchingNextPage) {
            void active.fetchNextPage()
          }
        }}
        onEndReachedThreshold={2}
        refreshing={active.isRefetching && !active.isFetchingNextPage}
        onRefresh={() => void active.refetch()}
        sideBorders={false}
      />
      <Prompt.Basic
        control={banPrompt}
        title={l`Ban ${banTarget?.label ?? ''}?`}
        description={l`They are removed from the community and can’t join again. You can’t undo this from the app yet.`}
        confirmButtonCta={l`Ban`}
        confirmButtonColor="negative"
        onConfirm={() => {
          if (!banTarget) return
          moderation.ban.mutate(
            {community: community.uri, subject: banTarget.did},
            {
              onSuccess: () =>
                Toast.show(l`Banned ${banTarget.label}`, {type: 'success'}),
              onError: err => Toast.show(cleanError(err), {type: 'error'}),
            },
          )
        }}
      />
    </>
  )
}

function CommunityHeader({community}: {community: CommunityView}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const accessText = useAccessText()
  const reasonText = useReasonText()
  const {hasSession} = useSession()
  const {openComposer} = useOpenComposer()
  const joinPrompt = Prompt.usePromptControl()
  const join = useJoinCommunityMutation()
  const leave = useLeaveCommunityMutation()
  const [showRules, setShowRules] = useState(false)

  const viewer = community.viewer
  const mode = community.access.mode as AccessMode
  const action = getMembershipAction(mode, viewer, hasSession)
  const notice = joinPrivacyNotice(mode)
  const busy = join.isPending || leave.isPending
  const error = join.error ?? leave.error

  const doJoin = () => join.mutate({community: community.uri})
  const doLeave = () =>
    leave.mutate({community: community.uri, membership: viewer?.membership})
  const onPostHere = () => {
    kraoComposer.presetCommunity({
      uri: community.uri,
      name: community.name,
      slug: community.slug,
    })
    openComposer({logContext: 'Other'})
  }

  return (
    <View style={[a.px_xl, a.pt_lg, a.pb_lg, a.gap_md]}>
      <View style={[a.flex_row, a.gap_md, a.align_center]}>
        <CommunityAvatar
          name={community.name}
          slug={community.slug}
          size={64}
        />
        <View style={[a.flex_1, a.gap_2xs]}>
          <Text emoji style={[a.text_2xl, a.font_bold, a.leading_tight]}>
            {community.name}
          </Text>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <MemberCount count={community.memberCount} />
            {' · '}
            {accessText(mode).title}
          </Text>
          <OwnerLine did={community.owner} />
        </View>
      </View>

      <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
        {accessText(mode).description}
      </Text>

      {viewer?.state === 'banned' ||
      viewer?.state === 'pending' ||
      viewer?.state === 'ineligible' ||
      (viewer?.state === 'none' && viewer.eligible === false) ? (
        <Admonition type={viewer.state === 'pending' ? 'info' : 'warning'}>
          {reasonText(viewer.reason)}
        </Admonition>
      ) : null}

      {error && <Admonition type="error">{cleanError(error)}</Admonition>}

      <View style={[a.flex_row, a.gap_sm, a.flex_wrap]}>
        {action === 'join' || action === 'request' ? (
          <Button
            testID="joinCommunityButton"
            label={action === 'join' ? l`Join` : l`Ask to join`}
            color="primary"
            size="large"
            disabled={busy}
            onPress={() => (notice ? joinPrompt.open() : doJoin())}>
            <ButtonText>
              {action === 'join' ? (
                <Trans>Join</Trans>
              ) : (
                <Trans>Ask to join</Trans>
              )}
            </ButtonText>
          </Button>
        ) : null}
        {action === 'cannotJoin' ? (
          <Button
            testID="cannotJoinButton"
            label={l`Can’t join yet`}
            color="secondary"
            size="large"
            disabled>
            <ButtonText>
              <Trans>Can’t join yet</Trans>
            </ButtonText>
          </Button>
        ) : null}
        {action === 'leave' || action === 'cancelRequest' ? (
          <Button
            testID="leaveCommunityButton"
            label={action === 'leave' ? l`Leave` : l`Cancel request`}
            color="secondary"
            size="large"
            disabled={busy}
            onPress={doLeave}>
            <ButtonText>
              {action === 'leave' ? (
                <Trans>Leave</Trans>
              ) : (
                <Trans>Cancel request</Trans>
              )}
            </ButtonText>
          </Button>
        ) : null}
        {viewer?.state === 'member' ? (
          <Button
            testID="postToCommunityButton"
            label={l`Post to this community`}
            color="primary"
            size="large"
            onPress={onPostHere}>
            <ButtonText>
              <Trans>Post here</Trans>
            </ButtonText>
          </Button>
        ) : null}
        {!hasSession ? (
          <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
            <Trans>Sign in to join this community.</Trans>
          </Text>
        ) : null}
        {busy && <Loader />}
      </View>

      <CommunityFeedControls community={community} />

      {community.rules.length > 0 && (
        <View style={[a.gap_sm]}>
          <Button
            testID="communityRulesToggle"
            label={showRules ? l`Hide rules` : l`Show rules`}
            color="secondary"
            size="small"
            style={[a.self_start]}
            onPress={() => setShowRules(!showRules)}>
            <ButtonText>
              {showRules ? <Trans>Hide rules</Trans> : <Trans>Rules</Trans>}
            </ButtonText>
          </Button>
          {showRules && (
            <View
              style={[a.p_md, a.gap_sm, a.rounded_md, t.atoms.bg_contrast_25]}>
              {community.rules.map((rule, i) => (
                <Text key={i} emoji style={[a.text_md, a.leading_snug]}>
                  {i + 1}. {rule}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {community.chatJoinLink ? (
        <Text style={[a.text_md]}>
          <InlineLinkText
            label={l`Open the community group chat`}
            to={community.chatJoinLink}>
            <Trans>Open the group chat</Trans>
          </InlineLinkText>
        </Text>
      ) : null}

      <Prompt.Basic
        control={joinPrompt}
        title={action === 'request' ? l`Ask to join?` : l`Join this community?`}
        description={
          notice === 'verified'
            ? l`Your membership is a public record. It shows that your account passed identity checks (a verified phone number or KYC), even if you keep your verified badge hidden.`
            : l`Your membership is a public record. It can show that you hold the required token or NFT in a wallet linked to your account.`
        }
        confirmButtonCta={action === 'request' ? l`Ask to join` : l`Join`}
        onConfirm={doJoin}
      />
    </View>
  )
}

/**
 * The community's public posts as a feed: anyone signed in can pin it; the
 * owner can turn it on while it does not exist yet
 */
function CommunityFeedControls({community}: {community: CommunityView}) {
  const {t: l} = useLingui()
  const enable = useEnableCommunityFeedMutation()
  if (community.feed) {
    return (
      <View style={[a.flex_row, a.flex_wrap]}>
        <PinFeedButton
          testID="pinCommunityFeedButton"
          uri={community.feed}
          pinLabel={l`Pin the community feed`}
          unpinLabel={l`Unpin the community feed`}
        />
      </View>
    )
  }
  if (!isOwner(community.viewer) || !community.feedGeneratorDid) return null
  return (
    <View style={[a.gap_sm, a.align_start]}>
      {enable.isError && (
        <Admonition type="error">{cleanError(enable.error)}</Admonition>
      )}
      <Button
        testID="enableCommunityFeedButton"
        label={l`Turn on a feed for this community`}
        color="secondary"
        size="small"
        disabled={enable.isPending || enable.isSuccess}
        onPress={() =>
          enable.mutate(
            {
              community,
              description: l`Public posts from the ${community.name} community on Krao.`,
            },
            {
              onSuccess: () =>
                Toast.show(
                  l`The feed is on. It can take a moment to show up for others.`,
                ),
            },
          )
        }>
        {enable.isPending && <ButtonIcon icon={Loader} />}
        <ButtonText>
          <Trans>Turn on the community feed</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}

function OwnerLine({did}: {did: string}) {
  const t = useTheme()
  const {data} = useProfileQuery({did})
  if (!data) return null
  return (
    <Text numberOfLines={1} style={[a.text_sm, t.atoms.text_contrast_medium]}>
      <Trans>By {sanitizeHandle(data.handle, '@')}</Trans>
    </Text>
  )
}

function EmptyTab({tab, community}: {tab: Tab; community: CommunityView}) {
  const t = useTheme()
  const canPost = community.viewer?.state === 'member'
  return (
    <View style={[a.p_xl, a.pt_2xl, a.align_center, a.gap_sm]}>
      <Text style={[a.text_lg, a.font_semi_bold, a.text_center]}>
        {tab === 'posts' ? (
          <Trans>No posts here yet</Trans>
        ) : tab === 'members' ? (
          <Trans>No members yet</Trans>
        ) : (
          <Trans>No requests waiting</Trans>
        )}
      </Text>
      {tab === 'posts' && (
        <Text
          style={[
            a.text_md,
            a.text_center,
            a.leading_snug,
            t.atoms.text_contrast_medium,
          ]}>
          {canPost ? (
            <Trans>Start the conversation with Post here.</Trans>
          ) : (
            <Trans>Join the community to post in it.</Trans>
          )}
        </Text>
      )}
    </View>
  )
}

function FeedPost({
  post,
  hideTopBorder,
  canHide,
  onHide,
}: {
  post: Parameters<typeof Post>[0]['post']
  hideTopBorder: boolean
  canHide: boolean
  onHide: (post: string) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View>
      <Post post={post} hideTopBorder={hideTopBorder} />
      {canHide && (
        <View style={[a.px_xl, a.pb_md, a.flex_row]}>
          <Button
            testID={`hidePost-${post.uri}`}
            label={l`Hide this post from the community`}
            accessibilityHint={l`The post stays on its author’s profile`}
            color="negative_subtle"
            size="tiny"
            onPress={() => onHide(post.uri)}>
            <ButtonText>
              <Trans>Hide from community</Trans>
            </ButtonText>
          </Button>
        </View>
      )}
      {canHide ? (
        <View style={[a.border_b, t.atoms.border_contrast_low]} />
      ) : null}
    </View>
  )
}

function MemberRow({
  member,
  community,
  pendingTab,
  onBan,
}: {
  member: MemberView
  community: CommunityView
  pendingTab: boolean
  onBan: (did: string, label: string) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  const moderationOpts = useModerationOpts()
  const profile = member.profile
  const moderation = useModerationMutations()
  const viewerIsOwner = isOwner(community.viewer)
  const viewerIsMod = canModerate(community.viewer)
  const label = profile ? sanitizeHandle(profile.handle, '@') : member.did
  const isSelf = member.did === currentAccount?.did
  const canBan =
    viewerIsMod &&
    !isSelf &&
    (member.role === 'member' || (viewerIsOwner && member.role === 'moderator'))

  const run = (promise: Promise<unknown>) =>
    promise.catch(err => Toast.show(cleanError(err), {type: 'error'}))

  return (
    <View
      style={[
        a.px_xl,
        a.py_md,
        a.gap_sm,
        a.border_t,
        t.atoms.border_contrast_low,
      ]}>
      <View style={[a.flex_row, a.align_center, a.gap_sm]}>
        <View style={[a.flex_1]}>
          {profile && moderationOpts ? (
            <ProfileCard.Link profile={profile}>
              <ProfileCard.Outer>
                <ProfileCard.Header>
                  <ProfileCard.Avatar
                    profile={profile}
                    moderationOpts={moderationOpts}
                  />
                  <ProfileCard.NameAndHandle
                    profile={profile}
                    moderationOpts={moderationOpts}
                  />
                </ProfileCard.Header>
              </ProfileCard.Outer>
            </ProfileCard.Link>
          ) : (
            <Text numberOfLines={1} style={[a.text_md]}>
              {member.did}
            </Text>
          )}
        </View>
        {member.role !== 'member' && (
          <Text
            style={[
              a.text_xs,
              a.font_semi_bold,
              {color: t.palette.primary_600},
            ]}>
            {member.role === 'owner' ? (
              <Trans>Owner</Trans>
            ) : (
              <Trans>Moderator</Trans>
            )}
          </Text>
        )}
      </View>
      {viewerIsMod && !isSelf && member.role !== 'owner' && (
        <View style={[a.flex_row, a.gap_sm, a.flex_wrap]}>
          {pendingTab && (
            <Button
              testID={`approve-${member.did}`}
              label={l`Approve ${label}`}
              color="primary"
              size="small"
              disabled={moderation.approve.isPending}
              onPress={() =>
                void run(
                  moderation.approve.mutateAsync({
                    community: community.uri,
                    subject: member.did,
                  }),
                )
              }>
              <ButtonText>
                <Trans>Approve</Trans>
              </ButtonText>
            </Button>
          )}
          {viewerIsOwner && !pendingTab && member.role === 'member' && (
            <Button
              label={l`Make ${label} a moderator`}
              color="secondary"
              size="small"
              disabled={moderation.addModerator.isPending}
              onPress={() =>
                void run(
                  moderation.addModerator.mutateAsync({
                    community: community.uri,
                    subject: member.did,
                  }),
                )
              }>
              <ButtonText>
                <Trans>Make moderator</Trans>
              </ButtonText>
            </Button>
          )}
          {viewerIsOwner && member.role === 'moderator' && (
            <Button
              label={l`Remove ${label} as moderator`}
              color="secondary"
              size="small"
              disabled={moderation.removeModerator.isPending}
              onPress={() =>
                void run(
                  moderation.removeModerator.mutateAsync({
                    community: community.uri,
                    subject: member.did,
                  }),
                )
              }>
              <ButtonText>
                <Trans>Remove moderator</Trans>
              </ButtonText>
            </Button>
          )}
          {canBan && (
            <Button
              testID={`ban-${member.did}`}
              label={l`Ban ${label}`}
              color="negative_subtle"
              size="small"
              onPress={() => onBan(member.did, label)}>
              <ButtonText>
                <Trans>Ban</Trans>
              </ButtonText>
            </Button>
          )}
        </View>
      )}
    </View>
  )
}
