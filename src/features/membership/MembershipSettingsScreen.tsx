import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {
  type CommonNavigatorParams,
  type NavigationProp,
} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {useSession} from '#/state/session'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {Group3_Stroke2_Corner0_Rounded as GroupIcon} from '#/components/icons/Group3'
import {Growth_Stroke2_Corner0_Rounded as GrowthIcon} from '#/components/icons/Growth'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {useChainProfileQuery} from '#/features/wallet/queries'
import {PlanCard} from './components/PlanCard'
import {PlanDialog} from './components/PlanDialog'
import {canAddPlan, PERIOD_DAYS, PLANS_MAX} from './logic'
import {
  type OwnPlan,
  useOwnPlansQuery,
  useSetPlanActiveMutation,
} from './queries'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'MembershipSettings'>

/** Settings > Membership: the creator's plans (up to three active) */
export function MembershipSettingsScreen({}: Props) {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const {currentAccount} = useSession()
  const plans = useOwnPlansQuery()
  const wallets = useChainProfileQuery(currentAccount?.did)
  const setActive = useSetPlanActiveMutation()
  const dialog = useDialogControl()
  const [editing, setEditing] = useState<OwnPlan | undefined>()
  const [openCount, setOpenCount] = useState(0)

  const hasWallet = !!wallets.data?.wallets.some(
    w => w.status === 'verified' && w.account.startsWith('eip155:'),
  )
  const items = plans.data ?? []
  const canAdd = canAddPlan(items.map(p => p.record))

  const openDialog = (plan?: OwnPlan) => {
    setEditing(plan)
    setOpenCount(n => n + 1)
    dialog.open()
  }

  const toggle = (plan: OwnPlan) => {
    const active = !plan.record.active
    if (active && !canAdd) {
      Toast.show(l`You can have at most ${PLANS_MAX} active plans`, {
        type: 'error',
      })
      return
    }
    setActive.mutate(
      {plan, active},
      {
        onSuccess: () =>
          Toast.show(active ? l`Plan turned on` : l`Plan turned off`, {
            type: 'success',
          }),
        onError: err => Toast.show(cleanError(err), {type: 'error'}),
      },
    )
  }

  return (
    <Layout.Screen testID="membershipSettingsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Membership</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          <SettingsList.Item>
            <Text style={[a.text_md, a.leading_snug]}>
              <Trans>
                Offer paid memberships to your followers. Members pay you in
                USDC on Base, straight from their wallet to yours. Krao never
                holds the money and takes no fee. A membership lasts{' '}
                {PERIOD_DAYS} days and does not renew by itself yet: members
                renew when they choose to.
              </Trans>
            </Text>
          </SettingsList.Item>

          {wallets.isLoading || plans.isLoading ? (
            <SettingsList.Item>
              <Loader />
            </SettingsList.Item>
          ) : plans.isError ? (
            <SettingsList.Item style={[a.flex_col, a.align_stretch, a.gap_md]}>
              <Admonition.Admonition type="error">
                {cleanError(plans.error)}
              </Admonition.Admonition>
              <Button
                label={l`Try again`}
                color="secondary"
                size="small"
                style={[a.self_start]}
                onPress={() => void plans.refetch()}>
                <ButtonText>
                  <Trans>Try again</Trans>
                </ButtonText>
              </Button>
            </SettingsList.Item>
          ) : (
            <>
              {!hasWallet && (
                <SettingsList.Item
                  style={[a.flex_col, a.align_stretch, a.gap_md]}>
                  <Admonition.Admonition type="info">
                    <Trans>
                      Link the wallet you want to be paid in first. Members pay
                      the wallet linked to your account.
                    </Trans>
                  </Admonition.Admonition>
                  <Button
                    label={l`Link a wallet`}
                    color="secondary"
                    size="small"
                    style={[a.self_start]}
                    onPress={() => navigation.navigate('WalletsSettings')}>
                    <ButtonText>
                      <Trans>Link a wallet</Trans>
                    </ButtonText>
                  </Button>
                </SettingsList.Item>
              )}

              {items.length === 0 ? (
                <SettingsList.Item
                  style={[a.flex_col, a.align_stretch, a.gap_xs]}>
                  <Text style={[a.text_lg, a.font_semi_bold]}>
                    <Trans>No plans yet</Trans>
                  </Text>
                  <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
                    <Trans>
                      Create a plan to let people support you every month and
                      unlock your members-only posts.
                    </Trans>
                  </Text>
                </SettingsList.Item>
              ) : (
                items.map(plan => (
                  <SettingsList.Item
                    key={plan.uri}
                    style={[a.flex_col, a.align_stretch]}>
                    <PlanCard
                      name={plan.record.name}
                      description={plan.record.description}
                      priceUsdc={plan.record.priceUsdc}
                      perks={plan.record.perks}
                      memberCount={plan.memberCount}
                      inactive={!plan.record.active}>
                      <View style={[a.flex_row, a.gap_sm, a.flex_wrap]}>
                        <Button
                          label={l`Edit ${plan.record.name}`}
                          color="secondary"
                          size="small"
                          onPress={() => openDialog(plan)}>
                          <ButtonText>
                            <Trans>Edit</Trans>
                          </ButtonText>
                        </Button>
                        <Button
                          label={
                            plan.record.active
                              ? l`Turn off ${plan.record.name}`
                              : l`Turn on ${plan.record.name}`
                          }
                          color={
                            plan.record.active ? 'negative_subtle' : 'secondary'
                          }
                          size="small"
                          disabled={setActive.isPending}
                          onPress={() => toggle(plan)}>
                          <ButtonText>
                            {plan.record.active ? (
                              <Trans>Turn off</Trans>
                            ) : (
                              <Trans>Turn on</Trans>
                            )}
                          </ButtonText>
                        </Button>
                      </View>
                    </PlanCard>
                  </SettingsList.Item>
                ))
              )}

              <SettingsList.Item
                style={[a.flex_col, a.align_stretch, a.gap_sm]}>
                <Button
                  testID="addPlanButton"
                  label={l`Add a plan`}
                  color="primary"
                  size="large"
                  disabled={!hasWallet || !canAdd}
                  onPress={() => openDialog()}>
                  <ButtonIcon icon={PlusIcon} />
                  <ButtonText>
                    <Trans>Add a plan</Trans>
                  </ButtonText>
                </Button>
                {!canAdd && (
                  <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                    <Trans>
                      You can have at most {PLANS_MAX} active plans. Turn one
                      off to add another.
                    </Trans>
                  </Text>
                )}
                <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                  <Trans>
                    Turning a plan off stops new members from joining it.
                    Current members keep their access until their period ends.
                  </Trans>
                </Text>
              </SettingsList.Item>

              <SettingsList.Divider />
              <SettingsList.LinkItem
                to="/settings/membership/members"
                label={l`Members`}>
                <SettingsList.ItemIcon icon={GroupIcon} />
                <SettingsList.ItemText>
                  <Trans>Members</Trans>
                </SettingsList.ItemText>
              </SettingsList.LinkItem>
              <SettingsList.LinkItem
                to="/settings/creator-dashboard"
                label={l`Creator dashboard`}>
                <SettingsList.ItemIcon icon={GrowthIcon} />
                <SettingsList.ItemText>
                  <Trans>Creator dashboard</Trans>
                </SettingsList.ItemText>
              </SettingsList.LinkItem>
            </>
          )}
        </SettingsList.Container>
      </Layout.Content>
      <PlanDialog control={dialog} plan={editing} openCount={openCount} />
    </Layout.Screen>
  )
}
