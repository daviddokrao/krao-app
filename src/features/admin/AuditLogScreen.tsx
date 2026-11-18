import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {atoms as a, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {Field} from '#/features/referral/admin/components/CodesTab'
import {
  AccountName,
  EmptyRow,
  LoadMore,
  useFormatDate,
  useResolveAccount,
} from '#/features/referral/admin/components/shared'
import {
  AUDIT_SERVICES,
  type AuditEntry,
  type AuditService,
  auditService,
  formatAuditDetails,
  isDid,
} from './logic'
import {isForbidden, useAuditLogQuery} from './queries'
import {useServiceText} from './text'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'AdminAuditLog'>

/**
 * Admin > Audit log: what admins did in every Krao service, newest first,
 * filtered by service and by who did it.
 */
export function AuditLogScreen({}: Props) {
  const t = useTheme()
  const {t: l} = useLingui()
  const serviceText = useServiceText()
  const resolve = useResolveAccount()
  const [service, setService] = useState<AuditService | undefined>()
  const [actorInput, setActorInput] = useState('')
  const [actor, setActor] = useState<string | undefined>()
  const [actorError, setActorError] = useState('')
  const query = useAuditLogQuery({service, actor})
  const forbidden = isForbidden(query.error)

  const applyActor = async () => {
    setActorError('')
    if (!actorInput.trim()) {
      setActor(undefined)
      return
    }
    try {
      setActor(
        isDid(actorInput.trim())
          ? actorInput.trim()
          : await resolve(actorInput),
      )
    } catch {
      setActorError(l`No account with that handle.`)
    }
  }

  return (
    <Layout.Screen testID="adminAuditLogScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Audit log</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <View style={[a.p_lg, a.gap_lg]}>
          {forbidden ? (
            <Admonition.Admonition type="error">
              <Trans>Only Krao admins can open this page.</Trans>
            </Admonition.Admonition>
          ) : (
            <>
              <View style={[a.gap_md]}>
                <View
                  style={[a.flex_row, a.flex_wrap, a.gap_sm]}
                  accessibilityRole="radiogroup">
                  <Button
                    label={l`All services`}
                    accessibilityRole="radio"
                    accessibilityState={{selected: !service}}
                    color={!service ? 'primary' : 'secondary'}
                    size="small"
                    onPress={() => setService(undefined)}>
                    <ButtonText>
                      <Trans>All</Trans>
                    </ButtonText>
                  </Button>
                  {AUDIT_SERVICES.map(s => (
                    <Button
                      key={s}
                      label={serviceText[s]}
                      accessibilityRole="radio"
                      accessibilityState={{selected: service === s}}
                      color={service === s ? 'primary' : 'secondary'}
                      size="small"
                      onPress={() => setService(s)}>
                      <ButtonText>{serviceText[s]}</ButtonText>
                    </Button>
                  ))}
                </View>
                <Field
                  label={l`Done by (handle or DID)`}
                  value={actorInput}
                  onChange={setActorInput}
                />
                {actorError ? (
                  <Admonition.Admonition type="error">
                    {actorError}
                  </Admonition.Admonition>
                ) : null}
                <Button
                  label={l`Filter`}
                  color="secondary"
                  size="small"
                  style={[a.self_start]}
                  onPress={() => void applyActor()}>
                  <ButtonText>
                    <Trans>Filter</Trans>
                  </ButtonText>
                </Button>
              </View>
              {query.isLoading ? (
                <Loader />
              ) : query.isError ? (
                <Admonition.Admonition type="error">
                  <Trans>Could not load the log.</Trans>
                </Admonition.Admonition>
              ) : !query.data?.length ? (
                <EmptyRow />
              ) : (
                <View>
                  <View
                    style={[
                      a.border,
                      a.rounded_md,
                      t.atoms.border_contrast_low,
                    ]}>
                    {query.data.map((entry, i) => (
                      <Entry key={entry.id} entry={entry} first={i === 0} />
                    ))}
                  </View>
                  <LoadMore query={query} />
                </View>
              )}
            </>
          )}
        </View>
      </Layout.Content>
    </Layout.Screen>
  )
}

function Entry({entry, first}: {entry: AuditEntry; first: boolean}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const formatDate = useFormatDate()
  const serviceText = useServiceText()
  const known = auditService(entry)
  const details = formatAuditDetails(entry.details)
  return (
    <View
      style={[
        a.p_md,
        a.gap_2xs,
        !first && [a.border_t, t.atoms.border_contrast_low],
      ]}>
      <Text style={[a.text_md, a.font_semi_bold]} selectable>
        {entry.action}
      </Text>
      {isDid(entry.subject) ? (
        <AccountName did={entry.subject} />
      ) : entry.subject ? (
        <Text style={[a.text_md]} selectable>
          {entry.subject}
        </Text>
      ) : null}
      <View style={[a.flex_row, a.flex_wrap, a.align_center, a.gap_xs]}>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          {formatDate(entry.createdAt)} ·{' '}
          {known ? serviceText[known] : entry.service} ·
        </Text>
        {isDid(entry.actor) ? (
          <AccountName did={entry.actor} />
        ) : (
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            {entry.actor === 'system' ? l`Automatic` : entry.actor}
          </Text>
        )}
      </View>
      {details ? (
        <Text
          selectable
          style={[a.text_xs, t.atoms.text_contrast_medium]}
          numberOfLines={6}>
          {details}
        </Text>
      ) : null}
    </View>
  )
}
