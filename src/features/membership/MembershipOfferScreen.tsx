import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {cleanError} from '#/lib/strings/errors'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useProfileQuery} from '#/state/queries/profile'
import {useResolveDidQuery} from '#/state/queries/resolve-uri'
import {useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import * as Layout from '#/components/Layout'
import {InlineLinkText} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {MemberUntil} from './components/MemberUntil'
import {PayMembershipDialog} from './components/PayMembershipDialog'
import {PlanCard} from './components/PlanCard'
import {formatUsdc, isMembershipActive, PERIOD_DAYS} from './logic'
import {type PlanView, useMembershipStatusQuery, usePlansQuery} from './queries'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'ProfileMembership'>

/**
 * A creator's membership offer: their plans, with a way to join or renew.
 * Reached from their profile and from the notice on members-only posts.
 */
export function MembershipOfferScreen({route}: Props) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {name} = route.params
  const {hasSession, currentAccount} = useSession()
  const {data: did} = useResolveDidQuery(name)
  const {data: profile} = useProfileQuery({did})
  const plansQuery = usePlansQuery(did)
  const status = useMembershipStatusQuery(did)
  const dialog = useDialogControl()
  const [selected, setSelected] = useState<PlanView | undefined>()
  const [openCount, setOpenCount] = useState(0)

  const handle = profile ? sanitizeHandle(profile.handle) : name
  const displayName = profile
    ? sanitizeDisplayName(profile.displayName || profile.handle)
    : name
  const plans = (plansQuery.data ?? []).filter(p => p.active !== false)
  const membership = status.data ?? undefined
  const isMember = isMembershipActive(membership, new Date())
  const isSelf = !!did && did === currentAccount?.did
  const currentPlanUri =
    typeof membership?.plan === 'string'
      ? membership.plan
      : membership?.plan.uri

  const choose = (plan: PlanView) => {
    setSelected(plan)
    setOpenCount(n => n + 1)
    dialog.open()
  }

  return (
    <Layout.Screen testID="membershipOfferScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Membership</Trans>
          </Layout.Header.TitleText>
          <Layout.Header.SubtitleText>{displayName}</Layout.Header.SubtitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <View style={[a.p_xl, a.gap_lg]}>
          <Text style={[a.text_md, a.leading_snug]}>
            <Trans>
              Support @{handle} every month and unlock what they share with
              members. You pay in USDC on Base, straight from your wallet to
              theirs. Krao never holds the money and takes no fee. A membership
              lasts {PERIOD_DAYS} days and does not renew by itself.
            </Trans>
          </Text>

          {membership && (
            <View
              style={[a.p_md, a.gap_2xs, a.rounded_md, t.atoms.bg_contrast_25]}>
              <Text style={[a.text_md, a.font_semi_bold]}>
                {isMember ? (
                  <Trans>Your membership</Trans>
                ) : (
                  <Trans>Your last membership</Trans>
                )}
              </Text>
              <MemberUntil membership={membership} />
              {typeof membership.plan !== 'string' && (
                <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                  {membership.plan.name} ·{' '}
                  {formatUsdc(membership.plan.priceUsdc)} USDC
                </Text>
              )}
            </View>
          )}

          {isSelf ? (
            <Admonition type="info">
              <Trans>
                This is your own membership offer.{' '}
                <InlineLinkText
                  to="/settings/membership"
                  label={l`Manage your plans`}>
                  Manage your plans
                </InlineLinkText>
              </Trans>
            </Admonition>
          ) : !hasSession ? (
            <Admonition type="info">
              <Trans>Sign in to become a member.</Trans>
            </Admonition>
          ) : plansQuery.isLoading || !did ? (
            <View style={[a.align_center, a.p_xl]}>
              <Loader size="xl" />
            </View>
          ) : plansQuery.isError ? (
            <View style={[a.gap_md]}>
              <Admonition type="error">
                {cleanError(plansQuery.error)}
              </Admonition>
              <Button
                label={l`Try again`}
                color="secondary"
                size="small"
                style={[a.self_start]}
                onPress={() => void plansQuery.refetch()}>
                <ButtonText>
                  <Trans>Try again</Trans>
                </ButtonText>
              </Button>
            </View>
          ) : plans.length === 0 ? (
            <View style={[a.gap_xs, a.py_xl]}>
              <Text style={[a.text_lg, a.font_semi_bold, a.text_center]}>
                <Trans>No membership plans right now</Trans>
              </Text>
              <Text
                style={[
                  a.text_md,
                  a.text_center,
                  t.atoms.text_contrast_medium,
                ]}>
                <Trans>
                  @{handle} isn’t offering memberships at the moment.
                </Trans>
              </Text>
            </View>
          ) : (
            plans.map(plan => {
              const current = plan.uri === currentPlanUri && isMember
              const renewing = isMember
              return (
                <PlanCard
                  key={plan.uri}
                  name={plan.name}
                  description={plan.description}
                  priceUsdc={plan.priceUsdc}
                  perks={plan.perks}
                  highlight={current}>
                  <Button
                    testID={`joinPlan-${plan.uri}`}
                    label={
                      renewing
                        ? l`Renew with ${plan.name}`
                        : l`Join ${plan.name}`
                    }
                    color={renewing && !current ? 'secondary' : 'primary'}
                    size="large"
                    onPress={() => choose(plan)}>
                    <ButtonText>
                      {renewing ? (
                        <Trans>Renew</Trans>
                      ) : (
                        <Trans>Become a member</Trans>
                      )}
                    </ButtonText>
                  </Button>
                </PlanCard>
              )
            })
          )}
        </View>
      </Layout.Content>
      <PayMembershipDialog
        control={dialog}
        plan={selected}
        creatorHandle={handle}
        openCount={openCount}
        previousExpiresAt={isMember ? membership?.expiresAt : undefined}
      />
    </Layout.Screen>
  )
}
