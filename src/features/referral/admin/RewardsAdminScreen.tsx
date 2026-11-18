import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {atoms as a} from '#/alf'
import * as Admonition from '#/components/Admonition'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {CodesTab} from './components/CodesTab'
import {KycTab} from './components/KycTab'
import {LogTab} from './components/LogTab'
import {PointsTab} from './components/PointsTab'
import {RulesTab} from './components/RulesTab'
import {useRewardsRolesQuery} from './queries'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'RewardsAdmin'>
type Tab = 'kyc' | 'codes' | 'rules' | 'points' | 'log'

/**
 * Referral admin: KYC reviews, codes, reward rules, point corrections and
 * the log. KYC reviewers see the KYC tab only.
 */
export function RewardsAdminScreen({}: Props) {
  const {t: l} = useLingui()
  const {data: roles, isLoading} = useRewardsRolesQuery()
  const isAdmin = !!roles?.includes('admin')
  const [tab, setTab] = useState<Tab>('kyc')

  return (
    <Layout.Screen testID="rewardsAdminScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Referral admin</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <View style={[a.p_lg, a.gap_lg]}>
          {isLoading ? (
            <Loader />
          ) : !roles?.length ? (
            <Admonition.Admonition type="error">
              <Trans>Only Krao admins can open this page.</Trans>
            </Admonition.Admonition>
          ) : (
            <>
              {isAdmin && (
                <SegmentedControl.Root
                  label={l`Section`}
                  type="tabs"
                  size="small"
                  value={tab}
                  onChange={setTab}>
                  <SegmentedControl.Item value="kyc" label={l`KYC`}>
                    <SegmentedControl.ItemText>KYC</SegmentedControl.ItemText>
                  </SegmentedControl.Item>
                  <SegmentedControl.Item value="codes" label={l`Codes`}>
                    <SegmentedControl.ItemText>
                      <Trans>Codes</Trans>
                    </SegmentedControl.ItemText>
                  </SegmentedControl.Item>
                  <SegmentedControl.Item value="rules" label={l`Rules`}>
                    <SegmentedControl.ItemText>
                      <Trans>Rules</Trans>
                    </SegmentedControl.ItemText>
                  </SegmentedControl.Item>
                  <SegmentedControl.Item value="points" label={l`Points`}>
                    <SegmentedControl.ItemText>
                      <Trans>Points</Trans>
                    </SegmentedControl.ItemText>
                  </SegmentedControl.Item>
                  <SegmentedControl.Item value="log" label={l`Log`}>
                    <SegmentedControl.ItemText>
                      <Trans>Log</Trans>
                    </SegmentedControl.ItemText>
                  </SegmentedControl.Item>
                </SegmentedControl.Root>
              )}
              {!isAdmin || tab === 'kyc' ? (
                <KycTab />
              ) : tab === 'codes' ? (
                <CodesTab />
              ) : tab === 'rules' ? (
                <RulesTab />
              ) : tab === 'points' ? (
                <PointsTab />
              ) : (
                <LogTab />
              )}
            </>
          )}
        </View>
      </Layout.Content>
    </Layout.Screen>
  )
}
