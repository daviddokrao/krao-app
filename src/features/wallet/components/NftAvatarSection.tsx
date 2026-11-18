import {useState} from 'react'
import {View} from 'react-native'
import {Image} from 'expo-image'
import {Trans, useLingui} from '@lingui/react/macro'
import {useMutation} from '@tanstack/react-query'

import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as TextField from '#/components/forms/TextField'
import {Loader} from '#/components/Loader'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {
  type ChainProfile,
  nftImageUrl,
  type ResolvedNft,
  resolveNft,
  XrpcError,
} from '../api'
import {useRemoveNftAvatarMutation, useSetNftAvatarMutation} from '../nftAvatar'

const NFT_CHAIN = 'eip155:8453'

export function NftAvatarSection({profile}: {profile: ChainProfile}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [contract, setContract] = useState('')
  const [tokenId, setTokenId] = useState('')
  const lookup = useMutation({
    mutationFn: () =>
      resolveNft({
        chain: NFT_CHAIN,
        contract: contract.trim(),
        tokenId: tokenId.trim(),
      }),
  })
  const setAvatar = useSetNftAvatarMutation()
  const removeAvatar = useRemoveNftAvatarMutation()

  const verifiedAddresses = profile.wallets
    .filter(w => w.status === 'verified' && w.account.startsWith('eip155:'))
    .map(w => w.account.split(':')[2].toLowerCase())
  const owningWallet = (nft: ResolvedNft) =>
    nft.owner && verifiedAddresses.includes(nft.owner.toLowerCase())
      ? `${NFT_CHAIN}:${nft.owner}`
      : undefined

  const current = profile.nftAvatar
  const lookupError = !lookup.error
    ? null
    : lookup.error instanceof XrpcError && lookup.error.error === 'NotFound'
      ? l`No NFT with that token ID exists in this contract on Base.`
      : l`Could not look up this NFT. Check the contract address and token ID.`

  return (
    <View style={[a.gap_md]}>
      <Text style={[a.text_lg, a.font_bold]}>
        <Trans>NFT profile picture</Trans>
      </Text>

      {current && (
        <View
          style={[
            a.flex_row,
            a.align_center,
            a.gap_md,
            a.p_md,
            a.rounded_md,
            t.atoms.bg_contrast_25,
          ]}>
          <Image
            source={{uri: nftImageUrl(current.nft)}}
            style={[{width: 56, height: 56}, a.rounded_full]}
            accessibilityLabel={l`Your NFT profile picture`}
            accessibilityHint=""
            accessibilityIgnoresInvertColors
          />
          <View style={[a.flex_1, a.gap_2xs]}>
            <Text style={[a.text_md, a.font_semi_bold]} numberOfLines={1}>
              {current.collectionName ?? l`NFT`}
            </Text>
            <Text
              style={[
                a.text_sm,
                {
                  color:
                    current.status === 'verified'
                      ? t.palette.positive_600
                      : t.palette.negative_500,
                },
              ]}>
              {current.status === 'verified'
                ? l`Verified – held by your linked wallet`
                : current.status === 'pending'
                  ? l`Checking ownership…`
                  : l`Not verified – your linked wallets don’t hold this NFT`}
            </Text>
          </View>
          <Button
            label={l`Remove NFT badge`}
            color="secondary"
            size="small"
            disabled={removeAvatar.isPending}
            onPress={() => removeAvatar.mutate()}>
            <ButtonText>
              <Trans>Remove</Trans>
            </ButtonText>
          </Button>
        </View>
      )}

      <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
        <Trans>
          Use an NFT held by one of your linked wallets on Base. Krao checks
          ownership on-chain and shows a badge while you hold it.
        </Trans>
      </Text>
      <View style={[a.gap_sm]}>
        <TextField.LabelText>
          <Trans>Contract address</Trans>
        </TextField.LabelText>
        <TextField.Root>
          <TextField.Input
            label={l`Contract address`}
            placeholder="0x…"
            value={contract}
            onChangeText={setContract}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </TextField.Root>
        <TextField.LabelText>
          <Trans>Token ID</Trans>
        </TextField.LabelText>
        <TextField.Root>
          <TextField.Input
            label={l`Token ID`}
            value={tokenId}
            onChangeText={setTokenId}
            keyboardType="number-pad"
          />
        </TextField.Root>
        <Button
          label={l`Look up NFT`}
          color="secondary"
          size="large"
          disabled={!contract.trim() || !tokenId.trim() || lookup.isPending}
          onPress={() => {
            setAvatar.reset()
            lookup.mutate()
          }}>
          {lookup.isPending && <ButtonIcon icon={Loader} />}
          <ButtonText>
            <Trans>Look up NFT</Trans>
          </ButtonText>
        </Button>
      </View>

      {lookupError && <Admonition type="error">{lookupError}</Admonition>}

      {lookup.data && (
        <View style={[a.gap_md, a.p_md, a.rounded_md, t.atoms.bg_contrast_25]}>
          <View style={[a.flex_row, a.gap_md, a.align_center]}>
            <Image
              source={{uri: nftImageUrl(lookup.data.nft)}}
              style={[{width: 72, height: 72}, a.rounded_md]}
              accessibilityLabel={l`Preview of the NFT`}
              accessibilityHint=""
              accessibilityIgnoresInvertColors
            />
            <View style={[a.flex_1, a.gap_2xs]}>
              <Text style={[a.text_md, a.font_semi_bold]} numberOfLines={1}>
                {lookup.data.name ?? l`Token ${lookup.data.nft.tokenId}`}
              </Text>
              {lookup.data.collectionName && (
                <Text
                  style={[a.text_sm, t.atoms.text_contrast_medium]}
                  numberOfLines={1}>
                  {lookup.data.collectionName}
                </Text>
              )}
            </View>
          </View>
          {owningWallet(lookup.data) ? (
            <Button
              testID="useNftAvatarButton"
              label={l`Use as profile picture`}
              color="primary"
              size="large"
              disabled={setAvatar.isPending}
              onPress={() =>
                setAvatar.mutate(
                  {
                    nft: lookup.data.nft,
                    wallet: owningWallet(lookup.data)!,
                  },
                  {
                    onSuccess: () =>
                      Toast.show(l`Profile picture updated`, {
                        type: 'success',
                      }),
                  },
                )
              }>
              {setAvatar.isPending && <ButtonIcon icon={Loader} />}
              <ButtonText>
                <Trans>Use as profile picture</Trans>
              </ButtonText>
            </Button>
          ) : (
            <Admonition type="warning">
              <Trans>
                This NFT isn’t held by any of your linked wallets, so it can’t
                be verified as yours.
              </Trans>
            </Admonition>
          )}
          {setAvatar.error && (
            <Admonition type="error">
              <Trans>
                Could not set this NFT as your profile picture. Please try
                again.
              </Trans>
            </Admonition>
          )}
        </View>
      )}
    </View>
  )
}
