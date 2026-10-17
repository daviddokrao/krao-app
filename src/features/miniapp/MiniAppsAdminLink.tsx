import {Trans, useLingui} from '@lingui/react/macro'

import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {ShieldCheck_Stroke2_Corner0_Rounded as ShieldCheckIcon} from '#/components/icons/Shield'
import {isForbidden, usePendingAppsQuery} from './queries'

/**
 * The way in to the Mini Apps review screen, for safety admins only. It asks
 * the indexer for the waiting list first, so an account the indexer refuses
 * never sees the link.
 */
export function MiniAppsAdminLink() {
  const {t: l} = useLingui()
  const pending = usePendingAppsQuery()
  if (!pending.isSuccess || isForbidden(pending.error)) return null
  return (
    <>
      <SettingsList.Divider />
      <SettingsList.LinkItem
        to="/settings/miniapps-admin"
        label={l`Review Mini Apps`}>
        <SettingsList.ItemIcon icon={ShieldCheckIcon} />
        <SettingsList.ItemText>
          <Trans>Review Mini Apps</Trans>
        </SettingsList.ItemText>
      </SettingsList.LinkItem>
    </>
  )
}
