import {useState} from 'react'
import {Pressable, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme, web} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {Loader} from '#/components/Loader'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {type KycStatus, RewardsError} from '../../api'
import {
  type KycRecord,
  type ReasonCode,
  useKycQueueQuery,
  useReviewKycMutation,
} from '../queries'
import {
  AccountName,
  EmptyRow,
  LoadMore,
  useAccountLabel,
  useFormatDate,
  useResolveAccount,
} from './shared'

type Filter = 'pending' | 'retry' | 'rejected' | 'approved' | 'all'

/** KYC records by status, and manual review of exceptions */
export function KycTab() {
  const t = useTheme()
  const {t: l} = useLingui()
  const [filter, setFilter] = useState<Filter>('pending')
  const query = useKycQueueQuery(filter)
  const {data, isLoading, isError} = query
  const control = Dialog.useDialogControl()
  const [reviewDid, setReviewDid] = useState('')
  const [lookup, setLookup] = useState('')
  const resolve = useResolveAccount()

  const statusLabel: Record<KycStatus, string> = {
    none: l`Not started`,
    pending: l`Under review`,
    retry: l`More information needed`,
    approved: l`Verified`,
    rejected: l`Not approved`,
  }

  const open = (did: string) => {
    setReviewDid(did)
    control.open()
  }

  const onLookup = async () => {
    try {
      open(await resolve(lookup))
    } catch {
      Toast.show(l`No account with that handle.`, {type: 'error'})
    }
  }

  return (
    <View style={[a.gap_md]}>
      <Admonition.Admonition type="info">
        <Trans>
          Verification normally happens with the provider. Review by hand only
          in exceptional cases: each review needs a reason and a note, counts
          against a daily limit, and is logged.
        </Trans>
      </Admonition.Admonition>

      <View style={[a.flex_row, a.gap_sm, a.align_end]}>
        <View style={[a.flex_1]}>
          <TextField.LabelText>
            <Trans>Review an account</Trans>
          </TextField.LabelText>
          <TextField.Root>
            <TextField.Input
              label={l`Handle`}
              placeholder="alice.krao.net"
              value={lookup}
              onChangeText={setLookup}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={() => void onLookup()}
            />
          </TextField.Root>
        </View>
        <Button
          label={l`Open review`}
          color="secondary"
          size="large"
          disabled={!lookup.trim()}
          onPress={() => void onLookup()}>
          <ButtonText>
            <Trans>Open</Trans>
          </ButtonText>
        </Button>
      </View>

      <SegmentedControl.Root
        label={l`Status`}
        type="tabs"
        size="small"
        value={filter}
        onChange={setFilter}>
        <SegmentedControl.Item value="pending" label={statusLabel.pending}>
          <SegmentedControl.ItemText>
            {statusLabel.pending}
          </SegmentedControl.ItemText>
        </SegmentedControl.Item>
        <SegmentedControl.Item value="retry" label={l`Retry`}>
          <SegmentedControl.ItemText>
            <Trans>Retry</Trans>
          </SegmentedControl.ItemText>
        </SegmentedControl.Item>
        <SegmentedControl.Item value="rejected" label={statusLabel.rejected}>
          <SegmentedControl.ItemText>
            <Trans>Rejected</Trans>
          </SegmentedControl.ItemText>
        </SegmentedControl.Item>
        <SegmentedControl.Item value="all" label={l`All`}>
          <SegmentedControl.ItemText>
            <Trans>All</Trans>
          </SegmentedControl.ItemText>
        </SegmentedControl.Item>
      </SegmentedControl.Root>

      {isLoading ? (
        <Loader />
      ) : isError ? (
        <Admonition.Admonition type="error">
          <Trans>Could not load KYC records.</Trans>
        </Admonition.Admonition>
      ) : !data?.length ? (
        <EmptyRow />
      ) : (
        <View style={[a.border, a.rounded_md, t.atoms.border_contrast_low]}>
          {data.map((record, i) => (
            <KycRow
              key={record.did}
              record={record}
              first={i === 0}
              statusLabel={statusLabel}
              onPress={() => open(record.did)}
            />
          ))}
        </View>
      )}
      <LoadMore query={query} />

      <Dialog.Outer control={control}>
        <Dialog.Handle />
        <ReviewDialog did={reviewDid} />
      </Dialog.Outer>
    </View>
  )
}

