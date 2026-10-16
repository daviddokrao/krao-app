import {Pressable} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {HITSLOP_10} from '#/lib/constants'
import {useHaptics} from '#/lib/haptics'
import {atoms as a, useTheme} from '#/alf'
import {useDialogControl} from '#/components/Dialog'
import {GlassView} from '#/components/GlassView'
import {Gift1_Stroke2_Corner0_Rounded as GiftIcon} from '#/components/icons/Gift1'
import {CAN_CONNECT_WALLET} from '#/features/wallet/mode'
import {formatUnits} from '../assets'
import {useTipRecipientWallet} from '../queries'
import {TipDialog} from './TipDialog'

const SIZE = 40

/**
 * Tip button next to the message input of a 1:1 chat. Opens the tip dialog for
 * the other person and, once the tip is sent, says so in the chat via
 * `onSendMessage`. Only shown once they have a wallet to receive it.
 */
export function ChatTipButton({
  did,
  handle,
  onSendMessage,
}: {
  did: string
  handle: string
  onSendMessage: (text: string) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const haptics = useHaptics()
  const control = useDialogControl()
  const canSend = CAN_CONNECT_WALLET
  const {data: recipientWallet} = useTipRecipientWallet(canSend ? did : '')
  if (!canSend || !recipientWallet) return null

  return (
    <>
      <GlassView
        isInteractive
        glassEffectStyle="regular"
        style={[a.rounded_full]}
        tintColor={t.palette.contrast_50}
        fallbackStyle={[t.atoms.bg_contrast_50]}>
        <Pressable
          testID="chatTipButton"
          accessibilityRole="button"
          accessibilityLabel={l`Send a tip to @${handle}`}
          accessibilityHint=""
          hitSlop={HITSLOP_10}
          style={[
            a.rounded_full,
            a.align_center,
            a.justify_center,
            {height: SIZE, width: SIZE},
          ]}
          onPress={() => {
            haptics.tap()
            control.open()
          }}>
          <GiftIcon size="md" style={[t.atoms.text_contrast_high]} />
        </Pressable>
      </GlassView>
      <TipDialog
        control={control}
        target={{did, handle}}
        // The recipient sees who sent it in the chat anyway
        allowAnonymous={false}
        onSent={({amount, asset}) => {
          const value = formatUnits(amount, asset.decimals)
          onSendMessage(l`🎁 I sent you a tip of ${value} ${asset.symbol}`)
        }}
      />
    </>
  )
}
