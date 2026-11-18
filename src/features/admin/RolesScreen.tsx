import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Toggle from '#/components/forms/Toggle'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {Field} from '#/features/referral/admin/components/CodesTab'
import {
  AccountName,
  EmptyRow,
  useAccountLabel,
  useFormatDate,
  useResolveAccount,
} from '#/features/referral/admin/components/shared'
import {
  type AdminRole,
  canToggleRole,
  isImpliedRole,
  isLockedRole,
  type RoleMember,
  ROLES,
  sortMembers,
} from './logic'
import {isForbidden, useRolesListQuery, useSetRoleMutation} from './queries'
import {useRoleText, useSetRoleErrorText} from './text'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'AdminRoles'>

/**
 * Admin > Roles: who holds which role. Roles that come from the service's
 * environment are shown locked; the others switch on and off. Everything
 * done here is logged by the service.
 */
export function RolesScreen({}: Props) {
  const query = useRolesListQuery()
  const forbidden = isForbidden(query.error)

  return (
    <Layout.Screen testID="adminRolesScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Roles</Trans>
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
              <AddMember />
              {query.isLoading ? (
                <Loader />
              ) : query.isError ? (
                <Admonition.Admonition type="error">
                  <Trans>Could not load the roles.</Trans>
                </Admonition.Admonition>
              ) : !query.data?.length ? (
                <EmptyRow />
              ) : (
                <View style={[a.gap_md]}>
                  {sortMembers(query.data).map(member => (
                    <Member key={member.did} member={member} />
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </Layout.Content>
    </Layout.Screen>
  )
}

/** Gives a first role to an account found by handle */
function AddMember() {
  const t = useTheme()
  const {t: l} = useLingui()
  const roleText = useRoleText()
  const resolve = useResolveAccount()
  const setRole = useSetRoleMutation()
  const errorText = useSetRoleErrorText()
  const [handle, setHandle] = useState('')
  const [role, setRoleValue] = useState<AdminRole>('moderator')
  const [error, setError] = useState('')

  const onAdd = async () => {
    setError('')
    let did: string
    try {
      did = await resolve(handle)
    } catch {
      setError(l`No account with that handle.`)
      return
    }
    setRole.mutate(
      {did, role, enabled: true},
      {
        onSuccess: () => {
          Toast.show(l`Role added`, {type: 'success'})
          setHandle('')
        },
        onError: err => setError(errorText(err)),
      },
    )
  }

  return (
    <View
      style={[
        a.gap_md,
        a.p_md,
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_low,
      ]}>
      <View style={[a.gap_2xs]}>
        <Text style={[a.text_md, a.font_semi_bold]}>
          <Trans>Add someone</Trans>
        </Text>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>
            Takes effect within a minute in every Krao service, and is logged.
          </Trans>
        </Text>
      </View>
      <Field label={l`Handle`} value={handle} onChange={setHandle} />
      <View
        style={[a.flex_row, a.flex_wrap, a.gap_sm]}
        accessibilityRole="radiogroup">
        {ROLES.map(r => (
          <Button
            key={r}
            label={roleText[r].name}
            accessibilityHint={roleText[r].description}
            accessibilityRole="radio"
            accessibilityState={{selected: role === r}}
            color={role === r ? 'primary' : 'secondary'}
            size="small"
            onPress={() => setRoleValue(r)}>
            <ButtonText>{roleText[r].name}</ButtonText>
          </Button>
        ))}
      </View>
      {error ? (
        <Admonition.Admonition type="error">{error}</Admonition.Admonition>
      ) : null}
      <Button
        label={l`Add role`}
        color="primary"
        size="large"
        disabled={setRole.isPending || !handle.trim()}
        onPress={() => void onAdd()}>
        {setRole.isPending && <ButtonIcon icon={Loader} />}
        <ButtonText>
          <Trans>Add role</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}

function Member({member}: {member: RoleMember}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  const roleText = useRoleText()
  const formatDate = useFormatDate()
  const setRole = useSetRoleMutation()
  const errorText = useSetRoleErrorText()
  const name = useAccountLabel(member.did)
  const removePrompt = Prompt.usePromptControl()
  const [removing, setRemoving] = useState<AdminRole | null>(null)
  const [error, setError] = useState('')

  const save = (role: AdminRole, enabled: boolean) => {
    setError('')
    setRole.mutate(
      {did: member.did, role, enabled},
      {
        onSuccess: () =>
          Toast.show(enabled ? l`Role added` : l`Role removed`, {
            type: 'success',
          }),
        onError: err => setError(errorText(err)),
      },
    )
  }

  /** Granting is immediate; taking a role away is confirmed first */
  const onToggle = (role: AdminRole, enabled: boolean) => {
    if (enabled) {
      save(role, true)
      return
    }
    setRemoving(role)
    removePrompt.open()
  }

  return (
    <View
      style={[
        a.gap_xs,
        a.p_md,
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_low,
      ]}>
      <AccountName did={member.did} />
      {ROLES.map(role => {
        const held = member.roles.find(r => r.role === role)
        const locked = !!held && isLockedRole(held)
        const implied = isImpliedRole(member, role)
        const allowed = canToggleRole(currentAccount?.did, member, role)
        const note = locked
          ? l`from configuration`
          : implied
            ? l`included with Admin`
            : ''
        const label = note
          ? `${roleText[role].name} · ${note}`
          : roleText[role].name
        return (
          <View key={role}>
            <Toggle.Item
              name={role}
              label={label}
              value={!!held || implied}
              disabled={!allowed || setRole.isPending}
              onChange={enabled => onToggle(role, enabled)}>
              <Toggle.LabelText style={[a.flex_1]}>{label}</Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>
            {held?.grantedAt ? (
              <Text
                style={[a.text_xs, a.pl_xs, t.atoms.text_contrast_medium]}
                numberOfLines={1}>
                {formatDate(held.grantedAt)}
              </Text>
            ) : null}
          </View>
        )
      })}
      {error ? (
        <Admonition.Admonition type="error">{error}</Admonition.Admonition>
      ) : null}
      <Prompt.Basic
        control={removePrompt}
        title={
          removing
            ? l`Remove ${roleText[removing].name} from ${name}?`
            : l`Remove this role?`
        }
        description={
          removing === 'admin'
            ? l`They will no longer manage roles, and lose every role they had only as an admin. Takes effect within a minute in every Krao service, and is logged.`
            : l`Takes effect within a minute in every Krao service, and is logged.`
        }
        confirmButtonCta={l`Remove role`}
        confirmButtonColor="negative"
        onConfirm={() => {
          if (removing) save(removing, false)
        }}
      />
    </View>
  )
}
