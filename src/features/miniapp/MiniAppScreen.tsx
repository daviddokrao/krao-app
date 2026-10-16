import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {
  type CommonNavigatorParams,
  type NavigationProp,
} from '#/lib/routes/types'
import {useSession} from '#/state/session'
import {atoms as a, useTheme, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {DotGrid3x1_Stroke2_Corner0_Rounded as DotsIcon} from '#/components/icons/DotGrid'
import {Flag_Stroke2_Corner0_Rounded as FlagIcon} from '#/components/icons/Flag'
import {TimesLarge_Stroke2_Corner0_Rounded as CloseIcon} from '#/components/icons/Times'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import * as Menu from '#/components/Menu'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {effectivePermissions} from './bridge'
import {MiniAppFrame} from './components/MiniAppFrame'
import {MiniAppIcon} from './components/MiniAppIcon'
import {ReportMiniAppDialog} from './components/ReportMiniAppDialog'
import {usePermissionText, useStatusText} from './components/text'
import {getGrant, saveGrant} from './grants'
import {hostOrigins} from './hostOrigins'
import {
  canRunApp,
  isSameOriginAsHost,
  knownPermissions,
  manifestOrigin,
  miniAppUri,
  type MiniAppView,
  type Permission,
} from './logic'
import {useMiniAppQuery} from './queries'
import {useMiniAppHandlers} from './useMiniAppHandlers'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'MiniApp'>

function useCloseMiniApp() {
  const navigation = useNavigation<NavigationProp>()
  return () => {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.navigate('MiniApps')
  }
}

/**
 * Runs a Mini App: checks with the indexer, right now, that Krao has
 * approved the current version, asks the person once what it may do, and
 * only then loads it in a sandboxed frame.
 */
export function MiniAppScreen({route}: Props) {
  const {did, rkey} = route.params
  const uri = miniAppUri(did, rkey)
  const query = useMiniAppQuery(uri, {fresh: true})
  const app = query.data

  return (
    <Layout.Screen testID="miniAppScreen" minimalShell>
      {query.isLoading ? (
        <>
          <PlainHeader title={null} />
          <View style={[a.p_xl, a.align_center]}>
            <Loader size="xl" />
          </View>
        </>
      ) : query.isError || !app ? (
        <>
          <PlainHeader title={null} />
          <Message
            testID="miniAppNotFound"
            titleText={<Trans>Mini App not found</Trans>}
            bodyText={
              <Trans>
                This Mini App does not exist any more, or Krao could not be
                reached.
              </Trans>
            }
            onRetry={() => void query.refetch()}
          />
        </>
      ) : (
        <AppGate app={app} />
      )}
    </Layout.Screen>
  )
}

function AppGate({app}: {app: MiniAppView}) {
  const status = useStatusText()
  const origin = manifestOrigin(app)
  const close = useCloseMiniApp()

  if (!canRunApp(app)) {
    return (
      <>
        <PlainHeader title={app.name} />
        <Message
          testID="miniAppNotApproved"
          titleText={<Trans>Mini App not approved by Krao</Trans>}
          bodyText={
            <Trans>
              {status[app.status]}. Krao only opens Mini Apps it has reviewed,
              and a changed Mini App has to be reviewed again.
            </Trans>
          }
        />
      </>
    )
  }
  if (!origin || hostOrigins().some(h => isSameOriginAsHost(origin, h))) {
    return (
      <>
        <PlainHeader title={app.name} />
        <Message
          testID="miniAppInvalidOrigin"
          titleText={<Trans>This Mini App can’t be opened</Trans>}
          bodyText={
            <Trans>
              Its address is not one Krao can run safely. Nothing was loaded.
            </Trans>
          }
        />
      </>
    )
  }
  return <Gated app={app} origin={origin} onClose={close} />
}

/** Asks for permissions the first time (per app version), then runs */
function Gated({
  app,
  origin,
  onClose,
}: {
  app: MiniAppView
  origin: string
  onClose: () => void
}) {
  const {currentAccount} = useSession()
  const declared = knownPermissions(app.permissions)
  const stored = currentAccount
    ? getGrant(currentAccount.did, app.uri, app.cid)
    : undefined
  const [given, setGiven] = useState<Permission[]>()
  const granted = given ?? stored

  if (declared.length > 0 && !granted) {
    return (
      <>
        <PlainHeader title={app.name} />
        <PermissionPrompt
          app={app}
          origin={origin}
          permissions={declared}
          onAllow={() => {
            if (currentAccount) {
              saveGrant(currentAccount.did, app.uri, app.cid, declared)
            }
            setGiven(declared)
          }}
          onDeny={onClose}
        />
      </>
    )
  }
  return (
    <Runner
      app={app}
      origin={origin}
      granted={granted ?? []}
      onClose={onClose}
    />
  )
}

function Runner({
  app,
  origin,
  granted,
  onClose,
}: {
  app: MiniAppView
  origin: string
  granted: Permission[]
  onClose: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const reportControl = Dialog.useDialogControl()
  const {handlers, dialog} = useMiniAppHandlers({app, origin, onClose})
  // In force: what the manifest declares and the person granted
  const permissions = effectivePermissions(app.permissions, granted)

  return (
    <>
      {/*
       * On the web the runner takes exactly one viewport and never scrolls
       * the page, so the frame gets the space under the header and no more.
       */}
      <View
        style={[
          IS_WEB ? web({height: '100dvh', flexShrink: 0}) : a.flex_1,
          a.overflow_hidden,
        ]}>
        <Layout.Header.Outer>
          <Layout.Header.Slot>
            <Button
              testID="miniAppCloseButton"
              label={l`Close Mini App`}
              size="small"
              variant="ghost"
              color="secondary"
              shape="round"
              onPress={onClose}>
              <ButtonIcon icon={CloseIcon} size="lg" />
            </Button>
          </Layout.Header.Slot>
          <Layout.Header.Content align="left">
            <Layout.Header.TitleText>{app.name}</Layout.Header.TitleText>
            <Text
              testID="miniAppOrigin"
              numberOfLines={1}
              style={[a.text_xs, t.atoms.text_contrast_medium]}>
              {origin}
            </Text>
          </Layout.Header.Content>
          <Layout.Header.Slot>
            <Menu.Root>
              <Menu.Trigger label={l`Mini App options`}>
                {({props}) => (
                  <Button
                    testID="miniAppMenuButton"
                    label={props.accessibilityLabel}
                    {...props}
                    size="small"
                    color="secondary"
                    shape="round"
                    variant="ghost"
                    style={[a.bg_transparent]}>
                    <ButtonIcon icon={DotsIcon} size="md" />
                  </Button>
                )}
              </Menu.Trigger>
              <Menu.Outer>
                <Menu.Group>
                  <Menu.Item
                    testID="miniAppReportMenuItem"
                    destructive
                    label={l`Report Mini App`}
                    onPress={reportControl.open}>
                    <Menu.ItemIcon icon={FlagIcon} />
                    <Menu.ItemText>
                      <Trans>Report Mini App</Trans>
                    </Menu.ItemText>
                  </Menu.Item>
                </Menu.Group>
              </Menu.Outer>
            </Menu.Root>
          </Layout.Header.Slot>
        </Layout.Header.Outer>
        {/*
         * The frame lives in the center column under the header, in normal
         * layout flow, and is clipped to it: the Mini App can never draw over
         * or under Krao's own navigation, header or buttons.
         */}
        <Layout.Center
          testID="miniAppFrameContainer"
          style={[
            a.flex_1,
            a.overflow_hidden,
            web({minHeight: 0, position: 'relative', isolation: 'isolate'}),
          ]}>
          <MiniAppFrame
            url={app.url}
            origin={origin}
            title={app.name}
            isApproved={() => true}
            permissions={() => permissions}
            handlers={handlers}
          />
        </Layout.Center>
      </View>
      {dialog}
      <ReportMiniAppDialog control={reportControl} app={app} />
    </>
  )
}

function PlainHeader({title}: {title: string | null}) {
  const close = useCloseMiniApp()
  const {t: l} = useLingui()
  return (
    <Layout.Header.Outer>
      <Layout.Header.Slot>
        <Button
          label={l`Close Mini App`}
          size="small"
          variant="ghost"
          color="secondary"
          shape="round"
          onPress={close}>
          <ButtonIcon icon={CloseIcon} size="lg" />
        </Button>
      </Layout.Header.Slot>
      <Layout.Header.Content>
        <Layout.Header.TitleText>
          {title ?? <Trans>Mini App</Trans>}
        </Layout.Header.TitleText>
      </Layout.Header.Content>
      <Layout.Header.Slot />
    </Layout.Header.Outer>
  )
}

function Message({
  testID,
  titleText,
  bodyText,
  onRetry,
}: {
  testID: string
  titleText: React.ReactNode
  bodyText: React.ReactNode
  onRetry?: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View testID={testID} style={[a.p_xl, a.pt_3xl, a.align_center, a.gap_md]}>
      <Text style={[a.text_lg, a.font_semi_bold, a.text_center]}>
        {titleText}
      </Text>
      <Text
        style={[
          a.text_md,
          a.text_center,
          a.leading_snug,
          t.atoms.text_contrast_medium,
        ]}>
        {bodyText}
      </Text>
      {onRetry && (
        <Button
          label={l`Try again`}
          color="secondary"
          size="small"
          onPress={onRetry}>
          <ButtonText>
            <Trans>Try again</Trans>
          </ButtonText>
        </Button>
      )}
    </View>
  )
}

function PermissionPrompt({
  app,
  origin,
  permissions,
  onAllow,
  onDeny,
}: {
  app: MiniAppView
  origin: string
  permissions: Permission[]
  onAllow: () => void
  onDeny: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const text = usePermissionText()
  return (
    <Layout.Content>
      <View testID="miniAppPermissionPrompt" style={[a.p_xl, a.gap_xl]}>
        <View style={[a.flex_row, a.gap_md, a.align_center]}>
          <MiniAppIcon name={app.name} uri={app.uri} iconUrl={app.iconUrl} />
          <View style={[a.flex_1, a.gap_2xs]}>
            <Text emoji style={[a.text_xl, a.font_bold]}>
              <Trans>{app.name} wants to:</Trans>
            </Text>
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              {origin}
            </Text>
          </View>
        </View>
        <View style={[a.gap_md]}>
          {permissions.map(p => (
            <View key={p} style={[a.gap_2xs]}>
              <Text style={[a.text_md, a.font_semi_bold]}>{text[p].title}</Text>
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                {text[p].detail}
              </Text>
            </View>
          ))}
        </View>
        <Admonition type="info">
          <Trans>
            Krao has reviewed this Mini App, but it is made by someone else.
            Your funds stay in your wallet: every signature and payment is shown
            to you first.
          </Trans>
        </Admonition>
        <View style={[a.gap_sm]}>
          <Button
            testID="miniAppAllowButton"
            label={l`Allow`}
            color="primary"
            size="large"
            onPress={onAllow}>
            <ButtonText>
              <Trans>Allow</Trans>
            </ButtonText>
          </Button>
          <Button
            testID="miniAppDenyButton"
            label={l`Don’t allow`}
            color="secondary"
            size="large"
            onPress={onDeny}>
            <ButtonText>
              <Trans>Don’t allow</Trans>
            </ButtonText>
          </Button>
        </View>
      </View>
    </Layout.Content>
  )
}
