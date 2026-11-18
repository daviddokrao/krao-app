import {useState} from 'react'
import {View} from 'react-native'
import {Image} from 'expo-image'
import {Trans, useLingui} from '@lingui/react/macro'

import {openUnifiedPicker} from '#/lib/media/picker'
import {type PickerImage} from '#/lib/media/picker.shared'
import {atoms as a, useTheme, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {Image_Stroke2_Corner2_Rounded as ImageIcon} from '#/components/icons/Image'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import {VideoClip_Stroke2_Corner0_Rounded as VideoIcon} from '#/components/icons/VideoClip'
import {Loader} from '#/components/Loader'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {parseUnits, TIP_ASSETS, type TipAsset} from '#/features/tips/assets'
import {
  type GateCondition,
  GATED_IMAGES_MAX,
  useCreateGateMutation,
} from '../queries'

type Kind = 'token' | 'nft'

/** Lets an author attach token-gated text and images to one of their posts */
export function GateDialog({
  control,
  post,
  replaceRuleUri,
}: {
  control: Dialog.DialogControlProps
  post: {uri: string; cid: string}
  /** The post's current gate, which saving replaces */
  replaceRuleUri?: string
}) {
  const {t: l} = useLingui()
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={
          replaceRuleUri
            ? l`Replace token-gated content`
            : l`Add token-gated content`
        }
        style={web({maxWidth: 480})}>
        <GateDialogInner
          control={control}
          post={post}
          replaceRuleUri={replaceRuleUri}
        />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function GateDialogInner({
  control,
  post,
  replaceRuleUri,
}: {
  control: Dialog.DialogControlProps
  post: {uri: string; cid: string}
  replaceRuleUri?: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const createGate = useCreateGateMutation()
  const [text, setText] = useState('')
  const [images, setImages] = useState<PickerImage[]>([])
  const [alts, setAlts] = useState<Record<string, string>>({})
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
  const canSave =
    !!condition && (!!text.trim() || images.length > 0) && !createGate.isPending

  const onAddMedia = async () => {
    const result = await openUnifiedPicker({
      selectionCountRemaining: GATED_IMAGES_MAX - images.length,
    })
    const picked: PickerImage[] = (result.assets ?? []).map(asset => ({
      path: asset.uri,
      mime:
        asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      width: asset.width,
      height: asset.height,
      size: asset.fileSize ?? 0,
    }))
    setImages(prev => [...prev, ...picked].slice(0, GATED_IMAGES_MAX))
  }

  const onSave = () => {
    if (!condition) return
    createGate.mutate(
      {post, text: text.trim(), images, alts, condition, replaceRuleUri},
      {
        onSuccess: () =>
          control.close(() => {
            Toast.show(
              replaceRuleUri
                ? l`Token-gated content replaced`
                : l`Token-gated content added`,
              {type: 'success'},
            )
          }),
      },
    )
  }

  return (
    <View style={[a.gap_lg]}>
      <View style={[a.gap_xs]}>
        <Text style={[a.text_2xl, a.font_bold]}>
          {replaceRuleUri ? (
            <Trans>Replace token-gated content</Trans>
          ) : (
            <Trans>Add token-gated content</Trans>
          )}
        </Text>
        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
          <Trans>
            Your post stays public as a teaser. This extra text and media are
            stored on Krao’s gate service, not in your public repo, and are only
            shown to people whose linked wallets meet the requirement.
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
        {images.length > 0 && (
          <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
            {images.map((image, i) => (
              <View key={image.path} style={[a.relative]}>
                {image.mime.startsWith('video/') ? (
                  <View
                    style={[
                      a.rounded_sm,
                      a.align_center,
                      a.justify_center,
                      t.atoms.bg_contrast_50,
                      {width: 72, height: 72},
                    ]}>
                    <VideoIcon
                      size="lg"
                      style={[t.atoms.text_contrast_medium]}
                    />
                  </View>
                ) : (
                  <Image
                    source={{uri: image.path}}
                    style={[a.rounded_sm, {width: 72, height: 72}]}
                    contentFit="cover"
                    accessibilityLabel={alts[image.path] || l`Image ${i + 1}`}
                    accessibilityHint=""
                    accessibilityIgnoresInvertColors
                  />
                )}
                <Button
                  label={l`Remove media`}
                  color="secondary"
                  size="tiny"
                  shape="round"
                  style={[a.absolute, {top: 2, right: 2}]}
                  onPress={() =>
                    setImages(prev => prev.filter((_, j) => j !== i))
                  }>
                  <ButtonIcon icon={XIcon} />
                </Button>
              </View>
            ))}
          </View>
        )}
        {images.map((image, i) =>
          image.mime.startsWith('video/') ? null : (
            <TextField.Root key={`alt-${image.path}`}>
              <TextField.Input
                label={l`Alt text for image ${i + 1}`}
                placeholder={l`Describe image ${i + 1} for people who can't see it`}
                value={alts[image.path] ?? ''}
                onChangeText={value =>
                  setAlts(prev => ({...prev, [image.path]: value}))
                }
                maxLength={1000}
              />
            </TextField.Root>
          ),
        )}
        {images.length < GATED_IMAGES_MAX && (
          <Button
            testID="gateAddImageButton"
            label={l`Add a gated image or video`}
            color="secondary"
            size="small"
            style={[a.self_start]}
            onPress={() => void onAddMedia()}>
            <ButtonIcon icon={ImageIcon} />
            <ButtonText>
              <Trans>Add image or video</Trans>
            </ButtonText>
          </Button>
        )}
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
