import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {useAuditLogQuery} from '../queries'
import {AccountName, EmptyRow, useFormatDate} from './shared'

/** Admin and system actions, newest first */
export function LogTab() {
  const t = useTheme()
  const formatDate = useFormatDate()
  const {data, isLoading, isError} = useAuditLogQuery()

  if (isLoading) return <Loader />
  if (isError) {
    return (
      <Admonition.Admonition type="error">
        <Trans>Could not load the log.</Trans>
      </Admonition.Admonition>
    )
  }
  if (!data?.length) return <EmptyRow />
  return (
    <View style={[a.border, a.rounded_md, t.atoms.border_contrast_low]}>
      {data.map((entry, i) => (
        <View
          key={entry.id}
          style={[
            a.p_md,
            a.gap_2xs,
            i > 0 && [a.border_t, t.atoms.border_contrast_low],
          ]}>
          <Text style={[a.text_md, a.font_semi_bold]}>{entry.action}</Text>
          {entry.subject?.startsWith('did:') ? (
            <AccountName did={entry.subject} />
          ) : entry.subject ? (
            <Text style={[a.text_md]}>{entry.subject}</Text>
          ) : null}
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            {formatDate(entry.createdAt)} ·{' '}
            {entry.actor === 'system' ? 'system' : entry.actor}
          </Text>
          {entry.data ? (
            <Text
              selectable
              style={[a.text_xs, t.atoms.text_contrast_medium]}
              numberOfLines={4}>
              {entry.data}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  )
}
