import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {makeProfileLink} from '#/lib/routes/links'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useProfilesQuery} from '#/state/queries/profile'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {formatUsd} from '#/features/membership/logic'
import type * as bsky from '#/types/bsky'
import {type Supporter, useTopSupportersQuery} from '../queries'

const AVATAR = 32

/**
 * The accounts that tipped this one the most. Tippers who chose to be
 * anonymous are listed without a name.
 */
export function TopSupporters({did}: {did: string}) {
  const t = useTheme()
  const {data: supporters} = useTopSupportersQuery(did)
  const dids = (supporters ?? []).flatMap(s => (s.did ? [s.did] : []))
  const {data: profiles} = useProfilesQuery({handles: dids})
  if (!supporters?.length) return null
  const byDid = new Map<string, bsky.profile.AnyProfileView>(
    profiles?.profiles.map(p => [p.did, p]),
  )

  return (
    <View testID="topSupporters" style={[a.gap_sm, a.pt_sm]}>
      <Text style={[a.text_md, a.font_semi_bold]}>
        <Trans>Top supporters</Trans>
      </Text>
      <View style={[a.gap_xs]} accessibilityRole="list">
        {supporters.map((supporter, i) => (
          <SupporterRow
            key={supporter.did ?? `anonymous-${i}`}
            rank={i + 1}
            supporter={supporter}
            profile={supporter.did ? byDid.get(supporter.did) : undefined}
          />
        ))}
      </View>
      <View style={[a.border_b, t.atoms.border_contrast_low]} />
    </View>
  )
}

function SupporterRow({
  rank,
  supporter,
  profile,
}: {
  rank: number
  supporter: Supporter
  profile: bsky.profile.AnyProfileView | undefined
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const total = formatUsd(supporter.totalUsd)
  const tips = plural(supporter.tipCount, {one: '# tip', other: '# tips'})
  const anonymous = supporter.anonymous || !supporter.did
  const name = anonymous
    ? l`Anonymous supporter`
    : profile
      ? sanitizeDisplayName(
          profile.displayName || sanitizeHandle(profile.handle),
        )
      : (supporter.did ?? '')

  const content = (
    <View style={[a.flex_row, a.align_center, a.gap_sm, a.w_full]}>
      <Text
        style={[
          a.text_sm,
          a.font_semi_bold,
          t.atoms.text_contrast_medium,
          {width: 18},
        ]}>
        {rank}
      </Text>
      {anonymous ? (
        <View
          accessible={false}
          style={[
            a.align_center,
            a.justify_center,
            a.rounded_full,
            t.atoms.bg_contrast_100,
            {width: AVATAR, height: AVATAR},
          ]}>
          <Text style={[a.text_md, t.atoms.text_contrast_medium]}>?</Text>
        </View>
      ) : (
        <UserAvatar type="user" size={AVATAR} avatar={profile?.avatar} />
      )}
      <View style={[a.flex_1]}>
        <Text emoji numberOfLines={1} style={[a.text_md, a.font_semi_bold]}>
          {name}
        </Text>
        <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
          {total} · {tips}
        </Text>
      </View>
    </View>
  )

  if (anonymous || !profile) {
    return (
      <View
        accessible
        accessibilityLabel={l`${rank}. ${name}, ${total} in ${tips}`}
        accessibilityHint="">
        {content}
      </View>
    )
  }
  return (
    <Link
      to={makeProfileLink({did: profile.did, handle: profile.handle})}
      label={l`${rank}. ${name}, ${total} in ${tips}`}
      accessibilityHint={l`Opens their profile`}>
      {content}
    </Link>
  )
}
