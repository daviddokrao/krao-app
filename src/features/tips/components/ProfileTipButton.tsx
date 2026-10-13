import {useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {Button, ButtonIcon} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {Gift1_Stroke2_Corner0_Rounded as GiftIcon} from '#/components/icons/Gift1'
import {useTipRecipientWallet} from '../queries'
import {TipDialog} from './TipDialog'

/**
 * Tip button in the profile header. Only shown once the account has a
 * verified wallet, since there is nowhere to send the tip otherwise.
 */
export function ProfileTipButton({did, handle}: {did: string; handle: string}) {
  const {t: l} = useLingui()
  const haptics = useHaptics()
  const control = useDialogControl()
  const {data: recipientWallet} = useTipRecipientWallet(did)
  if (!recipientWallet) return null

  return (
    <>
      <Button
        testID="profileHeaderTipButton"
        size="small"
        color="secondary"
        shape="round"
        // same touch target expansion as the other round header buttons
        hitSlop={{top: 6, bottom: 6, left: 2, right: 2}}
        label={l`Send a tip to @${handle}`}
        onPress={() => {
          haptics.tap()
          control.open()
        }}>
        <ButtonIcon icon={GiftIcon} />
      </Button>
      <TipDialog control={control} target={{did, handle}} />
    </>
  )
}
