import {useEffect, useRef, useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {logger} from '#/logger'
import {useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Text} from '#/components/Typography'
import {SafetyHost} from '../safety/SafetyHost'
import {ConsentGate} from './components/ConsentGate'
import {PhoneVerifyForm} from './components/PhoneVerifyForm'
import {clearPendingConsent, getPendingConsent} from './consent'
import {
  justVerifiedPhone,
  onPhoneVerificationRequested,
  openPhoneVerification,
  type PhoneVerificationReason,
} from './events'
import {usePhoneStatusQuery, useRecordConsentMutation} from './queries'

/**
 * Mounted once in the shell: the "verify your phone number" dialog, which
 * posting, replying and chatting open when the service refuses an account
 * with no verified number, and the Krao steps that follow sign-up. Also hosts
 * the safety warnings (scam links, seed phrases).
 */
export function ComplianceHost() {
  return (
    <>
      <PhoneRequiredDialog />
      <AfterSignup />
      <ConsentGate />
      <SafetyHost />
    </>
  )
}

function PhoneRequiredDialog() {
  const control = Dialog.useDialogControl()
  const {hasSession} = useSession()
  const [request, setRequest] = useState<{
    reason: PhoneVerificationReason
    justVerified: boolean
  }>({reason: 'post', justVerified: false})

  useEffect(
    () =>
      onPhoneVerificationRequested(r => {
        if (!hasSession) return
        // Opened again soon after verifying: the services have not caught up
        setRequest({
          reason: r,
          justVerified: r !== 'welcome' && justVerifiedPhone(),
        })
        control.open()
      }),
    [control, hasSession],
  )

  return (
    <Dialog.Outer control={control} nativeOptions={{preventExpansion: true}}>
      <Dialog.Handle />
      <PhoneRequiredInner {...request} />
    </Dialog.Outer>
  )
}

function PhoneRequiredInner({
  reason,
  justVerified,
}: {
  reason: PhoneVerificationReason
  justVerified: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const [verified, setVerified] = useState(false)

  const title =
    reason === 'post'
      ? l`You need to verify your phone number to post`
      : reason === 'chat'
        ? l`You need to verify your phone number to send messages`
        : l`Verify your phone number`

  return (
    <Dialog.ScrollableInner
      label={title}
      style={[a.gap_lg]}
      testID="phoneRequiredDialog">
      <View style={[a.gap_sm]}>
        <Text style={[a.font_bold, a.text_2xl, a.pr_3xl]}>{title}</Text>
        <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_high]}>
          {reason === 'welcome' ? (
            <Trans>
              Krao needs a verified phone number before you can post or send
              messages. You can do it now, or later in Settings under Account
              and Phone number.
            </Trans>
          ) : (
            <Trans>
              Krao asks every account to verify a phone number before posting or
              sending messages, as Vietnamese law requires.
            </Trans>
          )}
        </Text>
      </View>
      {justVerified || verified ? (
        <View style={[a.gap_md]}>
          <Text
            testID="phoneRetryNote"
            style={[a.text_md, a.leading_snug, t.atoms.text_contrast_high]}>
            {verified ? (
              <Trans>
                Your phone number is verified. You can try again now. If it
                still fails, wait a few seconds and try again.
              </Trans>
            ) : (
              <Trans>
                You verified your phone number a moment ago. Wait a few seconds
                and try again.
              </Trans>
            )}
          </Text>
          <Button
            label={l`Close`}
            color="primary"
            size="large"
            onPress={() => control.close()}>
            <ButtonText>
              <Trans>Close</Trans>
            </ButtonText>
          </Button>
        </View>
      ) : (
        <>
          <PhoneVerifyForm onVerified={() => setVerified(true)} />
          <Button
            label={l`Not now`}
            color="secondary"
            size="large"
            onPress={() => control.close()}>
            <ButtonText>
              <Trans>Not now</Trans>
            </ButtonText>
          </Button>
        </>
      )}
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}

/**
 * Right after sign-up: records the consent given in the form (the account did
 * not exist yet), then gently asks for a phone number if there is none.
 */
/** Accounts whose sign-up consent is being recorded (effects can run twice) */
const recordingConsent = new Set<string>()

function AfterSignup() {
  const {currentAccount} = useSession()
  const did = currentAccount?.did
  const handle = currentAccount?.handle
  const {mutate: recordConsent} = useRecordConsentMutation()
  const status = usePhoneStatusQuery()
  const signedUp = useRef(false)
  const handledDid = useRef<string>(undefined)
  const prompted = useRef(false)

  useEffect(() => {
    if (!did || handledDid.current === did) return
    // Only for the account that was created with that consent
    const pending = getPendingConsent(handle)
    if (!pending || recordingConsent.has(did)) return
    handledDid.current = did
    signedUp.current = true
    recordingConsent.add(did)
    recordConsent(pending, {
      onSuccess: () => clearPendingConsent(),
      onError: err => {
        // Stays pending: recorded the next time the app opens
        logger.warn('Could not record consent', {safeMessage: err})
      },
      onSettled: () => recordingConsent.delete(did),
    })
  }, [did, handle, recordConsent])

  useEffect(() => {
    if (!signedUp.current || prompted.current || !status.data) return
    prompted.current = true
    if (!status.data.verified && status.data.available !== false) {
      openPhoneVerification('welcome')
    }
  }, [status.data])

  return null
}
