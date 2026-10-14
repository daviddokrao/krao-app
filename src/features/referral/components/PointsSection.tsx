import {View} from 'react-native'
import {Plural, Trans, useLingui} from '@lingui/react/macro'

import {useOpenLink} from '#/lib/hooks/useOpenLink'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Gift1_Stroke2_Corner0_Rounded as GiftIcon} from '#/components/icons/Gift1'
import {ShieldCheck_Stroke2_Corner0_Rounded as ShieldCheckIcon} from '#/components/icons/Shield'
import {Loader} from '#/components/Loader'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {type KycStatus, RewardsError} from '../api'
import {
  useKycStatusQuery,
  usePointsBalanceQuery,
  useStartKycMutation,
} from '../queries'

/**
 * The viewer's Krao points (pending and approved) and identity verification,
 * which approves them. Rows for a SettingsList.Container.
 */
export function PointsSection() {
  const t = useTheme()
  const {i18n} = useLingui()
  const balance = usePointsBalanceQuery()

  return (
    <>
      <SettingsList.Item>
        <SettingsList.ItemIcon icon={GiftIcon} />
        <View style={[a.flex_1, a.gap_2xs]}>
          <Text style={[a.text_md, a.font_semi_bold]}>
            <Trans>Krao points</Trans>
          </Text>
          {balance.isLoading ? (
            <Loader />
          ) : balance.isError ? (
            <Text style={[a.text_sm, {color: t.palette.negative_500}]}>
              <Trans>Could not load your points.</Trans>
            </Text>
          ) : (
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              <Trans>
                {i18n.number(balance.data?.approved ?? 0)} approved ·{' '}
                {i18n.number(balance.data?.pending ?? 0)} pending
              </Trans>
            </Text>
          )}
        </View>
      </SettingsList.Item>
      <SettingsList.Item>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            Points from referrals are pending until both you and the other
            person have verified your identity. Points are not money; Krao may
            let you convert them to tokens later.
          </Trans>
        </Text>
      </SettingsList.Item>
      <KycRow />
    </>
  )
}

function KycRow() {
  const t = useTheme()
  const {t: l} = useLingui()
  const kyc = useKycStatusQuery()
  const start = useStartKycMutation()
  const openLink = useOpenLink()
  const status: KycStatus = kyc.data?.status ?? 'none'

  const label: Record<KycStatus, string> = {
    none: l`Not verified`,
    pending: l`Under review`,
    retry: l`More information needed`,
    approved: l`Verified`,
    rejected: l`Not approved`,
  }

  const onStart = () => {
    start.mutate(undefined, {
      onSuccess: ({url}) => openLink(url, true),
      onError: err =>
        Toast.show(
          err instanceof RewardsError && err.error === 'KycUnavailable'
            ? l`Identity verification is not available yet.`
            : l`Could not start identity verification.`,
          {type: 'error'},
        ),
    })
  }

  return (
    <SettingsList.Item style={[a.flex_col, a.align_stretch, a.gap_md]}>
      <View style={[a.flex_row, a.align_center, a.gap_md]}>
        <SettingsList.ItemIcon icon={ShieldCheckIcon} />
        <View style={[a.flex_1, a.gap_2xs]}>
          <Text style={[a.text_md, a.font_semi_bold]}>
            <Trans>Identity verification</Trans>
          </Text>
          {kyc.isLoading ? (
            <Loader />
          ) : (
            <Text
              style={[
                a.text_sm,
                status === 'approved'
                  ? {color: t.palette.positive_600}
                  : status === 'rejected'
                    ? {color: t.palette.negative_500}
                    : t.atoms.text_contrast_medium,
              ]}>
              {label[status]}
            </Text>
          )}
        </View>
      </View>
      {kyc.data && status !== 'approved' && status !== 'rejected' && (
        <>
          {kyc.data.available ? (
            <Button
              testID="startKycButton"
              label={l`Verify your identity`}
              accessibilityHint={l`Opens the identity verification provider`}
              color="primary"
              size="large"
              disabled={start.isPending || status === 'pending'}
              onPress={onStart}>
              <ButtonIcon icon={start.isPending ? Loader : ShieldCheckIcon} />
              <ButtonText>
                {status === 'retry' ? (
                  <Trans>Continue verification</Trans>
                ) : (
                  <Trans>Verify your identity</Trans>
                )}
              </ButtonText>
            </Button>
          ) : (
            <Admonition.Admonition type="info">
              <Trans>
                Identity verification opens soon. Your pending points are kept
                until then.
              </Trans>
            </Admonition.Admonition>
          )}
        </>
      )}
      {status === 'rejected' && (
        <Admonition.Admonition type="warning">
          <Trans>
            Your identity could not be verified, so points that depend on it
            were cancelled. Contact Krao support if you think this is a mistake.
          </Trans>
        </Admonition.Admonition>
      )}
    </SettingsList.Item>
  )
}

/** "3 people joined · 1 verified" */
export function ReferralCounts({
  count,
  verified,
}: {
  count: number
  verified: number
}) {
  return (
    <Trans>
      <Plural value={count} one="# person joined" other="# people joined" /> ·{' '}
      {verified} verified
    </Trans>
  )
}
