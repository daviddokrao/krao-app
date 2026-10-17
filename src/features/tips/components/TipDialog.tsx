import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {useSession} from '#/state/session'
import {atoms as a, useTheme, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {Loader} from '#/components/Loader'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {TransactionDeclinedError} from '#/features/miniapp/errors'
import {useTxApproval} from '#/features/miniapp/txApproval'
import {AddressDisplay} from '#/features/safety/components/AddressDisplay'
import {useExpectedAddressQuery} from '#/features/safety/queries'
import {
  WalletRejectedError,
  WalletUnavailableError,
} from '#/features/wallet/evm'
import {CAN_CONNECT_WALLET} from '#/features/wallet/mode'
import {useChainProfileQuery} from '#/features/wallet/queries'
import {formatUnits, parseUnits, TIP_ASSETS, type TipAsset} from '../assets'
import {
  TipNotRecordedError,
  UnlinkedTipWalletError,
  useSavePendingTipsMutation,
  useSendTipMutation,
  useTipRecipientWallet,
} from '../queries'

export type TipTarget = {
  did: string
  handle: string
  /** The post being tipped, if any */
  subject?: {uri: string; cid: string}
}

export type TipSent = {
  /** Base units of the asset */
  amount: bigint
  asset: TipAsset
  anonymous: boolean
}

export function TipDialog({
  control,
  target,
  allowAnonymous = true,
  onSent,
}: {
  control: Dialog.DialogControlProps
  target: TipTarget
  /** Offer "Tip anonymously"; off in a chat, where the tipper is known */
  allowAnonymous?: boolean
  /** Called once the dialog has closed after a tip was sent */
  onSent?: (tip: TipSent) => void
}) {
  const {t: l} = useLingui()
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={l`Send a tip`}
        style={web({maxWidth: 420})}>
        <TipDialogInner
          control={control}
          target={target}
          allowAnonymous={allowAnonymous}
          onSent={onSent}
        />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function TipDialogInner({
  control,
  target,
  allowAnonymous,
  onSent,
}: {
  control: Dialog.DialogControlProps
  target: TipTarget
  allowAnonymous: boolean
  onSent?: (tip: TipSent) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const {currentAccount} = useSession()
  const recipientWallet = useTipRecipientWallet(target.did)
  const {
    data: myChainProfile,
    isLoading: isMyProfileLoading,
    isError: isMyProfileError,
  } = useChainProfileQuery(currentAccount?.did)
  // Tips go out from one of the tipper's own linked wallets (the indexer
  // credits nothing else), so say so before the form is filled in
  const hasOwnWallet = !!myChainProfile?.wallets.some(
    w => w.status === 'verified' && w.account.startsWith('eip155:'),
  )
  // Krao: is the address the recipient's own, and does another one look like it
  const recipientAddress = recipientWallet.data?.split(':').pop()
  const addressCheck = useExpectedAddressQuery(recipientAddress, target.did)
  const addressSuspect =
    !!addressCheck.data &&
    (addressCheck.data.matchesExpected === false ||
      addressCheck.data.lookalikes.length > 0)
  const sendTip = useSendTipMutation()
  const approval = useTxApproval()
  const savePending = useSavePendingTipsMutation()
  const [asset, setAsset] = useState<TipAsset>(TIP_ASSETS[0])
  const [amountText, setAmountText] = useState(TIP_ASSETS[0].presets[1])
  const [message, setMessage] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const amount = parseUnits(amountText, asset.decimals)
  const canConnect = CAN_CONNECT_WALLET

  const errorMessage = !sendTip.error
    ? null
    : sendTip.error instanceof TransactionDeclinedError
      ? null
      : sendTip.error instanceof WalletUnavailableError
        ? IS_WEB
          ? l`No Ethereum wallet was found in this browser.`
          : l`No wallet app was found on this phone.`
        : sendTip.error instanceof WalletRejectedError
          ? l`The request was cancelled in your wallet.`
          : sendTip.error instanceof TipNotRecordedError
            ? l`Your tip was sent, but it could not be saved to your account yet. It will be saved the next time you send a tip.`
            : sendTip.error instanceof UnlinkedTipWalletError
              ? l`Link this wallet to your account in Settings → Wallets before tipping with it.`
              : l`Something went wrong sending the tip. Please try again.`

  const onSend = () => {
    if (!amount || !recipientWallet.data) return
    sendTip.mutate(
      {
        recipientDid: target.did,
        recipientAddress: recipientWallet.data,
        subject: target.subject,
        asset,
        amount,
        message: message.trim(),
        anonymous: allowAnonymous && anonymous,
        approve: approval.approve,
      },
      {
        onSuccess: () => {
          control.close(() => {
            Toast.show(
              l`Tip sent: ${formatUnits(amount, asset.decimals)} ${asset.symbol}`,
              {type: 'success'},
            )
            onSent?.({amount, asset, anonymous: allowAnonymous && anonymous})
          })
        },
      },
    )
  }

  // Krao: the preview of the transaction replaces the form while it waits
  if (approval.panel) return approval.panel

  return (
    <View style={[a.gap_lg]}>
      <View style={[a.gap_xs]}>
        <Text style={[a.text_2xl, a.font_bold]}>
          <Trans>Tip @{target.handle}</Trans>
        </Text>
        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
          <Trans>
            Sent on Base straight from your wallet to theirs. Krao never holds
            your funds.
          </Trans>
        </Text>
      </View>

      {recipientWallet.isLoading || isMyProfileLoading ? (
        <Loader />
      ) : !recipientWallet.data ? (
        <Admonition type="info">
          <Trans>
            @{target.handle} hasn’t linked a wallet yet, so they can’t receive
            tips.
          </Trans>
        </Admonition>
      ) : !canConnect ? (
        <Admonition type="info">
          <Trans>
            Sending tips from the mobile app is coming soon. Use Krao on the web
            for now.
          </Trans>
        </Admonition>
      ) : isMyProfileError ? (
        <Admonition type="error">
          <Trans>Couldn’t load your wallets. Please try again later.</Trans>
        </Admonition>
      ) : !hasOwnWallet ? (
        <View style={[a.gap_md]}>
          <Admonition type="info">
            <Trans>
              To send tips, first link the wallet you will pay from to your
              account.
            </Trans>
          </Admonition>
          <Button
            label={l`Link a wallet`}
            color="primary"
            size="large"
            onPress={() =>
              control.close(() => {
                navigation.navigate('WalletsSettings')
              })
            }>
            <ButtonText>
              <Trans>Link a wallet</Trans>
            </ButtonText>
          </Button>
        </View>
      ) : (
        <>
          <View style={[a.flex_row, a.gap_sm]}>
            {TIP_ASSETS.map(option => (
              <Button
                key={option.id}
                label={
                  option.id === asset.id
                    ? l`${option.symbol}, selected`
                    : option.symbol
                }
                color={option.id === asset.id ? 'primary' : 'secondary'}
                size="small"
                onPress={() => {
                  setAsset(option)
                  setAmountText(option.presets[1])
                }}>
                <ButtonText>{option.symbol}</ButtonText>
              </Button>
            ))}
          </View>

          <View style={[a.gap_sm]}>
            <View style={[a.flex_row, a.gap_sm, a.flex_wrap]}>
              {asset.presets.map(preset => (
                <Button
                  key={preset}
                  label={
                    preset === amountText
                      ? l`${preset} ${asset.symbol}, selected`
                      : `${preset} ${asset.symbol}`
                  }
                  color={preset === amountText ? 'primary_subtle' : 'secondary'}
                  size="small"
                  onPress={() => setAmountText(preset)}>
                  <ButtonText>
                    {preset} {asset.symbol}
                  </ButtonText>
                </Button>
              ))}
            </View>
            <TextField.LabelText>
              <Trans>Amount ({asset.symbol})</Trans>
            </TextField.LabelText>
            <TextField.Root isInvalid={!amount}>
              <TextField.Input
                label={l`Amount`}
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
              />
            </TextField.Root>
          </View>

          <View style={[a.gap_sm]}>
            <TextField.LabelText>
              <Trans>Message (optional)</Trans>
            </TextField.LabelText>
            <TextField.Root>
              <TextField.Input
                label={l`Message`}
                value={message}
                onChangeText={setMessage}
                maxLength={300}
              />
            </TextField.Root>
          </View>

          {allowAnonymous && (
            <View style={[a.gap_xs]}>
              <Toggle.Item
                name="tip_anonymously"
                label={l`Tip anonymously`}
                value={anonymous}
                onChange={setAnonymous}
                style={[a.w_full]}>
                <Toggle.LabelText style={[a.flex_1]}>
                  <Trans>Tip anonymously</Trans>
                </Toggle.LabelText>
                <Toggle.Platform />
              </Toggle.Item>
              <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
                <Trans>
                  Your name is hidden from their top supporters. The transfer
                  itself is still public on the blockchain.
                </Trans>
              </Text>
            </View>
          )}

          <View style={[a.gap_xs]}>
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              <Trans>To wallet</Trans>
            </Text>
            <AddressDisplay
              address={recipientAddress ?? recipientWallet.data}
            />
            <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
              <Trans>
                Check the first 6 and last 4 characters (in color) against your
                own records.
              </Trans>
            </Text>
          </View>
          {addressSuspect && (
            <Admonition type="warning">
              <Trans>
                This address does not match the wallet Krao has verified for @
                {target.handle}, or another verified wallet looks very similar
                to it. Do not send a tip unless you are sure.
              </Trans>
            </Admonition>
          )}

          {errorMessage && <Admonition type="error">{errorMessage}</Admonition>}
          {savePending.error && (
            <Admonition type="error">
              <Trans>The tip could not be saved yet. Please try again.</Trans>
            </Admonition>
          )}

          {sendTip.error instanceof TipNotRecordedError ? (
            // The money already moved: only the record is left to save
            <Button
              testID="saveTipButton"
              label={l`Try saving the tip again`}
              color="primary"
              size="large"
              disabled={savePending.isPending}
              onPress={() =>
                savePending.mutate(undefined, {
                  onSuccess: () =>
                    control.close(() => {
                      Toast.show(l`Tip saved`, {type: 'success'})
                    }),
                })
              }>
              {savePending.isPending && <ButtonIcon icon={Loader} />}
              <ButtonText>
                <Trans>Try saving the tip again</Trans>
              </ButtonText>
            </Button>
          ) : (
            <Button
              testID="sendTipButton"
              label={l`Send tip`}
              color="primary"
              size="large"
              disabled={!amount || sendTip.isPending}
              onPress={onSend}>
              {sendTip.isPending && <ButtonIcon icon={Loader} />}
              <ButtonText>
                {amount ? (
                  <Trans>
                    Send {formatUnits(amount, asset.decimals)} {asset.symbol}
                  </Trans>
                ) : (
                  <Trans>Enter an amount</Trans>
                )}
              </ButtonText>
            </Button>
          )}
        </>
      )}
    </View>
  )
}
