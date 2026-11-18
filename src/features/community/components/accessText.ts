import {useLingui} from '@lingui/react/macro'

import {type AccessMode, toReasonKey} from '../logic'

/** Words for the access modes of a community and for the indexer's reasons */
export function useAccessText() {
  const {t: l} = useLingui()
  return (mode: AccessMode) => {
    switch (mode) {
      case 'approval':
        return {
          title: l`Approval needed`,
          short: l`Approval needed`,
          description: l`People ask to join and an owner or moderator approves them.`,
        }
      case 'condition':
        return {
          title: l`Token or NFT holders`,
          short: l`Holders only`,
          description: l`People who hold the token or NFT you set, in a wallet linked to their account.`,
        }
      case 'verified':
        return {
          title: l`Verified people`,
          short: l`Verified only`,
          description: l`Only accounts that completed identity verification.`,
        }
      default:
        return {
          title: l`Open`,
          short: l`Open`,
          description: l`Anyone can join.`,
        }
    }
  }
}

/** Why the viewer is not in, from the reason code the indexer sent */
export function useReasonText() {
  const {t: l} = useLingui()
  return (reason: string | undefined): string => {
    switch (toReasonKey(reason)) {
      case 'NoWallet':
        return l`Link a wallet to your account to see if you qualify.`
      case 'ConditionsNotMet':
        return l`Your linked wallets don’t hold what this community asks for.`
      case 'NotVerified':
        return l`Only verified accounts can join. Verify your identity first.`
      case 'VerificationUnavailable':
        return l`Verification can’t be checked right now. Try again later.`
      case 'AwaitingApproval':
        return l`Waiting for an owner or moderator to approve you.`
      case 'NotCheckedYet':
        return l`Checking whether you qualify. This takes a moment.`
      case 'Banned':
        return l`You were banned from this community.`
      default:
        return l`You can’t join this community right now.`
    }
  }
}
