import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {canRunApp, miniAppPath, miniAppRefFromEmbed} from '../logic'
import {useMiniAppQuery} from '../queries'
import {MiniAppIcon} from './MiniAppIcon'

/**
 * The card of a post that carries a Mini App (net.krao.embed.miniapp). The
 * AppView does not know this embed, so it is read from the post's record.
 * Renders nothing for any other post, and while the app is loading or gone.
 * An app Krao has not approved shows a notice and no way to open it.
 */
export function MiniAppEmbed({record}: {record: unknown}) {
  const embed = (record as {embed?: unknown} | undefined)?.embed
  const ref = miniAppRefFromEmbed(embed)
  if (!ref) return null
  return <MiniAppEmbedCard uri={ref.uri} />
}

function MiniAppEmbedCard({uri}: {uri: string}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {data: app, isError} = useMiniAppQuery(uri)
  if (isError) {
    return (
      <View
        testID="miniAppEmbedUnavailable"
        style={[
          a.mt_sm,
          a.p_md,
          a.rounded_md,
          a.border,
          t.atoms.border_contrast_medium,
        ]}>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>This Mini App is not available.</Trans>
        </Text>
      </View>
    )
  }
  if (!app) return null
  const runnable = canRunApp(app)
  const path = miniAppPath(app.uri)
  const body = (
    <View
      style={[
        a.flex_row,
        a.gap_md,
        a.p_md,
        a.align_center,
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_medium,
        t.atoms.bg_contrast_25,
      ]}>
      <MiniAppIcon name={app.name} uri={app.uri} iconUrl={app.iconUrl} />
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text emoji numberOfLines={1} style={[a.text_md, a.font_semi_bold]}>
          {app.name}
        </Text>
        {runnable ? (
          <Text
            numberOfLines={2}
            style={[a.text_sm, t.atoms.text_contrast_medium]}>
            {app.description || app.origin}
          </Text>
        ) : (
          <Text
            testID="miniAppNotApproved"
            style={[
              a.text_sm,
              a.font_semi_bold,
              {color: t.palette.negative_500},
            ]}>
            <Trans>Mini App not approved by Krao</Trans>
          </Text>
        )}
      </View>
      {runnable && (
        <Text
          style={[a.text_sm, a.font_semi_bold, {color: t.palette.primary_600}]}>
          <Trans>Open</Trans>
        </Text>
      )}
    </View>
  )
  return (
    <View testID="miniAppEmbed" style={[a.mt_sm]}>
      {runnable && path ? (
        <Link
          to={path}
          label={l`${app.name}, Mini App`}
          accessibilityHint={l`Opens the Mini App`}>
          {body}
        </Link>
      ) : (
        body
      )}
    </View>
  )
}
