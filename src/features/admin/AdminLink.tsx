import {Trans, useLingui} from '@lingui/react/macro'

import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {ShieldCheck_Stroke2_Corner0_Rounded as ShieldCheckIcon} from '#/components/icons/Shield'
import {useMyRolesQuery} from './queries'

/**
 * The way in to Krao admin from Settings, for accounts with at least one
 * role. The service tells which; for everyone else the link is not there.
 */
export function AdminLink() {
  const {t: l} = useLingui()
  const {data: roles} = useMyRolesQuery()
  if (!roles?.length) return null
  return (
    <SettingsList.LinkItem to="/admin" label={l`Krao admin`}>
      <SettingsList.ItemIcon icon={ShieldCheckIcon} />
      <SettingsList.ItemText>
        <Trans>Krao admin</Trans>
      </SettingsList.ItemText>
    </SettingsList.LinkItem>
  )
}
