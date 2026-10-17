import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {sanitizeHandle} from '#/lib/strings/handles'
import {useProfileQuery} from '#/state/queries/profile'
import {atoms as a, useTheme} from '#/alf'
import {Warning_Stroke2_Corner0_Rounded as WarningIcon} from '#/components/icons/Warning'
import {Text} from '#/components/Typography'
import {useAddressLookalikes} from '../queries'

/**
 * Under a post or a message: a chip for each EVM address in `text` that
 * looks like a wallet another account verified (same first and last
 * characters, a different address), a sign of address poisoning.
 */
export function AddressWarnings({text}: {text: string | undefined}) {
  const {data} = useAddressLookalikes(text)
  if (!data?.length) return null
  return (
    <View style={[a.gap_xs, a.pt_xs, a.align_start]} testID="addressWarnings">
      {data.map(({address, did}) => (
        <AddressWarningChip key={address} did={did} />
      ))}
    </View>
  )
}

function AddressWarningChip({did}: {did: string}) {
  const t = useTheme()
  const {data: profile} = useProfileQuery({did})
  const handle = profile ? sanitizeHandle(profile.handle, '@') : undefined
  return (
    <View
      testID="addressWarningChip"
      accessible
      style={[
        a.flex_row,
        a.align_center,
        a.gap_xs,
        a.px_sm,
        a.py_xs,
        a.rounded_md,
        {backgroundColor: t.palette.negative_50},
      ]}>
      <WarningIcon fill={t.palette.negative_700} size="sm" />
      <Text
        style={[
          a.flex_shrink,
          a.text_xs,
          a.leading_snug,
          a.font_semi_bold,
          {color: t.palette.negative_700},
        ]}>
        {handle ? (
          <Trans>
            This address looks like the wallet of {handle} – it may be fake
          </Trans>
        ) : (
          <Trans>
            This address looks like another account’s wallet – it may be fake
          </Trans>
        )}
      </Text>
    </View>
  )
}
