import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {shareUrl} from '#/lib/sharing'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useProfilesQuery} from '#/state/queries/profile'
import {CopyButton} from '#/screens/Settings/components/CopyButton'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {ArrowShareRight_Stroke2_Corner2_Rounded as ShareIcon} from '#/components/icons/ArrowShareRight'
import {PersonPlus_Stroke2_Corner0_Rounded as PersonPlusIcon} from '#/components/icons/Person'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {getReferralUrl} from './api'
import {PointsSection, ReferralCounts} from './components/PointsSection'
import {useReferralOverviewQuery, useReferralsQuery} from './queries'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'ReferralSettings'>

/** Settings > Invite friends: the viewer's referral code, referrals, points */
export function ReferralScreen({}: Props) {
  const t = useTheme()
  const {t: l} = useLingui()
  const overview = useReferralOverviewQuery()
  const code = overview.data?.code
  const url = code ? getReferralUrl(code) : ''

  return (
    <Layout.Screen testID="referralScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Invite friends</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          <SettingsList.Item>
            <Text style={[a.text_md, a.leading_snug]}>
              <Trans>
                Krao is invite-only. Share your code: you get 100 points for
                each friend who joins, and they get 50. Points are approved once
                you have both verified your identity.
              </Trans>
            </Text>
          </SettingsList.Item>

          {overview.isLoading ? (
            <SettingsList.Item>
              <Loader />
            </SettingsList.Item>
          ) : overview.isError || !code ? (
            <SettingsList.Item>
              <Admonition.Admonition type="error">
                <Trans>Could not load your referral code.</Trans>
              </Admonition.Admonition>
            </SettingsList.Item>
          ) : (
            <SettingsList.Item style={[a.flex_col, a.align_stretch, a.gap_md]}>
              <View
                style={[
                  a.align_center,
                  a.p_lg,
                  a.rounded_md,
                  a.gap_xs,
                  t.atoms.bg_contrast_25,
                ]}>
                <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                  <Trans>Your referral code</Trans>
                </Text>
                <Text
                  testID="referralCode"
                  selectable
                  style={[a.text_3xl, a.font_bold, {letterSpacing: 2}]}>
                  {code}
                </Text>
                <Text
                  selectable
                  style={[a.text_sm, t.atoms.text_contrast_medium]}
                  numberOfLines={1}>
                  {url.replace(/^https?:\/\//, '')}
                </Text>
              </View>
              <View style={[a.flex_row, a.gap_sm]}>
                <CopyButton
                  value={code}
                  label={l`Copy referral code`}
                  color="secondary"
                  size="large"
                  style={[a.flex_1]}>
                  <ButtonText>
                    <Trans>Copy code</Trans>
                  </ButtonText>
                </CopyButton>
                <Button
                  label={l`Share invite link`}
                  color="primary"
                  size="large"
                  style={[a.flex_1]}
                  onPress={() => void shareUrl(url)}>
                  <ButtonIcon icon={ShareIcon} />
                  <ButtonText>
                    <Trans>Share link</Trans>
                  </ButtonText>
                </Button>
              </View>
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                <ReferralCounts
                  count={overview.data?.referralCount ?? 0}
                  verified={overview.data?.verifiedCount ?? 0}
                />
              </Text>
            </SettingsList.Item>
          )}

          <SettingsList.Divider />
          <PointsSection />

          <SettingsList.Divider />
          <ReferralList />
        </SettingsList.Container>
      </Layout.Content>
    </Layout.Screen>
  )
}

function ReferralList() {
  const t = useTheme()
  const {i18n} = useLingui()
  const {data, isLoading} = useReferralsQuery()
  const referrals = data?.referrals ?? []
  // getProfiles takes at most 25 accounts
  const {data: profiles} = useProfilesQuery({
    handles: referrals.slice(0, 25).map(r => r.did),
  })
  const byDid = new Map(profiles?.profiles.map(p => [p.did, p]))

  if (isLoading) {
    return (
      <SettingsList.Item>
        <Loader />
      </SettingsList.Item>
    )
  }
  if (!referrals.length) {
    return (
      <SettingsList.Item>
        <SettingsList.ItemIcon icon={PersonPlusIcon} />
        <Text style={[a.text_md, a.italic, a.flex_1]}>
          <Trans>No one has joined with your code yet.</Trans>
        </Text>
      </SettingsList.Item>
    )
  }
  return (
    <>
      <SettingsList.Item>
        <Text style={[a.text_md, a.font_semi_bold]}>
          <Trans>People you invited</Trans>
        </Text>
      </SettingsList.Item>
      {referrals.map(r => {
        const profile = byDid.get(r.did as `did:${string}:${string}`)
        return (
          <SettingsList.Item key={r.did}>
            <View style={[a.flex_1, a.gap_2xs]}>
              <Text emoji style={[a.text_md]} numberOfLines={1}>
                {profile
                  ? profile.displayName || sanitizeHandle(profile.handle, '@')
                  : r.did}
              </Text>
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                {i18n.date(new Date(r.joinedAt), {dateStyle: 'medium'})} ·{' '}
                {r.verified ? (
                  <Trans>Verified</Trans>
                ) : (
                  <Trans>Not verified yet</Trans>
                )}
              </Text>
            </View>
          </SettingsList.Item>
        )
      })}
    </>
  )
}
