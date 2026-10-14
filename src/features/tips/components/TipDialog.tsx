import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {Loader} from '#/components/Loader'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {IS_WEB, KRAO_DEV_WALLET} from '#/env'
import {
  WalletRejectedError,
  WalletUnavailableError,
} from '#/features/wallet/evm'
import {shortAddress} from '#/features/wallet/siwe'
import {formatUnits, parseUnits, TIP_ASSETS, type TipAsset} from '../assets'
import {
  TipNotRecordedError,
  UnlinkedTipWalletError,
  useSendTipMutation,
  useTipRecipientWallet,
} from '../queries'

export type TipTarget = {
  did: string
  handle: string
  /** The post being tipped, if any */
  subject?: {uri: string; cid: string}
}

export function TipDialog({
  control,
  target,
}: {
  control: Dialog.DialogControlProps
  target: TipTarget
}) {
  const {t: l} = useLingui()
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={l`Send a tip`}
        style={web({maxWidth: 420})}>
        <TipDialogInner control={control} target={target} />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function TipDialogInner({
  control,
  target,
}: {
  control: Dialog.DialogControlProps
  target: TipTarget
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const recipientWallet = useTipRecipientWallet(target.did)
  const sendTip = useSendTipMutation()
  const [asset, setAsset] = useState<TipAsset>(TIP_ASSETS[0])
  const [amountText, setAmountText] = useState(TIP_ASSETS[0].presets[1])
  const [message, setMessage] = useState('')
  const amount = parseUnits(amountText, asset.decimals)
  const canConnect = IS_WEB || KRAO_DEV_WALLET

  const errorMessage = !sendTip.error
    ? null
    : sendTip.error instanceof WalletUnavailableError
      ? l`No Ethereum wallet was found in this browser.`
      : sendTip.error instanceof WalletRejectedError
        ? l`The request was cancelled in your wallet.`
        : sendTip.error instanceof TipNotRecordedError
          ? l`Your tip was sent, but it could not be saved to your account yet. It will be saved the next time you send a tip.`
          : sendTip.error instanceof UnlinkedTipWalletError
            ? l`Link this wallet to your account in Settings → Wallets before tipping with it.`
            : sendTip.error.message

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
      },
      {
        onSuccess: () => {
          control.close(() => {
            Toast.show(
              l`Tip sent: ${formatUnits(amount, asset.decimals)} ${asset.symbol}`,
              {type: 'success'},
            )
          })
        },
      },
    )
  }

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

      {recipientWallet.isLoading ? (
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

          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>To wallet {shortAddress(recipientWallet.data)}</Trans>
          </Text>

          {errorMessage && <Admonition type="error">{errorMessage}</Admonition>}

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
        </>
      )}
    </View>
  )
}
