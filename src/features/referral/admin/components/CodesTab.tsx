import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as TextField from '#/components/forms/TextField'
import {Loader} from '#/components/Loader'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {getReferralUrl, RewardsError} from '../../api'
import {
  type CodeView,
  useCodesQuery,
  useCreateCodeMutation,
  useUpdateCodeMutation,
} from '../queries'
import {AccountName, EmptyRow, useFormatDate, useResolveAccount} from './shared'

/** Campaign and partner codes: create them, see their use, turn them off */
export function CodesTab() {
  const t = useTheme()
  const {data, isLoading, isError} = useCodesQuery()

  return (
    <View style={[a.gap_lg]}>
      <CreateCodeForm />
      {isLoading ? (
        <Loader />
      ) : isError ? (
        <Admonition.Admonition type="error">
          <Trans>Could not load codes.</Trans>
        </Admonition.Admonition>
      ) : !data?.length ? (
        <EmptyRow />
      ) : (
        <View style={[a.border, a.rounded_md, t.atoms.border_contrast_low]}>
          {data.map((code, i) => (
            <CodeRow key={code.code} code={code} first={i === 0} />
          ))}
        </View>
      )}
    </View>
  )
}

function CreateCodeForm() {
  const t = useTheme()
  const {t: l} = useLingui()
  const create = useCreateCodeMutation()
  const resolve = useResolveAccount()
  const [kind, setKind] = useState<'campaign' | 'partner'>('campaign')
  const [code, setCode] = useState('')
  const [owner, setOwner] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const onCreate = async () => {
    setError('')
    let ownerDid: string | undefined
    if (owner.trim()) {
      try {
        ownerDid = await resolve(owner)
      } catch {
        setError(l`No account with that handle.`)
        return
      }
    }
    const uses = maxUses.trim() ? Number(maxUses) : undefined
    if (uses !== undefined && !(Number.isInteger(uses) && uses > 0)) {
      setError(l`The use limit must be a whole number above 0.`)
      return
    }
    create.mutate(
      {
        code: code.trim() || undefined,
        kind,
        ownerDid,
        campaignId: campaignId.trim() || undefined,
        maxUses: uses,
        note: note.trim() || undefined,
      },
      {
        onSuccess: created => {
          Toast.show(l`Code ${created.code} created`, {type: 'success'})
          setCode('')
          setOwner('')
          setCampaignId('')
          setMaxUses('')
          setNote('')
        },
        onError: err =>
          setError(
            err instanceof RewardsError && err.error === 'CodeTaken'
              ? l`That code already exists.`
              : err.message,
          ),
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
      <Text style={[a.text_md, a.font_semi_bold]}>
        <Trans>New code</Trans>
      </Text>
      <SegmentedControl.Root
        label={l`Kind of code`}
        type="radio"
        size="small"
        value={kind}
        onChange={setKind}>
        <SegmentedControl.Item value="campaign" label={l`Campaign`}>
          <SegmentedControl.ItemText>
            <Trans>Campaign</Trans>
          </SegmentedControl.ItemText>
        </SegmentedControl.Item>
        <SegmentedControl.Item value="partner" label={l`Partner`}>
          <SegmentedControl.ItemText>
            <Trans>Partner</Trans>
          </SegmentedControl.ItemText>
        </SegmentedControl.Item>
      </SegmentedControl.Root>
      <Field
        label={l`Code (random if empty)`}
        value={code}
        onChange={v => setCode(v.toUpperCase())}
        placeholder="LAUNCH-2026"
      />
      <Field
        label={l`Referrer credited (handle, optional)`}
        value={owner}
        onChange={setOwner}
        placeholder="partner.krao.net"
      />
      <Field
        label={l`Campaign id (optional, for campaign rules)`}
        value={campaignId}
        onChange={setCampaignId}
      />
      <Field
        label={l`Use limit (optional)`}
        value={maxUses}
        onChange={setMaxUses}
        keyboardType="number-pad"
      />
      <Field label={l`Note (optional)`} value={note} onChange={setNote} />
      {error ? (
        <Admonition.Admonition type="error">{error}</Admonition.Admonition>
      ) : null}
      <Button
        label={l`Create code`}
        color="primary"
        size="large"
        disabled={create.isPending}
        onPress={() => void onCreate()}>
        <ButtonText>
          <Trans>Create code</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}

function CodeRow({code, first}: {code: CodeView; first: boolean}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const formatDate = useFormatDate()
  const update = useUpdateCodeMutation()
  const expired = !!code.expiresAt && new Date(code.expiresAt) < new Date()

  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.gap_md,
        a.p_md,
        !first && [a.border_t, t.atoms.border_contrast_low],
      ]}>
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text
          selectable
          style={[
            a.text_md,
            a.font_semi_bold,
            code.disabled && [a.italic, t.atoms.text_contrast_medium],
          ]}>
          {code.code}
          {code.disabled ? ` · ${l`off`}` : expired ? ` · ${l`expired`}` : ''}
        </Text>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          {code.kind === 'partner' ? l`Partner` : l`Campaign`}
          {code.campaignId ? ` · ${code.campaignId}` : ''} ·{' '}
          {code.maxUses
            ? l`${code.uses} of ${code.maxUses} used`
            : l`${code.uses} used`}{' '}
          · {formatDate(code.createdAt)}
        </Text>
        {code.ownerDid ? <AccountName did={code.ownerDid} /> : null}
        <Text
          selectable
          style={[a.text_sm, t.atoms.text_contrast_medium]}
          numberOfLines={1}>
          {getReferralUrl(code.code).replace(/^https?:\/\//, '')}
        </Text>
      </View>
      <Button
        label={code.disabled ? l`Turn the code on` : l`Turn the code off`}
        color={code.disabled ? 'secondary' : 'negative_subtle'}
        size="small"
        disabled={update.isPending}
        onPress={() =>
          update.mutate(
            {code: code.code, disabled: !code.disabled},
            {onError: () => Toast.show(l`Could not change the code`)},
          )
        }>
        <ButtonText>
          {code.disabled ? <Trans>Turn on</Trans> : <Trans>Turn off</Trans>}
        </ButtonText>
      </Button>
    </View>
  )
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  keyboardType?: 'number-pad' | 'numbers-and-punctuation'
}) {
  return (
    <View>
      <TextField.LabelText>{label}</TextField.LabelText>
      <TextField.Root>
        <TextField.Input
          label={label}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={keyboardType}
        />
      </TextField.Root>
    </View>
  )
}
