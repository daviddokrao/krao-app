import {useState} from 'react'
import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {formatChange, formatUsd} from '#/features/membership/logic'
import {DailyBarChart} from './components/DailyBarChart'
import {useCreatorStatsQuery} from './queries'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'CreatorDashboard'>

type Series = 'tips' | 'members'

/** Settings > Creator dashboard: tips, members and followers over 30 days */
export function CreatorDashboardScreen({}: Props) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const stats = useCreatorStatsQuery()
  const [series, setSeries] = useState<Series>('tips')
  const data = stats.data

  const daily = data?.daily ?? []
  const values = daily.map(d =>
    series === 'tips' ? Number(d.tipsUsd) : d.newMembers,
  )
  /*
   * Days are UTC days ("2026-10-16" is UTC midnight): shown in local time,
   * they would read as the day before west of UTC
   */
  const dayLabel = (date: string | undefined) =>
    date
      ? i18n.date(new Date(date), {dateStyle: 'medium', timeZone: 'UTC'})
      : ''
  const total = values.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0)
  const chartLabel =
    series === 'tips'
      ? l`Tips per day, ${formatUsd(total)} in total`
      : l`New members per day, ${total} in total`
  const change = formatChange(data?.followers.change30d)

  return (
    <Layout.Screen testID="creatorDashboardScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Creator dashboard</Trans>
          </Layout.Header.TitleText>
          <Layout.Header.SubtitleText>
            <Trans>Last 30 days</Trans>
          </Layout.Header.SubtitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <View style={[a.p_xl, a.gap_xl]}>
          {stats.isLoading ? (
            <View style={[a.align_center, a.p_xl]}>
              <Loader size="xl" />
            </View>
          ) : stats.isError || !data ? (
            <View style={[a.gap_md]}>
              <Admonition type="error">{cleanError(stats.error)}</Admonition>
              <Button
                label={l`Try again`}
                color="secondary"
                size="small"
                style={[a.self_start]}
                onPress={() => void stats.refetch()}>
                <ButtonText>
                  <Trans>Try again</Trans>
                </ButtonText>
              </Button>
            </View>
          ) : (
            <>
              <View style={[a.flex_row, a.flex_wrap, a.gap_md]}>
                <StatTile
                  testID="statTips"
                  label={l`Tips`}
                  value={formatUsd(data.tips30d.totalUsd)}
                  detail={plural(data.tips30d.count, {
                    one: '# tip',
                    other: '# tips',
                  })}
                />
                <StatTile
                  testID="statMembers"
                  label={l`Active members`}
                  value={String(data.members.active)}
                  detail={l`${data.members.new30d} new`}
                />
                <StatTile
                  testID="statExpired"
                  label={l`Expired members`}
                  value={String(data.members.expired30d)}
                  detail={l`ended in 30 days`}
                />
                <StatTile
                  testID="statFollowers"
                  label={l`Followers`}
                  value={String(data.followers.now)}
                  detail={change ? l`${change} in 30 days` : undefined}
                />
              </View>

              <View style={[a.gap_md]}>
                <SegmentedControl.Root
                  label={l`Chart`}
                  type="tabs"
                  value={series}
                  onChange={setSeries}>
                  <SegmentedControl.Item value="tips" label={l`Tips per day`}>
                    <SegmentedControl.ItemText>
                      <Trans>Tips</Trans>
                    </SegmentedControl.ItemText>
                  </SegmentedControl.Item>
                  <SegmentedControl.Item
                    value="members"
                    label={l`New members per day`}>
                    <SegmentedControl.ItemText>
                      <Trans>New members</Trans>
                    </SegmentedControl.ItemText>
                  </SegmentedControl.Item>
                </SegmentedControl.Root>
                {daily.length > 0 && total > 0 ? (
                  <DailyBarChart
                    values={values}
                    firstLabel={dayLabel(daily[0].date)}
                    lastLabel={dayLabel(daily[daily.length - 1].date)}
                    label={chartLabel}
                  />
                ) : (
                  <View style={[a.py_3xl, a.align_center]}>
                    <Text
                      style={[
                        a.text_md,
                        a.text_center,
                        t.atoms.text_contrast_medium,
                      ]}>
                      {series === 'tips' ? (
                        <Trans>No tips in the last 30 days yet.</Trans>
                      ) : (
                        <Trans>No new members in the last 30 days yet.</Trans>
                      )}
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </Layout.Content>
    </Layout.Screen>
  )
}

function StatTile({
  label,
  value,
  detail,
  testID,
}: {
  label: string
  value: string
  detail?: string
  testID?: string
}) {
  const t = useTheme()
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${label}: ${value}${detail ? `, ${detail}` : ''}`}
      accessibilityHint=""
      style={[
        a.flex_1,
        a.p_md,
        a.gap_2xs,
        a.rounded_md,
        t.atoms.bg_contrast_25,
        {minWidth: 140},
      ]}>
      <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>{label}</Text>
      <Text style={[a.text_3xl, a.font_bold]}>{value}</Text>
      {!!detail && (
        <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>{detail}</Text>
      )}
    </View>
  )
}
