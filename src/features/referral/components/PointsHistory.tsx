import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {type PointsEntry} from '../api'
import {matchPointsEvent, type PointsEvent} from '../pointsEvents'
import {usePointsEntriesQuery} from '../queries'

/** What a points entry is for, in the viewer's language */
export function usePointsEntryLabel() {
  const {t: l} = useLingui()
  const labels: Record<PointsEvent, string> = {
    'referral.inviter': l`A friend joined with your code`,
    'referral.invitee': l`You joined with a referral code`,
    'wallet.linked': l`Linked a wallet`,
    'post.first': l`Posted for the first time`,
  }
  return (entry: Pick<PointsEntry, 'event' | 'ruleId' | 'note'>) => {
    const event = matchPointsEvent(entry.event, entry.ruleId)
    return event ? labels[event] : entry.note || l`Krao points`
  }
}

/** The viewer's recent points, newest first. Rows for a SettingsList.Container. */
export function PointsHistory() {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const entriesQuery = usePointsEntriesQuery()
  const labelOf = usePointsEntryLabel()
  const entries = entriesQuery.data?.entries ?? []

  const status: Record<PointsEntry['status'], string> = {
    pending: l`Pending`,
    approved: l`Approved`,
    void: l`Cancelled`,
  }

  return (
    <>
      <SettingsList.Item>
        <Text style={[a.text_md, a.font_semi_bold]}>
          <Trans>Points history</Trans>
        </Text>
      </SettingsList.Item>
      {entriesQuery.isLoading ? (
        <SettingsList.Item>
          <Loader />
        </SettingsList.Item>
      ) : entriesQuery.isError ? (
        <SettingsList.Item>
          <Text style={[a.text_sm, {color: t.palette.negative_500}]}>
            <Trans>Could not load your points history.</Trans>
          </Text>
        </SettingsList.Item>
      ) : !entries.length ? (
        <SettingsList.Item>
          <Text style={[a.text_md, a.italic, a.flex_1]}>
            <Trans>
              No points yet. Link a wallet or write your first post to earn
              some.
            </Trans>
          </Text>
        </SettingsList.Item>
      ) : (
        entries.map(entry => (
          <SettingsList.Item key={entry.id}>
            <View style={[a.flex_1, a.gap_2xs]}>
              <Text style={[a.text_md]}>{labelOf(entry)}</Text>
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                {i18n.date(new Date(entry.createdAt), {dateStyle: 'medium'})} ·{' '}
                {status[entry.status]}
              </Text>
            </View>
            <Text
              style={[
                a.text_md,
                a.font_semi_bold,
                entry.status === 'void' && {textDecorationLine: 'line-through'},
              ]}>
              {entry.amount > 0 ? '+' : ''}
              {i18n.number(entry.amount)}
            </Text>
          </SettingsList.Item>
        ))
      )}
    </>
  )
}
