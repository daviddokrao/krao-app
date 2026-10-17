import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {atoms as a, useTheme, web} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as TextField from '#/components/forms/TextField'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {IndexerError} from '#/features/community/api'
import {
  AccountName,
  EmptyRow,
  LoadMore,
  useFormatDate,
} from '#/features/referral/admin/components/shared'
import {MiniAppIcon} from './components/MiniAppIcon'
import {usePermissionText, useStatusText} from './components/text'
import {knownPermissions, type MiniAppView} from './logic'
import {
  isForbidden,
  useApproveAppMutation,
  useApprovedAppsQuery,
  usePendingAppsQuery,
  useRevokeAppMutation,
} from './queries'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'MiniAppsAdmin'>

type Tab = 'pending' | 'approved'

/**
 * Safety admins: review the Mini Apps developers have published. An
 * approval is for exactly the version (cid) shown here; if the developer
 * edits the app, it comes back as pending.
 */
export function MiniAppsAdminScreen({}: Props) {
  const {t: l} = useLingui()
  const pending = usePendingAppsQuery()
  const [tab, setTab] = useState<Tab>('pending')

  return (
    <Layout.Screen testID="miniAppsAdminScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Mini Apps</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <View style={[a.p_lg, a.gap_xl]} aria-label={l`Mini Apps review`}>
          {pending.isLoading ? (
            <Loader />
          ) : isForbidden(pending.error) ? (
            <Admonition.Admonition type="error">
              <Trans>You do not have permission to review Mini Apps.</Trans>
            </Admonition.Admonition>
          ) : pending.isError ? (
            <Admonition.Admonition type="error">
              <Trans>Could not reach the indexer.</Trans>
            </Admonition.Admonition>
          ) : (
            <>
              <SegmentedControl.Root
                label={l`Mini Apps`}
                type="tabs"
                value={tab}
                onChange={setTab}>
                <SegmentedControl.Item value="pending" label={l`Waiting`}>
                  <SegmentedControl.ItemText>
                    <Trans>Waiting</Trans>
                  </SegmentedControl.ItemText>
                </SegmentedControl.Item>
                <SegmentedControl.Item value="approved" label={l`Approved`}>
                  <SegmentedControl.ItemText>
                    <Trans>Approved</Trans>
                  </SegmentedControl.ItemText>
                </SegmentedControl.Item>
              </SegmentedControl.Root>
              {tab === 'pending' ? <PendingList /> : <ApprovedList />}
            </>
          )}
        </View>
      </Layout.Content>
    </Layout.Screen>
  )
}

function PendingList() {
  const query = usePendingAppsQuery()
  const apps = query.data?.pages.flatMap(p => p.apps) ?? []
  if (query.isLoading) return <Loader />
  if (!apps.length) return <EmptyRow />
  return (
    <View style={[a.gap_lg]}>
      {apps.map(app => (
        <ReviewCard key={`${app.uri}@${app.cid}`} app={app} />
      ))}
      <LoadMore query={query} />
    </View>
  )
}

function ApprovedList() {
  const query = useApprovedAppsQuery()
  const apps = query.data?.pages.flatMap(p => p.apps) ?? []
  if (query.isLoading) return <Loader />
  if (!apps.length) return <EmptyRow />
  return (
    <View style={[a.gap_lg]}>
      {apps.map(app => (
        <ReviewCard key={`${app.uri}@${app.cid}`} app={app} />
      ))}
      <LoadMore query={query} />
    </View>
  )
}

