import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {logger} from '#/logger'
import {atoms as a, useTheme} from '#/alf'
import * as Toggle from '#/components/forms/Toggle'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {
  useBadgeVisibilityQuery,
  useSetBadgeVisibilityMutation,
} from '../queries'

/**
 * Settings > Account: show the "human" badge on the profile. It appears once
 * the account has a verified phone number or identity check; Krao never says
 * which.
 */
export function HumanBadgeToggle() {
  const t = useTheme()
  const {t: l} = useLingui()
  const {data, isLoading} = useBadgeVisibilityQuery()
  const setVisibility = useSetBadgeVisibilityMutation()

  const onChange = (human: boolean) => {
    setVisibility.mutate(human, {
      onError: err => {
        logger.error('Could not change the human badge', {safeMessage: err})
        Toast.show(l`Could not change the badge. Try again later.`, {
          type: 'error',
        })
      },
    })
  }

  return (
    <View style={[a.flex_1, a.gap_sm]}>
      <Toggle.Item
        testID="humanBadgeToggle"
        name="human_badge"
        disabled={isLoading || !data || setVisibility.isPending}
        value={data?.human ?? false}
        onChange={onChange}
        label={l`Show the real person badge`}
        style={[a.w_full]}>
        <Toggle.LabelText style={[a.flex_1]}>
          <Trans>Show the real person badge</Trans>
        </Toggle.LabelText>
        <Toggle.Platform />
      </Toggle.Item>
      <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
        {data && !data.eligible ? (
          <Trans>
            Verify your phone number to earn the badge. It shows on your profile
            once you have.
          </Trans>
        ) : (
          <Trans>
            Shows on your profile that a real person is behind this account.
            Krao does not say how you were verified.
          </Trans>
        )}
      </Text>
    </View>
  )
}
