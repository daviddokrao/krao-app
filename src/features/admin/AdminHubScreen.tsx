import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {type Props as IconProps} from '#/components/icons/common'
import {Gift1_Stroke2_Corner0_Rounded as GiftIcon} from '#/components/icons/Gift1'
import {Growth_Stroke2_Corner0_Rounded as GrowthIcon} from '#/components/icons/Growth'
import {ListMagnifyingGlass_Stroke2_Corner0_Rounded as AuditIcon} from '#/components/icons/List'
import {
  PersonCheck_Stroke2_Corner0_Rounded as PersonCheckIcon,
  PersonGroup_Stroke2_Corner2_Rounded as PersonGroupIcon,
} from '#/components/icons/Person'
import {
  Shield_Stroke2_Corner0_Rounded as ShieldIcon,
  ShieldCheck_Stroke2_Corner0_Rounded as ShieldCheckIcon,
} from '#/components/icons/Shield'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {type AdminSectionId, dedupeSections, sectionsForRoles} from './logic'
import {useMyRolesQuery} from './queries'
import {useRoleText, useSectionText} from './text'

const ICONS: Record<AdminSectionId, React.ComponentType<IconProps>> = {
  rewards: GiftIcon,
  kyc: PersonCheckIcon,
  safety: ShieldIcon,
  moderator: ShieldCheckIcon,
  analytics: GrowthIcon,
  roles: PersonGroupIcon,
  audit: AuditIcon,
}

type Props = NativeStackScreenProps<CommonNavigatorParams, 'AdminHub'>

/**
 * Krao admin: one list of every admin screen the viewer's roles open. The
 * screens keep their own paths and check the role again on their own.
 */
export function AdminHubScreen({}: Props) {
  const t = useTheme()
  const {data: roles, isLoading} = useMyRolesQuery()
  const sectionText = useSectionText()
  const roleText = useRoleText()
  const sections = dedupeSections(sectionsForRoles(roles ?? []))
  const roleNames = (roles ?? []).map(role => roleText[role].name).join(', ')

  return (
    <Layout.Screen testID="adminHubScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Krao admin</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        {isLoading ? (
          <View style={[a.p_lg]}>
            <Loader />
          </View>
        ) : !sections.length ? (
          <View style={[a.p_lg]}>
            <Admonition.Admonition type="error">
              <Trans>Only Krao admins can open this page.</Trans>
            </Admonition.Admonition>
          </View>
        ) : (
          <SettingsList.Container>
            <View style={[a.px_xl, a.pb_md]}>
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                <Trans>Your roles: {roleNames}</Trans>
              </Text>
            </View>
            {sections.map(section => (
              <SettingsList.LinkItem
                key={section.id}
                to={section.to}
                label={`${sectionText[section.id].name}. ${sectionText[section.id].description}`}>
                <SettingsList.ItemIcon icon={ICONS[section.id]} />
                <View style={[a.flex_1, a.gap_2xs]}>
                  <Text style={[a.text_md, a.font_semi_bold]}>
                    {sectionText[section.id].name}
                  </Text>
                  <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                    {sectionText[section.id].description}
                  </Text>
                </View>
              </SettingsList.LinkItem>
            ))}
          </SettingsList.Container>
        )}
      </Layout.Content>
    </Layout.Screen>
  )
}
