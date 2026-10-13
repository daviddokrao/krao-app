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
import {parseUnits, TIP_ASSETS, type TipAsset} from '#/features/tips/assets'
import {type GateCondition, useCreateGateMutation} from '../queries'

type Kind = 'token' | 'nft'

/** Lets an author attach token-gated text to one of their posts */
export function GateDialog({
  control,
  post,
}: {
  control: Dialog.DialogControlProps
  post: {uri: string; cid: string}
}) {
  const {t: l} = useLingui()
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={l`Add token-gated content`}
        style={web({maxWidth: 480})}>
        <GateDialogInner control={control} post={post} />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function GateDialogInner({
  control,
  post,
}: {
  control: Dialog.DialogControlProps
  post: {uri: string; cid: string}
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const createGate = useCreateGateMutation()
  const [text, setText] = useState('')
  const [kind, setKind] = useState<Kind>('token')
  const [asset, setAsset] = useState<TipAsset>(TIP_ASSETS[1])
  const [minAmount, setMinAmount] = useState('10')
  const [contract, setContract] = useState('')
  const [tokenId, setTokenId] = useState('')

  const minUnits = parseUnits(minAmount, asset.decimals)
  const condition: GateCondition | null =
    kind === 'token'
      ? minUnits
        ? {
            $type: 'net.krao.gate.defs#tokenBalance',
            asset: asset.id,
            minAmount: minUnits.toString(),
          }
        : null
      : /^0x[0-9a-fA-F]{40}$/.test(contract.trim())
        ? {
            $type: 'net.krao.gate.defs#nftHolding',
            chain: 'eip155:8453',
            contract: contract.trim(),
            tokenId: tokenId.trim() || undefined,
          }
        : null
  const canSave = !!condition && !!text.trim() && !createGate.isPending

  const onSave = () => {
    if (!condition) return
    createGate.mutate(
      {post, text: text.trim(), condition},
      {
        onSuccess: () =>
          control.close(() => {
            Toast.show(l`Token-gated content added`, {type: 'success'})
          }),
      },
    )
  }

  return (
    <View style={[a.gap_lg]}>
      <View style={[a.gap_xs]}>
        <Text style={[a.text_2xl, a.font_bold]}>
          <Trans>Add token-gated content</Trans>
        </Text>
        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
          <Trans>
            Your post stays public as a teaser. This extra text is stored on
            Krao’s gate service, not in your public repo, and is only shown to
            people whose linked wallets meet the requirement.
          </Trans>
        </Text>
      </View>

      <View style={[a.gap_sm]}>
        <TextField.LabelText>
          <Trans>Gated text</Trans>
        </TextField.LabelText>
        <TextField.Root>
          <TextField.Input
            label={l`Gated text`}
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={4}
            maxLength={3000}
          />
        </TextField.Root>
      </View>

      <View style={[a.gap_sm]}>
        <TextField.LabelText>
          <Trans>Who can unlock it</Trans>
        </TextField.LabelText>
        <View style={[a.flex_row, a.gap_sm]}>
          <Button
            label={l`Token balance`}
            color={kind === 'token' ? 'primary' : 'secondary'}
            size="small"
            onPress={() => setKind('token')}>
            <ButtonText>
              <Trans>Token balance</Trans>
            </ButtonText>
          </Button>
          <Button
            label={l`NFT holders`}
            color={kind === 'nft' ? 'primary' : 'secondary'}
            size="small"
            onPress={() => setKind('nft')}>
            <ButtonText>
              <Trans>NFT holders</Trans>
            </ButtonText>
          </Button>
        </View>

        {kind === 'token' ? (
          <>
            <View style={[a.flex_row, a.gap_sm]}>
              {TIP_ASSETS.map(option => (
                <Button
                  key={option.id}
                  label={option.symbol}
                  color={
                    option.id === asset.id ? 'primary_subtle' : 'secondary'
                  }
                  size="small"
                  onPress={() => setAsset(option)}>
                  <ButtonText>{option.symbol}</ButtonText>
                </Button>
              ))}
            </View>
            <TextField.LabelText>
              <Trans>Minimum balance ({asset.symbol} on Base)</Trans>
            </TextField.LabelText>
            <TextField.Root isInvalid={!minUnits}>
              <TextField.Input
                label={l`Minimum balance`}
                value={minAmount}
                onChangeText={setMinAmount}
                keyboardType="decimal-pad"
              />
            </TextField.Root>
          </>
        ) : (
          <>
            <TextField.LabelText>
              <Trans>NFT contract on Base</Trans>
            </TextField.LabelText>
            <TextField.Root>
              <TextField.Input
                label={l`NFT contract`}
                placeholder="0x…"
                value={contract}
                onChangeText={setContract}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </TextField.Root>
            <TextField.LabelText>
              <Trans>Token ID (optional, any token if empty)</Trans>
            </TextField.LabelText>
            <TextField.Root>
              <TextField.Input
                label={l`Token ID`}
                value={tokenId}
                onChangeText={setTokenId}
                keyboardType="number-pad"
              />
            </TextField.Root>
          </>
        )}
      </View>

      {createGate.error && (
        <Admonition type="error">{createGate.error.message}</Admonition>
      )}

      <Button
        testID="saveGateButton"
        label={l`Add gated content`}
        color="primary"
        size="large"
        disabled={!canSave}
        onPress={onSave}>
        {createGate.isPending && <ButtonIcon icon={Loader} />}
        <ButtonText>
          <Trans>Add gated content</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}
