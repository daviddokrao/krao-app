import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Text} from '#/components/Typography'
import {MemberUntil} from '#/features/membership/components/MemberUntil'
import {
  describeExpiry,
  formatUsdc,
  isMembershipActive,
} from '#/features/membership/logic'
import {
  useMembershipStatusQuery,
  usePlansQuery,
} from '#/features/membership/queries'
import {TopSupporters} from './TopSupporters'

/**
 * Under the profile header: the membership offer (with "Member until" for
 * members) and the top supporters. Renders nothing for accounts that have
 * neither.
 */
export function ProfileCreatorSection({
  did,
  handle,
}: {
  did: string
  handle: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const {hasSession, currentAccount} = useSession()
  const isMe = currentAccount?.did === did
  const plans = usePlansQuery(did)
  const status = useMembershipStatusQuery(did)

  const activePlans = (plans.data ?? []).filter(p => p.active !== false)
  const membership = status.data ?? undefined
  const isMember = isMembershipActive(membership, new Date())
  const pending = membership?.status === 'pending'
  const expired = !!membership && !isMember && !pending
  const info = describeExpiry(membership?.expiresAt, new Date())
  const cheapest = activePlans.length
    ? activePlans.reduce((min, p) =>
        BigInt(p.priceUsdc) < BigInt(min.priceUsdc) ? p : min,
      )
    : undefined
  const showOffer = !isMe && hasSession && (activePlans.length > 0 || isMember)

  const open = () => navigation.navigate('ProfileMembership', {name: handle})

  return (
    <>
      {showOffer && (
        <View
          testID="profileMembership"
          style={[
            a.flex_row,
            a.align_center,
            a.gap_md,
            a.p_md,
            a.rounded_md,
            t.atoms.bg_contrast_25,
          ]}>
          <View style={[a.flex_1, a.gap_2xs]}>
            {membership ? (
              <MemberUntil membership={membership} />
            ) : (
              <>
                <Text style={[a.text_md, a.font_semi_bold]}>
                  <Trans>Membership</Trans>
                </Text>
                {cheapest && (
                  <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                    <Trans>
                      From {formatUsdc(cheapest.priceUsdc)} USDC per 30 days
                    </Trans>
                  </Text>
                )}
              </>
            )}
          </View>
          {!pending && (
            <Button
              testID="becomeMemberButton"
              label={
                isMember
                  ? l`Renew your membership of @${handle}`
                  : expired
                    ? l`Join @${handle} again`
                    : l`Become a member of @${handle}`
              }
              color={isMember && !info?.renewSoon ? 'secondary' : 'primary'}
              size="small"
              onPress={open}>
              <ButtonText>
                {isMember ? (
                  <Trans>Renew</Trans>
                ) : expired ? (
                  <Trans>Join again</Trans>
                ) : (
                  <Trans>Become a member</Trans>
                )}
              </ButtonText>
            </Button>
          )}
        </View>
      )}
      <TopSupporters did={did} />
    </>
  )
}
