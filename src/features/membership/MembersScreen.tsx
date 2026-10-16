import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import {Group3_Stroke2_Corner0_Rounded as GroupIcon} from '#/components/icons/Group3'
import * as Layout from '#/components/Layout'
import {ListFooter} from '#/components/Lists'
import {Loader} from '#/components/Loader'
import * as ProfileCard from '#/components/ProfileCard'
import {Text} from '#/components/Typography'
import {flattenPages} from '#/features/community/queries'
import {MemberUntil} from './components/MemberUntil'
import {type MembershipWithProfile, useMembersQuery} from './queries'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'MembershipMembers'>

type Tab = 'active' | 'expired'

/** The creator's members: current ones, and those whose period has ended */
export function MembersScreen({}: Props) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [tab, setTab] = useState<Tab>('active')
  const query = useMembersQuery(tab)
  const items = flattenPages(query.data, 'members') as MembershipWithProfile[]

  const header = (
    <View style={[a.px_xl, a.pt_md, a.pb_md]}>
      <SegmentedControl.Root
        label={l`Members`}
        type="tabs"
        value={tab}
        onChange={setTab}>
        <SegmentedControl.Item value="active" label={l`Active members`}>
          <SegmentedControl.ItemText>
            <Trans>Active</Trans>
          </SegmentedControl.ItemText>
        </SegmentedControl.Item>
        <SegmentedControl.Item value="expired" label={l`Expired members`}>
          <SegmentedControl.ItemText>
            <Trans>Expired</Trans>
          </SegmentedControl.ItemText>
        </SegmentedControl.Item>
      </SegmentedControl.Root>
    </View>
  )

  return (
    <Layout.Screen testID="membershipMembersScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Members</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <List
        data={items}
        keyExtractor={(item: MembershipWithProfile) => item.member}
        renderItem={({
          item,
          index,
        }: {
          item: MembershipWithProfile
          index: number
        }) => <MemberRow member={item} hideTopBorder={index === 0} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          query.isLoading ? (
            <View style={[a.p_xl, a.align_center]}>
              <Loader size="xl" />
            </View>
          ) : query.isError ? (
            <View style={[a.p_xl, a.gap_md]}>
              <Admonition type="error">{cleanError(query.error)}</Admonition>
              <Button
                label={l`Try again`}
                color="secondary"
                size="small"
                style={[a.self_start]}
                onPress={() => void query.refetch()}>
                <ButtonText>
                  <Trans>Try again</Trans>
                </ButtonText>
              </Button>
            </View>
          ) : (
            <View style={[a.p_xl, a.pt_3xl, a.align_center, a.gap_md]}>
              <GroupIcon size="xl" fill={t.atoms.text_contrast_low.color} />
              <Text style={[a.text_lg, a.font_semi_bold, a.text_center]}>
                {tab === 'active' ? (
                  <Trans>No active members yet</Trans>
                ) : (
                  <Trans>No expired memberships</Trans>
                )}
              </Text>
              <Text
                style={[
                  a.text_md,
                  a.text_center,
                  t.atoms.text_contrast_medium,
                ]}>
                {tab === 'active' ? (
                  <Trans>
                    Share your profile and members-only posts. People who join
                    will show up here.
                  </Trans>
                ) : (
                  <Trans>
                    Members whose 30 days ended show up here, so you can invite
                    them back.
                  </Trans>
                )}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          items.length > 0 ? (
            <ListFooter
              isFetchingNextPage={query.isFetchingNextPage}
              hasNextPage={query.hasNextPage}
              error={query.isError ? cleanError(query.error) : undefined}
              onRetry={() => query.fetchNextPage()}
              height={120}
            />
          ) : undefined
        }
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            void query.fetchNextPage()
          }
        }}
        onEndReachedThreshold={2}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => void query.refetch()}
        sideBorders={false}
      />
    </Layout.Screen>
  )
}

function MemberRow({
  member,
  hideTopBorder,
}: {
  member: MembershipWithProfile
  hideTopBorder: boolean
}) {
  const t = useTheme()
  const moderationOpts = useModerationOpts()
  const profile = member.profile
  const planName =
    typeof member.plan === 'string' ? undefined : member.plan.name
  return (
    <View
      style={[
        a.px_xl,
        a.py_md,
        a.gap_xs,
        !hideTopBorder && a.border_t,
        t.atoms.border_contrast_low,
      ]}>
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
          {member.member}
        </Text>
      )}
      <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
        {!!planName && (
          <Text emoji style={[a.text_sm, t.atoms.text_contrast_medium]}>
            {planName}
          </Text>
        )}
        <MemberUntil membership={member} />
      </View>
    </View>
  )
}