function KycRow({
  record,
  first,
  statusLabel,
  onPress,
}: {
  record: KycRecord
  first: boolean
  statusLabel: Record<KycStatus, string>
  onPress: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const formatDate = useFormatDate()
  const accountLabel = useAccountLabel(record.did)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={l`Review ${accountLabel}`}
      accessibilityHint=""
      onPress={onPress}
      style={[
        a.p_md,
        a.gap_2xs,
        !first && [a.border_t, t.atoms.border_contrast_low],
        web({cursor: 'pointer'}),
      ]}>
      <AccountName did={record.did} />
      <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
        {statusLabel[record.status]}
        {record.provider ? ` · ${record.provider}` : ''}
        {record.pendingSecondApproval
          ? ` · ${l`waiting for a second reviewer`}`
          : ''}
        {` · ${formatDate(record.updatedAt)}`}
      </Text>
      {record.rejectReason ? (
        <Text style={[a.text_sm, {color: t.palette.negative_500}]}>
          {record.rejectReason}
        </Text>
      ) : null}
    </Pressable>
  )
}

function ReviewDialog({did}: {did: string}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const review = useReviewKycMutation()
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve')
  const [reason, setReason] = useState<ReasonCode>('provider_outage')
  const [note, setNote] = useState('')

  const reasons: [ReasonCode, string][] = [
    ['provider_outage', l`The provider was unavailable`],
    ['provider_false_reject', l`The provider rejected a valid identity`],
    ['unsupported_document', l`The document is not supported by the provider`],
    ['partner_verified', l`Verified by a trusted partner`],
    ['fraud', l`Fraud`],
    ['other', l`Other`],
  ]

  const errorText = (err: unknown) => {
    if (err instanceof RewardsError) {
      if (err.error === 'DailyLimitReached') {
        return l`Today's limit of manual reviews has been reached.`
      }
      if (err.error === 'SelfReview') {
        return l`You cannot review your own account.`
      }
      if (err.error === 'SameReviewer') {
        return l`Another reviewer must give the second approval.`
      }
      return err.message
    }
    return l`Could not save the review.`
  }

  const onSubmit = () => {
    review.mutate(
      {did, decision, reasonCode: reason, note: note.trim()},
      {
        onSuccess: record =>
          control.close(() =>
            Toast.show(
              record.pendingSecondApproval
                ? l`Approval saved. A second reviewer must approve too.`
                : l`Review saved`,
              {type: 'success'},
            ),
          ),
      },
    )
  }

  return (
    <Dialog.ScrollableInner
      label={l`Review identity verification`}
      style={web({maxWidth: 480})}>
      <View style={[a.gap_lg]}>
        <View style={[a.gap_xs]}>
          <Text style={[a.text_xl, a.font_semi_bold]}>
            <Trans>Review identity verification</Trans>
          </Text>
          <AccountName did={did} />
        </View>

        <Toggle.Group
          type="radio"
          label={l`Decision`}
          values={[decision]}
          onChange={v =>
            setDecision((v[0] as 'approve' | 'reject') ?? decision)
          }>
          <View style={[a.flex_row, a.gap_lg]}>
            <Toggle.Item name="approve" label={l`Approve`}>
              <Toggle.Radio />
              <Toggle.LabelText>
                <Trans>Approve</Trans>
              </Toggle.LabelText>
            </Toggle.Item>
            <Toggle.Item name="reject" label={l`Reject`}>
              <Toggle.Radio />
              <Toggle.LabelText>
                <Trans>Reject</Trans>
              </Toggle.LabelText>
            </Toggle.Item>
          </View>
        </Toggle.Group>

        <View style={[a.gap_sm]}>
          <Text
            style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>
            <Trans>Reason</Trans>
          </Text>
          <Toggle.Group
            type="radio"
            label={l`Reason`}
            values={[reason]}
            onChange={v => setReason((v[0] as ReasonCode) ?? reason)}>
            <View style={[a.gap_sm]}>
              {reasons.map(([value, label]) => (
                <Toggle.Item key={value} name={value} label={label}>
                  <Toggle.Radio />
                  <Toggle.LabelText>{label}</Toggle.LabelText>
                </Toggle.Item>
              ))}
            </View>
          </Toggle.Group>
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Note (at least 10 characters)</Trans>
          </TextField.LabelText>
          <TextField.Root>
            <TextField.Input
              label={l`What you checked and why`}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
            />
          </TextField.Root>
        </View>

        {review.error ? (
          <Admonition.Admonition type="error">
            {errorText(review.error)}
          </Admonition.Admonition>
        ) : null}

        <Button
          label={l`Save review`}
          color={decision === 'approve' ? 'primary' : 'negative'}
          size="large"
          disabled={review.isPending || note.trim().length < 10}
          onPress={onSubmit}>
          <ButtonText>
            {decision === 'approve' ? (
              <Trans>Approve identity</Trans>
            ) : (
              <Trans>Reject identity</Trans>
            )}
          </ButtonText>
        </Button>
      </View>
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}
