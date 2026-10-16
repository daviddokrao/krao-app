import {useEffect} from 'react'
import * as Clipboard from 'expo-clipboard'
import {useLingui} from '@lingui/react/macro'

import {logger} from '#/logger'
import * as Prompt from '#/components/Prompt'
import {IS_ANDROID, IS_IOS} from '#/env'
import {device} from '#/storage'
import {checkReferralCode} from './api'
import {parseClipboardCode, parseInstallReferrer} from './deferredCode'
import {getPendingReferralCode, setPendingReferralCode} from './pendingCode'

/** Remember a code only when the rewards service says it can be used */
async function savePendingIfValid(code: string | undefined) {
  if (!code || getPendingReferralCode()) return
  try {
    const res = await checkReferralCode(code)
    if (res.valid) setPendingReferralCode(code)
  } catch (e) {
    // Sign-up checks the code again; nothing to do now
    logger.debug('deferred referral code check failed', {error: String(e)})
  }
}

async function readInstallReferrer() {
  // Loaded here, not at the top: the native module only exists on Android
  const Application = await import('expo-application')
  return parseInstallReferrer(await Application.getInstallReferrerAsync())
}

/**
 * On the first open of the app, signed out: find the invite code that came
 * with the install, so sign-up has it filled in. Android reads the Play
 * Install Referrer; iOS asks before it reads the clipboard (and does not even
 * ask when the clipboard holds no text). Once per install, whatever the
 * outcome.
 */
export function DeferredCodeCheck() {
  const {t: l} = useLingui()
  const control = Prompt.usePromptControl()

  useEffect(() => {
    if (device.get(['kraoDeferredCodeChecked'])) return
    if (getPendingReferralCode()) {
      device.set(['kraoDeferredCodeChecked'], true)
      return
    }
    if (IS_ANDROID) {
      device.set(['kraoDeferredCodeChecked'], true)
      readInstallReferrer()
        .then(savePendingIfValid)
        .catch(e => logger.debug('install referrer failed', {error: String(e)}))
    } else if (IS_IOS) {
      // hasStringAsync does not trigger the system "paste" notice
      Clipboard.hasStringAsync()
        .then(has => {
          if (has) control.open()
          else device.set(['kraoDeferredCodeChecked'], true)
        })
        .catch(() => device.set(['kraoDeferredCodeChecked'], true))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!IS_IOS) return null
  return (
    <Prompt.Basic
      control={control}
      title={l`Paste your invite code?`}
      description={l`If a friend sent you a Krao invite code or link, Krao can read it from your clipboard and fill it in when you sign up. Nothing else is read.`}
      confirmButtonCta={l`Paste code`}
      cancelButtonCta={l`No, thanks`}
      onConfirm={() => {
        device.set(['kraoDeferredCodeChecked'], true)
        Clipboard.getStringAsync()
          .then(text => savePendingIfValid(parseClipboardCode(text)))
          .catch(() => {})
      }}
      onClose={() => device.set(['kraoDeferredCodeChecked'], true)}
    />
  )
}
