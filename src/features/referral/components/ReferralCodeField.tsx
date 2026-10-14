import {type TextInput, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {sanitizeHandle} from '#/lib/strings/handles'
import {useProfileQuery} from '#/state/queries/profile'
import {atoms as a, native, useTheme} from '#/alf'
import * as TextField from '#/components/forms/TextField'
import {Ticket_Stroke2_Corner0_Rounded as Ticket} from '#/components/icons/Ticket'
import {Text} from '#/components/Typography'
import {useReferralCodeCheckQuery} from '../queries'

/**
 * The sign-up form's code field. Krao sign-up needs a referral code; the
 * field checks it as it is typed and names who it belongs to.
 */
export function ReferralCodeField({
  value,
  onChange,
  isInvalid,
  nextInputRef,
}: {
  value: string
  onChange: (value: string) => void
  isInvalid: boolean
  nextInputRef?: React.RefObject<React.ComponentRef<typeof TextInput> | null>
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const check = useReferralCodeCheckQuery(value)
  const referrer = check.data?.valid ? check.data.referrer : undefined
  const {data: profile} = useProfileQuery({did: referrer})

  return (
    <View>
      <TextField.LabelText>
        <Trans>Referral code</Trans>
      </TextField.LabelText>
      <TextField.Root isInvalid={isInvalid || check.data?.valid === false}>
        <TextField.Icon icon={Ticket} />
        <TextField.Input
          testID="referralCodeInput"
          onChangeText={text => onChange(text.trim().toUpperCase())}
          label={l`Ask a Krao member for their code`}
          value={value}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="next"
          submitBehavior={native('submit')}
          onSubmitEditing={native(() => nextInputRef?.current?.focus())}
        />
      </TextField.Root>
      {check.data?.valid === false ? (
        <Text style={[a.text_sm, a.mt_xs, {color: t.palette.negative_500}]}>
          <Trans>
            This code is not valid. Check it with the person who invited you.
          </Trans>
        </Text>
      ) : check.data?.valid ? (
        <Text style={[a.text_sm, a.mt_xs, {color: t.palette.positive_600}]}>
          {profile ? (
            <Trans>
              Invited by{' '}
              {profile.displayName || sanitizeHandle(profile.handle, '@')}
            </Trans>
          ) : (
            <Trans>Valid code</Trans>
          )}
        </Text>
      ) : (
        <Text style={[a.text_sm, a.mt_xs, t.atoms.text_contrast_medium]}>
          <Trans>
            Krao is invite-only for now: you need a code from a member to join.
          </Trans>
        </Text>
      )}
    </View>
  )
}
