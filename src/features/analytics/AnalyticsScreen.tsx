import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {atoms as a, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {
  buildFunnelRows,
  cohortDate,
  formatPercent,
  funnelPeriod,
  type FunnelRange,
  type FunnelRow,
  type FunnelStepId,
  RETENTION_KEYS,
  retentionCell,
  type RetentionCohort,
  type RetentionKey,
  sortCohorts,
} from './logic'
import {
  isForbidden,
  useAnalyticsSummaryQuery,
  useFunnelQuery,
  useRetentionQuery,
} from './queries'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'AnalyticsAdmin'>

/**
 * Admin > Analytics: the funnel from sign-up to a first tip, retention by
 * sign-up week and a few totals. Figures come from Krao's own rewards
 * service and are aggregates: nothing here is about a single person.
 */
export function AnalyticsScreen({}: Props) {
  const summary = useAnalyticsSummaryQuery()
  const forbidden = isForbidden(summary.error)

  return (
    <Layout.Screen testID="analyticsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Analytics</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <View style={[a.p_lg, a.gap_2xl]}>
          {forbidden ? (
            <Admonition.Admonition type="error">
              <Trans>Only Krao admins can open this page.</Trans>
            </Admonition.Admonition>
          ) : (
            <>
              <Summary query={summary} />
              <FunnelSection />
              <RetentionSection />
            </>
          )}
        </View>
      </Layout.Content>
    </Layout.Screen>
  )
}

function TitleText({children}: {children: React.ReactNode}) {
  return (
    <Text accessibilityRole="header" style={[a.text_lg, a.font_bold]}>
      {children}
    </Text>
  )
}

function LoadError({error, onRetry}: {error: unknown; onRetry: () => void}) {
  const {t: l} = useLingui()
  return (
    <View style={[a.gap_md]}>
      <Admonition.Admonition type="error">
        {isForbidden(error) ? (
          <Trans>Only Krao admins can open this page.</Trans>
        ) : (
          <Trans>Could not load these figures.</Trans>
        )}
      </Admonition.Admonition>
      <Button
        label={l`Try again`}
        color="secondary"
        size="small"
        style={[a.self_start]}
        onPress={onRetry}>
        <ButtonText>
          <Trans>Try again</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}

function Summary({
  query,
}: {
  query: ReturnType<typeof useAnalyticsSummaryQuery>
}) {
  const {t: l, i18n} = useLingui()
  const data = query.data
  if (query.isLoading) return <Loader />
  if (query.isError || !data) {
    return (
      <LoadError error={query.error} onRetry={() => void query.refetch()} />
    )
  }
  const cards = [
    {id: 'accounts', label: l`Accounts`, value: data.accounts},
    {id: 'activeToday', label: l`Active today`, value: data.activeToday},
    {id: 'active7d', label: l`Active in 7 days`, value: data.active7d},
    {id: 'active30d', label: l`Active in 30 days`, value: data.active30d},
    ...(data.posts7d !== undefined
      ? [{id: 'posts7d', label: l`Posts in 7 days`, value: data.posts7d}]
      : []),
  ]
  return (
    <View style={[a.gap_md]}>
      <TitleText>
        <Trans>Overview</Trans>
      </TitleText>
      <View style={[a.flex_row, a.flex_wrap, a.gap_md]}>
        {cards.map(card => (
          <StatCard
            key={card.id}
            testID={`analytics-${card.id}`}
            label={card.label}
            value={i18n.number(card.value)}
          />
        ))}
      </View>
    </View>
  )
}

function StatCard({
  label,
  value,
  testID,
}: {
  label: string
  value: string
  testID?: string
}) {
  const t = useTheme()
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${label}: ${value}`}
      accessibilityHint=""
      style={[
        a.p_md,
        a.gap_2xs,
        a.rounded_md,
        t.atoms.bg_contrast_25,
        {flexGrow: 1, flexBasis: '45%'},
      ]}>
      <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>{label}</Text>
      <Text style={[a.text_2xl, a.font_bold]}>{value}</Text>
    </View>
  )
}

function useStepLabel() {
  const {t: l} = useLingui()
  const labels: Record<FunnelStepId, string> = {
    registered: l`Signed up`,
    phoneVerified: l`Verified phone`,
    kycApproved: l`Verified identity`,
    walletLinked: l`Linked a wallet`,
    firstTip: l`Sent a first tip`,
  }
  return (id: FunnelStepId) => labels[id]
}

function FunnelSection() {
  const {t: l} = useLingui()
  const [range, setRange] = useState<FunnelRange>('30d')
  const funnel = useFunnelQuery(range, funnelPeriod(range))
  const rows = funnel.data ? buildFunnelRows(funnel.data.steps) : []

  return (
    <View style={[a.gap_md]}>
      <TitleText>
        <Trans>Funnel</Trans>
      </TitleText>
      <SegmentedControl.Root
        label={l`Sign-up period`}
        type="tabs"
        size="small"
        value={range}
        onChange={setRange}>
        <SegmentedControl.Item value="7d" label={l`Last 7 days`}>
          <SegmentedControl.ItemText>
            <Trans>7 days</Trans>
          </SegmentedControl.ItemText>
        </SegmentedControl.Item>
        <SegmentedControl.Item value="30d" label={l`Last 30 days`}>
          <SegmentedControl.ItemText>
            <Trans>30 days</Trans>
          </SegmentedControl.ItemText>
        </SegmentedControl.Item>
        <SegmentedControl.Item value="90d" label={l`Last 90 days`}>
          <SegmentedControl.ItemText>
            <Trans>90 days</Trans>
          </SegmentedControl.ItemText>
        </SegmentedControl.Item>
      </SegmentedControl.Root>
      <Text style={[a.text_sm, a.leading_snug]}>
        <Trans>
          Accounts created in this period, and how many of them reached each
          step.
        </Trans>
      </Text>
      {funnel.isLoading ? (
        <Loader />
      ) : funnel.isError ? (
        <LoadError error={funnel.error} onRetry={() => void funnel.refetch()} />
      ) : (
        <View style={[a.gap_lg]} accessibilityRole="list">
          {rows.map((row, i) => (
            <FunnelBar key={row.id} row={row} first={i === 0} />
          ))}
        </View>
      )}
    </View>
  )
}

function FunnelBar({row, first}: {row: FunnelRow; first: boolean}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const stepLabel = useStepLabel()
  const label = stepLabel(row.id)
  const count = i18n.number(row.count)
  const share = formatPercent(row.ofStart)
  const previous = formatPercent(row.ofPrevious)
  return (
    <View
      testID={`funnel-${row.id}`}
      accessible
      accessibilityLabel={
        first
          ? l`${label}: ${count}`
          : l`${label}: ${count}, ${share} of sign-ups, ${previous} of the step before`
      }
      accessibilityHint=""
      style={[a.gap_xs]}>
      <View style={[a.flex_row, a.justify_between, a.gap_md]}>
        <Text style={[a.text_md, a.font_semi_bold, a.flex_1]}>{label}</Text>
        <Text style={[a.text_md, a.font_semi_bold]}>{count}</Text>
      </View>
      <View
        style={[
          a.w_full,
          a.rounded_full,
          a.overflow_hidden,
          t.atoms.bg_contrast_100,
          {height: 10},
        ]}>
        <View
          style={[
            a.rounded_full,
            {
              height: 10,
              width: `${row.bar}%`,
              backgroundColor: t.palette.primary_500,
            },
          ]}
        />
      </View>
      {!first && (
        <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
          <Trans>
            {share} of sign-ups · {previous} of the step before
          </Trans>
        </Text>
      )}
    </View>
  )
}

const WEEK_OPTIONS = [8, 12, 26] as const

function RetentionSection() {
  const {t: l} = useLingui()
  const [weeks, setWeeks] = useState<(typeof WEEK_OPTIONS)[number]>(8)
  const retention = useRetentionQuery(weeks)
  const cohorts = retention.data ? sortCohorts(retention.data.cohorts) : []

  return (
    <View style={[a.gap_md]}>
      <TitleText>
        <Trans>Retention</Trans>
      </TitleText>
      <SegmentedControl.Root
        label={l`Number of weeks`}
        type="tabs"
        size="small"
        value={String(weeks)}
        onChange={value =>
          setWeeks(Number(value) as (typeof WEEK_OPTIONS)[number])
        }>
        {WEEK_OPTIONS.map(option => (
          <SegmentedControl.Item
            key={option}
            value={String(option)}
            label={l`Last ${option} weeks`}>
            <SegmentedControl.ItemText>
              {l`${option} weeks`}
            </SegmentedControl.ItemText>
          </SegmentedControl.Item>
        ))}
      </SegmentedControl.Root>
      <Text style={[a.text_sm, a.leading_snug]}>
        <Trans>
          Accounts grouped by the week they signed up, and how many were active
          on day 1, 7 and 30 after. A dash means the day has not come yet.
        </Trans>
      </Text>
      {retention.isLoading ? (
        <Loader />
      ) : retention.isError ? (
        <LoadError
          error={retention.error}
          onRetry={() => void retention.refetch()}
        />
      ) : !cohorts.length ? (
        <Text style={[a.text_md, a.italic]}>
          <Trans>No sign-ups in this period yet.</Trans>
        </Text>
      ) : (
        <RetentionTable cohorts={cohorts} />
      )}
    </View>
  )
}

function RetentionTable({cohorts}: {cohorts: RetentionCohort[]}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const heads: Record<RetentionKey, string> = {
    d1: l`Day 1`,
    d7: l`Day 7`,
    d30: l`Day 30`,
  }
  return (
    <View testID="retentionTable" accessibilityRole="list">
      <View style={[a.flex_row, a.gap_sm, a.pb_sm]} accessible={false}>
        <Text
          style={[
            a.flex_1,
            a.text_xs,
            a.font_semi_bold,
            t.atoms.text_contrast_medium,
          ]}>
          <Trans>Week</Trans>
        </Text>
        {RETENTION_KEYS.map(key => (
          <Text
            key={key}
            style={[
              a.text_xs,
              a.font_semi_bold,
              a.text_right,
              t.atoms.text_contrast_medium,
              {width: 72},
            ]}>
            {heads[key]}
          </Text>
        ))}
      </View>
      {cohorts.map(cohort => (
        <CohortRow key={cohort.week} cohort={cohort} heads={heads} />
      ))}
    </View>
  )
}

function CohortRow({
  cohort,
  heads,
}: {
  cohort: RetentionCohort
  heads: Record<RetentionKey, string>
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const week = i18n.date(cohortDate(cohort.week), {
    dateStyle: 'medium',
    timeZone: 'UTC',
  })
  const size = i18n.number(cohort.size)
  const cells = RETENTION_KEYS.map(key => ({
    key,
    cell: retentionCell(cohort, key),
  }))
  const summary = cells
    .map(({key, cell}) =>
      cell
        ? `${heads[key]}: ${cell.count} (${formatPercent(cell.percent)})`
        : '',
    )
    .filter(Boolean)
    .join(', ')
  return (
    <View
      testID={`cohort-${cohort.week}`}
      accessible
      accessibilityLabel={l`Week of ${week}, ${size} sign-ups. ${summary}`}
      accessibilityHint=""
      style={[
        a.flex_row,
        a.gap_sm,
        a.py_md,
        a.border_t,
        t.atoms.border_contrast_low,
      ]}>
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text style={[a.text_sm, a.font_semi_bold]}>{week}</Text>
        <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
          <Trans>{size} sign-ups</Trans>
        </Text>
      </View>
      {cells.map(({key, cell}) => (
        <View key={key} style={[a.align_end, {width: 72}]}>
          {cell ? (
            <>
              <Text style={[a.text_sm, a.font_semi_bold]}>
                {formatPercent(cell.percent)}
              </Text>
              <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
                {i18n.number(cell.count)}
              </Text>
            </>
          ) : (
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>-</Text>
          )}
        </View>
      ))}
    </View>
  )
}
