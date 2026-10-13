import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {InlineLinkText} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {useDescribeCondition} from '../describe'
import {GateError, useGatedContentQuery, useGateRuleQuery} from '../queries'

/**
 * The token-gated part of a post. Shows the content to eligible viewers and
 * the requirements to everyone else. Renders nothing for ungated posts.
 */
export function GatedContent({uri}: {uri: string}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {hasSession} = useSession()
  const describe = useDescribeCondition()
  const {data: rule} = useGateRuleQuery(uri)
  const content = useGatedContentQuery(uri, !!rule?.hasContent)

  if (!rule?.hasContent) return null

  const requirements = rule.conditions.map(describe)
  const requirementText =
    rule.match === 'any'
      ? requirements.join(l` or `)
      : requirements.join(l` and `)
  const notEligible =
    content.error instanceof GateError && content.error.error === 'NotEligible'

  return (
    <View
      testID="gatedContent"
      style={[
        a.mt_sm,
        a.p_md,
        a.gap_sm,
        a.rounded_md,
        a.border,
        {borderColor: t.palette.primary_200},
        {backgroundColor: t.palette.primary_25},
      ]}>
      <Text
        style={[a.text_sm, a.font_semi_bold, {color: t.palette.primary_700}]}>
        🔒 <Trans>Token-gated · holders of {requirementText}</Trans>
      </Text>
      {!hasSession ? (
        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
          <Trans>Sign in and link a wallet to unlock this content.</Trans>
        </Text>
      ) : content.isLoading ? (
        <Loader />
      ) : content.data?.text ? (
        <Text style={[a.text_lg, a.leading_snug]} emoji selectable>
          {content.data.text}
        </Text>
      ) : notEligible ? (
        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
          <Trans>
            Your linked wallets don’t meet this requirement yet.{' '}
            <InlineLinkText
              to="/settings/wallets"
              label={l`Manage linked wallets`}>
              Manage wallets
            </InlineLinkText>
          </Trans>
        </Text>
      ) : content.error ? (
        <Admonition type="error">
          <Trans>Couldn’t load the gated content.</Trans>
        </Admonition>
      ) : null}
    </View>
  )
}
