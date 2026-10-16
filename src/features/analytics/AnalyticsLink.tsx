import {Trans, useLingui} from '@lingui/react/macro'

import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {Growth_Stroke2_Corner0_Rounded as ChartIcon} from '#/components/icons/Growth'
import {useRewardsRolesQuery} from '../referral/admin/queries'
import {isForbidden, useAnalyticsSummaryQuery} from './queries'

/**
 * The way in to the analytics screen, for rewards admins only. It asks the
 * service for the totals first, so an account the service refuses (401/403)
 * never sees the link.
 */
export function AnalyticsLink() {
  const {t: l} = useLingui()
  const {data: roles} = useRewardsRolesQuery()
  const isAdmin = !!roles?.includes('admin')
  const summary = useAnalyticsSummaryQuery({enabled: isAdmin})
  if (!isAdmin || isForbidden(summary.error)) return null
  return (
    <SettingsList.LinkItem
      to="/settings/referral/admin/analytics"
      label={l`Analytics`}>
      <SettingsList.ItemIcon icon={ChartIcon} />
      <SettingsList.ItemText>
        <Trans>Analytics</Trans>
      </SettingsList.ItemText>
    </SettingsList.LinkItem>
  )
}
