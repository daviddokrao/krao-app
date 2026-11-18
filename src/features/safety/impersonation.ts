import {
  type InterpretedLabelValueDefinition,
  interpretLabelValueDefinition,
} from '@bsky/sdk/moderation'

/*
 * Impersonation warning. Krao's labeler puts `impersonation-suspect` on an
 * account that looks like a verified one (same name, same picture). The label
 * only informs: it never hides or blurs anything, and the account can appeal
 * it with the labeler's usual appeal.
 *
 * The labeler publishes the definition in its service record, which is what
 * the moderation code reads. This is the same definition, kept in the app so
 * the warning also shows before that record is fetched or if it lacks it.
 */

export const IMPERSONATION_LABEL = 'impersonation-suspect'

const DEFINITION = {
  identifier: IMPERSONATION_LABEL,
  severity: 'inform',
  blurs: 'none',
  defaultSetting: 'warn',
  adultOnly: false,
  locales: [
    {
      lang: 'en',
      name: 'Possible impersonation',
      description:
        'This account looks like a verified account. Check the handle before you trust it.',
    },
    {
      lang: 'vi',
      name: 'Có thể mạo danh',
      description:
        'Tài khoản này giống một tài khoản đã xác minh. Hãy kiểm tra tên người dùng trước khi tin.',
    },
  ],
} as const

/** The definition as the moderation code reads it, for labels from `labelerDid` */
export function impersonationDefinition(
  labelerDid: string,
): InterpretedLabelValueDefinition {
  return interpretLabelValueDefinition(
    {...DEFINITION, locales: [...DEFINITION.locales]},
    labelerDid,
  )
}

/**
 * `labelDefs` (definitions by labeler DID) with the impersonation label added
 * for Krao's labeler, unless the labeler's own record already defines it.
 * Nothing is added when there is no Krao labeler. The input is not changed.
 */
export function withImpersonationDefinition(
  labelDefs: Record<string, InterpretedLabelValueDefinition[]>,
  labelerDid: string,
): Record<string, InterpretedLabelValueDefinition[]> {
  if (!labelerDid) return labelDefs
  const own = labelDefs[labelerDid] ?? []
  if (own.some(def => def.identifier === IMPERSONATION_LABEL)) return labelDefs
  return {
    ...labelDefs,
    [labelerDid]: [...own, impersonationDefinition(labelerDid)],
  }
}

/** Whether a label is the impersonation warning from Krao's labeler */
export function isImpersonationLabel(
  label: {val: string; src: string},
  labelerDid: string,
): boolean {
  return (
    !!labelerDid &&
    label.val === IMPERSONATION_LABEL &&
    label.src === labelerDid
  )
}
