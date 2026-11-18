import {useEffect, useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useBreakpoints, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Warning_Stroke2_Corner0_Rounded as WarningIcon} from '#/components/icons/Warning'
import {Text} from '#/components/Typography'
import {
  onSecretWarning,
  onUnsafeLinkWarning,
  type UnsafeLinkRequest,
} from './events'
import {type SecretKind} from './secrets'

/**
 * Mounted once in the shell: the warning before a link on the scam list
 * opens, and the one when a message holds a seed phrase or private key.
 */
export function SafetyHost() {
  return (
    <>
      <UnsafeLinkDialog />
      <SecretDialog />
    </>
  )
}

function UnsafeLinkDialog() {
  const control = Dialog.useDialogControl()
  const [request, setRequest] = useState<UnsafeLinkRequest>()

  useEffect(
    () =>
      onUnsafeLinkWarning(r => {
        setRequest(r)
        control.open()
      }),
    [control],
  )

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventExpansion: true}}
      webOptions={{alignCenter: true}}>
      <Dialog.Handle />
      <UnsafeLinkInner request={request} />
    </Dialog.Outer>
  )
}

function UnsafeLinkInner({request}: {request?: UnsafeLinkRequest}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const {gtMobile} = useBreakpoints()
  const domain = request?.result.domain ?? request?.url ?? ''

  return (
    <Dialog.ScrollableInner
      label={l`This site is on a scam list`}
      style={web({maxWidth: 450})}>
      <View style={[a.gap_2xl]} testID="unsafeLinkDialog">
        <View style={[a.gap_sm]}>
          <View style={[a.flex_row, a.align_center, a.gap_sm]}>
            <WarningIcon fill={t.palette.negative_500} size="lg" />
            <Text style={[a.flex_1, a.font_bold, a.text_2xl, a.leading_tight]}>
              <Trans>This site is on a scam list</Trans>
            </Text>
          </View>
          <Text style={[t.atoms.text_contrast_high, a.text_md, a.leading_snug]}>
            <Trans>
              {domain} is on a list of phishing and wallet-draining sites. It
              may try to steal your funds or your recovery phrase. Do not
              connect your wallet or sign anything there.
            </Trans>
          </Text>
          {request && (
            <View
              style={[
                t.atoms.bg_contrast_25,
                a.px_md,
                a.py_sm,
                a.rounded_sm,
                a.border,
                t.atoms.border_contrast_medium,
              ]}>
              <Text
                numberOfLines={3}
                style={[
                  a.text_md,
                  a.leading_snug,
                  t.atoms.text_contrast_medium,
                  web({wordBreak: 'break-all'}),
                ]}>
                {request.url}
              </Text>
            </View>
          )}
        </View>
        <View
          style={[
            a.flex_1,
            a.gap_sm,
            gtMobile && [a.flex_row_reverse, a.justify_start],
          ]}>
          <Button
            testID="unsafeLinkBackButton"
            label={l`Go back`}
            onPress={() => control.close()}
            size="large"
            color="primary">
            <ButtonText>
              <Trans>Go back</Trans>
            </ButtonText>
          </Button>
          <Button
            testID="unsafeLinkOpenButton"
            label={l`Open anyway`}
            accessibilityHint={l`Opens a link on the scam list`}
            onPress={() =>
              control.close(() => {
                request?.proceed()
              })
            }
            size="large"
            color="negative_subtle">
            <ButtonText>
              <Trans>Open anyway</Trans>
            </ButtonText>
          </Button>
        </View>
      </View>
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}

function SecretDialog() {
  const control = Dialog.useDialogControl()
  const [kinds, setKinds] = useState<SecretKind[]>([])

  useEffect(
    () =>
      onSecretWarning(found => {
        setKinds(found)
        control.open()
      }),
    [control],
  )

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventExpansion: true}}
      webOptions={{alignCenter: true}}>
      <Dialog.Handle />
      <SecretInner kinds={kinds} />
    </Dialog.Outer>
  )
}

function SecretInner({kinds}: {kinds: SecretKind[]}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const title = kinds.includes('privateKey')
    ? kinds.includes('seedPhrase')
      ? l`This message has a seed phrase and a private key`
      : l`This message has a private key`
    : l`This message has a seed phrase`

  return (
    <Dialog.ScrollableInner label={title} style={web({maxWidth: 450})}>
      <View style={[a.gap_2xl]} testID="secretWarningDialog">
        <View style={[a.gap_sm]}>
          <View style={[a.flex_row, a.align_center, a.gap_sm]}>
            <WarningIcon fill={t.palette.negative_500} size="lg" />
            <Text style={[a.flex_1, a.font_bold, a.text_2xl, a.leading_tight]}>
              {title}
            </Text>
          </View>
          <Text style={[t.atoms.text_contrast_high, a.text_md, a.leading_snug]}>
            <Trans>
              Anyone who has your seed phrase or private key can take all your
              funds. Krao will never ask for them, and nobody else should. It
              was not sent: remove it from the text and try again.
            </Trans>
          </Text>
        </View>
        <Button
          testID="secretWarningOkButton"
          label={l`Edit the message`}
          onPress={() => control.close()}
          size="large"
          color="primary">
          <ButtonText>
            <Trans>Edit the message</Trans>
          </ButtonText>
        </Button>
      </View>
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}
