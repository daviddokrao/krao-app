import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {type AccessMode, communityPath} from '../logic'
import {type CommunityView} from '../queries'
import {useAccessText} from './accessText'

/**
 * Communities have no avatar image in the app yet: a tile with the first
 * letters of the name, in a color picked from the slug so a community looks
 * the same everywhere.
 */
const TILE_HUES = [215, 160, 28, 285, 340, 190, 95, 250]

export function CommunityAvatar({
  name,
  slug,
  size = 48,
}: {
  name: string
  slug: string
  size?: number
}) {
  let hash = 0
  for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  const hue = TILE_HUES[Math.abs(hash) % TILE_HUES.length]
  const initials = [...name.trim().split(/\s+/).slice(0, 2).join(' ')]
    .filter((ch, i, all) => i === 0 || all[i - 1] === ' ')
    .join('')
    .toUpperCase()
  return (
    <View
      accessible={false}
      style={[
        a.align_center,
        a.justify_center,
        {
          width: size,
          height: size,
          borderRadius: size / 4,
          backgroundColor: `hsl(${hue} 55% 42%)`,
        },
      ]}>
      <Text
        emoji
        style={[a.font_bold, {color: '#fff', fontSize: size * 0.38}]}
        maxFontSizeMultiplier={1.2}>
        {initials || '#'}
      </Text>
    </View>
  )
}

export function MemberCount({count}: {count: number}) {
  return (
    <>
      {plural(count, {
        one: '# member',
        other: '# members',
      })}
    </>
  )
}

/** A row in the community lists */
export function CommunityCard({
  community,
  hideTopBorder,
}: {
  community: CommunityView
  hideTopBorder?: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const accessText = useAccessText()
  const mode = community.access.mode as AccessMode
  const state = community.viewer?.state
  return (
    <Link
      testID={`communityCard-${community.slug}`}
      to={communityPath(community.uri)}
      label={l`${community.name}, community`}
      accessibilityHint={l`Opens the community page`}>
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
        <CommunityAvatar name={community.name} slug={community.slug} />
        <View style={[a.flex_1, a.gap_2xs]}>
          <Text emoji numberOfLines={1} style={[a.text_md, a.font_semi_bold]}>
            {community.name}
          </Text>
          <Text
            numberOfLines={1}
            style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <MemberCount count={community.memberCount} />
            {' · '}
            {accessText(mode).short}
          </Text>
        </View>
        {state === 'member' && (
          <Text
            style={[
              a.text_xs,
              a.font_semi_bold,
              {color: t.palette.primary_600},
            ]}>
            <Trans>Joined</Trans>
          </Text>
        )}
        {state === 'pending' && (
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Trans>Requested</Trans>
          </Text>
        )}
      </View>
    </Link>
  )
}