/** One app with everything an admin should see before deciding */
function ReviewCard({app}: {app: MiniAppView}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const formatDate = useFormatDate()
  const permissionText = usePermissionText()
  const statusText = useStatusText()
  const approve = useApproveAppMutation()
  const approveControl = Prompt.usePromptControl()
  const revokeControl = Dialog.useDialogControl()
  const unknown = app.permissions.filter(
    p => !knownPermissions(app.permissions).includes(p as never),
  )

  return (
    <View
      testID={`miniAppReview-${app.name}`}
      style={[
        a.p_md,
        a.gap_md,
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_low,
      ]}>
      <View style={[a.flex_row, a.gap_md, a.align_center]}>
        <MiniAppIcon name={app.name} uri={app.uri} iconUrl={app.iconUrl} />
        <View style={[a.flex_1, a.gap_2xs]}>
          <Text emoji numberOfLines={1} style={[a.text_md, a.font_bold]}>
            {app.name}
          </Text>
          <AccountName did={app.developer} />
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            {statusText[app.status]} · {formatDate(app.indexedAt)}
          </Text>
        </View>
      </View>
      {!!(app.revokedReason || app.invalidReason) && (
        <Text
          testID="miniAppReason"
          style={[a.text_sm, a.leading_snug, {color: t.palette.negative_500}]}>
          {app.revokedReason ?? app.invalidReason}
        </Text>
      )}
      {!!app.description && (
        <Text style={[a.text_sm, a.leading_snug]}>{app.description}</Text>
      )}
      <View style={[a.gap_2xs]}>
        <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
          <Trans>Address</Trans>
        </Text>
        <Text selectable style={[a.text_sm, web({wordBreak: 'break-all'})]}>
          {app.url}
        </Text>
      </View>
      <View style={[a.gap_2xs]}>
        <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
          <Trans>Asks for</Trans>
        </Text>
        {knownPermissions(app.permissions).length === 0 &&
        unknown.length === 0 ? (
          <Text style={[a.text_sm]}>
            <Trans>No permissions</Trans>
          </Text>
        ) : (
          knownPermissions(app.permissions).map(p => (
            <Text key={p} style={[a.text_sm]}>
              {permissionText[p].title}
            </Text>
          ))
        )}
        {unknown.map(p => (
          <Text key={p} style={[a.text_sm, t.atoms.text_contrast_medium]}>
            {p}
          </Text>
        ))}
      </View>
      <Text selectable style={[a.text_xs, t.atoms.text_contrast_low]}>
        {app.cid}
      </Text>
      {approve.isError && (
        <Admonition.Admonition type="error">
          {approve.error instanceof IndexerError &&
          approve.error.error === 'CidMismatch' ? (
            <Trans>
              The developer changed the app while you were looking. Refresh the
              list and review the new version.
            </Trans>
          ) : approve.error instanceof IndexerError &&
            approve.error.error === 'UnsafeDomain' ? (
            <Trans>
              The app’s domain is on the scam list, so it can’t be approved.
            </Trans>
          ) : approve.error instanceof IndexerError &&
            approve.error.error === 'InvalidApp' ? (
            <Trans>The app breaks the rules, so it can’t be approved.</Trans>
          ) : (
            <Trans>
              Could not approve. The app may have changed; refresh the list.
            </Trans>
          )}
        </Admonition.Admonition>
      )}
      <View style={[a.flex_row, a.gap_sm, a.flex_wrap]}>
        {app.status !== 'approved' && (
          <Button
            testID="miniAppApproveButton"
            label={l`Approve ${app.name}`}
            color="primary"
            size="small"
            disabled={approve.isPending}
            onPress={approveControl.open}>
            {approve.isPending && <ButtonIcon icon={Loader} />}
            <ButtonText>
              <Trans>Approve</Trans>
            </ButtonText>
          </Button>
        )}
        {app.status !== 'revoked' && (
          <Button
            testID="miniAppRevokeButton"
            label={l`Revoke ${app.name}`}
            color="negative_subtle"
            size="small"
            onPress={revokeControl.open}>
            <ButtonText>
              <Trans>Revoke</Trans>
            </ButtonText>
          </Button>
        )}
      </View>
      <Prompt.Basic
        control={approveControl}
        title={l`Approve ${app.name}?`}
        description={l`Everyone will be able to open exactly this version. If the developer changes it, it will wait for review again.`}
        confirmButtonCta={l`Approve`}
        onConfirm={() =>
          approve.mutate(
            {uri: app.uri, cid: app.cid},
            {
              onSuccess: () =>
                Toast.show(l`Approved ${app.name}`, {type: 'success'}),
            },
          )
        }
      />
      <RevokeDialog control={revokeControl} app={app} />
    </View>
  )
}

function RevokeDialog({
  control,
  app,
}: {
  control: Dialog.DialogControlProps
  app: MiniAppView
}) {
  const {t: l} = useLingui()
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={l`Revoke ${app.name}`}
        style={web({maxWidth: 440})}>
        <RevokeInner control={control} app={app} />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function RevokeInner({
  control,
  app,
}: {
  control: Dialog.DialogControlProps
  app: MiniAppView
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const revoke = useRevokeAppMutation()
  const [reason, setReason] = useState('')
  return (
    <View style={[a.gap_lg]}>
      <View style={[a.gap_xs]}>
        <Text style={[a.text_2xl, a.font_bold]}>
          <Trans>Revoke {app.name}?</Trans>
        </Text>
        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
          <Trans>
            It stops opening for everyone right away. The action is logged with
            your account.
          </Trans>
        </Text>
      </View>
      <TextField.Root>
        <TextField.Input
          testID="miniAppRevokeReason"
          label={l`Reason`}
          placeholder={l`Reason (optional)`}
          value={reason}
          onChangeText={setReason}
          maxLength={300}
        />
      </TextField.Root>
      {revoke.isError && (
        <Admonition.Admonition type="error">
          <Trans>Could not revoke. Please try again.</Trans>
        </Admonition.Admonition>
      )}
      <Button
        testID="miniAppRevokeConfirm"
        label={l`Revoke`}
        color="negative"
        size="large"
        disabled={revoke.isPending}
        onPress={() =>
          revoke.mutate(
            {uri: app.uri, reason: reason.trim() || undefined},
            {
              onSuccess: () =>
                control.close(() => {
                  Toast.show(l`Revoked ${app.name}`, {type: 'success'})
                }),
            },
          )
        }>
        {revoke.isPending && <ButtonIcon icon={Loader} />}
        <ButtonText>
          <Trans>Revoke</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}
