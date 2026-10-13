import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {useSession} from '#/state/session'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {ChainLink_Stroke2_Corner0_Rounded as ChainLinkIcon} from '#/components/icons/ChainLink'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {IS_WEB, KRAO_DEV_WALLET} from '#/env'
import {type LinkedWallet} from '#/features/wallet/api'
import {NftAvatarSection} from '#/features/wallet/components/NftAvatarSection'
import {
  WalletRejectedError,
  WalletUnavailableError,
} from '#/features/wallet/evm'
import {
  useChainProfileQuery,
  useLinkWalletMutation,
  useUnlinkWalletMutation,
} from '#/features/wallet/queries'
import {shortAddress} from '#/features/wallet/siwe'

const CHAIN_NAMES: Record<string, string> = {
  'eip155:1': 'Ethereum',
  'eip155:8453': 'Base',
  'eip155:10': 'Optimism',
  'eip155:42161': 'Arbitrum',
  'eip155:137': 'Polygon',
  'eip155:56': 'BNB Chain',
}

function chainName(accountId: string): string {
  const chain = accountId.split(':').slice(0, 2).join(':')
  return CHAIN_NAMES[chain] ?? chain
}

type Props = NativeStackScreenProps<CommonNavigatorParams, 'WalletsSettings'>
export function WalletsSettingsScreen({}: Props) {
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  const {data, isLoading, isError} = useChainProfileQuery(currentAccount?.did)
  const link = useLinkWalletMutation()
  const canConnect = IS_WEB || KRAO_DEV_WALLET

  const linkError = !link.error
    ? null
    : link.error instanceof WalletUnavailableError
      ? l`No Ethereum wallet was found in this browser. Install a wallet extension such as MetaMask, then try again.`
      : link.error instanceof WalletRejectedError
        ? l`The request was cancelled in your wallet.`
        : link.error.message

  return (
    <Layout.Screen testID="walletsSettingsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Wallets</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          <SettingsList.Item>
            <Text style={[a.text_md, a.leading_snug]}>
              <Trans>
                Link a wallet to show it on your profile and to sign in with it.
                Your wallet signs a message that names your account, so anyone
                can verify the link. Krao never asks for your keys or moves your
                funds.
              </Trans>
            </Text>
          </SettingsList.Item>

          {isLoading ? (
            <SettingsList.Item>
              <Loader />
            </SettingsList.Item>
          ) : isError ? (
            <SettingsList.Item>
              <Admonition.Admonition type="error">
                <Trans>Could not load your linked wallets.</Trans>
              </Admonition.Admonition>
            </SettingsList.Item>
          ) : data?.wallets.length ? (
            data.wallets.map(wallet => (
              <WalletRow key={wallet.uri} wallet={wallet} />
            ))
          ) : (
            <SettingsList.Item>
              <Text style={[a.text_md, a.italic]}>
                <Trans>No wallets linked yet.</Trans>
              </Text>
            </SettingsList.Item>
          )}

          <SettingsList.Divider />
          <SettingsList.Item style={[a.flex_col, a.align_stretch]}>
            {canConnect ? (
              <Button
                testID="linkWalletButton"
                label={l`Link a wallet`}
                accessibilityHint={l`Connects a wallet and asks it to sign a link message`}
                color="primary"
                size="large"
                disabled={link.isPending}
                onPress={() => {
                  link.reset()
                  link.mutate(
                    {},
                    {
                      onSuccess: () =>
                        Toast.show(l`Wallet linked`, {type: 'success'}),
                    },
                  )
                }}>
                <ButtonIcon icon={link.isPending ? Loader : ChainLinkIcon} />
                <ButtonText>
                  <Trans>Link a wallet</Trans>
                </ButtonText>
              </Button>
            ) : (
              <Admonition.Admonition type="info">
                <Trans>
                  Linking wallets in the mobile app is coming soon. For now,
                  link your wallet from Krao on the web.
                </Trans>
              </Admonition.Admonition>
            )}
            {linkError && (
              <Admonition.Admonition type="error" style={[a.mt_md]}>
                {linkError}
              </Admonition.Admonition>
            )}
            {KRAO_DEV_WALLET && (
              <Text style={[a.text_sm, a.mt_sm, a.italic]}>
                <Trans>Development test wallet enabled.</Trans>
              </Text>
            )}
          </SettingsList.Item>
          {data && data.wallets.some(w => w.status === 'verified') && (
            <>
              <SettingsList.Divider />
              <SettingsList.Item style={[a.flex_col, a.align_stretch]}>
                <NftAvatarSection profile={data} />
              </SettingsList.Item>
            </>
          )}
        </SettingsList.Container>
      </Layout.Content>
    </Layout.Screen>
  )
}

function WalletRow({wallet}: {wallet: LinkedWallet}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const unlink = useUnlinkWalletMutation()
  const confirmControl = Prompt.usePromptControl()
  const [address] = useState(() => shortAddress(wallet.account))
  const verified = wallet.status === 'verified'

  return (
    <SettingsList.Item>
      <SettingsList.ItemIcon icon={ChainLinkIcon} />
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text style={[a.text_md, a.font_semi_bold]} numberOfLines={1}>
          {wallet.label ? `${wallet.label} · ${address}` : address}
        </Text>
        <Text
          style={[
            a.text_sm,
            verified
              ? {color: t.palette.positive_600}
              : {color: t.palette.negative_500},
          ]}>
          {chainName(wallet.account)} ·{' '}
          {verified ? l`Verified` : l`Invalid signature`}
        </Text>
      </View>
      <SettingsList.BadgeButton
        label={l`Unlink`}
        onPress={() => confirmControl.open()}
      />
      <Prompt.Basic
        control={confirmControl}
        title={l`Unlink this wallet?`}
        description={l`You will no longer be able to sign in with it, and it will be removed from your profile.`}
        confirmButtonCta={l`Unlink`}
        confirmButtonColor="negative"
        onConfirm={() =>
          unlink.mutate(
            {uri: wallet.uri},
            {
              onSuccess: () => Toast.show(l`Wallet unlinked`),
              onError: () =>
                Toast.show(l`Could not unlink the wallet`, {type: 'error'}),
            },
          )
        }
      />
    </SettingsList.Item>
  )
}
