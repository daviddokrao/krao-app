import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {ChainLink_Stroke2_Corner0_Rounded as ChainLinkIcon} from '#/components/icons/ChainLink'
import {Loader} from '#/components/Loader'
import {IS_WEB, KRAO_DEV_WALLET} from '#/env'
import {XrpcError} from '../api'
import {WalletRejectedError, WalletUnavailableError} from '../evm'
import {useWalletSignInMutation} from '../signIn'

/**
 * "Sign in with wallet" for the login form. Only shown where a wallet can be
 * reached: browsers with an injected wallet, or the dev wallet.
 */
export function WalletSignInButton({service}: {service: string}) {
  const {t: l} = useLingui()
  const {mutate, isPending, error, reset} = useWalletSignInMutation()

  if (!IS_WEB && !KRAO_DEV_WALLET) return null

  const errorMessage = !error
    ? null
    : error instanceof WalletUnavailableError
      ? l`No Ethereum wallet was found in this browser. Install a wallet extension such as MetaMask, then try again.`
      : error instanceof WalletRejectedError
        ? l`The request was cancelled in your wallet.`
        : error instanceof XrpcError && error.error === 'WalletNotLinked'
          ? l`This wallet is not linked to an account on this hosting provider. Sign in with your password and link it in Settings → Wallets first.`
          : error instanceof XrpcError && error.error === 'InvalidSignature'
            ? l`The wallet signature could not be verified.`
            : error.message

  return (
    <View style={[a.gap_md, a.pt_md]}>
      <Button
        testID="walletSignInButton"
        label={l`Sign in with wallet`}
        accessibilityHint={l`Signs in by signing a message with a wallet linked to your account`}
        color="secondary"
        size="large"
        disabled={isPending}
        onPress={() => {
          reset()
          mutate({service})
        }}>
        <ButtonIcon icon={isPending ? Loader : ChainLinkIcon} />
        <ButtonText>
          <Trans>Sign in with wallet</Trans>
        </ButtonText>
      </Button>
      {errorMessage && (
        <Admonition.Admonition type="error">
          {errorMessage}
        </Admonition.Admonition>
      )}
    </View>
  )
}
