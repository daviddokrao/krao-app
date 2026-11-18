import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {webLinks} from '#/lib/constants'
import {atoms as a, useTheme} from '#/alf'
import * as Toggle from '#/components/forms/Toggle'
import {InlineLinkText} from '#/components/Link'
import {Text} from '#/components/Typography'

export type SignupConsentValue = {terms: boolean; data: boolean}

/**
 * The consent asked for when signing up. Both boxes are required: the terms
 * and privacy policy, and the processing of the phone number, identity
 * verification (KYC) and wallet data Krao needs to run the network.
 */
export function SignupConsent({
  value,
  onChange,
  isInvalid,
}: {
  value: SignupConsentValue
  onChange: (value: SignupConsentValue) => void
  isInvalid?: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()

  return (
    <View testID="signupConsent" style={[a.gap_md]}>
      <Toggle.Item
        testID="consentTermsCheckbox"
        name="consentTerms"
        label={l`I agree to the Terms of Service and the Privacy Policy`}
        value={value.terms}
        isInvalid={isInvalid && !value.terms}
        onChange={terms => onChange({...value, terms})}>
        <View style={[a.flex_1, a.flex_row, a.align_start, a.gap_sm]}>
          <Toggle.Checkbox />
          <Text style={[a.flex_1, a.text_sm, a.leading_snug]}>
            <Trans>
              I have read and agree to the{' '}
              <InlineLinkText
                label={l`Read the Krao Terms of Service`}
                to={webLinks.tos}
                style={[a.text_sm]}>
                Terms of Service
              </InlineLinkText>{' '}
              and the{' '}
              <InlineLinkText
                label={l`Read the Krao Privacy Policy`}
                to={webLinks.privacy}
                style={[a.text_sm]}>
                Privacy Policy
              </InlineLinkText>
              .
            </Trans>
          </Text>
        </View>
      </Toggle.Item>
      <Toggle.Item
        testID="consentDataCheckbox"
        name="consentData"
        label={l`I agree to Krao processing my phone number, identity verification and wallet data`}
        value={value.data}
        isInvalid={isInvalid && !value.data}
        onChange={data => onChange({...value, data})}>
        <View style={[a.flex_1, a.flex_row, a.align_start, a.gap_sm]}>
          <Toggle.Checkbox />
          <Text style={[a.flex_1, a.text_sm, a.leading_snug]}>
            <Trans>
              I agree that Krao processes my phone number, my identity
              verification (KYC) and my linked wallet data, as described in the{' '}
              <InlineLinkText
                label={l`Read the Krao Privacy Policy`}
                to={webLinks.privacy}
                style={[a.text_sm]}>
                Privacy Policy
              </InlineLinkText>
              . I can download my data at any time.
            </Trans>
          </Text>
        </View>
      </Toggle.Item>
      {isInvalid && !(value.terms && value.data) && (
        <Text style={[a.text_sm, {color: t.palette.negative_500}]}>
          <Trans>You need to agree to both to create an account.</Trans>
        </Text>
      )}
    </View>
  )
}
