import {useRef, useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as Toggle from '#/components/forms/Toggle'
import {Text} from '#/components/Typography'
import {AddressDisplay} from '#/features/safety/components/AddressDisplay'
import {type PreviewRequest} from '../preview'
import {TxPreviewPanel} from './TxPreviewPanel'

type HostView =
  | {type: 'wallet'; appName: string; addresses: string[]}
  | {type: 'preview'; request: PreviewRequest}

/**
 * The confirmations a running Mini App can ask for: which wallet to share,
 * and the preview before a signature or transaction. One dialog, one question
 * at a time (the bridge lets only one such request be open). Closing the
 * dialog any other way than its buttons answers "no".
 */
export function useHostDialog() {
  const {t: l} = useLingui()
  const control = Dialog.useDialogControl()
  const [view, setView] = useState<HostView>()
  const settle = useRef<(value: unknown) => void>(undefined)
  const decline = useRef<unknown>(undefined)

  const ask = <T,>(next: HostView, declined: T) =>
    new Promise<T>(resolve => {
      // A question still open is answered "no" before the next one opens
      settle.current?.(decline.current)
      settle.current = resolve as (value: unknown) => void
      decline.current = declined
      setView(next)
      control.open()
    })

  const answer = (value: unknown) => {
    const resolve = settle.current
    settle.current = undefined
    control.close(() => resolve?.(value))
  }

  const onClose = () => {
    const resolve = settle.current
    settle.current = undefined
    resolve?.(decline.current)
  }

  return {
    /** The address the user chose to share, or null */
    askWallet: (appName: string, addresses: string[]) =>
      ask<string | null>({type: 'wallet', appName, addresses}, null),
    /** Whether the user accepted the previewed transaction or signature */
    askApproval: (request: PreviewRequest) =>
      ask<boolean>({type: 'preview', request}, false),
    element: (
      <Dialog.Outer
        control={control}
        onClose={onClose}
        nativeOptions={{preventExpansion: true}}
        webOptions={{alignCenter: true}}>
        <Dialog.Handle />
        <Dialog.ScrollableInner
          label={
            view?.type === 'preview'
              ? view.request.kind === 'signature'
                ? l`Review what you sign`
                : l`Preview the transaction`
              : l`Share your wallet`
          }
          style={web({maxWidth: 450})}>
          {view?.type === 'wallet' && (
            <WalletChooser
              appName={view.appName}
              addresses={view.addresses}
              onAnswer={answer}
            />
          )}
          {view?.type === 'preview' && (
            <TxPreviewPanel request={view.request} onDecision={answer} />
          )}
          <Dialog.Close />
        </Dialog.ScrollableInner>
      </Dialog.Outer>
    ),
  }
}

function WalletChooser({
  appName,
  addresses,
  onAnswer,
}: {
  appName: string
  addresses: string[]
  onAnswer: (address: string | null) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [selected, setSelected] = useState(addresses[0])
  return (
    <View style={[a.gap_lg]} testID="miniAppWalletChooser">
      <View style={[a.gap_xs]}>
        <Text style={[a.text_2xl, a.font_bold]}>
          <Trans>Share your wallet</Trans>
        </Text>
        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
          <Trans>
            {appName} asked for the address of a wallet you linked. It can see
            the address, but it can’t move anything: every signature and payment
            still asks you first.
          </Trans>
        </Text>
      </View>
      <Toggle.Group
        label={l`Choose a wallet`}
        type="radio"
        values={selected ? [selected] : []}
        onChange={values => setSelected(values[0])}>
        <View style={[a.gap_sm]}>
          {addresses.map(address => (
            <Toggle.Item
              key={address}
              name={address}
              label={address}
              style={[a.w_full]}>
              <Toggle.Radio />
              <View style={[a.flex_1]}>
                <AddressDisplay address={address} />
              </View>
            </Toggle.Item>
          ))}
        </View>
      </Toggle.Group>
      <View style={[a.gap_sm]}>
        <Button
          testID="miniAppShareWalletButton"
          label={l`Share this wallet`}
          color="primary"
          size="large"
          disabled={!selected}
          onPress={() => onAnswer(selected ?? null)}>
          <ButtonText>
            <Trans>Share this wallet</Trans>
          </ButtonText>
        </Button>
        <Button
          testID="miniAppDenyWalletButton"
          label={l`Don’t share`}
          color="secondary"
          size="large"
          onPress={() => onAnswer(null)}>
          <ButtonText>
            <Trans>Don’t share</Trans>
          </ButtonText>
        </Button>
      </View>
    </View>
  )
}
