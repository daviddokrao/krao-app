import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {
  type CommonNavigatorParams,
  type NavigationProp,
} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import {Star_Stroke2_Corner0_Rounded as StarIcon} from '#/components/icons/Star'
import * as Layout from '#/components/Layout'
import {ListFooter} from '#/components/Lists'
import {Loader} from '#/components/Loader'
import * as ProfileCard from '#/components/ProfileCard'
import {Text} from '#/components/Typography'
import {flattenPages} from '#/features/community/queries'
import type * as bsky from '#/types/bsky'
import {MemberUntil} from './components/MemberUntil'
import {describeExpiry} from './logic'
import {
  type MembershipView,
  useCreatorProfiles,
  useMyMembershipsQuery,
} from './queries'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'MyMemberships'>

/** Settings > My memberships: creators the viewer supports, with a renew button */
export function MyMembershipsScreen({}: Props) {
  const t = useTheme()
  const {t: l} = useLingui()
  const query = useMyMembershipsQuery()
  const items = flattenPages(query.data, 'memberships')
  const profiles = useCreatorProfiles(items)

  return (
    <Layout.Screen testID="myMembershipsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>My memberships</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <List
        data={items}
        keyExtractor={(item: MembershipView) => item.creator}
        renderItem={({item, index}: {item: MembershipView; index: number}) => (
          <MembershipRow
            membership={item}
            profile={profiles.data?.get(item.creator)}
            hideTopBorder={index === 0}
          />
        )}
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
              <StarIcon size="xl" fill={t.atoms.text_contrast_low.color} />
              <Text style={[a.text_lg, a.font_semi_bold, a.text_center]}>
                <Trans>You’re not a member of anyone yet</Trans>
              </Text>
              <Text
                style={[
                  a.text_md,
                  a.text_center,
                  t.atoms.text_contrast_medium,
                ]}>
                <Trans>
                  When you join a creator’s membership, it shows up here with
                  the date it ends and a button to renew.
                </Trans>
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

function MembershipRow({
  membership,
  profile,
  hideTopBorder,
}: {
  membership: MembershipView
  profile: bsky.profile.AnyProfileView | undefined
  hideTopBorder: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const moderationOpts = useModerationOpts()
  const planName =
    typeof membership.plan === 'string' ? undefined : membership.plan.name
  const info = describeExpiry(membership.expiresAt, new Date())
  const canRenew = membership.status !== 'pending'
  return (
    <View
      style={[
        a.px_xl,
        a.py_md,
        a.gap_sm,
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
          {membership.creator}
        </Text>
      )}
      <View style={[a.flex_row, a.align_center, a.gap_sm, a.flex_wrap]}>
        <View style={[a.flex_1, a.gap_2xs]}>
          {!!planName && (
            <Text emoji style={[a.text_sm, t.atoms.text_contrast_medium]}>
              {planName}
            </Text>
          )}
          <MemberUntil membership={membership} />
        </View>
        {canRenew && (
          <Button
            label={
              info?.expired || membership.status === 'expired'
                ? l`Join again`
                : l`Renew`
            }
            color={info?.renewSoon ? 'primary' : 'secondary'}
            size="small"
            onPress={() =>
              navigation.navigate('ProfileMembership', {
                name: profile?.handle ?? membership.creator,
              })
            }>
            <ButtonText>
              {info?.expired || membership.status === 'expired' ? (
                <Trans>Join again</Trans>
              ) : (
                <Trans>Renew</Trans>
              )}
            </ButtonText>
          </Button>
        )}
      </View>
    </View>
  )
}
