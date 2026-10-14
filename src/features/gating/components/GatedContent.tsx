import {View} from 'react-native'
import {Image} from 'expo-image'
import {Trans, useLingui} from '@lingui/react/macro'

import {useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import {InlineLinkText} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {IS_WEB, KRAO_DEV_WALLET} from '#/env'
import {useChainProfileQuery} from '#/features/wallet/queries'
import {useDescribeRule} from '../describe'
import {
  type GatedMedia,
  GateError,
  useGatedContentQuery,
  useGateRuleQuery,
} from '../queries'
import {GatedVideo} from './GatedVideo'

/**
 * The token-gated part of a post. Shows the content to eligible viewers and
 * the requirements to everyone else. Renders nothing for ungated posts.
 */
export function GatedContent({uri}: {uri: string}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {hasSession, currentAccount} = useSession()
  const describeRule = useDescribeRule()
  const {data: rule} = useGateRuleQuery(uri)
  const content = useGatedContentQuery(uri, !!rule?.hasContent)
  const {data: myChainProfile} = useChainProfileQuery(
    rule?.hasContent ? currentAccount?.did : undefined,
  )
  const hasWallet = !!myChainProfile?.wallets.some(w => w.status === 'verified')
  // Wallets are linked from the web for now (no WalletConnect on native)
  const canLinkHere = IS_WEB || KRAO_DEV_WALLET

  if (!rule?.hasContent) return null

  const requirementText = describeRule(rule)
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
        // The label leaves the emoji out: screen readers would read it aloud
        accessibilityLabel={l`Token-gated · holders of ${requirementText}`}
        accessibilityHint=""
        style={[a.text_sm, a.font_semi_bold, {color: t.palette.primary_700}]}>
        🔒 <Trans>Token-gated · holders of {requirementText}</Trans>
      </Text>
      {!hasSession ? (
        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
          <Trans>Sign in and link a wallet to unlock this content.</Trans>
        </Text>
      ) : content.isLoading ? (
        <Loader />
      ) : content.data?.text || content.data?.media?.length ? (
        <>
          {!!content.data.text && (
            <Text style={[a.text_lg, a.leading_snug]} emoji selectable>
              {content.data.text}
            </Text>
          )}
          {content.data.media?.map(media =>
            media.mimeType.startsWith('video/') ? (
              <GatedVideo key={media.url} media={media} />
            ) : (
              <GatedImage key={media.url} media={media} />
            ),
          )}
        </>
      ) : notEligible && !canLinkHere ? (
        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
          {hasWallet ? (
            <Trans>Your linked wallets don’t meet this requirement yet.</Trans>
          ) : (
            <Trans>
              Link a wallet that meets the requirement from Krao on the web to
              unlock this content.
            </Trans>
          )}
        </Text>
      ) : notEligible ? (
        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
          {hasWallet ? (
            <Trans>
              Your linked wallets don’t meet this requirement yet.{' '}
              <InlineLinkText
                to="/settings/wallets"
                label={l`Manage linked wallets`}>
                Manage wallets
              </InlineLinkText>
            </Trans>
          ) : (
            <Trans>
              <InlineLinkText to="/settings/wallets" label={l`Link a wallet`}>
                Link a wallet
              </InlineLinkText>{' '}
              that meets the requirement to unlock this content.
            </Trans>
          )}
        </Text>
      ) : content.error ? (
        <View style={[a.gap_sm]}>
          <Admonition type="error">
            <Trans>Couldn’t load the gated content.</Trans>
          </Admonition>
          <Button
            label={l`Try again`}
            color="secondary"
            size="small"
            style={[a.self_start]}
            onPress={() => void content.refetch()}>
            <ButtonText>
              <Trans>Try again</Trans>
            </ButtonText>
          </Button>
        </View>
      ) : null}
    </View>
  )
}

/**
 * One gated image. Its URL is signed for this viewer by the gate service and
 * expires after a few minutes, so it is not cached across sessions.
 */
function GatedImage({media}: {media: GatedMedia}) {
  const {t: l} = useLingui()
  const ratio = media.aspectRatio
    ? media.aspectRatio.width / media.aspectRatio.height
    : 1
  return (
    <Image
      source={{uri: media.url}}
      style={[a.w_full, a.rounded_sm, {aspectRatio: ratio, maxHeight: 480}]}
      contentFit="contain"
      cachePolicy="memory"
      accessibilityLabel={media.alt || l`Token-gated image`}
      accessibilityHint=""
      accessibilityIgnoresInvertColors
    />
  )
}
