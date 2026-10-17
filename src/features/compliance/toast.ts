import {useLingui} from '@lingui/react/macro'

import * as Toast from '#/components/Toast'
import {isPhoneVerificationRequired} from './phone'

/**
 * For the places that start a chat from inside a sheet (a dialog opened from
 * the shell cannot show over one on iOS): says "verify your phone number" in
 * a toast. Returns whether `error` was that error, so the caller can stop.
 */
export function useChatPhoneRequiredToast() {
  const {t: l} = useLingui()
  return (error: unknown): boolean => {
    if (!isPhoneVerificationRequired(error)) return false
    Toast.show(
      l`Verify your phone number to send messages. You can do it in Settings, under Account and Phone number.`,
      {type: 'error'},
    )
    return true
  }
}
