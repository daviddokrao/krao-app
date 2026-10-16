import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as Toggle from '#/components/forms/Toggle'
import {Warning_Stroke2_Corner0_Rounded as WarningIcon} from '#/components/icons/Warning'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {AddressDisplay} from '#/features/safety/components/AddressDisplay'
import {formatUnits} from '#/features/tips/assets'
import {
  type ApprovalLine,
  type ChangeLine,
  describeApproval,
  describeChange,
  evaluatePreview,
  type InspectResult,
  type PreviewRequest,
  type PreviewWarning,
  shortAddress,
  sortWarnings,
  transactionParties,
} from '../preview'
import {useSimulationQuery} from '../queries'

/**
 * "Preview the transaction": what a transaction or a signature will do,
 * from Krao's simulation, before the wallet is asked. It never signs
 * anything itself; it only answers `onDecision(true)` once the user has
 * accepted what it showed. Danger warnings frame it in red, make Cancel the
 * main button and need "I understand the risk" before signing is possible.
 */
export function TxPreviewPanel({
  request,
  onDecision,
}: {
  request: PreviewRequest
  onDecision: (approved: boolean) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const query = useSimulationQuery(request)
  const [ack, setAck] = useState(false)

  const result = query.data
  const verdict = query.isLoading
    ? undefined
    : evaluatePreview(
        result
          ? {
              ok: 'ok' in result ? result.ok : true,
              warnings: result.warnings,
              method: 'method' in result ? result.method : undefined,
              revertReason:
                'revertReason' in result ? result.revertReason : undefined,
            }
          : undefined,
      )
  const warnings = result ? sortWarnings(result.warnings) : []
  const approvals = (result?.approvals ?? []).map(describeApproval)
  const changes =
    result && 'changes' in result ? result.changes.map(describeChange) : []
  const reverted = result && 'ok' in result && !result.ok
  const revertReason = result && 'revertReason' in result && result.revertReason
  const danger = !!verdict?.danger
  const canContinue = !!verdict?.canSign && (!verdict.needsAck || ack)

  const title =
    request.kind === 'signature'
      ? l`Review what you sign`
      : l`Preview the transaction`

  return (
    <View
      testID="txPreviewPanel"
      style={[
        a.gap_lg,
        danger && [
          a.p_md,
          a.rounded_md,
          a.border,
          {borderColor: t.palette.negative_500, borderWidth: 2},
        ],
      ]}>
      <View style={[a.gap_xs]}>
        <View style={[a.flex_row, a.align_center, a.gap_sm]}>
          {danger && <WarningIcon fill={t.palette.negative_500} size="lg" />}
          <Text style={[a.flex_1, a.text_2xl, a.font_bold, a.leading_tight]}>
            {title}
          </Text>
        </View>
        {request.origin && (
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>
              Requested by the Mini App at{' '}
              <Text style={[a.text_sm, a.font_bold]}>{request.origin}</Text>
            </Trans>
          </Text>
        )}
      </View>

      <RequestDetails request={request} />

      {query.isLoading ? (
        <View style={[a.flex_row, a.align_center, a.gap_sm]}>
          <Loader />
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>Checking what this will do…</Trans>
          </Text>
        </View>
      ) : (
        <>
          {verdict?.unavailable && (
            <Admonition type="warning">
              <Trans>
                Krao could not simulate this. Check the details above very
                carefully before you continue.
              </Trans>
            </Admonition>
          )}
          {verdict?.decodeOnly && (
            <Admonition type="info">
              <Trans>
                Only decoded, not fully simulated. The result may be incomplete.
              </Trans>
            </Admonition>
          )}
          {request.kind === 'signature' && result && 'kind' in result && (
            <SignatureSummary result={result} />
          )}
          {reverted && !verdict?.canSign && (
            <Admonition type="error">
              {revertReason ? (
                <Trans>
                  This transaction would fail: {String(revertReason)}. It was
                  not sent.
                </Trans>
              ) : (
                <Trans>This transaction would fail, so it can’t be sent.</Trans>
              )}
            </Admonition>
          )}
          <ChangeList
            direction="out"
            changes={changes.filter(c => c.direction === 'out')}
          />
          <ChangeList
            direction="in"
            changes={changes.filter(c => c.direction === 'in')}
          />
          {approvals.length > 0 && <ApprovalList approvals={approvals} />}
          {warnings.length > 0 && <WarningList warnings={warnings} />}
        </>
      )}

      {verdict?.needsAck && (
        <Toggle.Item
          name="tx_preview_ack"
          label={l`I understand the risk`}
          value={ack}
          onChange={setAck}
          style={[a.w_full]}>
          <Toggle.Checkbox />
          <Toggle.LabelText style={[a.flex_1]}>
            <Trans>I understand the risk</Trans>
          </Toggle.LabelText>
        </Toggle.Item>
      )}

      <View style={[a.gap_sm]}>
        <Button
          testID="txPreviewCancelButton"
          label={l`Cancel`}
          color={danger ? 'primary' : 'secondary'}
          size="large"
          onPress={() => onDecision(false)}>
          <ButtonText>
            <Trans>Cancel</Trans>
          </ButtonText>
        </Button>
        <Button
          testID="txPreviewContinueButton"
          label={
            request.kind === 'signature'
              ? l`Continue to sign in your wallet`
              : l`Continue in your wallet`
          }
          accessibilityHint={l`Opens your wallet to confirm`}
          color={danger ? 'negative_subtle' : 'primary'}
          size="large"
          disabled={query.isLoading || !canContinue}
          onPress={() => onDecision(true)}>
          <ButtonText>
            {request.kind === 'signature' ? (
              <Trans>Continue to sign</Trans>
            ) : (
              <Trans>Continue</Trans>
            )}
          </ButtonText>
        </Button>
      </View>
    </View>
  )
}

/** What the wallet will be asked, whatever the simulation says */
function RequestDetails({request}: {request: PreviewRequest}) {
  const t = useTheme()
  if (request.kind === 'signature') {
    return (
      <View style={[a.gap_xs]}>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          {request.method === 'personal_sign' ? (
            <Trans>Message to sign</Trans>
          ) : (
            <Trans>Typed data to sign</Trans>
          )}
        </Text>
        <View
          style={[
            t.atoms.bg_contrast_25,
            a.px_md,
            a.py_sm,
            a.rounded_sm,
            a.border,
            t.atoms.border_contrast_medium,
          ]}>
          <Text
            testID="txPreviewPayload"
            selectable
            // In full: a cut-off message could hide what is really signed
            style={[a.text_sm, a.leading_snug]}>
            {request.payload}
          </Text>
        </View>
      </View>
    )
  }
  const value =
    request.value && /^[0-9]+$/.test(request.value)
      ? formatUnits(request.value, 18)
      : undefined
  // A token transfer is a call to the token: show who gets the tokens
  const parties = transactionParties(request)
  return (
    <View style={[a.gap_sm]}>
      <View style={[a.gap_xs]}>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>To</Trans>
        </Text>
        <View testID="txPreviewRecipient">
          <AddressDisplay
            address={parties.recipient}
            style={[a.text_md, a.font_semi_bold]}
          />
        </View>
      </View>
      {parties.tokenContract && (
        <View testID="txPreviewTokenContract" style={[a.gap_2xs]}>
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Trans>Token contract</Trans>
          </Text>
          <AddressDisplay address={parties.tokenContract} style={[a.text_xs]} />
        </View>
      )}
      {value && value !== '0' && (
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>
            Sends <Text style={[a.text_sm, a.font_bold]}>{value} ETH</Text> with
            it
          </Trans>
        </Text>
      )}
      {!!request.data && !parties.tokenContract && (
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>It also calls a contract.</Trans>
        </Text>
      )}
    </View>
  )
}

function SignatureSummary({result}: {result: InspectResult}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const kinds: Record<InspectResult['kind'], string> = {
    message: l`A plain message`,
    permit: l`A permit that lets someone spend your tokens`,
    permit2: l`A Permit2 approval that lets someone spend your tokens`,
    order: l`A marketplace order that can move your NFTs or tokens`,
    eip7702Authorization: l`An authorization that hands your account to a contract`,
    loginProof: l`A login proof`,
    typedData: l`Structured data`,
  }
  return (
    <View style={[a.gap_xs]}>
      <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
        <Trans>This signature is</Trans>
      </Text>
      <Text style={[a.text_md, a.font_bold]}>
        {kinds[result.kind] ?? kinds.typedData}
      </Text>
      {!!result.summary && (
        <Text style={[a.text_sm, t.atoms.text_contrast_high]}>
          {result.summary}
        </Text>
      )}
    </View>
  )
}

function ChangeList({
  direction,
  changes,
}: {
  direction: 'out' | 'in'
  changes: ChangeLine[]
}) {
  const t = useTheme()
  if (changes.length === 0) return null
  return (
    <View style={[a.gap_xs]} testID={`txPreviewChanges-${direction}`}>
      <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
        {direction === 'out' ? (
          <Trans>You will lose</Trans>
        ) : (
          <Trans>You will receive</Trans>
        )}
      </Text>
      {changes.map((c, i) => (
        <View key={i} style={[a.gap_2xs]}>
          <Text
            style={[
              a.text_lg,
              a.font_bold,
              {
                color:
                  direction === 'out'
                    ? t.palette.negative_500
                    : t.palette.positive_600,
              },
            ]}>
            {direction === 'out' ? '- ' : '+ '}
            {c.amount ?? c.raw ?? ''} {c.asset}
          </Text>
          {c.counterparty && (
            <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
              {direction === 'out' ? (
                <Trans>to {shortAddress(c.counterparty)}</Trans>
              ) : (
                <Trans>from {shortAddress(c.counterparty)}</Trans>
              )}
            </Text>
          )}
        </View>
      ))}
    </View>
  )
}

function ApprovalList({approvals}: {approvals: ApprovalLine[]}) {
  const t = useTheme()
  return (
    <View style={[a.gap_sm]} testID="txPreviewApprovals">
      <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
        <Trans>Permissions it gives</Trans>
      </Text>
      {approvals.map((ap, i) => (
        <View key={i} style={[a.gap_2xs]}>
          <Text style={[a.text_md, a.font_bold]}>
            {ap.kind === 'approvalForAll' ? (
              <Trans>All of your {ap.asset}</Trans>
            ) : ap.unlimited ? (
              <Trans>Unlimited {ap.asset}</Trans>
            ) : (
              <Trans>
                Up to {ap.amount ?? '?'} {ap.asset}
              </Trans>
            )}
          </Text>
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Trans>can be spent by</Trans>
          </Text>
          <AddressDisplay address={ap.spender} />
        </View>
      ))}
    </View>
  )
}

function useWarningText() {
  const {t: l} = useLingui()
  const texts: Record<string, string> = {
    reverts: l`This transaction would fail.`,
    unlimitedApproval: l`It lets someone spend an unlimited amount of your tokens.`,
    approvalForAll: l`It lets someone move all of your NFTs from a collection.`,
    eip7702Delegation: l`It hands control of your account to a contract.`,
    unknownContract: l`The contract is not one Krao knows.`,
    lookalikeAddress: l`The address looks like a wallet verified by someone else. It may be a fake.`,
    unsafeOrigin: l`The site that asked is on Krao’s scam list.`,
    simulationUnavailable: l`Krao could not simulate this.`,
    marketplaceOrder: l`It is a marketplace order that can sell your NFTs or tokens for almost nothing.`,
    blindSignature: l`It is a block of data you can’t read. Only sign it if you trust the site.`,
    walletProofPhishing: l`This looks like Krao’s wallet proof, asked for by another site. Do not sign it.`,
    chainMismatch: l`It names a different network than the one you are on.`,
  }
  return (w: PreviewWarning) => texts[w.code] ?? w.message ?? w.code
}

function WarningList({warnings}: {warnings: PreviewWarning[]}) {
  const t = useTheme()
  const textOf = useWarningText()
  return (
    <View style={[a.gap_sm]} testID="txPreviewWarnings">
      {warnings.map((w, i) => (
        <View key={i} style={[a.flex_row, a.gap_sm, a.align_start]}>
          <WarningIcon
            size="md"
            fill={
              w.severity === 'danger'
                ? t.palette.negative_500
                : w.severity === 'warning'
                  ? t.palette.yellow
                  : t.atoms.text_contrast_medium.color
            }
          />
          <Text
            style={[
              a.flex_1,
              a.text_sm,
              a.leading_snug,
              w.severity === 'danger' && [
                a.font_bold,
                {color: t.palette.negative_500},
              ],
            ]}>
            {textOf(w)}
          </Text>
        </View>
      ))}
    </View>
  )
}
