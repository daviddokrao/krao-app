import {useLingui} from '@lingui/react/macro'

import {type MiniAppStatus, type Permission} from '../logic'

/** What each permission lets a Mini App do, in the words of the prompt */
export function usePermissionText(): Record<
  Permission,
  {title: string; detail: string}
> {
  const {t: l} = useLingui()
  return {
    identity: {
      title: l`Know who you are`,
      detail: l`Your handle and display name.`,
    },
    wallet: {
      title: l`See a wallet`,
      detail: l`The address of a wallet you choose to share.`,
    },
    sign: {
      title: l`Ask you to sign messages`,
      detail: l`You see each message first. Nothing is signed without you.`,
    },
    transaction: {
      title: l`Ask you to send transactions`,
      detail: l`You see a preview of each one first. Nothing is sent without you.`,
    },
  }
}

export function useStatusText(): Record<MiniAppStatus, string> {
  const {t: l} = useLingui()
  return {
    approved: l`Approved by Krao`,
    pending: l`Waiting for Krao’s review`,
    revoked: l`Removed by Krao`,
    invalid: l`Not valid`,
  }
}
