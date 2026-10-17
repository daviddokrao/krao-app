import {useLingui} from '@lingui/react/macro'

import {type PhoneErrorCode, phoneErrorCode} from '../phone'

/** The words for a failed phone verification call */
export function usePhoneErrorMessage() {
  const {t: l} = useLingui()
  return (err: unknown, step: 'request' | 'verify') => {
    const code: PhoneErrorCode = phoneErrorCode(err)
    switch (code) {
      case 'InvalidPhone':
        return l`This is not a valid phone number. Use a Vietnamese number such as 0912345678 or +84912345678.`
      case 'PhoneTaken':
        return l`Another account already uses this phone number.`
      case 'PhoneNotSupported':
        return l`Only Vietnamese phone numbers (+84) can be verified for now.`
      case 'PhoneUnavailable':
        return l`Phone verification is not available yet. Please try again later.`
      case 'SmsFailed':
        return l`We could not send the SMS. Please try again in a moment.`
      case 'InvalidCode':
        return l`The code is wrong. Check it and try again.`
      case 'CodeExpired':
        return l`The code expired or was not requested. Ask for a new one.`
      case 'TooManyAttempts':
        return l`Too many wrong codes. Ask for a new one.`
      case 'RateLimited':
        return l`Too many attempts. Please wait a few minutes and try again.`
      default:
        return step === 'request'
          ? l`Could not send the code. Check your connection and try again.`
          : l`Could not verify the code. Check your connection and try again.`
    }
  }
}
