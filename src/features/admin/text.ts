import {useLingui} from '@lingui/react/macro'

import {type AdminRole, type AdminSectionId, type AuditService} from './logic'

/** Names and one-line descriptions of the roles, in the app's language */
export function useRoleText(): Record<
  AdminRole,
  {name: string; description: string}
> {
  const {t: l} = useLingui()
  return {
    admin: {
      name: l`Admin`,
      description: l`Manages roles and has every other role`,
    },
    rewards: {
      name: l`Rewards`,
      description: l`Referral codes, reward rules and point corrections`,
    },
    kyc: {name: l`KYC`, description: l`Reviews identity checks`},
    safety: {
      name: l`Safety`,
      description: l`Reviews Mini Apps, risky domains and tokens`,
    },
    moderator: {
      name: l`Moderator`,
      description: l`Reads gated content to handle reports`,
    },
    analytics: {name: l`Analytics`, description: l`Reads aggregate figures`},
  }
}

/** Title and description of each card of the hub */
export function useSectionText(): Record<
  AdminSectionId,
  {name: string; description: string}
> {
  const {t: l} = useLingui()
  return {
    rewards: {
      name: l`Rewards`,
      description: l`Referral codes, rules and points`,
    },
    kyc: {name: l`KYC`, description: l`Review identity checks`},
    safety: {
      name: l`Safety`,
      description: l`Review Mini Apps`,
    },
    moderator: {
      name: l`Gate moderation`,
      description: l`View gated content for a report`,
    },
    analytics: {
      name: l`Analytics`,
      description: l`Sign-ups, funnel, retention`,
    },
    roles: {name: l`Roles`, description: l`Who can do what in this area`},
    audit: {name: l`Audit log`, description: l`What admins did, by service`},
  }
}

export function useServiceText(): Record<AuditService, string> {
  const {t: l} = useLingui()
  return {
    rewards: l`Rewards`,
    indexer: l`Indexer`,
    chat: l`Chat`,
    moderation: l`Moderation`,
  }
}
