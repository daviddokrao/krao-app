import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {useAdjustPointsMutation, useRevokePointsMutation} from '../queries'
import {Field} from './CodesTab'
import {useResolveAccount} from './shared'

/** Manual corrections: add or remove points, or take back all of them */
export function PointsTab() {
  return (
    <View style={[a.gap_lg]}>
      <AdjustForm />
      <RevokeForm />
    </View>
  )
}

function Card({children}: {children: React.ReactNode}) {
  const t = useTheme()
  return (
    <View
      style={[
        a.gap_md,
        a.p_md,
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_low,
      ]}>
      {children}
    </View>
  )
}

function AdjustForm() {
  const t = useTheme()
  const {t: l} = useLingui()
  const adjust = useAdjustPointsMutation()
  const resolve = useResolveAccount()
  const [handle, setHandle] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const onSubmit = async () => {
    setError('')
    const points = Number(amount)
    if (!Number.isInteger(points) || points === 0) {
      setError(l`Points must be a whole number, positive or negative.`)
      return
    }
    let did: string
    try {
      did = await resolve(handle)
    } catch {
      setError(l`No account with that handle.`)
      return
    }
    adjust.mutate(
      {did, amount: points, note: note.trim()},
      {
        onSuccess: () => {
          Toast.show(l`Points adjusted`, {type: 'success'})
          setAmount('')
          setNote('')
        },
        onError: err => setError(err.message),
      },
    )
  }

  return (
    <Card>
      <View style={[a.gap_2xs]}>
        <Text style={[a.text_md, a.font_semi_bold]}>
          <Trans>Adjust points</Trans>
        </Text>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>
            Approved at once and logged. Use a negative number to remove points.
          </Trans>
        </Text>
      </View>
      <Field label={l`Handle`} value={handle} onChange={setHandle} />
      <Field
        label={l`Points`}
        value={amount}
        onChange={setAmount}
        keyboardType="numbers-and-punctuation"
      />
      <Field
        label={l`Note (at least 10 characters)`}
        value={note}
        onChange={setNote}
      />
      {error ? (
        <Admonition.Admonition type="error">{error}</Admonition.Admonition>
      ) : null}
      <Button
        label={l`Adjust points`}
        color="primary"
        size="large"
        disabled={adjust.isPending || !handle.trim() || note.trim().length < 10}
        onPress={() => void onSubmit()}>
        <ButtonText>
          <Trans>Adjust points</Trans>
        </ButtonText>
      </Button>
    </Card>
  )
}

function RevokeForm() {
  const t = useTheme()
  const {t: l} = useLingui()
  const revoke = useRevokePointsMutation()
  const resolve = useResolveAccount()
  const confirm = Prompt.usePromptControl()
  const [handle, setHandle] = useState('')
  const [note, setNote] = useState('')
  const [did, setDid] = useState('')
  const [error, setError] = useState('')

  const onAsk = async () => {
    setError('')
    try {
      setDid(await resolve(handle))
      confirm.open()
    } catch {
      setError(l`No account with that handle.`)
    }
  }

  return (
    <Card>
      <View style={[a.gap_2xs]}>
        <Text style={[a.text_md, a.font_semi_bold]}>
          <Trans>Take back all points</Trans>
        </Text>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>
            For fraud. Voids the account’s pending points and reverses its
            approved ones, along with what it earned its referrer. Taken down
            accounts lose their points automatically, and do not get them back
            if the takedown is lifted.
          </Trans>
        </Text>
      </View>
      <Field label={l`Handle`} value={handle} onChange={setHandle} />
      <Field
        label={l`Note (at least 10 characters)`}
        value={note}
        onChange={setNote}
      />
      {error ? (
        <Admonition.Admonition type="error">{error}</Admonition.Admonition>
      ) : null}
      <Button
        label={l`Take back all points`}
        color="negative"
        size="large"
        disabled={revoke.isPending || !handle.trim() || note.trim().length < 10}
        onPress={() => void onAsk()}>
        <ButtonText>
          <Trans>Take back all points</Trans>
        </ButtonText>
      </Button>
      <Prompt.Basic
        control={confirm}
        title={l`Take back all points?`}
        description={l`This cannot be undone, except by adjusting points by hand.`}
        confirmButtonCta={l`Take back`}
        confirmButtonColor="negative"
        onConfirm={() =>
          revoke.mutate(
            {did, note: note.trim()},
            {
              onSuccess: ({voided, reversed}) => {
                Toast.show(l`${voided} voided, ${reversed} reversed`, {
                  type: 'success',
                })
                setNote('')
              },
              onError: err => setError(err.message),
            },
          )
        }
      />
    </Card>
  )
}
