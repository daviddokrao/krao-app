import {useEffect, useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as TextField from '#/components/forms/TextField'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {formatPhone, normalizePhone} from '../phone'
import {
  usePhoneStatusQuery,
  useRequestPhoneCodeMutation,
  useVerifyPhoneCodeMutation,
} from '../queries'
import {usePhoneErrorMessage} from './usePhoneErrorMessage'

/** Seconds before a new code may be asked for (the service allows 1 a minute) */
export const RESEND_COOLDOWN_SECONDS = 60

/**
 * Enter a phone number, get a code by SMS, enter it. Shows the verified
 * number when there is one, with a way to replace it.
 */
export function PhoneVerifyForm({onVerified}: {onVerified?: () => void}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const status = usePhoneStatusQuery()
  const requestCode = useRequestPhoneCodeMutation()
  const verifyCode = useVerifyPhoneCodeMutation()
  const errorMessage = usePhoneErrorMessage()

  const [phoneInput, setPhoneInput] = useState('')
  const [code, setCode] = useState('')
  // The number the code was sent to, once it was
  const [sentTo, setSentTo] = useState<string>()
  const [resendAt, setResendAt] = useState(0)
  const [now, setNow] = useState(0)
  const [changing, setChanging] = useState(false)
  const [error, setError] = useState('')

  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000))
  useEffect(() => {
    if (!resendAt) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [resendAt])

  const onSend = () => {
    setError('')
    const phone = normalizePhone(phoneInput)
    if (!phone) {
      setError(errorMessage({error: 'InvalidPhone'}, 'request'))
      return
    }
    requestCode.mutate(phone, {
      onSuccess: () => {
        setSentTo(phone)
        setCode('')
        setNow(Date.now())
        setResendAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000)
      },
      onError: err => setError(errorMessage(err, 'request')),
    })
  }

  const onVerify = () => {
    setError('')
    if (!sentTo) return
    if (!/^\d{6}$/.test(code.trim())) {
      setError(errorMessage({error: 'InvalidCode'}, 'verify'))
      return
    }
    verifyCode.mutate(
      {phone: sentTo, code: code.trim()},
      {
        onSuccess: () => {
          setChanging(false)
          setSentTo(undefined)
          setPhoneInput('')
          setCode('')
          onVerified?.()
        },
        onError: err => setError(errorMessage(err, 'verify')),
      },
    )
  }

  if (status.isLoading) return <Loader />
  if (status.isError) {
    return (
      <Admonition.Admonition type="error">
        <Trans>Could not load your phone verification status.</Trans>
      </Admonition.Admonition>
    )
  }
  if (status.data?.available === false && !status.data.verified) {
    return (
      <Admonition.Admonition type="info">
        <Trans>Phone verification is not available yet.</Trans>
      </Admonition.Admonition>
    )
  }

  if (status.data?.verified && !changing) {
    return (
      <View style={[a.gap_md]} testID="phoneVerified">
        <View style={[a.flex_row, a.align_center, a.gap_sm]}>
          <CheckIcon fill={t.palette.positive_600} size="md" />
          <Text style={[a.text_md, a.font_semi_bold]}>
            <Trans>Phone number verified</Trans>
          </Text>
        </View>
        <Text testID="maskedPhone" style={[a.text_lg, a.font_semi_bold]}>
          {status.data.maskedPhone}
        </Text>
        <Button
          label={l`Use a different phone number`}
          color="secondary"
          size="small"
          style={[a.self_start]}
          onPress={() => setChanging(true)}>
          <ButtonText>
            <Trans>Use a different number</Trans>
          </ButtonText>
        </Button>
      </View>
    )
  }

  return (
    <View style={[a.gap_md]} testID="phoneForm">
      <View>
        <TextField.LabelText>
          <Trans>Phone number</Trans>
        </TextField.LabelText>
        <TextField.Root>
          <TextField.Input
            testID="phoneInput"
            label={l`Phone number`}
            placeholder="0912 345 678"
            value={phoneInput}
            onChangeText={value => {
              setPhoneInput(value)
              setError('')
              // Another number needs its own code
              if (sentTo && normalizePhone(value) !== sentTo) {
                setSentTo(undefined)
              }
            }}
            keyboardType="phone-pad"
            autoComplete="tel"
            returnKeyType="send"
            onSubmitEditing={onSend}
          />
        </TextField.Root>
        <Text style={[a.text_sm, a.mt_xs, t.atoms.text_contrast_medium]}>
          <Trans>
            Vietnamese numbers can be written 0912345678 or +84912345678.
          </Trans>
        </Text>
      </View>

      <Button
        testID="sendPhoneCodeButton"
        label={sentTo ? l`Send the code again` : l`Send code`}
        color={sentTo ? 'secondary' : 'primary'}
        size="large"
        disabled={requestCode.isPending || (!!sentTo && remaining > 0)}
        onPress={onSend}>
        {requestCode.isPending && <ButtonIcon icon={Loader} />}
        <ButtonText>
          {sentTo ? (
            remaining > 0 ? (
              <Trans>Send again in {remaining}s</Trans>
            ) : (
              <Trans>Send the code again</Trans>
            )
          ) : (
            <Trans>Send code</Trans>
          )}
        </ButtonText>
      </Button>

      {sentTo && (
        <View style={[a.gap_md]}>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>
              We sent a 6-digit code to {formatPhone(sentTo)}. It works for 5
              minutes.
            </Trans>
          </Text>
          <View>
            <TextField.LabelText>
              <Trans>Code</Trans>
            </TextField.LabelText>
            <TextField.Root>
              <TextField.Input
                testID="phoneCodeInput"
                label={l`6-digit code`}
                placeholder="123456"
                value={code}
                onChangeText={value => {
                  setCode(value.replace(/\D/g, '').slice(0, 6))
                  setError('')
                }}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                returnKeyType="done"
                onSubmitEditing={onVerify}
              />
            </TextField.Root>
          </View>
          <Button
            testID="verifyPhoneCodeButton"
            label={l`Verify`}
            color="primary"
            size="large"
            disabled={verifyCode.isPending || code.length !== 6}
            onPress={onVerify}>
            {verifyCode.isPending && <ButtonIcon icon={Loader} />}
            <ButtonText>
              <Trans>Verify</Trans>
            </ButtonText>
          </Button>
        </View>
      )}

      {!!error && (
        <Admonition.Admonition type="error">{error}</Admonition.Admonition>
      )}
    </View>
  )
}
