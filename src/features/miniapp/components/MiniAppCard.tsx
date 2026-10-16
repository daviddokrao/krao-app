import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {miniAppPath, type MiniAppView} from '../logic'
import {MiniAppIcon} from './MiniAppIcon'

/** A row in the Mini Apps list */
export function MiniAppCard({
  app,
  hideTopBorder,
}: {
  app: MiniAppView
  hideTopBorder?: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const path = miniAppPath(app.uri)
  const content = (
    <View
      style={[
        a.flex_row,
        a.gap_md,
        a.px_xl,
        a.py_md,
        a.align_center,
        a.w_full,
        !hideTopBorder && a.border_t,
        t.atoms.border_contrast_low,
      ]}>
      <MiniAppIcon name={app.name} uri={app.uri} iconUrl={app.iconUrl} />
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text emoji numberOfLines={1} style={[a.text_md, a.font_semi_bold]}>
          {app.name}
        </Text>
        <Text
          numberOfLines={2}
          style={[a.text_sm, t.atoms.text_contrast_medium]}>
          {app.description || app.origin}
        </Text>
      </View>
      <Text
        style={[a.text_sm, a.font_semi_bold, {color: t.palette.primary_600}]}>
        <Trans>Open</Trans>
      </Text>
    </View>
  )
  if (!path) return null
  return (
    <Link
      testID={`miniAppCard-${app.name}`}
      to={path}
      label={l`${app.name}, Mini App`}
      accessibilityHint={l`Opens the Mini App`}>
      {content}
    </Link>
  )
}
