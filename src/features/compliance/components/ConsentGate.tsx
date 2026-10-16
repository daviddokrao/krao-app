import {useState} from 'react'
import {ScrollView, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {logger} from '#/logger'
import {useSession, useSessionApi} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {
  CONSENT_DATA,
  CONSENT_TERMS,
  CONSENT_VERSION,
  getPendingConsent,
  needsConsent,
} from '../consent'
import {useConsentQuery, useRecordConsentMutation} from '../queries'
import {SignupConsent, type SignupConsentValue} from './SignupConsent'

/**
 * Accounts with no consent on record for the current terms (made before
 * consent was asked for, or before the terms changed) cannot use the app
 * until they agree. Covers the screen; signing out is the other way out.
 * Nothing shows while the answer is not known, or while the consent given at
 * sign-up is still being recorded.
 */
export function ConsentGate() {
  const {currentAccount} = useSession()
  const consents = useConsentQuery()
  if (!currentAccount) return null
  if (!consents.isSuccess || !needsConsent(consents.data.consents)) return null
  if (getPendingConsent(currentAccount.handle)) return null
  return <ConsentPrompt />
}

function ConsentPrompt() {
  const t = useTheme()
  const {t: l} = useLingui()
  const {logoutCurrentAccount} = useSessionApi()
  const recordConsent = useRecordConsentMutation()
  const [value, setValue] = useState<SignupConsentValue>({
    terms: false,
    data: false,
  })
  const [missing, setMissing] = useState(false)

  const onAgree = () => {
    if (!value.terms || !value.data) {
      setMissing(true)
      return
    }
    recordConsent.mutate(
      {
        version: CONSENT_VERSION,
        items: [...CONSENT_TERMS, ...CONSENT_DATA],
      },
      {
        onError: err =>
          logger.warn('Could not record consent', {safeMessage: err}),
      },
    )
  }

  return (
    <View
      testID="consentGate"
      accessibilityViewIsModal
      style={[a.fixed, a.inset_0, {zIndex: 1000}, t.atoms.bg]}>
      <ScrollView
        contentContainerStyle={[a.align_center, a.p_xl]}
        keyboardShouldPersistTaps="handled">
        <View style={[a.w_full, a.gap_lg, {maxWidth: 500}]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>Before you continue</Trans>
          </Text>
          <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_high]}>
            <Trans>
              Krao updated its terms and how it handles your data. To keep using
              Krao, please read and agree to them.
            </Trans>
          </Text>
          <SignupConsent
            value={value}
            isInvalid={missing}
            onChange={next => {
              setValue(next)
              if (next.terms && next.data) setMissing(false)
            }}
          />
          {recordConsent.isError && (
            <Admonition.Admonition type="error">
              <Trans>Could not save your answer. Please try again.</Trans>
            </Admonition.Admonition>
          )}
          <Button
            testID="consentAgreeButton"
            label={l`Agree and continue`}
            color="primary"
            size="large"
            disabled={recordConsent.isPending}
            onPress={onAgree}>
            {recordConsent.isPending && <ButtonIcon icon={Loader} />}
            <ButtonText>
              <Trans>Agree and continue</Trans>
            </ButtonText>
          </Button>
          <Button
            label={l`Sign out`}
            color="secondary"
            size="large"
            onPress={() => logoutCurrentAccount('Settings')}>
            <ButtonText>
              <Trans>Sign out</Trans>
            </ButtonText>
          </Button>
        </View>
      </ScrollView>
    </View>
  )
}
