import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {makeProfileLink} from '#/lib/routes/links'
import {type CommonNavigatorParams} from '#/lib/routes/types'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useProfilesQuery} from '#/state/queries/profile'
import {useSession} from '#/state/session'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as Toggle from '#/components/forms/Toggle'
import {Star_Stroke2_Corner0_Rounded as StarIcon} from '#/components/icons/Star'
import * as Layout from '#/components/Layout'
import {Link} from '#/components/Link'
import {Loader} from '#/components/Loader'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {PointsNote} from '../referral/components/PointsNote'
import {type LeaderboardEntry} from './api'
import {formatRank, formatWeekRange} from './format'
import {useLeaderboardOptInMutation, useLeaderboardQuery} from './queries'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Leaderboard'>

/** As many profiles as getProfiles hydrates at once */
const PROFILE_BATCH = 25

/** Weekly points leaderboard of the people who chose to be on it */
export function LeaderboardScreen({}: Props) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const {currentAccount} = useSession()
  const board = useLeaderboardQuery()
  const setOptIn = useLeaderboardOptInMutation()
  const data = board.data
  const optedIn = data?.viewer?.optedIn ?? false

  const week = data
    ? formatWeekRange(data.period, (d, part) =>
        i18n.date(
          d,
          part === 'long'
            ? {dateStyle: 'medium', timeZone: 'UTC'}
            : {month: 'short', day: 'numeric', timeZone: 'UTC'},
        ),
      )
    : undefined

  const batches: LeaderboardEntry[][] = []
  for (let i = 0; i < (data?.entries.length ?? 0); i += PROFILE_BATCH) {
    batches.push(data!.entries.slice(i, i + PROFILE_BATCH))
  }

  return (
    <Layout.Screen testID="leaderboardScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Weekly leaderboard</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          <SettingsList.Item style={[a.flex_col, a.align_stretch, a.gap_md]}>
            <Toggle.Item
              name="leaderboard_opt_in"
              label={l`Show me on the weekly leaderboard`}
              value={optedIn}
              disabled={board.isLoading || setOptIn.isPending}
              onChange={value =>
                setOptIn.mutate(value, {
                  onError: () =>
                    Toast.show(l`Could not change your leaderboard setting.`, {
                      type: 'error',
                    }),
                })
              }
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Show me on the weekly leaderboard</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>
            <Text
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              <Trans>
                Off by default. When it is on, your handle and the points you
                earned this week are shown to everyone on this list. Turn it off
                at any time to disappear from it.
              </Trans>
            </Text>
          </SettingsList.Item>

          <SettingsList.Divider />

          {week && (
            <SettingsList.Item>
              <Text
                testID="leaderboardWeek"
                style={[a.text_md, a.font_semi_bold]}>
                <Trans>Week of {week}</Trans>
              </Text>
            </SettingsList.Item>
          )}

          {board.isLoading ? (
            <SettingsList.Item>
              <Loader />
            </SettingsList.Item>
          ) : board.isError || !data ? (
            <SettingsList.Item style={[a.flex_col, a.align_stretch, a.gap_md]}>
              <Admonition.Admonition type="error">
                <Trans>Could not load the leaderboard.</Trans>
              </Admonition.Admonition>
              <Button
                label={l`Try again`}
                color="secondary"
                size="small"
                onPress={() => void board.refetch()}>
                <ButtonText>
                  <Trans>Try again</Trans>
                </ButtonText>
              </Button>
            </SettingsList.Item>
          ) : (
            <>
              <ViewerRow
                optedIn={optedIn}
                rank={data.viewer?.rank}
                points={data.viewer?.points ?? 0}
              />
              {!data.entries.length ? (
                <SettingsList.Item>
                  <SettingsList.ItemIcon icon={StarIcon} />
                  <Text style={[a.text_md, a.italic, a.flex_1]}>
                    <Trans>
                      No one is on the leaderboard yet this week. Turn it on
                      above to be the first.
                    </Trans>
                  </Text>
                </SettingsList.Item>
              ) : (
                batches.map((batch, i) => (
                  <LeaderboardPage
                    key={i}
                    entries={batch}
                    viewerDid={currentAccount?.did}
                  />
                ))
              )}
            </>
          )}

          <SettingsList.Divider />
          <SettingsList.Item>
            <PointsNote />
          </SettingsList.Item>
        </SettingsList.Container>
      </Layout.Content>
    </Layout.Screen>
  )
}

/** The viewer's own rank and points, whether or not they are on the list */
function ViewerRow({
  optedIn,
  rank,
  points,
}: {
  optedIn: boolean
  rank?: number
  points: number
}) {
  const t = useTheme()
  const {i18n} = useLingui()
  return (
    <SettingsList.Item>
      <View
        testID="leaderboardViewer"
        style={[
          a.flex_1,
          a.flex_row,
          a.align_center,
          a.justify_between,
          a.gap_md,
          a.p_md,
          a.rounded_md,
          t.atoms.bg_contrast_25,
        ]}>
        <View style={[a.flex_1, a.gap_2xs]}>
          <Text style={[a.text_md, a.font_semi_bold]}>
            <Trans>Your rank</Trans>
          </Text>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            {optedIn ? (
              rank !== undefined ? (
                <Trans>{i18n.number(points)} points this week</Trans>
              ) : (
                <Trans>
                  You will appear here once you earn points this week.
                </Trans>
              )
            ) : (
              <Trans>
                You are not on the list. You have {i18n.number(points)} points
                this week.
              </Trans>
            )}
          </Text>
        </View>
        <Text style={[a.text_xl, a.font_bold]}>
          {optedIn ? formatRank(rank) : formatRank(undefined)}
        </Text>
      </View>
    </SettingsList.Item>
  )
}

function LeaderboardPage({
  entries,
  viewerDid,
}: {
  entries: LeaderboardEntry[]
  viewerDid?: string
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const {data: profiles} = useProfilesQuery({
    handles: entries.map(e => e.did),
  })
  const byDid = new Map(profiles?.profiles.map(p => [p.did, p]))
  return entries.map(entry => {
    const profile = byDid.get(entry.did as `did:${string}:${string}`)
    const name = profile
      ? profile.displayName || sanitizeHandle(profile.handle, '@')
      : entry.did
    const isViewer = entry.did === viewerDid
    const content = (
      <View style={[a.flex_1, a.flex_row, a.align_center, a.gap_md]}>
        <Text
          style={[
            a.text_md,
            a.font_semi_bold,
            t.atoms.text_contrast_medium,
            {minWidth: 40},
          ]}>
          {formatRank(entry.rank)}
        </Text>
        <UserAvatar type="user" size={36} avatar={profile?.avatar} />
        <View style={[a.flex_1, a.gap_2xs]}>
          <Text
            emoji
            style={[a.text_md, isViewer && a.font_semi_bold]}
            numberOfLines={1}>
            {name}
            {isViewer ? ` (${l`you`})` : ''}
          </Text>
          {profile && (
            <Text
              style={[a.text_sm, t.atoms.text_contrast_medium]}
              numberOfLines={1}>
              {sanitizeHandle(profile.handle, '@')}
            </Text>
          )}
        </View>
        <Text style={[a.text_md, a.font_semi_bold]}>
          {i18n.number(entry.points)}
        </Text>
      </View>
    )
    return (
      <SettingsList.Item key={entry.did}>
        {profile ? (
          <Link
            to={makeProfileLink(profile)}
            label={l`${name}, rank ${entry.rank}, ${entry.points} points`}
            style={[a.flex_1]}>
            {content}
          </Link>
        ) : (
          content
        )}
      </SettingsList.Item>
    )
  })
}
