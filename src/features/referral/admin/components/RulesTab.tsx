import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as Toggle from '#/components/forms/Toggle'
import {Loader} from '#/components/Loader'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {type Rule, useRulesQuery, useUpsertRuleMutation} from '../queries'
import {Field} from './CodesTab'
import {EmptyRow} from './shared'

/**
 * Reward rules. The amount, caps, end date and on/off can be changed here;
 * a change applies to events from now on. New kinds of rules (other events,
 * campaigns) are made through the API.
 */
export function RulesTab() {
  const {data, isLoading, isError} = useRulesQuery()
  if (isLoading) return <Loader />
  if (isError) {
    return (
      <Admonition.Admonition type="error">
        <Trans>Could not load the rules.</Trans>
      </Admonition.Admonition>
    )
  }
  if (!data?.length) return <EmptyRow />
  return (
    <View style={[a.gap_md]}>
      <Admonition.Admonition type="info">
        <Trans>
          Changes apply to sign-ups from now on. Points already given keep the
          rule version that gave them.
        </Trans>
      </Admonition.Admonition>
      {data.map(rule => (
        <RuleCard key={`${rule.id}:${rule.version}`} rule={rule} />
      ))}
    </View>
  )
}

function RuleCard({rule}: {rule: Rule}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const upsert = useUpsertRuleMutation()
  const [enabled, setEnabled] = useState(rule.enabled)
  const [amount, setAmount] = useState(String(rule.amount))
  const [capTotal, setCapTotal] = useState(
    rule.capPerBeneficiary ? String(rule.capPerBeneficiary) : '',
  )
  const [capDay, setCapDay] = useState(
    rule.capPerDay ? String(rule.capPerDay) : '',
  )
  const [until, setUntil] = useState(rule.validUntil?.slice(0, 10) ?? '')
  const [error, setError] = useState('')

  const who: Record<Rule['beneficiary'], string> = {
    actor: l`the new account`,
    referrer: l`the referrer`,
    referrer2: l`the referrer’s referrer`,
  }

  const optionalInt = (value: string) => {
    if (!value.trim()) return undefined
    const n = Number(value)
    return Number.isInteger(n) && n > 0 ? n : NaN
  }

  const onSave = () => {
    setError('')
    const points = Number(amount)
    const capPerBeneficiary = optionalInt(capTotal)
    const capPerDay = optionalInt(capDay)
    if (!Number.isInteger(points)) {
      setError(l`Points must be a whole number.`)
      return
    }
    if (Number.isNaN(capPerBeneficiary) || Number.isNaN(capPerDay)) {
      setError(l`Limits must be whole numbers above 0.`)
      return
    }
    if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
      setError(l`Use the date format YYYY-MM-DD.`)
      return
    }
    const {updatedAt: _a, updatedBy: _b, ...rest} = rule
    upsert.mutate(
      {
        ...rest,
        enabled,
        amount: points,
        capPerBeneficiary,
        capPerDay,
        // The rule runs through the whole day it ends on (UTC)
        validUntil: until
          ? new Date(
              Date.parse(`${until}T00:00:00Z`) + 86_400_000,
            ).toISOString()
          : undefined,
      },
      {
        onSuccess: saved =>
          Toast.show(l`Saved as version ${saved.version}`, {type: 'success'}),
        onError: err => setError(err.message),
      },
    )
  }

  return (
    <View
      style={[
        a.gap_md,
        a.p_md,
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_low,
      ]}>
      <View style={[a.gap_2xs]}>
        <Text style={[a.text_md, a.font_semi_bold]}>
          {rule.description || rule.id}
        </Text>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          {rule.id} · v{rule.version} ·{' '}
          {rule.event === 'account.created'
            ? l`on sign-up`
            : l`on identity verification`}{' '}
          · {l`to ${who[rule.beneficiary]}`}
          {rule.vesting.length ? ` · ${l`approved after KYC`}` : ''}
          {rule.campaignId ? ` · ${l`campaign ${rule.campaignId}`}` : ''}
        </Text>
      </View>
      <Toggle.Item
        name="enabled"
        label={l`Rule is on`}
        value={enabled}
        onChange={setEnabled}>
        <Toggle.LabelText style={[a.flex_1]}>
          <Trans>Rule is on</Trans>
        </Toggle.LabelText>
        <Toggle.Platform />
      </Toggle.Item>
      <Field
        label={l`Points`}
        value={amount}
        onChange={setAmount}
        keyboardType="numbers-and-punctuation"
      />
      <View style={[a.flex_row, a.gap_sm]}>
        <View style={[a.flex_1]}>
          <Field
            label={l`Most points per account`}
            value={capTotal}
            onChange={setCapTotal}
            keyboardType="number-pad"
          />
        </View>
        <View style={[a.flex_1]}>
          <Field
            label={l`Most rewards per day`}
            value={capDay}
            onChange={setCapDay}
            keyboardType="number-pad"
          />
        </View>
      </View>
      <Field
        label={l`Ends on (YYYY-MM-DD, optional)`}
        value={until}
        onChange={setUntil}
      />
      {error ? (
        <Admonition.Admonition type="error">{error}</Admonition.Admonition>
      ) : null}
      <Button
        label={l`Save rule`}
        color="primary"
        size="small"
        disabled={upsert.isPending}
        onPress={onSave}>
        <ButtonText>
          <Trans>Save</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}
